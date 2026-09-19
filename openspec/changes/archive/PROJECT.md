# oimg.app

## What This Is

A 100% client-side, zero-server browser tool for web developers to batch-optimize SVG/PNG/WebP/JPEG/AVIF assets, generate 1×/2×/3× variants, and copy production-ready `<picture>`, `<img srcset>`, CSS `background-image`, and inline SVG snippets. Built with React + Vite + TypeScript, jSquash WASM codecs, and svgo — everything runs in the browser, nothing leaves the machine.

## Core Value

A developer drops a folder of source assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.

## Current State

**Shipped:** v1.2 — Polish, Diagnostics, PWA + Quality Metrics (2026-07-23)

The core promise now walks with quality feedback and installability:

> drop folder → settings once → real optimized result → quality scores → ZIP + paste-ready snippets, installable to desktop/mobile, nothing leaves the browser.

v1.2 layered polish + diagnostic transparency + perceptual quality + installable distribution on top of the v1.1 codec pipeline. Live version + capability diagnostics via Vite `define` (svgo + jSquash + ssim + butteraugli buildHash + SIMD/threads/COOP-COEP/CPUs). Installable PWA via `vite-plugin-pwa` (injectManifest) — app shell precached, codec wasms runtime-cached (AVIF's 3.4 MB never on first visit). URL + paste ingest as first-class channels. SSIM (via `ssim.js@3.5.0`) and Butteraugli (via `@squoosh-kit/visdif@0.2.4` — user-approved pivot from hand-built Emscripten) auto-compute alongside every optimized file with banded green/yellow/red display. Audit `conditional` — 15/15 requirements satisfied, 12 human-verification checkpoints and Toolbar `<dl>` polish closed inline; 2 non-trivial visdif interop auto-fixes documented.

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for the full ship report.

## Next Milestone: v1.3 — TBD

Awaiting `/gsd-new-milestone` for direction. Leading candidates from v1.2 deferred list:
- **VAR-01 / VAR-02** — 1×/2×/3× density variants via `@jsquash/resize` (deferred since v1.0)
- **PERS-01** — Named setting presets via `idb-keyval` (deferred since v1.0)
- **PWA-NEXT** — Web Share Target API ("Share to oimg.app" from Photos/Files apps)
- Watch-folder polish (Stop watching UI, IDB handle persistence, recursive/multi-folder)
- Snippet follow-ups (multi-format `<picture>` fallback chain, customization toggles, inline SVG snippet, manifest JSON in ZIP)
- Human-verification dogfood: 12 checkpoints across Phase 13/14/15 + HEIC quick-task (260610-lby)

<details>
<summary>Previous milestone snapshot (v1.2)</summary>

**Goal:** Round out the v1.1 pipeline with the remaining ingest channel, queue hygiene, real perceptual quality measurement, real diagnostics surfacing, and turn oimg.app into a true installable PWA.

**Target features (all shipped):**
- From URL / paste ingest with CORS-honest failure messaging
- Clear queue action surfaced via Toolbar + FilesPane
- Real SSIM perceptual metric (`ssim.js@3.5.0`) with banded display
- Real Butteraugli metric — pivoted from hand-built Emscripten to `@squoosh-kit/visdif@0.2.4` (Squoosh's canonical binary; user-approved scope deviation 2026-07-20)
- Live diagnostic values via `versionsAtom` (svgo, jSquash codecs, ssim, butteraugli buildHash, SIMD, threads, crossOriginIsolated, hardwareConcurrency)
- Settings popover Diagnostics tab with copy-to-clipboard
- Installable PWA (`vite-plugin-pwa` injectManifest, hand-rolled `src/sw.ts`, CacheFirst codec wasms, install prompt, "New version" toast)

**Bundle:** 197.2 KB gzipped initial route (< 200 KB PIPE-02 budget); 2.8 KB headroom.

**Deferred (rolled to v1.3):** VAR-01/02 density variants, PERS-01 setting presets, Watch-folder polish, snippet follow-ups, PWA Share Target, 12 human-verification checkpoints.

</details>

<details>
<summary>Previous milestone snapshot (v1.1)</summary>

**Goal:** Reconnect the full codec pipeline behind the v1.0 UI so a developer can drop assets, adjust settings, and walk away with real optimized files + ZIP + paste-ready snippets — all client-side.

**Target features (all shipped):**
- Full jSquash worker pipeline — WebP, JPEG (MozJPEG), AVIF (lazy-loaded), OxiPNG, SVG (svgo v4)
- Single-file optimize + download (drop → adjust → real output)
- Batch ZIP export (jszip)
- Real paste-ready snippets — Output panel wired to actual encoded bytes
- Bonus: Watch folder ingest channel via showDirectoryPicker + FileSystemObserver

**Deferred (rolled to v1.2):** 1×/2×/3× density variants, named setting presets, Phase 12 paste-render dogfood.

</details>

## Requirements

### Validated

- ✓ Worker harness (WorkerPool singleton, Comlink, 4 ES-module Web Workers) — Phase 2
- ✓ nanostores state layer (`filesStore`, `settingsStore`, `runtimeStore`) — Phase 2
- ✓ SVG pipeline (svgo v4, DOMPurify sanitization, snippet generation) — Phase 3
- ✓ Decode/resize memory model (jSquash PNG decode, @jsquash/resize, ICC strip) — Phase 4
- ✓ Raster encoders (WebP, JPEG, AVIF, OxiPNG adapters + worker routing) — Phase 5
- ✓ Shadcn UI configured (`radix-lyra` style, phosphor icons, CSS variables, neutral base) — Phase 10
- ✓ example-ui prototype ported to React + TS + Tailwind + Radix — full 3-pane AppShell, TitleBar/Toolbar/StatusBar/CommandPalette, FilesPane, InspectorPane (codec + SVGO + Output + Report), CenterPane — v1.0
- ✓ oklch design tokens + fonts ported verbatim from OIMG.html, Tailwind v4 @theme — v1.0
- ✓ WCAG AA keyboard nav (DropdownMenu menus, focus rings), theme toggle w/ no FOUC — v1.0
- ✓ Worker pipeline foundation — bounded Comlink WorkerPool (`getPool()`, cap min(hwConc,4)), codecs dynamic-imported inside the worker, COOP/COEP isolation, real backpressure via `runtimeAtom`; PNG→OxiPNG is the one real path (other codecs stubbed for Phase 9). Initial route 144KB gzip < 200KB. — Phase 8
- ✓ Codec encoders — all five jSquash/svgo adapters real (PNG/OxiPNG, WebP, JPEG/MozJPEG, lazy AVIF, SVG/svgo v4 in-worker), per-file settings model + "Apply to all", debounced live re-encode feeding CompareStage/DeltaStrip, single-image resize-before-encode, D-13 per-file error fallback. Inspector controls measurably shape encoded bytes. WR-02/WR-03/CR-01 Phase 8 fixes folded in. — Phase 9
- ✓ Single-file optimize loop (OPT-01) — `useIngest` is the one ingestion seam (drop + picker), empties the seeded demo list (D-04), format-gates with silent skip (D-06/D-07), maps File→FileEntry with truthful `File.size`, and auto-optimizes via Phase 9 `runOptimize`. Report/DeltaStrip show real before/after bytes; re-adjusting a setting re-optimizes (useLiveEncode). 53/53 e2e green; review fixes WR-01/04/05 (status transition, WCAG-AA dropzone, cross-browser picker fallback) resolved. — Phase 10

### Shipped (v1.1)

- [x] Worker pipeline: WorkerPool + Comlink, codecs dynamic-imported inside workers (WebP/JPEG/AVIF/OxiPNG/SVG) — Phase 8/9
- [x] Single-file optimize: drop → decode → encode → real optimized output, wired to runtime store — Phase 10
- [x] Settings actually drive encoding (quality/effort/lossless/resize/metadata per codec) — Phase 9
- [x] Batch optimize with live progress + bounded backpressure — Phase 11
- [x] Single-file download (showSaveFilePicker + file-saver fallback) — Phase 11
- [x] Batch ZIP export via jszip (timestamped, flat, collision-suffixed) — Phase 11
- [x] Output panel snippets wired to real encoded bytes (Base64 / URL-encoded / `<picture>`) — Phase 12
- [x] Toolbar bulk copy actions + FileRow row clipboard items — Phase 12
- [x] COOP/COEP headers for SharedArrayBuffer (MT codecs) — Phase 8
- [x] Watch folder via showDirectoryPicker + FileSystemObserver — quick task 260603-s2x

### Shipped (v1.2)

- [x] Live version + capability diagnostics via `versionsAtom` (svgo + jSquash + ssim + butteraugli buildHash + SIMD/threads/COOP-COEP/CPUs) — Phase 13
- [x] Settings popover Diagnostics tab with copy-to-clipboard — Phase 13
- [x] `clearFiles()` queue-hygiene action via Toolbar + FilesPane — Phase 13
- [x] Installable PWA via `vite-plugin-pwa` (injectManifest) + hand-rolled `src/sw.ts` + `beforeinstallprompt` — Phase 14
- [x] Cloudflare `_headers` for sw.js no-cache + manifest max-age + COOP/COEP preserved — Phase 14
- [x] URL + paste ingest via `pickFromUrl` / `pickFromClipboard` + document-level Cmd/Ctrl+V handler — Phase 15
- [x] Real SSIM perceptual metric via `ssim.js@3.5.0` in sibling metrics worker + banded ReportPanel row — Phase 16
- [x] Real Butteraugli metric via `@squoosh-kit/visdif@0.2.4` (pivot from hand-built Emscripten, user-approved) + parallel dispatch with SSIM — Phase 17
- [x] 4 quick tasks: HEIC decode (260610-lby); svg-compare-iframe; svg-compare-codec-switch; svg-export-raster-codec

### Deferred to v1.3+

- 1×/2×/3× density variants (@jsquash/resize) — VAR-01 / VAR-02 (twice-deferred)
- Named setting presets via idb-keyval — PERS-01 (twice-deferred)
- Web Share Target API — PWA-NEXT
- Watch-folder polish: Stop watching UI, IDB handle persistence, recursive/multi-folder
- Snippet follow-ups: multi-format `<picture>`, customization toggles, inline SVG snippet, manifest JSON in ZIP
- v1.2 human-verification checkpoints: 12 dogfood tasks across Phase 13/14/15 (clipboard round-trip, PWA install/offline flows, Cloudflare `_headers` curl checks)
- HEIC quick-task human verification (260610-lby)
- v1.1 audit tech debt (still open): `addFromDevice` empty stub retirement; Nyquist sign-off on Phase 11/12 VALIDATION.md; Vite double-import inefficiency; Phase 12 paste-into-browser dogfood
- v1.0 tech debt (still open): phase verification, duplicate `banner` landmarks (WCAG)

### Out of Scope

- New codec features or settings panels not in example-ui — not in v1.0
- Server-side rendering — non-negotiable, this is a client-side-only app
- IE/legacy browser support — non-negotiable

## Context

**Current state (after v1.0, 2026-05-25):** UI Port shipped as Executed — 7 phases, 22 plans, ~379 commits over 27 days. Full React + TS + Tailwind + Radix component tree renders from Zustand stores against static stub data. Workers/stores not yet reconnected (next-milestone work). Formal phase verification was skipped at close (accepted as tech debt — see MILESTONES.md Known Gaps / STATE.md Deferred Items).

**Source of truth:** `example-ui/` directory contains the reference prototype:
- `OIMG.html` (938 lines) — full HTML prototype with design tokens and CSS variables
- `app.jsx` (710 lines) — top-level layout, AppShell, FilesPane, CenterPane
- `panels.jsx` (326 lines) — codec settings panels
- `tweaks-panel.jsx` (425 lines) — tweaks/adjustments panel

**Prior work state:** `src/` was fully deleted in a component refactor (Phase 10 shadcn migration). This milestone rebuilds it from example-ui as the canonical source, not from the deleted files.

**Design tokens (locked — must port verbatim):**
- oklch color palette (from OIMG.html CSS vars)
- Fonts: Inter (UI) + JetBrains Mono (code/snippets)
- Accent: green ~145° oklch
- Dark theme default, light theme supported

**Shadcn config already set:**
- Style: `radix-lyra`, icon library: phosphor, CSS variables: on, baseColor: neutral
- Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`

**Architecture constraints:**
- Business logic in `src/hooks/*` and `src/stores/*` — never inline in components
- Phase/plan attribution headers required on all files
- Circular ESM: `files.ts ↔ runtime.ts ↔ settings.ts` — avoid importing these in the UI-only milestone
- Workers use literal string paths in ADAPTERS map (no template literals)

## Constraints

- **Tech stack**: React 19 + Vite 8 + TypeScript 5.9 — locked
- **UI framework**: Tailwind + Radix UI + Shadcn UI (`radix-lyra`) — this milestone adds Tailwind
- **Structure**: Preserve example-ui HTML structure exactly — no restructuring
- **CSS approach**: Tailwind utility classes only — no CSS modules, no inline styles
- **Privacy**: Zero-server, zero-telemetry — all processing client-side
- **Compatibility**: Modern browsers only (Chrome/Firefox/Safari/Edge last 2 stable)
- **Bundle budget**: Initial route < 200KB gzipped (codecs lazy-loaded)
- **Accessibility**: WCAG AA — keyboard navigation, ARIA, contrast

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tailwind over CSS modules | Shadcn requires Tailwind; CSS modules were deleted in refactor anyway | — Pending |
| UI-only milestone (stub data) | Decouples visual correctness from worker reconnection complexity | — Pending |
| Port from example-ui, not from deleted src/ | example-ui is the approved design reference; deleted src/ had bugs and stubs | — Pending |
| radix-lyra shadcn style | Already configured in components.json; matches oklch design token palette | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-23 after v1.2 milestone archive complete*
