# Architecture Research

**Domain:** Client-side image optimization SPA (React + Vite + TypeScript, WASM codecs in Web Workers)
**Researched:** 2026-04-29
**Confidence:** HIGH (stack and pipeline shape verified against jSquash, SVGO, Comlink docs and the existing prototype)

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          MAIN THREAD (UI / React)                            │
│                                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ TitleBar   │  │  Toolbar    │  │  Queue Pane  │  │  Inspector Pane    │ │
│  │ Menus      │  │  Add/Run/Exp│  │  File rows   │  │  Codec / SVGO /    │ │
│  └────────────┘  └─────────────┘  └──────┬───────┘  │  Output / Report   │ │
│                                          │          └─────────┬──────────┘ │
│                  ┌───────────────────────┴────────────────────┘            │
│                  │                                                          │
│        ┌─────────▼─────────┐    ┌──────────────────┐   ┌─────────────────┐ │
│        │   Center / Compare│    │  StatusBar       │   │ Toasts / CmdK   │ │
│        │   split slider    │    │  worker telemetry│   │                 │ │
│        └─────────┬─────────┘    └──────────────────┘   └─────────────────┘ │
│                  │                                                          │
│  ════════════════╪══════════════════════════════════════════════════════   │
│                  │  React selectors  ↔  Zustand stores (slices)             │
│  ┌───────────────▼─────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ filesStore (Map<id,File>)   │ │ settingsStore│ │ presetsStore (idb) │  │
│  │ queue, status, results,     │ │ global +     │ │ named bundles      │  │
│  │ variants, blobs, snippets   │ │ per-file     │ │                    │  │
│  └───────────────┬─────────────┘ └──────┬───────┘ └────────────────────┘  │
│                  │                      │                                  │
│  ┌───────────────▼──────────────────────▼──────────────┐                  │
│  │            PipelineOrchestrator (TS, main thread)    │                  │
│  │  • plans jobs (file → variants → encodes)            │                  │
│  │  • dispatches to WorkerPool via Comlink              │                  │
│  │  • aggregates results, emits progress events         │                  │
│  └───────────────┬──────────────────────────────────────┘                  │
└──────────────────┼──────────────────────────────────────────────────────────┘
                   │  Comlink (postMessage + structured clone + Transferables)
┌──────────────────▼──────────────────────────────────────────────────────────┐
│                       WORKER POOL  (navigator.hardwareConcurrency, capped 8)│
│  Each worker is a generic codec host — chooses adapter per job:             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ codecHost.worker.ts → import on demand:                              │   │
│  │   svgo (vector)  · @jsquash/oxipng · @jsquash/mozjpeg                │   │
│  │   @jsquash/webp · @jsquash/avif · @jsquash/png · @jsquash/jpeg       │   │
│  │   @jsquash/resize (or canvas-based fallback)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  Transferables: ArrayBuffer in (source bytes) → ArrayBuffer out (encoded)   │
└──────────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼  fflate (main thread, streaming) → Blob → download
            ┌──────────────────┐
            │  ZIP Exporter    │
            └──────────────────┘
