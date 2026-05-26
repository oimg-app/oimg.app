// Phase 02 — STORE-01: filesAtom map + computed atoms + actions. Source: 02-01-PLAN.md
// Phase 09 — Plan 01: per-file settings actions (D-01/D-03/D-13) + buffer/error actions
import { map, computed } from 'nanostores'
import type { FileEntry, FileSettings, SortKey } from '@/lib/stub-data'
import { STUB_FILES } from '@/lib/stub-data'

// Re-export types so components import from store barrel, not from stub-data directly (STORE-08 convention)
export type { FileEntry, FileSettings, SortKey }

interface FilesState {
  entries: FileEntry[]
  selectedId: string | null
  filterQuery: string
  sortBy: SortKey
}

export const filesAtom = map<FilesState>({
  entries: STUB_FILES,
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})

export const $filteredFiles = computed(filesAtom, (s) => {
  const q = s.filterQuery.trim().toLowerCase()
  let result = q ? s.entries.filter((f) => f.name.toLowerCase().includes(q)) : [...s.entries]

  switch (s.sortBy) {
    case 'queue order':
      // Preserve original STUB_FILES index order
      result = result.slice().sort((a, b) => {
        const ai = STUB_FILES.findIndex((f) => f.id === a.id)
        const bi = STUB_FILES.findIndex((f) => f.id === b.id)
        return ai - bi
      })
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

// D-01/D-03: update a single key in the selected file's own FileSettings (T-9-01: typed key prevents arbitrary write)
export function setFileSettings<K extends keyof FileSettings>(
  id: string, key: K, value: FileSettings[K]
): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, settings: { ...e.settings!, [key]: value } } : e
  ))
}

// D-13: record per-file error (or clear it)
export function setFileError(id: string, error: string | undefined): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, error } : e
  ))
}

// Store encoded result + clear error on success
export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, encodedBuffer, opt: optimizedSize, error: undefined } : e
  ))
}

// Cache raw file bytes for live re-encode (D-05)
export function setFileRawBuffer(id: string, rawBuffer: ArrayBuffer): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, rawBuffer } : e
  ))
}
