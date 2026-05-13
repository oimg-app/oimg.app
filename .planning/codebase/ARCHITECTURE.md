<!-- refreshed: 2026-05-12 -->
# Architecture

**Analysis Date:** 2026-05-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         React UI Layer                              │
│  AppShell · TitleBar · Toolbar · FilesPane · CenterPane · Inspector │
│  src/components/shell/  |  src/components/panels/                   │
└──────────┬──────────────────────────────────────────────────────────┘
           │ reads/writes
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Zustand Stores (3 slices)                     │
│  useFilesStore (files.ts) · useSettingsStore (settings.ts)          │
│  useRuntimeStore (runtime.ts)                                        │
│  src/stores/                                                         │
└──────────┬──────────────────────────────────────────────────────────┘
           │ enqueue / callbacks
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  WorkerPool singleton                                │
│  src/workers/pool.ts                                                 │
│  Max 4 slots · admission gate (memory budget) · cancel/respawn      │
└──────────┬──────────────────────────────────────────────────────────┘
           │ Comlink RPC (ArrayBuffer transfer)
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Worker thread(s) — src/workers/worker.ts              │
│  ADAPTERS map → lazy-import per format                              │
│  svg-adapter · png-adapter · jpeg-adapter · webp-adapter            │
│  avif-adapter (lazy ~2 MB) · stub-adapter                           │
└──────────┬──────────────────────────────────────────────────────────┘
           │ WASM
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  jSquash WASM codecs: @jsquash/{png,jpeg,webp,avif,resize,oxipng}  │
│  svgo/browser (main-thread pre-bundled)                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| AppShell | 4-row CSS grid layout, `role="application"` | `src/components/shell/AppShell/AppShell.tsx` |
| TitleBar | App title, menu bar | `src/components/shell/TitleBar/TitleBar.tsx` |
| Toolbar | Codec selector, view switcher | `src/components/shell/Toolbar/Toolbar.tsx` |
| StatusBar | Running indicator, totals, Pacing pill | `src/components/shell/StatusBar/StatusBar.tsx` |
| CommandPalette | Keyboard-driven command list (cmdk) | `src/components/shell/CommandPalette/CommandPalette.tsx` |
| FilesPane | File queue list, drag-drop drop zone, per-row actions | `src/components/panels/FilesPane.tsx` |
| CenterPane | Preview area / compare view | `src/components/panels/CenterPane.tsx` |
| InspectorPane | Codec settings panels, snippet panel, report panel | `src/components/panels/InspectorPane.tsx` |
| CodecPanel | Per-format settings UI (delegates to format-specific panels) | `src/components/panels/CodecPanel.tsx` |
| SvgoPanel | SVGO plugin toggles, savings column | `src/components/panels/SvgoPanel.tsx` |
| PngPanel | OxiPNG level slider | `src/components/panels/PngPanel.tsx` |
| JpegPanel | Quality, progressive | `src/components/panels/JpegPanel.tsx` |
| WebpPanel | Quality, lossless, method | `src/components/panels/WebpPanel.tsx` |
| AvifPanel | Quality, lossless | `src/components/panels/AvifPanel.tsx` |
| SnippetPanel | HTML/CSS snippet generator | `src/components/panels/SnippetPanel.tsx` |
| ReportPanel | Per-file optimization report | `src/components/panels/ReportPanel.tsx` |
| TweaksPanel | Global resize algorithm, ICC settings | `src/components/panels/TweaksPanel.tsx` |

## Pattern Overview

**Overall:** Unidirectional data flow — UI reads zustand stores, user actions call store actions, store actions drive the WorkerPool, pool callbacks update stores, UI re-renders.

**Key Characteristics:**
- No React Context for state (zustand replaces it entirely)
- Worker communication is typed via Comlink proxy (`WorkerProxyApi` in `src/workers/types.ts`)
- All codec WASM runs in worker threads — main thread stays responsive
- DOMPurify (SVG sanitization) is the only main-thread post-processing step — required because DOMPurify needs `document`
- Object URL lifecycle is strictly managed: revoke before write, revoke on remove (`src/stores/runtime.ts` urlCache)

