---
phase: 11
plan: 08
subsystem: backpressure-e2e
tags: [phase-11, wave-3, backpressure, SC-4, e2e, playwright]
requires:
  - Phase 11 Plan 00 (window.__peakRunning bridge + 20-file fixture batch)
  - Phase 11 Plan 01 (streaming write-back; preserves bounded pool cap)
provides:
  - SC-4 backpressure e2e assertion (peak runningJobs bounded by Math.min(hwConc, 4) AND >= 2 on >=20-file batch)
  - Regression guard for Pitfall 1 (streaming refactor accidentally serializing the pool to peak=1)
  - Regression guard for WorkerPool cap over-spawn on hwConc=2 CI runners (dynamic cap derivation, not hardcoded 4)
affects:
  - src/tests/backpressure.spec.ts (one new test appended to the SHELL-02 describe block)
tech-stack:
  added: []
  patterns:
    - dynamic-cap-derivation-via-page.evaluate
    - in-test-bridge-bootstrap-for-dev-server
    - NAV-02-latch-pattern-on-window-bridge
key-files:
  created: []
  modified:
    - src/tests/backpressure.spec.ts
decisions:
  - "Used dynamic cap via `page.evaluate(() => Math.min(navigator.hardwareConcurrency || 4, 4))` (literal substring enforced by plan-checker grep); a hardcoded `<= 4` would mask hwConc=2 over-spawn regressions"
  - "Lower bound `peak >= 2` is non-negotiable — it proves the pool actually parallelized; a passing test with peak=1 would be a false-positive masking the Pitfall 1 streaming-refactor serialization regression"
  - "Bootstrapped the runtimeAtom→window subscription in-test via page.evaluate + /src/... dynamic import [Rule 3 - blocking fix] because Plan 00's main.tsx bridge is gated by MODE === 'test' but Playwright's webServer runs Vite dev (MODE === 'development') so the gated branch never fired"
  - "Did NOT modify Plan 00's main.tsx gate — the in-test bootstrap preserves the production tree-shake guarantee (CLAUDE.md zero-telemetry constraint)"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-02"
  tasks: 1
  files_changed: 1
---

# Phase 11 Plan 08: Wave 3 — SC-4 Backpressure e2e Summary

Adds the Phase 11 SC-4 success-criterion assertion to `src/tests/backpressure.spec.ts`: during a ≥20-file batch, peak `runningJobs` is bounded by the dynamic cap `Math.min(navigator.hardwareConcurrency || 4, 4)` AND is ≥ 2 (proves actual parallelism). Closes Phase 11 Wave 3 and locks in the regression guard against the most likely Plan 01 streaming-refactor failure mode (Pitfall 1: serialization via misplaced `await`).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add SC-4 ≥20-file backpressure assertion to backpressure.spec.ts | `24e7804` | src/tests/backpressure.spec.ts |

## What Was Built

One new Playwright test inside the existing `test.describe('BackpressureIndicator — SHELL-02', ...)` block:

```
test('SC-4: WorkerPool concurrency stays at cap during ≥20-file batch', async ({ page }) => { ... })
```

