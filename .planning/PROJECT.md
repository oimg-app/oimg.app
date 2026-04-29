# oimg.app — All-in-One Image Optimizer

## What This Is

A 100% client-side, zero-server browser tool that lets web developers batch-optimize SVG/PNG/WebP/JPEG/AVIF assets, generate 1x/2x/3x variants per file, and copy production-ready paste-ready snippets (`<picture>` with srcset, `<img srcset>`, CSS `background-image` data URI, inline SVG). It fuses the workflows of Squoosh + SVGOMG + url-encoder behind a unified developer-first UX.

## Core Value

**A developer drops a folder of source assets, picks output settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.**

If everything else fails, the upload → adjust → download-with-snippets pipeline must work flawlessly for SVG and PNG.

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### Pipeline (the core flow)
- [ ] User can drag-and-drop or pick multiple files (SVG, PNG, WebP, JPEG, AVIF)
- [ ] User can configure per-format codec settings via Squoosh-style accordion settings panel
- [ ] User can set global settings that apply across all uploaded files
- [ ] User can mark each file's source density (1x / 2x / 3x); app generates the missing variants by up/down-scaling
- [ ] User can download all results as a single ZIP archive
- [ ] User can download individual files

#### Optimization
- [ ] SVG optimization via SVGO browser bundle (preset-default + per-plugin toggles)
- [ ] PNG optimization via jSquash OxiPNG (lossless levels 0-6)
- [ ] WebP optimization via jSquash WebP (lossy/lossless, quality, method)
- [ ] JPEG optimization via jSquash `@jsquash/jpeg` (MozJPEG-based encoder; quality, progressive)
- [ ] AVIF optimization via jSquash AVIF (quality, lossless)
- [ ] Metadata stripping (EXIF/XMP/IPTC) with optional ICC-profile preservation

#### Snippet generation (the differentiator)
- [ ] Per-file snippet panel with checkboxes to enable: `<picture>` + srcset, `<img srcset>`, CSS `background-image` data URI, inline `<svg>` markup, raw data URI string
- [ ] Snippets reflect actual generated variants (1x/2x/3x) and chosen output formats (e.g., AVIF + WebP + PNG fallback in `<picture>`)
- [ ] One-click copy-to-clipboard per snippet
- [ ] URL-encoded data URI for SVG (cross-browser CSS-safe), Base64 for raster

#### UI/UX
- [ ] Port `example-ui/` (UMD React + HTML prototype) to Vite + TypeScript + JSX modules — preserve layout, components, design tokens, theme system
- [ ] Use ui.shadcn.com/docs/components for sliders, checkboxes, etc. Adapt components to ui from `example-ui/`
- [ ] File list view with thumbnail before/after, size delta (bytes + %)
- [ ] Click a file to open detail view with Squoosh-style split slider (original ↔ optimized) and per-file overrides
- [ ] Accordion-style settings panel (per format, plus Global, Resize/Variants, Snippet output)
- [ ] Dark + light theme
- [ ] Responsive desktop-first layout
- [ ] Full keyboard navigation, ARIA labels, WCAG AA contrast

#### Privacy & persistence
- [ ] Zero telemetry, zero analytics, zero outbound requests after WASM load
- [ ] Named user presets persisted in IndexedDB (codec + global settings bundles)
- [ ] Theme + last-used settings in localStorage
- [ ] No file history, no thumbnail cache (privacy)

