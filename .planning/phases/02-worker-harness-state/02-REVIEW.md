---
phase: 02-worker-harness-state
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - package.json
  - src/App.tsx
  - src/components/panels/CodecPanel.tsx
  - src/components/panels/OutputPanel.tsx
  - src/components/panels/ReportPanel.tsx
  - src/components/panels/SvgoPanel.tsx
  - src/components/shell/TitleBar.tsx
  - src/components/shell/Toolbar.tsx
  - src/data/defaults.ts
  - src/index.css
  - src/lib/live-region.ts
  - src/lib/object-url.ts
  - src/stores/files.ts
  - src/stores/index.ts
  - src/stores/runtime.ts
  - src/stores/settings.ts
  - src/tests/aria-live.spec.ts
  - src/tests/fixtures/instrument-blob-urls.js
  - src/tests/fixtures/synthetic.ts
  - src/tests/object-url.spec.ts
  - src/tests/shell.spec.ts
  - src/tests/worker-pool.spec.ts
  - src/types/index.ts
  - src/workers/pool.ts
  - src/workers/stub-adapter.ts
  - src/workers/types.ts
  - src/workers/worker.ts
  - vite.config.ts
findings:
  critical: 4
  warning: 8
  info: 5
  total: 17
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 2 wires the worker pool, three Zustand stores (files / settings / runtime), object-URL lifecycle, and ARIA live-region cadence into the Phase-1 visual shell. The architecture follows the documented PATTERNS.md/RESEARCH.md guidance and the test surface (VR-01..VR-05) is real Playwright assertions rather than stubs.

Several real defects were found, however. Most consequential:

- **Race condition in WorkerPool.cancel() → spawnAll()** that turns a stale `markStarted` callback (from the *previous* generation of the pool) into corrupted runtime state for the *new* batch (BLOCKER CR-01).
- **Pool slot leak / spawning on cancel without checking re-entry**: cancel() respawns workers immediately; the next enqueue then runs against half-assigned `slots` indexes if a stale `runOnSlot.finally` handler fires after termination (BLOCKER CR-02).
- **`startBatch` truncates `markStarted`**: `markStarted` runs *synchronously* from the pool's `tryDispatch` *before* `startBatch` returns control to React's microtask boundary, but the runtime store's `markStarted` is gated on `queue.includes(jobId)` — and in the current dispatch path the queue is populated and drained inside the same tick, which means under specific race conditions inFlight may never gain entries (BLOCKER CR-03).
- **VR-01 test asserts the wrong invariant**: `expect(result.optimizedSize).toBe(result.originalSize)` is exactly what an *unsafe* echo adapter would also pass — passing this test does not prove the worker boundary is exercised (WARNING).

Secondary issues: a divide-by-zero in `ReportPanel` totals when files list is empty, a null-dereference path in App's `SHELL_FILES` builder when `byId[id]` is missing during a stale render, dropped clipboard errors, and several Phase-1 inconsistencies that the migration partially exposed.

## Critical Issues

### CR-01: WorkerPool.cancel() leaks `inFlight` callbacks against the *new* slot generation

**File:** `src/workers/pool.ts:76-99` and `src/workers/pool.ts:171-181`

**Issue:** `cancel()` does the following sequence synchronously:
1. `this.abortController?.abort()` — trips the race in `runOnSlot`.
2. `for (const slot of this.slots) slot?.worker.terminate()` — kills workers.
3. `this.slots = []; this.idle = []; this.spawned = false;`
4. `this.spawnAll()` — *immediately* allocates new `slots[]` and pushes new ids onto `this.idle`.

But the pre-existing `runOnSlot` invocations are still pending in microtask land. When their `Promise.race` rejects with `AbortError`, control falls through to the `finally` block (line 174-181):

```ts
} finally {
  this.inFlight.delete(slot)
  // Worker may have been terminated mid-flight (cancel) — guard.
  if (this.slots[slot]) {
    this.idle.push(slot)
    this.tryDispatch()
  }
}
```

