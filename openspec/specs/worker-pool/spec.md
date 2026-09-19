# Worker Pool Spec

## Purpose
Keep encoding and metrics work off the main thread and cap concurrent jobs so a large batch doesn't overwhelm the machine. A single Comlink-wrapped codec worker is exposed through a bounded pool singleton that all hooks share, with a live backpressure indicator visible in the shell.

## Requirements

### Requirement: Comlink-wrapped codec worker
The system SHALL run all codec encode/decode work in `src/workers/codec.worker.ts`, exposed to the main thread via `Comlink.expose`. The worker is constructed with `new Worker(new URL('../workers/codec.worker.ts', import.meta.url), {type:'module'})` using a literal URL string so Vite's static analysis can bundle it.

#### Scenario: Encode on a large image
- **WHEN** the user runs Optimize on a multi-megabyte file
- **THEN** the main-thread UI stays interactive (scrolling and clicks respond) while the encode runs

### Requirement: Bounded pool singleton
The system SHALL provide a `WorkerPool` singleton accessed through `getPool()` in `src/lib/worker-pool.ts`. The pool SHALL cap concurrent jobs at `min(navigator.hardwareConcurrency, 4)` and queue excess jobs FIFO.

#### Scenario: User optimizes 20 files on a 4-core machine
- **WHEN** the user clicks Optimize All on a 20-file batch
- **THEN** at any instant no more than `min(hwConcurrency, 4)` files are actively encoding; the rest are queued

### Requirement: Zero-copy buffer transfer
The system SHALL move `ArrayBuffer` payloads to and from the worker via `Comlink.transfer(result, [buffer])` so pixel data is not copied.

#### Scenario: Multiple parallel RPCs against the same source buffer
- **WHEN** a call site dispatches multiple worker RPCs that each consume the same source ArrayBuffer
- **THEN** the site calls `.slice(0)` on the buffer once per RPC before dispatch (Comlink transfer detaches the buffer, so each RPC needs its own independent slice)

### Requirement: Per-file error isolation
The system SHALL reject only the offending job's promise on a worker-side failure. The batch MUST NOT abort on a single failure; the caller SHALL translate the rejection into `setFileError(id, message)` and a toast.

#### Scenario: A malformed file mid-batch
- **WHEN** one of 20 batched files throws inside the worker
- **THEN** that file's status becomes `error`; the remaining 19 continue and finish to `done`

### Requirement: Backpressure indicator
The system SHALL surface the pool's live running and queued job counts through `runtimeAtom` (populated via `WorkerPool.onCountChange`) and render a `BackpressureIndicator` in the app shell that reflects the pool's real state.

#### Scenario: Optimize All on a large batch
- **WHEN** the user starts a 20-file batch
- **THEN** the indicator shows a running count that peaks at the concurrency cap and a queued count that drains to zero as jobs complete

### Requirement: COOP/COEP for `crossOriginIsolated`
The system SHALL be served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so `self.crossOriginIsolated === true`. This is required for `SharedArrayBuffer`, which OxiPNG's multithreaded build depends on. The dev server (Vite) sets these headers; production sets them via Cloudflare Pages `public/_headers`.

#### Scenario: Boot in dev or prod
- **WHEN** the app loads
- **THEN** `self.crossOriginIsolated` is `true` and the diagnostics capability's capability probe reports "WASM threads on"

### Requirement: Sibling metrics worker
The system SHALL run quality-metric work in a separate `src/workers/metrics.worker.ts` module, accessed via a distinct `src/lib/metrics-worker.ts` singleton. Metrics dispatches MUST NOT block the codec pool.

### Requirement: Codec/metrics WASM stays dynamic (PIPE-02)
The system SHALL keep every codec and metric WASM import inside the async function body of its worker `switch` branch. Codec imports MUST NOT be hoisted to a worker file's top. A build-time grep on hoist sentinels (`bezkrovny` for SSIM, `VisDiff` for visdif, etc.) fails the build on regression.

## Non-goals

- User-configurable concurrency cap (the cap is derived from hardware, not a preference).
- Multiple codec worker pools (one shared codec pool + one shared metrics pool; that is all).
- Auto-cancellation of the whole batch on any file's failure (per-file isolation is the deliberate discipline).
- Restart-worker-on-failure supervision (each job's failure rejects only its own promise; the worker stays up).
- Callback-swap-across-remount hardening for `getWorkerPool(callbacks)` — the singleton binds callbacks only on first construction; documented fragile area, not fixed.