```

### Component responsibilities

| Component | Owns | Implementation |
|-----------|------|----------------|
| **UI components** | Rendering, user input, selection | React 18 functional components, ported from `example-ui/` using Use `ui.shadcn.com/docs/components` |
| **filesStore** (Zustand slice) | File list, per-file state machine, results map, variants, snippets | Zustand + Immer middleware |
| **settingsStore** (Zustand slice) | Global codec/resize/metadata settings + per-file overrides | Zustand, persisted slice for last-used |
| **presetsStore** | Named user presets | Zustand + idb-keyval (IndexedDB) |
| **PipelineOrchestrator** | Plans jobs from file+settings, dispatches, aggregates | Plain TS class, holds WorkerPool ref |
| **WorkerPool** | Pool of generic codec workers, round-robin/least-busy dispatch, lazy spawn | Custom `WorkerPool` wrapped around `Comlink.wrap()` |
| **Codec adapter** | Encode + decode + getDefaults for one format | Pure functions matching `CodecAdapter<TOptions>` interface |
| **SnippetGenerator** | Build `<picture>`, `<img srcset>`, CSS data URI, inline SVG strings from results | Pure utils, runs on main thread after results land |
| **ZIP Exporter** | Stream results into a ZIP | `fflate.zipSync` or async streaming variant |

---

## 2. Recommended Project Structure

```
src/
├── app/                       # App shell, routing, providers
│   ├── App.tsx
│   ├── theme.ts               # oklch tokens lifted from OIMG.html
│   └── shortcuts.ts           # global keyboard handlers (CmdK, /)
│
├── ui/                        # React components, design system
│   ├── components/            # primitives: Popover, Tooltip, Toggle, Slider, Seg, Section
│   ├── layout/                # TitleBar, Toolbar, StatusBar, WorkArea
│   ├── panes/
│   │   ├── QueuePane.tsx      # left pane (file list, dropzone, totals)
│   │   ├── ComparePane.tsx    # center (split slider, delta strip)
│   │   └── InspectorPane.tsx  # right (CodecPanel, SvgoPanel, OutputPanel, ReportPanel)
│   ├── cmdk/                  # command palette
│   └── tweaks/                # dev-only TweaksPanel (port of tweaks-panel.jsx)
│
├── state/                     # Zustand stores
│   ├── files.store.ts         # files map, status, results, variants, snippets
│   ├── settings.store.ts      # global + per-file overrides + selectors
│   ├── presets.store.ts       # IndexedDB-backed presets
│   ├── ui.store.ts            # ephemeral: selectedId, tab, view, popover keys, toasts
│   └── selectors.ts           # memoized derived state (filtered list, totals)
│
├── core/                      # main-thread logic, no React, no DOM beyond Canvas
│   ├── pipeline/
│   │   ├── orchestrator.ts    # PipelineOrchestrator
│   │   ├── plan.ts            # buildJobPlan(file, settings) → Job[]
│   │   └── types.ts           # Job, JobResult, ProgressEvent
│   ├── pool/
│   │   ├── workerPool.ts      # generic Comlink-backed pool
│   │   └── pool.types.ts
│   ├── snippets/
│   │   ├── picture.ts         # <picture> + srcset
│   │   ├── srcset.ts          # <img srcset>
│   │   ├── dataUri.ts         # base64 + URL-encoded SVG (yoksel logic)
│   │   └── inlineSvg.ts
│   ├── export/
│   │   └── zip.ts             # fflate wrapper
│   ├── detect/
│   │   └── format.ts          # magic-byte sniffing + MIME fallback
│   ├── persist/
│   │   ├── idb.ts             # idb-keyval thin wrapper
│   │   └── localPrefs.ts      # theme + last-used in localStorage
│   └── utils/
│       ├── bytes.ts
│       └── tokenize.ts        # snippet syntax highlighting
│
├── codecs/                    # ★ adapter-per-codec (ONE file each, shared interface)
│   ├── adapter.ts             # CodecAdapter<T> interface + registry
│   ├── svg.svgo.ts
│   ├── png.oxipng.ts
│   ├── jpeg.mozjpeg.ts
│   ├── webp.libwebp.ts
│   ├── avif.libavif.ts
│   ├── decode.png.ts          # decode-only adapters (source → ImageData)
│   ├── decode.jpeg.ts
│   ├── decode.webp.ts
│   ├── decode.avif.ts
│   └── resize.ts              # @jsquash/resize wrapper (or pica fallback)
│
├── workers/
│   ├── codecHost.worker.ts    # generic worker, exposes API via Comlink
│   ├── codecHost.api.ts       # the type contract main thread imports
│   └── transfer.ts            # helpers to mark Transferables
│
├── styles/
│   ├── tokens.css             # oklch palette + typography (verbatim from OIMG.html)
│   └── globals.css
│
└── main.tsx
```

### Structure rationale

- **`codecs/` is the extension point.** Adding JPEG XL = one new file implementing `CodecAdapter`, registered in `adapter.ts`. No worker changes, no UI changes (UI reads from registry).
- **`core/` has zero React.** Means the pipeline is unit-testable in Node/Vitest with mocked workers.
- **`state/` is split by domain, not by component.** `files`, `settings`, `presets`, `ui` map to the four orthogonal concerns in `app.jsx`'s flat useState soup.
- **`workers/` holds one generic host.** Per-codec workers (the `ARCH.md` v1 sketch) waste memory and complicate pool sizing. One generic host per pool slot, dynamic-import the codec on demand. jSquash codecs are ~30–80 KB gzipped each; bundle splitter handles lazy-load.

---

## 3. Architectural Patterns

### Pattern 1: Generic Worker + Codec Adapter Registry

**What:** A single `codecHost.worker.ts` exposes `process(job)` via Comlink. It dynamic-imports the right adapter from `codecs/` based on `job.codec`. Adapters are pure, codec-specific functions sharing one interface.

**When:** Always. Don't pre-shard workers by codec.

**Trade-offs:**
- ✓ Pool size is a function of CPU, not codec count.
- ✓ Lazy-loading per worker means a user who only touches SVG never downloads AVIF WASM.
- ✓ Adding a codec = one file.
- ✗ Slightly more bookkeeping inside the worker than per-codec workers — acceptable.

**Adapter interface (this is the contract — keep stable):**

```ts
// codecs/adapter.ts
export type RasterCodec = 'png' | 'jpeg' | 'webp' | 'avif';
export type AnyCodec = RasterCodec | 'svg';

