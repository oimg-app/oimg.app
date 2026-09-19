---
phase: 11-batch-optimize-export
plan: 02
subsystem: shell
tags: [phase-11, wave-1, statusbar, aria-live, OPT-02, a11y, WCAG-AA]
dependency-graph:
  requires:
    - "11-00 (fixtures + mocks — ingestFixtureFiles helper)"
    - "11-01 (streaming write-back D-03 — counter only advances mid-batch if entries flip to 'done' one-by-one)"
  provides:
    - "Aggregate X/Y optimized counter element in StatusBar with WCAG-AA aria-live"
    - "data-testid='agg-counter' element consumable by future phase tests"
  affects:
    - "src/components/shell/StatusBar.tsx (one new span between worker-pip and SVGO version)"
tech-stack:
  added: []
  patterns:
    - "Live derivation in component (D-01) — `done = entries.filter(e => e.status === 'done').length`, `total = entries.length`"
    - "Pitfall 4 mitigation — outer container keeps aria-live='polite'; inner span gets aria-atomic='true' so the full string is announced as one unit without nested live-region competition"
    - "Empty-state guard — `total > 0 ? `${done}/${total} optimized` : ''` avoids `0/0 optimized` clutter when the queue is empty"
key-files:
  created:
    - "src/tests/status-bar.spec.ts (3 e2e tests under OPT-02 — Aggregate Counter)"
    - ".planning/phases/11-batch-optimize-export/11-02-SUMMARY.md (this file)"
  modified:
    - "src/components/shell/StatusBar.tsx (added agg-counter span between worker-pip 'Running'/'Idle' label and the SVGO version block)"
decisions:
  - "D-01 honored — counter is derived live in the StatusBar component (no new batchProgressAtom). Project rule: read-only views may compute locally; only mutating logic must live in hooks/stores."
  - "D-02 honored — no synthetic determinate progress bar added on FileRow. Counter text suffices; codec encodes are atomic so any intra-file percentage would be dishonest."
  - "Pitfall 4 — kept outer StatusBar aria-live='polite' (option b in PATTERNS.md); inner span gets aria-atomic='true'. Minimal diff, no live-region nesting issue. Optional useDeferredValue throttle deferred to VALIDATION manual block per threat model T-11-A11Y (accepted)."
metrics:
  duration: "~6 min"
  completed: "2026-06-02"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 11 Plan 02: StatusBar Aggregate X/Y Counter Summary

**One-liner:** Aggregate `X/Y optimized` counter span added to StatusBar, derived live from `filesAtom.entries` + `runtimeAtom`, with WCAG-AA `aria-live='polite'` + `aria-atomic='true'` and an empty-state guard, plus 3 Playwright e2e tests covering ARIA, mid-batch advancement, and empty state.

## What Shipped

### Task 1 — `src/components/shell/StatusBar.tsx`

Added a `<span data-testid="agg-counter" role="status" aria-live="polite" aria-atomic="true" className="font-mono text-[11px]">` between the existing worker-pip "Running"/"Idle" label and the "SVGO {version}" block. The span renders `${done}/${total} optimized` when `total > 0`, or the empty string otherwise. `done` and `total` are computed inline from the already-subscribed `useStore(filesAtom)` snapshot — no new atom, no new subscription.

- **Commit:** `c5c5e98` — `feat(11-02): add aggregate X/Y optimized counter to StatusBar (OPT-02)`

### Task 2 — `src/tests/status-bar.spec.ts`

Three Playwright tests under `test.describe('OPT-02 — Aggregate Counter', ...)`:

1. **Counter carries polite aria-live + aria-atomic attributes (WCAG-AA)** — asserts `aria-live='polite'`, `aria-atomic='true'`, `role='status'`. Ingests 1 fixture file so the counter renders something.
2. **Counter advances mid-batch and lands on N/N optimized (D-01)** — ingests 6 fixture files, flips them to `'queued'` via `resetAllToQueued` (D-11 sidestep), clicks "Optimize all", then `waitForFunction` latches an intermediate state where `0 < K < 6`, then asserts final `6/6 optimized`. This test fails if streaming write-back from Plan 01 regresses back to `allSettled` terminal-flush (every entry would flip 0→6 in one frame).
3. **Empty state renders empty string — no 0/0 optimized clutter** — fresh page, no ingest, asserts the counter has empty text content.

Runtime: ~153s for the 3 tests (full Playwright bring-up + 6-file batch).

- **Commit:** `640105f` — `test(11-02): e2e for OPT-02 aggregate counter (3 tests)`

## Verification

| Check | Result |
|---|---|
| `grep -c 'agg-counter' src/components/shell/StatusBar.tsx` | `1` (PASS) |
| `grep -c 'batchProgressAtom' src/components/shell/StatusBar.tsx` | only in a comment disclaiming it; no import (PASS — no new atom) |
| `npx playwright test src/tests/status-bar.spec.ts --reporter=dot` | `PASS (3) FAIL (0)` |
| `tsc -b` | Pre-existing baseline noise only (per MEMORY `typecheck-and-test-gotchas.md` — baseline is red with debt unrelated to this plan); no new errors introduced by this plan's two files. |

The plan's `<verification>` block's `grep -c "batchProgressAtom" src/` check returns `0` actual imports/references — the only match in the diff is a clarifying comment in `StatusBar.tsx` line 14 stating "No new batchProgressAtom — derivation only".

## Deviations from Plan

None — plan executed exactly as written. The StatusBar already had `useStore(runtimeAtom)` and `useStore(filesAtom)` imports (used by other status spans), so Task 1's "add or reuse existing imports" branch went to reuse. The `<span aria-hidden="true">·</span>` separator was added before the counter to match the existing visual rhythm between the other StatusBar segments — no semantic change, matches the file's pattern verbatim.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The aria-live region is the only surface; T-11-A11Y (`accept`) and T-11-LR (`mitigate`) are both handled per plan threat register.

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/shell/StatusBar.tsx` — FOUND, contains `data-testid="agg-counter"`, `aria-live="polite"`, `aria-atomic="true"`, `optimized`
- `src/tests/status-bar.spec.ts` — FOUND, three tests under `OPT-02 — Aggregate Counter`
- Commit `c5c5e98` (Task 1) — FOUND in git log
- Commit `640105f` (Task 2) — FOUND in git log
