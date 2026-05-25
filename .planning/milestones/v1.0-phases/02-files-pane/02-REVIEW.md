---
phase: 02-files-pane
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/stores/files.ts
  - src/stores/ui.ts
  - src/stores/index.ts
  - src/components/file-row/FileRow.tsx
  - src/components/panels/FilesPane.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed covering the nanostore layer (`filesAtom`, `uiAtom`, barrel) and the two Phase 02 UI components (`FileRow`, `FilesPane`). The implementation is broadly sound: no circular imports, computed atoms are correctly derived, and the `useStore` hook is applied consistently. However, two correctness bugs exist — one causes incorrect selection persistence after file removal, and one produces a permanent `rowMenu` highlight state when only one file remains. Four warnings surface around accessibility gaps, stub-data coupling in the sort comparator, and stub-restriction violations in components. Three minor info items cover TODOs and a magic-number threshold.

---

## Critical Issues

### CR-01: Removed file can remain `selectedId`, corrupting `$selectedFile`

**File:** `src/stores/files.ts:68-70`

`removeFile` deletes the entry from `entries` but never clears `selectedId`. If the removed file was selected, `$selectedFile` still holds its `id` in state; `$selectedFile` computed atom then returns `null` (entry gone) but `selectedId` remains a stale non-null string. Any downstream consumer that checks `selectedId !== null` to decide whether to show a detail panel will show a panel for a file that no longer exists. When real file data is wired up (Phase 3+) this becomes a data-loss-adjacent UI bug — the panel could display a ghost entry or retain an index reference from a previous file list.

**Fix:**
```typescript
export function removeFile(id: string): void {
  const { entries, selectedId } = filesAtom.get()
  const next = entries.filter((f) => f.id !== id)
  filesAtom.set({
    ...filesAtom.get(),
    entries: next,
    selectedId: selectedId === id
      ? (next[0]?.id ?? null)   // auto-select first remaining, or clear
      : selectedId,
  })
}
```

---

### CR-02: `rowMenu` state not cleared on file removal — permanent highlight

**File:** `src/stores/files.ts:68-70` / `src/stores/ui.ts:34-36`

If the context menu is open for a file and `removeFile` is called (e.g., user selects "Remove from queue" from the context menu), `uiAtom.rowMenu` is never reset. After the file disappears from the list, `rowMenu` still holds the deleted id. Because `ContextMenu`'s `onOpenChange(false)` fires only when the menu closes normally — but the file row is unmounted before close fires — the `setRowMenu(null)` callback in `onOpenChange` never runs. The next rendered file that coincidentally gets the same id (currently impossible with stable stub ids, but inevitable with dynamic ids) would render permanently highlighted.

**Fix:** `removeFile` must also clear `rowMenu` if it matches:
```typescript
import { uiAtom } from './ui'   // ui.ts does not import files.ts, so no circular dep

export function removeFile(id: string): void {
  const state = filesAtom.get()
  const next = state.entries.filter((f) => f.id !== id)
  filesAtom.set({ ...state, entries: next, selectedId: state.selectedId === id ? (next[0]?.id ?? null) : state.selectedId })
  if (uiAtom.get().rowMenu === id) uiAtom.setKey('rowMenu', null)
}
```

> Note: importing `uiAtom` into `files.ts` does NOT violate the circular-ESM guard stated in `ui.ts` — the guard only prohibits `ui.ts` importing `files.ts`. The reverse direction is safe.

---

## Warnings

### WR-01: `$filteredFiles` "queue order" sort hardcodes `STUB_FILES` as the reference array

**File:** `src/stores/files.ts:27-31`

The `queue order` sort resolves position by calling `STUB_FILES.findIndex(...)` on the static stub array. When real files are added dynamically (Phase 3+), any file not in `STUB_FILES` will return `findIndex` = `-1` for both `a` and `b`, collapsing them all to relative order 0 and producing an unstable sort. The intent is "insertion order"; the correct implementation is to store insertion order explicitly (e.g. an `order` field on `FileEntry`, or a separate `insertionOrder: string[]` in the store state).

**Fix (minimal for Phase 3 readiness):**
```typescript
// In FilesState, add:
insertionOrder: string[]   // ids in the order they were added

// In addFile action:
filesAtom.setKey('insertionOrder', [...filesAtom.get().insertionOrder, newFile.id])

// In $filteredFiles 'queue order' case:
const orderMap = new Map(s.insertionOrder.map((id, i) => [id, i]))
result = result.slice().sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
```

---

