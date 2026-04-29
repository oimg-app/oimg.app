# Technology Stack — oimg.app

**Project:** oimg.app — All-in-One Image Optimizer (browser-only, zero-server)
**Researched:** 2026-04-29
**Mode:** Stack verification (decisions are pre-locked in `.planning/PROJECT.md`)
**Overall confidence:** HIGH (all versions verified live against npm registry; jSquash + svgo READMEs read directly)

> Read this file as a copy/paste install guide. Each row was verified via `npm view` on 2026-04-29; do not trust the LLM defaults if you re-run `npm install` six months from now — re-pin against `npm view <pkg> version` first.

---

## TL;DR — Install

```bash
# Core framework
npm install react@^19.2 react-dom@^19.2
npm install -D vite@^8.0 @vitejs/plugin-react@^6.0 typescript@^5.9

# WASM raster codecs (jSquash — Squoosh's actively-maintained successor)
npm install @jsquash/webp@^1.5 @jsquash/avif@^2.1 @jsquash/oxipng@^2.3 \
            @jsquash/jpeg@^1.6 @jsquash/png@^3.1 @jsquash/resize@^2.1

# SVG (browser ESM build, no Node shims)
npm install svgo@^4.0

# Batch zip + persistence + saving
npm install jszip@^3.10 idb-keyval@^6.2 file-saver@^2.0

# State + UX primitives (see "Companion libs" section for rationale)
npm install zustand@^5.0 sonner@^2.0 \
            @radix-ui/react-tooltip@^1.2 @radix-ui/react-popover@^1.1 \
            @radix-ui/react-slider@^1.3 react-colorful@^5.6

# Worker plumbing
npm install comlink@^4.4

# Vite WASM helper (only needed for threaded codecs — see §3)
npm install -D vite-plugin-wasm@^3.6
```

