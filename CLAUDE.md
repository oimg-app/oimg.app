<!-- GSD:project-start source:PROJECT.md -->
## Project

**oimg.app — All-in-One Image Optimizer**

A 100% client-side, zero-server browser tool that lets web developers batch-optimize SVG/PNG/WebP/JPEG/AVIF assets, resize and color-quantize them, and copy production-ready snippets (`<picture>` with srcset, `<img>`, CSS `background-image` data URI, inline SVG, manifest JSON). It fuses the workflows of Squoosh + SVGOMG + url-encoder behind a unified developer-first UX.

**Core Value:** A developer drops a folder of source assets, picks output settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.

If everything else fails, the upload → adjust → download-with-snippets pipeline must work flawlessly for SVG and PNG.

**Status:** v1.0 (UI port) and v1.1 (real optimization pipeline) shipped. v1.2 (Polish, Diagnostics, PWA + Quality Metrics — installable PWA, real SSIM/Butteraugli metrics, URL/paste ingest, queue hygiene) is active. See `.planning/ROADMAP.md`.

### Constraints

- **Tech stack**: React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS v4. State via **nanostores** (not zustand). Chosen for ecosystem depth, worker-friendly atoms, and component reuse across the workflow panes.
- **Raster codecs**: **jSquash** per-codec packages — `@jsquash/jpeg` (MozJPEG), `@jsquash/webp`, `@jsquash/avif`, `@jsquash/oxipng`, `@jsquash/png`, `@jsquash/resize`. There is no `@jsquash/mozjpeg` — JPEG encode lives in `@jsquash/jpeg`. **Color quantization** uses `@squoosh-kit/imagequant` (libimagequant), wired through `@squoosh-kit/vite-plugin`.
- **SVG engine**: `svgo` v4, imported as `svgo/browser` — direct ESM, no Node shims. `optimize()` is **synchronous** in the browser build. `dompurify` sanitizes SVG.
- **License**: MIT — matches dep licenses (jSquash MIT, SVGO MIT, Squoosh code Apache 2.0 used as reference only).
- **Privacy**: Zero-server, zero-telemetry — non-negotiable, drives every architectural decision (no error tracking SaaS, no analytics, no remote feature flags).
- **Compatibility**: Modern browsers with WebAssembly + Web Workers + OffscreenCanvas (Chrome, Firefox, Safari, Edge — last 2 stable). No IE/legacy. AVIF decode drops Safari < 16.4.
- **Hosting**: Cloudflare Pages — free tier, edge CDN. Requires COOP/COEP headers for `crossOriginIsolated` (OxiPNG multithreading); the Vite dev server already sets them.
- **Performance**: Initial route < 200KB JS gzipped — all codec WASM is lazy-imported inside the worker. Per-file optimize < 100ms for files ≤ 2MB.
- **Accessibility**: WCAG AA — keyboard navigation, ARIA, contrast — required, not optional.
- **Visual identity**: Design tokens (oklch palette, Inter + JetBrains Mono + Geist, accent green ~145°, dark default + light theme) are locked in `src/index.css` / `src/styles/legacy.css`.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:package.json -->
## Technology Stack

> Verify against `package.json` — this table is the source of truth as of the last edit, but `package.json` wins on any disagreement.

### Core framework
| Package | Pinned | Role |
|---|---|---|
| `react` / `react-dom` | `^19.2` | UI. `useTransition`/`useDeferredValue` for non-blocking codec runs. |
| `vite` | `^7.3` | Bundler/dev server. ES-module workers (`worker.format: 'es'`), WASM as binary assets. |
| `@vitejs/plugin-react` | `^5.2` | Fast Refresh. |
| `typescript` | `^5.9` | Project-references build (`tsc -b`). |
| `tailwindcss` + `@tailwindcss/vite` | `^4.1` | Styling. Tailwind v4 (CSS-first config, no `tailwind.config.js`). |

### State
| Package | Pinned | Role |
|---|---|---|
| `nanostores` | `^1.3` | `map`/`atom`/`computed` stores. ~1 KB, works in workers. |
| `@nanostores/react` | `^1.1` | `useStore` React binding. |

### Raster codecs — jSquash (lazy-loaded in worker)
| Package | Pinned | Underlying codec | Notes |
|---|---|---|---|
| `@jsquash/png` | `^3.1` | rust-png | Decode PNG → ImageData. |
| `@jsquash/oxipng` | `^2.3` | OxiPNG (Rust) | PNG optimize (encode-only). `level` 0–6. MT build needs COOP/COEP. |
| `@jsquash/jpeg` | `^1.6` | MozJPEG | Encode + decode. `quality`, `progressive`. |
| `@jsquash/webp` | `^1.5` | libwebp | Encode + decode. `quality` 0–100, `method` 0–6, lossy/lossless. |
| `@jsquash/avif` | `^2.1` | libavif | Encode + decode. ~8 MB WASM — lazy-load ONLY in the AVIF branch. Safari < 16.4 decode fails (BigInt). |
| `@jsquash/resize` | `^2.1` | lanczos3/mitchell/catrom/triangle | Resize before encode. Only `stretch`/`contain` fit methods (no native `cover`). |

