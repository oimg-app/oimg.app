# oimg.app — v1 Requirements

**Project:** oimg.app — All-in-One Image Optimizer
**Derived from:** `.planning/PROJECT.md`
**Status:** Scoped for v1

---

## v1 Requirements

### Pipeline

- [x] **PIPE-01**: User can drag-and-drop or pick multiple files (SVG, PNG, WebP, JPEG, AVIF)
- [ ] **PIPE-02**: User can configure per-format codec settings via accordion settings panel
- [ ] **PIPE-03**: User can set global settings that apply across all uploaded files
- [ ] **PIPE-04**: User can mark each file's source density (1x / 2x / 3x); app generates missing variants by scaling
- [ ] **PIPE-05**: User can download all results as a single ZIP archive
- [ ] **PIPE-06**: User can download individual files

### Optimization

- [x] **OPT-01**: SVG optimization via SVGO browser bundle (preset-default + per-plugin toggles)
- [ ] **OPT-02**: PNG optimization via jSquash OxiPNG (lossless levels 0-6)
- [ ] **OPT-03**: WebP optimization via jSquash WebP (lossy/lossless, quality, method)
- [ ] **OPT-04**: JPEG optimization via jSquash `@jsquash/jpeg` (MozJPEG-based; quality, progressive)
- [ ] **OPT-05**: AVIF optimization via jSquash AVIF (quality, lossless)
- [ ] **OPT-06**: Metadata stripping (EXIF/XMP/IPTC) with optional ICC-profile preservation

### Snippet Generation

- [x] **SNIP-01**: Per-file snippet panel with `<picture>` srcset, `<img srcset>`, CSS data URI, inline SVG, raw data URI
- [ ] **SNIP-02**: Snippets reflect actual generated variants (1x/2x/3x) and chosen output formats
- [x] **SNIP-03**: One-click copy-to-clipboard per snippet
- [x] **SNIP-04**: URL-encoded data URI for SVG (cross-browser CSS-safe), Base64 for raster

### UI/UX

- [x] **UI-01**: Port `example-ui/` (UMD React prototype) to Vite + TypeScript — preserve layout, components, design tokens, theme system
- [ ] **UI-02**: Use shadcn/ui components (sliders, checkboxes, etc.) adapted from `example-ui/` visual language
- [ ] **UI-03**: File list view with thumbnail before/after, size delta (bytes + %)
- [ ] **UI-04**: Click a file to open detail view with Squoosh-style split slider (original ↔ optimized) and per-file overrides
- [ ] **UI-05**: Accordion-style settings panel (per format, plus Global, Resize/Variants, Snippet output)
- [x] **UI-06**: Dark + light theme (dark default, oklch palette from example-ui)
- [x] **UI-07**: Responsive desktop-first layout
- [x] **UI-08**: Full keyboard navigation, ARIA labels, WCAG AA contrast

### Privacy & Persistence

- [ ] **PRIV-01**: Zero telemetry, zero analytics, zero outbound requests after WASM load
- [ ] **PRIV-02**: Named user presets persisted in IndexedDB (codec + global settings bundles)
- [ ] **PRIV-03**: Theme + last-used settings in localStorage
- [ ] **PRIV-04**: No file history, no thumbnail cache (privacy-first)

### Performance

- [x] **PERF-01**: WASM codecs run in Web Worker pool (non-blocking UI)
- [x] **PERF-02**: Lazy-load codecs on first use
- [x] **PERF-03**: Progress UI for batch operations
- [ ] **PERF-04**: Codec bundle splitting (don't ship AVIF WASM if user only processes SVG/PNG)

---

## v2 Requirements (Deferred)

- PWA / offline shell — adds Workbox complexity; ship live tool first
- i18n beyond English — add locales when traffic justifies
- Aggregated multi-file CSS export — per-file snippets only in v1
- Butteraugli auto-mode — experimental, niche
- JPEG XL — codec ecosystem still maturing

---

## Out of Scope

- **Backend / accounts / cloud sync** — Zero-server is a core value, not a phase
- **Telemetry / analytics** — privacy is a selling point; never add
- **Animated GIF/MP4/WebM transcoding** — out of "image" scope
- **Image editing (crop, rotate, filters)** — optimizer, not editor
- **CDN / dynamic image resizing service** — that's an Imgix/Cloudinary problem

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| UI-01 | Phase 1 | TBD |
| UI-02 | Phase 1 | TBD |
| UI-06 | Phase 1 | TBD |
| UI-07 | Phase 1 | TBD |
| UI-08 | Phase 1 | TBD |
| PRIV-01 | Phase 1 | TBD |
| PERF-04 | Phase 1 | TBD |
| PERF-01 | Phase 2 | TBD |
| PERF-02 | Phase 2 | TBD |
| PERF-03 | Phase 2 | TBD |
| OPT-01 | Phase 3 | TBD |
| SNIP-01 | Phase 3 | TBD |
| SNIP-03 | Phase 3 | TBD |
| SNIP-04 | Phase 3 | TBD |
| PIPE-01 | Phase 3 | TBD |
| PIPE-04 | Phase 4 | TBD |
| OPT-06 | Phase 4 | TBD |
| OPT-02 | Phase 5 | TBD |
| OPT-03 | Phase 5 | TBD |
| OPT-04 | Phase 5 | TBD |
| OPT-05 | Phase 5 | TBD |
| PIPE-02 | Phase 5 | TBD |
| PIPE-03 | Phase 5 | TBD |
| UI-03 | Phase 5 | TBD |
| UI-04 | Phase 5 | TBD |
| UI-05 | Phase 5 | TBD |
| SNIP-02 | Phase 6 | TBD |
| PIPE-05 | Phase 7 | TBD |
| PIPE-06 | Phase 7 | TBD |
| PRIV-02 | Phase 7 | TBD |
| PRIV-03 | Phase 7 | TBD |
| PRIV-04 | Phase 7 | TBD |