After `cancel()` reassigns `this.slots`, `this.slots[slot]` for an *old* slot index now references a *new* `Slot` object (because the new pool uses indexes 0..N-1 too). The guard `if (this.slots[slot])` therefore returns true, and the old job's `finally` pushes its *old* slot index back onto `this.idle` — which is now the new pool's idle list. Net effect: a duplicate idle entry, a slot can be dispatched twice in parallel against a single new worker, and `inFlight.delete(slot)` may delete a *new* batch's entry.

This is the headline correctness bug in the file. It is reachable under VR-03 (cancel correctness) — the test only checks runtime store state ≤200ms after cancel and so does not exercise re-batch.

**Fix:** Capture a pool generation token; ignore `finally` work for slots that don't belong to the current generation:

```ts
private generation = 0

cancel(): void {
  this.generation += 1
  // ... existing teardown
  this.spawnAll()
}

private async runOnSlot(slot: number, job: PendingJob): Promise<void> {
  const generation = this.generation
  // ... existing try/catch ...
  } finally {
    if (generation !== this.generation) return  // pool was canceled; do nothing
    this.inFlight.delete(slot)
    if (this.slots[slot]) {
      this.idle.push(slot)
      this.tryDispatch()
    }
  }
}
```

Also: cancel respawning workers eagerly is wasteful — defer to lazy-spawn-on-next-enqueue by setting `this.spawned = false` and removing the `this.spawnAll()` call at the end of `cancel()`.

---

### CR-02: `inFlight` callbacks fire `onError` against a job that *already* called `onDone`

**File:** `src/workers/pool.ts:88-90`

**Issue:** Inside `cancel()`:

```ts
// Reject in-flight jobs (Promise.race already settled but onError hook needs to fire).
for (const job of this.inFlight.values()) {
  this.callbacks.onError?.(job.id, error)
}
```

But `inFlight` may contain jobs whose `slotRef.proxy.runJob(...)` already resolved successfully and whose `job.resolve(result)` already ran — but whose `finally` block has not yet executed `this.inFlight.delete(slot)`. The `Promise.race` is racing the abort signal, and a successful proxy result and an aborted signal can both land in the same microtask flush.

Concretely: if cancel runs *after* `await proxy.runJob(...)` returned successfully but *before* the `finally` ran, the job is still in `this.inFlight`. The cancel loop now invokes `onError(job.id, AbortError)`. The runtime store handler then bumps `errorCount` for a job that *already* had `markDone` called on it via the `.then()` in `App.startOptimize`. Result: `doneCount + errorCount > totalJobs`, breaking the "Batch complete" branch in App.tsx:172 (`finished` boolean evaluation).

**Fix:** Track per-job settled state explicitly so cancel only fires onError for *unsettled* jobs:

```ts
interface PendingJob extends PoolJob {
  resolve: (r: AdapterRunResult) => void
  reject: (err: unknown) => void
  settled: boolean
}

// In runOnSlot, after job.resolve / job.reject:
job.settled = true

// In cancel:
for (const job of this.inFlight.values()) {
  if (!job.settled) {
    job.reject(error)
    this.callbacks.onError?.(job.id, error)
  }
}
```

Note: `App.startOptimize`'s `.then(...)` already schedules `markDone` regardless of whether `cancel` fired `onError` — it should also gate on `useRuntimeStore.getState().inFlight.has(fileId)` to avoid double-counting after cancel.

---

### CR-03: `markStarted` is only called by the pool, but the runtime store also requires it for `markDone`/`markError` to do anything

**File:** `src/stores/runtime.ts:68-96` and `src/workers/pool.ts:131-135`

**Issue:** The runtime store's `markDone` and `markError` both early-return if the job is not in `inFlight`:

```ts
markDone: (jobId) =>
  set((s) => {
    if (!s.inFlight.has(jobId)) return {}
    ...
  }),
```