The test:
1. Seeds `window.__peakRunning = 0` via `page.addInitScript` before navigation.
2. Loads `/` and bootstraps a `runtimeAtom.subscribe(...)` in-page (mirrors what main.tsx's gated bridge would do in a test-mode build).
3. Ingests 20 fixtures via `ingestFixtureFiles(page, 20)`.
4. Flips all entries from `'done'` → `'queued'` via `resetAllToQueued` (D-11 already-done skip filter would otherwise no-op the batch).
5. Clicks "Optimize all".
6. Latches on `peak >= 2` via `page.waitForFunction` (NAV-02 pattern) — proves the pool actually parallelized.
7. Waits for all 20 entries to reach `[aria-label="Status: done"]`.
8. Computes the cap in-page: `const cap = await page.evaluate(() => Math.min(navigator.hardwareConcurrency || 4, 4))`.
9. Asserts `expect(peak).toBeGreaterThanOrEqual(2)` AND `expect(peak).toBeLessThanOrEqual(cap)`.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| SC-4 spec exit code | `npx playwright test src/tests/backpressure.spec.ts -g "SC-4"` | `PASS (1) FAIL (0)`, 153.9s |
| Full backpressure spec | `npx playwright test src/tests/backpressure.spec.ts` | `PASS (4) FAIL (0)`, 153.9s — 3 existing + 1 new |
| Literal substring guard | `grep -cF "Math.min(navigator.hardwareConcurrency \|\| 4, 4)" src/tests/backpressure.spec.ts` | 3 occurrences (test name comment, doc comment, evaluator) |
| `SC-4` marker | `grep -c "SC-4" src/tests/backpressure.spec.ts` | 3 occurrences |
| `20-file batch` marker | `grep -c "20-file batch" src/tests/backpressure.spec.ts` | 2 occurrences (heading + test name) |
| Typecheck (own file) | `tsc -b` filtered to `backpressure.spec` | 0 new errors (pre-existing project debt unchanged) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking fix] Plan 00 bridge gate excludes the Playwright dev server**

- **Found during:** First execution of the SC-4 test — `page.waitForFunction(() => typeof window.__peakRunning === 'number')` timed out at 10s.
- **Issue:** Plan 00's main.tsx bridge is gated by `import.meta.env.MODE === 'test'`. Playwright's `webServer.command` is `npm run dev`, which puts Vite in `MODE === 'development'`, so the bridge branch never fires and `window.__peakRunning` is forever `undefined`. This was not caught by Plan 00 because no earlier plan actually CONSUMES the bridge — Plan 08 is the first.
- **Fix:** Bootstrapped the same `runtimeAtom.subscribe(...)` logic inside the test via `page.addInitScript` (seed `__peakRunning = 0`) + a post-`page.goto` `page.evaluate` that dynamically imports `/src/stores/runtime.ts` and subscribes. This mirrors the main.tsx bridge contract identically.
- **Rationale for not modifying main.tsx:** Changing the gate (e.g. `MODE === 'test' || DEV`) would re-introduce the bridge into the prod-adjacent dev bundle. The clean fix lives entirely in the test file — Plan 00's zero-telemetry tree-shake assertion stays intact.
- **Files modified:** `src/tests/backpressure.spec.ts` (bootstrap block added inside the test).
- **Commit:** `24e7804`.

## Carry-Forward Notes

- Future Phase 11 e2e specs that need `window.__peakRunning` should reuse the same in-test bootstrap pattern. Consider extracting `bootstrapRuntimeBridge(page)` into `src/tests/setup/` if a second consumer appears — for now, inline is fine (single use site).
- If the bridge is later promoted to fire in dev mode (Phase 12+ or post-launch), this in-test bootstrap becomes harmless dead code (the subscribe is idempotent — both subscriptions update the same window keys).

## Threat Flags

None — the in-test bootstrap is confined to the test file; the production bundle is unaffected and Plan 00's `grep -c '__peakRunning' dist/assets/*.js` zero-hit guarantee still holds.

## Self-Check: PASSED

- [x] `src/tests/backpressure.spec.ts` contains a new test whose name contains `SC-4` AND `20-file batch` — verified via grep
- [x] `npx playwright test src/tests/backpressure.spec.ts` exits 0 — `PASS (4) FAIL (0)`
- [x] File contains the exact literal substring `Math.min(navigator.hardwareConcurrency || 4, 4)` — 3 occurrences
- [x] Test asserts `peak >= 2` (lower bound) AND `peak <= cap` where `cap` is derived in-page — verified by reading the test body
- [x] Test does NOT assert against a hardcoded literal `4` in `toBeLessThanOrEqual` — only `cap` is used
- [x] Commit `24e7804` exists on `main` — verified via `git rev-parse --short HEAD`
