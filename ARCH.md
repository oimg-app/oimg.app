# oimg.app — Architecture

> Living architecture document for the All-in-One Image Optimizer. Describes the system **as actually built** in `src/`. For the dependency/stack table and coding conventions see [`CLAUDE.md`](./CLAUDE.md); for milestone planning see [`.planning/ROADMAP.md`](./.planning/ROADMAP.md).

---

## 1. Overview

**oimg.app** is a 100% client-side, zero-server browser tool for web developers. A developer drops a batch of source assets (SVG/PNG/WebP/JPEG/AVIF), tunes output settings once, and walks away with optimized files plus copy-paste production snippets — **nothing leaves the browser**.

It fuses three reference workflows behind one developer-first UX:

- **Squoosh** (Chrome Labs) — WASM raster codecs (MozJPEG, libwebp, libavif, OxiPNG). We use the actively-maintained **jSquash** successor packages.
- **SVGO / SVGOMG** — SVG optimization with per-plugin control (`svgo` v4 browser build).
- **url-encoder (yoksel)** — SVG → `url()`-safe data URIs with minimal encoding.

Privacy is the load-bearing constraint: no server, no telemetry, no analytics, no remote feature flags. Every architectural decision follows from "the bytes never leave the tab."

**Shipped:** v1.0 (UI port), v1.1 (real optimization pipeline). **Active:** v1.2 (PWA, real quality metrics, URL/paste ingest, queue hygiene).

---

## 2. Functional Capabilities

### 2.1 Supported formats

| Format | Decode | Encode / Optimize | Engine |
|---|---|---|---|
| **SVG** | text | minify | `svgo/browser` v4 (`preset-default` + overrides), `dompurify` sanitize |
| **PNG** | `@jsquash/png` | `@jsquash/oxipng` (`level` 0–6) | OxiPNG (Rust); MT when `crossOriginIsolated` |
| **JPEG** | `@jsquash/jpeg` | `@jsquash/jpeg` (`quality`, `progressive`) | MozJPEG |
| **WebP** | `@jsquash/webp` | `@jsquash/webp` (`quality`, `method`, lossy/lossless) | libwebp |
| **AVIF** | `@jsquash/avif` | `@jsquash/avif` (`quality`, `speed`, lossless) | libavif; lazy ~8 MB WASM; Safari < 16.4 decode unsupported |

Cross-format conversion is supported: any accepted source decodes to `ImageData`, then re-encodes to the chosen target codec.

### 2.2 What the pipeline does (per file)

`decode source → (optional) resize → (optional) color-quantize → encode target`

1. **Ingest** (`useIngest`) — drag-drop or file picker. Silent format gate (`png/jpg/jpeg/webp/svg/avif` by extension or MIME). Reads `File.size` and pixel dimensions (`createImageBitmap`, skipped for SVG), maps each `File` → `FileEntry`, seeds per-file default settings, auto-selects the newest, and auto-dispatches optimization.
2. **Resize** (`@jsquash/resize`) — optional. Algorithms `lanczos3 / mitchell / catrom / triangle`. Width-driven with auto height; numeric guards reject blank/NaN input. Fit modes map to jSquash's `stretch`/`contain` (no native `cover`).
3. **Color quantization** (`@squoosh-kit/imagequant`) — optional PNG-8 / palette reduction with `numColors` + `dither`.
4. **Encode** — codec-specific (see table). SVG path is text-in/text-out and bypasses the raster `ImageData` stage.
5. **Metadata** — the raster path is `decode → ImageData → encode`, so EXIF/XMP/IPTC/ICC (which live in the file container, not pixels) are **unconditionally dropped**. `stripMeta` is therefore always honored; `keepIcc` cannot be honored (no jSquash ICC API) and is disabled in the UI.

### 2.3 Output & snippets (`lib/snippets.ts`, `useSnippets`)

All clipboard writes funnel through one chokepoint (`lib/clipboard.ts`):

