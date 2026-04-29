# Project Research Summary

**Project:** oimg.app — All-in-One Image Optimizer
**Domain:** Browser-based, client-side, batch image-optimization SPA for frontend developers
**Researched:** 2026-04-29
**Confidence:** HIGH

## Executive Summary

oimg.app is a developer-facing tool that fuses three previously separate workflows — Squoosh (raster optimization), SVGOMG (SVG optimization), and url-encoder (data-URI generation) — into a single batch pipeline that produces optimized files **plus paste-ready HTML/CSS snippets** (`<picture>` srcset, `<img srcset>`, CSS `background-image` data URI, inline `<svg>`). The core differentiator is the **mixed-density model** (user picks 1×/2×/3× per file → app generates the missing variants → snippets reflect actual outputs), which research confirms is *architectural*, not just a feature: it ties density → filenames → snippets and must be designed in from day one.

The recommended approach uses an already-locked stack (React + Vite 8 + TypeScript + jSquash + svgo browser ESM + jszip + Cloudflare Pages) with a small number of additions surfaced by research: Comlink for ergonomic Web Worker RPC, idb-keyval for preset persistence, DOMPurify for SVG sanitization, fflate as a v1.x upgrade target over jszip, Zustand for state. example-ui/ contributes design tokens and component shells but is rewritten greenfield in TS — its UMD-React + globals don't survive the move to ESM.

The two highest-leverage risks are **COOP/COEP misconfiguration** (silent fallback to single-thread WASM, 5–10× slower batches with no error visible) and **memory blowup at 50+ files** (naïve `Promise.all` over `ImageData` crashes the tab around file 30). Both must be designed for in early phases. SVG XSS via the inline-render path is the third major risk — SVGO is *not* a sanitizer, so DOMPurify must wrap before *and* after optimization.

## Key Findings

### Recommended Stack

Confirmed and refined the locked stack. See `STACK.md` for full version pins, install commands, Vite config snippets, and `_headers` examples.

**Core technologies:**
- **React 19 + Vite 8 + TypeScript** — chosen; use `@vitejs/plugin-react@^6` (Oxc), **not** `-swc`. Vite 8 native WASM/Worker handling makes `vite-plugin-wasm` unnecessary; jSquash codecs go in `optimizeDeps.exclude` and are loaded via `?url` + explicit `init({ locateFile })`.
- **jSquash codec packages** — actual packages: `@jsquash/jpeg` (MozJPEG-based), `@jsquash/webp`, `@jsquash/avif`, `@jsquash/oxipng`, `@jsquash/png`, `@jsquash/resize`. **Note:** `@jsquash/mozjpeg` does not exist; PROJECT.md previously had a typo (now corrected).
- **svgo v3+ ESM browser bundle** — direct import, no Node shims. Plugin enable/disable via the standard config object.
- **Comlink** — type-safe RPC over `postMessage` with Transferable support; pairs with the worker pool.
- **Zustand** + **idb-keyval** — state slicing (files / settings / presets / ui) and IndexedDB-backed preset persistence. File content is **never** persisted (privacy).
- **DOMPurify** — SVG sanitization wrapping SVGO on both input and output (SVGO is an optimizer, not a sanitizer).
- **jszip** for v1 ZIP export. `fflate` is a recommended v1.x upgrade (10× smaller, async, faster) — kept off v1 path to avoid scope creep.
- **Cloudflare Pages** — `public/_headers` with `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` to enable `SharedArrayBuffer`. Required for AVIF v2 + multi-threaded OxiPNG. Vite dev server needs matching middleware so dev parity holds. Self-host Inter + JetBrains Mono (Google Fonts breaks COEP).

### Expected Features

See `FEATURES.md` for the full catalog (18 table-stakes / 14 differentiators / 15 power-user / 12 anti-features).

**Must have (table stakes):**
- Drag-and-drop + multi-file picker; format auto-detect (SVG/PNG/JPEG/WebP/AVIF)
- Per-format codec settings panels (Squoosh-style accordion)
- Before/after preview with byte-delta + percentage saved
- Per-file detail view with split-slider comparison
- Lossless/lossy toggle per applicable codec
- Metadata stripping (EXIF/XMP/IPTC) with optional ICC retention
- Dark/light theme + WCAG AA + keyboard nav

**Should have (the differentiators — these are the moat):**
- **Mixed-density (1×/2×/3×)** input model with auto-generation of missing variants — *architectural*
- `<picture>` snippet with AVIF→WebP→PNG/JPEG fallback chain
- `<img srcset>` snippet
- CSS `background-image` data URI snippet (with size warnings)
- Inline `<svg>` snippet (raw markup or data URI)
- Per-file checkbox toggles for which snippet types to surface
- Structured ZIP filenames (`logo@1x.webp`, `logo@2x.webp`, …) that exactly match the snippet `srcset` strings — this sync is invisible-but-load-bearing and needs integration tests as a v1 acceptance gate

