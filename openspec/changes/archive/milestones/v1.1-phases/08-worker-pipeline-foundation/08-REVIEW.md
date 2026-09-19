---
phase: 08-worker-pipeline-foundation
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/workers/codec.worker.ts
  - src/lib/worker-pool.ts
  - src/stores/runtime.ts
  - src/hooks/useOptimize.ts
  - src/components/shell/Toolbar/Toolbar.tsx
  - src/components/panels/inspector/ReportPanel.tsx
  - src/vite-env.d.ts
  - src/tests/worker-pipeline.spec.ts
  - src/tests/backpressure.spec.ts
  - src/tests/stores.test.ts
  - src/tests/navigation.spec.ts
findings:
  critical: 1
  blocker: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 8 wires a Comlink codec worker, a hand-rolled bounded `WorkerPool`, runtime
job-count state, and a `useOptimize` hook dispatched from the Toolbar. Codec validation,
the dynamic-import discipline (AVIF stays lazy), the malformed-buffer try/catch, and the
HMR dispose hook are all correctly implemented — no eval/Function, no network/telemetry,
privacy intact.

The serious problem is a **behavioral regression in the Toolbar → runtime wiring**: the
"Optimize all" button used to call `startRun()` synchronously (setting `running = true`);
this phase replaced that handler with `runOptimize`, which never calls `startRun` and only
flips `running` *asynchronously* via a dynamic-import + `setJobCounts` round-trip that can
race back to zero before the UI observes it. This breaks the documented
BackpressureIndicator / worker-pip contract that `backpressure.spec.ts` (PIPE-04) and
`navigation.spec.ts` assert against. Secondary issues: no Comlink transfer (buffers are
structured-cloned both ways), a read-modify-write race in `setJobCounts` that can drop a
concurrent toast, and the PNG path feeding a 0-byte buffer into the real WASM decoder.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `setJobCounts` read-modify-write clobbers concurrent toast/state updates

**File:** `src/stores/runtime.ts:55-62`
**Issue:** `setJobCounts` reads the whole atom, spreads it, then writes the whole object
back via `runtimeAtom.set(...)`. The pool fires `onCountChange` through an async dynamic
import (`worker-pool.ts:71`), so the read in `setJobCounts` is a *stale snapshot* by the time
the write lands. Any state mutated between the `.get()` snapshot and the `.set()` — most
realistically a `pushToast` from a failing job, or a back-to-back `setJobCounts` from another
worker releasing — is silently overwritten. `pushToast`/`dismissToast` use atomic `setKey`,
but a full-object `set` built from a stale read does not compose with them. With up to 4
workers each calling `onCountChange` on release/drain, two near-simultaneous count updates
can also stomp each other (last writer wins on a stale base), leaving `runningJobs`/`queuedJobs`
inconsistent with the pool's actual `_active`/`queue.length`.
**Fix:** Mutate only the three keys, never rebuild the whole object from a snapshot:
```ts
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.setKey('runningJobs', running)
  runtimeAtom.setKey('queuedJobs', queued)
  runtimeAtom.setKey('running', running > 0 || queued > 0)
}
```
`setKey` reads-and-writes a single field atomically against the live store, so a concurrent
`pushToast` can no longer be lost.

## Warnings

### BL-01: "Optimize all" no longer sets `running` synchronously — indicator/pip contract broken

**File:** `src/components/shell/Toolbar/Toolbar.tsx:73` (and `src/hooks/useOptimize.ts:29-48`)
**Issue:** Pre-phase, the button was `onClick={startRun}` — `running` flipped to `true`
synchronously on click. This phase changed it to `onClick={runOptimize}`, and `runOptimize`
**never calls `startRun`**. The only path that sets `running` now is:
`pool.run()` → `onCountChange()` → `import('@/stores/runtime').then(setJobCounts)`. That is a
dynamic import + microtask round-trip, after which the PNG job hits the real WASM decoder
(which rejects on the 0-byte buffer, see WR-02) and the WebP/JPEG/AVIF/SVG stubs reject
immediately, draining counts back to `0`. Result: `running` may never be observably `true`,
or flickers true→false within a few microtasks. This directly breaks the contract asserted by
`backpressure.spec.ts:27-38` (PIPE-04: indicator must carry `animate-pulse`) and
`navigation.spec.ts:19-24` ("flips worker pip to Running"). The phase context says the boolean
`running` contract must not be broken — it is broken here at the producer side.
**Fix:** Call `startRun()` synchronously on dispatch and `stopRun()` when the batch settles,
so the indicator is correct independent of the async count plumbing:
```ts
async function runOptimize(): Promise<void> {
  const pool = getPool()
  const jobs = entries.flatMap(/* ... */)
  startRun()
  try {
    await Promise.allSettled(jobs.map((job) => pool.run(job)))
  } finally {
    stopRun()
  }
}
```
(Keep `setJobCounts` for the fine-grained count, but do not rely on it for the boolean edge.)

