<!-- refreshed: 2026-05-07 -->
# Architecture

**Analysis Date:** 2026-05-07

## System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                         React UI (main thread)                     │
│                                                                    │
│  AppShell  TitleBar  Toolbar  StatusBar  CommandPalette           │
│  `src/components/shell/`                                           │
│                                                                    │
│  FilesPane     CenterPane      InspectorPane                       │
│  `src/components/panels/`                                          │
└──────────┬──────────────────────────────────────┬─────────────────┘
           │ reads / dispatches                    │ reads
           ▼                                       ▼
┌──────────────────────────┐       ┌──────────────────────────────┐
│    Zustand Stores         │       │    Custom Hooks               │
│  `src/stores/`            │       │  `src/hooks/`                 │
│  • useFilesStore          │       │  • useBatchOrchestrate.ts     │
│  • useSettingsStore       │       │  • useFilePicker.ts           │
│  • useRuntimeStore        │       │  • useCommandPalette.tsx      │
│    (+ urlCache, queue)    │       │  • useKeyboardShortcuts.ts    │
└──────────┬───────────────┘       │  • useTotals.ts               │
           │ store reads            └──────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────────┐
│                         WorkerPool                                 │
│  `src/workers/pool.ts`   (module-level singleton)                  │
│  Comlink proxy · abort controller · memory budget admission gate   │
└──────────┬─────────────────────────────────────────────────────────┘
           │ postMessage (Comlink.transfer — zero-copy ArrayBuffer)
           ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Web Worker (1–4 instances)                        │
│  `src/workers/worker.ts`  — Comlink.expose({ runJob })             │
│                                                                    │
│  ADAPTERS map (static literal paths):                              │
│  • svg-adapter.ts   → svgo/browser optimize()                      │
│  • png-adapter.ts   → @jsquash/png decode + @jsquash/resize + encode│
│  • stub-adapter.ts  → byte-equal passthrough (test/placeholder)    │
│  • jpeg/webp/avif   → throw (Phase 5 stubs)                        │
└────────────────────────────────────────────────────────────────────┘
           │ ArrayBuffer result → main thread
           ▼
┌────────────────────────────────────────────────────────────────────┐
│            Post-Worker Main-Thread Processing                      │
│  • SVG: sanitize-svg.ts (DOMPurify) → markDone with sanitizedCount │
│  • PNG: wrap ArrayBuffer in Blob → markDone                        │
│  • Stub: wrap → markDone                                           │
└────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Root compositor; wires stores to UI props; plugin-change subscriber | `src/App.tsx` |
| `AppShell` | 4-row CSS grid layout (`role="application"`) | `src/components/shell/AppShell/AppShell.tsx` |
| `TitleBar` | App title, theme toggle, codec selector, view switcher | `src/components/shell/TitleBar/TitleBar.tsx` |
| `Toolbar` | File add, Run/Cancel buttons, workers pill | `src/components/shell/Toolbar/Toolbar.tsx` |
| `StatusBar` | Progress bar, totals, backpressure indicator | `src/components/shell/StatusBar/StatusBar.tsx` |
| `CommandPalette` | Keyboard-driven command launcher (Cmd+K) | `src/components/shell/CommandPalette/CommandPalette.tsx` |
| `FilesPane` | File queue list; drag-drop target | `src/components/panels/FilesPane.tsx` |
| `CenterPane` | Preview / split-view for selected file | `src/components/panels/CenterPane.tsx` |
| `InspectorPane` | Right panel: codec settings, snippets, report | `src/components/panels/InspectorPane.tsx` |
| `SvgoPanel` | SVGO plugin enable/disable list with live savings | `src/components/panels/SvgoPanel.tsx` |
| `SnippetPanel` | HTML/CSS snippet copy affordances (registry-driven) | `src/components/panels/SnippetPanel.tsx` |
| `WorkerPool` | Concurrency manager: spawn/queue/cancel/memory-gate workers | `src/workers/pool.ts` |
| `useFilesStore` | Canonical file list: byId + order + CRUD + variant fan-out | `src/stores/files.ts` |
| `useSettingsStore` | Codec configs (SVG/PNG/JPEG/WebP/AVIF), global settings, snippet toggles | `src/stores/settings.ts` |
| `useRuntimeStore` | Ephemeral: queue, inFlight, URL cache, throttle state, preview debounce | `src/stores/runtime.ts` |

## Pattern Overview

**Overall:** Unidirectional data flow — event-driven store mutations, React subscriptions, worker-pool side effects

**Key Characteristics:**
- File business logic lives in `src/hooks/*` and `src/stores/*`, never inline in components
- Worker communication is always zero-copy (Comlink.transfer on ArrayBuffer)
- Main thread owns DOMPurify (SVG sanitization); worker owns SVGO/codec WASM
- Pool is a module-level singleton accessed via `getWorkerPool()` — one instance per page lifetime

## Layers

**UI Layer:**
- Purpose: Render stores state, fire store actions via user interactions
- Location: `src/components/`
- Contains: Shell layout, panels, `src/components/ui/` primitives (button, slider, popover, etc.)
- Depends on: Stores (via hooks), `src/lib/` utilities
- Used by: Nothing — top of the tree