But `markStarted` itself early-returns if the job isn't in `queue`:

```ts
markStarted: (jobId) =>
  set((s) => {
    if (!s.queue.includes(jobId)) return {}
    ...
  }),
```

The pool's `tryDispatch` calls `onStarted(job.id)` *immediately* before kicking off `runOnSlot` (synchronously in the same dispatch tick). The sequence on `startOptimize`:

1. `useRuntimeStore.getState().startBatch(fileIds)` — this populates `queue` to `[...fileIds]`.
2. Loop calls `pool.enqueue(job)` for each id.
3. Each `enqueue` pushes onto `pool.queue` and calls `tryDispatch()`.
4. `tryDispatch()` synchronously invokes `callbacks.onStarted?.(job.id)` → `useRuntimeStore.getState().markStarted(jobId)`.

This works *today* because the queue update from step 1 has already committed. **But** if any caller ever inverts the order (e.g. a future Phase-3 refactor that fans out enqueues before calling `startBatch`), `markStarted` silently no-ops and `inFlight` is never populated — which means *every* subsequent `markDone` also silently no-ops, and `running` never flips back to false. The batch hangs.

This contract is undocumented and load-bearing. The defensive guard `if (!s.queue.includes(jobId)) return {}` should be replaced with logic that *adds* the job to `inFlight` regardless, since the pool already verified the job exists.

**Fix:**

```ts
markStarted: (jobId) =>
  set((s) => {
    // Defensively allow markStarted even if queue write is racing — the pool
    // is the source of truth for "this job is dispatched."
    const inFlight = new Set(s.inFlight)
    if (inFlight.has(jobId)) return {}  // idempotent
    inFlight.add(jobId)
    return {
      queue: s.queue.filter((id) => id !== jobId),
      inFlight,
    }
  }),
```

---

### CR-04: `App.startOptimize` re-reads `filesState.byId[fileId]` after the dispatch loop has yielded

**File:** `src/App.tsx:298-340`

**Issue:** `startOptimize` snapshots `useFilesStore.getState()` once into `filesState`, then in the for-loop dereferences `filesState.byId[fileId]` to grab `f.sourceBlob`. But the loop is sync; that's fine. *However,* the `pool.enqueue(job)` returned promise's `.then((result) => { ... })` callback closes over `fileId` only — it then calls `useFilesStore.getState().markDone(fileId, optimizedBlob, optimizedBlob.size)`.

If the user removed the file (`removeFile(fileId)`) between dispatch and resolution, `markDone` writes a new entry into `byId` because the early-return guard is `if (!prev) return {}` — wait, that *is* guarded. Re-read:

```ts
markDone: (fileId, optimizedBlob, optimizedSize) => {
  useRuntimeStore.getState().revokeObjectURL(fileId)  // <-- runs unconditionally
  set((s) => {
    const prev = s.byId[fileId]
    if (!prev) return {}
    ...
```

The `revokeObjectURL` call on line 59 of `src/stores/files.ts` runs **before** the guard. If the file was removed, the URL was already revoked by `removeFile` (line 45), and the runtime store's `revokeObjectURL` is idempotent (early-returns on cache miss) — so this isn't a leak. But the `.catch(() => {})` in App.tsx:334-338 swallows *all* errors silently, including `AdapterError` from a real codec implementation. That eats real production bugs.

**Fix:** Differentiate cancel/abort from real adapter errors and surface the latter:

```ts
.catch((err) => {
  if (err instanceof DOMException && err.name === 'AbortError') return  // expected on cancel
  // Real adapter error — flip files store to 'error' status.
  useFilesStore.getState().setStatus(fileId, 'error')
  console.error(`[startOptimize] ${fileId}:`, err)
})
```

---

## Warnings

### WR-01: `ReportPanel` divides by zero when `files` is empty

**File:** `src/components/panels/ReportPanel.tsx:14-15`