### WR-02: PNG path feeds a 0-byte ArrayBuffer into the real WASM decoder

**File:** `src/hooks/useOptimize.ts:39` → `src/workers/codec.worker.ts:35-38`
**Issue:** `runOptimize` dispatches `buffer: new ArrayBuffer(0)` for every entry. For PNG
entries (4 in `STUB_FILES`) this is a *real* code path: it dynamically loads `@jsquash/png` +
`@jsquash/oxipng` WASM (~450KB+) and calls `decode(emptyBuffer)`, which throws `Encoding error.`
(`node_modules/@jsquash/png/decode.js:31`). The try/catch contains it, but every "Optimize all"
click in Phase 8 needlessly downloads and instantiates the PNG/OxiPNG WASM only to fail. This is
a correctness smell that will mask real decode failures in Phase 9 and inflates the supposedly
"lazy" bundle on a no-op action.
**Fix:** Until Phase 9 wires real buffers, gate dispatch behind a real-buffer guard or skip the
WASM-loading branch when `buffer.byteLength === 0`. Add to the worker:
```ts
if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
```
placed *before* the dynamic `import()` so the codec WASM is never fetched for an empty stub job.

### WR-03: ArrayBuffers are structured-cloned in and out — no Comlink transfer

**File:** `src/lib/worker-pool.ts:49` and `src/workers/codec.worker.ts:39-43,59`
**Issue:** Neither `pool.run` (sending `job.buffer`) nor the worker's return (`buffer: result`)
uses `Comlink.transfer(...)`. Comlink defaults to structured clone, so each job copies the input
buffer into the worker and copies the result buffer back. For the 0-byte stub this is invisible,
but the phase is explicitly the "foundation" the Phase 9 real-buffer pipeline builds on — shipping
the contract without transfer bakes in a double-copy of every image (potential 2× memory and a
main-thread copy stall on large files). The phase guidance calls out "Comlink transfer
correctness" as in-scope.
**Fix:** Transfer the input on send and the result on return:
```ts
// pool.run
worker.optimize(Comlink.transfer(pending.job, [pending.job.buffer]))
// worker optimize return
return Comlink.transfer({ buffer: result, originalSize, optimizedSize }, [result])
```
Note transferring neuters `job.buffer` on the sender — fine here since the pool owns it, but
document it so callers don't reuse the buffer after dispatch.

### WR-04: `runOptimize` is wired as a raw DOM click handler and swallows all rejections

**File:** `src/components/shell/Toolbar/Toolbar.tsx:73`, `src/hooks/useOptimize.ts:29-48`
**Issue:** `onClick={runOptimize}` passes the `MouseEvent` as `runOptimize`'s first arg (ignored,
so harmless today, but fragile if a param is ever added). More importantly, `runOptimize` is
`async` and its returned promise is unhandled by `onClick`; combined with `Promise.allSettled`,
**every** job failure — including unexpected ones, not just the intended NotImplemented stubs —
is silently discarded with zero user feedback. A user clicking "Optimize all" on a batch that
all-fail sees nothing happen.
**Fix:** Wrap the handler (`onClick={() => { void runOptimize() }}`) and surface aggregate
failures: inspect the `allSettled` results and `pushToast` a summary when N jobs rejected, rather
than discarding every rejection.

### WR-05: Worker `init()` ordering / MT init never invoked for OxiPNG

