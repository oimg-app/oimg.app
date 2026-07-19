---
phase: 11
plan: 01
subsystem: streaming-batch
tags: [phase-11, wave-1, streaming, useOptimize, OPT-02, D-03, D-11]
requires:
  - Phase 11 Plan 00 (deps, fixtures, window bridge)
  - Phase 10 WR-01 setFileResult status:'done' transition (already on main)
provides:
  - Per-promise streaming write-back in runOptimize (D-03)
  - D-11 already-`done` skip filter
  - setFileProcessing(id) action in src/stores/files.ts
  - WorkerPool.run(job, onDispatch?) optional dispatch hook
  - src/tests/batch-progress.spec.ts — 3 green Playwright tests
affects:
  - src/hooks/useOptimize.ts (refactor)
  - src/stores/files.ts (new setFileProcessing action)
  - src/lib/worker-pool.ts (optional onDispatch hook on .run)
  - src/tests/fixtures/ingest-helper.ts (fix dynamic-import path)
  - src/tests/backpressure.spec.ts (add resetAllToQueued helper)
tech-stack:
  added: []
  patterns:
    - per-promise-streaming-write-back
    - onDispatch-hook-for-bounded-pool-transition
    - absolute-vite-dev-import-path-in-page-evaluate
key-files:
  created:
    - src/tests/batch-progress.spec.ts
  modified:
    - src/hooks/useOptimize.ts
    - src/stores/files.ts
    - src/lib/worker-pool.ts
    - src/tests/fixtures/ingest-helper.ts
    - src/tests/backpressure.spec.ts
decisions:
  - "Added setFileProcessing(id) to src/stores/files.ts (Rule 2: D-03 requires a queued→processing transition; routing through WR-02 updateEntry funnel is the right invariant — no inline filesAtom.setKey from the hook)"
  - "Added optional onDispatch callback to WorkerPool.run instead of pre-flipping in useOptimize.map — pre-flipping made ALL entries 'processing' synchronously and defeated the 'queued + processing simultaneously' assertion (Test 1)"
  - "Used absolute /src/... paths with computed specifier + @vite-ignore in page.evaluate dynamic imports (MEMORY note: '/src/... page.evaluate imports are an accepted Vite pattern'); the relative form ../../stores/files.ts resolved to http://localhost:5174/stores/files.ts from page.url() and 404'd"
  - "Updated backpressure.spec.ts to flip fixtures to 'queued' before clicking Optimize all — D-11 now correctly skips the seeded 'done' state, exposing a latent bug in the original test"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-02"
  tasks: 2
  files_changed: 5
---

# Phase 11 Plan 01: Wave 1 — runOptimize Streaming Write-Back Summary

Replaces `Promise.allSettled` batch write-back with per-promise `.then(setFileResult)` callbacks so FileRow status dots flip `queued → processing → done` LIVE as workers return (D-03). Adds D-11 skip filter for already-`done` entries. Preserves the WorkerPool's bounded concurrency cap of `min(hwConc, 4)` by creating all N promises synchronously in a single `.map(...)` before any await.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Refactor runOptimize to per-promise streaming write-back + D-11 filter | `ff2631f` | src/hooks/useOptimize.ts, src/stores/files.ts |
| 2 | E2E batch-progress.spec + worker-pool onDispatch hook + path fixes | `ae9ab99` | src/tests/batch-progress.spec.ts, src/lib/worker-pool.ts, src/hooks/useOptimize.ts (re-touched for onDispatch wiring), src/tests/fixtures/ingest-helper.ts, src/tests/backpressure.spec.ts |

## What Was Built

- **`src/hooks/useOptimize.ts` (refactor):**
  - Removed `Promise.allSettled(...)` and the terminal write-back loop.
  - Added `if (entry.status === 'done') continue` at the top of the build loop (D-11).
  - Replaced terminal block with `pairs.map((id, name, job) => pool.run(job, () => setFileProcessing(id)).then(setFileResult, errHandler))`, then `await Promise.all(promises)`.
  - All N promises are created synchronously in a single `.map(...)` (Pitfall 1 mitigation — `await pool.run` inside the loop would serialize to concurrency = 1 and defeat `WorkerPool._drain()`).
  - Per-promise rejection is swallowed inside `.then(_, err)` → `Promise.all` never rejects, per-file failure never aborts the batch (D-13 / T-9-FB).

- **`src/stores/files.ts` (new action):** `setFileProcessing(id)` — flips status to `'processing'` through the WR-02 `updateEntry` funnel so it can't interleave with `setFileResult`/`setFileError` on the same id.