export interface DecodeResult {
  data: Uint8ClampedArray;   // RGBA
  width: number;
  height: number;
}

export interface EncodeInput {
  imageData: { data: Uint8ClampedArray; width: number; height: number };
  options: unknown;          // narrowed per adapter via generic
}

export interface CodecAdapter<TOpts> {
  id: AnyCodec;
  label: string;             // "WebP", "AVIF", …
  bundle: 'jsquash' | 'svgo';
  defaults: TOpts;
  // Lazy WASM init — adapter is responsible for memoizing.
  encode(input: { imageData: DecodeResult; options: TOpts }): Promise<ArrayBuffer>;
  decode?(bytes: ArrayBuffer): Promise<DecodeResult>;     // raster only
  // SVG adapter ignores ImageData and works on text.
  optimizeSvg?(source: string, options: TOpts): Promise<string>;
}

// codecs/adapter.ts (registry)
export const codecRegistry: Record<AnyCodec, CodecAdapter<any>> = {
  svg:  () => import('./svg.svgo').then(m => m.default),
  png:  () => import('./png.oxipng').then(m => m.default),
  jpeg: () => import('./jpeg.mozjpeg').then(m => m.default),
  webp: () => import('./webp.libwebp').then(m => m.default),
  avif: () => import('./avif.libavif').then(m => m.default),
} as any;
```

### Pattern 2: PipelineOrchestrator with Job Plan

**What:** For each file, build a `Job[]` plan: decode → resize-to-1x → resize-to-2x → resize-to-3x → encode-each-variant-as-each-target-format. Orchestrator owns the plan; workers execute leaf jobs only.

**When:** Always — keeps workers stateless, enables retry, enables progress per leaf.

**Trade-offs:**
- ✓ Multi-output files (SVG → SVG + PNG-rasterized + WebP/AVIF) are just fan-out in the plan, no special-cased worker logic.
- ✓ Cancellation is just "stop dispatching pending jobs."
- ✗ Slightly more memory on main thread (decoded ImageData is kept until all encodes for that file finish) — mitigated by ref-count + release.

**Worker message protocol (Comlink-shaped):**

```ts
// workers/codecHost.api.ts
export type Job =
  | { kind: 'svg.optimize';  jobId: string; svgText: string;     options: SvgoOpts }
  | { kind: 'raster.decode'; jobId: string; bytes: ArrayBuffer;  format: RasterCodec }
  | { kind: 'raster.resize'; jobId: string; image: DecodeResult; width: number; height: number; algo: 'lanczos3'|'mitchell'|'catrom'|'triangle' }
  | { kind: 'raster.encode'; jobId: string; image: DecodeResult; codec: RasterCodec; options: unknown };

export type JobResult =
  | { jobId: string; ok: true;  bytes: ArrayBuffer }
  | { jobId: string; ok: true;  text: string }                 // svg
  | { jobId: string; ok: true;  image: DecodeResult }          // decode/resize
  | { jobId: string; ok: false; error: string };

