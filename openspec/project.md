# Project Context — oimg.app

> Shared context for AI agents drafting OpenSpec change proposals and specs.
> Synthesized from `.planning/codebase/*` and kept consistent with `/CLAUDE.md`.
> When this file and `CLAUDE.md` disagree, `CLAUDE.md` and `package.json` win.

## Purpose

**oimg.app** is a 100% client-side, zero-server browser tool for batch image optimization. It fuses the workflows of Squoosh + SVGOMG + url-encoder behind a unified developer-first UX.

**Core user value:** a developer drops a folder of source assets (SVG / PNG / WebP / JPEG / AVIF), picks output settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets (`<picture>` + srcset, `<img>`, CSS `background-image` data URI, inline SVG, manifest JSON) — **without anything leaving the browser**.

If everything else fails, the upload → adjust → download-with-snippets pipeline must work flawlessly for SVG and PNG.

## Tech Stack

Pinned versions are indicative; `package.json` is the source of truth on disagreement.

### Core

| Package | Pinned | Role |
|---|---|---|
| `react` / `react-dom` | ^19.2 | UI. `useTransition` / `useDeferredValue` for non-blocking codec runs. |
| `vite` | ^7.3 | Bundler + dev server. `worker.format: 'es'`, WASM as binary assets. |
| `@vitejs/plugin-react` | ^5.2 | Fast Refresh. |
| `typescript` | ^5.9 | Project references (`tsc -b`), `moduleResolution: "bundler"`, `@/*` → `./src/*`. |
| `tailwindcss` + `@tailwindcss/vite` | ^4.1 | CSS-first config (no `tailwind.config.js`). |

### State

| Package | Pinned | Role |
|---|---|---|
| `nanostores` | ^1.3 | `map` / `atom` / `computed` stores; ~1 KB; worker-friendly. |
| `@nanostores/react` | ^1.1 | `useStore()` React binding. |

### Raster codecs (jSquash, lazy-loaded inside the worker)

| Package | Pinned | Underlying codec | Notes |
|---|---|---|---|
| `@jsquash/png` | ^3.1 | rust-png | Decode PNG → ImageData. |
| `@jsquash/oxipng` | ^2.3 | OxiPNG (Rust) | Encode-only; `level` 0–6; MT build needs COOP/COEP. |
| `@jsquash/jpeg` | ^1.6 | MozJPEG | Encode + decode. |
| `@jsquash/webp` | ^1.5 | libwebp | Encode + decode. |
| `@jsquash/avif` | ^2.1 | libavif | ~8 MB WASM — lazy-load **only** in AVIF branch. Safari < 16.4 decode fails (BigInt). |
| `@jsquash/resize` | ^2.1 | lanczos3 / mitchell / catrom / triangle | Only `stretch` / `contain` fit methods (no native `cover`). |

### Color quantization

| Package | Pinned | Role |
|---|---|---|
| `@squoosh-kit/imagequant` | 0.2.4 | `quantize(imageData, { numColors, dither })` for PNG-8 / palette reduction. |
| `@squoosh-kit/vite-plugin` | 0.2.4 | Wires `@squoosh-kit/*` WASM resolution. |

Other `@squoosh-kit/{png,mozjpeg,webp,avif}` packages are installed but the worker uses jSquash for decode/encode; squoosh-kit is only used for `imagequant`. Don't add a second encode path without a reason.

### SVG

| Package | Pinned | Role |
|---|---|---|
| `svgo` | ^4.0 | Import `svgo/browser`; `optimize()` is **synchronous** in the browser build. |
| `dompurify` | ^3.4 | Post-SVGO sanitization on the main thread (workers lack `document`). |

### Workers, files, export

| Package | Pinned | Role |
|---|---|---|
| `comlink` | ^4.4 | Promise-wraps the codec worker; `Comlink.transfer` for zero-copy ArrayBuffers. |
| `jszip` | ^3.10 | Batch ZIP export. |
| `file-saver` | ^2.0 | Save fallback where `showSaveFilePicker` is unavailable. |