- **`src/lib/worker-pool.ts` (optional onDispatch hook):** `WorkerPool.run(job, onDispatch?)` now accepts an optional callback that fires inside `_drain` when the job actually leaves the queue and starts running on a worker — not when it's enqueued. This is critical: without it, `setFileProcessing(id)` ran for EVERY entry synchronously inside `.map(...)`, flipping all to `'processing'` at once and breaking the `queued + processing simultaneously` assertion.

- **`src/tests/batch-progress.spec.ts` (new, 3 tests):**
  - Test 1 (D-03): ingest 10, flip to queued, click Optimize all, then `page.waitForFunction` until BOTH `processing >= 1` AND `queued >= 1` simultaneously, then `done == 10`.
  - Test 2 (D-11): ingest 10 (status already `'done'` from helper), click Optimize all twice, assert NO row flips to `'processing'` and done count stays at 10.
  - Test 3 (D-03): mid-batch, assert `done >= 3 && (queued + processing) >= 1` — the rising-while-pending overlap that proves streaming.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Typecheck + build | `npm run build` | exit 0, `built in 2.63s` |
| No allSettled in useOptimize | `grep -c "Promise.allSettled" src/hooks/useOptimize.ts` | 0 |
| D-11 filter present | `grep "entry.status === 'done'" src/hooks/useOptimize.ts` | match |
| Per-promise streaming | `grep -F ".then(" src/hooks/useOptimize.ts \| grep setFileResult` | match |
| E2E spec | `npx playwright test src/tests/batch-progress.spec.ts --workers=1` | 3 passed / 0 failed |
| Regression: backpressure + worker-pipeline + batch-progress | `npx playwright test src/tests/backpressure.spec.ts src/tests/worker-pipeline.spec.ts src/tests/batch-progress.spec.ts --workers=1` | 9 passed / 0 failed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added setFileProcessing(id) action to src/stores/files.ts**
- **Found during:** Task 1 implementation
- **Issue:** Plan's behavior block requires "the corresponding file's status transitions to `'processing'` ... before the promise resolves" (D-03 visible queued→processing→done transition). The existing files.ts had `setFileResult` and `setFileError` but no `setFileProcessing` — and the plan's `files_modified` list only included `src/hooks/useOptimize.ts`.
- **Fix:** Added `setFileProcessing(id)` action that routes through the WR-02 `updateEntry` funnel. Imported and called from useOptimize. Required for D-03 to be observable.
- **Files modified:** `src/stores/files.ts`, `src/hooks/useOptimize.ts`
- **Commit:** `ff2631f`

**2. [Rule 3 - Blocking issue] Added optional onDispatch hook to WorkerPool.run**
- **Found during:** Task 2 — Test 1 timed out waiting for `processing >= 1 && queued >= 1` simultaneously
- **Issue:** Initial implementation called `setFileProcessing(id)` synchronously inside the `.map(...)` for every pair before any worker dispatch began. This flipped all 10 entries to `'processing'` before any was actually dispatched, so the `queued >= 1` half of the assertion never held. With 1×1 PNG fixtures encoding in microseconds, the natural pool-cap transition wasn't observable from Playwright either.
- **Fix:** Added optional `onDispatch?: () => void` parameter to `WorkerPool.run(job, onDispatch)` and called it inside `_drain` at the moment the job leaves the queue. useOptimize passes `() => setFileProcessing(id)` so the flip lands at actual dispatch time, matching the bounded-concurrency model the FileRow status dot is meant to surface.
- **Files modified:** `src/lib/worker-pool.ts`, `src/hooks/useOptimize.ts`
- **Commit:** `ae9ab99`

