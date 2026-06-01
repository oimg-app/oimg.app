// Phase 02 — STORE-01: filesAtom map + computed atoms + actions. Source: 02-01-PLAN.md
// Phase 09 — Plan 01: per-file settings actions (D-01/D-03/D-13) + buffer/error actions
// Phase 10 — Plan 02: D-04 — empty seed (app starts with no demo files); queue-order sort uses createdAt
import { map, computed } from 'nanostores'
import type { FileEntry, FileSettings, SortKey } from '@/lib/stub-data'
import { defaultFileSettings } from '@/lib/stub-data'

// Re-export types so components import from store barrel, not from stub-data directly (STORE-08 convention)
export type { FileEntry, FileSettings, SortKey }

interface FilesState {
  entries: FileEntry[]
  selectedId: string | null
  filterQuery: string
  sortBy: SortKey
}

export const filesAtom = map<FilesState>({
  entries: [],  // D-04: app starts empty — no seeded demo files (Phase 10 Plan 02)
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})

export const $filteredFiles = computed(filesAtom, (s) => {
  const q = s.filterQuery.trim().toLowerCase()
  let result = q ? s.entries.filter((f) => f.name.toLowerCase().includes(q)) : [...s.entries]

  switch (s.sortBy) {
    case 'queue order':
      // Sort ascending by createdAt (insertion order). ?? 0 handles legacy entries without the field (Pitfall 2 / D-04).
      result = result.slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      break
    case 'file size':
      result = result.slice().sort((a, b) => b.orig - a.orig)
      break
    case 'savings %':
      result = result.slice().sort((a, b) => {
        const aPct = a.orig > 0 ? (a.orig - a.opt) / a.orig : 0
        const bPct = b.orig > 0 ? (b.orig - b.opt) / b.orig : 0
        return bPct - aPct
      })
      break
    case 'name':
      result = result.slice().sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'format':
      result = result.slice().sort((a, b) => a.type.localeCompare(b.type))
      break
  }

  return result
})

export const $selectedFile = computed(filesAtom, (s) => s.entries.find((f) => f.id === s.selectedId) ?? null)

export const $totals = computed(filesAtom, (s) => {
  const orig = s.entries.reduce((acc, f) => acc + f.orig, 0)
  const opt = s.entries.reduce((acc, f) => acc + f.opt, 0)
  const saved = orig - opt
  const pct = orig > 0 ? ((orig - opt) / orig) * 100 : 0
  return { orig, opt, saved, pct }
})

export function selectFile(id: string): void {
  filesAtom.setKey('selectedId', id)
}

export function removeFile(id: string): void {
  filesAtom.setKey('entries', filesAtom.get().entries.filter((f) => f.id !== id))
}

export function setFilter(q: string): void {
  filesAtom.setKey('filterQuery', q)
}

export function setSortBy(s: SortKey): void {
  filesAtom.setKey('sortBy', s)
}

// Add-file stubs — real handlers wired in v2
export function addFromDevice(): void {}
export function addWatchFolder(): void {}
export function addFromUrl(): void {}

// Export stubs — real handlers wired in v2
export function exportAsZip(): void {}
export function exportIndividually(): void {}
export function exportCopyHtml(): void {}
export function exportCopyDataUris(): void {}
export function exportManifestJson(): void {}

// Phase 09 — Plan 01: per-file settings + buffer/error actions (D-01/D-03/D-13)

// WR-02: single funnel for every per-entry mutation. All entry writers go through this one
// read-map-write helper so there is exactly one update path over the `entries` array. Each call is
// a synchronous nanostores read+setKey (no await spans the read and the write), so two writers
// touching different fields of the same id cannot interleave a stale snapshot between read and
// write — the second call always re-reads the array the first one just committed. `patch` receives
// the current entry and returns the changed fields to merge.
function updateEntry(id: string, patch: (e: FileEntry) => Partial<FileEntry>): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, ...patch(e) } : e
  ))
}

// D-01/D-03: update a single key in the selected file's own FileSettings (T-9-01: typed key prevents arbitrary write)
// CR-01: self-healing base — if an entry somehow lacks `settings` (legacy entry, future upload path
// that skipped seeding), fall back to a complete default derived from the entry's own type/q rather
// than spreading `undefined` (which collapsed the object to the single edited key). Entries are
// seeded with full settings at creation (stub-data.ts), so this is belt-and-suspenders.
export function setFileSettings<K extends keyof FileSettings>(
  id: string, key: K, value: FileSettings[K]
): void {
  updateEntry(id, (e) => ({
    settings: { ...(e.settings ?? defaultFileSettings(e.type, e.q)), [key]: value },
  }))
}

// D-13: record per-file error (or clear it). WR-01: flip status to 'error' when an error is
// recorded so the FileRow badge reflects it; clearing an error leaves status untouched.
export function setFileError(id: string, error: string | undefined): void {
  updateEntry(id, () => (error ? { error, status: 'error' as const } : { error: undefined }))
}

// Store encoded result + clear error on success. WR-01: mark 'done' so the processing
// status dot/shimmer clears once the worker returns real bytes (the test fixtures inject
// status:'done' directly, which previously masked the missing transition).
export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  updateEntry(id, () => ({ encodedBuffer, opt: optimizedSize, error: undefined, status: 'done' as const }))
}

// Phase 11 — Plan 01 (D-03): flip a file to in-flight state when its job is dispatched to
// the WorkerPool. Streaming write-back depends on the FileRow status field reflecting reality
// during the batch (queued → processing → done). Goes through the WR-02 updateEntry funnel so
// it can't interleave with setFileResult/setFileError on the same id.
export function setFileProcessing(id: string): void {
  updateEntry(id, () => ({ status: 'processing' as const, error: undefined }))
}

// Cache raw file bytes for live re-encode (D-05)
export function setFileRawBuffer(id: string, rawBuffer: ArrayBuffer): void {
  updateEntry(id, () => ({ rawBuffer }))
}
