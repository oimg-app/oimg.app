# OmniImage Optimizer

## What This Is

A zero-server, client-side Progressive Web App (PWA) that lets developers and designers optimize images in SVG, PNG, WebP, JPEG, and AVIF formats locally using WebAssembly codecs from the Squoosh ecosystem and SVGO engine. Users can drag-and-drop files, adjust optimization settings per format, compare before/after results, batch process multiple files, and export optimized images with data URI / Base64 encoding — all in the browser with full privacy.

## Core Value

Maximum image compression without visual loss, running entirely in the browser with zero server dependency.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Support drag-and-drop and file picker for single/batch image upload
- [ ] SVG optimization via SVGO WASM with configurable plugin presets (SVGOMG-style UI)
- [ ] Raster optimization: PNG (OxiPNG), WebP (libwebp), JPEG (MozJPEG), AVIF (libavif) via Squoosh WASM
- [ ] Side-by-side before/after comparison with slider split view
- [ ] Quality/size controls per codec with real-time preview
- [ ] Data URI / Base64 export for SVG (URL-encoded and base64 modes) and raster formats
- [ ] Batch processing with progress indicator and ZIP download
- [ ] Resize with multiple algorithms (Lanczos, Catmull-Rom, Mitchell, Bicubic)
- [ ] Metadata stripping (EXIF, XMP, IPTC, ICC profile option)
- [ ] Auto mode using Butteraugli distance target
- [ ] PWA support: offline capability, installable on desktop/mobile
- [ ] Dark/light theme toggle
- [ ] Session history via IndexedDB (presets and past sessions)

### Out of Scope

- Server-side processing or cloud storage — all data stays in browser
- JXL/HEIC codec support — defer to v2+ when ecosystem matures
- Real-time collaboration features — single-user tool
- Mobile-native app (iOS/Android native) — PWA covers mobile browsers

## Context

**Inspiration sources:**
- **Squoosh** (Google Chrome Labs) — WASM codecs for raster formats, Butteraugli auto mode
- **SVGOMG** — SVGO frontend with plugin toggles and preset management
- **URL Encoder** (yoksel) — SVG to data URI / url() encoding patterns

**Technical environment:**
- Browser-only architecture: React/Vue/SvelteKit + Vite + TypeScript
- WASM modules: svgo, @squoosh/lib (mozjpeg, oxipng, webp, avif)
- PWA via Workbox for offline support
- IndexedDB for local persistence of presets and session history

**Known challenges:**
- WASM module loading size and cold-start performance
- Managing multiple codec configurations in a unified UI without complexity overload
- Batch processing with Web Workers to avoid blocking the main thread
- Cross-browser compatibility for WASM features (WebGPU encoding path)

## Constraints

- **[Tech Stack]**: Client-side only — must run in modern browsers without server — enables zero-deployment and full privacy
- **[Performance]**: WASM modules should load efficiently; consider lazy-loading codecs on demand rather than bundling all at once
- **[Browser Support]**: Modern browsers (Chrome, Firefox, Safari, Edge) with WebAssembly support
- **[Architecture]**: Modular codec plugins — each format handled by its dedicated engine, unified through a common UI layer

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only (zero-server) | Privacy-first, no deployment cost, works offline | ✓ Confirmed by spec |
| Squoosh WASM + SVGO as core engines | Battle-tested codecs with best-in-class compression | ✓ Confirmed by spec |
| PWA target | Installable on desktop/mobile, offline capable | ✓ Confirmed by spec |
| TypeScript for type safety | Configurations and plugin schemas benefit from typing | ✓ Confirmed by spec |

---
*Last updated: 2026-04-28 after initialization*

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
4. Update Context with current state (users, feedback, metrics)