- **`<picture>`** — `<source srcset type>` + fallback `<img>`; collapses to a bare `<img>` when target is SVG or equals the source format. `width`/`height` from parsed dimensions.
- **`<img>` with data URI** — chunked 32 KB base64 (avoids V8 call-stack blowout on large buffers).
- **CSS `background-image: url(...)`** — SVG uses Yoksel-style minimal URL-encoding; raster falls back to base64.
- **Data URI** — SVG `charset=utf-8` URL-encoded; raster `base64`.
- **Manifest JSON** — batch metadata.

HTML attribute interpolations are escaped (`& " < > '`); SVG control chars are stripped to keep snippets valid.

### 2.4 Export (`useExport`, `lib/build-zip.ts`, `lib/save-blob.ts`)

- **Single** — `showSaveFilePicker` when available, else `file-saver` fallback.
- **ZIP** — `jszip` streaming (`streamFiles: true`, DEFLATE level 1 since codec output is already compressed). Flat layout, filenames sanitized (zip-slip mitigation) and de-duplicated with a collision suffix; timestamped archive name.
- **Individually** — bulk save uses fallback delivery only (never N native dialogs), with an 80 ms inter-save delay for Safari/Chromium throttling.

Only `status === 'done' && encodedBuffer != null` entries are exportable; skipped counts surface in a toast. Empty input throws `NO_EXPORTABLE_FILES`.

### 2.5 Live re-encode (`useLiveEncode`)

Inspector edits trigger a **300 ms debounced** single-file re-encode against the worker pool. A monotonic sequence token drops superseded/stale results so a slow job never overwrites a newer one or the wrong file.

### 2.6 Watch folder (`useWatchFolder`, `lib/dir-picker.ts`)

`showDirectoryPicker` snapshot-ingests every accepted image (one level, no recursion). On supporting browsers (Chrome 132+) a `FileSystemObserver` auto-ingests newly added files.

### 2.7 Batch & backpressure

Bounded worker pool with a job queue; per-file status streams `queued → processing → done/error` live. A `BackpressureIndicator` reflects running/queued counts. Per-file failures are isolated — one bad file never aborts the batch.

---

## 3. Non-Functional Requirements

- **Privacy (zero-server):** all compute is client-side via Web Workers + WASM. No network egress of user bytes. Test-only instrumentation is tree-shaken from production (`import.meta.env.MODE === 'test'` gate).
- **Performance:** initial route < 200 KB JS gzipped — **all codec WASM is dynamically imported inside the worker**, never at module top level. AVIF's ~8 MB blob loads only when the AVIF branch runs. Worker concurrency is bounded to `min(navigator.hardwareConcurrency, 4)`.
- **Compatibility:** modern browsers with WebAssembly + Web Workers + OffscreenCanvas. Requires `crossOriginIsolated` (COOP/COEP) for OxiPNG multithreading; the app logs an error if it's false. Graceful fallbacks for missing `showOpenFilePicker` / `showSaveFilePicker`.
- **Accessibility:** WCAG AA — `role="application"`, keyboard nav, ⌘K/Ctrl-K command palette, Escape to dismiss, ARIA on primitives (shadcn/Radix/Base UI).
- **Theming:** dark default + light, via `data-theme` + `html.dark` class driven from `uiAtom.theme`.

---

## 4. Technology Stack (summary)

React 19 · Vite 7 · TypeScript 5.9 · Tailwind CSS v4 · **nanostores** for state · **Comlink** worker RPC · **jSquash** raster codecs + **@squoosh-kit/imagequant** quantization · **svgo** v4 + **dompurify** · **jszip** / **file-saver** export · shadcn-style UI on **radix-ui** + **@base-ui/react** + **cmdk** + **react-resizable-panels** + **sonner**.

Full pinned table and rationale: [`CLAUDE.md` → Technology Stack](./CLAUDE.md). `package.json` is the source of truth.

