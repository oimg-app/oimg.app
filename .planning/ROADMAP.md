# Roadmap: oimg.app — All-in-One Image Optimizer

## Overview

Eight phases take oimg.app from an empty Vite scaffold to a fully-deployed, production-ready browser image optimizer. The structure follows the research recommendation: foundations first (COOP/COEP, worker harness, memory model), simplest codec to validate contracts (SVG), then raster encoders, snippets, export/persistence, and final polish. Every phase closes with a verifiable, user-observable capability.

## Phases

- [ ] **Phase 1: Shell + Foundation** - Vite + TS scaffold, design tokens ported from example-ui/, COOP/COEP headers, CI smoke test
- [x] **Phase 2: Worker Harness + State** - PipelineOrchestrator, generic worker pool, Comlink RPC, Zustand stores, stub adapter
- [ ] **Phase 3: SVG Pipeline** - SVGO integration, DOMPurify wrap, plugin toggle UI, SVG snippet output
- [ ] **Phase 4: Decode + Resize + Memory Model** - @jsquash/png decode, @jsquash/resize, streaming concurrency cap, source-density UI
- [ ] **Phase 5: Raster Encoders** - OxiPNG, WebP, JPEG (MozJPEG), AVIF adapters + per-codec settings panels
- [ ] **Phase 6: Snippet Generation** - All snippet types, per-file toggles, copy-to-clipboard, filename↔srcset sync gate
- [ ] **Phase 7: ZIP Export + Persistence** - jszip download, per-file download, IndexedDB presets, localStorage theme/settings
- [ ] **Phase 8: Polish + Deploy** - Bundle audit, cross-browser validation, WCAG AA audit, Cloudflare Pages deploy

## Phase Details