## Layers

**UI Layer:**
- Purpose: Render file queue, settings panels, snippets; forward user actions to stores
- Location: `src/components/`
- Contains: Shell layout, panel components, primitive UI wrappers
- Depends on: zustand stores (via `@/stores`), hooks (`@/hooks`), lib utilities (`@/lib`)
- Used by: nothing (top of the tree)

**Hook Layer:**
- Purpose: Business logic that spans multiple stores or requires effects/subscriptions
- Location: `src/hooks/`
- Contains: `useBatchOrchestrate.ts` (pool wiring + batch lifecycle), `useFilePicker.ts` (drag/drop), `useKeyboardShortcuts.ts`, `useCommandPalette.tsx`, `useTotals.ts`, `useTheme.ts`
- Depends on: zustand stores, `src/workers/pool.ts`
- Used by: `src/App.tsx` and panel components

**Store Layer:**
- Purpose: Canonical in-memory application state; all mutation goes through stores
- Location: `src/stores/`
- Contains: `files.ts` (FileEntryWithBlob registry), `settings.ts` (codec + global configs), `runtime.ts` (batch progress + URL cache + pool coordination)
- Depends on: `src/workers/pool.ts` (runtime.ts), `src/lib/` utilities
- Used by: hooks, components (read-only selectors)

**Worker Layer:**
- Purpose: Run WASM codecs off the main thread
- Location: `src/workers/`
- Contains: `worker.ts` (entry, ADAPTERS map), `pool.ts` (WorkerPool class + singleton), per-format adapters, per-format config builders, `types.ts`
- Depends on: jSquash packages, svgo/browser
- Used by: `src/stores/runtime.ts` (via `getWorkerPool()`), `src/hooks/useBatchOrchestrate.ts`

**Library Layer:**
- Purpose: Pure utilities with no React or store dependencies
- Location: `src/lib/`
- Contains: `sanitize-svg.ts`, `filename.ts`, `format.ts`, `icc.ts`, `live-region.ts`, `memory-budget.ts`, `object-url.ts`, `sniff.ts`, `snippet-registry.ts`, `svg-snippets.ts`, `tokenize.tsx`, `utils.ts`
- Depends on: dompurify (sanitize-svg only)
- Used by: stores, hooks, adapters

**Types Layer:**
- Purpose: Shared TypeScript domain types
- Location: `src/types/index.ts`
- Contains: `FileEntry`, `FileEntryWithBlob`, `CodecSettings*`, `FormatId`, `Density`, `SnippetId`, `GlobalSettings`, etc.
- Depends on: nothing
- Used by: all layers

## Data Flow

### Batch Optimize Path

1. User clicks Optimize → `useBatchOrchestrate.startOptimize()` (`src/hooks/useBatchOrchestrate.ts`)
2. Reads `useFilesStore.getState().order` — collects idle/queued/error fileIds
3. Calls `useRuntimeStore.getState().startBatch(fileIds)` — sets `running=true`, initializes queue
4. For each fileId: resolves codec settings (global + perFile override merge), calls `pool.enqueue(job)`
5. `WorkerPool.enqueue()` (`src/workers/pool.ts`) — admission gate checks `inflightBytes` against `memoryBudgetBytes`; if OK, dispatches to an idle Comlink slot
6. Worker (`src/workers/worker.ts`) receives `runJob(input, settings, format)` → lazy-imports the correct adapter → runs codec WASM → returns `AdapterRunResult` via `Comlink.transfer` (zero-copy)
7. Pool `onDone` callback → `useRuntimeStore.markDone(jobId)` → `.then()` handler on main thread
8. SVG path: `TextDecoder` → `sanitizeSvg(svgText, unsafe)` → `useFilesStore.markDone(fileId, sanitizedBlob, size, sanitizedCount)`
9. Raster path: wrap `result.output` as `Blob` with correct MIME → `useFilesStore.markDone(fileId, blob, size)`
10. `useFilesStore.markDone` revokes old Object URL, writes `optimizedBlob` + `status: 'done'` to store
11. React re-renders file row with updated status/size delta