export interface CodecHostAPI {
  process(job: Job): Promise<JobResult>;
}
```

Always pass source bytes as `ArrayBuffer` and **transfer**, not copy. Comlink supports this via `Comlink.transfer(arg, [buffer])`.

### Pattern 3: Zustand Store Slices + Selector-Driven Re-renders

**What:** Three persisted-or-not stores; components subscribe via selectors with shallow-equality to avoid render storms during batch processing.

**When:** Pipeline emits ~100s of progress events per second across files — atomic re-renders matter.

**Why Zustand and not Jotai/RTK/Context:**

| Lib | Verdict | Reason |
|-----|---------|--------|
| **Zustand** | ✅ pick | Single store with slices fits the file-map + settings model; Map-friendly with Immer; cheap selector-based subscriptions; small bundle (~1 KB); no provider boilerplate |
| Jotai | Reasonable runner-up | Atomic re-renders are great, but a `Map<id, FileState>` is awkward as atoms-of-atoms; the orchestrator wants imperative `get()/set()` access which Zustand does naturally outside React |
| Redux Toolkit | No | Boilerplate cost not justified; we don't need devtools' time-travel for a stateless tool |
| useReducer + Context | No | Coarse re-renders on a 200-file queue will jank the UI |

State shape:

```ts
// state/files.store.ts
type FileStatus = 'queued' | 'decoding' | 'processing' | 'done' | 'error';
type Variant = { density: '1x'|'2x'|'3x'; width: number; height: number;
                 outputs: Record<RasterCodec | 'svg', { blob: Blob; bytes: number; url: string } | undefined> };

interface FileEntry {
  id: string;
  name: string;
  sourceFormat: AnyCodec;
  sourceBytes: ArrayBuffer;        // released after all variants encoded
  sourceDensity: '1x'|'2x'|'3x';
  origSize: number;
  status: FileStatus;
  progress: number;                // 0..1
  error?: string;
  variants: Variant[];
  snippets?: { picture: string; img: string; cssDataUri: string; inlineSvg?: string };
  overrides?: PartialSettings;     // per-file overrides on top of global
}

interface FilesState {
  byId: Map<string, FileEntry>;
  order: string[];
  selectedId: string | null;
  // actions
  addFiles(files: File[]): void;
  setStatus(id: string, s: FileStatus): void;
  setProgress(id: string, p: number): void;
  addVariant(id: string, v: Variant): void;
  setSnippets(id: string, s: FileEntry['snippets']): void;
  release(id: string): void;       // free ArrayBuffers/blobs
  remove(id: string): void;
}
```

`settings.store.ts` exposes a selector `getEffectiveSettings(fileId)` that merges global + per-file overrides — components and orchestrator both read through it.

### Pattern 4: Resize in Worker, not Main Thread

**What:** Resize via `@jsquash/resize` (WASM, runs in worker). Fall back to `pica` only if user disables threaded WASM in settings.

**When:** Always prefer worker. Main-thread `<canvas>.drawImage` blocks the UI on big images and produces inferior quality vs lanczos3.

### Pattern 5: Snippets Generated on Main Thread, Driven by Results

**What:** When `addVariant()` lands the last variant for a file, a derived selector calls `buildSnippets(file)` which produces `<picture>`, `<img srcset>`, CSS, inline SVG. Snippets reference per-blob `URL.createObjectURL` URLs (live previews) AND the eventual filenames the ZIP will use (paste-ready output).

**When:** Snippets must reflect actual outputs, so this can only run after the pipeline finishes a file. Cheap (string templating), no need to push to a worker.

### Pattern 6: Memory Budget — Release ArrayBuffers After Last Encode

**What:** Each `FileEntry.sourceBytes` is a ref-counted ArrayBuffer. The orchestrator decrements after every encode that consumed it; when it hits zero, `release(id)` is called. Decoded `ImageData` lives only on the worker side during the encode chain.

**Why:** A 12-file batch of 4032×3024 photos = ~580 MB raw RGBA at peak. Without explicit release, Safari OOMs.

---

## 4. Data Flow

### Request flow (drop → result)

```
[user drops files]
   ↓
QueuePane → filesStore.addFiles()        (creates FileEntry per file, status='queued')
   ↓
orchestrator.enqueue([fileIds])
   ↓
for each file:
   plan = buildJobPlan(file, getEffectiveSettings(file.id))
   for each job in plan:
     pool.dispatch(job)                  (Comlink → free worker)
       ↓
     worker.process(job)
       • dynamic-imports adapter (first time per codec)
       • runs encode/decode/resize on WASM
       • returns JobResult with ArrayBuffer (transferred)
       ↓
     orchestrator.onResult(jobResult)
       • updates filesStore (variant added, progress bumped)
       • when last job lands: build snippets, set status='done'
       ↓
[React selectors re-render only affected rows]
```

### Persistence flow (presets)

```
[user clicks "Save as preset"]
   → presetsStore.save(name, snapshotOfSettings())
   → idb-keyval.set(`preset:${name}`, payload)

