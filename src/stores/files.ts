// Phase 2 — Files store (canonical FileEntry data).
// Source: 02-CONTEXT.md D-07; 02-PATTERNS.md lines 165-202.
// Persistent in spirit (Phase 7 wires IndexedDB).
// Migrated from zustand to nanostores.

import { map } from 'nanostores'
import { toast } from 'sonner'
import { FileEntry, FormatId, Density } from '@/types'
import { applyDensitySuffix, deduplicateName } from '@/lib/filename'
import { sniffPngDimensions } from '@/lib/sniff'
import { estimateJobBytes } from '@/lib/memory-budget'

export interface FileEntryWithBlob extends FileEntry {
  sourceBlob: Blob
  sourceMeta: {
    width: number
    height: number
    profile: string
  }
  optimizedBlob: Blob | null
  optimizedMeta: {
    width: number
    height: number
    profile: string
    format: string
  }
  /** Phase 4 D-11(b) — peak working-set estimate for this variant.
   *  Computed at addSourceWithVariants time via estimateJobBytes (PNG path)
   *  or compression-ratio heuristic (other rasters). App.tsx threads this
   *  into PoolJob.byteEstimate when enqueuing the pool job. */
  byteEstimate?: number
  settings: Record<string, string>
}

interface FilesData {
  byId: Record<string, FileEntryWithBlob>
  order: string[]
  selectedId: string | null
  filterQuery: string
}

export const filesStore = map<FilesData>({
  byId: {},
  order: [],
  selectedId: null,
  filterQuery: '',
})

// ─── Actions ─────────────────────────────────────────────────────────────────

export function filterBy(_value: string) {
  // @TODO: filter files list by query
}

export function applyToAllFiles(_fileId: string | null) {
  // @TODO: apply to all files
  // @TODO: find settings applied for fileId, apply to all files with the same extension
  toast.info('Settings applied to all {Extension} files')
}

export function addFile(entry: FileEntryWithBlob) {
  const s = filesStore.get()
  filesStore.set({
    ...s,
    byId: { ...s.byId, [entry.id]: entry },
    order: s.order.includes(entry.id) ? s.order : [...s.order, entry.id],
  })
}

export function removeFile(fileId: string) {
  // Lazy imports to break circular dependency — same pattern as old getState() calls.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runtimeStore, revokeObjectURL } = require('./runtime') as typeof import('./runtime')
  revokeObjectURL(fileId)

  // WR-02: drop the per-file snippet toggle entry from the settings store.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { settingsStore, clearPerFile } = require('./settings') as typeof import('./settings')
  const sSettings = settingsStore.get()
  if (fileId in sSettings.snippetTogglesByFileId) {
    const { [fileId]: _drop, ...rest } = sSettings.snippetTogglesByFileId
    settingsStore.setKey('snippetTogglesByFileId', rest)
  }
  clearPerFile(fileId)

  const s = filesStore.get()
  const { [fileId]: _removed, ...rest } = s.byId
  filesStore.set({
    ...s,
    byId: rest,
    order: s.order.filter((id) => id !== fileId),
    selectedId: s.selectedId === fileId ? null : s.selectedId,
  })

  void runtimeStore // silence unused import warning
}

export function markDone(
  fileId: string,
  optimizedBlob: Blob,
  optimizedSize: number,
  sanitizedCount?: number,
) {
  // PATTERNS.md Pitfall 3 — revoke the OLD url BEFORE writing the new optimized Blob.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { revokeObjectURL } = require('./runtime') as typeof import('./runtime')
  revokeObjectURL(fileId)

  const s = filesStore.get()
  const prev = s.byId[fileId]
  if (!prev) return
  filesStore.setKey('byId', {
    ...s.byId,
    [fileId]: {
      ...prev,
      optimizedBlob,
      optimizedSize,
      status: 'done',
      ...(sanitizedCount !== undefined ? { sanitizedCount } : {}),
    },
  })
}

export function setSelected(fileId: string | null) {
  filesStore.setKey('selectedId', fileId)
}

export function setSort(sortBy: string) {
  const s = filesStore.get()
  if (sortBy === 'queue order') {
    filesStore.setKey('order', s.order)
  } else if (sortBy === 'file size') {
    const sorted = [...s.order].sort((a, b) => s.byId[a].originalSize - s.byId[b].originalSize)
    filesStore.setKey('order', sorted)
  }
}