### Color quantization — squoosh-kit
| Package | Pinned | Role |
|---|---|---|
| `@squoosh-kit/imagequant` | `0.2.4` | `quantize(imageData, {numColors, dither})` for PNG-8 / palette reduction. |
| `@squoosh-kit/vite-plugin` | `0.2.4` | Wires `@squoosh-kit/*` WASM resolution; configured in `vite.config.ts`. |

> `@squoosh-kit/{png,mozjpeg,webp,avif}` are also installed but the worker currently uses **jSquash** for decode/encode and squoosh-kit only for `imagequant`. Don't add a second encode path without a reason.

### SVG
| Package | Pinned | Role |
|---|---|---|
| `svgo` | `^4.0` | Import `svgo/browser`; `preset-default` + per-plugin `overrides`. `optimize()` is synchronous. |
| `dompurify` | `^3.4` | Sanitize SVG markup. |

### Worker / files / export
| Package | Pinned | Role |
|---|---|---|
| `comlink` | `^4.4` | Promise-wraps the codec worker; `Comlink.transfer` for zero-copy ArrayBuffers. |
| `jszip` | `^3.10` | Batch ZIP export. |
| `file-saver` | `^2.0` | Save fallback where `showSaveFilePicker` is unavailable. |

### UI primitives
| Package | Pinned | Role |
|---|---|---|
| `radix-ui` (unified) + `@base-ui/react` | `^1.4` | Underlie the shadcn-style components in `src/components/ui`. |
| `shadcn` (dev) | `^4.7` | Component generator; vendored components live in `src/components/ui`. |
| `cmdk` | `^1.1` | Command palette. |
| `react-resizable-panels` | `^4.11` | Resizable pane layout. |
| `sonner` | `^2.0` | Promise-based toasts (mounted once in `App.tsx`). |
| `next-themes` | `^0.4` | Dark/light theme. |
| `lucide-react` + `@phosphor-icons/react` | — | Icons. |
| `class-variance-authority` + `clsx` + `tailwind-merge` (`cn` in `src/lib/utils.ts`) | — | Class composition. |
| `@fontsource-variable/{geist,inter,jetbrains-mono}` | `^5.2` | Self-hosted fonts. |

### Rejected / not used
zustand (→ nanostores), Vite 8 (→ Vite 7), individual `@radix-ui/react-*` packages (→ unified `radix-ui` + shadcn), `@squoosh/lib` (archived → jSquash), `idb-keyval`/`react-colorful` (not currently needed).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:codebase -->
## Conventions

**Where logic lives**
- **Business logic belongs in `src/hooks/*` and `src/stores/*`, never inline in components.** Components wire DOM events to hook methods and render store state. Hooks: `useIngest`, `useOptimize`, `useLiveEncode`, `useExport`, `useSnippets`, `useWatchFolder`.
- `src/lib/stub-data.ts` is the single source of domain types (`FileEntry`, `FileSettings`, `Codec`, `SvgoPlugin`, `SVGO_PLUGINS`, `CODECS`, etc.). **Components must NOT import `stub-data` directly** — import types/constants from the store barrel (`@/stores`), which re-exports them. Only stores and tests import `stub-data`.

**nanostores discipline**
- Stores are `map`/`atom`; derived state is `computed` (`$filteredFiles`, `$selectedFile`, `$totals`, `$hasDone`, `$cmdFlat`). Actions are plain exported functions that call `atom.setKey(...)`.
- **Circular-ESM guard**: `ui.ts` and `settings.ts` must NOT import `files.ts`/`runtime.ts` (or each other) at module level. Cross-store actions (e.g. `applyToAll`, worker-count callbacks) use lazy `import('@/stores/...')` inside the function body. Type-only imports are fine (erased at build).
- Per-entry mutations on `filesAtom` go through the single `updateEntry(id, patch)` funnel (synchronous read-map-write, no `await` between read and write) so concurrent writers can't interleave a stale snapshot.

**Hook pattern (stale-closure avoidance)**
- A hook calls `useStore(filesAtom)` to drive re-renders, but its async methods read `filesAtom.get()` **directly inside the body** — never the `useStore` snapshot — because callers (e.g. `useIngest` → `runOptimize`) fire synchronously after `setKey` before React re-renders. Copy this pattern in new hooks (`useOptimize` is the canonical analog).

