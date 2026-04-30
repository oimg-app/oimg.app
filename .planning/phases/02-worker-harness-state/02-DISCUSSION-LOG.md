# Phase 2: Worker Harness + State - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 02-worker-harness-state
**Areas discussed:** Worker pool topology, Adapter contract shape, State store organization, Memory model rules

---

## Worker Pool Topology

### Pool Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Warm pool | Spawn `min(hardwareConcurrency, 4)` workers once at app start (or first job). Workers stay alive for the session. Lower per-job latency, slightly higher idle memory. Matches Squoosh. Workers lazy-import codec modules on first use (PERF-02 still satisfied). | ✓ |
| Spawn-on-demand | Worker per job, terminate when done. Zero idle cost, ~50–100ms spawn latency per file (Squoosh-verified) makes large batches noticeably slower. Worker bootstrap repeats per file. | |
| Hybrid | Warm pool of 1; scale to `min(hardwareConcurrency, 4)` on demand; idle workers terminate after N seconds. Harder to reason about cancellation; defer to v2 if profiling demands. | |

**User's choice:** Warm pool (Recommended)
**Notes:** Codec modules lazy-imported per-worker on first use to keep PERF-02 honored.

### Cancellation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Terminate worker, respawn fresh | Hard-stop in-flight jobs via `worker.terminate()`. Pool replaces with fresh worker (~50ms cost). Codec WASM state discarded with worker — no leak risk. Simple. | ✓ |
| Cooperative cancel token | Adapter checks token between stages and throws CancelError. No respawn cost, but every adapter must cooperate; codec WASM calls are synchronous and won't check tokens mid-encode. | |
| Both | Cooperative for graceful drain; terminate for hard cancel. More API surface, more edge cases. Defer to v2. | |

**User's choice:** Terminate worker, respawn fresh (Recommended)

---

## Adapter Contract Shape

### I/O Signature

| Option | Description | Selected |
|--------|-------------|----------|
| ArrayBuffer in, ArrayBuffer out | `(input: ArrayBuffer, settings) => Promise<{ output: ArrayBuffer, meta }>`. Adapter owns decode/process/encode. Maximum flexibility. Stub adapter is one line. | ✓ |
| Pre-decoded ImageData in, ArrayBuffer out | Pipeline decodes rasters before adapter. Less duplication across raster adapters; SVG vs raster need union signature. Couples pipeline to decoder choice. | |
| Streaming chunks | Adapter receives ReadableStream. Useful for huge files; jSquash + SVGO are not stream-based — defer to v2. | |

**User's choice:** ArrayBuffer in, ArrayBuffer out (Recommended)

### Progress Reporting

| Option | Description | Selected |
|--------|-------------|----------|
| Two states: started + done | `started` + `done`/`error` only. Spinner UI; toolbar shows `done/total` counter. Honest — jSquash/SVGO are sync WASM, no real per-stage progress. | ✓ |
| Multi-stage events | `decoding` → `optimizing` → `encoding` → `done`. Useful UX cue but every adapter must split work; stub has no real stages. | |
| Percentage callback | `onProgress(0–100)`. Honest only for codecs that expose progress (oxipng yes; webp/jpeg no). Most adapters would fake — worst-case UX. | |

**User's choice:** Two states: started + done (Recommended)

---

## State Store Organization

### Store Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sliced stores | `useFilesStore` (queue + per-file results), `useSettingsStore` (codec configs + global), `useRuntimeStore` (worker pool stats, busy count, cancel signal). Lower re-render churn. | ✓ |
| Single store with selectors | One `useAppStore` containing all slices. Simpler imports; every component must use selector + shallow comparator — easy to forget. Squoosh-style monolith. | |
| Per-file atomic stores | One zustand store per FileEntry indexed by id. Surgical re-renders but unusual; harder batch ops. Defer to v2 if profiling demands. | |

**User's choice:** Sliced stores (Recommended)

### Queue Location

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime store owns queue | Files store = canonical FileEntry data; runtime store = ephemeral queue + worker assignments + cancel signal. Persistent vs ephemeral boundary is clear for Phase 7 IndexedDB. | ✓ |
| Files store owns queue position | Each FileEntry carries queue position + worker assignment. Simpler model but persistence layer needs explicit allowlist. | |

**User's choice:** Runtime store owns the queue (Recommended)

---

## Memory Model Rules

### Object URL Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy create + revoke-on-eviction | URL not created at upload. Created when component first renders (thumbnail, compare slider). Revoked on row removal OR when optimized result supersedes original. Files store holds Blob; URL is a derived render-time artifact in runtime store. Aligns with PRIV-04. | ✓ |
| Eager create + revoke-on-remove | URL created at upload alongside FileEntry. Stored in files store. Simpler render code, but every uploaded file holds a URL even if never previewed. | |
| No object URLs — render via FileReader | Every render re-reads Blob via FileReader. Zero leak risk; unacceptable for 60fps compare-slider drag. Reject. | |

**User's choice:** Lazy create + revoke-on-eviction (Recommended)

### Streaming Concurrency Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Cap = worker count | At most `min(hardwareConcurrency, 4)` files in flight. Inputs for queued files NOT loaded into memory until a worker is free. Bounds peak heap regardless of batch size. | ✓ |
| Higher cap (e.g. 2× workers) | Pre-load next N inputs while workers are busy. Better throughput, higher peak memory. Phase 4 50-file AVIF batches risk OOM on lower-end machines. | |
| No cap — load everything upfront | All uploaded Blobs in memory simultaneously. Fine for small batches; OOM risk for large batches with 30+ MB raster sources. Reject — violates Phase 4 success criterion 2. | |

**User's choice:** Yes — cap = worker count (Recommended)

---

## Claude's Discretion

- Comlink wiring style (proxy-per-worker vs single shared proxy with worker-id routing)
- WorkerPool class vs `useWorkerPool` hook (orchestrator pattern is the goal; expression open)
- Slice file layout under `src/stores/` (single index vs per-slice files)
- `useRuntimeStore.urlCache` data structure (Map keyed by Blob identity vs Record keyed by FileEntry.id)
- Stub adapter location (`src/adapters/stub.ts` vs `src/workers/stub-adapter.ts`)
- Error type taxonomy (single `AdapterError` vs `CancelError`/`DecodeError`/`EncodeError`)

## Deferred Ideas

- Cooperative cancel tokens — v2 if a codec gains streaming/incremental cancellation
- Hybrid auto-scale worker pool with idle terminate — v2; profile first
- Streaming chunked adapters — v2; current codec ecosystem is non-streaming
- Per-file atomic zustand stores — v2 if profiling shows hotspots
- Persist worker queue across reloads — Phase 7 owns persistence; v1 queue is ephemeral
- Multi-stage progress events — Phase 5 reconsideration if a specific raster encoder benefits