#### Performance
- [ ] WASM codecs run in Web Worker pool (non-blocking UI)
- [ ] Lazy-load codecs on first use
- [ ] Progress UI for batch operations
- [ ] Codec bundle splitting (don't ship AVIF if user only touches SVG/PNG)

### Out of Scope

#### Deferred to v2+
- **PWA / offline shell** — important but adds Workbox + service-worker complexity; ship live tool first, harden offline later
- **i18n beyond English** — author is RU-speaking but devs read English; ship faster, add locales when there's traffic
- **Aggregated multi-file CSS export** — per-file snippets only in v1; combined CSS export when users ask
- **Butteraugli auto-mode** — experimental Squoosh feature, niche, defer
- **JPEG XL** — codec ecosystem still maturing in 2026, defer

#### Explicitly excluded
- **Backend, accounts, cloud sync** — Zero-server is a core value, not a phase
- **Telemetry / analytics** — privacy is a selling point vs Squoosh, never add
- **Animated GIF/MP4/WebM transcoding** — out of "image" scope
- **Image editing (crop, rotate, filters)** — this is an optimizer, not an editor
- **Reinventing SVGO or jSquash** — integrate, don't fork
- **CDN / dynamic image resizing service** — that's an Imgix/Cloudinary problem, not ours

## Context

**Domain:** Browser-based image optimization. Reference projects (Squoosh by Google Chrome Labs, SVGOMG, url-encoder by yoksel) each solve one slice. None of them solve the developer's full workflow of: take source assets → produce production-ready files + the markup to embed them.

**Why this matters now:**
- `@squoosh/lib` was archived by Google in 2023; jSquash is the modern community port (per-codec packages: `@jsquash/{webp,avif,oxipng,mozjpeg,jpeg,png}`).
- SVGO v3+ ships an ESM browser build, so in-browser SVG optimization no longer needs Node shims.
- WebAssembly codec pipeline is mature; the gap is UX, not capability.

**Reference repos in `inspired/`:**
- `inspired/squoosh/` — Squoosh source (Apache 2.0). Reference for codec WASM glue, Web Worker pool design, side-by-side preview UX.
- `inspired/svgomg/` — SVGOMG source (MIT). Reference for SVGO plugin toggle UX and accordion settings panel.
- `inspired/url-encoder/` — yoksel's url-encoder (MIT). Reference for URL-encoded data URI generation logic.

These are reference material only — not vendored, not copied. Inspect for patterns, write our own.

**UI prototype in `example-ui/`:**
- High-fidelity working React prototype (~2.5K LOC): `OIMG.html` (standalone HTML with full design system), `app.jsx`, `panels.jsx`, `tweaks-panel.jsx`, `icons.jsx`, `data.jsx`.
- UMD-React, no build step (renders directly in browser via script tags). Demonstrates the target layout, component structure, accordion settings panel, popover/tooltip primitives, and visual language.
- **Design tokens already defined**: oklch-based palette with dark (default) + light themes, Inter (sans) + JetBrains Mono (mono) typography, accent green (~145°), warn amber, error red.
- **Treated as the visual + component contract for v1.** The Vite + TS migration must preserve the look, the component shapes, and the design tokens.

**User profile:** Frontend developer producing site assets. Typical session: drop ~5–30 files, configure once, export. They care about: bytes saved, paste-ready output, no friction, no surprises, no cloud upload.

## Constraints

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite over Svelte/SvelteKit | Component reusability across modes; broader hire pool; Vite handles WASM cleanly | — Pending |
| jSquash over `@squoosh/lib` or `@squoosh-kit/core` | Squoosh archived 2023; jSquash is the modern, per-codec, actively maintained replacement | — Pending |
| SVGO v3+ ESM browser bundle (no WASM) | Native browser support since v3; simpler than maintaining a custom SVGO WASM build | — Pending |
| File list + click-to-detail (not 4 tabs) | Matches the "developer batch-processes a folder" user story; tabs would force mode switching that breaks flow | — Pending |
| Squoosh-style accordion settings panel | Familiar to target audience; allows global + per-format settings without nesting | — Pending |
| User picks 1x/2x/3x source density per file | Lets devs upload mixed sources; app generates the others — covers @1x-only and @2x-only workflows in one model | — Pending |
| Per-file snippets (not aggregated) in v1 | Matches "process this batch, paste these" workflow; aggregated CSS export deferred until users ask | — Pending |
| Zero telemetry — never | Privacy is the differentiator vs Squoosh's GA; adding any tracking would erode the brand | ✓ Locked |
| MIT license | Matches deps; permissive enough for any user; standard for dev tools | ✓ Locked |
| Cloudflare Pages hosting | Free tier, fast edge, native COOP/COEP header config for WASM threading, oimg.app DNS already there | — Pending |
| English-only v1 | Ship faster; structure strings for i18n but no translations until traffic justifies | — Pending |
| Reuse `example-ui/` as React UI base | Working high-fidelity prototype with design system already exists — port to Vite + TS rather than redesign | — Pending |
| Preserve `OIMG.html` design tokens (oklch palette, Inter/JBMono, accent green) | Visual identity already defined; freezing it prevents bikeshedding and yields a coherent v1 | — Pending |

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
*Last updated: 2026-04-29 after initialization*
