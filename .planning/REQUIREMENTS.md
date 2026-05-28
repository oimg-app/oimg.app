# Requirements: oimg.app — v1.1 Real Optimization Pipeline

**Defined:** 2026-05-25
**Core Value:** A developer drops assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste snippets — without anything leaving the browser.

## v1.1 Requirements

Reconnecting the real optimization pipeline behind the v1.0 UI. The v1.0 milestone built the full UI rendering from stub data; this milestone makes it actually optimize images.

### Pipeline Infrastructure

- [x] **PIPE-01**: Optimization runs off the main thread via a Comlink-wrapped WorkerPool — the UI stays responsive (no jank) while files encode
- [x] **PIPE-02**: Codecs are dynamically imported inside workers so the initial route stays < 200KB gzipped; AVIF loads only when the user selects it
- [x] **PIPE-03**: COOP/COEP response headers are configured so SharedArrayBuffer is available for multi-threaded codecs (OxiPNG, AVIF)
- [x] **PIPE-04**: Backpressure is enforced — the pool bounds concurrent jobs and the BackpressureIndicator reflects real running state

### Encoding

- [x] **ENC-01**: User can optimize a PNG via OxiPNG (decode through @jsquash/png, re-encode) and get real reduced-size output
- [x] **ENC-02**: User can encode/convert to WebP with quality and lossless controls
- [x] **ENC-03**: User can encode/convert to JPEG (MozJPEG) with quality and progressive controls
- [x] **ENC-04**: User can encode/convert to AVIF (lazy-loaded) with quality control
- [x] **ENC-05**: User can optimize an SVG via svgo with the inspector's plugin toggles actually applied
- [x] **ENC-06**: Inspector settings (quality, effort, lossless, resize, strip-metadata) drive the real encode output per codec

### Optimize Loop

- [x] **OPT-01**: User drops a single file → sees real optimized output with accurate before/after byte sizes in the Report
- [ ] **OPT-02**: User clicks Optimize-all → the batch runs through the worker pool with live per-file progress

### Export

- [ ] **EXP-01**: User can download a single optimized file to disk
- [ ] **EXP-02**: User can export the entire optimized batch as a ZIP (jszip)

### Snippets

- [ ] **SNIP-01**: Output panel snippets (Base64 data-URI, URL-encoded, `<picture>`) reflect the real encoded bytes of the selected file, not stub placeholders

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Variants

- **VAR-01**: User can generate 1×/2×/3× density variants per file (@jsquash/resize)
- **VAR-02**: `<picture>`/`srcset` snippets reference generated density variants

### Persistence

- **PERS-01**: Named setting presets persisted via idb-keyval

## Out of Scope

| Feature | Reason |
|---------|--------|
| 1×/2×/3× density variants | Deferred to next milestone — core single-output pipeline ships first |
| Setting presets / persistence | Not core to the optimize loop; future milestone |
| Server-side processing | Non-negotiable — client-only app |
| New codecs beyond jSquash set | jSquash (WebP/JPEG/AVIF/OxiPNG/PNG) + svgo is the locked codec surface |
| v1.0 tech debt (phase verification, banner landmarks) | Tracked in STATE.md Deferred Items; not this milestone's scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 8 | Complete |
| PIPE-02 | Phase 8 | Complete |
| PIPE-03 | Phase 8 | Complete |
| PIPE-04 | Phase 8 | Complete |
| ENC-01 | Phase 9 | Complete |
| ENC-02 | Phase 9 | Complete |
| ENC-03 | Phase 9 | Complete |
| ENC-04 | Phase 9 | Complete |
| ENC-05 | Phase 9 | Complete |
| ENC-06 | Phase 9 | Complete |
| OPT-01 | Phase 10 | Complete |
| OPT-02 | Phase 11 | Pending |
| EXP-01 | Phase 11 | Pending |
| EXP-02 | Phase 11 | Pending |
| SNIP-01 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 after roadmap creation (Phases 8–12)*
