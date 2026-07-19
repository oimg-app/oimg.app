---
phase: 11-batch-optimize-export
plan: 06
subsystem: export
tags: [phase-11, wave-2, file-row, context-menu, EXP-01, D-04, WCAG-AA]
requires:
  - 11-00 (save-file mocks + ingest helpers)
  - 11-04 (useExport.exportOne)
provides:
  - "FileRow ContextMenu 'Save as…' wired to useExport.exportOne with disable-when-not-done gate"
  - "WCAG-AA regression guard: ESC close + ArrowDown nav e2e coverage"
affects:
  - src/components/panels/files/FileRow.tsx
  - src/tests/file-row-menu.spec.ts
tech-stack:
  added: []
  patterns:
    - "Radix ContextMenu's `disabled` prop maps to both aria-disabled and data-disabled"
    - "D-13 disable-then-explain pattern applied at row level (title tooltip on disabled menu item)"
    - "Wire-in-place (no FileRowMenu.tsx extraction) per 11-PATTERNS.md note 283"
key-files:
  created:
    - src/tests/file-row-menu.spec.ts
  modified:
    - src/components/panels/files/FileRow.tsx
decisions:
  - "Did NOT extract a new FileRowMenu.tsx component — wire existing stub in place (matches 11-PATTERNS recommendation + Phase 10 'do not over-extract' precedent)"
  - "Disabled menu item with title attribute (vs hidden) per RESEARCH Q1 — consistent with D-13 disable-then-explain UX"
metrics:
  duration: "~10 min"
  completed: "2026-06-02"
  tasks_completed: 2
  files_touched: 2
  commits: 2
  e2e_tests_added: 5
---

# Phase 11 Plan 06: FileRow ContextMenu "File options" wiring (D-04 + WCAG-AA) Summary

D-04 per-row Download wired by replacing the existing `Save as…` ContextMenuItem stub in `FileRow.tsx` with a call to `useExport().exportOne(file)`; menu item is disabled when `file.status !== 'done'` with a `title="Optimize this file first"` tooltip. Five-test Playwright suite asserts D-04 wiring + WCAG-AA keyboard a11y (ESC close, ArrowDown nav) + the disabled-gate regression guard.

## What Was Built

### Task 1 — Wire ContextMenuItem (commit `da8ebad`)
- Added `import { useExport } from '@/hooks/useExport'` to `src/components/panels/files/FileRow.tsx`
- Added `const { exportOne } = useExport()` inside the component body
- Replaced the stub `onSelect={() => { /* @TODO Phase 3 — pushToast('Save as') */ }}` with `onSelect={() => { void exportOne(file) }}`
- Added `disabled={file.status !== 'done'}` so non-done rows render the item with `aria-disabled="true"` (Radix mapping)
- Added `title={file.status !== 'done' ? 'Optimize this file first' : undefined}` so hover surfaces the gate reason
- Did NOT extract a new `FileRowMenu.tsx` per 11-PATTERNS line 283 + Phase 10 precedent

### Task 2 — E2E spec (commit `25512a8`)
- Created `src/tests/file-row-menu.spec.ts` with 5 tests under `test.describe('EXP-01 — Per-row File Options Menu (D-04)')`
- Uses store-injection (analog: `export-zip.spec.ts`) — no real codec encode in the loop
- `installSaveFileMocks(page, { mode: 'accept' })` captures the saved blob into `window.__savedFiles`
- All 5 tests passed: `PASS (5) FAIL (0)` in 154s

## Verification Run

| Command | Exit | Notes |
| ------- | ---- | ----- |
| `npx playwright test src/tests/file-row-menu.spec.ts --reporter=dot` | 0 | PASS (5) FAIL (0) — 154s |
| `grep -F "exportOne(file)" src/components/panels/files/FileRow.tsx \| wc -l` | 1 line | exact wiring count |
| `npx tsc -b` | (pre-existing baseline debt) | No new errors in FileRow.tsx / useExport.ts — confirmed via `grep -i "FileRow\|useExport"` returning empty |

## Deviations from Plan

None — plan executed exactly as written. Wiring matches 11-PATTERNS.md verbatim recommendation (lines 270, 274-280); disabled state + title applied per RESEARCH.md Open Question 1 disposition.

## Threat Model Status

| Threat ID | Disposition | Status |
| --------- | ----------- | ------ |
| T-11-DIS  | mitigate    | Wired — `disabled={file.status !== 'done'}` on the menu item + Plan 04's `if (!entry.encodedBuffer) return` in `exportOne` (defense-in-depth) |
| T-11-KB   | mitigate    | Wired — Tests 3 (ESC) + 4 (ArrowDown) assert Radix ContextMenu's inherited WCAG-AA semantics |
| T-11-EXT  | accept      | Held — no `FileRowMenu.tsx` extracted; ContextMenu stays inside FileRow.tsx (single source) |

## Carry-Forward for Plan 07

- D-04 per-row Download is complete for the user-visible row menu.
- The other `@TODO Phase 3` stubs in `FileRow.tsx` (`Re-optimize`, `Copy data URI`, `Copy <picture>`, `Reveal in compare`, `Apply same settings to all`) remain as stubs — out of scope for Plan 06; track separately if Plan 07/08 covers them.
- Toolbar's "Save individually" (Plan 05) was intentionally untouched.

## Self-Check: PASSED

- File exists: `src/components/panels/files/FileRow.tsx` (modified, includes `exportOne(file)`)
- File exists: `src/tests/file-row-menu.spec.ts` (created, 168 lines, 5 tests)
- Commit `da8ebad` found in `git log` (feat 11-06 wiring)
- Commit `25512a8` found in `git log` (test 11-06 e2e)
- Playwright suite green: PASS (5) FAIL (0)