**Issue:**
```ts
const total = files.reduce((s, f) => s + f.orig, 0);
const optTotal = files.reduce((s, f) => s + f.opt, 0);
const saved = total - optTotal;
const pct = (saved / total) * 100;  // NaN when total === 0
```

When `files.length === 0` (the new Phase-2-cleanup default — empty queue), `pct` is `NaN`. It's then rendered as `pct.toFixed(1)` which yields `"NaN"`. The empty-state UX in the inspector shows "NaN%" when no files are queued.

Also: `localPct` on line 32 has the same issue per-file when `f.orig === 0` (which is the case for the placeholder file).

**Fix:**
```ts
const pct = total === 0 ? 0 : (saved / total) * 100;
// And for per-file:
const localPct = f.orig === 0 ? 0 : ((f.orig - f.opt) / f.orig) * 100;
```

---

### WR-02: `App.SHELL_FILES` derefs `filesById[id]` without guarding against undefined

**File:** `src/App.tsx:228-246`

**Issue:**
```ts
return filesOrder.map((id) => {
  const entry = filesById[id]  // could be undefined
  ...
  const status: MockFile['status'] =
    entry.status === 'idle' ? 'queued' : (entry.status as MockFile['status'])
  return { id: entry.id, ... }
})
```

`filesById` and `filesOrder` are read from two separate Zustand selectors. If a `removeFile` action commits between the two selector reads in concurrent React 19 renders (or in a future strict-mode double render), `filesOrder` may contain an id that is no longer in `filesById`. The `entry.status` access throws.

**Fix:**
```ts
return filesOrder.flatMap((id) => {
  const entry = filesById[id]
  if (!entry) return []
  ...
})
```

Or atomically select both via `useFilesStore((s) => ({ byId: s.byId, order: s.order }))` with a shallow equality function, so they're always read from the same snapshot.

---

### WR-03: Quartile boundary check fires duplicate announcements at small batch sizes

**File:** `src/lib/live-region.ts:30-36` and `src/App.tsx:160-164`

**Issue:** `isQuartileBoundary` returns true when `doneCount % stride === 0`. For `totalJobs = 4`, stride is `Math.max(1, floor(4/4)) = 1`, so *every* completion is a quartile boundary — meaning a 4-file batch will fire interior strides at done=1, 2, 3 (and the final at done=4 is handled separately). That's 4 announcements + start + final = 6 announcements for 4 files, which violates the documented "no per-file announcement" cadence (Pitfall 5 — screen-reader flooding).

For `totalJobs = 1`, stride is `1`, and the early-return `doneCount === totalJobs` blocks the only possible boundary. Correct.

For `totalJobs = 2`, stride is `1`. The single interior boundary (done=1) fires, plus final. Probably acceptable.

For `totalJobs = 3`, stride is `1`. Done=1, done=2 both fire, plus final. Three announcements for three files — exactly the flooding the spec forbids.

**Fix:** Floor at 4 quartiles' worth of files:
```ts
export function isQuartileBoundary(doneCount: number, totalJobs: number): boolean {
  if (totalJobs < 4) return false  // small batches: only start + final
  ...
}
```

---

### WR-04: `OutputPanel.copy` swallows clipboard errors silently

**File:** `src/components/panels/OutputPanel.tsx:16-20`

**Issue:**
```ts
const copy = (key: Exclude<CopyKey, null>, text: string) => {
  navigator.clipboard?.writeText(text).catch(() => {});
  setCopied(key);
  ...
};
```

`navigator.clipboard?.writeText` may reject in iframe/permissions contexts, and the optional-chain returns `undefined` if clipboard is missing — but `setCopied(key)` runs *unconditionally*, so the UI shows "copied" even when nothing was copied. For a copy-paste-driven app this is a meaningful UX bug.

**Fix:**
```ts
const copy = async (key: Exclude<CopyKey, null>, text: string) => {
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard API unavailable')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100)
  } catch {
    toast.error('Copy failed')
  }
}
```

---

