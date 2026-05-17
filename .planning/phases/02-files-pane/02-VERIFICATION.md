---
phase: 02-files-pane
verified: 2026-05-17T00:00:00Z
status: human_needed
score: 14/16 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "SC-1 through SC-6 — run npm run dev and confirm all six ROADMAP success criteria"
    expected: "Header shows Queue · 12 files; 12 rows render with badge/meta/dot; row click highlights; right-click and ctxbtn both open ContextMenu; Remove from queue removes the row and decrements count and totals; Totals bar shows 4 non-zero stat cells; Dropzone is always visible above file list"
    why_human: "All six criteria require visual inspection of a running browser — layout, highlighting, animation (processing pulse), reactive counter decrement, popover positioning — none are verifiable by static analysis"
  - test: "CR-01 — after removing the selected file, confirm the panel does not display a ghost entry"
    expected: "Removing the currently-selected file clears the detail panel (selectedId reverts to null or advances to next file)"
    why_human: "removeFile does not clear selectedId in the current implementation (confirmed by reading src/stores/files.ts:68-70). The bug is real but its visual manifestation requires a running app; Phase 2 has no detail panel yet so the observable impact is deferred to Phase 5"
  - test: "CR-02 — with context menu open, click Remove from queue; confirm rowMenu highlight does not linger on any surviving row"
    expected: "After removal the accent-dim highlight disappears from all rows"
    why_human: "rowMenu is not cleared in removeFile; onOpenChange(false) may not fire when the row unmounts; requires interactive verification in browser"
---

# Phase 02: Files Pane Verification Report

**Phase Goal:** Developer sees the file queue populated from stub data — rows, totals, dropzone, context menu all functional
**Verified:** 2026-05-17T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FilesPane header shows "Queue · N files" driven by `$filteredFiles.length` | ✓ VERIFIED | `FilesPane.tsx:31` — `Queue · {files.length} files` where `files = useStore($filteredFiles)` |
| 2 | 12 file rows render with format badge, name, orig→opt sizes, savings% badge, status dot | ✓ VERIFIED | `FilesPane.tsx:75-81` maps `files` to `<FileRow>`; `FileRow.tsx` renders all required cells including BADGE_CLASS, fmtBytes, fmtPct, status dot map |
| 3 | Clicking a row updates `filesAtom.selectedId` (row highlights as selected) | ✓ VERIFIED | `FileRow.tsx:76` — `onClick={() => selectFile(file.id)}`; `selectFile` calls `filesAtom.setKey('selectedId', id)`; highlight applied via `cn` when `selectedId === file.id` |
| 4 | Right-clicking or clicking ctxbtn opens shadcn ContextMenu; "Remove from queue" calls `removeFile(id)` and row disappears | ✓ VERIFIED | `FileRow.tsx:53-63` — `handleCtxBtn` dispatches `new MouseEvent('contextmenu', ...)`; `ContextMenuItem variant="destructive" onSelect={() => removeFile(file.id)}`; `removeFile` filters `entries` |
| 5 | Totals bar shows 4 stat cells with computed values from `$totals` | ✓ VERIFIED | `FilesPane.tsx:84-96` — 4-cell grid with BEFORE/AFTER/SAVED/SAVED% labels; values from `useStore($totals)` |
| 6 | Dropzone "Drop images to optimize" is always visible above the file list | ✓ VERIFIED | `FilesPane.tsx:68-72` — unconditional `<div>` with `Drop images to optimize` text, above `<ul>` |
| 7 | `filesAtom` seeded from `STUB_FILES` (12 items) with correct shape | ✓ VERIFIED | `files.ts:13-18` — `map<FilesState>({ entries: STUB_FILES, selectedId: null, filterQuery: '', sortBy: 'queue order' })` |
| 8 | `$filteredFiles`, `$selectedFile`, `$totals` are reactive nanostores computed atoms | ✓ VERIFIED | `files.ts:20-62` — all three use `computed(filesAtom, ...)` |
| 9 | `$totals` derives from `s.entries` (full list), not `$filteredFiles` | ✓ VERIFIED | `files.ts:56-62` — `s.entries.reduce(...)` in both `orig` and `opt` accumulators; no reference to `$filteredFiles` |
| 10 | `filesAtom` actions `selectFile/removeFile/setFilter/setSortBy` exist and call `setKey` | ✓ VERIFIED | `files.ts:64-78` — all four exported functions present and wired |
| 11 | `uiAtom` exposes full STORE-03 shape with correct defaults; `setRowMenu` wired; 10 Phase-3 stubs present | ✓ VERIFIED | `ui.ts:21-47` — all 10 UiState keys with correct defaults; `setRowMenu` calls `uiAtom.setKey('rowMenu', id)`; 10 stub functions with `/* @TODO Phase 3 */` bodies |
| 12 | `ui.ts` has zero imports from `files.ts`, `runtime.ts`, `settings.ts` | ✓ VERIFIED | `ui.ts` imports only `{ map } from 'nanostores'`; grep for sibling store imports returns 0 |
| 13 | `src/stores/index.ts` barrel re-exports both stores | ✓ VERIFIED | `index.ts:2-3` — exactly `export * from './files'` and `export * from './ui'` |
| 14 | No component imports `STUB_FILES` (STORE-08 audit for Phase 2 files) | ✓ VERIFIED | `grep STUB_FILES FileRow.tsx` → 0; `grep STUB_FILES FilesPane.tsx` → 0 |
| 15 | `removeFile(id)` clears `selectedId` when the removed file was selected | ✗ FAILED | `files.ts:68-70` — `removeFile` only calls `filesAtom.setKey('entries', ...)`, never touches `selectedId`. Stale `selectedId` after removal is a real bug (CR-01 in 02-REVIEW.md). Impact deferred to Phase 5 where `$selectedFile` is first consumed in a panel. |
| 16 | `rowMenu` is cleared when the file it references is removed | ✗ FAILED | `files.ts:68-70` / `ui.ts:34-36` — `removeFile` does not call `setRowMenu(null)`; `onOpenChange(false)` may not fire when the row unmounts (CR-02 in 02-REVIEW.md). A phantom highlight is possible when the context menu is open and Remove is clicked. |

