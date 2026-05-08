// Phase 2 — Files store (canonical FileEntry data).
// Source: 02-CONTEXT.md D-07; 02-PATTERNS.md lines 165-202.
// Persistent in spirit (Phase 7 wires IndexedDB).

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { FileEntry, FormatId, SourceDensity, TargetDensity } from '@/types'
import { applyDensitySuffix, deduplicateName } from '@/lib/filename'
import { sniffPngDimensions } from '@/lib/sniff'
import { estimateJobBytes } from '@/lib/memory-budget'
import { useRuntimeStore } from './runtime'
import { useSettingsStore } from './settings'

export interface FileEntryWithBlob extends FileEntry {
  sourceBlob: Blob
  optimizedBlob: Blob | null
  /** Phase 4 D-11(b) — peak working-set estimate for this variant.
   *  Computed at addSourceWithVariants time via estimateJobBytes (PNG path)
   *  or compression-ratio heuristic (other rasters). App.tsx threads this
   *  into PoolJob.byteEstimate when enqueuing the pool job. */
  byteEstimate?: number
}

interface FilesState {
  byId: Record<string, FileEntryWithBlob>
  order: string[] // ordered FileEntry.ids for stable list rendering
  selectedId: string | null

  addFile: (entry: FileEntryWithBlob) => void
  removeFile: (fileId: string) => void
  // Called by WorkerPool consumer (App.tsx) when an adapter run completes
  // and (for SVG) DOMPurify has finished sanitizing on the main thread.
  // PATTERNS.md Pitfall 3: revoke OLD url BEFORE writing the new optimized Blob.
  // Phase 3 (D-03) — `sanitizedCount` is set by the SVG path (number of
  // dangerous elements/attrs DOMPurify removed, 0 = clean). Other formats
  // omit the parameter and FileEntry.sanitizedCount stays undefined.
  markDone: (
    fileId: string,
    optimizedBlob: Blob,
    optimizedSize: number,
    sanitizedCount?: number,
  ) => void
  setSelected: (fileId: string | null) => void
  setStatus: (fileId: string, status: FileEntry['status']) => void
  setSourceDensity: (fileId: string, density: FileEntry['sourceDensity']) => void
  // Phase 5 D-12 — export-scope density selector. Does NOT trigger re-optimize.
  setTargetDensities: (fileId: string, targetDensities: TargetDensity[]) => void
  clear: () => void
  /** @deprecated Phase 5 D-11: superseded by single-FileEntry model.
   *  Call useFilesStore.addFile() for new dropped files instead.
   *  Do NOT remove until Playwright raster.spec.ts tests are updated (they call addSourceWithVariants).
   *  See .planning/phases/05-raster-encoders/05-CONTEXT.md D-11.
   *
   * Phase 4 D-04 + D-14 — fan out N FileEntryWithBlob entries per source.
   *  Each entry has id `${sourceUuid}-${density}`, name = applyDensitySuffix
   *  then deduplicateName, sourceFamilyId = sourceUuid, targetDensity = the
   *  variant density, byteEstimate seeded from sniffPngDimensions (PNG) or
   *  the blob.size heuristic. Collisions are reported to useRuntimeStore
   *  via markRename(count). Returns void; entries are pushed atomically. */
  addSourceWithVariants: (args: {
    sourceBlob: Blob
    sourceDensity: SourceDensity
    name: string
    format: FormatId
    targets: SourceDensity[]
  }) => Promise<void>
  /** @deprecated Phase 5 D-11: superseded by single-FileEntry model.
   *  When using single addFile() model, call removeFile(fileId) directly.
   *  Do NOT remove until all callers are migrated.
   *
   * Phase 4 D-04 — remove all variants sharing a sourceFamilyId.
   *  Loops removeFile(variantId) per entry per RESEARCH §5.2 (preserves URL revoke). */
  removeFamily: (sourceFamilyId: string) => void
}