### WR-05: Worker pool generates `__OIMG_SLOW_MS__` read in production via `import.meta.env.MODE === 'test'`

**File:** `src/App.tsx:316-320`

**Issue:** The slow-Ms test affordance is gated on `import.meta.env.DEV || import.meta.env.MODE === 'test'`. In a typical Vite production build, `MODE === 'production'` so this tree-shakes correctly. But `import.meta.env.MODE` is *also* configurable via `--mode test` at build time, and any developer running `vite build --mode test` for any reason will ship a production bundle that reads `window.__OIMG_SLOW_MS__`. This is a small attack surface (DOS only), but the gate should be more conservative.

**Fix:** Gate on `import.meta.env.DEV` only (Playwright runs against `vite dev`, not a built bundle):

```ts
const slowMs = import.meta.env.DEV
  ? (window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__ ?? 0
  : 0
```

Same applies to the `__OIMG_STORES__` exposure on line 196.

---

### WR-06: `cancelBatch` toast shows `${inFlightCount} files were processing` *after* `pool.cancel()` already fired `onError` → `markError` for each one

**File:** `src/App.tsx:347-353`

**Issue:**
```ts
const cancelBatch = () => {
  const inFlightCount = useRuntimeStore.getState().inFlight.size  // pre-cancel snapshot
  pool.cancel()  // fires onError for each, which calls markError → bumps errorCount
  useRuntimeStore.getState().cancelBatch()  // clears inFlight
  ...
}
```

`pool.cancel()` synchronously fires `this.callbacks.onError?.(job.id, error)` for every in-flight job — that's bound to `useRuntimeStore.getState().markError(jobId, msg)`, which bumps `errorCount` and decrements `inFlight`. Then `useRuntimeStore.getState().cancelBatch()` clears `inFlight` and resets `running`. Net effect:
- `errorCount` is now `inFlightCount` (cancel-as-errors).
- The `useEffect` watcher on App.tsx:151-189 fires the "Batch complete" branch because `prev.running && !curr.running && curr.totalJobs > 0`, but `curr.errorCount === curr.totalJobs` is *not* necessarily true (only the in-flight subset errored), so it goes into the "partial" branch with a misleading toast.

The comment on App.tsx:171-173 acknowledges this:
```
// cancel emits its own "Batch canceled" announcement directly,
// so we guard here with `totalJobs > 0` AND a non-zero done+error sum
// to avoid double-announcing on cancel.
```

But `done + error === totalJobs` is exactly what cancel produces (because every queued job becomes either an error from inFlight or… no, wait, queued jobs that were never dispatched also fire onError per pool.ts:84-86). So `done + error === totalJobs` after cancel, and the `finished` branch *will* trigger a misleading "Batch complete. N files optimized, 0 bytes saved." toast on cancel.

**Fix:** Either: (a) don't bump `errorCount` on cancel-induced errors (introduce an `AbortError` discriminator in `markError`), or (b) flip the `running → false` order so `cancelBatch()` runs *before* `pool.cancel()` to make the App.tsx subscriber see `inFlight.size > 0` already cleared.

Recommended: discriminate AbortError in `markError`:

```ts
markError: (jobId, message) =>
  set((s) => {
    if (!s.inFlight.has(jobId)) return {}
    const inFlight = new Set(s.inFlight)
    inFlight.delete(jobId)
    const isCancel = message === 'Batch cancelled' || message.includes('AbortError')
    return {
      inFlight,
      errorCount: isCancel ? s.errorCount : s.errorCount + 1,
      running: inFlight.size > 0 || s.queue.length > 0,
    }
  }),
```

---

### WR-07: `WorkerPool.terminate()` does not clear `abortController`, so re-spawn after terminate uses a stale signal

**File:** `src/workers/pool.ts:101-109`

**Issue:**
```ts
terminate(): void {
  for (const slot of this.slots) slot?.worker.terminate()
  this.slots = []
  this.idle = []
  this.queue = []
  this.inFlight.clear()
  this.spawned = false
  // abortController is NOT cleared
}
```