**Hook Layer:**
- Purpose: Orchestration logic — file ingestion, batch lifecycle, keyboard shortcuts, totals
- Location: `src/hooks/`
- Contains: `useBatchOrchestrate`, `useFilePicker`, `useCommandPalette`, `useKeyboardShortcuts`, `useTotals`, `useTheme`
- Depends on: Stores, `src/workers/pool.ts`, `src/lib/`
- Used by: `src/App.tsx`, panels

**Store Layer:**
- Purpose: Global reactive state — canonical truth for files, settings, runtime
- Location: `src/stores/`
- Contains: `files.ts`, `settings.ts`, `runtime.ts`, `index.ts` (barrel)
- Depends on: `src/lib/`, `src/workers/pool.ts` (runtime only)
- Used by: Hooks, `App.tsx`, components via selectors

**Worker Layer:**
- Purpose: CPU-intensive codec work off the main thread
- Location: `src/workers/`
- Contains: `worker.ts` (Comlink entry), `pool.ts` (singleton orchestrator), `svg-adapter.ts`, `png-adapter.ts`, `stub-adapter.ts`, `types.ts`
- Depends on: `svgo/browser`, `@jsquash/png`, `@jsquash/resize`
- Used by: `src/hooks/useBatchOrchestrate.ts`, `src/stores/runtime.ts`

**Lib Layer:**
- Purpose: Pure utilities — no React, no stores
- Location: `src/lib/`
- Contains: `sanitize-svg.ts`, `snippet-registry.ts`, `svg-snippets.ts`, `filename.ts`, `format.ts`, `sniff.ts`, `memory-budget.ts`, `object-url.ts`, `live-region.ts`, `tokenize.tsx`, `utils.ts`
- Depends on: `dompurify` (sanitize-svg only)
- Used by: Stores, hooks, components

**Types Layer:**
- Purpose: Shared TypeScript type definitions
- Location: `src/types/index.ts`
- Contains: `FileEntry`, `FileStatus`, `FormatId`, `CodecSettings*`, `SnippetId`, `GlobalSettings`, etc.
- Used by: All layers

## Data Flow

### Primary Batch Optimize Path

1. User drops files → `useFilePicker.handleDrop` → `ingestDroppedFiles` (`src/hooks/useFilePicker.ts:22`)
2. `useFilesStore.addSourceWithVariants` fans out one `FileEntryWithBlob` per target density (`src/stores/files.ts:156`)
3. User clicks "Run" → `useBatchOrchestrate.startOptimize()` reads `filesStore.order`, calls `runtimeStore.startBatch(fileIds)` (`src/hooks/useBatchOrchestrate.ts:285`)
4. For each file, `pool.enqueue(job)` routes to the correct adapter via `AdapterFormat` (`src/workers/pool.ts:85`)
5. Worker receives `ArrayBuffer` via Comlink.transfer, runs adapter, returns result zero-copy
6. Pool `onDone` callback fires → SVG path: main thread runs `sanitizeSvg()` → `filesStore.markDone()` (`src/hooks/useBatchOrchestrate.ts:386`)
7. `filesStore.markDone` revokes old object URL, writes `optimizedBlob` + `optimizedSize` + `status='done'` (`src/stores/files.ts:98`)
8. React renders updated file row via store subscription

### Live SVG Preview Path (debounced)

1. User toggles SVGO plugin → `useSettingsStore.svg.plugins` changes
2. App.tsx `useEffect` subscriber fires → `useRuntimeStore.enqueuePreview(fileId)` (`src/App.tsx:46`)
3. `enqueuePreview` debounces 200ms, cancels previous preview jobs (`cancelByPrefix('preview-')`), enqueues fresh SVG job (`src/stores/runtime.ts:258`)
4. Result mirrors batch SVG path: DOMPurify on main thread → `filesStore.markDone`

### Memory-Gated Dispatch Path

1. `WorkerPool.tryDispatch` checks `inflightBytes + head.byteEstimate > memoryBudgetBytes` (`src/workers/pool.ts:213`)
2. If over budget: `callbacks.onThrottle()` fires → toast "Pacing batch for memory" (once per batch)
3. As in-flight jobs complete, `inflightBytes` decreases → `tryDispatch()` re-runs automatically

**State Management:**
- Files canonical state: `useFilesStore` (byId + order, keyed by UUID)
- Codec/global settings: `useSettingsStore` (per-format slices, persistent shape — IndexedDB Phase 7)
- Ephemeral runtime: `useRuntimeStore` (queue, inFlight Set, urlCache Map, throttle flags)

## Key Abstractions

**FileEntryWithBlob:**
- Purpose: Extends `FileEntry` with `sourceBlob` and `optimizedBlob` (in-memory, never serialized)
- Location: `src/stores/files.ts:14`
- Pattern: `byId: Record<string, FileEntryWithBlob>` + `order: string[]` — normalized store shape

