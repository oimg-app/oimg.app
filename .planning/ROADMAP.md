# ROADMAP: oimg.app

## Milestones

- ✅ **v1.0 — UI Port** — Phases 1–7 (shipped 2026-05-25) — full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 — Real Optimization Pipeline** — Phases 8–12 (active) — reconnects the real codec pipeline behind the v1.0 UI

## Phases

<details>
<summary>✅ v1.0 UI Port (Phases 1–7) — SHIPPED 2026-05-25 (Executed)</summary>

- [x] Phase 1: Foundation (5/5 plans)
- [x] Phase 2: Files Pane (2/2 plans)
- [x] Phase 3: Navigation Shell (3/3 plans)
- [x] Phase 4: Inspector — Codec + SVGO (4/4 plans)
- [x] Phase 5: Center Pane (2/2 plans)
- [x] Phase 6: Inspector — Output + Report (3/3 plans)
- [x] Phase 7: Polish (3/3 plans)

Shipped as **Executed** — all 22 plans built + summarized; formal phase verification skipped (see `MILESTONES.md` → Known Gaps and `STATE.md` → Deferred Items). Full phase detail, success criteria, and requirements map preserved in the archive.

</details>

### 🚧 v1.1 Real Optimization Pipeline (Phases 8–12)

- [ ] **Phase 8: Worker Pipeline Foundation** — Bounded Comlink WorkerPool + dynamic codec imports + COOP/COEP, backpressure wired to real running state
- [ ] **Phase 9: Codec Encoders** — PNG/WebP/JPEG/AVIF/SVG adapters wired so inspector settings drive real encode output
- [ ] **Phase 10: Single-File Optimize Loop** — Drop one file → real optimized output with accurate before/after sizes in the Report
- [ ] **Phase 11: Batch Optimize + Export** — Optimize-all through the pool with live progress, single-file download, and batch ZIP export
- [ ] **Phase 12: Real Snippets** — Output panel snippets reflect the selected file's actual encoded bytes

## Phase Details

### Phase 8: Worker Pipeline Foundation
**Goal**: Optimization work runs off the main thread through a bounded, Comlink-wrapped worker pool, with the headers and codec-loading strategy that keep the UI responsive and the initial bundle small.
**Depends on**: Phase 7 (v1.0 UI + stores)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. A test/encode job dispatched to the pool runs in a Web Worker and the main-thread UI stays interactive (scroll/click with no jank) while it runs
  2. Codecs are dynamic-imported inside workers — the initial route loads < 200KB gzipped and AVIF's WASM is not fetched until AVIF is selected
  3. SharedArrayBuffer is available in the running app (`crossOriginIsolated === true`) via COOP/COEP response headers in dev and the Cloudflare Pages `_headers` file
  4. The pool caps concurrent jobs; when more jobs are queued than slots, excess jobs wait, and the BackpressureIndicator reflects the pool's real running/queued state
**Plans**: 3 plans (2 waves)
- [ ] 08-01-PLAN.md — COOP/COEP verification + Wave 0 test scaffolds (worker-pipeline.spec.ts; extend backpressure.spec.ts) [PIPE-03]
- [ ] 08-02-PLAN.md — Comlink codec worker (dynamic imports, real PNG→OxiPNG path) + bounded WorkerPool [PIPE-01, PIPE-02]
- [ ] 08-03-PLAN.md — Extend runtimeAtom job counts + useOptimize hook + wire Toolbar to the pool [PIPE-04]

### Phase 9: Codec Encoders
**Goal**: Every codec in the locked jSquash + svgo surface has a worker-side adapter, and the inspector's controls actually shape the encoded bytes.
**Depends on**: Phase 8
**Requirements**: ENC-01, ENC-02, ENC-03, ENC-04, ENC-05, ENC-06
**Success Criteria** (what must be TRUE):
  1. A PNG run through OxiPNG (decode via @jsquash/png → re-encode) produces real, smaller-byte output
  2. WebP, JPEG (MozJPEG), and AVIF (lazy-loaded) each produce valid encoded output with their format-specific controls (quality, lossless, progressive) applied
  3. An SVG run through svgo v4 (preset-default + overrides) shrinks with the inspector's plugin toggles actually reflected in the result
  4. Changing an inspector setting (quality / effort / lossless / resize / strip-metadata) measurably changes the encoded output for the corresponding codec
**Plans**: TBD
**UI hint**: yes

### Phase 10: Single-File Optimize Loop
**Goal**: A developer drops one asset, adjusts settings, and sees a real optimized result with truthful size numbers — the core pipeline end-to-end for a single file.
**Depends on**: Phase 9
**Requirements**: OPT-01
**Success Criteria** (what must be TRUE):
  1. User drops a single file and, after optimization, sees real optimized output (not stub data) for the selected file
  2. The Report panel shows accurate before/after byte sizes and the resulting savings percentage for that file
  3. Re-adjusting a setting and re-optimizing updates the output and the reported sizes
**Plans**: TBD
**UI hint**: yes

### Phase 11: Batch Optimize + Export
**Goal**: The optimize loop scales to a folder of files and the developer can walk away with their results — individual downloads and a single ZIP of the whole batch.
**Depends on**: Phase 10
**Requirements**: OPT-02, EXP-01, EXP-02
**Success Criteria** (what must be TRUE):
  1. User clicks Optimize-all and the batch runs through the worker pool with live per-file progress visible in the UI
  2. User can download a single optimized file to disk (native save picker with file-saver fallback)
  3. User can export the entire optimized batch as one ZIP via jszip
  4. Backpressure holds during a large batch — the pool bounds concurrency and the UI stays responsive throughout
**Plans**: TBD
**UI hint**: yes

### Phase 12: Real Snippets
**Goal**: The Output panel's paste-ready snippets reflect the actual encoded result of the selected file, completing the drop → adjust → copy-paste promise.
**Depends on**: Phase 11
**Requirements**: SNIP-01
**Success Criteria** (what must be TRUE):
  1. Base64 data-URI, URL-encoded, and `<picture>` snippets are generated from the selected file's real encoded bytes (not stub placeholders)
  2. Copying a snippet yields a valid, paste-ready string that renders the optimized image when used in a page
  3. Selecting a different file or re-optimizing refreshes the snippets to match the current output
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Executed | 2026-05-25 |
| 2. Files Pane | v1.0 | 2/2 | Executed | 2026-05-25 |
| 3. Navigation Shell | v1.0 | 3/3 | Executed | 2026-05-25 |
| 4. Inspector — Codec + SVGO | v1.0 | 4/4 | Executed | 2026-05-25 |
| 5. Center Pane | v1.0 | 2/2 | Executed | 2026-05-25 |
| 6. Inspector — Output + Report | v1.0 | 3/3 | Executed | 2026-05-25 |
| 7. Polish | v1.0 | 3/3 | Executed | 2026-05-25 |
| 8. Worker Pipeline Foundation | v1.1 | 0/3 | Planned | - |
| 9. Codec Encoders | v1.1 | 0/? | Not started | - |
| 10. Single-File Optimize Loop | v1.1 | 0/? | Not started | - |
| 11. Batch Optimize + Export | v1.1 | 0/? | Not started | - |
| 12. Real Snippets | v1.1 | 0/? | Not started | - |

---

*Active milestone: v1.1 — Phase 8 planned (3 plans, 2 waves). Next, run `/gsd-execute-phase 8`.*