### WR-02: Stub-data restriction violated — `FileRow` imports from `@/lib/stub-data`

**File:** `src/components/file-row/FileRow.tsx:30`

`stub-data.ts` line 1 states: *"this module must NOT be imported by components. Only stores (Phase 2+) and tests may import it."* `FileRow` imports `type { FileEntry }` from `@/lib/stub-data`, violating this contract. While it is a type-only import (erased at runtime), establishing the habit of importing from `stub-data` in components risks future authors importing the data constants (`STUB_FILES`, `STUB_SVGO_PLUGINS`) directly into components.

**Fix:** Re-export `FileEntry` from `@/stores` or a dedicated `@/types` barrel so components never import from `@/lib/stub-data`:
```typescript
// src/stores/index.ts — add:
export type { FileEntry, SortKey, FileStatus } from '@/lib/stub-data'

// FileRow.tsx — change:
import type { FileEntry } from '@/stores'  // no longer touches stub-data
```

---

### WR-03: `ContextMenuTrigger` `onClick` fires without keyboard equivalent — `selectFile` unreachable via keyboard

**File:** `src/components/file-row/FileRow.tsx:76`

`onClick` on `ContextMenuTrigger` handles file selection, but there is no `onKeyDown`/`onKeyUp` handler for `Enter` or `Space`. A keyboard user tabbing to a row can trigger the context menu (Radix handles that) but cannot select a file without a mouse click. WCAG 2.1 SC 2.1.1 requires all functionality to be keyboard-operable.

**Fix:** Add a keyboard handler, or switch `ContextMenuTrigger` to use `asChild` with a native `<button>` that gets both click and key events naturally:
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    selectFile(file.id)
  }
}}
```

---

### WR-04: `setSortBy` in `FilesPane` does not reflect current sort visually — no active-sort indicator

**File:** `src/components/panels/FilesPane.tsx:45-53`

The sort popover renders all five sort buttons identically — no visual or ARIA indicator distinguishes the active sort key. The `sortBy` value from `filesAtom` is never read in `FilesPane`. A screen reader and sighted user cannot determine the current sort without observing list order changes. This also means the sort button group fails WCAG 4.1.3 (Status Messages) and breaks the expected popover UX described in `02-UI-SPEC.md`.

**Fix:** Read `sortBy` from the store and apply active styling + `aria-pressed`:
```tsx
const { sortBy } = useStore(filesAtom)
// ...
<button
  key={key}
  aria-pressed={sortBy === key}
  className={cn(
    'text-xs px-2 py-1 rounded hover:bg-[var(--bg-2)] text-left w-full',
    sortBy === key && 'bg-[var(--accent-dim)] text-[var(--accent)]'
  )}
  onClick={() => setSortBy(key)}
>
```

---

## Info

### IN-01: `FilesPane` imports `filesAtom` indirectly from `$filteredFiles` but never reads `filesAtom` directly — redundant store subscription pattern implied

**File:** `src/components/panels/FilesPane.tsx:4`

`FilesPane` uses `$filteredFiles` and `$totals` (both computed atoms) but calls `setSortBy` without confirming which key is active (see WR-04). Once WR-04 is fixed, `filesAtom` will need to be subscribed in `FilesPane`. The import already re-exports it via the barrel — just documenting for clarity.

---

### IN-02: Multiple stub action bodies are empty but export real function names — callers cannot detect no-ops

**File:** `src/stores/ui.ts:38-47`

Eight exported functions (`setOpen`, `setView`, `setTab`, etc.) are no-ops with `/* @TODO Phase 3 */` comments. They silently swallow calls. If a Phase 3 component calls `setView('Compare')` while the stub is still wired, nothing fails and nothing is logged — the bug is invisible. Consider adding a `console.warn` or a `throw new Error('not implemented')` (behind `import.meta.env.DEV`) so integration mistakes surface immediately during development.

**Fix:**
```typescript
export function setView(_v: View): void {
  if (import.meta.env.DEV) console.warn('[ui] setView not implemented yet')
}
```

---

### IN-03: Magic number `30` in savings-percentage color threshold has no named constant

**File:** `src/components/file-row/FileRow.tsx:101`

`savingsPct < 30` controls warn vs. accent color with no explanation of why 30% is the threshold. Extract to a named constant at the top of the file or in a shared constants module.

**Fix:**
```typescript
const LOW_SAVINGS_THRESHOLD_PCT = 30
// ...
savingsPct < LOW_SAVINGS_THRESHOLD_PCT ? 'text-[var(--warn)]' : 'text-[var(--accent)]'
```

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