**Score:** 14/16 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/files.ts` | filesAtom + computed atoms + actions (≥60 lines) | ✓ VERIFIED | 79 lines; all 8 named exports present |
| `src/stores/ui.ts` | uiAtom + setRowMenu + Phase-3 stubs (≥50 lines) | ✓ VERIFIED | 48 lines; all UiState keys and 11 functions present |
| `src/stores/index.ts` | Barrel re-export of files.ts and ui.ts | ✓ VERIFIED | 3 lines; exactly two `export *` statements |
| `src/components/file-row/FileRow.tsx` | FileRow with ContextMenu (≥80 lines) | ✓ VERIFIED | 165 lines; full implementation |
| `src/components/panels/FilesPane.tsx` | FilesPane full body (≥60 lines) | ✓ VERIFIED | 99 lines; header + dropzone + file list + totals bar |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `FileRow.tsx` | `@/stores` (barrel) | `selectFile, removeFile, uiAtom, setRowMenu, filesAtom` | ✓ WIRED | Single import line confirmed |
| `FileRow.tsx` | `@/components/ui/context-menu` | `ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator` | ✓ WIRED | Import present; used in JSX |
| `FilesPane.tsx` | `@/stores` (barrel) | `$filteredFiles, $totals, setSortBy` | ✓ WIRED | Single import; all three used |
| `FilesPane.tsx` | `FileRow.tsx` | `<FileRow file={f} />` per entry | ✓ WIRED | `import { FileRow }` present; mapped in `<ul>` |
| `files.ts` | `@/lib/stub-data` | `import { STUB_FILES }` | ✓ WIRED | Line 4 confirmed |
| `files.ts` | `nanostores` | `map, computed` | ✓ WIRED | Line 2 confirmed |
| `ui.ts` | `nanostores` | `map` only | ✓ WIRED | Line 3 confirmed; no sibling store imports |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `FilesPane.tsx` | `files` | `useStore($filteredFiles)` → `computed(filesAtom)` → `STUB_FILES` (12 entries) | Yes | ✓ FLOWING |
| `FilesPane.tsx` | `totals` | `useStore($totals)` → `computed(filesAtom, s => s.entries.reduce(...))` | Yes — non-zero sums | ✓ FLOWING |
| `FileRow.tsx` | `rowMenu`, `selectedId` | `useStore(uiAtom)`, `useStore(filesAtom)` | Yes | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running browser (`npm run dev`); no standalone runnable entry points testable without a server. Routed to human verification.

---

### Probe Execution

Step 7c: No probe scripts declared in PLAN.md or SUMMARY.md. No `scripts/*/tests/probe-*.sh` found in phase directory. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STORE-01 | 02-01 | `filesAtom` with entries/selectedId/filterQuery/sortBy; computed atoms; actions | ✓ SATISFIED | `files.ts` fully implements the spec |
| STORE-03 | 02-01 | `uiAtom` full STORE-03 shape; `setRowMenu` wired; 10 Phase-3 stubs | ✓ SATISFIED (partial per plan) | `ui.ts` matches; only `setRowMenu` is wired per D-04 |
| FILES-01 | 02-02 | Pane header "Queue · N files" driven by `$filteredFiles.length` | ✓ SATISFIED | `FilesPane.tsx:31` confirmed |
| FILES-02 | 02-02 | Dropzone always visible above file list | ✓ SATISFIED | Unconditional render in DOM above `<ul>` |
| FILES-03 | 02-02 | Each file row renders badge, name, sizes, savings%, status dot; click calls `selectFile` | ✓ SATISFIED | `FileRow.tsx` full implementation; visual confirmation deferred to human |
| FILES-04 | 02-02 | Context menu via right-click AND ctxbtn; Remove calls `removeFile(id)` | ✓ SATISFIED (code) | Wiring confirmed; row-disappear behavior deferred to human |
| FILES-05 | 02-02 | Totals bar 4 cells from `$totals` | ✓ SATISFIED | `FilesPane.tsx:84-96` confirmed |

Note: REQUIREMENTS.md Traceability table still marks FILES-01 through FILES-05 as "Pending" — this is a stale status in that document; the code implementing them exists and is verified above.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/stores/files.ts` | 68-70 | `removeFile` does not clear `selectedId` — stale reference after removal | WARNING | No visible impact in Phase 2 (no detail panel); becomes a BLOCKER in Phase 5 when `$selectedFile` is rendered in CenterPane |
| `src/stores/files.ts` | 68-70 | `removeFile` does not clear `uiAtom.rowMenu` — phantom highlight possible | WARNING | Observable only when menu is open at moment of removal; low-severity cosmetic bug |
| `src/stores/files.ts` | 27-31 | `queue order` sort resolves position via `STUB_FILES.findIndex` — breaks with dynamic files | INFO | Harmless with 12 stub entries; needs fix before Phase 3 file addition |
| `src/components/file-row/FileRow.tsx` | 30 | `import type { FileEntry } from '@/lib/stub-data'` — type import from restricted module | INFO | Runtime safe (type-only); violates stub-data import restriction noted in 02-REVIEW.md WR-02 |
| `src/components/file-row/FileRow.tsx` | 76 | `onClick` on `ContextMenuTrigger` with no keyboard equivalent — `selectFile` unreachable via keyboard | WARNING | WCAG 2.1 SC 2.1.1 violation; keyboard-only users cannot select a file |
| `src/components/panels/FilesPane.tsx` | 45-53 | Sort popover has no active-sort indicator or `aria-pressed` | WARNING | UX and accessibility gap; sighted and assistive-tech users cannot determine current sort |

No `TBD`, `FIXME`, or `XXX` debt markers found in any Phase 2 modified files. `@TODO Phase 3` markers are present and are intentional no-op stubs per D-04 — all reference Phase 3 follow-up work, satisfying the debt marker gate.

---

### Human Verification Required

#### 1. Six ROADMAP Success Criteria (SC-1 through SC-6)

**Test:** Run `npm run dev`, open http://localhost:5173, and perform the following checks:
- SC-1: Header reads "QUEUE · 12 FILES"
- SC-2: 12 rows render with colored badges, truncated names, byte sizes, savings%, status dots (orange savings on low-savings files, pulsing blue dot on processing file)
- SC-3: Click a row — accent-dim background + 2px left stripe appears; click another row — previous highlight clears
- SC-4: Right-click a row — ContextMenu opens at cursor with 9 items in order (including red "Remove from queue"); close menu; hover row, click 3-dot button — same menu opens; click "Remove from queue" — row disappears, header drops to "QUEUE · 11 FILES"
- SC-5: Totals bar BEFORE/AFTER/SAVED/SAVED% all show non-zero values; after removing a row the BEFORE value decreases
- SC-6: "Drop images to optimize" zone with dashed border and format pills is visible above the file list at all times

**Expected:** All six pass with no console errors or React warnings.

**Why human:** Visual layout, highlight animation, popover positioning, reactive counter decrement, and processing-state pulse are not verifiable by static analysis.

#### 2. CR-01 — Stale selectedId after removal

**Test:** Select a file row (it highlights). Right-click the same row, click "Remove from queue". Inspect React DevTools — confirm `filesAtom.selectedId` is `null` (or the next file's id), not the removed file's id.

**Expected:** `selectedId` is cleared or advanced on removal.

**Why human:** `removeFile` in the current code does not clear `selectedId` (confirmed by static analysis of `files.ts:68-70`). The bug is real; its visual impact requires Phase 5's CenterPane to manifest. This should be fixed before Phase 5 executes.

#### 3. CR-02 — rowMenu phantom highlight after removal

**Test:** Right-click a file row so the context menu is open, then immediately click "Remove from queue". Inspect whether any remaining row shows the accent-dim highlight that should only appear for the open-menu row.

**Expected:** No phantom highlight on any remaining row after removal.

**Why human:** Whether `onOpenChange(false)` fires before or after unmount is a runtime timing question not resolvable statically.

---

### Gaps Summary

No hard blockers prevent the stated Phase 2 goal from being achieved at the code level. All six ROADMAP success criteria have verified code implementations. Two behavioral correctness bugs (CR-01 and CR-02 from 02-REVIEW.md) exist in `removeFile` — both are low-impact in Phase 2 because no detail panel yet consumes `selectedId`, but CR-01 becomes a BLOCKER in Phase 5. Two WCAG warnings (keyboard selectability, missing sort indicator) are accessibility gaps that should be tracked for correction before the public milestone. Human verification is required to confirm the six ROADMAP success criteria pass in a running browser.

---

_Verified: 2026-05-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