**File:** `src/workers/codec.worker.ts:35-38`
**Issue:** The PNG branch imports `{ optimise }` from `@jsquash/oxipng` and calls it directly
without ever calling the package's `init()` / MT `init`. The `crossOriginIsolated` dev-warning at
line 5 implies MT is intended, but nothing in the path selects the MT build or initializes the
thread pool, so OxiPNG silently runs single-threaded regardless of isolation. The warning is
therefore misleading (it fires for a capability the code never uses). Also, `decode`/`optimise`
default-init lazily on first call, which serializes WASM instantiation under the pool's
concurrency — acceptable, but undocumented.
**Fix:** Either remove the COOP/COEP MT warning (since MT is not wired this phase) or explicitly
call the MT `init()` when `crossOriginIsolated` is true. Document that ST is the Phase 8 baseline
so the warning does not imply a feature that is absent.

### WR-06: Worker spawned eagerly for all 4 pool slots regardless of workload

**File:** `src/lib/worker-pool.ts:26-32`, `getPool()` 66-75
**Issue:** `getPool()` (called the moment `useOptimize` runs `runOptimize`) constructs the pool,
which immediately spawns `min(hardwareConcurrency, 4)` workers in the constructor loop — each
loading the worker module — even if only one PNG file is queued. There is no upper-bound tie to
the actual job count and no teardown path outside HMR; in a long-lived tab the workers persist
idle for the session. Not a leak per se (singleton), but workers are created before any job is
known to need them.
**Fix:** Lazily spawn workers in `_drain` up to the cap as jobs arrive, or accept the eager
spawn and document it. At minimum add a `terminate()`/dispose that calls `w.terminate()` on each
underlying `Worker` (currently the wrapped `Comlink.Remote` is kept but the raw `Worker` handle is
discarded at line 28-29, so workers can never be terminated even if you wanted to).

## Info

### IN-01: Redundant try/catch that re-wraps an already-rejecting async function

**File:** `src/workers/codec.worker.ts:30-56`
**Issue:** Inside an `async function`, a thrown error already produces a rejected promise. The
`try { ... } catch (err) { return Promise.reject(err) }` wrapper changes nothing about behavior —
the comment claims it prevents "crash the worker," but an unhandled throw in an exposed Comlink
method rejects the call promise either way; it does not crash the worker process. The wrapper is
dead ceremony.
**Fix:** Remove the try/catch; rely on natural async rejection. If the intent is to guard truly
synchronous top-level throws, that already cannot happen here.

### IN-02: Raw `Worker` handle discarded, making termination impossible

**File:** `src/lib/worker-pool.ts:28-31`
**Issue:** `const w = new Worker(...)` is wrapped by Comlink and only the proxy is stored; `w` goes
out of scope. There is no way to `w.terminate()` later (relevant to WR-06's dispose path). The HMR
dispose at line 79 only nulls `_instance` — the underlying `Worker` threads are orphaned, not
terminated, on hot reload, leaking a worker per HMR cycle in dev.
**Fix:** Store the raw `Worker` objects alongside proxies and terminate them in a `dispose()` that
`import.meta.hot.dispose` calls: `_instance?.dispose()` then `_instance = null`.

### IN-03: `codecVersion` / `wasmInfo` are hardcoded placeholder strings

**File:** `src/stores/runtime.ts:26-27`
**Issue:** `codecVersion: '0.6.0'` and `wasmInfo: 'WASM ready · 312 KB'` are magic literals shown
in the StatusBar as if real. They will drift from the actual jSquash versions/bundle size and
mislead users. (Out of strict Phase 8 scope but surfaced via StatusBar which reads these.)
**Fix:** Derive from package metadata or mark clearly as placeholder until Phase 9 reports real
codec info.

### IN-04: Magic number `48` / `4` and color thresholds duplicated in ReportPanel

**File:** `src/components/panels/inspector/ReportPanel.tsx:119-121`
**Issue:** `Math.max(4, Math.round((savingsPct / 100) * 48))` hardcodes the chart height (48) and
floor (4), and `savingsPct < 30` hardcodes the warn threshold. These are unexplained magic numbers
duplicated from the `h-[52px]` container. Divide-by-zero is correctly guarded (line 114-117).
**Fix:** Hoist to named constants (`CHART_PX = 48`, `MIN_BAR_PX = 4`, `WARN_PCT = 30`).

---

_Reviewed: 2026-05-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
