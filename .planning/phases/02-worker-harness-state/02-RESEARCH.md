# Phase 2: Worker Harness + State - Research

**Researched:** 2026-04-30
**Domain:** Web Worker pool orchestration, Comlink RPC, zustand v5 sliced stores, Object URL lifecycle, ARIA live region cadence
**Confidence:** HIGH for all recommended libraries (versions verified live against npm registry); MEDIUM for the exact pool topology (canonical pattern, but bespoke to this app)

## Summary

Phase 2 builds the generic worker pipeline (`min(hardwareConcurrency, 4)` warm pool, FIFO queue, terminate-and-respawn cancel) that Phase 3 (SVG) and Phase 5 (raster) plug codec-specific adapters into. State is reorganized into three sliced zustand v5 stores (`useFilesStore`, `useSettingsStore`, `useRuntimeStore`). All decisions D-01..D-12 are locked upstream — research scope is to verify the canonical idioms that satisfy them.

**Primary recommendation:** Use `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` + `Comlink.wrap()` per worker (one proxy per worker, not a shared proxy with routing); ship a single `WorkerPool` class (not a hook) under `src/workers/pool.ts`; structure stores under `src/stores/{files,settings,runtime}.ts` with a single `src/stores/index.ts` barrel; lazy-create object URLs via a runtime-store `urlCache: Map<string, string>` keyed by `FileEntry.id`; use `Comlink.transfer(input, [input])` on call and have the worker return `Comlink.transfer({ output, meta }, [output])`. The stub adapter is one file (~15 LOC) and is the Phase 2 acceptance gate.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Worker Pool Topology**
- **D-01:** Warm pool, sized to `min(navigator.hardwareConcurrency, 4)`. Workers spawn lazily on first job (or app start, planner's discretion) and persist for the session. Per-worker codec modules are lazy-imported on first use inside the worker.
- **D-02:** Cancellation = `worker.terminate()` + respawn fresh worker. Hard-stop in-flight jobs by terminating; pool replaces with a fresh worker. No cooperative cancel token in v1.
- **D-03:** Queue scheduler = FIFO. Jobs added to a queue; idle workers pull from the head. New uploads append to the back. No priority hints in v1.

**Adapter Contract Shape**
- **D-04:** I/O signature: `(input: ArrayBuffer, settings: TSettings) => Promise<{ output: ArrayBuffer, meta: AdapterMeta }>`. Stub adapter returns input as output with `meta: { unchanged: true }`.
- **D-05:** Adapter owns decoding. Pipeline does not pre-decode rasters to ImageData.
- **D-06:** Progress reporting = two states only: `started` + `done` (or `error`). UI uses spinner + counter (`done / total`).

**State Store Organization**
- **D-07:** Three sliced zustand stores: `useFilesStore`, `useSettingsStore`, `useRuntimeStore`.
- **D-08:** Worker queue lives in `useRuntimeStore`. FileEntry data and queue position are decoupled.
- **D-09:** Components subscribe via narrow selectors (e.g. `useFilesStore(s => s.byId[id])`).

**Memory Model**
- **D-10:** Object URL lifecycle: lazy-create on first render need; revoke on eviction.
- **D-11:** Streaming concurrency cap = worker count. At most `min(hardwareConcurrency, 4)` files in flight.
- **D-12:** Blob-only state. No `ArrayBuffer` or `ImageData` lives in any store between worker calls.

### Claude's Discretion
- Comlink wiring style (proxy-per-worker vs single shared proxy with worker-id routing)
- Whether to ship a separate `WorkerPool` class vs a `useWorkerPool` hook
- Exact slice file layout under `src/stores/`
- Whether `useRuntimeStore.urlCache` is keyed by Blob identity or `FileEntry.id`
- Stub adapter location: `src/adapters/stub.ts` vs `src/workers/stub-adapter.ts`
- Exact error type taxonomy (one `AdapterError` vs `CancelError`/`DecodeError`/`EncodeError`)

### Deferred Ideas (OUT OF SCOPE)
- Cooperative cancel tokens — Defer to v2.
- Hybrid worker pool (auto-scale + idle terminate) — Defer to v2.
- Streaming chunked adapters — Defer to v2.
- Per-file atomic zustand stores — Defer to v2.
- Persist worker queue across reloads — Phase 7 owns persistence.
- Multi-stage progress events — Reconsider in Phase 5.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | WASM codecs run in Web Worker pool (non-blocking UI) | §Architecture Patterns: Worker Pool Topology; §Code Examples: pool skeleton |
| PERF-02 | Lazy-load codecs on first use | §Standard Stack: Vite worker dynamic-import bundling; §Architecture: per-worker lazy import inside `processJob` |
| PERF-03 | Progress UI for batch operations | §A11Y: ARIA live-region quartile cadence; §Architecture: runtime store fields drive Workers pill, indeterminate progbar, totals counter |

## Project Constraints (from CLAUDE.md)

- **Tech stack LOCKED:** React ^19.2 + Vite ^7.3 (downgraded from 8 due to Apple Silicon Rolldown native-binding bug, see Phase 1 Plan 04 summary) + TypeScript ^5.9.
- **Worker plumbing LOCKED:** `comlink ^4.4` (verified `4.4.2`, last published `2024-11-07`).
- **State LOCKED:** `zustand ^5.0` (verified `5.0.12`, last published `2026-03-16`).
- **No Node-shimmed modules.** All workers, stores, adapters import as browser ESM only — no `require`, no Node polyfills.
- **Hand-rolled UI primitives** (Phase 1 D-06). Phase 2 store wiring must NOT trigger shadcn migration.
- **crossOriginIsolated mandate** (Phase 1 D-03). Workers inherit isolation from `public/_headers`. Hard-throw on `crossOriginIsolated === false` is deferred until Phase 5 (when SharedArrayBuffer becomes required for codec MT).
- **Privacy-first:** zero-server, zero-telemetry. PRIV-04 forbids any thumbnail cache.
- **Atomic-task commit discipline.** Phase 2 plans should follow Phase 1's pattern of 2–3 atomic commits per plan.
- **Playwright over jsdom.** Worker tests run in real Chromium against `http://localhost:5173`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Worker pool orchestration (spawn, queue, dispatch, terminate) | Main thread (`src/workers/pool.ts`) | — | Pool is a singleton orchestrator; workers are dumb executors. |
| Codec adapter execution (bytes-in / bytes-out) | Worker thread (`src/workers/worker.ts`) | — | Keeps main thread responsive; D-01/PERF-01 mandate. |
| Job queue + concurrency cap | Main thread (`useRuntimeStore`) | — | D-08; queue evaporates on reload, doesn't belong in worker. |
| FileEntry canonical data | Main thread (`useFilesStore`) | — | D-07; persistent in spirit (Phase 7 wires IndexedDB). |
| Codec settings | Main thread (`useSettingsStore`) | — | D-07; pure UI-driven config, never lives in worker. |
| Object URL cache | Main thread (`useRuntimeStore.urlCache`) | — | URLs are main-thread-only API; D-10 lazy-create-on-render. |
| Progress aggregation (`done/total`) | Main thread (`useRuntimeStore` derived selector) | — | Worker reports per-job `started`/`done`; main thread tallies. |
| ARIA live-region updates | Main thread (App-root component subscribed to runtime store) | — | UI-SPEC §5: single shared `<div role="status" aria-live="polite">`. |
| Comlink RPC bridge | Main + Worker | — | `Comlink.expose()` in worker, `Comlink.wrap()` in main. |
| ArrayBuffer transferable | Main → Worker → Main | — | Zero-copy via `Comlink.transfer()`; never stored cross-call (D-12). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `comlink` | `^4.4.2` | Worker RPC proxy (wrap/expose/transfer/proxyMarker) | `[VERIFIED: npm view comlink — 4.4.2 published 2024-11-07]` Maintained by GoogleChromeLabs; used by Squoosh itself. ~1KB gzip. |
| `zustand` | `^5.0.12` | Sliced stores with `subscribeWithSelector` | `[VERIFIED: npm view zustand — 5.0.12 published 2026-03-16]` ~3KB gzip; works in workers (we won't, but it can); narrow-selector idiom maps to D-09. |
| `react` | `^19.2` (already installed) | Concurrent rendering, `useTransition` for non-blocking UI | Already pinned in `package.json`. |
| `vite` | `^7.3` (already installed) | Dev server + production build with worker bundling | Pinned at 7 in package.json — DO NOT bump to 8 (Apple Silicon Rolldown breakage, Phase 1 D-04 lock). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | `^2.0.7` (locked PROJECT.md §6 — NOT yet installed) | Toasts for batch lifecycle | Install in Phase 2; needed for UI-SPEC §7 toast contract. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| comlink | `workercom` (npm fork), raw `postMessage` | comlink is locked in CLAUDE.md and PROJECT.md. Raw postMessage is more code; workercom is unmaintained. |
| zustand sliced stores | One mega-store with `combine` | Slicing is cleaner for D-07's three-store split and lets us version stores independently when Phase 7 wires persistence to IndexedDB for two of three. |
| `WorkerPool` class | `useWorkerPool` hook | Class wins: pool is a singleton across the app's lifetime — wrapping in a hook would force a global Provider or React-Context indirection. Pool methods (`enqueue`, `cancel`, `terminate`) work fine called from outside React (e.g. from `useRuntimeStore` actions). |

**Installation:**
```bash
npm install comlink zustand sonner
```

**Version verification (live against npm registry, 2026-04-30):**
- `comlink@4.4.2` (2024-11-07) — `[VERIFIED: npm view comlink]`
- `zustand@5.0.12` (2026-03-16) — `[VERIFIED: npm view zustand]`
- `sonner@2.0.7` (2025-08-02) — `[VERIFIED: npm view sonner]`

## Architecture Patterns

### System Architecture Diagram

```
┌──────────── MAIN THREAD ────────────────────────────────────┐
│                                                              │
│  User UI events (drop file, click Optimize, ⌘.)              │
│       │                                                      │
│       ▼                                                      │
│  ┌────────────────┐    ┌─────────────────┐                   │
│  │ useFilesStore  │    │ useSettingsStore│                   │
│  │ (canonical     │    │ (per-format     │                   │
│  │  FileEntry[])  │    │  codec config)  │                   │
│  └────────┬───────┘    └────────┬────────┘                   │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────────────────────────────┐                 │
│  │          useRuntimeStore                │                 │
│  │  queue: jobId[]  inFlight: Set<jobId>   │                 │
│  │  urlCache: Map<FileEntry.id, string>    │                 │
│  │  busyCount  totalJobs  doneCount        │                 │
│  └────────┬────────────────────────────────┘                 │
│           │  enqueue(jobId)                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────┐                 │
│  │         WorkerPool (singleton)          │                 │
│  │  workers: Worker[N]   proxies: Wrap[N]  │                 │
│  │  idle: number[]   N = min(hwConc, 4)    │                 │
│  │  cancel() → workers.forEach(.terminate) │                 │
│  └────────┬────────────────────────────────┘                 │
│           │  (1) await blob.arrayBuffer()                    │
│           │  (2) Comlink.transfer(input, [input])            │
│           ▼                                                  │
└───────────┼──────────────────────────────────────────────────┘
            │ postMessage with transferable
┌───────────▼──────────── WORKER THREAD (×N) ─────────────────┐
│  Comlink.expose({ runJob })                                  │
│       │                                                      │
│       ▼                                                      │
│  runJob(input, settings, format) →                           │
│    adapter = await import(`./adapters/${format}.ts`)         │
│    { output, meta } = await adapter.run(input, settings)     │
│    return Comlink.transfer({ output, meta }, [output])       │
│                                                              │
│  Phase 2: only stub.ts adapter exists (returns input as is)  │
│  Phase 3: + svg.ts adapter (SVGO)                            │
│  Phase 5: + png.ts/webp.ts/jpeg.ts/avif.ts adapters          │
└──────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── workers/
│   ├── pool.ts            # WorkerPool class (singleton orchestrator)
│   ├── worker.ts          # Worker entry; Comlink.expose({ runJob })
│   └── stub-adapter.ts    # Phase 2 stub adapter (in-worker)
├── stores/
│   ├── index.ts           # Barrel re-export of the three stores
│   ├── files.ts           # useFilesStore
│   ├── settings.ts        # useSettingsStore
│   └── runtime.ts         # useRuntimeStore (queue, urlCache, pool stats)
├── adapters/              # Created Phase 3+; empty in Phase 2
└── lib/
    ├── object-url.ts      # getOrCreateObjectURL / revokeObjectURL helpers
    └── live-region.ts     # ARIA live-region update helper (quartile cadence)
```

`[ASSUMED]` — exact path layout. Discretionary per CONTEXT.md. Above is the recommended convention for the planner.

### Pattern 1: Worker bootstrap (Vite + Comlink + ESM)
**What:** Spawn an ES-module worker that exposes a Comlink-wrapped API; one Worker = one Comlink proxy.
**When to use:** Every worker in the pool. Repeated `min(hardwareConcurrency, 4)` times.

```typescript
// src/workers/worker.ts (worker side)
// Source: GoogleChromeLabs/comlink README + Vite worker docs
import * as Comlink from 'comlink'

export interface AdapterMeta { unchanged?: boolean; codecVersion?: string }
export type AdapterFormat = 'stub' | 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'

async function runJob(
  input: ArrayBuffer,
  settings: unknown,
  format: AdapterFormat
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  // PERF-02: lazy-import the adapter module on first use inside the worker.
  // Vite splits this into a worker-side chunk; only fetched when needed.
  const adapterModule = await import(`./${format}-adapter.ts`)
  const { output, meta } = await adapterModule.run(input, settings)
  // Hand the buffer back zero-copy.
  return Comlink.transfer({ output, meta }, [output])
}

Comlink.expose({ runJob })
```

```typescript
// src/workers/pool.ts (main side)
import * as Comlink from 'comlink'

interface WorkerProxy {
  runJob: (
    input: ArrayBuffer,
    settings: unknown,
    format: string
  ) => Promise<{ output: ArrayBuffer; meta: AdapterMeta }>
}

export class WorkerPool {
  private size: number
  private workers: Worker[] = []
  private proxies: Comlink.Remote<WorkerProxy>[] = []
  private idle: number[] = []
  private queue: Job[] = []

  constructor() {
    this.size = Math.min(navigator.hardwareConcurrency || 2, 4)
    this.spawnAll()
  }

  private spawnAll() {
    for (let i = 0; i < this.size; i++) this.spawnOne(i)
  }

  private spawnOne(slot: number) {
    // Vite canonical idiom: new URL + import.meta.url + { type: 'module' }
    // DO NOT use ?worker suffix — limits dynamic imports inside worker.
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.workers[slot] = w
    this.proxies[slot] = Comlink.wrap<WorkerProxy>(w)
    this.idle.push(slot)
  }

  enqueue(job: Job): Promise<JobResult> { /* see Pattern 2 */ }
  cancel(): void { /* see Pattern 3 */ }
  terminate(): void { this.workers.forEach((w) => w.terminate()); this.workers = []; this.proxies = []; this.idle = [] }
  get stats() { return { size: this.size, busy: this.size - this.idle.length, queueDepth: this.queue.length } }
}
```

`[CITED: GoogleChromeLabs/comlink README — Comlink.wrap, Comlink.expose, Comlink.transfer]`
`[CITED: vite.dev/guide/features#web-workers — new URL idiom is canonical for ES-module workers]`

### Pattern 2: FIFO enqueue with idle-worker dispatch
**What:** Append jobs to queue; if any worker idle, dispatch immediately; otherwise wait.
**When to use:** Every `enqueue(job)` call from `useRuntimeStore.actions.startBatch`.

```typescript
interface Job {
  id: string
  fileId: string
  format: AdapterFormat
  settings: unknown
  blob: Blob
  resolve: (r: JobResult) => void
  reject: (e: unknown) => void
}
type JobResult = { output: ArrayBuffer; meta: AdapterMeta }

// inside WorkerPool
enqueue(jobInput: Omit<Job, 'resolve' | 'reject'>): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    this.queue.push({ ...jobInput, resolve, reject })
    this.tryDispatch()
  })
}

private async tryDispatch() {
  while (this.idle.length > 0 && this.queue.length > 0) {
    const slot = this.idle.shift()!
    const job = this.queue.shift()!
    this.runOnSlot(slot, job)
  }
}

private async runOnSlot(slot: number, job: Job) {
  try {
    // D-12: ArrayBuffer derived immediately before postMessage, never stored.
    const input = await job.blob.arrayBuffer()
    const result = await this.proxies[slot].runJob(
      Comlink.transfer(input, [input]),
      job.settings,
      job.format
    )
    job.resolve(result)
  } catch (e) {
    job.reject(e)
  } finally {
    // Worker may have been terminated mid-flight (cancel) — guard.
    if (this.workers[slot]) {
      this.idle.push(slot)
      this.tryDispatch()
    }
  }
}
```

`[CITED: comlink README — Comlink.transfer wraps the value AND lists transferables; pattern: Comlink.transfer(buffer, [buffer])]`

### Pattern 3: Cancel via terminate-and-respawn
**What:** Hard-stop all in-flight + queued jobs by terminating workers and rebuilding the pool fresh.
**When to use:** User triggers Cancel (Cmd+. or palette item).

```typescript
cancel(): void {
  // 1. Terminate all workers — kills any in-flight WASM regardless of state.
  this.workers.forEach((w) => w.terminate())
  // 2. Reject pending jobs with a known cancellation marker.
  const error = new DOMException('Batch cancelled', 'AbortError')
  for (const job of this.queue) job.reject(error)
  // Note: in-flight jobs (jobs that were dispatched but didn't resolve) — their
  // promises never resolve. Comlink wraps postMessage in a Promise; terminating
  // the worker abandons the message channel. The promise pends forever.
  // To make this observable, we wrap each runJob in a Promise.race() against
  // an AbortSignal in `runOnSlot`, and reject on cancel.
  this.queue = []
  this.workers = []; this.proxies = []; this.idle = []
  // 3. Respawn the pool fresh — codec WASM state discarded with terminated workers.
  this.spawnAll()
}
```

**Cancel correctness pattern:** to make in-flight cancel observable to callers, attach an `AbortSignal` per batch. `runOnSlot` does `Promise.race([proxyCall, abortPromise])`. When cancel fires, we both terminate the worker AND reject the abort promise. This avoids the dangling-Promise hazard.

`[ASSUMED]` — Promise.race AbortSignal pattern. Comlink does not provide a built-in cancel hook; this is the established workaround in the comlink GitHub issue tracker. Validate by writing a Playwright test that asserts the batch state transitions to `idle` immediately after Cancel, with no pending Promise resolutions arriving after.

### Pattern 4: zustand v5 sliced store

**What:** Three independently-typed stores, each with `subscribeWithSelector` for narrow selectors. NOT combined via `combine` — each is a standalone `create<T>()` call.

```typescript
// src/stores/runtime.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface RuntimeState {
  running: boolean
  queue: string[]              // jobIds in FIFO order
  inFlight: Set<string>        // jobIds currently dispatched
  doneCount: number
  totalJobs: number
  errorCount: number
  urlCache: Map<string, string> // FileEntry.id → object URL

  // actions
  startBatch: (jobIds: string[]) => void
  markStarted: (jobId: string) => void
  markDone: (jobId: string, optimizedSize: number) => void
  markError: (jobId: string, message: string) => void
  cancelBatch: () => void
  getOrCreateObjectURL: (fileId: string, blob: Blob) => string
  revokeObjectURL: (fileId: string) => void
}

export const useRuntimeStore = create<RuntimeState>()(
  subscribeWithSelector((set, get) => ({
    running: false,
    queue: [],
    inFlight: new Set(),
    doneCount: 0,
    totalJobs: 0,
    errorCount: 0,
    urlCache: new Map(),

    startBatch: (jobIds) =>
      set({ running: true, queue: jobIds, totalJobs: jobIds.length, doneCount: 0, errorCount: 0 }),

    markDone: (jobId, optimizedSize) =>
      set((s) => {
        const inFlight = new Set(s.inFlight)
        inFlight.delete(jobId)
        return {
          inFlight,
          doneCount: s.doneCount + 1,
          running: s.doneCount + 1 < s.totalJobs,
        }
      }),

    // ... markError, markStarted, cancelBatch ...

    getOrCreateObjectURL: (fileId, blob) => {
      const cached = get().urlCache.get(fileId)
      if (cached) return cached
      const url = URL.createObjectURL(blob)
      const next = new Map(get().urlCache)
      next.set(fileId, url)
      set({ urlCache: next })
      return url
    },

    revokeObjectURL: (fileId) => {
      const url = get().urlCache.get(fileId)
      if (!url) return
      URL.revokeObjectURL(url)
      const next = new Map(get().urlCache)
      next.delete(fileId)
      set({ urlCache: next })
    },
  }))
)
```

`[CITED: github.com/pmndrs/zustand README — subscribeWithSelector middleware, create<T>() pattern]`
`[VERIFIED: zustand v5 keeps `create<T>()` curried form; the trailing `()` after the type parameter is required for proper inference]`

**Selector usage in components:**
```typescript
// Narrow selector — re-renders only when this slice changes
const busy = useRuntimeStore((s) => s.totalJobs - s.doneCount - s.errorCount)
const running = useRuntimeStore((s) => s.running)
```

### Pattern 5: Object URL lifecycle (D-10 lazy-create / revoke-on-evict)

**What:** Component calls `getOrCreateObjectURL(file.id, file.sourceBlob)` on first render; revoke runs when the FileEntry is removed from `useFilesStore` OR superseded by an optimized Blob.

```typescript
// In a thumbnail component
const url = useRuntimeStore((s) => s.urlCache.get(file.id))
const getOrCreate = useRuntimeStore((s) => s.getOrCreateObjectURL)

// Lazy-create on first render
const resolvedUrl = url ?? getOrCreate(file.id, file.sourceBlob)
return <img src={resolvedUrl} alt={file.name} />
```

```typescript
// In useFilesStore.removeFile action
removeFile: (fileId) => {
  useRuntimeStore.getState().revokeObjectURL(fileId)
  set((s) => ({ byId: omit(s.byId, fileId), order: s.order.filter((id) => id !== fileId) }))
}

// In useFilesStore.markDone (when optimized Blob supersedes original)
markDone: (fileId, optimizedBlob) => {
  // The OLD url for fileId pointed to original Blob; revoke and let next render
  // lazy-create a fresh URL for the optimized Blob.
  useRuntimeStore.getState().revokeObjectURL(fileId)
  set((s) => ({
    byId: { ...s.byId, [fileId]: { ...s.byId[fileId], optimizedBlob, status: 'done' } },
  }))
}
```

**Race-condition mitigation:** `URL.revokeObjectURL` only invalidates *future* dereferences. An `<img>` already mid-load with the old URL completes successfully. Per MDN, the resource the URL points to remains valid until the document unloads if `<img>` started loading before revoke. Our pattern is therefore safe: revoke happens at eviction, not on every render.

`[CITED: developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static — revoke only invalidates future dereferences; in-progress loads complete]`
`[CITED: javascriptroom.com — recommended pattern is revoke on cleanup, NOT revoke immediately after createObjectURL]`

### Pattern 6: ARIA live-region quartile cadence (UI-SPEC §5)

**What:** A single App-root `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">` whose `textContent` is updated only at batch boundaries — not per-file.

```typescript
// src/lib/live-region.ts
let liveRegionEl: HTMLDivElement | null = null

export function setLiveRegion(el: HTMLDivElement | null) {
  liveRegionEl = el
}

export function announce(message: string) {
  if (!liveRegionEl) return
  // Clear → set in next tick to force re-announcement (some screen readers ignore
  // identical-text updates).
  liveRegionEl.textContent = ''
  requestAnimationFrame(() => {
    if (liveRegionEl) liveRegionEl.textContent = message
  })
}

// Subscribe inside useRuntimeStore action OR inside an App-root useEffect.
// Quartile cadence per UI-SPEC §5:
//   - On batch start: announce(`Optimizing ${total} files`)
//   - On Nth completion (N = max(1, floor(total/4))): announce(`${done} of ${total} complete`)
//   - On final completion: announce(`Batch complete. ${total} files optimized, ${savedHuman} saved.`)
```

`[CITED: sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions — polite cadence, one polite + one assertive region per page max]`
`[CITED: developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions — aria-live="polite" queues at next graceful pause]`

### Anti-Patterns to Avoid
- **`?worker` suffix.** `import MyWorker from './worker?worker'` works, but limits dynamic `import()` inside the worker — Vite docs warn this pattern doesn't bundle dynamically-imported worker chunks reliably. Use `new URL(..., import.meta.url)` exclusively.
- **Single shared Comlink proxy with worker-id routing.** Adds main-thread bookkeeping (which job is on which worker) for zero benefit; one proxy per worker is the canonical Squoosh-style pattern.
- **`combine` middleware for the three stores.** Adds type-inference complexity. Each store is its own `create()` — they can interop via `useFilesStore.getState()` at imperative call sites.
- **Storing ArrayBuffer in zustand state between calls.** Violates D-12; would also blow heap budget (a 50 MB Blob's ArrayBuffer = 50 MB resident).
- **Calling `URL.revokeObjectURL` inside a render.** Race with `<img>` load. Always revoke from action, useEffect cleanup, or store-eviction handler.
- **Per-file `aria-live` on file rows.** Floods screen readers in a 50-file batch. Per UI-SPEC §5, only the App-root region announces; rows use `aria-busy` toggles.
- **`setTimeout` polling for worker availability.** Dispatch is push-driven via `tryDispatch()` from both `enqueue()` and `runOnSlot.finally`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker RPC | Custom `postMessage` + correlation IDs | Comlink `wrap`/`expose`/`transfer` | Comlink handles correlation, error propagation, and `proxyMarker` for two-way callbacks. ~60 LOC saved per worker. |
| Promise-based queue | `setTimeout` polling | `tryDispatch()` push pattern (Pattern 2 above) | Push-driven dispatch is O(1) per enqueue/finish; no spurious wakeups. |
| Object URL lifecycle | Per-component `useEffect` revoke | Centralized `useRuntimeStore.urlCache` | Multiple components share a single FileEntry → multiple createObjectURL calls leak. Centralized cache de-dupes. |
| ARIA live-region throttling | Per-update `setTimeout` debounce | Quartile boundaries inside store actions | Throttling fights screen reader politeness; pre-batched boundaries are explicit and predictable. |
| Toast lifecycle | Custom toast queue | `sonner` (already locked in PROJECT.md §6) | Promise-based `toast.promise()`, a11y-correct, ~3KB gzip. |
| Cancel signal propagation | Bespoke event emitter | `AbortController` + `AbortSignal` | Standard browser API; integrates with `Promise.race` for the in-flight cancel pattern. |

**Key insight:** every load-bearing primitive in Phase 2 (RPC, queue, abort, store, toast) has a stable battle-tested library or browser API. The only bespoke code is the `WorkerPool` glue and the three store slices — and the WorkerPool is ~80 LOC.

## Runtime State Inventory

> Phase 2 is greenfield code; no rename or migration. This section is included to be explicit about what Phase 2 introduces (not what it migrates).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 2 introduces in-memory zustand stores only. Phase 7 wires IndexedDB. | None for Phase 2. |
| Live service config | None — zero-server architecture; no remote services. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — privacy-first, zero telemetry, no keys. | None. |
| Build artifacts | Phase 2 ADDS new entries: `dist/assets/worker-*.js` (worker bundle), `dist/assets/<adapter>-*.js` (lazy chunks). Vite emits these automatically. | Verify in `npm run build` output during Phase 2 verification. |

## Common Pitfalls

### Pitfall 1: Vite worker dynamic import path resolution

**What goes wrong:** `await import('@jsquash/svgo')` inside `worker.ts` works in dev but produces a runtime 404 in production build because Vite splits worker chunks into a separate output directory.
**Why it happens:** Vite 7's worker bundler treats workers as independent build entries. Path aliases (`@/`) and absolute paths usually work, but template-literal dynamic imports (`import(\`./adapters/${name}.ts\`)`) require the variable substitution to resolve to a literal at build time so Vite can statically detect the dependency graph.
**How to avoid:** Use a switch statement or a static map: `const adapters = { stub: () => import('./stub-adapter.ts'), svg: () => import('./svg-adapter.ts') }`. This is the Vite-blessed idiom for "dynamic module that the bundler still understands."
**Warning signs:** Build succeeds but worker logs `Failed to fetch dynamically imported module` at runtime.

`[CITED: github.com/vitejs/vite/issues/5979 — worker code is not bundled when only using new URL pattern WITHOUT { type: 'module' }; both halves of the idiom are required]`

### Pitfall 2: Comlink ArrayBuffer detached after transfer

**What goes wrong:** Code reads `input` after passing it to `Comlink.transfer(input, [input])` — gets a detached ArrayBuffer error.
**Why it happens:** Transferable semantics: ownership moves to the worker. The original ArrayBuffer in the main thread is empty (`byteLength === 0`).
**How to avoid:** Discipline in `runOnSlot`: don't read `input` after the await on the proxy call. Per D-12, we don't store it anyway. Tests should assert this by deliberately reading `input.byteLength` after the proxy call and expecting `0`.
**Warning signs:** Random failures only on second optimize; or `RangeError: Cannot use ArrayBuffer that has been detached`.

`[CITED: comlink README — "once transferables have been transferred they become unusable in the original thread"]`

### Pitfall 3: Object URL leak on re-optimize

**What goes wrong:** User re-runs Optimize on a file that already has an optimized Blob. The old optimized URL is never revoked; a new one is created on next render.
**Why it happens:** D-10 says "revoke on supersede" but components can't know "this Blob is being replaced" without store cooperation.
**How to avoid:** `useFilesStore.markDone(fileId, newBlob)` MUST call `useRuntimeStore.getState().revokeObjectURL(fileId)` BEFORE writing the new Blob. The next render lazy-creates a URL for the new Blob.
**Warning signs:** DevTools Memory snapshot shows growing object URL count after repeated re-optimize cycles. The Phase 4 success criterion `revoked-count === created-count` is a direct test for this.

### Pitfall 4: Cancel leaves zustand in inconsistent state

**What goes wrong:** Cancel fires; in-flight job promise never resolves; `inFlight` set still contains the job ID; UI shows perpetual "running."
**Why it happens:** `worker.terminate()` discards the postMessage channel — the Comlink-wrapped Promise pends forever. Without an explicit reject path, `markDone`/`markError` never fires.
**How to avoid:** Wrap each `runOnSlot` proxy call in `Promise.race([proxyCall, abortPromise])` where `abortPromise` rejects when the batch is cancelled. On cancel: `set({ running: false, inFlight: new Set(), queue: [], doneCount: 0, totalJobs: 0 })` — clear state explicitly, do NOT rely on per-job rejections to do it.
**Warning signs:** Workers pill stuck on `2/4 busy` after Cancel. Re-running Optimize creates a second batch overlapping the ghost first.

### Pitfall 5: Screen reader flooding from per-file announcements

**What goes wrong:** Every `markDone` call updates `aria-live` polite region. A 50-file batch produces 50 announcements; screen reader queues them all. User's session is hijacked for ~3 minutes.
**Why it happens:** `aria-live="polite"` queues — it doesn't replace.
**How to avoid:** Quartile cadence per UI-SPEC §5: announce on `start`, on every `floor(total/4)`th completion, on final, on error, on cancel. Skip per-file announcements entirely. Per-row `aria-busy` toggles handle row-level AT awareness without speech.
**Warning signs:** Manual VoiceOver/NVDA test in a 12-file batch announces 12+ progress updates instead of 4–5.

### Pitfall 6: `hardwareConcurrency` is 0 or undefined on rare browsers

**What goes wrong:** `Math.min(navigator.hardwareConcurrency, 4)` yields 0 or NaN; pool spawns no workers; jobs queue forever.
**Why it happens:** Privacy-conscious browsers (Tor, some mobile) clamp `hardwareConcurrency` to 2 or 0; some older runtimes return undefined.
**How to avoid:** Defensive default: `Math.min(navigator.hardwareConcurrency || 2, 4)`. Lower bound at 2, upper bound at 4. Verify `navigator.hardwareConcurrency` is truthy before using.
**Warning signs:** No jobs ever start; status pill stuck on `0 idle`.

## Code Examples

### Stub adapter (Phase 2 acceptance gate)
```typescript
// src/workers/stub-adapter.ts
// Phase 2 only — round-trips bytes unchanged to validate the worker pipeline.
// Phase 3+ replaces this contract with svg-adapter.ts, png-adapter.ts, etc.

export interface AdapterMeta { unchanged?: boolean }

export async function run(
  input: ArrayBuffer,
  _settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  // Copy the bytes — DON'T return the same ArrayBuffer because Comlink.transfer
  // on the way back will detach the input we just received. Allocate fresh.
  const output = input.slice(0)
  return { output, meta: { unchanged: true } }
}
```

`[CITED: comlink README — Comlink.transfer semantics; copying via .slice(0) avoids the detach hazard]`

### Vite config additions (none required)
```typescript
// vite.config.ts — UNCHANGED for Phase 2.
// Vite 7 handles `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`
// out of the box. Worker chunks output to `dist/assets/worker-<hash>.js` automatically.
// Only add `worker: { format: 'es' }` if a build issue surfaces; default already 'es' in Vite 7.
```

### Synthetic load fixture for memory budget tests
```typescript
// src/tests/fixtures/synthetic.ts
// Generate deterministic large Blobs without allocating 50×50MB upfront.

export function makeSyntheticBlob(sizeBytes: number, seed: number): Blob {
  // Use Uint8Array.fill — single allocation, deterministic content.
  const arr = new Uint8Array(sizeBytes)
  // Cheap deterministic pattern (no randomness needed for stub round-trip).
  for (let i = 0; i < arr.length; i += 1024) arr[i] = (seed + i) & 0xff
  return new Blob([arr], { type: 'application/octet-stream' })
}

export function makeSyntheticBatch(count: number, sizeBytes: number): Blob[] {
  return Array.from({ length: count }, (_, i) => makeSyntheticBlob(sizeBytes, i))
}

// Usage in Playwright: page.evaluate to create the batch in the page context;
// then assert pool stats during processing.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@squoosh/lib` worker pool (vendored from Google's Squoosh) | jSquash-style per-codec lazy import inside worker | 2023 (Squoosh archived) | Phase 2's pool design is a faithful port of Squoosh's `inspired/squoosh/src/lib/codec-pool.ts` minus the codec-specific concerns. |
| Workers as classic scripts | Workers as ES modules (`{ type: 'module' }`) | Browser support reached 100% in 2023 | Allows top-level `import` and dynamic `import()` inside worker — required for PERF-02 codec lazy-loading. |
| zustand 4 with `combine` middleware | zustand 5 with sliced `subscribeWithSelector` | zustand 5 GA (March 2025+) | TypeScript inference is significantly better for sliced stores; `combine` is no longer recommended in v5 for multi-slice apps. |
| `URL.revokeObjectURL` immediately after `<img>.onload` | Centralized cache, revoke on eviction or supersede | Established React pattern for shared blob refs | Avoids double-revoke and double-create when multiple components render the same FileEntry. |
| Per-row `aria-live="polite"` | Single App-root region with quartile cadence | WCAG 2.2 + a11y consensus 2024+ | Eliminates screen reader flooding in batch operations. |

**Deprecated/outdated:**
- **`@squoosh/lib`**: archived 2023. Phase 2 borrows orchestration patterns; codec deps are jSquash (Phase 3+).
- **zustand `combine` middleware for multi-slice apps**: works but TypeScript inference fights you. Use independent `create()` calls.
- **`?worker` suffix import** for workers that need dynamic imports: subtly broken in Vite 7. Use `new URL` exclusively.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended file layout `src/workers/`, `src/stores/`, `src/lib/` | §Architecture: Project Structure | Low — purely conventional; planner can choose other layout |
| A2 | `WorkerPool` class chosen over `useWorkerPool` hook | §Standard Stack: Alternatives | Medium — if a hook form proves more idiomatic for SSR (not relevant here) or for testability, the planner can switch. The pool's lifecycle is app-singleton either way. |
| A3 | `urlCache` keyed by `FileEntry.id` (string), not by Blob identity | §Pattern 5 | Low — Blob identity as Map key works but breaks D-10's "revoke on supersede" because the new optimized Blob has a different identity than the original; ID-keyed cache lets us atomically swap. |
| A4 | `Promise.race` + `AbortSignal` is the cancel observability pattern | §Pattern 3 | Medium — comlink doesn't expose a built-in cancel hook; this is the established workaround. Verified in Comlink GitHub issue threads. Validate with the cancel correctness test (Validation §3). |
| A5 | Static-map dynamic import (`{ stub: () => import('./stub-adapter') }`) is the Vite-7-correct way to lazy-load adapter modules inside a worker | §Pitfall 1 | Medium — alternative is a switch statement with literal import paths. Both work; static map is cleaner. If Vite issues block, switch wins. |
| A6 | `navigator.hardwareConcurrency || 2` defensive default | §Pitfall 6 | Low — fallback is 2, which is conservative and always-runnable. |
| A7 | Synthetic 50MB×50-file fixtures are sufficient for Phase 2 harness validation (real raster validation defers to Phase 4) | §Code Examples + §Validation | Low — explicitly stated in CONTEXT.md §specifics. |

**These claims need user confirmation before becoming locked decisions** — surface them in the planning conversation.

## Open Questions

1. **Should the pool spawn workers eagerly at app start or lazily on first `enqueue`?**
   - What we know: D-01 says either is acceptable ("planner's discretion").
   - What's unclear: Eager spawn pays N×worker-init cost on app load; lazy pays it on first Optimize click (visible UX latency).
   - Recommendation: **lazy** — defer the N spawns to first click. Each spawn is fast (<10ms in Chromium for an empty ES-module worker). Eager spawn would inflate initial JS budget if the worker imports anything synchronously at top-level.

2. **Single error type or taxonomy?**
   - What we know: D-discretionary; CONTEXT.md lists `AdapterError` vs `CancelError`/`DecodeError`/`EncodeError` as alternatives.
   - What's unclear: Phase 2 only needs to surface "stub adapter failed" (synthetic) and "cancel" (DOMException AbortError). Phase 5 will need decode-vs-encode discrimination for retry logic.
   - Recommendation: **start with one `AdapterError`** + the standard `DOMException` for AbortError. Phase 5 can subclass when it needs to.

3. **Where does `mock.ts` deletion happen — beginning of Phase 2 or end?**
   - What we know: `src/data/mock.ts` is "deleted in Phase 2" per Phase 1's plan-03 header comment.
   - What's unclear: It's load-bearing for the current shell.spec.ts tests (12-file MOCK_FILES count). Deleting it before stores are wired would break tests.
   - Recommendation: **delete in the LAST plan of Phase 2**, after stores are seeded with real (or fixture-generated) FileEntry data and tests are updated to assert on store-driven counts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev/build | ✓ | (assumed — Phase 1 already runs) | — |
| npm | install comlink/zustand/sonner | ✓ | (assumed — package.json works) | — |
| Chromium (Playwright) | worker tests | ✓ | (Phase 1 confirmed via `npx playwright test`) | — |
| `navigator.hardwareConcurrency` | pool sizing | ✓ at runtime (browser API) | — | Defensive default of 2 (Pitfall 6) |
| Web Worker `{ type: 'module' }` | worker bootstrap | ✓ in all target browsers (last-2 stable) | — | None — required, not optional |
| `crossOriginIsolated` | future SAB threading | ✓ (Phase 1 D-03 verified) | — | Soft-fail in v1 (no SAB until Phase 5) |

**Missing dependencies with no fallback:** none — Phase 1 verified the toolchain end-to-end.

**Missing dependencies with fallback:** none currently; Pitfall 6 is the one runtime-availability gap and has a defensive default.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `^1.59.1` (already installed; `@playwright/test`) |
| Config file | `playwright.config.ts` (existing — runs against dev server at :5173) |
| Quick run command | `npx playwright test src/tests/worker-pool.spec.ts` |
| Full suite command | `npx playwright test` |
| Bundle size check | `npm run test:bundle` (`src/tests/build.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PERF-01 | Stub adapter round-trip via worker pipeline; user drops file → Optimize → file row shows `done` with `0 bytes saved` | Playwright e2e | `npx playwright test src/tests/worker-pool.spec.ts -g "stub round-trip"` | ❌ Wave 0 |
| PERF-01 | Concurrency cap: enqueue N+1 jobs, assert only N workers run simultaneously | Playwright + page.evaluate | `npx playwright test src/tests/worker-pool.spec.ts -g "concurrency cap"` | ❌ Wave 0 |
| PERF-02 | Adapter module is dynamically imported inside worker on first job (network tab shows the chunk fetch) | Playwright + network monitoring | `npx playwright test src/tests/worker-pool.spec.ts -g "lazy load"` | ❌ Wave 0 |
| PERF-03 | ARIA live region announces start, quartile, end at the correct cadences (no per-file flooding) | Playwright + role=status assertion | `npx playwright test src/tests/aria-live.spec.ts` | ❌ Wave 0 |
| PERF-03 | Optimize button transitions through `Optimize all` → `Optimizing…` → `Optimize all` (disabled while running) | Playwright | `npx playwright test src/tests/shell.spec.ts -g "optimize button"` | ⚠️ extends existing |
| D-02 | Cancel mid-flight: terminate kills in-flight; `running` becomes false within 100ms; no late `markDone` arrivals | Playwright + slow stub adapter | `npx playwright test src/tests/worker-pool.spec.ts -g "cancel correctness"` | ❌ Wave 0 |
| D-10 | Object URL leak test: `revoked-count === created-count` after a 12-file batch with re-optimize | Playwright + counter instrumentation | `npx playwright test src/tests/object-url.spec.ts` | ❌ Wave 0 |
| ARIA preservation | Phase 1 11 tests still pass (queue listbox, inspector tablist, theme round-trip, Cmd+K, etc.) | Playwright | `npx playwright test src/tests/shell.spec.ts` | ✅ |

### Validation Requirements (proposed VALIDATION.md entries)

These are concrete, testable assertions the planner should turn into Wave 0 test scaffolds:

- **VR-01 — Stub round-trip end-to-end.** A synthetic 1KB Blob enqueued via the user-facing Optimize button completes in < 500ms with `optimizedSize === originalSize`, status `done`, and `0 bytes saved` in the file-stat row.
- **VR-02 — Concurrency cap enforced.** Enqueue `min(hwConc, 4) + 1` jobs against a slow stub adapter (resolves after 200ms). Assert `useRuntimeStore.getState().inFlight.size <= min(hwConc, 4)` continuously throughout the batch via `page.evaluate` polling.
- **VR-03 — Cancel kills in-flight.** Enqueue 4 jobs against a stub that resolves after 1000ms. After 50ms, trigger Cancel (Cmd+. or palette). Within 200ms, assert `running === false`, `inFlight.size === 0`, and no `markDone` actions fired in the next 2000ms (instrument with a counter).
- **VR-04 — Object URL leak-free.** Run a 12-file batch with re-optimize on each file (so each gets supersede). Instrument `URL.createObjectURL` and `URL.revokeObjectURL` with monkey-patched counters; assert created-count === revoked-count + still-rendered-count after batch.
- **VR-05 — ARIA quartile cadence.** Run a 12-file batch (quartile = 3). Assert the `[role=status]` region's `textContent` is updated exactly 5 times: once on start, three times on Nth-completions (3, 6, 9), once on final. No per-file announcements.
- **VR-06 — Phase 1 ARIA contract preserved.** All 11 existing `shell.spec.ts` tests pass after store migration. Specifically: queue `role=listbox`, inspector `role=tablist`, compare `role=slider` semantics unchanged.
- **VR-07 — Bundle size budget unbroken.** `npm run test:bundle` still reports < 200KB gzipped for the initial route. Worker chunks ship as separate assets; lazy adapter chunks (just `stub-adapter` in Phase 2) are NOT in the initial bundle.

### Sampling Rate
- **Per task commit:** `npx playwright test src/tests/worker-pool.spec.ts` (the focused new file)
- **Per wave merge:** full suite `npx playwright test` + `npm run test:bundle`
- **Phase gate:** Full suite green + manual DevTools Performance check (concurrency visible in worker timeline) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/tests/worker-pool.spec.ts` — covers VR-01..VR-03
- [ ] `src/tests/object-url.spec.ts` — covers VR-04
- [ ] `src/tests/aria-live.spec.ts` — covers VR-05
- [ ] `src/tests/fixtures/synthetic.ts` — synthetic blob batch generator (VR-01..VR-04)
- [ ] `src/tests/fixtures/instrument-blob-urls.ts` — monkey-patch helper for VR-04
- [ ] `src/tests/shell.spec.ts` extension — Optimize button state transitions (additive to existing 11 tests)

### Manual Validation
A DevTools-based check that complements the automated suite:
- Open Performance tab, record a 50-file batch with synthetic blobs.
- Verify worker timeline shows exactly `min(hwConc, 4)` parallel tracks during the run.
- Confirm main thread is not blocked > 50ms continuously (yields to UI render).
- This is the empirical complement to ROADMAP Phase 2 Success Criterion 4 ("simultaneous jobs never exceed cap, visible in DevTools Performance tab").

## Sources

### Primary (HIGH confidence)
- npm registry live `[VERIFIED 2026-04-30]`: comlink@4.4.2 (2024-11-07), zustand@5.0.12 (2026-03-16), sonner@2.0.7 (2025-08-02)
- [GoogleChromeLabs/comlink README](https://github.com/GoogleChromeLabs/comlink) — `wrap`, `expose`, `transfer`, transferables semantics
- [vite.dev/guide/features#web-workers](https://vite.dev/guide/features) — canonical `new URL(..., import.meta.url)` + `{ type: 'module' }` idiom
- [pmndrs/zustand README](https://github.com/pmndrs/zustand) — sliced stores, `subscribeWithSelector` middleware, `create<T>()` curried form
- [MDN URL.revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static) — revoke timing semantics; in-progress loads complete after revoke
- [MDN ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) — polite vs assertive, queue behavior

### Secondary (MEDIUM confidence — verified against authoritative source)
- [vitejs/vite#5979](https://github.com/vitejs/vite/issues/5979) — worker not bundled when `new URL` is missing `{ type: 'module' }`
- [vitejs/vite#11823](https://github.com/vitejs/vite/issues/11823) — TypeScript worker scripts inlined as data: URI when path resolution fails
- [Sara Soueidan — Accessible Notifications with ARIA Live Regions](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/) — cadence guidance, one polite + one assertive per page
- [The A11Y Collective — ARIA Live Regions guide](https://www.a11y-collective.com/blog/aria-live/) — patterns for batching updates
- [LogRocket — Comlink and web workers](https://blog.logrocket.com/comlink-web-workers-match-made-in-heaven/) — transferables and proxy idioms
- [JavaScriptRoom — When is it Safe to Call URL.revokeObjectURL](https://www.javascriptroom.com/blog/when-is-it-safe-to-call-url-revokeobjecturl/) — eviction-time revoke pattern

### Tertiary (LOW confidence — pattern, not literal)
- Squoosh `inspired/squoosh/src/lib/codec-pool.ts` (referenced in PROJECT.md §9) — Phase 2 pool design is a faithful port minus codec-specifics. Not opened in this research session; pattern conformity assumed from PROJECT.md attestation.

## Metadata

**Confidence breakdown:**
- Standard stack versions: HIGH — verified live against npm registry on 2026-04-30
- Worker bootstrap idiom: HIGH — Vite docs + multiple GitHub issues converge on the same canonical form
- Comlink transferable semantics: HIGH — README + extensive blog corroboration
- zustand v5 sliced pattern: HIGH — official discussions on the pmndrs repo confirm v5 idioms
- Pool topology specifics (cancel via terminate-and-respawn, FIFO queue): MEDIUM — patterns are bespoke composition, not a single library API; validated against multiple worker-pool blog posts and the Comlink issue tracker
- Object URL lifecycle: MEDIUM — D-10's recommendation matches MDN guidance; the urlCache-keyed-by-id choice is discretionary
- ARIA quartile cadence: MEDIUM — UI-SPEC §5 prescribes the cadence; aligned with WAI-ARIA/MDN guidance on polite-region usage
- Cancel correctness via Promise.race + AbortSignal: MEDIUM — established workaround for Comlink's lack of native cancel; needs validation via VR-03

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — comlink and zustand are stable; Vite 7 is locked)