export function setStatus(fileId: string, status: FileEntry['status']) {
  const s = filesStore.get()
  const prev = s.byId[fileId]
  if (!prev) return
  filesStore.setKey('byId', { ...s.byId, [fileId]: { ...prev, status } })
}

export function setSourceDensity(fileId: string, density: FileEntry['sourceDensity']) {
  const s = filesStore.get()
  const prev = s.byId[fileId]
  if (!prev) return
  filesStore.setKey('byId', { ...s.byId, [fileId]: { ...prev, sourceDensity: density } })
}

/** Phase 5 D-12 — export-scope density selector. Does NOT trigger re-optimize. */
export function setTargetDensities(fileId: string, targetDensities: Density[]) {
  const s = filesStore.get()
  const prev = s.byId[fileId]
  if (!prev) return
  filesStore.setKey('byId', { ...s.byId, [fileId]: { ...prev, targetDensities } })
}

/** Phase 5 plan 05-04 — per-file ICC preserve override. */
export function setPreserveIcc(fileId: string, preserveIcc: boolean) {
  const s = filesStore.get()
  const prev = s.byId[fileId]
  if (!prev) return
  filesStore.setKey('byId', { ...s.byId, [fileId]: { ...prev, preserveIcc } })
}

export function clear() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { revokeObjectURL } = require('./runtime') as typeof import('./runtime')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { settingsStore } = require('./settings') as typeof import('./settings')

  for (const fileId of Object.keys(filesStore.get().byId)) {
    revokeObjectURL(fileId)
  }
  settingsStore.setKey('snippetTogglesByFileId', {})
  filesStore.set({ byId: {}, order: [], selectedId: null, filterQuery: '' })
}

/** @deprecated Phase 5 D-11: superseded by single-FileEntry model.
 *  Call addFile() for new dropped files instead.
 *  Do NOT remove until Playwright raster.spec.ts tests are updated. */
export async function addSourceWithVariants(args: {
  sourceBlob: Blob
  sourceDensity: Density
  name: string
  format: FormatId
  targets: Density[]
}): Promise<void> {
  if (args.targets.length === 0) return

  const sourceUuid = crypto.randomUUID()
  const dims = args.format === 'png' ? await sniffPngDimensions(args.sourceBlob) : null

  const existingNames = new Set<string>(
    Object.values(filesStore.get().byId).map((e) => e.name),
  )

  const newEntries: FileEntryWithBlob[] = []
  let renameCount = 0
  for (const tgt of args.targets) {
    const proposedName = applyDensitySuffix(args.name, tgt)
    const finalName = deduplicateName(proposedName, existingNames)
    if (finalName !== proposedName) renameCount++
    existingNames.add(finalName)

    let byteEstimate: number | undefined
    if (dims) {
      const tgtScale = parseInt(tgt) / parseInt(args.sourceDensity)
      const tgtW = Math.max(1, Math.round(dims.width * tgtScale))
      const tgtH = Math.max(1, Math.round(dims.height * tgtScale))
      byteEstimate = estimateJobBytes(dims.width, dims.height, tgtW, tgtH)
    } else {
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
      sourceMeta: {
        width: dims?.width ?? 0,
        height: dims?.height ?? 0,
        profile: 'sRGB',
      },
      optimizedBlob: null,
      optimizedMeta: {
        width: dims?.width ?? 0,
        height: dims?.width ?? 0,
        profile: 'sRGB',
        format: 'WebP q82',
      },
      settings: {},
      byteEstimate,
    })
  }

  // Atomic push
  const s = filesStore.get()
  const nextById = { ...s.byId }
  const nextOrder = [...s.order]
  for (const entry of newEntries) {
    if (!nextById[entry.id]) nextOrder.push(entry.id)
    nextById[entry.id] = entry
  }
  filesStore.set({
    ...s,
    byId: nextById,
    order: nextOrder,
    selectedId: s.selectedId || nextOrder[0] || null,
  })

  if (renameCount > 0) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { markRename } = require('./runtime') as typeof import('./runtime')
    markRename(renameCount)
  }
}

/** @deprecated Phase 5 D-11: superseded by single-FileEntry model. */
export function removeFamily(sourceFamilyId: string) {
  const ids = Object.values(filesStore.get().byId)
    .filter((e) => e.sourceFamilyId === sourceFamilyId)
    .map((e) => e.id)
  for (const id of ids) {
    removeFile(id)
  }
}