### UI primitives

| Package | Role |
|---|---|
| `radix-ui` (unified) + `@base-ui/react` | Underlie shadcn-style components in `src/components/ui`. |
| `shadcn` (dev) | Component generator; vendored components live in `src/components/ui` (`components.json` uses style `radix-lyra`, phosphor icons). |
| `cmdk` | Command palette. |
| `react-resizable-panels` | Resizable pane layout. |
| `sonner` | Toasts (mounted once in `App.tsx`). |
| `next-themes` | Dark / light theme. |
| `lucide-react` + `@phosphor-icons/react` | Icons. |
| `class-variance-authority` + `clsx` + `tailwind-merge` (`cn` in `src/lib/utils.ts`) | Class composition. |
| `@fontsource-variable/{geist,inter,jetbrains-mono}` | Self-hosted fonts. |

### Rejected / not used — do NOT propose

- `zustand` → replaced by `nanostores`
- Vite 8 → pinned to Vite 7
- Individual `@radix-ui/react-*` packages → unified `radix-ui` + shadcn
- `@squoosh/lib` (archived) → jSquash
- `idb-keyval`, `react-colorful` — not currently needed

## Architecture

Three-layer client-side pipeline. React UI reads nanostores state; store actions drive a WorkerPool singleton; workers lazy-import WASM codec adapters and return zero-copy ArrayBuffers via Comlink.

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
hooks/  ──orchestrate──▶ getPool()  ────────────▶ concurrency = min(hwConc, 4)
  useIngest, useOptimize, useLiveEncode,
  useExport, useSnippets, useWatchFolder