**Hosting:** Cloudflare Pages with `_headers` file shipping `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (required for SharedArrayBuffer / threaded OxiPNG/AVIF — see §3).

---

## 1. Core Framework

| Package | Pinned | Latest (2026-04-29) | Rationale |
|---|---|---|---|
| `react` | `^19.2` | 19.2.5 (2026-04-28) | React 19 is GA; `useTransition`, `useDeferredValue`, and Activity API are useful for non-blocking codec runs and preview tabs. |
| `react-dom` | `^19.2` | 19.2.5 | Pair with React. |
| `vite` | `^8.0` | 8.0.10 (2026-04-23) | Vite 8 (Rolldown-Vite is the default bundler in 8.x) — native WASM `import.meta.glob` support, zero-config asset hashing for `.wasm`. |
| `@vitejs/plugin-react` | `^6.0` | 6.0.1 | Standard React Fast Refresh plugin. |
| `typescript` | `^5.9` | 5.9.3 | Stable, all jSquash/svgo `.d.ts` resolve cleanly under `moduleResolution: "bundler"`. |

**Gotcha (Vite 8):** Rolldown changes a few error messages and edge cases around `?url`/`?worker` imports. If you hit a "module not analyzable" error on a WASM import, switch from `import wasm from './x.wasm?url'` to `new URL('./x.wasm', import.meta.url)` — both work but Rolldown is stricter about analyzability.

**Gotcha (React 19):** `forwardRef` is no longer required for ref forwarding on function components — refs are passed as a normal prop. If you port `example-ui/` verbatim, audit any `forwardRef` calls; they still work but lint will nag.

---

## 2. WASM Raster Codecs — jSquash

`@squoosh/lib` was archived by Google in 2023. **jSquash** (by @jamsinclair) is the actively-maintained per-codec successor. Verified live; package owner `jamsinclair`; latest publishes Apr–Aug 2025.

| Package | Pinned | Verified version | Tarball | Underlying codec | Notes |
|---|---|---|---|---|---|
| `@jsquash/webp` | `^1.5` | 1.5.0 (2025-08-11) | ~915 KB unpacked | libwebp | Encode + decode. Quality 0–100, method 0–6, lossy/lossless. |
| `@jsquash/avif` | `^2.1` | 2.1.1 (2025-05-20) | ~8.4 MB unpacked | libavif | Encode + decode. Largest tarball — lazy-load ONLY when user picks AVIF. |
| `@jsquash/oxipng` | `^2.3` | 2.3.0 (2024-06-18) | ~452 KB unpacked | OxiPNG (Rust) | Optimization only (no decode). Levels 0–6. **Has MT build** — see §3. |
| `@jsquash/jpeg` | `^1.6` | 1.6.0 (2025-05-12) | ~530 KB unpacked | **MozJPEG** | The JPEG package IS MozJPEG; there is no separate `@jsquash/mozjpeg`. Quality, progressive, chroma. |
| `@jsquash/png` | `^3.1` | 3.1.1 (2025-05-20) | small | rust-png | Used for decoding PNG → ImageData (feed into oxipng or convert to AVIF/WebP). |
| `@jsquash/resize` | `^2.1` | 2.1.1 (2026-01-05) | small | hqx/triangle/lanczos3 | For 1x→2x/3x variant generation. Most recent jSquash publish. |

### Init pattern (browser, Vite)

Default flow is fully automatic — bundlers pick up the `.wasm` files via the codec's glue code:

```ts
import { encode } from '@jsquash/webp';
const buffer = await encode(imageData, { quality: 75 });
```

Manual `init()` is only needed for non-bundler environments (Cloudflare Workers, custom WASM hosting). Per the README:

```ts
import encode, { init as initWebpEncode } from '@jsquash/webp/encode';
initWebpEncode(null, { locateFile: (path) => `/wasm/${path}` });
```

Do **not** call `init()` in normal Vite builds — let Vite hash and serve the `.wasm` automatically (it ships under `dist/assets/*.wasm` with content hashing).

### Threading (MT) — OxiPNG + AVIF

OxiPNG and AVIF have multi-threaded WASM builds that use `SharedArrayBuffer`. To enable:

1. Import the `/mt` subpath: `import { optimise } from '@jsquash/oxipng/mt'` (single-thread default is `@jsquash/oxipng`).
2. Serve the app with **COOP+COEP cross-origin isolation** (see §6 hosting).
3. Detect `crossOriginIsolated === true` at runtime; fall back to single-threaded `@jsquash/oxipng` if `false`.

If COOP/COEP is too painful (it breaks third-party `<iframe>` embeds and some service workers), ship single-thread variants for v1 and add MT as an opt-in via a feature flag. Per PROJECT.md `Performance` requirements (≤100ms / 2MB file), single-threaded is fine for the target file sizes.

### TypeScript types

All jSquash packages ship `index.d.ts` at the package root (`types: "./index.d.ts"`). No `@types/*` needed.

### Bundle size budget

- WebP + JPEG + PNG (default trio): ~2 MB unpacked total → ~600 KB gzipped on the wire.
- Adding AVIF: +8 MB unpacked → ~2 MB gzipped. **Lazy-load only.** Code-split with `import('@jsquash/avif')` inside the worker behind the AVIF format toggle.
- OxiPNG: ~450 KB unpacked.
- Initial route budget (200 KB JS gzipped per PROJECT.md) is feasible only if all codecs are dynamically imported inside workers.

### Known issues (verified from jSquash README + GitHub issues)

- `@jsquash/avif` 2.x bumped libavif and **drops Safari < 16.4** support for decode (uses BigInt operations).
- `@jsquash/oxipng` is encode-only — to optimize a PNG you must decode first via `@jsquash/png` to get `ImageData`, then re-encode raw bytes through oxipng.
- `init()` accepts an `ArrayBuffer` OR `null` + Emscripten `Module` opts. Passing a `Response` directly (old API) does not work.

---

## 3. SVG — svgo v4 browser ESM

| Package | Pinned | Verified version | Notes |
|---|---|---|---|
| `svgo` | `^4.0` | **4.0.1** (2026-03-04) | v4 is current. Browser ESM build is the official sub-export. |

### Import path (browser)

`svgo`'s `package.json` `exports` field (verified live):

```json
{
  ".":         { "import": "./lib/svgo-node.js",    "require": "./dist/svgo-node.cjs" },
  "./browser": { "import": "./dist/svgo.browser.js" }
}
```

→ **Always import from `svgo/browser` in the app**, never from the root entry. The root entry pulls in `node:fs`/`node:path` and will explode at build time:

```ts
import { optimize } from 'svgo/browser';

const result = optimize(svgString, {
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
    'removeDimensions',
    'sortAttrs',
  ],
});
console.log(result.data); // optimized SVG string
```

### Plugin enable/disable

Same API as Node — just pass `plugins: [...]`. To selectively disable a `preset-default` plugin:

```ts
{
  name: 'preset-default',
  params: {
    overrides: {
      removeComments: false,
      cleanupIds: false,
    },
  },
}
```

### TypeScript types

**Caveat:** the `./browser` export does NOT declare `types` in `exports` (only the root entry does). VS Code may resolve `optimize` against `lib/svgo-node.d.ts` and that's fine — same signature. If you hit a missing-types error under strict `moduleResolution: "bundler"`, add a one-line `svgo.d.ts` shim:

```ts
declare module 'svgo/browser' {
  export * from 'svgo';
}
```

### Gotcha (svgo v4)

- v4 dropped the legacy `extendDefaultPlugins` helper (deprecated in v3). Use `preset-default` + `overrides` instead.
- v4 ships native ESM only — there is no `dist/svgo.browser.cjs`. Vite handles this transparently.
- `convertPathData` in v4 has tighter precision defaults (`floatPrecision: 3`) — check that your test SVGs don't visibly degrade.

---

## 4. Vite + WASM Setup

For the default jSquash flow (single-threaded), Vite 8 needs **no extra plugins** — `.wasm` files are auto-handled when imported by the codec glue.

For threaded codecs (`@jsquash/oxipng/mt`), add:

```bash
npm install -D vite-plugin-wasm@^3.6 vite-plugin-top-level-await@^1.6
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  worker: { format: 'es' },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

The dev-server `headers` block makes `crossOriginIsolated` true in dev so threaded codecs don't crash on `npm run dev`.

---

## 5. State Management

**Recommendation: `zustand` 5.x for app state, plain `useState` for component-local state.**

| Option | Verdict | Why |
|---|---|---|
| `zustand` ^5.0 | **Pick this** | 5.0.12, last published 2026-03-16. ~3 KB gzip. No provider, works in workers, persist middleware handles IndexedDB via `idb-keyval`. Squoosh-style "settings panel mutates global codec config" maps cleanly to a single store. |
| `jotai` 2.19 | Skip for v1 | Atomic model is great for fine-grained re-renders, but the file list + per-format settings are coarse-grained — zustand is simpler. |
| `valtio` 2.3 | Skip | Proxy-based; less common, adds cognitive load. |
| React Context + `useReducer` | Skip | Will work, but the file list can grow to ~30 files × per-file overrides; Context re-renders the whole tree on every settings tweak. |

### Persistence

```ts
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const idbStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => idbSet(name, value),
  removeItem: async (name) => idbDel(name),
};
```

Pair with `idb-keyval@^6.2` (6.2.2, simple key/value over IndexedDB, ~600 B gzip). Don't reach for `dexie` unless you need querying — for named presets, key/value is sufficient.

---

## 6. Companion Libraries

### Toasts → `sonner`

| Package | Pinned | Verified | Notes |
|---|---|---|---|
| `sonner` | `^2.0` | 2.0.7 (2025-08-02) | Headless, ~3 KB gzip, no Tailwind dependency, supports promise-based toasts (`toast.promise(...)`) which is perfect for async optimize-and-zip flows. |

Don't use `react-hot-toast` — last meaningful release was August 2025 and it pulls in a small CSS-in-JS runtime; sonner is the modern pick.

### Tooltip + Popover → Radix

The prototype already has rolled-its-own tooltip primitives. For accessibility (WCAG AA per PROJECT.md), don't ship custom tooltip code into v1 — use Radix:

| Package | Pinned | Notes |
|---|---|---|
| `@radix-ui/react-tooltip` | `^1.2` (1.2.8) | Keyboard + screen reader correct out of the box. |
| `@radix-ui/react-popover` | `^1.1` (1.1.15) | For the format settings popovers. |
| `@radix-ui/react-slider` | `^1.3` (1.3.6) | For Squoosh-style split slider in the detail view. Saves you ~200 LOC + a11y review. |

Style with the existing `OIMG.html` design tokens — Radix is fully unstyled.

### File saving → native + `file-saver` fallback

For most browsers in 2026 the right pattern is:

```ts
const blob = new Blob([buffer], { type: 'image/webp' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'image.webp';
a.click();
URL.revokeObjectURL(url);
```

This is fine for ≤ ~2 GB single files. For the **ZIP batch export**, prefer **streaming** via the File System Access API (Chromium) when available, falling back to `file-saver`:

| Package | Pinned | Notes |
|---|---|---|
| `file-saver` | `^2.0` (2.0.5) | Old (2024-11), but stable and exactly the right API for the Safari/Firefox fallback. ~3 KB gzip. |

**Alternative: skip `file-saver` entirely** if you only target Chrome/Edge — use `showSaveFilePicker()` directly. PROJECT.md requires "modern browsers, last 2 stable", which includes Safari, so keep `file-saver` as the cross-browser save fallback.

### Batch ZIP → `jszip` (locked)

| Package | Pinned | Verified | Notes |
|---|---|---|---|
| `jszip` | `^3.10` | 3.10.1 (2025-03-14) | Locked in PROJECT.md. Mature, widely used, supports streaming generation via `generateAsync({ type: 'blob' })`. |

**Alternative considered: `client-zip` 2.5.0** — newer, ~2 KB gzip, supports true streaming via `ReadableStream` (lower memory for large batches). If batch sizes routinely exceed 200 MB, swap to `client-zip`. For PROJECT.md target (5–30 files), jszip is fine.

### Color picker → `react-colorful`

Only needed if any codec setting needs a color (e.g., PNG matte color, SVG `convertColors` target). 5.6.1, ~2 KB gzip, fully a11y. Skip if not needed for v1.

### Worker pool → `comlink` + roll your own pool

| Package | Pinned | Verified | Notes |
|---|---|---|---|
| `comlink` | `^4.4` | 4.4.2 (2024-11-07) | Stable, used by Squoosh itself. Wraps `postMessage` in a Promise/proxy API. ~1 KB gzip. |

**Don't use** `workerpool` (10.0.2, more abstract, doesn't fit Vite's `new Worker(new URL(...))` pattern as cleanly) or `threads` (1.7.0, last published 2022 — abandoned).

For pool management, write ~50 LOC: a `WorkerPool` class that round-robins N workers (where N = `navigator.hardwareConcurrency - 1`), each wrapping a Comlink-exposed codec module. Pattern is well-documented in Squoosh's `inspired/squoosh/src/`. There is no maintained "official" worker-pool helper that's worth the dependency.

### Image previews / thumbnails → native

`createImageBitmap()` + `OffscreenCanvas.transferToImageBitmap()` + a `<canvas>` is enough for thumbnails. PROJECT.md targets browsers that all support these. No library needed.

### Feature detection (optional but useful)

| Package | Pinned | Notes |
|---|---|---|
| (none) | — | Use `'showSaveFilePicker' in window`, `crossOriginIsolated`, `'OffscreenCanvas' in window` directly. No dependency. |

---

## 7. Hosting — Cloudflare Pages

Locked in PROJECT.md. Required `_headers` file at the project root for COOP/COEP (only needed if you ship threaded codecs):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: interest-cohort=()
```

**Caveat:** With `COEP: require-corp`, every cross-origin asset (fonts from Google Fonts, etc.) must serve `Cross-Origin-Resource-Policy: cross-origin`. PROJECT.md uses Inter + JetBrains Mono — **self-host the fonts** (don't use fonts.googleapis.com) or you'll hit blocked requests under cross-origin isolation.

---

## 8. Alternatives Considered (and rejected)

| Category | Locked | Rejected | Why rejected |
|---|---|---|---|
| Raster codecs | jSquash | `@squoosh/lib` | Archived 2023. |
| Raster codecs | jSquash | `wasm-image-optimization` | Smaller surface but no AVIF + less active. |
| SVG engine | svgo v4 browser ESM | svgo Node + WASM shim | svgo v3+ ships browser ESM natively; no shim needed. |
| State | zustand | Redux Toolkit | Overkill; ~13 KB vs zustand's ~3 KB; no devtools needed for this app. |
| Toasts | sonner | react-toastify, react-hot-toast | sonner has the cleanest promise API and best a11y in 2026. |
| Worker | comlink | threads, workerpool | `threads` abandoned (2022); `workerpool` doesn't match Vite worker URLs. |
| ZIP | jszip | client-zip | jszip is sufficient for v1 batch sizes; revisit if batches > 200 MB. |
| Persistence | idb-keyval | dexie | Don't need queries, just K/V for named presets. |

---

## 9. Sources

| Verification | Source | Confidence |
|---|---|---|
| jSquash latest versions + tarball sizes | `npm view @jsquash/{webp,avif,oxipng,jpeg,png,resize}` 2026-04-29 | HIGH |
| jSquash `@jsquash/jpeg` is MozJPEG (no separate `@jsquash/mozjpeg`) | `@jsquash/jpeg` README via `npm view ... readme` | HIGH |
| jSquash init pattern + MT subpaths | `@jsquash/jpeg` README + jSquash repo conventions | HIGH |
| svgo browser ESM exports field | `npm view svgo exports` live | HIGH |
| svgo 4.0.1 (2026-03-04) | `npm view svgo` live | HIGH |
| React 19.2.5, Vite 8.0.10, TypeScript 5.9 | npm registry live 2026-04-29 | HIGH |
| zustand, sonner, Radix versions | npm registry live 2026-04-29 | HIGH |
| COOP/COEP requirements for SharedArrayBuffer | MDN + Cloudflare Pages docs | HIGH |
| Worker pool guidance | Squoosh source patterns (`inspired/squoosh/`) | MEDIUM (pattern, not literal copy) |
| `client-zip` as alternative | `npm view client-zip` (2.5.0) | MEDIUM |

---

## 10. Open Questions for the Roadmap

1. **MT codecs in v1?** PROJECT.md asks for ≤ 100ms / 2MB file. Single-threaded jSquash hits this for typical assets. Recommend deferring threaded OxiPNG/AVIF to v1.1 unless benchmarks force it earlier — keeps COOP/COEP off the critical path and unblocks Google Fonts / 3rd-party fonts.
2. **AVIF in MVP?** AVIF tarball is 8 MB. PROJECT.md lists AVIF in Active requirements; recommend lazy-loading it inside a worker on first AVIF format selection, not as part of initial bundle.
3. **`file-saver` vs File System Access API?** Roadmap should pick a primary save path; v1 = blob+anchor for individual files, jszip+blob for ZIP, both with a feature-detected `showSaveFilePicker()` upgrade for Chromium.
