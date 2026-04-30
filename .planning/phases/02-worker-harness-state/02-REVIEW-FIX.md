---
phase: 02-worker-harness-state
fixed_at: 2026-04-30T00:00:00Z
review_path: .planning/phases/02-worker-harness-state/02-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-04-30
**Source review:** `.planning/phases/02-worker-harness-state/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (4 critical + 8 warning)
- Fixed: 12
- Skipped: 0

**Test gate:** All 17 Phase 2 Playwright tests pass post-fix (`npx playwright test`).

**Worktree note:** Fixes were applied in an isolated worktree
(`/tmp/sv-02-reviewfix-qKLmQA`) on a temporary branch (`review-fix-02-tmp`)
because the main worktree already had the `main` branch checked out. The
foreground session advanced `main` past the review SHA during the fix
session (added `ec718f6 feat: add shadcn components`), so the seven fix
commits were rebased onto the new HEAD before being fast-forward merged
into `main`. Final tree state: `main` advanced from `ec718f6` to `7b8f088`
with seven new fix commits stacked on top, all green against the existing
test suite.

## Fixed Issues

### CR-01: WorkerPool.cancel() leaks inFlight callbacks against new slot generation

**Files modified:** `src/workers/pool.ts`
**Commit:** `710d0ed`
**Applied fix:** Added a monotonic `generation` counter on the pool. `cancel()`
and `terminate()` bump the counter; `runOnSlot` captures the value at dispatch
time and short-circuits its `finally` block if the captured generation no
longer matches `this.generation`. Stale slot indexes can no longer corrupt the
new pool's `idle[]` / `inFlight` map after a cancel-then-respawn cycle.

### CR-02: inFlight callbacks fire onError for already-resolved jobs

**Files modified:** `src/workers/pool.ts`
**Commit:** `710d0ed`
**Applied fix:** Added an explicit `settled: boolean` field to `PendingJob`.
`runOnSlot` sets `settled=true` immediately before invoking
`job.resolve()`/`job.reject()` and the matching callback. `cancel()` now skips
the onError fan-out for jobs whose `settled` flag is already true, so a
successful proxy result that lands in the same microtask flush as the abort
signal cannot double-emit (which would have flipped runtime.markDone +
runtime.markError for the same jobId, producing
`doneCount + errorCount > totalJobs` and a misleading "Batch complete" toast).

### CR-03: markStarted required queue membership; pool dispatch ordering became load-bearing

**Files modified:** `src/stores/runtime.ts`
**Commit:** `9a9c26a`
**Applied fix:** Replaced the `if (!s.queue.includes(jobId)) return {}` guard
with idempotent add-to-`inFlight` semantics. The pool is now the single
authority for "this job is dispatched" — `markStarted` populates `inFlight`
regardless of queue membership and only no-ops when `inFlight.has(jobId)` is
already true. Removes the silent-failure mode where a future caller reordering
`enqueue()` before `startBatch()` would freeze `running=true` forever.

### CR-04: App.startOptimize swallowed adapter errors and double-wrote on cancel

**Files modified:** `src/App.tsx`
**Commit:** `b04bd6c`
**Applied fix:** Two-part change to `pool.enqueue(job).then().catch()`:
1. The `.then` handler re-checks `useRuntimeStore.getState().inFlight.has(fileId)`
   before calling `useFilesStore.markDone` — a racing `cancel()` that cleared
   `inFlight` between dispatch and resolution will short-circuit, preventing a
   cancelled file from being written as `'done'`.
2. The `.catch` handler now discriminates `DOMException AbortError` (silent
   exit — runtime store already received `markError`) from real adapter
   failures, which call `useFilesStore.setStatus(fileId, 'error')` and log to
   `console.error` instead of being swallowed.

**Note:** This finding involves logic / state-handling that requires human
verification to confirm the cancel-vs-error discrimination behaves correctly
in all real-world race orderings — the existing Playwright tests cover the
common cases (VR-03 cancel correctness, VR-01 stub round-trip) but cannot
exhaustively exercise every microtask interleaving.

### WR-01: ReportPanel divides by zero on empty queue

**Files modified:** `src/components/panels/ReportPanel.tsx`
**Commit:** `76d6035`
**Applied fix:** Aggregate `pct` now reads `total === 0 ? 0 : (saved / total) * 100`;
per-file `localPct` reads `f.orig === 0 ? 0 : ((f.orig - f.opt) / f.orig) * 100`.
Empty file lists and zero-byte placeholders no longer render `"NaN%"`.

### WR-02: SHELL_FILES dereferences filesById[id] without guarding

**Files modified:** `src/App.tsx`
**Commit:** `b04bd6c`
**Applied fix:** Replaced `.map` with `.flatMap` and an `if (!entry) return []`
guard. A `removeFile()` racing between the `filesOrder` and `filesById`
selector reads now drops the stale id rather than crashing on
`entry.status` access.

### WR-03: Quartile boundary fires per-file announcements at small batch sizes

**Files modified:** `src/lib/live-region.ts`
**Commit:** `34db3ca`
**Applied fix:** Early-return `false` when `totalJobs < 4`. Below the
quartile floor we announce only start + final (no interior strides),
preventing the screen-reader flooding flagged in Pitfall 5. The 12-file
VR-05 contract is preserved (stride 3 → boundaries still fire at 3/6/9).

### WR-04: OutputPanel.copy swallows clipboard errors silently

**Files modified:** `src/components/panels/OutputPanel.tsx`
**Commit:** `7b8f088`
**Applied fix:** `copy()` is now async/await. Missing clipboard API surfaces
a sonner `toast.error('Clipboard unavailable')`; rejected writes surface
`toast.error('Copy failed')`. The `copied` UI state only flips on a
successful `await navigator.clipboard.writeText(text)`, so the button can no
longer lie about a copy that did not happen.

### WR-05: Test affordances readable in `vite build --mode test`

**Files modified:** `src/App.tsx`
**Commit:** `b04bd6c`
**Applied fix:** Both the `__OIMG_STORES__` exposure and the
`__OIMG_SLOW_MS__` read are now gated strictly on `import.meta.env.DEV`,
removing the `|| import.meta.env.MODE === 'test'` fallback. Playwright
runs against `vite dev` (DEV=true) so test coverage is unaffected; building
production with `--mode test` no longer ships the affordances.

### WR-06: cancelBatch toast misleadingly counts cancelled jobs as errors

**Files modified:** `src/stores/runtime.ts`
**Commit:** `06e2029`
**Applied fix:** `markError` now inspects the `message` parameter for
AbortError signatures (`'Batch cancelled'`, `'Batch canceled'`,
`message.includes('AbortError')`). Cancel-induced AbortError fan-out clears
the in-flight set without bumping `errorCount`, so the App-level "Batch
complete" subscriber's `finished` predicate (`done + error === total`)
no longer triggers the misleading partial-success toast on user cancel.

### WR-07: WorkerPool.terminate() does not clear stale abortController

**Files modified:** `src/workers/pool.ts`
**Commit:** `710d0ed`
**Applied fix:** `terminate()` now sets `this.abortController = null` and
bumps `this.generation`. Future code that reads
`this.abortController?.signal.aborted` after a teardown cycle won't observe
a stale aborted signal from the previous lifecycle.

### WR-08: useFilesStore.markDone overwrites a prior 'error' state silently

**Files modified:** `src/App.tsx`
**Commit:** `b04bd6c`
**Applied fix:** Tied to CR-04. `App.startOptimize`'s `.catch` handler now
calls `useFilesStore.setStatus(fileId, 'error')` on real adapter failures,
so a re-optimize that fails after a previous successful run flips the
files-store status from `'done'` back to `'error'` instead of leaving the
stale success state visible in the UI.

---

_Fixed: 2026-04-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