### Live SVG Preview Path (plugin toggle)

1. User toggles SVGO plugin → `useSettingsStore` `plugins` slice changes
2. `App.tsx` subscriber fires → `useRuntimeStore.getState().enqueuePreview(fileId)`
3. `enqueuePreview` (debounced 200ms, last-toggle-wins): calls `pool.cancelByPrefix('preview-')` then enqueues a new `preview-${uuid}` job
4. Pool runs svg-adapter on the source blob; on resolve: DOMPurify on main thread → `useFilesStore.markDone`
5. `preview-` prefix prevents these auxiliary jobs from inflating `doneCount` batch counters

### File Drop / Add Path

1. `useFilePicker` handles File API drop/pick → calls `useFilesStore.addSourceWithVariants()`
2. `addSourceWithVariants` fans out one `FileEntryWithBlob` per target density, assigns `sourceFamilyId`, seeds `byteEstimate` via `estimateJobBytes` (`src/lib/memory-budget.ts`)
3. Atomic `set()` push to `byId` + `order`; name collision dedup via `deduplicateName` (`src/lib/filename.ts`)

**State Management:**
- Three zustand slices with `subscribeWithSelector`; stores cross-reference each other via `getState()` (never via hooks) to avoid circular re-render issues
- Object URL lifecycle: `urlCache: Map<fileId, objectURL>` in runtime store — `getOrCreateObjectURL` / `revokeObjectURL` are the only valid mutation points

## Key Abstractions

**WorkerPool:**
- Purpose: Manages N worker slots (max 4), FIFO job queue, memory-budget admission gate, cancel/respawn lifecycle
- Location: `src/workers/pool.ts`
- Pattern: Singleton via `getWorkerPool(callbacks?)`; callbacks bound once in `useBatchOrchestrate`

**Adapter:**
- Purpose: Per-codec `run(input: ArrayBuffer, settings): Promise<AdapterRunResult>` contract
- Examples: `src/workers/svg-adapter.ts`, `src/workers/png-adapter.ts`, `src/workers/jpeg-adapter.ts`, `src/workers/webp-adapter.ts`, `src/workers/avif-adapter.ts`
- Pattern: Static `ADAPTERS` map in `worker.ts` with literal-path imports (required for Vite code-splitting)

**Config Builder:**
- Purpose: Translate zustand settings slices + per-file overrides into typed adapter settings objects
- Examples: `src/workers/svg-config.ts`, `src/workers/png-config.ts`, `src/workers/jpeg-config.ts`, `src/workers/webp-config.ts`, `src/workers/avif-config.ts`
- Pattern: Pure functions `buildXxxSettings({ global, fileOverride }) → settings`; also importable from outside the worker for unit tests

**FileEntryWithBlob:**
- Purpose: Extends `FileEntry` (display shape) with `sourceBlob`, `sourceMeta`, `optimizedBlob`, `optimizedMeta`, `byteEstimate`, `settings`
- Location: `src/stores/files.ts`
- Pattern: Lives entirely in `useFilesStore.byId`; never passed as props (components use store selectors)

## Entry Points

**App Bootstrap:**
- Location: `src/main.tsx`
- Triggers: HTML `<script type="module">` via `index.html`
- Responsibilities: React DOM mount, COOP/COEP check, font import

**App Root:**
- Location: `src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Compose shell layout, wire store subscriptions, expose `__OIMG_STORES__` for Playwright in DEV

**Worker Entry:**
- Location: `src/workers/worker.ts`
- Triggers: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` in `pool.ts`
- Responsibilities: Comlink expose `{ runJob }`, dispatch to ADAPTERS map

## Architectural Constraints