### Phase 1: Shell + Foundation
**Goal**: A runnable Vite + React 19 + TypeScript app exists, with the design system intact and the security foundation locked
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-06, UI-07, UI-08, PRIV-01, PERF-04
**Success Criteria** (what must be TRUE):
  1. `npm run dev` serves the app with dark/light theme matching example-ui/ oklch palette and typography (Inter + JetBrains Mono)
  2. Browser DevTools show `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response, both in dev and the production build
  3. A runtime console assertion `crossOriginIsolated === true` passes in Chrome, Firefox, and Safari without errors
  4. shadcn/ui components (slider, checkbox, accordion) render with example-ui/ visual language — correct radius, spacing, and color tokens
  5. Keyboard navigation cycles through all interactive shell elements; ARIA roles are present on landmark regions
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Security foundation: COOP/COEP headers, fontsource self-hosted fonts, 5-stop oklch design tokens
- [x] 01-02-PLAN.md — Test scaffold: Playwright E2E runner, ARIA landmark stubs (real browser), bundle size test
- [x] 01-03-PLAN.md — Foundation atoms: TypeScript types, data defaults, custom SVG icons, useTheme hook
- [x] 01-04-PLAN.md — Shell components: AppShell grid, TitleBar (theme toggle), Toolbar, StatusBar + Playwright ARIA tests activated
- [x] 01-05-PLAN.md — Panel components: FilePanel, DetailPanel, TweaksPanel accordion + visual checkpoint

**UI hint**: yes

### Phase 2: Worker Harness + State
**Goal**: A generic worker pipeline processes files in parallel with bounded memory and wired state stores, validated by a stub adapter that round-trips bytes unchanged
**Depends on**: Phase 1
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Uploading any file triggers a job through the worker pool; the UI shows a progress indicator without freezing
  2. The stub adapter returns the original file unchanged; the file list updates with "0 bytes saved"
  3. Cancelling a queued batch before completion stops in-flight jobs and clears the file list cleanly
  4. Worker pool respects `min(hardwareConcurrency, 4)` concurrency — simultaneous jobs never exceed this cap (visible in DevTools Performance tab)
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0: test scaffolds + fixtures (synthetic blobs, instrument-blob-urls, failing-stub specs for VR-01..VR-05)
- [x] 02-02-PLAN.md — Stores: useFilesStore + useSettingsStore + useRuntimeStore (urlCache lifecycle), object-url + live-region helpers
- [x] 02-03-PLAN.md — Worker harness: Comlink worker entry + stub adapter + WorkerPool class (FIFO, cancel via terminate-and-respawn, AbortSignal cancel correctness)
- [x] 02-04-PLAN.md — UI wiring: Toolbar Workers pill + Optimize button + ARIA live region + sonner Toaster + Cmd+Enter/Cmd+. shortcuts + window.__OIMG_STORES__ test exposure
- [x] 02-05-PLAN.md — Cleanup: delete src/data/mock.ts, full Playwright regression sweep, bundle budget verification

### Phase 3: SVG Pipeline
**Goal**: Users can optimize SVG files with SVGO and immediately copy snippet output, with XSS risk fully neutralized
**Depends on**: Phase 2
**Requirements**: OPT-01, SNIP-01, SNIP-03, SNIP-04, PIPE-01
**Success Criteria** (what must be TRUE):
  1. Dropping an SVG file optimizes it via SVGO preset-default and shows byte delta (bytes + %) in the file list
  2. SVGO plugin toggles (enable/disable individual plugins) update the optimized output in real time
  3. An SVG containing `<script>` and `on*` event handlers is sanitized — neither the preview nor the snippet output contains executable script
  4. The inline SVG snippet and URL-encoded data URI snippet are available and copy correctly to clipboard
**Plans**: 4 plans

Plans:
- [x] 03-A-PLAN.md — Wave 0+1: deps install + spec stubs + XSS fixtures + svg-adapter (SVGO-only worker) + sanitize-svg (main-thread DOMPurify) + ADAPTERS wiring + sanitizedCount + file-row badge
- [x] 03-B-PLAN.md — Wave 2: SvgoPanel rewrite (12 curated plugins + live savings + foot-gun hints + Sanitization section) + store extensions (previewJobId, enqueuePreview, snippetToggles) + D-06 post-batch savings
- [x] 03-C-PLAN.md — Wave 3: snippet-registry + svg-snippets (yoksel encoder) + SnippetPanel (replaces OutputPanel) + per-snippet checkboxes + D-15 URL-encoding
- [x] 03-D-PLAN.md — Wave 4: activate all spec stubs → live E2E + unit assertions; full suite green phase gate

**UI hint**: yes

### Phase 4: Decode + Resize + Memory Model
**Goal**: Users can declare source density (1x/2x/3x) and the app generates the missing pixel-density variants without crashing under a 50-file batch
**Depends on**: Phase 3
**Requirements**: PIPE-04, PIPE-01 (raster formats), OPT-06
**Success Criteria** (what must be TRUE):
  1. Selecting "source is 2x" for a PNG generates 1x and 3x variants visible in the file list with correct `@1x`/`@2x`/`@3x` filename suffixes
  2. Processing 50 raster files simultaneously completes without tab crash or OOM error; Chrome DevTools Memory tab stays below 800 MB peak
  3. Metadata (EXIF/XMP/IPTC) is absent from decoded output by default; ICC profile is preserved when the user enables the toggle
  4. `URL.revokeObjectURL` is called for every processed Blob — no object-URL leaks in a 20-file batch (verifiable via DevTools Memory snapshot)
**Plans**: 7 plans

Plans:
- [x] 04-01-test-scaffolds-and-types-PLAN.md — Wave 0 test scaffolds + fixtures + FileEntry/AdapterMeta extensions + DEFAULT_RESIZE_SETTINGS
- [x] 04-02-pure-libs-PLAN.md — Pure utilities: sniff PNG IHDR, filename @Nx suffix + collision dedup, memory-budget formula
- [ ] 04-03-png-adapter-PLAN.md — Install jSquash deps + create png-adapter (decode + resize + re-encode) + worker dispatch wiring + ICC strip-by-default unit
- [ ] 04-04-pool-admission-gate-PLAN.md — PoolJob.byteEstimate + WorkerPool admission gate + onThrottle callback + runtime store throttle/rename batch state
- [ ] 04-05-files-fanout-and-settings-PLAN.md — useFilesStore.addSourceWithVariants fan-out + removeFamily + useSettingsStore resize slice
- [ ] 04-06-ui-integration-PLAN.md — TweaksPanel sections + file-row density controls + StatusBar pill (components only)
- [ ] 04-07-app-wiring-and-uat-PLAN.md — App.tsx pool/PNG/toast wiring + flip raster.spec.ts to live + visual UAT

### Phase 5: Raster Encoders
**Goal**: Users can optimize PNG, WebP, JPEG, and AVIF files with per-format codec controls, seeing before/after comparison and byte savings
**Depends on**: Phase 4
**Requirements**: OPT-02, OPT-03, OPT-04, OPT-05, PIPE-02, PIPE-03, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. Each raster format (PNG/WebP/JPEG/AVIF) optimizes successfully with default settings; the file list shows a non-zero byte reduction for typical photos
  2. The accordion settings panel exposes per-format controls (quality, lossless toggle, OxiPNG level, etc.) and changes take effect on re-optimize
  3. Clicking a file opens the detail view with a Squoosh-style split slider showing original vs. optimized side by side
  4. Global settings (e.g., default quality) propagate to all files; per-file overrides override globals without affecting siblings
  5. AVIF and WebP codecs load lazily — network tab shows their WASM bundles are not fetched until the first AVIF/WebP file is processed
**Plans**: TBD
**UI hint**: yes

### Phase 6: Snippet Generation
**Goal**: Users can copy production-ready HTML/CSS snippets that exactly match the generated file variants and ZIP filenames
**Depends on**: Phase 5
**Requirements**: SNIP-01, SNIP-02, SNIP-03, SNIP-04
**Success Criteria** (what must be TRUE):
  1. The `<picture>` snippet for a multi-format batch (AVIF + WebP + PNG) lists sources in AVIF→WebP→fallback order with correct `srcset` entries
  2. Snippet `srcset` strings (`logo@1x.webp 1x, logo@2x.webp 2x`) match the filenames that appear in the ZIP byte-for-byte
  3. Per-file checkboxes show/hide individual snippet types (picture, img srcset, CSS data URI, inline SVG, raw data URI); hidden types are absent from the copy output
  4. A CSS `background-image` data URI snippet includes a size-warning indicator when the encoded URI exceeds 32 KB
  5. One-click copy places the exact snippet text on the clipboard without extra whitespace or encoding artifacts
**Plans**: TBD
**UI hint**: yes

### Phase 7: ZIP Export + Persistence
**Goal**: Users can download all results in one structured ZIP and save/restore their codec settings as named presets
**Depends on**: Phase 6
**Requirements**: PIPE-05, PIPE-06, PRIV-02, PRIV-03, PRIV-04
**Success Criteria** (what must be TRUE):
  1. "Download All" produces a ZIP where filenames follow the `name@Nx.ext` convention and exactly match snippet srcset strings
  2. Downloading an individual file saves just that variant with the correct filename
  3. User can save current codec + global settings as a named preset, reload the page, and restore the preset from the sidebar — settings are intact
  4. Theme choice and last-used codec settings survive a page reload (localStorage); no file blobs or thumbnails persist between sessions
**Plans**: TBD

### Phase 8: Polish + Deploy
**Goal**: The app is production-deployed to oimg.app, passes a WCAG AA audit, and meets the < 200 KB initial-JS budget across Chrome, Firefox, and Safari
**Depends on**: Phase 7
**Requirements**: UI-07, UI-08, PERF-04, PRIV-01
**Success Criteria** (what must be TRUE):
  1. `https://oimg.app` loads with correct COOP/COEP headers; `crossOriginIsolated === true` in Chrome, Firefox, and Safari
  2. Initial JS bundle (excluding codec WASM) is < 200 KB gzipped (measured via `vite build` + `gzip -l`)
  3. An automated axe-core or Lighthouse accessibility audit reports zero WCAG AA violations on the main flow
  4. A 10-file PNG batch completes in under 10 seconds on a mid-range laptop in Chrome, Firefox, and Safari (empirical, manual measurement)
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shell + Foundation | 5/5 | Complete | 2026-04-30 |
| 2. Worker Harness + State | 5/5 | Complete | 2026-04-30 |
| 3. SVG Pipeline | 0/4 | Not started | - |
| 4. Decode + Resize + Memory Model | 0/7 | Not started | - |
| 5. Raster Encoders | 0/TBD | Not started | - |
| 6. Snippet Generation | 0/TBD | Not started | - |
| 7. ZIP Export + Persistence | 0/TBD | Not started | - |
| 8. Polish + Deploy | 0/TBD | Not started | - |