---

## 5. Architecture

### 5.1 Runtime topology

```
┌──────────────────────────── Main thread (React) ────────────────────────────┐
│  components/                                                                  │
│    shell/   TitleBar · Toolbar · StatusBar · CommandPalette ·                 │
│             BackpressureIndicator · AppShell (3-pane resizable)               │
│    panels/  FilesPane | CenterPane | InspectorPane                            │
│               inspector/ (Codec · Svgo · Output · Report)                     │
│               center/    (CompareStage · DeltaStrip · CenterHeader)           │
│               files/     (FileRow)                                            │
│    ui/      shadcn-style primitives                                           │
│                                                                              │
│  hooks/  useIngest · useOptimize · useLiveEncode · useExport ·                │
│          useSnippets · useWatchFolder      (all orchestration lives here)     │
│                                                                              │
│  stores/ (nanostores)  files · settings · ui · runtime                        │
│                                                                              │
│  lib/    worker-pool · snippets · clipboard · build-zip · save-blob ·         │
│          filename · commands · format · estimate-download · dir-picker ·      │
│          stub-data (domain types) · utils (cn)                                │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                     │ Comlink (postMessage + transferable ArrayBuffers)
┌────────────────────────────────────▼─────────────────────────────────────────┐
│  WorkerPool singleton (lib/worker-pool.ts)                                    │
│    size = min(hardwareConcurrency, 4) · job queue · onCountChange → runtime   │
│                                                                              │
│  workers/codec.worker.ts  (Comlink.expose { optimize })                       │
│    decodeSource → maybeResize → maybeReduceColors → encode                    │
│    every codec import is dynamic, inside its switch branch (PIPE-02)          │
│    returns Comlink.transfer(result, [buffer])  (zero-copy)                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 State (nanostores)

| Store | Holds | Notable computeds |
|---|---|---|
| `files` | `filesAtom` — entries, selection, filter, sort | `$filteredFiles`, `$selectedFile`, `$totals`, `$hasDone` |
| `settings` | global default codec/resize/quantize/SVGO settings | `applyToAll()` pushes globals onto every entry |
| `ui` | view/tab/split/zoom, command-palette state, theme | `$cmdFlat` (filtered commands) |
| `runtime` | job counts, toasts, `encodingFileId`, watched-folder handle | — |

**Invariants:**
- `ui.ts` and `settings.ts` must not import `files.ts`/`runtime.ts` (or each other) at module level — cross-store actions use lazy `import('@/stores/...')` to break the ESM cycle. Type-only imports are fine.
- Every per-entry mutation goes through a single `updateEntry(id, patch)` funnel (synchronous read-map-write) so concurrent writers can't interleave a stale snapshot.
- Domain types live in `lib/stub-data.ts`, which **components never import directly** — they re-export from `@/stores`.

### 5.3 Optimize data flow

```
ingest(files)                       buildJobs from filesAtom.get()       per-promise streaming
  format gate ─▶ File→FileEntry ─▶  (skip 'done'; validate codec &  ─▶   pool.run(job, onDispatch)
  seed settings, cache rawBuffer    source format; rawBuffer.slice(0))    ├─ onDispatch → setFileProcessing
  auto-select newest                                                      ├─ resolve  → setFileResult
  runOptimize()  ───────────────────────────────────────────────────────▶└─ reject   → setFileError + toast
                                                                          computeds update UI ($totals, $hasDone)
