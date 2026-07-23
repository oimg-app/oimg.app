---
phase: 13
plan: 05
subsystem: shell/Toolbar
wave: 2
tags: [phase-13, wave-2, toolbar, clear-all, disable-then-explain, T-13-03, CLR-01]
requires: [clearFiles + $queueEmpty (Phase 13 Plan 04), runtimeAtom.runningJobs (Phase 03 STORE-04), Settings popover (Phase 03 NAV-02)]
provides:
  - "Toolbar Settings popover 'Clear all' menu item with D-14 disable-then-explain triple"
  - "T-13-03 in-flight confirmation: sonner toast.warning with 'Clear anyway' action when runningJobs > 0"
  - "Stable e2e selectors for Plan 07 Tabs wrap: getByRole('button', { name: 'Clear all' })"
affects:
  - src/components/shell/Toolbar.tsx
  - src/tests/toolbar-clear.spec.ts
tech_stack:
  added: []
  patterns:
    - "Phase 11 D-13 disable-then-explain triple verbatim shape (disabled+aria-disabled+title)"
    - "runtimeAtom.get() snapshot inside handler (NO useStore) — avoids re-renders on job-count change"
    - "sonner toast.warning + action.onClick for single-click confirmation (no modal)"
    - "Absolute /src/... dynamic imports inside page.evaluate (CLAUDE.md MEMORY accepted Vite pattern)"
    - "setJobCounts(running, queued) reused as test-side runtimeAtom mutator (no worker spin-up)"
key_files:
  created:
    - src/tests/toolbar-clear.spec.ts
  modified:
    - src/components/shell/Toolbar.tsx
decisions:
  - "Read runtimeAtom.get().runningJobs inside handleClearAll instead of useStore(runtimeAtom) — handler-only access avoids Toolbar re-renders every time the pool publishes a job-count delta"
  - "Confirmation lives on the affordance side, NOT in clearFiles() — store action stays a pure mutation per Plan 04 D-13 purity contract"
  - "Button label is the literal 'Clear all' (not 'Clear queue' / 'Clear files') — matches D-14 spec and is the future-proof e2e selector that Plan 07 Tabs wrap will inherit"
  - "Popover closes via setOpen(null) ALWAYS — even when the warning toast appears, so the user doesn't have to dismiss the popover separately to interact with the toast action"
metrics:
  duration: ~12 min
  tasks: 2
  files_modified: 1
  files_created: 1
  completed: 2026-06-10
---

# Phase 13 Plan 05: Toolbar Settings Clear all + warning toast Summary

D-14 affordance + T-13-03 mitigation: a "Clear all" menu item in the existing Toolbar Settings popover with the canonical Phase 11 disable-then-explain triple, plus a sonner warning toast that gates `clearFiles()` behind explicit confirmation when work is in flight.

## What Shipped

**`src/components/shell/Toolbar.tsx`** — three additive changes:

1. **Imports** — extend `@/stores/files` to import `$queueEmpty` + `clearFiles`; extend `@/stores/runtime` to import `runtimeAtom`; add `import { toast } from 'sonner'`.

2. **Component body** — three new locals near the existing `useStore` block:
   ```ts
   const queueEmpty = useStore($queueEmpty)
   const clearDisabledTitle = queueEmpty ? 'No files to clear' : undefined
   const handleClearAll = () => {
     const { runningJobs } = runtimeAtom.get()   // snapshot read, NOT useStore
     if (runningJobs > 0) {
       toast.warning(`Cancel ${runningJobs} in-flight jobs?`, {
         action: { label: 'Clear anyway', onClick: () => clearFiles() },
       })
       return
     }
     clearFiles()
   }
   ```

3. **Settings PopoverContent** — new button AFTER `Workers: 4 (auto)`, INSIDE the same `<div className="flex flex-col">`:
   ```tsx
   <button
     type="button"
     className={cn(menuItemClass, queueEmpty && 'opacity-50 cursor-not-allowed')}
     onClick={() => { handleClearAll(); setOpen(null) }}
     disabled={queueEmpty}
     aria-disabled={queueEmpty}
     title={clearDisabledTitle}
   >Clear all</button>
   ```

**`src/tests/toolbar-clear.spec.ts`** — three Playwright tests:

| # | Test | What it proves |
|---|------|----------------|
| 1 | empty queue → Clear all has `aria-disabled='true'` + `title='No files to clear'` | D-14 disable-then-explain triple |
| 2 | runningJobs=0 + 3 entries → click Clear all → `0 files` + popover closes | idle-path clearFiles() fires + setOpen(null) |
| 3 | runningJobs=2 + 3 entries → click Clear all → sonner `Cancel 2 in-flight jobs?` appears, queue still 3 files; click `Clear anyway` → 0 files | T-13-03 mitigation: confirmation gate held; user-confirmed clearFiles via toast action |

Uses absolute `/src/...` dynamic imports inside `page.evaluate` (CLAUDE.md MEMORY: accepted Vite pattern); uses `setJobCounts(2, 0)` to force `runningJobs > 0` without spinning workers.

## TDD Gate Compliance

