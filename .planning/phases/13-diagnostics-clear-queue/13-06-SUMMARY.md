---
phase: 13
plan: 06
subsystem: panels/FilesPane
wave: 2
tags: [phase-13, wave-2, filespane, clear-icon, disable-then-explain, T-13-03, CLR-01]
requires:
  - "clearFiles + $queueEmpty (Phase 13 Plan 04)"
  - "runtimeAtom.runningJobs (Phase 03 STORE-04)"
  - "FilesPane header sort+add ghost-button shape (Phase 02 FILES-01 + Phase 10 Plan 04)"
provides:
  - "FilesPane header × icon (XCircle) with D-15 disable-then-explain triple + dual-title"
  - "T-13-03 in-flight confirmation: sonner toast.warning with 'Clear anyway' action when runningJobs > 0"
  - "Stable e2e selector: getByRole('button', { name: 'Clear all files' })"
affects:
  - src/components/panels/FilesPane.tsx
  - src/tests/filespane-clear.spec.ts
tech_stack:
  added: []
  patterns:
    - "Phase 11 D-13 disable-then-explain triple verbatim shape (disabled+aria-disabled+title)"
    - "D-15 dual-title pattern: title=queueEmpty ? 'No files to clear' : 'Clear all files'"
    - "runtimeAtom.get() snapshot inside handler (NO useStore) — affordance parity with Plan 05 Toolbar"
    - "sonner toast.warning + action.onClick for single-click confirmation (no modal)"
    - "Absolute /src/... dynamic imports inside page.evaluate (CLAUDE.md MEMORY accepted Vite pattern)"
    - "Mirror-the-sibling-spec test shape: filespane-clear.spec.ts mirrors toolbar-clear.spec.ts"
key_files:
  created:
    - src/tests/filespane-clear.spec.ts
  modified:
    - src/components/panels/FilesPane.tsx
decisions:
  - "Placement: LEFT of the Sort funnel button — destructive action visually separated from Add (preserves muscle memory; rightmost remains Add per Phase 02 FILES-01 convention)"
  - "Local handleClearAll, NOT a shared hook — two two-button-tree-shaking is irrelevant; PATTERNS line 467-482 documents this; identical character-for-character to Plan 05 Toolbar handler so the e2e contract is identical across affordances"
  - "Dual-title shape (TWO values per state) — explanation when disabled ('No files to clear'), action description when enabled ('Clear all files') — per D-15 + PATTERNS line 427"
  - "useStore($queueEmpty) for re-render-on-state-change (the button's disabled/title attrs depend on it); runtimeAtom.get() for snapshot read inside handler (NO re-render on job-count delta)"
  - "4 e2e tests (vs Plan 05's 3) — added the enabled-state title test (Test 4) to explicitly prove BOTH halves of the D-15 dual-title triple, since the FilesPane spec is the primary D-15 regression net"
metrics:
  duration: ~10 min
  tasks: 2
  files_modified: 1
  files_created: 1
  completed: 2026-06-10
---

# Phase 13 Plan 06: FilesPane header XCircle button + warning toast Summary

D-15 affordance + T-13-03 mitigation: a small ghost `XCircle` icon button in the FilesPane header with the canonical Phase 11 D-13 disable-then-explain triple (extended to a dual-title shape per D-15), plus the sonner warning toast that gates `clearFiles()` behind explicit confirmation when work is in flight. Behavior parity with Plan 05's Toolbar "Clear all" so users can reach for whichever affordance is closer to their current focus without surprise.

## What Shipped

**`src/components/panels/FilesPane.tsx`** — five additive changes:

1. **Imports** — extend `@phosphor-icons/react` named-imports to include `XCircle`; extend `@/stores` barrel import to add `$queueEmpty` + `clearFiles`; add `import { runtimeAtom } from '@/stores/runtime'` and `import { toast } from 'sonner'`.

2. **Component body** — one new `useStore` subscription after the existing `totals` line:
   ```ts
   const queueEmpty = useStore($queueEmpty)
   ```

