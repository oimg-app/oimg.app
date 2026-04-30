---
phase: 02-worker-harness-state
plan: 03
subsystem: workers
tags: [phase-02, wave-1, workers, comlink, pool, stub-adapter]

# Dependency graph
requires:
  - phase: 02-worker-harness-state
    plan: 01
    provides: "Wave-0 failing-stub specs probing window.__OIMG_STORES__ ready to flip green"
  - phase: 02-worker-harness-state
    plan: 02
    provides: "useRuntimeStore with markStarted/markDone/markError/cancelBatch + POOL_SIZE; comlink ^4.4.2 installed"
provides:
  - "WorkerPool class — lazy spawn, FIFO dispatch, terminate-and-respawn cancel, AbortSignal racing"
  - "Comlink-exposed worker entry with static ADAPTERS map (T-02-03 mitigation)"
  - "Stub adapter satisfying D-04 contract via input.slice(0) round-trip"
  - "AdapterError class + AdapterFormat/AdapterRunResult/WorkerProxyApi/PoolJob types"
  - "getWorkerPool() module-level singleton (callable from non-React contexts)"
  - "PoolCallbacks (onStarted/onDone/onError) — pool decoupled from runtime store"
  - "__setWorkerPoolForTesting hook for unit-test injection"
affects: [02-04-ui-wiring, 02-05-cleanup, 03-svg-pipeline, 05-raster-encoders]

# Tech tracking
tech-stack:
  added: []  # comlink already installed in Plan 02-02
  patterns:
    - "Comlink.expose({runJob}) + Comlink.wrap on main side — one proxy per worker (Squoosh-style, no shared-proxy routing)"
    - "Comlink.transfer(input, [input]) on call + Comlink.transfer({output,meta},[output]) on return — zero-copy both directions"
    - "Static ADAPTERS map keyed by AdapterFormat union — Vite-compatible lazy import (Pitfall 1, T-02-03)"
    - "Promise.race([proxyCall, abortPromise]) for cancel correctness (Pitfall 4 / VR-03 readiness)"
    - "AbortController per spawn cycle — abort() trips signal, listeners reject pending promises"
    - "Lazy spawn on first enqueue (Open Question 1 recommendation) — no spawn cost at app boot"
    - "input.slice(0) in stub adapter — copy not reuse, avoids detach hazard on return transfer"
    - "Math.min(navigator.hardwareConcurrency || 2, 4) defensive default (Pitfall 6)"

key-files:
  created:
    - "src/workers/types.ts"
    - "src/workers/stub-adapter.ts"
    - "src/workers/worker.ts"
    - "src/workers/pool.ts"
  modified: []

key-decisions:
  - "Worker entry uses static ADAPTERS record keyed by the AdapterFormat literal union — Phase 3+ adapter slots throw explicit 'not yet implemented' errors so the type-check forces every union member to have a slot (T-02-03 + completeness)"
  - "PoolCallbacks injected via constructor (not imported from runtime store) — pool stays testable in isolation; runtime-store wiring deferred to Plan 02-04"
  - "Cancel performs synchronous teardown (terminate all + clear queue + reject pending) BEFORE respawn — avoids any window where new enqueue calls could land on stale slots"
  - "in-flight onError fires AFTER Promise.race already rejected — keeps the runtime-store cancel-race guard (T-02-01) effective: late markError arrivals are no-ops since cancelBatch already cleared inFlight"
  - "Module-level singleton via getWorkerPool() rather than passing pool through React context — pool is needed in non-component code (runtime-store actions per Plan 02-04)"

requirements-completed: []
# PERF-01 (worker pool) and PERF-02 (lazy adapter import) are now structurally satisfied
# but require Plan 02-04 UI wiring + VR-01..VR-03 green to formally close.

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 2 Plan 03: Worker Harness Summary

**WorkerPool + Comlink-exposed worker entry + stub adapter — the Wave 1 worker pipeline that flips VR-01/VR-02/VR-03 from `test.fail()` stubs to live assertions once Plan 02-04 wires the runtime store actions into the pool callbacks.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T16:01:46Z
- **Completed:** 2026-04-30T16:06:15Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