export const useFilesStore = create<FilesState>()(
  subscribeWithSelector((set) => ({
    byId: {},
    order: [],
    selectedId: null,

    addFile: (entry) =>
      set((s) => ({
        byId: { ...s.byId, [entry.id]: entry },
        order: s.order.includes(entry.id) ? s.order : [...s.order, entry.id],
      })),

    removeFile: (fileId) => {
      // D-10 + PATTERNS.md Pitfall 3 — revoke BEFORE byId deletion.
      useRuntimeStore.getState().revokeObjectURL(fileId)
      // WR-02: drop the per-file snippet toggle entry from the settings store
      // so the toggles map does not grow unbounded across drag-drop / remove
      // churn. Mirrors the URL-revocation cross-store pattern above.
      useSettingsStore.setState((s) => {
        if (!(fileId in s.snippetTogglesByFileId)) return {}
        const { [fileId]: _drop, ...rest } = s.snippetTogglesByFileId
        return { snippetTogglesByFileId: rest }
      })
      // T-5-03-02 / T-5-03-03 — clear per-file codec overrides so the perFile
      // Record does not grow unbounded as files are added and removed.
      useSettingsStore.getState().clearPerFile(fileId)
      set((s) => {
        const { [fileId]: _removed, ...rest } = s.byId
        return {
          byId: rest,
          order: s.order.filter((id) => id !== fileId),
          selectedId: s.selectedId === fileId ? null : s.selectedId,
        }
      })
    },

    markDone: (fileId, optimizedBlob, optimizedSize, sanitizedCount) => {
      // PATTERNS.md Pitfall 3 — revoke the OLD url for this fileId BEFORE writing the
      // new optimized Blob. Next render lazy-creates a fresh URL for the new Blob.
      useRuntimeStore.getState().revokeObjectURL(fileId)
      set((s) => {
        const prev = s.byId[fileId]
        if (!prev) return {}
        return {
          byId: {
            ...s.byId,
            [fileId]: {
              ...prev,
              optimizedBlob,
              optimizedSize,
              status: 'done',
              // Phase 3 (D-03) — only spread when defined so non-SVG formats
              // do not clobber an existing badge value (idempotent re-runs).
              ...(sanitizedCount !== undefined ? { sanitizedCount } : {}),
            },
          },
        }
      })
    },

    setSelected: (fileId) => set({ selectedId: fileId }),

    setStatus: (fileId, status) =>
      set((s) => {
        const prev = s.byId[fileId]
        if (!prev) return {}
        return { byId: { ...s.byId, [fileId]: { ...prev, status } } }
      }),

    setSourceDensity: (fileId, sourceDensity) =>
      set((s) => {
        const prev = s.byId[fileId]
        if (!prev) return {}
        return { byId: { ...s.byId, [fileId]: { ...prev, sourceDensity } } }
      }),

    setTargetDensities: (fileId, targetDensities) =>
      set((s) => {
        const prev = s.byId[fileId]
        if (!prev) return {}
        return { byId: { ...s.byId, [fileId]: { ...prev, targetDensities } } }
      }),

    clear: () => {
      // Revoke ALL outstanding URLs before clearing.
      const runtime = useRuntimeStore.getState()
      for (const fileId of Object.keys(useFilesStore.getState().byId)) {
        runtime.revokeObjectURL(fileId)
      }
      // WR-02: drop ALL per-file snippet toggle entries on clear so the
      // settings store does not retain dangling references to discarded files.
      useSettingsStore.setState({ snippetTogglesByFileId: {} })
      set({ byId: {}, order: [], selectedId: null })
    },

    // Phase 4 D-04 + D-14 — drop-time fan-out. UI (Plan 04-06) calls this once
    // per dropped source with the user-selected target density set; the action
    // materializes one FileEntryWithBlob per target density. Per Post-Research
    // amendment (CONTEXT.md "D-01 / D-02 SCOPED"), interactive editing of the
    // target set after drop is deferred to Phase 5; this action runs only at
    // initial drop time.
    addSourceWithVariants: async (args) => {
      if (args.targets.length === 0) return

      const sourceUuid = crypto.randomUUID()
      // Sniff once per source — dimension is identical across all variants of
      // the same source. Reused across the targets loop to seed each variant's
      // byteEstimate without re-reading the blob (D-11.b).
      const dims = args.format === 'png' ? await sniffPngDimensions(args.sourceBlob) : null

      // Pre-collect existing names for collision dedup. Read fresh on each call
      // so sequential drops see the current FileEntry name set.
      const existingNames = new Set<string>(
        Object.values(useFilesStore.getState().byId).map((e) => e.name),
      )

      const newEntries: FileEntryWithBlob[] = []
      let renameCount = 0
      for (const tgt of args.targets) {
        // D-16 — applyDensitySuffix FIRST, then dedup against the live name set.
        const proposedName = applyDensitySuffix(args.name, tgt)
        const finalName = deduplicateName(proposedName, existingNames)
        if (finalName !== proposedName) renameCount++
        // Track the final name in the same set so subsequent variants in this
        // batch don't collide with each other (e.g. two `logo.png` drops in a
        // single addSourceWithVariants call would both emit `logo (2)@1x.png`
        // without this — though in practice each call gets unique sourceUuids).
        existingNames.add(finalName)

        let byteEstimate: number | undefined
        if (dims) {
          // Density-to-pixel-scale: parseInt(targetDensity) / parseInt(sourceDensity).
          // Source 2x → target 1x = 0.5; source 2x → target 3x = 1.5.
          const tgtScale = parseInt(tgt) / parseInt(args.sourceDensity)
          const tgtW = Math.max(1, Math.round(dims.width * tgtScale))
          const tgtH = Math.max(1, Math.round(dims.height * tgtScale))
          byteEstimate = estimateJobBytes(dims.width, dims.height, tgtW, tgtH)
        } else {
          // Non-PNG fallback: blob.size × 10 (typical compression ratio) × 4
          // (RGBA) × 1.75 (WASM heap multiplier). Per RESEARCH §2.2(a). Same
          // multiplier as estimateJobBytes — keeps admission gate units consistent.
          byteEstimate = Math.ceil(args.sourceBlob.size * 10 * 4 * 1.75)
        }

        newEntries.push({
          id: `${sourceUuid}-${tgt}`,
          name: finalName,
          format: args.format,
          originalSize: args.sourceBlob.size,
          optimizedSize: null,
          status: 'idle',
          sourceDensity: args.sourceDensity,
          targetDensity: tgt,
          sourceFamilyId: sourceUuid,
          thumbnail: null,
          sourceBlob: args.sourceBlob,
          optimizedBlob: null,
          byteEstimate,
        })
      }

      // Atomic push — single set() call avoids Strict-Mode dev double-render
      // partial-write artifacts (PATTERNS Pitfall 3 generalized).
      set((s) => {
        const nextById = { ...s.byId }
        const nextOrder = [...s.order]
        for (const entry of newEntries) {
          if (!nextById[entry.id]) nextOrder.push(entry.id)
          nextById[entry.id] = entry
        }

        return {byId: nextById, order: nextOrder, selectedId: s.selectedId || nextOrder[0] || null}
      })

      // D-16 — report collisions for the toast latch. Plan 04-06 fires the
      // single-toast Sonner notification reading renameCountThisBatch.
      if (renameCount > 0) {
        useRuntimeStore.getState().markRename(renameCount)
      }
    },

    removeFamily: (sourceFamilyId) => {
      // RESEARCH §5.2 — loop and call existing removeFile so the per-id
      // urlCache revoke + snippetTogglesByFileId cleanup runs for every
      // variant. Snapshot ids first because removeFile mutates byId; iterating
      // live state would skip entries.
      const ids = Object.values(useFilesStore.getState().byId)
        .filter((e) => e.sourceFamilyId === sourceFamilyId)
        .map((e) => e.id)
      for (const id of ids) {
        useFilesStore.getState().removeFile(id)
      }
    },
  })),
)