```

### Stores (`src/stores/`)

Barrel `index.ts` re-exports `files` / `ui` / `runtime`. `settings` is imported directly.

- `files.ts` — `filesAtom` (entries, selection, filter, sort) + computeds + per-entry actions.
- `settings.ts` — global default `settingsAtom`; `applyToAll()` pushes globals onto every entry's per-file settings.
- `ui.ts` — view / tab / split / zoom, command palette state, theme, row menu.
- `runtime.ts` — job counts (from `WorkerPool.onCountChange`), toasts, `encodingFileId`, watched-folder handle.

Three module-level singletons plus a `_pool` singleton form a **three-way circular ESM graph** (`files ↔ runtime ↔ settings`). Browser ESM live-binding resolves this at runtime; the Node unit runner does not — see Conventions.

### Data flow — optimize (primary path)

1. **Ingest** (`useIngest`): format gate → `File` → `FileEntry` map → seed `defaultFileSettings`.
2. **Build jobs**: `runOptimize` builds `EncodeJob[]` from a live `filesAtom.get()` snapshot.
3. **Dispatch**: `pool.run(job, onDispatch)` per file (bounded concurrency = `min(hardwareConcurrency, 4)`).
4. **Stream results**: worker returns encoded buffer via `Comlink.transfer`; `setFileResult` / `setFileError` updates per-entry state as each job resolves.
5. **UI recomputes**: `$totals`, `$hasDone`, `$filteredFiles`, `$selectedFile` computeds re-render.
6. **Export / snippets** hooks (`useExport`, `useSnippets`) read completed results on demand.

Per-file failures reject **only that job's** promise (caught → `setFileError` + toast). A batch never aborts on one bad file.

### Data flow — SVG live preview

Debounced 200 ms on settings change → pool enqueues `preview-*` job → prior in-flight previews cancelled via `cancelByPrefix('preview-')` → SVG adapter runs SVGO → **`sanitizeSvg` on the main thread** (workers lack `document`) → `filesAtom.setKey` updates → CenterPane re-renders.

## Conventions

### Where logic lives

- **Business logic belongs in `src/hooks/*` and `src/stores/*` — never inline in components.** Components wire DOM events to hook methods and render store state.
- Canonical hooks: `useIngest`, `useOptimize`, `useLiveEncode`, `useExport`, `useSnippets`, `useWatchFolder`.
- `src/lib/stub-data.ts` is the single source of domain types (`FileEntry`, `FileSettings`, `Codec`, `SvgoPlugin`, `SVGO_PLUGINS`, `CODECS`, …). **Components must NOT import `stub-data` directly** — pull types/constants from the store barrel (`@/stores`), which re-exports them. Only stores and tests import `stub-data`.

### nanostores discipline

- Stores are `map` / `atom`; derived state is `computed`. Actions are plain exported functions that call `atom.setKey(...)`.
- **WR-02 single funnel**: per-entry mutations on `filesAtom` go through `updateEntry(id, patch)` — synchronous read-map-write, no `await` between read and write, so concurrent writers can't interleave a stale snapshot.
- **Circular-ESM guard**: `ui.ts` and `settings.ts` must NOT import `files.ts` / `runtime.ts` (or each other) at module level. Cross-store actions (e.g. `applyToAll`, worker-count callbacks) use **lazy** `import('@/stores/...')` inside the function body. Type-only imports are fine (erased at build). Unit tests must not trigger cross-store calls at module-init time — the Node `--experimental-strip-types` runner does not resolve circular ESM live bindings at init.
- Prefer `store.get()` inside async hook bodies over the `useStore()` snapshot, because callers (e.g. `useIngest` → `runOptimize`) fire synchronously after `setKey` before React re-renders. `useOptimize` is the canonical analog.

### Worker pipeline

- One worker module: `src/workers/codec.worker.ts`, exposed via `Comlink.expose`. `WorkerPool` (`src/lib/worker-pool.ts`) is a singleton (`getPool()`) with bounded concurrency `min(hardwareConcurrency, 4)` and a job queue.
- **PIPE-02 dynamic codec imports**: codec WASM `import(...)` calls live **inside their `switch` branch** so the AVIF ~8 MB blob and other codecs stay out of the initial route. **Never hoist a codec `import` to the top of the worker.**
- **Static adapter paths**: the `ADAPTERS` map in `worker.ts` uses **literal string** `import()` paths only. Template literals (`` `./${format}-adapter.ts` ``) are forbidden — Vite cannot statically analyze them for code splitting; production build would 404.
- Worker constructor must use a **literal URL string**: `new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })`. Vite static analysis requires it.
- Return encoded buffers with `Comlink.transfer(result, [buffer])` (zero-copy). When dispatching, pass `rawBuffer.slice(0)` so the cached original survives the transfer.
- DOMPurify runs **main-thread only** (`src/lib/sanitize-svg.ts`), invoked from pool `onDone` after the SVG adapter returns.

### Comment provenance

Source files carry `Phase NN — …` / `Quick …` / `WR-NN` / `CR-NN` / `D-NN` / `PIPE-NN` / `T-NN-NN` provenance tags tied to `.planning/` artifacts and decision IDs. **Preserve this style when editing** — it links code to its plan / decision. `// CRITICAL:` prefixes non-obvious constraints.

### Imports

- `@/*` alias (→ `src/`) everywhere in application code.
- **Exception**: `src/stores/settings.ts`'s value import of `stub-data` uses a relative `../lib/stub-data.ts` path so the Node `--experimental-strip-types` unit runner can resolve it.
- Named exports only from stores; `src/stores/index.ts` re-exports all three with `export * from './files'` etc. Test-only exports use `__` prefix.

### Codec module split

Each codec is split `[codec]-adapter.ts` (WASM + run logic) + `[codec]-config.ts` (pure settings builder). Config modules must stay **dependency-free** so they run under Node `--experimental-strip-types` for unit tests. Adapter modules import `svgo/browser` or jSquash — browser-bundle only.

## Testing & Build

Tests live in `src/tests/`.

| Kind | Glob | Runner | Notes |
|---|---|---|---|
| Playwright E2E | `*.spec.ts` | `npm test` | Chromium-only; dev server auto-started (port 5174). `testMatch: '**/*.spec.ts'`. E2E specs that import production source via `page.evaluate('/src/...')` are an accepted Vite pattern. |
| Node integration | `*.test.ts` | `node --experimental-strip-types` via `src/tests/_alias-loader.mjs` | Uses `node:test` + `node:assert/strict`. `npm run test:bundle` runs the build / bundle-budget check. |
| Node unit | `*.unit.ts` | `node --experimental-strip-types` | Pure functions only — no WASM, no browser APIs. Requires Node 22+ (strip-types support). |