```

**Stale-closure discipline:** hooks call `useStore(filesAtom)` to drive re-renders, but every async method reads `filesAtom.get()` **inside its body** — never the `useStore` snapshot — because callers fire synchronously after `setKey`, before React re-renders. All N pool jobs are created in one synchronous `.map()` then `Promise.all`-ed (never `await` inside the loop, which would serialize concurrency to 1).

### 5.4 Worker pipeline rules

- One worker module (`codec.worker.ts`), one exposed method (`optimize`). `new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })` uses a **literal URL** (Vite static-analysis requirement).
- Codec WASM imports are dynamic and branch-local (`import('@jsquash/...')` inside each `case`). Never hoist them.
- Buffers cross the boundary as transferables; dispatch passes `rawBuffer.slice(0)` so the cached original survives the transfer.
- Input is validated against a known-codec/known-source-format allowlist before dispatch; malformed/empty buffers reject the job promise without crashing the worker.

### 5.5 UI layout

`AppShell` renders a fixed `TitleBar` + `Toolbar`, a horizontal `ResizablePanelGroup` (Files 20% · Center 55% · Inspector 25%), a `StatusBar`, the `CommandPalette`, and the `BackpressureIndicator`. Global keydown handles ⌘K/Ctrl-K (open palette) and Escape (close palette + popovers).

### 5.6 Build & WASM config (`vite.config.ts`)

- `worker.format: 'es'` — ES-module workers so dynamic codec imports code-split.
- `assetsInclude: ['**/*.wasm']` — serve WASM as binary assets.
- `optimizeDeps.include: ['svgo/browser','dompurify']` (pre-bundle large ESM graphs); `exclude` all `@jsquash/*` (their `new URL(...wasm, import.meta.url)` resolution breaks under esbuild flattening).
- `@squoosh-kit/vite-plugin` wires squoosh-kit WASM resolution.
- Dev server sets `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` for `crossOriginIsolated`. Cloudflare Pages mirrors these via `public/_headers`.
- Path alias `@/` → `src/`.

---

## 6. Testing

Two kinds under `src/tests/`:

- **Playwright e2e** — `*.spec.ts`, `npm test` (chromium, dev server auto-started on port 5174). Specs may import production source via `page.evaluate('/src/...')` (accepted Vite pattern).
- **Node unit** — `*.test.ts`, run via `node --experimental-strip-types` with `_alias-loader.mjs` resolving the `@/` alias. `npm run test:bundle` checks the bundle budget.

Build: `npm run build` = `tsc -b && vite build` (project references — use `tsc -b`, not `tsc -p`).

---

## 7. Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **v1.0 — UI Port** | Three-pane shell, panels, command palette, theming | ✅ Shipped 2026-05-25 |
| **v1.1 — Real Pipeline** | jSquash + svgo adapters, worker pool, ingest, live re-encode, resize, quantize, snippets, ZIP/single/bulk export, watch folder | ✅ Shipped 2026-06-03 |
| **v1.2 — Polish, Diagnostics, PWA + Quality Metrics** | Installable PWA, real SSIM + Butteraugli metrics, real diagnostic values, URL/paste ingest, queue hygiene | 🚧 Active |

### Candidate future work (not committed)

- Side-by-side split-slider compare with real before/after quality scoring.
- `srcset`/`sizes` multi-density (1x/2x/3x) variant generation.
- Auto mode targeting a Butteraugli distance.
- JPEG XL when a stable browser-WASM encoder is viable.

---

## 8. Known Limitations (by design)

- **Metadata:** raster optimization always strips EXIF/XMP/IPTC/ICC (container data is lost at the `ImageData` boundary). `keepIcc` is not wirable with current jSquash APIs and is disabled in the UI.
- **Resize fit:** jSquash exposes only `stretch`/`contain`; `cover` and `contain` both map to `contain`, `fill` maps to `stretch`. True letterbox-contain vs cover-crop are not separately expressible.
- **AVIF:** ~8 MB WASM (lazy-loaded); decode fails on Safari < 16.4 (BigInt) — surfaced as a per-file error + toast, never a crash.
- **Watch folder:** one directory level, no recursion; auto-ingest of new files needs `FileSystemObserver` (Chrome 132+).
- **Threading:** OxiPNG multithreading requires `crossOriginIsolated`; without COOP/COEP it falls back to single-threaded.