**Defer (v2+):**
- PWA shell / offline mode (Workbox + service worker)
- Multi-language UI (English-only v1)
- SVG sprite generation
- Aggregated multi-file CSS export
- PNG quantization (libimagequant) — opt-in only when added
- Butteraugli auto-mode
- JPEG XL (browser support still uneven in 2026)
- A/B compare across encodes

**Anti-features (never build):**
- Backend / accounts / cloud sync
- Telemetry / analytics
- Animated GIF/video transcoding
- Image editing (crop/rotate/filters)
- **History panel** — universally welcome in dev tools but conflicts with the privacy stance ("no file history, no thumbnail cache"). Surfaced by FEATURES.md as PU-15; should be locked to AF.

### Architecture Approach

See `ARCHITECTURE.md` for diagrams, the codec-adapter TypeScript signature, the worker message protocol, and the example-ui/ migration mapping table.

The pipeline is a **single generic worker host** with a codec adapter registry, *not* per-codec workers (the per-codec sketch in `ARCH.md` is rejected — wastes RAM and conflates worker count with codec count). A `PipelineOrchestrator` on the main thread dispatches `Job`s with explicit plans; each worker dynamic-imports the right adapter per job, processes, and returns Transferable ArrayBuffers via Comlink. This caps peak memory around ~580 MB even on 12-photo batches and supports trivial cancellation, multi-output (SVG → SVG + PNG + WebP/AVIF), and lazy WASM loading.

**Major components:**
1. **PipelineOrchestrator** (main thread) — owns job plans, worker pool, ref-counted Blob lifecycle, per-file state machine
2. **Worker pool** (`min(hardwareConcurrency, 8)` workers) — generic hosts, dynamic-import codec adapters, stateless
3. **Codec adapter registry** — one file per codec implementing `CodecAdapter<TOpts>`; new codec = one file, no orchestrator changes
4. **State stores** (Zustand, domain-sliced) — `files`, `settings`, `presets`, `ui`
5. **Snippet engine** — pure utilities consuming the file/output graph, producing copy-paste markup; mirrors structured filenames byte-for-byte
6. **Persistence** — `idb-keyval` for presets, `localStorage` for theme/last-used; **no file content persisted**
7. **UI shell** — ports `example-ui/` design tokens + primitives (Popover/Tooltip) verbatim, rewrites the rest in TS

### Critical Pitfalls

See `PITFALLS.md` for all 23 cataloged with symptom / root cause / prevention / phase mapping. Top three:

1. **COOP/COEP misconfiguration** — Without `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` on **both** Vite dev server and Cloudflare Pages production, `SharedArrayBuffer` is unavailable and WASM codecs silently fall back to single-thread (5–10× slower). No error fires. **Mitigation:** ship `public/_headers` and Vite middleware on day 1; add a runtime sentinel asserting `crossOriginIsolated === true` and a CI smoke test that imports a codec and runs an encode against `dist/`.

2. **SVG XSS via inline rendering** — SVGO preserves `<script>`, `on*` handlers, `<foreignObject>`, and `javascript:` hrefs. Any inline-SVG render path is same-origin XSS that can read IndexedDB presets. **Mitigation:** wrap with DOMPurify (`USE_PROFILES.svg + svgFilters`) before *and* after SVGO; render previews via `<img src=blob:>` (sandboxed); lock CSP to `connect-src 'self'`.

3. **Memory blowup at 50+ files** — Naïve `Promise.all(files.map(optimize))` plus storing decoded `ImageData` in React state crashes the tab around file 30 (each 4K PNG ≈ 64 MB raw). **Mitigation:** streaming pipeline with concurrency `min(hardwareConcurrency, 4)`, Blob-only state, transferable `postMessage`, religious `URL.revokeObjectURL`, explicit jSquash module disposal between batches. **Retrofitting this is HIGH-cost — design in from Phase 4.**

## Implications for Roadmap

Suggested 8-phase structure (ratified from ARCHITECTURE.md with one foundation-pull-forward refinement):