**3. [Rule 3 - Blocking issue] Fixed dynamic-import paths in ingest-helper.ts and batch-progress.spec.ts**
- **Found during:** Task 2 — first test run got `Failed to fetch dynamically imported module: http://localhost:5174/stores/files.ts`
- **Issue:** Inside `page.evaluate`, relative imports resolve from `page.url()` (the app root `/`), so `../../stores/files.ts` from the helper resolved browser-side to `http://localhost:5174/stores/files.ts` (missing `/src/` prefix) and 404'd. This was a pre-existing bug in `ingest-helper.ts` affecting every spec using it (incl. `backpressure.spec.ts`).
- **Fix:** Changed dynamic-import specifiers to absolute `/src/stores/files.ts` and `/src/lib/stub-data.ts` (per MEMORY note "`/src/...` page.evaluate imports are an accepted Vite pattern"). Used a computed `const url = '/src/...'` + `import(/* @vite-ignore */ url)` pattern so TypeScript's static resolution doesn't fail at build time (the dev-server URL contract isn't known to the bundler).
- **Files modified:** `src/tests/fixtures/ingest-helper.ts`, `src/tests/batch-progress.spec.ts`
- **Commit:** `ae9ab99`

**4. [Rule 3 - Blocking issue] Updated backpressure.spec.ts to flip to queued before Optimize all**
- **Found during:** Task 2 regression check
- **Issue:** `backpressure.spec.ts` was relying on `ingestFixtureFiles` leaving entries in `'done'` state and then clicking Optimize all to see the indicator turn on. D-11 now correctly skips already-done entries, so the indicator no longer flips on. This was a latent bug in the original test (old `Promise.allSettled` code happened to still dispatch the done files because there was no skip filter).
- **Fix:** Added `resetAllToQueued(page)` helper to `backpressure.spec.ts` and call it before each `Optimize all` click. Two tests adjusted; "is hidden on initial load" was unaffected (it doesn't click Optimize).
- **Files modified:** `src/tests/backpressure.spec.ts`
- **Commit:** `ae9ab99`

## Deferred Issues

17 pre-existing test failures on `main` (codec-encoders, ingest, inspector-tabs, per-file-settings, etc.) were present before this plan and remain unrelated to D-03/D-11. Verified by `git stash`-ing this plan's changes and observing the same 17 failures on the prior commit. These should be addressed by a separate sweep — they correspond to MEMORY's "baseline tsc is red with pre-existing debt" note. Not in scope.

## Carry-Forward Notes

- **Plan 02 (StatusBar aggregate counter):** D-03 wiring is live — the aggregate counter can now derive `done` count from `filesAtom.entries.filter(e => e.status === 'done').length` and it WILL update mid-batch (previously it would jump from 0 to N at the terminal frame). Use `computed` per RESEARCH §Pattern 4.
- **Plan 08 (SC-4 backpressure):** The `WorkerPool.run(job, onDispatch?)` extension is non-breaking — existing callers pass no second arg and get the original behavior. Plan 08's SC-4 spec asserting `peak ≤ min(navigator.hardwareConcurrency, 4)` is unaffected. The new spec also reads the test-only `window.__peakRunning` bridge added by Plan 00 (already present in `src/main.tsx`).
- **Plan 04 / 05 / 08 specs that use `ingestFixtureFiles`:** The helper now uses absolute `/src/...` import paths. Any new spec that adds direct `page.evaluate` dynamic imports should use the same pattern: `const url = '/src/lib/foo.ts'; await import(/* @vite-ignore */ url) as typeof import('../lib/foo')`. Relative `../foo.ts` from page.evaluate resolves from `page.url()` (app root), not the spec file's location.
- **D-11 contract for downstream tests:** Any future test that calls `ingestFixtureFiles` + `Optimize all` must first flip entries to `'queued'` (or use the new helper pattern). The fixture's default `status:'done'` was previously a convenience for status-dot snapshot tests; now it has real semantic meaning per D-11.

## Threat Flags

None — Phase 11 Plan 01 introduces no new trust boundaries. The optional `onDispatch` hook on WorkerPool is a pure-callback inside `_drain` (no new network surface, no new file access, no schema change). The threat model's T-11-BP1 (DoS via streaming refactor bypassing pool cap) is mitigated by all promises being created in a single `.map(...)` synchronously — Plan 08's SC-4 spec will assert peak ≤ 4 once shipped. T-11-RC (race between per-promise .then and dispatch) is accepted: nanostores `set()` is synchronous and the WR-02 funnel serializes writes per id.

## Self-Check: PASSED

- [x] `src/hooks/useOptimize.ts` does NOT contain `Promise.allSettled` (verified: 0 matches)
- [x] `src/hooks/useOptimize.ts` contains `entry.status === 'done'` (verified: 1 match)
- [x] `src/hooks/useOptimize.ts` contains `.then(` paired with `setFileResult` (verified)
- [x] `src/stores/files.ts` exports `setFileProcessing` (verified)
- [x] `src/lib/worker-pool.ts` `WorkerPool.run` accepts optional `onDispatch` (verified)
- [x] `src/tests/batch-progress.spec.ts` exists with three `test()` calls inside `test.describe('OPT-02 — Batch Progress')` (verified)
- [x] `npm run build` exits 0 (verified)
- [x] `npx playwright test src/tests/batch-progress.spec.ts --workers=1` returns 3 passed / 0 failed (verified)
- [x] Regression check: `backpressure.spec.ts` + `worker-pipeline.spec.ts` + `batch-progress.spec.ts` all pass (9 passed / 0 failed, verified)
- [x] Two commits on `main`: `ff2631f`, `ae9ab99`