- 4 files in `src/workers/` (`types.ts`, `stub-adapter.ts`, `worker.ts`, `pool.ts`) compile cleanly under `tsc -b`
- Static-map adapter dispatch (T-02-03 mitigation) — no template-literal dynamic imports
- Pool size honors `Math.min(navigator.hardwareConcurrency || 2, 4)` (Pitfall 6 defensive default)
- FIFO dispatch with idle-worker re-pull (Pattern 2 — `tryDispatch` drains both on enqueue and on `runOnSlot.finally`)
- Cancel = `AbortController.abort()` + per-slot `worker.terminate()` + reject pending + respawn fresh (Pattern 3 + Pitfall 4)
- Per-job `Promise.race([proxyCall, abortPromise])` so cancel rejects in-flight (Pitfall 4 — Comlink wrapped promises don't otherwise settle on terminate)
- `Comlink.transfer(input, [input])` on dispatch + `Comlink.transfer({output, meta}, [output])` on return — zero-copy both directions
- D-11 streaming: `await job.blob.arrayBuffer()` called only inside `runOnSlot` (when worker is free), never preloaded
- D-12 detach hygiene: input is never read after the transfer call
- PoolCallbacks (`onStarted`/`onDone`/`onError`) injected via constructor — pool callable from non-React contexts (D-08)
- `getWorkerPool()` module-level singleton + `__setWorkerPoolForTesting` test hook
- `stats` getter exposes `{size, busy, queueDepth, idle}` ready for Toolbar Workers pill subscription
- Phase 1 ARIA regression: `npx playwright test src/tests/shell.spec.ts` reports 11/11 PASS
- `npm run build` exits 0; production bundle compiles cleanly (236.87 kB initial / 72.80 kB gzipped — well under PERF-04 200 KB initial-route budget)

## Task Commits

1. **Task 1: Worker types + stub adapter + worker entry** — `3efd7a4` (feat)
2. **Task 2: WorkerPool with FIFO + cancel correctness** — `452bf98` (feat)

## Files Created

- **`src/workers/types.ts`** (50 LOC) — `AdapterFormat` union, `AdapterMeta`, `AdapterRunResult`, `AdapterRun<TSettings>`, `WorkerProxyApi`, `PoolJob`, `AdapterError extends Error` (Phase 5 may subclass for retry-logic discrimination — Open Question 2 deferred).
- **`src/workers/stub-adapter.ts`** (17 LOC) — Phase 2 acceptance gate. `run(input, _settings)` returns `{ output: input.slice(0), meta: { unchanged: true } }`. Copy-not-reuse to avoid Pitfall 2 detach hazard.
- **`src/workers/worker.ts`** (54 LOC) — `Comlink.expose({ runJob })`. Static `ADAPTERS: Record<AdapterFormat, () => Promise<...>>` map. Phase 2 only resolves `'stub'`; Phase 3/5 slots throw explicit "not yet implemented" errors. Returns via `Comlink.transfer({output, meta}, [output])`.
- **`src/workers/pool.ts`** (198 LOC) — `WorkerPool` class. Lazy spawn (`spawnAll` runs on first `enqueue`). `Slot` records `{worker, proxy}`. FIFO `queue` + `idle: number[]` + `inFlight: Map<slot, job>`. `cancel()` aborts the controller, terminates all workers, rejects queued AND in-flight, respawns fresh. `runOnSlot` races the proxy call against the abort signal. Module exports `getWorkerPool` singleton helper and `__setWorkerPoolForTesting`.

## Decisions Made

- **AdapterFormat slots throw explicit errors instead of being optional** — Forces TypeScript to error if a future plan adds a format to the union without registering an entry. The throw is unreachable for `'stub'` (the only Phase 2 path) and informs the developer when they hit an unimplemented adapter via the worker's normal error channel.
- **PoolCallbacks injected via constructor** — Pool is testable in isolation (a unit test can pass a fake callbacks object). Plan 02-04 will instantiate via `getWorkerPool({ onStarted, onDone, onError })` where the callbacks call the runtime store's `markStarted`/`markDone`/`markError`.
- **Cancel rejects in-flight `onError` AFTER Promise.race already settled** — Belt-and-braces: the AbortSignal listener already rejects the race, but the explicit loop in `cancel()` ensures `onError` fires for every job that was in `inFlight` at cancel time, even if the race rejection is queued behind a microtask. The runtime store's T-02-01 cancel-race guard (`if (!s.inFlight.has(jobId)) return {}`) handles double-fire.
- **Lazy spawn over eager spawn** — Picked the recommended option from RESEARCH Open Question 1. App boot stays light; first Optimize click pays the spawn cost (<10ms × N for empty ES-module workers). Eager spawn would be a future tuning if profiling shows the first-click latency to be noticeable.
- **Singleton via getWorkerPool, not React context** — Per RESEARCH §Standard Stack alternatives: pool methods (`enqueue`, `cancel`, `terminate`) work fine called from outside React. A context provider would force a Provider wrapper around the App and force consumers through hooks for what is fundamentally a service singleton.

## Deviations from Plan

### Documented (acceptance-criteria gates that depend on Plan 02-04)

**1. [Note] Build chunk-emission gates depend on Plan 02-04 wiring**

- **Found during:** Task 2 verification (`npm run build`)
- **Plan acceptance criteria:** "`dist/assets/` contains a `worker-*.js` file" + "`dist/assets/` contains a separate stub-adapter chunk"
- **Actual outcome:** Build succeeded but emitted no `worker-*` or `stub-adapter` chunks — because nothing in the import graph (App.tsx / main.tsx) yet imports `src/workers/pool.ts`. Vite cannot trace the `new Worker(new URL('./worker.ts', import.meta.url))` reference unless `pool.ts` is itself reachable from an entry.
- **Why no fix in this plan:** Plan 02-03's `<files>` and frontmatter `files_modified` explicitly scope changes to `src/workers/*.ts`. PATTERNS.md §`src/main.tsx` (lines 497-510) directs that "NO edits to main.tsx required for Phase 2 unless planner needs to register a setLiveRegion … both are App.tsx concerns, not main.tsx." Adding a side-effect import in main.tsx purely to coax the chunk emission would violate the in-plan scope.
- **Resolution:** The chunks WILL emit once Plan 02-04 lands `getWorkerPool()` calls inside `useRuntimeStore` actions (or wherever 02-04 chooses to wire). The Wave 1 verification gate for chunk emission therefore moves to Plan 02-04 and gets coupled to VR-01 in shell.spec.ts.
- **Semantic intent satisfied:** `pool.ts`, `worker.ts`, and `stub-adapter.ts` all compile under `tsc -b`. The `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` idiom is the Vite canonical form (Pitfall 1 avoided). When 02-04 imports `pool`, Vite will trace the worker URL and split out the chunks automatically — no further Phase 2 code change required.
- **No commit:** documentation-only acknowledgement.

### Auto-fixed Issues

**None.** No bugs found, no missing critical functionality, no architectural changes needed.

## Issues Encountered

- **`grep -c 'getWorkerPool'` acceptance-criterion gate** is `>=2` but the implementation (matching the plan's verbatim source code on lines 482-494 of 02-03-PLAN.md) only contains 1 occurrence (the function declaration). The gate text appears to anticipate a body reference that the plan source itself does not include. Treated as a docs typo — the verify command in the plan does not include this gate, and the actual semantic check (export exists + works) passes. Flagged for future planner normalization.

## Threat Flags

None — Phase 2 worker boundaries (Main ↔ Worker) are the same trust boundaries already documented in the plan's threat register. No new network or auth surface. The two relevant threats:

- **T-02-01** (cancel race) — partially mitigated here: pool fires `onError` for all queued AND in-flight jobs at cancel time. Runtime store guard (Plan 02-02) handles late `markDone` arrivals. Full closure with Plan 02-04 + VR-03.
- **T-02-03** (XSS via dynamic worker import) — fully mitigated: ADAPTERS is a static literal-keyed record, no string concatenation, no user-controlled module path.
- **T-02-04** (DoS unbounded queue) — D-11 streaming honored: `await job.blob.arrayBuffer()` called inside `runOnSlot` only when a worker is free. Queued jobs hold a Blob reference but bytes are NOT loaded until dispatch.

## Known Stubs

None — the stub adapter is intentional (D-04 acceptance gate). All other adapter slots throw explicit "not yet implemented" errors that surface through the worker's normal error path — this is an explicit gate, not a silent stub.

## Next Plan Readiness

- **Plan 02-04 (UI wiring):** Has `getWorkerPool({ onStarted, onDone, onError })` ready to call from `useRuntimeStore` actions. Pass `markStarted`/`markDone`/`markError` directly as callbacks. The pool's `enqueue(job)` returns a Promise — `useRuntimeStore.startBatch` should await each one (or fire-and-forget and rely on callbacks). Once 02-04 imports `pool.ts`, Vite will emit `worker-*.js` and `stub-adapter-*.js` chunks (the deferred chunk-emission gate from this plan).
- **VR-01 (stub round-trip):** `worker-pool.spec.ts` test.fail() stub flips green when 02-04's "drag file → Optimize" flow exists. Pool delivers `{output: input.slice(0), meta: {unchanged: true}}` end-to-end.
- **VR-02 (concurrency cap):** `pool.stats.busy <= POOL_SIZE` continuously enforced — assertion against `useRuntimeStore.getState().inFlight.size <= POOL_SIZE` is equivalent (both reflect the same dispatch state). 02-04 wires the test trigger.
- **VR-03 (cancel correctness):** AbortController + Promise.race + sync teardown in `cancel()` makes `running===false` and `inFlight.size===0` deterministic within a microtask of `cancelBatch`. 02-04 wires Cmd+. → `useRuntimeStore.cancelBatch()` → `getWorkerPool().cancel()`.
- **Phase 3 (svg adapter):** Add `svg-adapter.ts` next to `stub-adapter.ts`. Replace the throw in worker.ts ADAPTERS map with `svg: () => import('./svg-adapter')`. No pool changes needed — D-04 contract is uniform.
- **Phase 5 (raster encoders):** Same pattern; lazy-import per format keeps PERF-02 honored. AVIF's 8 MB tarball stays out of initial bundle until first AVIF format selection.

## Self-Check: PASSED

Verification commands run, all GREEN:

- `test -f src/workers/types.ts` → FOUND
- `test -f src/workers/stub-adapter.ts` → FOUND
- `test -f src/workers/worker.ts` → FOUND
- `test -f src/workers/pool.ts` → FOUND
- `git log --oneline | grep 3efd7a4` → FOUND (Task 1 commit)
- `git log --oneline | grep 452bf98` → FOUND (Task 2 commit)
- `./node_modules/.bin/tsc -b` exits 0
- `npm run build` exits 0 (236.87 kB / 72.80 kB gzipped main bundle)
- `npx playwright test src/tests/shell.spec.ts` → 11/11 PASS (Phase 1 regression)
- `awk '/Comlink\.expose/{c++} END{print c}' src/workers/worker.ts` → 1
- `awk '/input\.slice\(0\)/{c++} END{print c}' src/workers/stub-adapter.ts` → 1
- `awk "/stub: \\(\\) => import\\('\\.\\/stub-adapter'\\)/{c++} END{print c}" src/workers/worker.ts` → 1
- Template-literal dynamic-import scan: NO matches (T-02-03 mitigated)
- `awk '/AdapterError/{c++} END{print c}' src/workers/types.ts` → 3
- `awk "/new Worker\\(new URL\\('\\.\\/worker\\.ts', import\\.meta\\.url\\)/{c++} END{print c}" src/workers/pool.ts` → 1
- `awk "/type: 'module'/{c++} END{print c}" src/workers/pool.ts` → 2
- `awk '/Math\.min\(hw, POOL_SIZE_MAX\)/{c++} END{print c}' src/workers/pool.ts` → 1
- `awk '/navigator\.hardwareConcurrency \|\| 2/{c++} END{print c}' src/workers/pool.ts` → 1
- `awk '/Comlink\.transfer\(input, \[input\]\)/{c++} END{print c}' src/workers/pool.ts` → 1
- `awk '/Promise\.race/{c++} END{print c}' src/workers/pool.ts` → 3 (1 race expression + 2 type/comment refs)
- `awk '/AbortController/{c++} END{print c}' src/workers/pool.ts` → 2
- `awk '/await job\.blob\.arrayBuffer\(\)/{c++} END{print c}' src/workers/pool.ts` → 1

**Note:** chunk-emission acceptance gate (separate `worker-*.js` / `stub-adapter-*` files in `dist/assets/`) is documented above as deferred to Plan 02-04 — pool.ts is not yet imported by the main entry tree, so Vite has nothing to trace. This is a plan-scoping consequence, not an implementation defect.

---
*Phase: 02-worker-harness-state*
*Completed: 2026-04-30*
