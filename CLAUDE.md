<!-- GSD:project-start source:PROJECT.md -->
## Project

**oimg.app — All-in-One Image Optimizer**

A 100% client-side, zero-server browser tool that lets web developers batch-optimize SVG/PNG/WebP/JPEG/AVIF assets, generate 1x/2x/3x variants per file, and copy production-ready paste-ready snippets (`<picture>` with srcset, `<img srcset>`, CSS `background-image` data URI, inline SVG). It fuses the workflows of Squoosh + SVGOMG + url-encoder behind a unified developer-first UX.

**Core Value:** **A developer drops a folder of source assets, picks output settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.**

If everything else fails, the upload → adjust → download-with-snippets pipeline must work flawlessly for SVG and PNG.

### Constraints

- **Tech stack**: React + Vite + TypeScript — chosen over Svelte for ecosystem depth and component reusability across the four workflow modes; Vite for WASM-friendly dev/build
- **Codec source**: jSquash — actual packages: `@jsquash/jpeg` (MozJPEG-based), `@jsquash/webp`, `@jsquash/avif`, `@jsquash/oxipng`, `@jsquash/png`, `@jsquash/resize`. Per-codec packages enable bundle splitting. Replaces archived `@squoosh/lib`. Note: there is no `@jsquash/mozjpeg` package — JPEG encoding lives in `@jsquash/jpeg`.
- **SVG engine**: `svgo` v3+ ESM browser bundle — direct import, no Node shims
- **License**: MIT — matches dep licenses (jSquash MIT, SVGO MIT, Squoosh code Apache 2.0 used as reference only)
- **Privacy**: Zero-server, zero-telemetry — non-negotiable, drives every architectural decision (no error tracking SaaS, no analytics, no remote feature flags)
- **Compatibility**: Modern browsers with WebAssembly + Web Workers + OffscreenCanvas (Chrome, Firefox, Safari, Edge — last 2 stable). No IE/legacy support.
- **Hosting**: Cloudflare Pages — free tier, edge CDN, WASM-friendly headers (COOP/COEP for threading), custom domain (oimg.app)
- **Performance**: Initial route < 200KB JS gzipped (lazy-load codecs); per-file optimize < 100ms for files ≤ 2MB
- **Accessibility**: WCAG AA — keyboard navigation, ARIA, contrast — required, not optional
- **Visual identity**: Design tokens from `example-ui/OIMG.html` are locked (oklch palette, Inter + JetBrains Mono, accent green ~145°, dark default + light theme) — must port verbatim to the Vite/TS app
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR — Install
# Core framework
# WASM raster codecs (jSquash — Squoosh's actively-maintained successor)
# SVG (browser ESM build, no Node shims)
# Batch zip + persistence + saving
# State + UX primitives (see "Companion libs" section for rationale)
# Worker plumbing
# Vite WASM helper (only needed for threaded codecs — see §3)
## 1. Core Framework
| Package | Pinned | Latest (2026-04-29) | Rationale |
|---|---|---|---|
| `react` | `^19.2` | 19.2.5 (2026-04-28) | React 19 is GA; `useTransition`, `useDeferredValue`, and Activity API are useful for non-blocking codec runs and preview tabs. |
| `react-dom` | `^19.2` | 19.2.5 | Pair with React. |
| `vite` | `^8.0` | 8.0.10 (2026-04-23) | Vite 8 (Rolldown-Vite is the default bundler in 8.x) — native WASM `import.meta.glob` support, zero-config asset hashing for `.wasm`. |
| `@vitejs/plugin-react` | `^6.0` | 6.0.1 | Standard React Fast Refresh plugin. |
| `typescript` | `^5.9` | 5.9.3 | Stable, all jSquash/svgo `.d.ts` resolve cleanly under `moduleResolution: "bundler"`. |
## 2. WASM Raster Codecs — jSquash
| Package | Pinned | Verified version | Tarball | Underlying codec | Notes |
|---|---|---|---|---|---|
| `@jsquash/webp` | `^1.5` | 1.5.0 (2025-08-11) | ~915 KB unpacked | libwebp | Encode + decode. Quality 0–100, method 0–6, lossy/lossless. |
| `@jsquash/avif` | `^2.1` | 2.1.1 (2025-05-20) | ~8.4 MB unpacked | libavif | Encode + decode. Largest tarball — lazy-load ONLY when user picks AVIF. |
| `@jsquash/oxipng` | `^2.3` | 2.3.0 (2024-06-18) | ~452 KB unpacked | OxiPNG (Rust) | Optimization only (no decode). Levels 0–6. **Has MT build** — see §3. |
| `@jsquash/jpeg` | `^1.6` | 1.6.0 (2025-05-12) | ~530 KB unpacked | **MozJPEG** | The JPEG package IS MozJPEG; there is no separate `@jsquash/mozjpeg`. Quality, progressive, chroma. |
| `@jsquash/png` | `^3.1` | 3.1.1 (2025-05-20) | small | rust-png | Used for decoding PNG → ImageData (feed into oxipng or convert to AVIF/WebP). |
| `@jsquash/resize` | `^2.1` | 2.1.1 (2026-01-05) | small | hqx/triangle/lanczos3 | For 1x→2x/3x variant generation. Most recent jSquash publish. |
### Init pattern (browser, Vite)
### Threading (MT) — OxiPNG + AVIF
### TypeScript types
### Bundle size budget
- WebP + JPEG + PNG (default trio): ~2 MB unpacked total → ~600 KB gzipped on the wire.
- Adding AVIF: +8 MB unpacked → ~2 MB gzipped. **Lazy-load only.** Code-split with `import('@jsquash/avif')` inside the worker behind the AVIF format toggle.
- OxiPNG: ~450 KB unpacked.
- Initial route budget (200 KB JS gzipped per PROJECT.md) is feasible only if all codecs are dynamically imported inside workers.
### Known issues (verified from jSquash README + GitHub issues)
- `@jsquash/avif` 2.x bumped libavif and **drops Safari < 16.4** support for decode (uses BigInt operations).
- `@jsquash/oxipng` is encode-only — to optimize a PNG you must decode first via `@jsquash/png` to get `ImageData`, then re-encode raw bytes through oxipng.
- `init()` accepts an `ArrayBuffer` OR `null` + Emscripten `Module` opts. Passing a `Response` directly (old API) does not work.
## 3. SVG — svgo v4 browser ESM
| Package | Pinned | Verified version | Notes |
|---|---|---|---|
| `svgo` | `^4.0` | **4.0.1** (2026-03-04) | v4 is current. Browser ESM build is the official sub-export. |
### Import path (browser)
### Plugin enable/disable
### TypeScript types
### Gotcha (svgo v4)
- v4 dropped the legacy `extendDefaultPlugins` helper (deprecated in v3). Use `preset-default` + `overrides` instead.
- v4 ships native ESM only — there is no `dist/svgo.browser.cjs`. Vite handles this transparently.
- `convertPathData` in v4 has tighter precision defaults (`floatPrecision: 3`) — check that your test SVGs don't visibly degrade.
## 4. Vite + WASM Setup
## 5. State Management
| Option | Verdict | Why |
|---|---|---|
| `zustand` ^5.0 | **Pick this** | 5.0.12, last published 2026-03-16. ~3 KB gzip. No provider, works in workers, persist middleware handles IndexedDB via `idb-keyval`. Squoosh-style "settings panel mutates global codec config" maps cleanly to a single store. |
| `jotai` 2.19 | Skip for v1 | Atomic model is great for fine-grained re-renders, but the file list + per-format settings are coarse-grained — zustand is simpler. |
| `valtio` 2.3 | Skip | Proxy-based; less common, adds cognitive load. |
| React Context + `useReducer` | Skip | Will work, but the file list can grow to ~30 files × per-file overrides; Context re-renders the whole tree on every settings tweak. |
### Persistence
## 6. Companion Libraries
### Toasts → `sonner`
| Package | Pinned | Verified | Notes |
|---|---|---|---|
| `sonner` | `^2.0` | 2.0.7 (2025-08-02) | Headless, ~3 KB gzip, no Tailwind dependency, supports promise-based toasts (`toast.promise(...)`) which is perfect for async optimize-and-zip flows. |
### Tooltip + Popover → Radix
| Package | Pinned | Notes |
|---|---|---|
| `@radix-ui/react-tooltip` | `^1.2` (1.2.8) | Keyboard + screen reader correct out of the box. |
| `@radix-ui/react-popover` | `^1.1` (1.1.15) | For the format settings popovers. |
| `@radix-ui/react-slider` | `^1.3` (1.3.6) | For Squoosh-style split slider in the detail view. Saves you ~200 LOC + a11y review. |
### File saving → native + `file-saver` fallback
| Package | Pinned | Notes |
|---|---|---|
| `file-saver` | `^2.0` (2.0.5) | Old (2024-11), but stable and exactly the right API for the Safari/Firefox fallback. ~3 KB gzip. |
### Batch ZIP → `jszip` (locked)
| Package | Pinned | Verified | Notes |
|---|---|---|---|
| `jszip` | `^3.10` | 3.10.1 (2025-03-14) | Locked in PROJECT.md. Mature, widely used, supports streaming generation via `generateAsync({ type: 'blob' })`. |
### Color picker → `react-colorful`
### Worker pool → `comlink` + roll your own pool
| Package | Pinned | Verified | Notes |
|---|---|---|---|
| `comlink` | `^4.4` | 4.4.2 (2024-11-07) | Stable, used by Squoosh itself. Wraps `postMessage` in a Promise/proxy API. ~1 KB gzip. |
### Image previews / thumbnails → native
### Feature detection (optional but useful)
| Package | Pinned | Notes |
|---|---|---|
| (none) | — | Use `'showSaveFilePicker' in window`, `crossOriginIsolated`, `'OffscreenCanvas' in window` directly. No dependency. |
## 7. Hosting — Cloudflare Pages
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
## 10. Open Questions for the Roadmap
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

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
