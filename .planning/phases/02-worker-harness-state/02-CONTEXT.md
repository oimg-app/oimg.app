# Phase 2: Worker Harness + State - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the generic worker pipeline that processes files in parallel with bounded memory, plus the zustand state stores that drive UI from worker progress. Validate end-to-end with a stub adapter that round-trips bytes unchanged. Phase 3 (SVG) and Phase 5 (raster encoders) plug their codec-specific logic into the adapter contract this phase defines — no codec WASM lands in Phase 2.

The static shell from Phase 1 (App.tsx + shell components) becomes wired: uploads enqueue real jobs, the queue is persisted in stores, the toolbar Optimize button drives real workers, and progress + cancel work end-to-end against the stub adapter.

</domain>

<decisions>
## Implementation Decisions

### Worker Pool Topology
- **D-01:** **Warm pool**, sized to `min(navigator.hardwareConcurrency, 4)`. Workers spawn lazily on first job (or app start, planner's discretion) and persist for the session. Per-worker codec modules are lazy-imported on first use inside the worker — preserves PERF-02 without paying spawn latency on every job.
- **D-02:** **Cancellation = `worker.terminate()` + respawn fresh worker.** Hard-stop in-flight jobs by terminating the worker; pool replaces the terminated worker with a fresh one. No cooperative cancel token in v1 — adapter implementations don't have to participate in cancel logic. Codec WASM state is discarded with the terminated worker, eliminating leak risk.
- **D-03:** **Queue scheduler = FIFO.** Jobs added to a queue; idle workers pull from the head. New uploads append to the back. No priority hints in v1 (Claude's discretion to revisit if needed in v2).

### Adapter Contract Shape
- **D-04:** **I/O signature: `(input: ArrayBuffer, settings: TSettings) => Promise<{ output: ArrayBuffer, meta: AdapterMeta }>`.** Bytes in, bytes out. Adapter owns its own decode → process → encode internally. Stub adapter is a one-liner that returns the input as output with `meta: { unchanged: true }`.
- **D-05:** **Adapter owns decoding.** Pipeline does not pre-decode rasters to ImageData. SVG adapter receives SVG bytes; PNG adapter receives PNG bytes and runs `@jsquash/png` decode internally. Keeps the contract uniform across SVG (text) and raster (binary).
- **D-06:** **Progress reporting = two states only: `started` + `done` (or `error`).** No multi-stage events, no percentage callbacks. jSquash and SVGO are synchronous WASM calls; mid-encode percentage is fiction. UI uses spinner + counter (`done / total`) to satisfy PERF-03.

### State Store Organization
- **D-07:** **Three sliced zustand stores:**
  - `useFilesStore` — canonical FileEntry data (id, name, format, status, originalSize, optimizedSize, source Blob, optimized Blob, sourceDensity). Persistent in spirit (Phase 7 wires IndexedDB).
  - `useSettingsStore` — codec configs (per-format) + global settings + presets. Persistent in spirit.
  - `useRuntimeStore` — ephemeral runtime state: queue position, busy worker count, in-flight job IDs, cancel signal, derived object URLs. Always in-memory only.
- **D-08:** **Worker queue lives in `useRuntimeStore`.** FileEntry data and queue position are decoupled — files store stays clean for persistence, runtime store evaporates on reload.
- **D-09:** Components subscribe via narrow selectors (e.g. `useFilesStore(s => s.byId[id])`). Phase 2 sets the convention; Phase 5 panel migrations follow it. Claude's discretion on slice file layout (one file per store vs combined `stores/index.ts`).

### Memory Model
- **D-10:** **Object URL lifecycle: lazy-create on first render need; revoke on eviction.**
  - URLs are NOT created at upload time.
  - First component to render a Blob (thumbnail, compare slider) calls `createObjectURL`; the URL is cached in `useRuntimeStore.urlCache` keyed by Blob identity.
  - URL is revoked when (a) the FileEntry is removed from the queue, OR (b) a new optimized Blob supersedes the original (the new Blob gets its own lazy URL on next render).
  - PRIV-04 is honored — no thumbnail data persisted.
- **D-11:** **Streaming concurrency cap = worker count.** At most `min(hardwareConcurrency, 4)` files in flight at once — same as worker count. Queued FileEntries hold a Blob reference but their input bytes do NOT preload into memory until a worker is free to take them. This bounds peak heap regardless of batch size and is the precondition for Phase 4 success criterion 2 (50-file batch under 800 MB).
- **D-12:** **Blob-only state.** No `ArrayBuffer` or `ImageData` lives in any store between worker calls. Adapter inputs are derived from `await blob.arrayBuffer()` immediately before postMessage and discarded after. Adapter outputs are wrapped in `new Blob([output])` immediately on the main thread before being stored.

### Claude's Discretion
- Comlink wiring style (proxy-per-worker vs single shared proxy with worker-id routing)
- Whether to ship a separate `WorkerPool` class vs a `useWorkerPool` hook (orchestrator pattern is the goal; expression is open)
- Exact slice file layout under `src/stores/` (single index vs per-slice files)
- Whether `useRuntimeStore.urlCache` is a Map keyed by Blob identity (WeakMap impossible — Blobs aren't weakly referenceable as keys directly) or a Record keyed by FileEntry.id
- Stub adapter location: `src/adapters/stub.ts` vs `src/workers/stub-adapter.ts` (planner picks based on the worker module layout it chooses)
- Exact error type taxonomy (one `AdapterError` vs `CancelError`/`DecodeError`/`EncodeError`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Source of Truth
- `.planning/PROJECT.md` — Tech stack constraints, locked decisions (comlink ^4.4, zustand ^5.0), Phase 4 memory-model warning, Privacy invariants
- `.planning/REQUIREMENTS.md` §Performance — PERF-01 (worker pool), PERF-02 (lazy-load codecs), PERF-03 (progress UI). PRIV-04 (no thumbnail cache) constrains memory model.
- `.planning/ROADMAP.md` §Phase 2 — Goal, success criteria including `min(hardwareConcurrency, 4)` cap and stub-adapter round-trip
- `.planning/ROADMAP.md` §Phase 4 — Downstream success criteria (50-file batch < 800 MB, no objectURL leaks) that Phase 2 memory model must enable

### Phase 1 Foundation
- `.planning/phases/01-shell-foundation/01-CONTEXT.md` — Locked design decisions including hand-rolled UI primitives (D-06) and crossOriginIsolated mandate (D-03)
- `.planning/phases/01-shell-foundation/01-04-SUMMARY.md` — Shell decomposition; App.tsx is now the composition root with ~25 useState hooks ready to migrate to zustand
- `.planning/phases/01-shell-foundation/01-05-SUMMARY.md` — Work-area ARIA contract (queue listbox, inspector tablist, compare slider) — store updates must drive these without breaking ARIA
- `src/App.tsx` — Current 552-LOC composition root holding the useState hooks that will move into the new stores
- `src/components/shell/Toolbar.tsx` — Already renders an "Optimize" button and a "Workers" status pill placeholder; Phase 2 wires both
- `src/types/index.ts` — `FileEntry`, `FormatId`, `FileStatus`, `CodecSettings*`, `SourceDensity` already defined; stores reuse these
- `src/data/defaults.ts` — Production codec defaults (consumed by `useSettingsStore` initial state)
- `src/data/mock.ts` — Phase-1 visual fixtures; Phase 2 will start replacing these with real `useFilesStore` data and eventually delete this file

### External Library Docs (read for API surface, do NOT pin local snippets)
- comlink README + repo (https://github.com/GoogleChromeLabs/comlink) — `Comlink.wrap`, `Comlink.expose`, `Comlink.transfer` for ArrayBuffer transferables, `proxyMarker` for two-way callbacks
- zustand README + docs (https://zustand-demo.pmnd.rs) — slice pattern, `subscribeWithSelector`, `combine` middleware, persist (Phase 7 only — NOT Phase 2)
- Vite Web Workers guide — `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` is the canonical idiom for ES-module workers (required for comlink + dynamic imports)

### Privacy & Security
- `public/_headers` — COOP `same-origin` + COEP `require-corp` already set; workers inherit isolation
- `src/main.tsx` — Existing `crossOriginIsolated` runtime assertion; workers may strengthen to a hard-throw if `SharedArrayBuffer` becomes required (not in v1; defer)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/types/index.ts`** — Domain types already defined and downstream-ready. `FileEntry.thumbnail` field is `string | null` (object URL); D-10's lifecycle rules slot in without a type change.
- **`src/data/defaults.ts`** — Codec defaults; `useSettingsStore` initial state should import these directly.
- **`src/components/shell/Toolbar.tsx:140`** — Existing "Workers" status pill placeholder; runtime store stats wire here.
- **`src/components/shell/CommandPalette.tsx`** — Cmd+K palette already includes Optimize/Cancel actions; needs to call into the new stores instead of local useState handlers.
- **`src/hooks/useTheme.ts`** — Pattern reference for a small, focused custom hook with localStorage discipline; `useWorkerPool` (if planner picks the hook form) follows the same shape.

### Established Patterns
- **Hand-rolled UI primitives accepted (D-06 from Phase 1)** — Phase 2 store wiring must not require shadcn migration. The existing `Slider`, `Toggle`, `Section`, etc. continue.
- **Plan-per-module commit discipline** — Phase 1 plans 03/04/05 each shipped as 2–3 atomic commits; Phase 2 plans should follow the same atomic-task pattern (executor commits per task).
- **Playwright over jsdom** — `src/tests/shell.spec.ts` is the live test target; Phase 2 worker tests should also run in real Chromium (worker behavior + transferable semantics are not faithful in jsdom).
- **No Node-shimmed modules** — svgo, fontsource, etc. are imported as browser ESM. New worker code follows the same rule (no `require`, no Node polyfills).

### Integration Points
- **App.tsx ~25 useState hooks** — Many will migrate into the three stores. Plan 04 deliberately left them in App.tsx because Phase 2 was reorganizing anyway. Migration is mechanical but high-touch.
- **Toolbar's "Optimize" + "Cancel" buttons** — currently call no-op handlers; Phase 2 wires both to runtime store actions.
- **CommandPalette commands** — `cmdGroups` builder in App.tsx feeds command items to CommandPalette; Optimize/Cancel command entries route to runtime store actions.
- **shell.spec.ts ARIA tests** — Must keep passing through the store migration. Worker harness adds new tests (worker-pool concurrency, cancel correctness, stub round-trip) into a new spec file.

</code_context>

<specifics>
## Specific Ideas

- **Stub adapter is the gate.** Phase 2 is "done" when the user can drag a file in, click Optimize, see the file flow through the worker pool, and end up with `optimizedSize === originalSize` and a "0 bytes saved" row. Plan ordering should make the stub round-trip the very first end-to-end smoke test, before any UI polish or store ergonomics work.
- **Memory model has no codec to test against in Phase 2.** Validate the rules with synthetic large Blobs (e.g. a 50 MB ArrayBuffer of zeros, batch of 50). Phase 4 will validate against real raster pipelines; Phase 2 needs to prove the harness math is right with synthetic load.
- **Worker module path uses `new URL(...)` idiom.** Avoid `?worker` Vite suffixes — they limit dynamic codec imports inside the worker.

</specifics>

<deferred>
## Deferred Ideas

- **Cooperative cancel tokens** — Defer to v2 if a codec gains streaming/incremental cancellation support.
- **Hybrid worker pool (auto-scale + idle terminate)** — Defer to v2; profile first.
- **Streaming chunked adapters** — Defer to v2; current codec ecosystem is non-streaming.
- **Per-file atomic zustand stores** — Defer to v2 if profiling shows re-render hotspots.
- **Persist worker queue across reloads** — Phase 7 owns persistence; v1 queue is always ephemeral on reload.
- **Multi-stage progress events** — Reconsider in Phase 5 if a specific raster encoder benefits visibly.

</deferred>

---

*Phase: 2-Worker Harness + State*
*Context gathered: 2026-04-30*