**WorkerPool:**
- Purpose: Manages worker lifecycle, job queue, abort, memory gate
- Location: `src/workers/pool.ts:50`
- Pattern: Class singleton via `getWorkerPool()` — terminate-and-respawn on cancel (never cooperative)

**AdapterFormat → Adapter static map:**
- Purpose: Security guard — no dynamic `import(\`./\${format}-adapter\`)`, only literal paths
- Location: `src/workers/worker.ts:16`
- Pattern: `Record<AdapterFormat, () => Promise<{run}>>` — static literal imports only

**SNIPPET_REGISTRY:**
- Purpose: Decouples snippet rendering from format detection; extensible without touching SnippetPanel
- Location: `src/lib/snippet-registry.ts:21`
- Pattern: `Record<SnippetId, SnippetDef>` — `applicableFormats` filter is the sole format switch

## Entry Points

**App entry:**
- Location: `src/main.tsx`
- Triggers: Browser page load
- Responsibilities: COOP/COEP check, React root mount, font imports

**Worker entry:**
- Location: `src/workers/worker.ts`
- Triggers: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`
- Responsibilities: Comlink.expose({ runJob }), lazy adapter dispatch

## Architectural Constraints

- **Threading:** Main thread owns React/DOM/DOMPurify; workers own WASM codec runs. Pool size = `min(hardwareConcurrency, 4)`.
- **Global state:** Module-level `_pool` singleton in `src/workers/pool.ts`; `useFilesStore`, `useSettingsStore`, `useRuntimeStore` are Zustand module-level stores
- **Circular imports:** `files.ts` ↔ `runtime.ts` — intentional static cycle; safe because both access each other lazily via `.getState()` at call time, not at module-init time (documented in `src/stores/runtime.ts:15`)
- **DOMPurify constraint:** Must run on main thread — DOMPurify checks `window.document.nodeType` at module init and reports `isSupported=false` in workers. The SVG pipeline is split: SVGO in worker, DOMPurify on main thread.
- **Worker module format:** Workers must be ES modules (`worker.format: 'es'` in `vite.config.ts`) for code-splitting dynamic imports inside `worker.ts` to work.
- **Zero-copy transfers:** `Comlink.transfer(input, [input])` in `pool.ts` — `input` is detached on the main thread after transfer. Never read `input` after this call.

## Anti-Patterns

### Dynamic import paths in worker ADAPTERS map

**What happens:** Using `() => import(\`./\${format}-adapter\`)` with a template literal
**Why it's wrong:** Vite cannot statically analyze dynamic paths — the worker will 404 in production builds
**Do this instead:** Explicit literal imports in the static `ADAPTERS` map in `src/workers/worker.ts:22`

### Calling DOMPurify inside a Web Worker

**What happens:** Importing `dompurify` inside `src/workers/svg-adapter.ts` or `src/workers/worker.ts`
**Why it's wrong:** DOMPurify checks `window.document.nodeType` at module init; returns `isSupported=false` in workers; `sanitize` is undefined
**Do this instead:** Import and call `sanitizeSvg` from `src/lib/sanitize-svg.ts` on the main thread after `pool.enqueue()` resolves (see `src/hooks/useBatchOrchestrate.ts:386`)

### Reading `input` ArrayBuffer after Comlink.transfer

**What happens:** Accessing `input` variable after `Comlink.transfer(input, [input])`
**Why it's wrong:** The ArrayBuffer is detached — any read/write throws `TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer`
**Do this instead:** Use only the result value; never store or re-read `input` (see `src/workers/pool.ts:245`)

### Using `?worker` Vite suffix for worker import

**What happens:** `import WorkerModule from './worker.ts?worker'`
**Why it's wrong:** Creates a bundled IIFE worker format that breaks code-splitting dynamic imports inside the worker
**Do this instead:** `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` (see `src/workers/pool.ts:197`)

## Error Handling

**Strategy:** Discriminated error classes + cancel/abort path separation

**Patterns:**
- `AdapterError(format, phase, message)` — typed codec failures from adapters (`src/workers/types.ts:55`)
- `DOMException('Batch cancelled', 'AbortError')` — cancel path; `.catch` handlers check `err.name === 'AbortError'` before marking file as error
- `cancelBatch` path: pool.cancel() fires `AbortError` for all in-flight jobs → `runtime.markError` discriminates cancel vs real error via message check (`src/stores/runtime.ts:179`)
- Worker adapter errors caught and rethrown as `AdapterError` with phase tag (decode/process/encode)

## Cross-Cutting Concerns

**Logging:** `console.error` in adapter catch paths and `enqueuePreview` outer catch; no structured logging
**Validation:** Format detection via MIME + extension in `src/hooks/useFilePicker.ts:9`; unsupported formats emit toast and are skipped
**Accessibility:** `aria-live` region via `src/lib/live-region.ts`; ARIA roles on shell (`role="application"`); keyboard shortcuts in `src/hooks/useKeyboardShortcuts.ts`
**Memory management:** Object URL lifecycle managed by `useRuntimeStore.urlCache` — `revokeObjectURL` called before every `markDone` write (Pitfall 3 guard)

---

*Architecture analysis: 2026-05-07*