### Phase 1: Shell + Foundation (with COOP/COEP from day 1)
**Rationale:** Foundation work (build pipeline, design tokens, COOP/COEP, CSP, self-hosted fonts, runtime sentinel asserting cross-origin isolation) is cheap to do early and dangerous to retrofit. Pulling COOP/COEP forward to Phase 1 (vs Phase 8 polish) is the one refinement to the ARCHITECTURE.md proposal.
**Delivers:** Vite + TS + React 19 scaffolded; `public/_headers`; Vite dev middleware; CSP; self-hosted Inter + JBMono; ported design tokens (oklch palette, light/dark themes); ported primitives (Popover, Tooltip); shell layout (no real functionality yet); CI smoke test for COOP/COEP.
**Avoids:** Pitfall #1 (silent single-thread fallback).

### Phase 2: Worker Harness + State Stores
**Rationale:** Once the shell exists, the next foundational layer is the pipeline orchestrator + worker pool + state stores. Built and unit-tested with a stub adapter before any real codec work.
**Delivers:** PipelineOrchestrator on main thread; generic worker host with dynamic-import codec registry; Zustand stores (files, settings, presets, ui); Comlink wired with Transferables; stub adapter that round-trips a file unchanged; ref-counted Blob lifecycle; cancellation.
**Uses:** Comlink, Zustand, Web Workers via Vite native imports.
**Implements:** Architecture components 1–4.

### Phase 3: SVG Pipeline (validates the harness end-to-end)
**Rationale:** SVG is the simplest codec adapter (text-in, text-out, no WASM, no resize, no decode/encode separation). Implementing it first validates the entire orchestrator + adapter contract before raster complexity lands.
**Delivers:** SVGO browser-bundle integration; full plugin toggle UI ported from SVGOMG; **DOMPurify wrap before+after SVGO**; inline-SVG snippet output; URL-encoded data URI snippet; integration test for the snippet ↔ filename sync gate.
**Avoids:** Pitfall #2 (SVG XSS via inline render). **Research-flagged** for DOMPurify config + which SVGO defaults to override (e.g., `removeViewBox` ON breaks responsive SVG).

### Phase 4: Decode + Resize + Memory Model
**Rationale:** Before raster *encoders* land, the decode + resize path and the streaming/memory-bounded pipeline must exist — retrofitting memory discipline is the most expensive thing in this project.
**Delivers:** `@jsquash/png` decoder; `@jsquash/resize` for 1×/2×/3× variant generation; streaming pipeline with concurrency cap; `URL.revokeObjectURL` discipline; memory-pressure test with 50+ file fixtures; per-file source-density UI (1×/2×/3× picker); structured filename rules (`name@1x.ext`).
**Avoids:** Pitfall #3 (memory blowup). **Research-flagged** — the memory model is the highest-leverage decision in v1.

### Phase 5: Raster Encoders (PNG/WebP/JPEG/AVIF)
**Rationale:** With decode + resize + memory-bounded pipeline working, encoders are now standalone adapter additions. Each is a `CodecAdapter` implementation against the proven contract.
**Delivers:** OxiPNG, WebP, JPEG (MozJPEG-based via `@jsquash/jpeg`), AVIF adapters; per-codec tweaks panels (ported from `example-ui/tweaks-panel.jsx`); lossy/lossless toggles; metadata stripping; before/after preview + byte-delta UI.
**Uses:** `@jsquash/{oxipng,webp,jpeg,avif}` per STACK.md.

### Phase 6: Snippet Generation
**Rationale:** Snippets consume the file/output graph and must mirror structured filenames byte-for-byte. Lands after encoders so it has real outputs to mirror.
**Delivers:** `<picture>` with AVIF→WebP→fallback ordering; `<img srcset>` 1×/2×/3×; CSS `background-image` data URI with size warnings; inline `<svg>`; raw data URI; per-file checkbox toggles for snippet selection; copy-to-clipboard; integration tests asserting `srcset` strings match ZIP filenames.
**Research-flagged** — snippet edge cases (ID collision when embedding multiple inline SVGs, source ordering rules, the actual >32 KB perf cliff).

### Phase 7: ZIP Export + IndexedDB Presets
**Rationale:** Both are leaf concerns that depend on everything upstream (files, encoders, snippets, settings). Doing them last avoids rework.
**Delivers:** `jszip` integration with structured filename emission; one-click "download all" + per-file download; named user presets persisted to IndexedDB via `idb-keyval`; theme + last-used settings in localStorage; preset import/export.

### Phase 8: Polish + Cross-Browser Validation
**Rationale:** Final-mile work after the full pipeline runs end-to-end.
**Delivers:** Bundle-size audit (initial route < 200 KB gzipped; codecs lazy-load); empirical Safari + Firefox + Chrome perf parity; full WCAG AA audit; error-state UI; landing-page polish; deploy to Cloudflare Pages with custom domain.
**Research-flagged** — cross-browser empirical perf (Safari OffscreenCanvas / COOP-COEP edge cases).