**Build**: `npm run build` = `tsc -b && vite build`.

- Use **`tsc -b`** (project references via `tsconfig.app.json` + `tsconfig.node.json`), **not** `tsc -p` — `-p` reports a false clean.
- The baseline typecheck currently carries **pre-existing debt (red)**. Do not assume a red `tsc` means your change broke it; compare against baseline.
- **Bundle budget**: initial route < 200 KB JS gzipped. All codec WASM must remain lazy inside the worker.
- **Per-file target**: < 100 ms optimize for files ≤ 2 MB.

## Constraints & Non-Goals

### Non-negotiable constraints

- **Zero-server, zero-telemetry.** No error tracking SaaS, no analytics, no remote feature flags. Drives every architectural decision.
- **MIT licence.** Matches dep licences (jSquash MIT, SVGO MIT; Squoosh code Apache 2.0, used as reference only).
- **Modern browsers only** — WebAssembly + Web Workers + OffscreenCanvas (Chrome, Firefox, Safari, Edge — last 2 stable). No IE / legacy fallbacks.
- **COOP/COEP required** for `crossOriginIsolated` (SharedArrayBuffer → OxiPNG MT, AVIF MT). Set in `vite.config.ts` dev server headers and in `public/_headers` for Cloudflare Pages.
- **AVIF decode drops Safari < 16.4** (BigInt limitation in `@jsquash/avif` 2.x). Playwright is Chromium-only, so this failure mode is invisible until a user reports.
- **Accessibility**: WCAG AA — keyboard navigation, ARIA, contrast — required, not optional.
- **Visual identity**: design tokens (oklch palette, Inter + JetBrains Mono + Geist, accent green ~145°, dark default + light theme) are locked in `src/index.css` / `src/styles/legacy.css` and mirrored in `example-ui/OIMG.html`.

### Deferred features (do not propose new work here without opening a change)

- **VAR-01 / VAR-02** — density variants pipeline polish (target-density mapping, per-variant settings inheritance).
- **PERS-01** — named settings presets (save / load per-format defaults).
- **Web Share Target** — receive files from OS share sheet.
- **Watch-folder polish** — currently a thin `useWatchFolder`; drop-in / diff detection is not production-hardened.
- **Real quality metrics** — SSIM / Butteraugli readouts in `ReportPanel` (v1.2 goal).
- **URL / clipboard-paste ingest** — beyond the current basic path.
- **Queue hygiene** — cancellation semantics, backpressure UI polish.

### Reference-only, do NOT import

- `inspired/` — read-only reference codebases (Squoosh, SVGOMG, url-encoder, `version-0/` prototype).
- `example-ui/OIMG.html` — locked design-token reference. Port tokens verbatim; do not redesign.

## External Integrations

- **Hosting**: **Cloudflare Pages** (free tier, edge CDN) — custom domain `oimg.app`. Static deployment only.
- **CI**: none detected (`.github/workflows` absent). Manual deploy.
- **Analytics / error tracking / remote flags**: **none** — intentional (see Constraints).
- **npm registry**: standard public registry; `package-lock.json` present; `scripts/ensure-rollup-binding.mjs` (postinstall) ensures the correct Rollup native binding.
- **Browser APIs used** (not third-party services, but integration points): File System Access API (`showSaveFilePicker`, `file-saver` fallback for Safari/Firefox), Web Workers, WebAssembly, OffscreenCanvas, SharedArrayBuffer (gated behind COOP/COEP), `crossOriginIsolated` feature detection.