- Task 1 (`feat`) commit `fd1ea21` — `feat(13-05): Toolbar Clear all + T-13-03 warning-toast handler`. The plan declares `tdd="true"` for both tasks but the RED phase for the UI button is the e2e spec in Task 2 (a unit RED for a JSX button is not productive — the Phase 04 unit RED already covered `clearFiles()`/`$queueEmpty`).
- Task 2 (`test`) commit `3bc65a1` — `test(13-05): e2e Toolbar Clear all — D-14 disable + T-13-03 warning toast`. Three tests PASS against the Task 1 implementation; running the spec against pre-Task-1 HEAD would FAIL (no `Clear all` button exists in the popover) — RED-to-GREEN traceable.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Acceptance grep | `grep -q "Clear all" && grep -q "Clear anyway" && grep -q "No files to clear" && grep -q 'useStore(\$queueEmpty)' && grep -q "runtimeAtom.get()" && grep -q "sonner" && grep -c "Workers: 4 (auto)" == 1` | `GREP-OK` |
| Test-file acceptance grep | `test -f src/tests/toolbar-clear.spec.ts && grep -q "Clear anyway" && grep -q "setJobCounts"` | `TEST-FILE-OK` |
| Playwright | `npx playwright test src/tests/toolbar-clear.spec.ts --reporter=list` | `PASS (3) FAIL (0)` in 156s |
| Typecheck delta | `npx tsc -b` after vs before Task 1 | Zero new Toolbar.tsx errors (baseline pre-existing tsc debt is noted in CLAUDE.md MEMORY) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing rollup native binary @rollup/rollup-darwin-arm64**
- **Found during:** Task 2 first `playwright test` attempt — webServer failed to start with `Error: Cannot find module @rollup/rollup-darwin-arm64` (npm/cli#4828 optional-deps bug).
- **Fix:** `npm i @rollup/rollup-darwin-arm64 --no-save` — restored the missing native binary so Vite dev server can boot.
- **Files modified:** none (no-save install — node_modules only).
- **Commit:** none (infra fix, not source).

**2. [Rule 3 - Blocking] Relative `../stores/files` dynamic import in page.evaluate fails**
- **Found during:** Task 2 first spec run (Tests 2 + 3) — `TypeError: Failed to fetch dynamically imported module: http://localhost:5174/stores/files` (page-URL-relative resolution stripped the `/src/` prefix).
- **Fix:** Switched to absolute `/src/stores/files.ts` + `/src/lib/stub-data.ts` + `/src/stores/runtime.ts` per CLAUDE.md MEMORY `typecheck-and-test-gotchas` ("`/src/...` page.evaluate imports are an accepted Vite pattern").
- **Files modified:** `src/tests/toolbar-clear.spec.ts` (same commit as Task 2 — fix landed before commit).
- **Commit:** `3bc65a1`.

**3. [Rule 1 - Cosmetic] Prettier reformatted Toolbar.tsx via IDE save hook**
- **Found during:** Test pass — the IDE applied repo-wide Prettier on save, reflowing the import block + JSX into multi-line form with double quotes and trailing semicolons.
- **Fix:** Accepted the reformatted output (semantically identical; matches the rest of the file's existing style after lint).
- **Files modified:** `src/components/shell/Toolbar.tsx` (same Task 2 commit — bundled with the e2e spec).
- **Commit:** `3bc65a1`.

## Auth Gates

None encountered.

## Threat Surface Scan

No new threat surface introduced. Pre-declared T-13-03 (accidental queue wipe mid-batch) is mitigated as designed by the `handleClearAll` runningJobs>0 branch + the toast confirmation. No new network endpoints, no new file access, no schema changes.

## Carry-Forward for Plan 07 (Settings Tabs wrap)

- The "Clear all" `<button>` lives inside the existing `<div className="flex flex-col">` directly after `Workers: 4 (auto)`. Plan 07 wraps that container in Radix Tabs (`General` + `Diagnostics`). The Clear all button moves into `<TabsContent value="general">` without identity change — same className expression, same onClick handler, same disable-then-explain triple. The e2e selector `page.getByRole('button', { name: /^Clear all$/ })` continues to match after the wrap.
- Plan 06 (FilesPane × icon — D-15) consumes the SAME `$queueEmpty` + `clearFiles` pair. Plan 06 should mirror the disable triple but is free to choose whether to also wrap with the T-13-03 toast (recommended: yes, for affordance parity).
- `runtimeAtom.get()` is the canonical snapshot read for cross-store reads inside event handlers when re-render on the source-atom change is unwanted. Plan 07 Diagnostics tab can adopt the same pattern for its read-only `<dl>` if hover-driven (the current PATTERNS map already uses `useStore` there — no change).

## Commits

- `fd1ea21` feat(13-05): Toolbar Clear all + T-13-03 warning-toast handler
- `3bc65a1` test(13-05): e2e Toolbar Clear all — D-14 disable + T-13-03 warning toast

## Self-Check: PASSED

- `src/components/shell/Toolbar.tsx` Clear all button + handler: FOUND
- `src/tests/toolbar-clear.spec.ts`: FOUND
- Commit `fd1ea21` in git log: FOUND
- Commit `3bc65a1` in git log: FOUND
- Playwright `PASS (3) FAIL (0)`: FOUND in tee log `1781099XXX_playwright.log`
