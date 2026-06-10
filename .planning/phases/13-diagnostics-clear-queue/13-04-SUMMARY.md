---
phase: 13
plan: 04
subsystem: stores/files
wave: 2
tags: [phase-13, wave-2, clearfiles, queue-hygiene, CLR-01]
requires: [filesAtom (Phase 02 STORE-01), $hasDone (Phase 11 Plan 07)]
provides:
  - "clearFiles() action — pure two-key mutation"
  - "$queueEmpty computed atom — drives D-14 + D-15 disable-then-explain in Plans 05/06"
affects: [src/stores/files.ts, src/tests/clearfiles.test.ts]
tech_stack:
  added: []
  patterns: [TDD RED→GREEN, atomic-setKey-per-field (CR-01 precedent), pure-store-action]
key_files:
  created:
    - src/tests/clearfiles.test.ts
  modified:
    - src/stores/files.ts
decisions:
  - "D-13 honored verbatim: clearFiles() is a pure mutation; the T-13-03 warning toast (runningJobs > 0) lives in the affordance wrappers (Plans 05/06), NOT in the store"
  - "Two atomic setKey calls instead of filesAtom.set({...}) — preserves filterQuery + sortBy and matches the CR-01 / runtime.ts:60-64 atomic-per-field precedent"
  - "$queueEmpty placed immediately after $hasDone for cohesion (computed-atom group stays contiguous)"
metrics:
  duration: ~6 min
  completed: 2026-06-10
---

# Phase 13 Plan 04: clearFiles() + $queueEmpty Summary

Pure store primitives for the CLR-01 Clear-queue feature: a two-setKey `clearFiles()` action plus the `$queueEmpty` computed atom that drives the disable-then-explain affordance triple in Plans 05 (Toolbar) and 06 (FilesPane).

## What Shipped

**`src/stores/files.ts`** — two new exports:

```ts
// Phase 13 — CLR-01 driver. Analog: $hasDone (line 66) + $totals (line 57).
export const $queueEmpty = computed(filesAtom, (s) => s.entries.length === 0)

// Phase 13 — CLR-01 / D-13: drop entries + selectedId in one transaction. Does NOT
// touch runtimeAtom (workers may still be in flight; the queue is a UI-side concept).
// ...
export function clearFiles(): void {
  filesAtom.setKey('entries', [])
  filesAtom.setKey('selectedId', null)
}
```

**`src/tests/clearfiles.test.ts`** — 11 assertions covering:
- Two-key atomic mutation (entries:[], selectedId:null)
- `$queueEmpty` flips with `entries.length`
- `filterQuery` + `sortBy` survive `clearFiles()` (no whole-state clobber)
- Purity contract: store file has zero `runtime`/`sonner`/`pushToast` imports

## TDD Gate Compliance

- **RED:** commit `9a5e641` — `test(13-04): add failing unit for clearFiles() + $queueEmpty` (test fails with `clearFiles is not a function`)
- **GREEN:** commit `94ed6c9` — `feat(13-04): clearFiles() action + $queueEmpty computed atom` (test passes: 11 passed, 0 failed)
- REFACTOR: not needed; implementation is two lines.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Unit test | `node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs src/tests/clearfiles.test.ts` | 11 passed, 0 failed |
| Regression | `node --experimental-strip-types src/tests/stores.test.ts` | 17 passed, 0 failed |
| Purity | `grep -cE "from '@/stores/runtime'\|from './runtime'\|from 'sonner'\|pushToast" src/stores/files.ts` | 0 |
| setKey count | `grep -c "filesAtom.setKey" src/stores/files.ts` | 7 (baseline 5 + 2 new) |
| Typecheck | `npx tsc -b` | Pre-existing debt in `components/ui/tabs.tsx` + `sonner.tsx`; this plan introduces zero new tsc errors (confirmed via stash-revert diff) |

## Deviations from Plan

None — plan executed exactly as written.

The only minor adjustment was test-harness mechanics: `src/stores/files.ts` imports `@/lib/stub-data`, which Node ESM cannot resolve without the project's existing `src/tests/_alias-loader.mjs` hook. The test file declares the loader in its run-command header (same pattern as `src/tests/watch-folder.test.ts`). No new files created beyond what the plan specified.

## Carry-Forward for Wave 2 UI Plans

- **Plan 05 (Toolbar `Clear all`):** `import { clearFiles, $queueEmpty } from '@/stores'`. Wrap the call site with the T-13-03 mitigation — read `runtimeAtom.runningJobs` and emit the sonner warning toast when `> 0` before invoking `clearFiles()`. Use `$queueEmpty` for the disable triple (button.disabled + aria-disabled + tooltip).
- **Plan 06 (FilesPane × icon):** same pair; same toast-wrapper contract.
- **Plan 07 (validation):** verifies the full disable-then-explain triple end-to-end.

## Commits

- `9a5e641` test(13-04): add failing unit for clearFiles() + $queueEmpty
- `94ed6c9` feat(13-04): clearFiles() action + $queueEmpty computed atom

## Self-Check: PASSED

- src/stores/files.ts exports clearFiles + $queueEmpty: FOUND
- src/tests/clearfiles.test.ts: FOUND
- Commit 9a5e641 in git log: FOUND
- Commit 94ed6c9 in git log: FOUND