If a test calls `__setWorkerPoolForTesting(null)` (which calls `terminate()`), then later the same module is re-imported and `getWorkerPool()` returns a *new* pool instance — that's fine. But the documented "permanent teardown" comment implies post-terminate the pool is unusable, while `enqueue` will happily call `spawnAll` (because `this.spawned === false`) — which calls `this.abortController = new AbortController()`, so this is actually safe today. The risk: if a future change adds a check like `if (this.abortController?.signal.aborted) throw`, it would silently fail because the stale aborted controller persists.

**Fix:** Belt-and-braces — clear it:

```ts
terminate(): void {
  // ...
  this.abortController = null
}
```

---

### WR-08: `useFilesStore.markDone` writes a `status: 'done'` even if the entry was previously in `'error'` state

**File:** `src/stores/files.ts:56-75`

**Issue:** A file that errored on the first batch and then got re-optimized successfully should flip `'error' → 'done'`. That works. But the reverse — a file that was in `'done'` from a prior batch then re-optimized and now fails — does not get its status flipped to `'error'` because App.startOptimize's `.catch` no-ops (CR-04). After the second batch, the file shows `done` in the UI but `optimizedSize` may not reflect the new (failed) attempt.

**Fix:** Tied to CR-04. Add `setStatus(fileId, 'error')` in the catch handler.

---

## Info

### IN-01: `removeViewBox: false` comment is misleading

**File:** `src/data/defaults.ts:34`

The inline comment `// D-07 note: removeViewBox off by default — preserves responsive scaling` is correct, but `D-07` in `02-CONTEXT.md` does not actually mention SVG plugin defaults. The reference is plausible-looking but misroutes future readers. Replace with a direct citation: `// SVGO preset-default disables this; we keep parity to preserve responsive scaling.`

---

### IN-02: `MockFile` type duplication

**File:** `src/types/index.ts:16-30` and `src/types/index.ts:8`

`FileType` is `'png' | 'jpg' | 'svg' | 'webp' | 'avif'` and `FormatId` is `'svg' | 'png' | 'jpeg' | 'webp' | 'avif'`. The mismatch (`jpg` vs `jpeg`) forces the `fmtToType` adapter in App.tsx:230-231. Either: collapse to one type, or add a comment explaining why both exist (the existing comment alludes to a Phase-5 migration but doesn't say it's deliberate dual-naming).

---

### IN-03: `OutputPanel.tsx:22-25` — hardcoded base64 string fragment with `…` marker

**File:** `src/components/panels/OutputPanel.tsx:23-25`

```ts
const b64 =
  'data:image/' + targetMime +
  ';base64,iVBORw0KGgoAAAANSUhEUgAAAuwAAAH0CAYAAACGGSAyAAAAGXRFWHRT…';
```

The trailing `…` is *not* valid base64 — copying this snippet into an actual `<img>` produces a broken image. This is acceptable as a Phase-2 placeholder since real codecs aren't wired, but should be marked `TODO(phase-3)` or wrapped in a "preview only" disclaimer in the UI.

---

### IN-04: `vite.config.ts` has no `optimizeDeps` for `comlink`

**File:** `vite.config.ts:6-29`

Vite's pre-bundling can sometimes mis-handle Comlink in workers (particularly the `expose` / `wrap` boundary), producing dev-only warnings. Not a bug today, but if `comlink` ever shows up in dev console errors, add `optimizeDeps: { include: ['comlink'] }`. No change needed unless symptoms appear.

---

### IN-05: `src/lib/object-url.ts` — module is barely used

**File:** `src/lib/object-url.ts`

The whole module is two re-exported functions that delegate to `useRuntimeStore.getState()`. No call sites in the reviewed file set actually import from it; ARIA test and worker-pool test go directly via the store. If still unused at end of Phase 5, delete it (YAGNI). Not a bug — just dead-on-arrival surface area.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