3. **Local handler** — `handleClearAll` defined right after `handleDrop`, character-for-character identical to Plan 05's Toolbar handler:
   ```ts
   function handleClearAll() {
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

4. **Header × button** — INSERTED as the FIRST child of the existing `<div className="flex items-center gap-1">` cluster, LEFT of the Sort Popover (placement per the "Claude's Discretion" guidance in 13-CONTEXT.md decisions):
   ```tsx
   <button
     className={cn(
       "w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]",
       queueEmpty && 'opacity-50 cursor-not-allowed'
     )}
     aria-label="Clear all files"
     title={queueEmpty ? 'No files to clear' : 'Clear all files'}
     onClick={() => handleClearAll()}
     disabled={queueEmpty}
     aria-disabled={queueEmpty}
   >
     <XCircle size={13} />
   </button>
   ```

5. **Existing FilesPane behavior fully preserved** — dropzone, useIngest, sort popover (Funnel), Add button (Plus) + hidden file input, file list `<ul>`, totals bar all untouched.

**`src/tests/filespane-clear.spec.ts`** — four Playwright tests:

| # | Test | What it proves |
|---|------|----------------|
| 1 | empty queue → × has `aria-disabled='true'` + `title='No files to clear'` | D-15 disable-then-explain half-1 (disabled-state title) |
| 2 | runningJobs=0 + 3 entries → click × → `0 files` | idle-path clearFiles() fires directly |
| 3 | runningJobs=2 + 3 entries → click × → sonner `Cancel 2 in-flight jobs?` appears, queue still 3 files; click `Clear anyway` → 0 files | T-13-03 mitigation: confirmation gate held; user-confirmed clearFiles via toast action |
| 4 | entries present → `title='Clear all files'` + button NOT `aria-disabled` | D-15 disable-then-explain half-2 (enabled-state title — the dual-title other half) |

The spec uses absolute `/src/...` dynamic imports inside `page.evaluate` per CLAUDE.md MEMORY (accepted Vite pattern); uses `setJobCounts(2, 0)` reused from `src/stores/runtime.ts` to force `runningJobs > 0` without spinning workers — identical mechanics to `src/tests/toolbar-clear.spec.ts` for affordance parity.

## TDD Gate Compliance

- Task 1 (`feat`) commit `fb35423` — `feat(13-06): FilesPane header XCircle button + T-13-03 warning-toast handler`.
- Task 2 (`test`) commit `9643692` — `test(13-06): e2e FilesPane × button — D-15 dual-title + T-13-03 warning toast`. Four tests PASS against the Task 1 implementation; running the spec against pre-Task-1 HEAD would FAIL (no `Clear all files` button exists in FilesPane header) — RED-to-GREEN traceable.

Note: per the precedent set by Plan 05's SUMMARY, the unit RED for a JSX button isn't productive when the underlying store action already has a RED→GREEN unit gate (Plan 04 commit `9a5e641`). The e2e spec IS the regression net for the JSX behavior; the unit RED already covered `clearFiles()`/`$queueEmpty`.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Acceptance grep (Task 1) | `grep XCircle && 'Clear all files' && 'No files to clear' && Clear anyway && useStore(\$queueEmpty) && runtimeAtom.get() && Add files count=1 && Sort files count=1` | `GREP-OK` |
| Acceptance grep (Task 2) | `test -f spec && Clear all files && Clear anyway && setJobCounts && aria-disabled && 'No files to clear' && Cancel 2 in-flight jobs` | `TEST-FILE-OK` |
| Playwright | `npx playwright test src/tests/filespane-clear.spec.ts --reporter=dot` | `PASS (4) FAIL (0)` in 154621ms |
| Typecheck delta | `npx tsc -b 2>&1 \| grep FilesPane.tsx` | `NO_FILESPANE_ERRORS` — zero new errors introduced by this plan (baseline pre-existing tsc debt unchanged per CLAUDE.md MEMORY) |

## Deviations from Plan

None — plan executed exactly as written. The exact import grouping, button placement (LEFT of Sort), className expression, attribute order, and handler shape are character-identical to PATTERNS §"`src/components/panels/FilesPane.tsx` (modify — D-15)" lines 389-427 and to Plan 05 Toolbar handler (lines 467-482).

## Auth Gates

None encountered.

## Threat Surface Scan

No new threat surface introduced. Pre-declared T-13-03 (accidental queue wipe mid-batch via the × icon) is mitigated as designed by the `handleClearAll` runningJobs>0 branch + the toast confirmation. Test 3 asserts the path. The defense-in-depth note from the threat model still holds: `clearFiles()` is idempotent on empty entries (Plan 04 confirmed), so DOM-tampering bypasses of the disabled state are no-ops. No new network endpoints, no new file access, no schema changes.

## Carry-Forward for Plan 07 (Settings Tabs wrap + VALIDATION)

- The × button lives at line 70-83 of `src/components/panels/FilesPane.tsx` (inside the header right-cluster, FIRST child). Plan 07 does NOT touch this affordance — it lives in FilesPane, not Toolbar.
- Plan 07's VALIDATION.md row `13-07-filespane-x` (the D-15 e2e gate) now flips ⬜ → ✅: the four-test spec covers BOTH halves of the D-15 dual-title triple PLUS the T-13-03 confirmation mechanism.
- The e2e selector `page.getByRole('button', { name: 'Clear all files' })` is stable: aria-label is the canonical accessible name. Plan 07 (Settings Tabs wrap) and any future Phase 13 plans can rely on this selector.
- The Toolbar "Clear all" selector (`name: /^Clear all$/`) and the FilesPane × selector (`name: 'Clear all files'`) are distinct on purpose — same outcome, different accessible names, lets either spec target its affordance unambiguously.

## Commits

- `fb35423` feat(13-06): FilesPane header XCircle button + T-13-03 warning-toast handler
- `9643692` test(13-06): e2e FilesPane × button — D-15 dual-title + T-13-03 warning toast

## Self-Check: PASSED

- src/components/panels/FilesPane.tsx XCircle button + handleClearAll: FOUND
- src/tests/filespane-clear.spec.ts: FOUND
- Commit fb35423 in git log: FOUND
- Commit 9643692 in git log: FOUND
- Playwright `PASS (4) FAIL (0)`: FOUND in tee log `1781100*_playwright.log`
