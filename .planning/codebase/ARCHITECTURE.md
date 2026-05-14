<!-- refreshed: 2026-05-14 -->
# Architecture

**Analysis Date:** 2026-05-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     React UI Layer (main thread)                     │
│   App.tsx · AppShell · FilesPane · CenterPane · InspectorPane       │
│   src/App.tsx · src/components/shell/* · src/components/panels/*    │
└──────┬───────────────┬────────────────────────────┬─────────────────┘
       │ useStore()    │ dispatch actions            │ useXxx hooks
       ▼               ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Nanostores State Layer                            │
│   filesStore · settingsStore · runtimeStore                         │
│   src/stores/files.ts · src/stores/settings.ts · src/stores/runtime.ts │
└──────┬──────────────────────────────────────────────────────────────┘
       │ getWorkerPool().enqueue(job)
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               WorkerPool (main thread singleton)                    │
│   src/workers/pool.ts · WorkerPool class                            │
│   Comlink.transfer() ──► postMessage to workers                     │
└──────┬──────────────────────────────────────────────────────────────┘
       │ Worker.postMessage (Comlink RPC)
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Web Workers (≤4 concurrent, ES module)                │
│   src/workers/worker.ts  (Comlink.expose({ runJob }))               │
│   Lazy-imported adapters: svg / png / jpeg / webp / avif            │
│   src/workers/*-adapter.ts  +  jSquash WASM codecs                  │
└──────┬──────────────────────────────────────────────────────────────┘
       │ ArrayBuffer (Comlink.transfer zero-copy)
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│            WASM Codec / SVG Engine (inside worker)                  │
│   @jsquash/{png,jpeg,webp,avif,oxipng,resize}                       │
│   svgo/browser  (loaded via src/workers/svg-adapter.ts)             │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Root: wires stores → shell slots; owns dev test exposure | `src/App.tsx` |
| `AppShell` | 4-slot CSS grid layout (titleBar/toolbar/workArea/statusBar) | `src/components/shell/AppShell/AppShell.tsx` |
| `FilesPane` | Left pane: file queue list, drop zone, sort, context menu | `src/components/panels/FilesPane.tsx` |
| `CenterPane` | Center: before/after split view, preview | `src/components/panels/CenterPane.tsx` |
| `InspectorPane` | Right pane: codec settings, snippet output, report | `src/components/panels/InspectorPane.tsx` |
| `TitleBar` | App title, theme toggle | `src/components/shell/TitleBar/TitleBar.tsx` |
| `Toolbar` | Add-file button, optimize trigger, codec selector | `src/components/shell/Toolbar/Toolbar.tsx` |
| `StatusBar` | Progress summary: file count, bytes saved, % | `src/components/shell/StatusBar/StatusBar.tsx` |
| `CommandPalette` | Keyboard-driven cmdk overlay | `src/components/shell/CommandPalette/CommandPalette.tsx` |
| `filesStore` | Canonical file entries: `byId`, `order`, `selectedId` | `src/stores/files.ts` |
| `settingsStore` | Codec configs, SVGO plugin toggles, per-file overrides, view | `src/stores/settings.ts` |
| `runtimeStore` | Ephemeral batch state: queue, inFlight, urlCache, progress | `src/stores/runtime.ts` |
| `WorkerPool` | Manages up to 4 ES-module workers; memory-budget admission gate | `src/workers/pool.ts` |
| `worker.ts` | Worker entry: static ADAPTERS map + `Comlink.expose({ runJob })` | `src/workers/worker.ts` |
| `svg-adapter` | SVGO optimize → ArrayBuffer (no DOMPurify — main-thread only) | `src/workers/svg-adapter.ts` |
| `png-adapter` | @jsquash/png decode + @jsquash/resize + @jsquash/oxipng encode | `src/workers/png-adapter.ts` |
| `jpeg-adapter` | @jsquash/jpeg encode via MozJPEG | `src/workers/jpeg-adapter.ts` |
| `webp-adapter` | @jsquash/webp encode | `src/workers/webp-adapter.ts` |
| `avif-adapter` | @jsquash/avif encode (lazy-load only — ~2 MB WASM) | `src/workers/avif-adapter.ts` |
| `sanitize-svg` | DOMPurify post-processing on main thread after SVG worker result | `src/lib/sanitize-svg.ts` |
| `snippet-registry` | Registry pattern for HTML/CSS snippet generators | `src/lib/snippet-registry.ts` |
| `useBatchOrchestrate` | Hook: pool setup, `startOptimize`, `cancelBatch`, completion subscriber | `src/hooks/useBatchOrchestrate.ts` |
| `useFilePicker` | Hook: drag-and-drop + file input → `addSourceWithVariants` | `src/hooks/useFilePicker.ts` |

## Pattern Overview

**Overall:** Three-layer client-side pipeline — React UI reads nanostores state, store actions drive a WorkerPool singleton, workers lazy-import WASM codec adapters and return zero-copy ArrayBuffers via Comlink.

**Key Characteristics:**
- Zero-server: all computation happens in-browser via WebAssembly + Web Workers
- Nanostores `map<T>` atoms (not zustand): store state is read via `useStore()` in components; mutations go through exported action functions
- WorkerPool is a module-level singleton (`src/workers/pool.ts :: getWorkerPool()`); created lazily on first enqueue
- WASM codecs are dynamically imported inside workers via a static ADAPTERS map — Vite resolves literal import paths at build time for code splitting
- DOMPurify runs only on the main thread (workers lack `document`); SVG sanitization is post-SVGO in `src/lib/sanitize-svg.ts`
- Memory-budget admission gate in WorkerPool prevents OOM on large batches; `byteEstimate` on each `PoolJob` drives the gate

## Layers

**UI Layer:**
- Purpose: Render state, dispatch user actions to stores, compose layout
- Location: `src/components/`, `src/App.tsx`
- Contains: React functional components, CSS Modules, Tailwind utility classes
- Depends on: stores (read-only via `useStore`), hooks, `src/lib/*`
- Used by: nothing (top of tree)

**Hook Layer:**
- Purpose: Encapsulate multi-store workflows (orchestration, file ingestion, keyboard shortcuts)
- Location: `src/hooks/`
- Contains: Custom React hooks (`useBatchOrchestrate`, `useFilePicker`, `useCommandPalette`, `useKeyboardShortcuts`, `useTotals`, `useTheme`)
- Depends on: stores, `src/workers/pool.ts`, `src/lib/*`
- Used by: `src/App.tsx` and panel components

**Store Layer:**
- Purpose: Single source of truth for all app state; expose pure action functions
- Location: `src/stores/`
- Contains: `filesStore` (file entries), `settingsStore` (codec config), `runtimeStore` (batch progress + urlCache)
- Depends on: `src/workers/pool.ts` (runtime), `src/lib/*`
- Used by: UI layer (read), hook layer (write via actions)
- Note: Three-way circular ESM dependency (`files ↔ runtime ↔ settings`) resolved via live-binding; unit tests must not cross-call at init time

**Worker Layer:**
- Purpose: Off-main-thread WASM codec execution
- Location: `src/workers/`
- Contains: `pool.ts` (pool singleton), `worker.ts` (Comlink entry), `*-adapter.ts` (codec wrappers), `*-config.ts` (settings builders), `types.ts`
- Depends on: jSquash packages, `svgo/browser`
- Used by: `runtimeStore` (via `getWorkerPool()`), `useBatchOrchestrate`

**Lib Layer:**
- Purpose: Pure utility functions (no React, no stores)
- Location: `src/lib/`
- Contains: `filename.ts`, `format.ts`, `sanitize-svg.ts`, `snippet-registry.ts`, `svg-snippets.ts`, `memory-budget.ts`, `object-url.ts`, `sniff.ts`, `live-region.ts`, `tokenize.tsx`, `icc.ts`, `utils.ts`
- Depends on: `dompurify` (sanitize-svg), domain types
- Used by: stores, hooks, components

**Types Layer:**
- Purpose: Shared domain types (no runtime code)
- Location: `src/types/index.ts`
- Contains: `FormatId`, `FileEntry`, `FileStatus`, `Density`, `CodecSettings*`, `SnippetId`, etc.
- Depends on: nothing
- Used by: all layers

## Data Flow

### Optimize Batch (primary path)

1. User drops files → `useFilePicker` → `addSourceWithVariants()` in `src/stores/files.ts`
2. User clicks Optimize → `useBatchOrchestrate.startOptimize()` in `src/hooks/useBatchOrchestrate.ts`
3. Hook calls `startBatch(jobIds)` on `runtimeStore`, then `pool.enqueue(job)` per file
4. `WorkerPool.tryDispatch()` admits jobs within memory budget → `Comlink.transfer(input, [input])` to worker
5. Worker (`src/workers/worker.ts`) lazy-imports adapter via `ADAPTERS[format]()`, calls `adapter.run(input, settings)`
6. Adapter invokes WASM codec → returns `{ output: ArrayBuffer, meta }` → `Comlink.transfer` zero-copy back
7. Pool `onDone` callback fires → `runtimeStore.markDone()` + `filesStore.markDone(fileId, optimizedBlob)`
8. React re-renders `FilesPane` (updated status) and `CenterPane` (new preview)

### SVG Preview (live settings change)

1. `settingsStore.svg` key changes → `listenKeys(settingsStore, ['svg'], ...)` in `App.tsx`
2. `enqueuePreview(fileId)` called (debounced 200ms) from `src/stores/runtime.ts`
3. Pool enqueues `preview-*` job using `cancelByPrefix('preview-')` to discard stale previews
4. SVG adapter runs SVGO → result sanitized by `src/lib/sanitize-svg.ts` on main thread
5. `filesStore.markDone()` updates `optimizedBlob` → CenterPane re-renders

### File Drop (ingestion)

1. `FilesPane` drag events → `useFilePicker` hook
2. `ingestDroppedFiles()` detects format by MIME/extension
3. `addSourceWithVariants()` → `filesStore.addFile()` per density variant
4. `filesStore.selectedId` auto-set to first new file

**State Management:**
- UI state: nanostores `map<T>` atoms in `src/stores/`; components subscribe via `@nanostores/react :: useStore()`
- Object URLs: managed exclusively through `runtimeStore.urlCache` (Map); revoked via `revokeObjectURL()` before overwriting
- Codec settings: `settingsStore` holds global defaults + `perFile` override map
- Worker pool: module-level singleton in `src/workers/pool.ts`; test-injectable via `__setWorkerPoolForTesting()`

## Key Abstractions

**`PoolJob`:**
- Purpose: Unit of work dispatched to a worker
- Location: `src/workers/types.ts`
- Fields: `id` (string, `preview-*` prefix for narrow cancel), `fileId`, `format: AdapterFormat`, `settings`, `blob: Blob`, `byteEstimate?`

**`FileEntryWithBlob`:**
- Purpose: In-memory file record extending `FileEntry` with live `sourceBlob` and `optimizedBlob`
- Location: `src/stores/files.ts`
- Note: `FileEntry` (in `src/types/index.ts`) is the serializable subset used by components

**`AdapterRunResult`:**
- Purpose: Worker → main thread return value (zero-copy via Comlink.transfer)
- Location: `src/workers/types.ts`
- Fields: `output: ArrayBuffer`, `meta: AdapterMeta`

**`SnippetDef` / `SNIPPET_REGISTRY`:**
- Purpose: Registry pattern for HTML/CSS snippet generators; SnippetPanel reads from registry, not switch statements
- Location: `src/lib/snippet-registry.ts`
- Pattern: Add entries to registry to support new formats; never add `switch(file.format)` to `SnippetPanel`

## Entry Points

**App Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` → Vite serves `src/main.tsx`
- Responsibilities: Check `crossOriginIsolated`, render `<App />` in `StrictMode`

**Worker Entry:**
- Location: `src/workers/worker.ts`
- Triggers: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` in `pool.ts`
- Responsibilities: `Comlink.expose({ runJob })`; lazy-import adapter on first call per format

## Architectural Constraints

- **Threading:** Single-threaded UI + up to 4 ES-module Web Workers (pool size = `min(hardwareConcurrency, 4)`). Workers are spawned lazily on first `enqueue()`.
- **COOP/COEP required:** `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` headers mandatory for `crossOriginIsolated` (SharedArrayBuffer). Set in `vite.config.ts` dev server and must be set by Cloudflare Pages in production.
- **Global state:** Three module-level singletons: `filesStore` (`src/stores/files.ts`), `settingsStore` (`src/stores/settings.ts`), `runtimeStore` (`src/stores/runtime.ts`), `_pool` (`src/workers/pool.ts`).
- **Circular imports:** `files.ts ↔ runtime.ts ↔ settings.ts` — three-way circular ESM. Browser ESM live-binding resolves this at runtime. Node (`--experimental-strip-types`) does not support circular ESM; unit tests must not call cross-store functions at module init. `runtime.ts` uses `require()` for lazy cross-store reads inside `enqueuePreview`.
- **WASM exclusion from dep bundling:** All `@jsquash/*` packages excluded from Vite `optimizeDeps` — they embed WASM via `new URL(...)` which breaks when esbuild flattens them.
- **Static adapter paths:** `ADAPTERS` map in `worker.ts` uses literal `import()` paths only. Template literals (`./\${format}-adapter.ts`) are forbidden — Vite cannot statically analyze them for code splitting.
- **DOMPurify main-thread only:** Standard Web Workers lack `document`. SVG sanitization runs in `src/lib/sanitize-svg.ts` after the worker returns, called from pool `onDone`.

## Anti-Patterns

### Dynamic import paths in worker ADAPTERS map

**What happens:** Using `import(\`./\${format}-adapter.ts\`)` in `src/workers/worker.ts`
**Why it's wrong:** Vite cannot statically analyze the import for code splitting; production build will 404 on the adapter chunk
**Do this instead:** Add an explicit literal-string entry to the `ADAPTERS` record in `src/workers/worker.ts`

### Reading store state directly in components (bypassing useStore)

**What happens:** `filesStore.get()` called inside a component render without `useStore(filesStore)`
**Why it's wrong:** Component will not re-render when store changes
**Do this instead:** `const state = useStore(filesStore)` then read from `state`

### Calling cross-store actions at module init time in unit tests

**What happens:** Importing `files.ts` and immediately calling a function that internally calls into `runtime.ts`
**Why it's wrong:** Node's `--experimental-strip-types` runner does not resolve circular ESM live bindings at init time
**Do this instead:** Only call cross-store functions after all modules are fully initialized (inside test bodies, not at top level)

### Adding switch(file.format) to SnippetPanel

**What happens:** New format snippet logic added directly to `src/components/panels/SnippetPanel.tsx`
**Why it's wrong:** Violates the registry pattern; makes format support non-composable
**Do this instead:** Add a new entry to `SNIPPET_REGISTRY` in `src/lib/snippet-registry.ts`

## Error Handling

**Strategy:** Adapters throw `AdapterError(format, phase, message)` from `src/workers/types.ts`; pool catches and calls `onError` callback; `runtimeStore.markError()` distinguishes abort vs. real errors.

**Patterns:**
- `AdapterError` subclass carries `format` and `phase: 'decode' | 'process' | 'encode'`
- Cancel is `DOMException('Batch cancelled', 'AbortError')` — `markError` treats abort as non-error (does not increment `errorCount`)
- Preview jobs use `cancelByPrefix('preview-')` for narrow cancel without terminating batch workers
- Full batch cancel: `pool.cancel()` terminates all workers + respawns fresh pool; WASM state discarded

## Cross-Cutting Concerns

**Logging:** `console.error` only (no logging SaaS — zero-telemetry policy). Worker errors surfaced via sonner toasts.
**Validation:** Format detection by MIME type then file extension in `useFilePicker`. Unsupported files skipped with toast notification.
**Authentication:** None — fully client-side, zero-server.
**Accessibility:** WCAG AA required. ARIA live region (`role="status"`) in `App.tsx` for screen reader progress. Keyboard navigation via `useKeyboardShortcuts`. All interactive elements have ARIA labels.
**Object URL lifecycle:** All `URL.createObjectURL()` calls go through `runtimeStore.getOrCreateObjectURL()`; revocation via `revokeObjectURL()` before any overwrite. Never store object URLs outside `runtimeStore.urlCache`.

---

*Architecture analysis: 2026-05-14*
