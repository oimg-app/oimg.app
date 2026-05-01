// Phase 2 — Files store (canonical FileEntry data).
// Source: 02-CONTEXT.md D-07; 02-PATTERNS.md lines 165-202.
// Persistent in spirit (Phase 7 wires IndexedDB).

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { FileEntry } from '@/types'
import { useRuntimeStore } from './runtime'
import { useSettingsStore } from './settings'

export interface FileEntryWithBlob extends FileEntry {
  sourceBlob: Blob
  optimizedBlob: Blob | null
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
  clear: () => void
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
  })),
)