- **Threading:** Main thread handles React render + DOMPurify + Object URL management. WASM runs in worker threads (up to 4). No OffscreenCanvas currently; canvas used only for thumbnail decode if at all.
- **Global state:** Three zustand store singletons at module scope (`src/stores/files.ts`, `src/stores/settings.ts`, `src/stores/runtime.ts`). WorkerPool singleton at module scope (`src/workers/pool.ts` `_pool`). Cross-store reads use `getState()` not hooks.
- **Circular imports:** `runtime.ts` ↔ `files.ts` static cycle is intentional and documented; resolved because both export named bindings accessed lazily via `getState()` at call time. Comment in `src/stores/runtime.ts` line 18-22.
- **DOMPurify main-thread only:** DOMPurify requires `window.document.nodeType`; standard Workers lack `document`. SVG bytes MUST travel from worker → main thread for sanitization before storage.
- **avif lazy-load:** `@jsquash/avif` (~2 MB gzipped) must only be dynamically imported when the user selects AVIF format. Never import at top of any non-avif module.
- **OxiPNG encode-only:** OxiPNG receives PNG bytes (`ArrayBuffer`), not `ImageData`. Decode with `@jsquash/png` first.

## Anti-Patterns

### Writing global codec slices from per-file codec panels

**What happens:** A codec panel writes to `useSettingsStore.setPng()` / `setJpeg()` etc. when the user adjusts settings for a single file.
**Why it's wrong:** Writing global slices triggers re-optimize for ALL files in the batch (Pitfall 4 per `src/stores/settings.ts` comment lines 67-69).
**Do this instead:** Call `useSettingsStore.getState().setPerFileCodec(fileId, patch)`. Global slices are for batch-wide defaults only. Resolution order: `perFile[fileId] ?? globalFormatSlice`.

### Dynamic module path in ADAPTERS map

**What happens:** Using `import(`./${format}-adapter.ts`)` template literals in `src/workers/worker.ts`.
**Why it's wrong:** Vite cannot statically resolve dynamic template literals; adapters 404 in production builds (Pitfall 1).
**Do this instead:** Use the static literal-path map already in `src/workers/worker.ts` — add a new adapter as an explicit `format: () => import('./format-adapter')` entry.

### Reading `input` ArrayBuffer after Comlink.transfer

**What happens:** Accessing `job.blob.arrayBuffer()` result after passing it via `Comlink.transfer(input, [input])`.
**Why it's wrong:** The buffer is detached on the main thread after transfer (Pitfall 2 per `src/workers/pool.ts` comments).
**Do this instead:** Derive `input` immediately before the `Comlink.transfer` call and never read it afterward.

### Calling addFile() for user-dropped files

**What happens:** Using `useFilesStore.addFile(entry)` directly for a file the user drops.
**Why it's wrong:** `addFile` does not set `byteEstimate`, fan out density variants, or apply name deduplication. The memory-budget admission gate and PNG adapter branch gate on `byteEstimate` presence — files added without it fall through to the stub adapter.
**Do this instead:** Call `useFilesStore.addSourceWithVariants(args)` for all user-dropped files. `addFile` is for synthetic test entries only.

## Error Handling

**Strategy:** Errors are surfaced via console and file-row status. No global error boundary in place for codec errors. AbortError (cancel path) is silently swallowed.

**Patterns:**
- Adapter errors: `AdapterError(format, phase, message)` thrown inside adapters; caught by pool and routed to `onError` callback → `useRuntimeStore.markError` → `useFilesStore.setStatus('error')`
- Cancel race: `DOMException('AbortError')` discriminated in `.catch()` handlers — not counted as real errors, file status not set to 'error'
- Preview jobs: errors logged to `console.error` but do not set file `status='error'` (auxiliary path)
- SVG sanitize errors: `sanitizeSvg` returns `{ clean, sanitizedCount }` — never throws; malformed SVGs produce cleaned output with count > 0

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.warn` with `[oimg]` or `[componentName]` prefix; no structured logging library.
**Validation:** File type detection via `src/lib/sniff.ts` (PNG header sniff). No runtime schema validation for settings.
**Accessibility:** ARIA live region via `src/lib/live-region.ts`; `setLiveRegion(el)` called from `App.tsx`; `announce()` called from batch orchestration for progress and completion.

---

*Architecture analysis: 2026-05-12*