### Phase Ordering Rationale

- **Foundations before features:** P1 (shell + COOP/COEP), P2 (orchestrator + workers), P4 (memory model) are all foundational. Building features on top of an unsafe pipeline is the most expensive way to ship this project.
- **Simplest codec first:** SVG (P3) validates the orchestrator/adapter contract end-to-end without WASM complexity. Failures here tell us the contract is wrong; failures in P5 with 4 codecs landing simultaneously would be noise.
- **Decode/resize before encode:** mixed-density is the differentiator and hinges on resize. Encoders without resize means no 1×/2×/3× outputs, which means no real snippets, which means no v1.
- **Snippets after encoders:** snippets mirror structured filenames; need real outputs to test the sync gate.
- **ZIP + IDB last among capability work:** they depend on everything upstream and have no upstream consumers.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (SVG):** DOMPurify SVG profile config; which SVGO default plugins to override (`removeViewBox`, `convertShapeToPath`, `mergePaths` aggression); inline-SVG ID-collision uniquification strategy.
- **Phase 4 (Decode + Resize + Memory):** the memory model is the highest-leverage decision in v1 — needs concrete benchmarks against 50+/100+ file fixtures, decisions on `@jsquash/resize` vs pica fallback, ImageBitmap vs ImageData for thumbnails.
- **Phase 6 (Snippets):** snippet edge cases — `<picture>` source ordering (AVIF before WebP), ID-uniquification for inline SVG, data-URI size cliff (the >32 KB rule is folklore, real cliff is content-dependent).
- **Phase 8 (Polish):** Safari + Firefox empirical perf; iOS WebKit COOP/COEP edge cases; OffscreenCanvas parity gaps.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Shell):** well-trodden Vite + React + design-token porting work.
- **Phase 2 (Worker harness):** Comlink + Web Workers + Zustand are mature, well-documented patterns.
- **Phase 5 (Raster encoders):** repetitive adapter additions against a contract proven in P3.
- **Phase 7 (ZIP + IDB):** mature libraries, narrow scope.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | jSquash, SVGO, Vite 8, Cloudflare Pages all verified against current docs as of 2026-04 |
| Features | HIGH | 18 TS / 14 D / 15 PU / 12 AF derived from PROJECT.md + competitor analysis (Squoosh/SVGOMG/url-encoder/ImageOptim/TinyPNG); only minor uncertainty in JPEG XL viability and aggregated CSS export demand |
| Architecture | HIGH | Single generic worker host + Zustand pattern is well-trodden in similar batch-WASM tools; example-ui/ migration mapping is concrete |
| Pitfalls | HIGH | All 23 verified against current 2026 ecosystem; top 3 are documented showstoppers, not theoretical |

**Overall confidence:** HIGH

### Gaps to Address

- **JPEG XL viability in 2026** — research-flagged for v2 decision; not in v1 scope.
- **Self-hosted vs subset Inter + JBMono** — STACK.md recommends self-hosted (Google Fonts breaks COEP); subset strategy decided in P1.
- **fflate vs jszip** — kept jszip for v1 (PROJECT.md lock); fflate proposed as v1.x upgrade. Re-evaluate after P7 ships and bundle metrics are real.
- **Density inference** — currently user picks 1×/2×/3× per file. Research suggests adding heuristics (filename suffix detection, EXIF resolution hints) as a v1.x improvement; not in v1.
- **iOS Safari COOP/COEP edge cases** — needs P8 empirical validation; mitigation is the runtime sentinel + fallback message.

## Sources

### Primary (HIGH confidence)
- jSquash GitHub repo + per-codec npm pages — codec API, init patterns, package list, multi-thread support
- SVGO v3 docs — browser ESM bundle, plugin API, default-preset behavior
- Vite 8 docs (Context7) — WASM handling, Worker imports, `optimizeDeps.exclude`
- Cloudflare Pages docs — `_headers` syntax, COOP/COEP/CORP, asset limits
- DOMPurify docs — `USE_PROFILES.svg` profile, recent CVE history
- Comlink docs — Transferable support, Worker RPC patterns

### Secondary (MEDIUM confidence)
- 2026 state-management comparisons (Zustand / Jotai / RTK / Context) — recommended Zustand for batch-pipeline UI
- caniuse data for AVIF, JPEG XL, OffscreenCanvas (browser support)
- Squoosh / SVGOMG / url-encoder source — UX patterns, codec glue (reference, not vendored)

### Tertiary (LOW confidence)
- Folklore numbers (e.g., the >32 KB data URI cliff) — kept as guidance only, validated empirically in P6/P8.

---
*Research completed: 2026-04-29*
*Ready for roadmap: yes*
