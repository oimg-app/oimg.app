# Phase 3 — Deferred Items

(none — all auto-fix items resolved during plan execution)

## Resolved during Plan 03-A

### CR-04 race condition in App.tsx pool .then handler (Rule 1 fix)

The `if (!useRuntimeStore.getState().inFlight.has(fileId)) return` guard in
the pool's success-path .then callback was racing with the pool's own
`onDone` callback. Because `pool.runOnSlot` calls `job.resolve(result)`
followed synchronously by `callbacks.onDone(...)`, runtime.markDone removed
the job from `inFlight` BEFORE the .then microtask ran. The guard then
incorrectly bailed on every successful job, so files never reached
`status: 'done'`.

This bug existed since Phase 2 plan 02-04 but was latent: aria-live and
object-url tests waited on `runtime.doneCount`, not `file.status`, and only
worker-pool VR-01 hit it (timing out at the 30s playwright budget).

**Fix:** Replaced the inFlight guard with a defensive `byId[fileId]` existence
check. Cancel-race correctness is preserved because cancelled jobs route
through `.catch` (`job.reject(AbortError)`), not `.then`.

**Verification:** Full Playwright suite (37 tests) passes after the fix —
including the previously-flaky VR-01.