**Worker pipeline**
- One worker module: `src/workers/codec.worker.ts`, exposed via `Comlink.expose`. `WorkerPool` (`src/lib/worker-pool.ts`) is a singleton (`getPool()`) with bounded concurrency `min(hardwareConcurrency, 4)` and a job queue.
- **Codec WASM imports are dynamic and live inside their `switch` branch** (PIPE-02 discipline) so the AVIF ~8 MB blob and other codecs stay out of the initial route. Never hoist a codec `import` to the top of the worker.
- Worker `new Worker(new URL('../workers/codec.worker.ts', import.meta.url), {type:'module'})` must use a **literal URL string** — Vite static analysis requires it.
- Return encoded buffers with `Comlink.transfer(result, [buffer])` (zero-copy). When dispatching, pass `rawBuffer.slice(0)` so the cached original survives the transfer.
- Per-file failures reject only that job's promise (caught → `setFileError` + toast); a batch never aborts on one bad file.

**Comments**
- Source carries `Phase NN — …` / `Quick …` provenance tags tied to `.planning/` artifacts and decision IDs (D-xx, WR-xx, T-xx, CR-xx). Keep this style when editing — it links code to its plan/decision.

**Imports**: use the `@/` alias (→ `src/`) everywhere except `settings.ts`'s value import of `stub-data`, which uses a relative `../lib/stub-data.ts` path so the Node `--experimental-strip-types` unit runner can resolve it.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:codebase -->
## Architecture

```
Main thread (React)                          Web Worker (Comlink)
─────────────────────                        ────────────────────
components/  ──renders──▶ stores/ (nanostores)
  shell/      AppShell, TitleBar, Toolbar,      codec.worker.ts
              StatusBar, CommandPalette,          decodeSource → maybeResize
              BackpressureIndicator               → maybeReduceColors → encode
  panels/     FilesPane | CenterPane |            (jSquash + svgo/browser +
              InspectorPane                        @squoosh-kit/imagequant,
                inspector/ (Codec, Svgo,           all dynamic-imported)
                  Output, Report)                       ▲
                center/ (CompareStage, …)              │ Comlink.transfer
                files/  (FileRow)                       │
  ui/         shadcn-style primitives          lib/worker-pool.ts
                                                  WorkerPool singleton,
hooks/  ──orchestrate──▶ getPool()  ────────────▶ concurrency = min(hwConc,4)
  useIngest, useOptimize, useLiveEncode,
  useExport, useSnippets, useWatchFolder
```

**Stores** (`src/stores/`, barrel `index.ts` re-exports files/ui/runtime; `settings` imported directly):
- `files.ts` — `filesAtom` (entries, selection, filter, sort) + computeds + per-entry actions (`setFileResult`, `setFileError`, `setFileProcessing`, `setFileRawBuffer`, `setFileSettings`).
- `settings.ts` — global default `settingsAtom`; `applyToAll()` pushes globals onto every entry's per-file settings.
- `ui.ts` — view/tab/split/zoom, command-palette state, theme, row menu.
- `runtime.ts` — job counts (from `WorkerPool.onCountChange`), toasts, `encodingFileId`, watched-folder handle.

**Data flow (optimize):** ingest (`useIngest`: format gate → `File`→`FileEntry` map → seed `defaultFileSettings`) → `runOptimize` builds `EncodeJob[]` from live `filesAtom.get()` → `pool.run(job, onDispatch)` per file, streaming `setFileResult`/`setFileError` back as each worker returns → computeds (`$totals`, `$hasDone`) update the UI → export/snippets hooks read results.

**lib/** helpers: `worker-pool`, `snippets`, `clipboard` (single copy chokepoint), `filename`, `build-zip`, `save-blob`, `dir-picker`, `commands`, `format`, `estimate-download`, `utils` (`cn`), `stub-data`.

**Build & WASM (`vite.config.ts`):** `worker.format: 'es'`; `assetsInclude: ['**/*.wasm']`; `optimizeDeps.include: ['svgo/browser','dompurify']` and `exclude` all `@jsquash/*` (they embed WASM via URL resolution that breaks under esbuild bundling); dev-server COOP/COEP headers for `crossOriginIsolated`.
<!-- GSD:architecture-end -->

<!-- GSD:testing-start source:package.json + playwright.config.ts -->
## Testing & Build

Two test kinds live in `src/tests/`:

- **Playwright e2e** — `*.spec.ts`, run with `npm test` (chromium, dev server on port 5174, started automatically). `testMatch: '**/*.spec.ts'`.
- **Node unit tests** — `*.test.ts`, run directly via `node --experimental-strip-types` using `src/tests/_alias-loader.mjs` to resolve the `@/` alias. `npm run test:bundle` runs the build/bundle-budget check.

**Build**: `npm run build` = `tsc -b && vite build`.
- Use **`tsc -b`** (project references via `tsconfig.app.json` + `tsconfig.node.json`), **not** `tsc -p` — `-p` reports a false clean.
- The baseline typecheck currently carries pre-existing debt (red). Don't assume a red `tsc` means your change broke it; compare against baseline.
- e2e specs that import production source via `page.evaluate('/src/...')` are an accepted Vite pattern.
<!-- GSD:testing-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Planning artifacts live in `.planning/` (`ROADMAP.md`, `STATE.md`, `PROJECT.md`, phase dirs). Before using Edit/Write, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