[app boot]
   → idb-keyval.keys() → presetsStore.hydrate(...)
   → settingsStore.loadLastUsed() from localStorage
```

---

## 5. example-ui/ Migration Strategy

The prototype is a working visual contract. **Greenfield rewrite using the prototype as a verbatim visual reference**, file-by-file translation, NOT in-place refactor (UMD-React + global `window.MOCK` won't survive the move to ESM/TS without a rewrite anyway).

### Concrete file mapping

| Prototype file | Target file(s) | Strategy |
|---|---|---|
| `OIMG.html` `<style>` block (oklch tokens, layout CSS) | `src/styles/tokens.css`, `src/styles/globals.css` | **Port verbatim.** Copy the CSS as-is into two files, no semantic changes. Locks the visual identity. |
| `app.jsx` (top-level App) | `src/app/App.tsx` + split into `src/ui/layout/*` and `src/ui/panes/*` | **Rewrite**, mining the JSX for layout. Replace useState soup with Zustand selectors. Replace `MOCK.FILES` with `filesStore`. |
| `app.jsx` `Popover`, `Tooltip` primitives | `src/ui/components/Popover.tsx`, `Tooltip.tsx` | **Port nearly verbatim** + add proper portal + focus trap. |
| `panels.jsx` `Section`, `Slider`, `Seg`, `Toggle` | `src/ui/components/*` | **Port verbatim**, type the props. |
| `panels.jsx` `CodecPanel`, `SvgoPanel`, `OutputPanel`, `ReportPanel` | `src/ui/panes/inspector/*` | **Rewrite props plumbing**: instead of ~15 prop pairs from App, read from `settingsStore` via hooks. Keep JSX structure identical. |
| `panels.jsx` `OutputPanel.tokenize` | `src/core/utils/tokenize.ts` | **Port verbatim**, type it. |
| `data.jsx` (`MOCK.FILES`, `SVGO_PLUGINS`, `CODECS`, `RESIZE_ALG`, `FIT_MODES`) | `src/codecs/svgo-plugins.ts`, `src/core/constants.ts`, `tests/fixtures/files.ts` | **Split.** `SVGO_PLUGINS` becomes the actual plugin metadata; `MOCK.FILES` moves to test fixtures; `CODECS`/`RESIZE_ALG`/`FIT_MODES` become real const arrays. |
| `data.jsx` `fmtBytes`, `fmtPct` | `src/core/utils/bytes.ts` | **Port verbatim**, type it. |
| `tweaks-panel.jsx` (`useTweaks`, `TweaksPanel`, controls) | `src/ui/tweaks/*` (dev-only, gated by `import.meta.env.DEV`) | **Port nearly verbatim.** Drop the `window.parent.postMessage` host protocol — useless in standalone build. Keep the components. |
| `icons.jsx` | `src/ui/components/icons.tsx` | **Port verbatim**, switch to inline SVG component pattern, no `Icons.X` global. |

### Migration checklist (use during Phase 1)

1. Stand up Vite+TS skeleton with one route rendering an empty `<App/>`.
2. Copy CSS verbatim → `tokens.css` + `globals.css`. Apply `data-theme` toggle.
3. Port primitives: `Popover`, `Tooltip`, `Toggle`, `Slider`, `Seg`, `Section`, icons.
4. Port `tweaks-panel.jsx` shell as dev-only.
5. Build `filesStore`, `settingsStore`, `uiStore` with mock data so the layout renders.
6. Port `App.tsx` layout (TitleBar, Toolbar, Work area panes, StatusBar) reading from stores.
7. Port `CodecPanel`, `SvgoPanel`, `OutputPanel`, `ReportPanel`, `ComparePane` reading from stores.
8. **Visual diff against `OIMG.html`** in dev — should be pixel-close before any pipeline work.

---

## 6. Suggested Phase Boundaries (Build Order)

The architecture imposes a clear order: scaffolding before pipeline, pipeline before codecs, codecs before snippets, snippets before export.

| Phase | Title | Builds | Why this order |
|---|---|---|---|
| **P1** | Scaffolding + Visual Shell | Vite+TS, design tokens ported, primitives ported, App layout with mock data, `filesStore`/`settingsStore`/`uiStore`, `TweaksPanel` dev shell | UI must exist to drive the pipeline; pipeline without UI is untestable |
| **P2** | Worker Harness + Pool | `codecHost.worker.ts`, `WorkerPool`, Comlink wiring, `CodecAdapter` interface, registry stub, end-to-end "echo" job | Pool must exist before any codec — building codecs in main thread first creates throwaway code |
| **P3** | SVG Pipeline | `svg.svgo` adapter, `PipelineOrchestrator` minimal, `dataUri.ts` (URL-encoded SVG), `inlineSvg.ts`, snippet panel for SVG | SVG is the simplest codec (text in/text out, no decode/resize), validates the whole architecture end-to-end on the easiest case |
| **P4** | Raster Decode + Resize | `@jsquash/png/jpeg/webp/avif` decode adapters, `@jsquash/resize` adapter, ImageData transfer, memory release | Decode + resize must work before encode — encoding without resize ignores 1x/2x/3x requirement |
| **P5** | Raster Encode (PNG, WebP, JPEG, AVIF) | `oxipng`, `libwebp`, `mozjpeg`, `libavif` encode adapters, settings UI wiring | All four encoders share the same shape; build them as a batch once decode/resize lands |
| **P6** | Snippet Generation + Per-File Snippets | `picture.ts`, `srcset.ts`, `dataUri.ts` (base64 raster), full `OutputPanel` wiring | Needs real encoded blobs to template against — can't be earlier |
| **P7** | ZIP Export + Persistence | `fflate` integration, `presets.store` + idb-keyval, theme/last-used in localStorage | Final assembly; depends on results being real |
| **P8** | Polish | A11y pass, keyboard nav, COOP/COEP headers for SAB, Cloudflare Pages config, perf budget enforcement | Cross-cutting, late |

**Parallelizable within a phase:**
- P1: tokens.css, primitives, stores can be built in parallel by 3 devs.
- P5: each codec adapter is one file, four can land in parallel.
- P6: the four snippet generators are independent.

**Hard dependencies (must be sequential):**
- P2 before P3, P4, P5 (no codec lives outside the pool).
- P4 before P5 (decode → encode).
- P5 before P6 (snippet templates need encoded outputs).

---

## 7. Scaling Considerations

This is a single-user, single-tab app. "Scale" here = batch size and asset size, not concurrent users.

| Scale | Adjustments |
|---|---|
| **1–30 files, ≤2 MB each** | Default config: pool size = `min(navigator.hardwareConcurrency, 8)`. Snappy. |
| **30–200 files** | Add chunked dispatch (don't enqueue all 200 jobs at once — keeps progress UI honest, prevents `postMessage` queue from ballooning). Show queue depth in StatusBar. |
| **Single 50 MB+ asset (huge PNG)** | Make sure decode passes ArrayBuffer transferable (we do). Consider OffscreenCanvas decode path as fallback when libpng can't allocate. |
| **Photo bursts (12× 4032×3024)** | Memory pressure is the real ceiling: ~580 MB peak raw RGBA. Enforce sequential decode-and-release per file rather than fan-out, OR cap concurrent decodes at 2 even if pool has 8 slots. |

### Bottlenecks in order

1. **Memory** (biggest risk on Safari/iPad). Mitigate with explicit `release()` and concurrent-decode cap.
2. **Worker spin-up time** (WASM compile is one-time per codec per worker). Mitigate by warm-starting the pool on first idle frame.
3. **Main-thread re-renders** from progress firehose. Mitigate with Zustand selectors + shallow comparison + throttled `setProgress` (16ms).
4. **ZIP encoding** (synchronous fflate on big batches blocks UI). Move to a dedicated worker once batches exceed ~50 MB total output.

---

## 8. Anti-Patterns

### Anti-Pattern 1: One Worker Per Codec
**What:** Spinning up `svg.worker.ts`, `webp.worker.ts`, `avif.worker.ts`, … as in `ARCH.md` §4.1.
**Why wrong:** Wastes RAM (each worker ships V8 + glue). Pool sizing becomes "max(N_codecs, hardwareConcurrency)" — nonsense. Idle codec workers can't help with the active codec.
**Do instead:** Single generic `codecHost.worker.ts`; dynamic-import the right adapter per job.

### Anti-Pattern 2: Decode in Main Thread, Encode in Worker
**What:** Use `<img>` + canvas to decode (because it's "easier"), then ship `ImageData` to worker for encode.
**Why wrong:** Big PNG/JPEG decodes block the UI. Defeats the worker pool.
**Do instead:** Decode in worker via `@jsquash/{png,jpeg,webp,avif}` decode functions. Only fall back to canvas decode for unrecognized formats.

### Anti-Pattern 3: Copying Bytes Between Threads
**What:** `worker.postMessage({ buffer: arrayBuffer })` without transferring.
**Why wrong:** structured-clone copy of a 10 MB image is ~30ms of pure waste, twice (in and out).
**Do instead:** `Comlink.transfer(arg, [arrayBuffer])` on dispatch; return ArrayBuffers from the worker (Comlink handles transfer-on-return when proxied correctly via `Comlink.transferHandlers` or by wrapping the result).

### Anti-Pattern 4: Building Snippets Inside React Components
**What:** Computing the `<picture>` string inside `OutputPanel.tsx` every render.
**Why wrong:** Re-runs on every prop change, hard to test, mixes templating with view.
**Do instead:** `core/snippets/*` pure functions, called once per file completion, result cached on the `FileEntry`.

### Anti-Pattern 5: One Mega Zustand Store
**What:** All state in `useAppStore`.
**Why wrong:** Selectors get confused, persistence is all-or-nothing, store rehydration on app boot is slow.
**Do instead:** Slice by domain (`files`, `settings`, `presets`, `ui`). Persist only `presets` (IDB) and `settings.lastUsed` (localStorage); never persist `files` (privacy).

### Anti-Pattern 6: Leaking ObjectURLs
**What:** `URL.createObjectURL(blob)` for every variant, never revoking.
**Why wrong:** Memory leak; on a 200-file batch each generating 12 URLs (1x/2x/3x × AVIF/WebP/PNG/JPEG), 2400 live blobs is real.
**Do instead:** Centralize in a `BlobURLManager` keyed by variant id; revoke on `release(id)` and on `remove(id)`.

---

## 9. Integration Points

### External Services
| Service | Pattern | Notes |
|---|---|---|
| Cloudflare Pages | Static hosting + `_headers` for `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` | Required for SharedArrayBuffer (multithreaded WASM in oxipng/libavif). Without these, codecs fall back to single-threaded — slower but functional. |

### Internal Boundaries
| Boundary | Communication | Notes |
|---|---|---|
| UI ↔ Stores | Zustand hooks (`useFilesStore(selector, shallow)`) | Components never call orchestrator directly; they dispatch actions through stores or call `orchestrator.enqueue()` exposed on a singleton |
| Stores ↔ Orchestrator | Direct imports (orchestrator reads stores via `getState()`, writes via actions) | Orchestrator is a singleton initialized at app boot |
| Orchestrator ↔ WorkerPool | Method calls (`pool.dispatch(job)`) | Pool returns `Promise<JobResult>` |
| WorkerPool ↔ Workers | Comlink-wrapped `CodecHostAPI` | `Comlink.wrap(worker)` on spawn; transfer ArrayBuffers explicitly |
| Persistence | `idb-keyval` for presets, `localStorage` for theme/last-used | Never store file content |

---

## 10. Sources

- [jSquash — Browser & Web Worker focused image codec WASM](https://github.com/jamsinclair/jSquash) — confirms per-codec packages, worker-first design, ESM.
- [jSquash README — Web Worker example](https://github.com/jamsinclair/jSquash/blob/main/README.md) — confirms `decode`/`encode` shape used in adapter interface.
- [@jsquash/webp on npm](https://www.npmjs.com/package/@jsquash/webp) — version + API surface.
- [Comlink (Google Chrome Labs)](https://github.com/GoogleChromeLabs/comlink) — RPC abstraction over postMessage, used by Squoosh itself.
- [SVGO browser usage](https://github.com/svg/svgo) — v3+ ships ESM browser build, `optimize(svgString, config)` is sync.
- [State management 2025 — Zustand vs Jotai vs Redux](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) — confirms Zustand as pragmatic default.
- [Zustand vs Jotai performance guide](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) — selector-based renders match our progress-firehose need.
- [fflate](https://github.com/101arrowz/fflate) — fastest browser-native zip; smaller than JSZip.
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) — Jake Archibald's minimal IDB wrapper; right size for presets.
- Reference repos in `inspired/`: Squoosh (worker pool + codec glue), SVGOMG (SVGO plugin UX), url-encoder (URL-encoded data URI).
- Existing prototype: `example-ui/app.jsx`, `panels.jsx`, `tweaks-panel.jsx`, `data.jsx` — visual + component contract.

---
*Architecture research for: client-side image optimizer SPA*
*Researched: 2026-04-29*
