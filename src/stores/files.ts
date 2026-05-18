// Phase 02 — STORE-01: filesAtom map + computed atoms + actions. Source: 02-01-PLAN.md
import { map, computed } from 'nanostores'
import type { FileEntry, SortKey } from '@/lib/stub-data'
import { STUB_FILES } from '@/lib/stub-data'

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
