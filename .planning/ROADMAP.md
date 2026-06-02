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

- [x] **Phase 8: Worker Pipeline Foundation** — Bounded Comlink WorkerPool + dynamic codec imports + COOP/COEP, backpressure wired to real running state (completed 2026-05-26)
- [x] **Phase 9: Codec Encoders** — PNG/WebP/JPEG/AVIF/SVG adapters wired so inspector settings drive real encode output (completed 2026-05-26)
- [x] **Phase 10: Single-File Optimize Loop** — Drop one file → real optimized output with accurate before/after sizes in the Report (completed 2026-05-28)
- [x] **Phase 11: Batch Optimize + Export** — Optimize-all through the pool with live progress, single-file download, and batch ZIP export (completed 2026-06-02)
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
- [x] 08-01-PLAN.md — COOP/COEP verification + Wave 0 test scaffolds (worker-pipeline.spec.ts; extend backpressure.spec.ts) [PIPE-03]
- [x] 08-02-PLAN.md — Comlink codec worker (dynamic imports, real PNG→OxiPNG path) + bounded WorkerPool [PIPE-01, PIPE-02]
- [x] 08-03-PLAN.md — Extend runtimeAtom job counts + useOptimize hook + wire Toolbar to the pool [PIPE-04]

### Phase 9: Codec Encoders
**Goal**: Every codec in the locked jSquash + svgo surface has a worker-side adapter, and the inspector's controls actually shape the encoded bytes.
**Depends on**: Phase 8
**Requirements**: ENC-01, ENC-02, ENC-03, ENC-04, ENC-05, ENC-06
**Success Criteria** (what must be TRUE):
  1. A PNG run through OxiPNG (decode via @jsquash/png → re-encode) produces real, smaller-byte output
  2. WebP, JPEG (MozJPEG), and AVIF (lazy-loaded) each produce valid encoded output with their format-specific controls (quality, lossless, progressive) applied
  3. An SVG run through svgo v4 (preset-default + overrides) shrinks with the inspector's plugin toggles actually reflected in the result
  4. Changing an inspector setting (quality / effort / lossless / resize / strip-metadata) measurably changes the encoded output for the corresponding codec
**Plans**: 4 plans (4 waves)
- [x] 09-01-PLAN.md — Per-file settings store refactor + applyToAll + CR-01 fix + Wave 0 test scaffolds [ENC-06, D-01/D-02/D-03]
- [x] 09-02-PLAN.md — Worker codec adapters (PNG/WebP/JPEG/AVIF/SVG) + EncodeJob schema + WR-02/WR-03 [ENC-01..05]
- [x] 09-03-PLAN.md — Real-bytes useOptimize + debounced useLiveEncode + encodingFileId [ENC-06, D-04/D-05/D-07/D-13]
- [x] 09-04-PLAN.md — Inspector + center wiring: per-file controls, Apply-to-all, resize, error UI, real images [ENC-06, D-02/D-03/D-10/D-13]
**UI hint**: yes

### Phase 10: Single-File Optimize Loop
**Goal**: A developer drops one asset, adjusts settings, and sees a real optimized result with truthful size numbers — the core pipeline end-to-end for a single file.
**Depends on**: Phase 9
**Requirements**: OPT-01
**Success Criteria** (what must be TRUE):
  1. User drops a single file and, after optimization, sees real optimized output (not stub data) for the selected file
  2. The Report panel shows accurate before/after byte sizes and the resulting savings percentage for that file
  3. Re-adjusting a setting and re-optimizing updates the output and the reported sizes
**Plans**: 4 plans (4 waves)
- [x] 10-01-PLAN.md — Wave 0 test scaffolds: ingest-helper + ingest.spec + 5 D-05 spec migrations [OPT-01]
- [x] 10-02-PLAN.md — Remove seeded demos (D-04) + FileEntry.createdAt + queue-order sort fix [OPT-01]
- [x] 10-03-PLAN.md — useIngest hook: format gate + File→FileEntry mapping + auto-optimize dispatch [OPT-01]
- [x] 10-04-PLAN.md — Wire FilesPane dropzone/Add files + Toolbar From device to useIngest [OPT-01]
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
**Plans**: 9 plans (4 waves)
- [ ] 11-00-PLAN.md — Wave 0: install jszip + file-saver + @types/file-saver, test-only window bridge for SC-4, save-file mocks + 20-file fixture set [OPT-02, EXP-01, EXP-02]
- [ ] 11-01-PLAN.md — Streaming per-promise write-back in useOptimize.runOptimize + D-11 skip-done filter (live FileRow status transitions) [OPT-02]
- [ ] 11-02-PLAN.md — StatusBar aggregate X/Y optimized counter + aria-live polite region (D-01) [OPT-02]
- [ ] 11-03-PLAN.md — src/lib/filename.ts: renameExtension, collisionSuffix, timestampedZipName, mimeFor, sanitizeBaseName (T-11-01) [EXP-01, EXP-02]
- [ ] 11-04-PLAN.md — saveBlob dispatcher + useExport.exportOne skeleton + Inspector ReportPanel Download button (D-04/D-05/D-07) [EXP-01]
- [ ] 11-05-PLAN.md — buildZip lib + useExport.exportZip/exportIndividually + Toolbar wiring + EXP-02 full e2e (D-05/D-08/D-09/D-10/D-12) [EXP-02]
- [ ] 11-06-PLAN.md — FileRow ContextMenu "Save as…" wired to exportOne + per-row disabled gate + WCAG-AA e2e (D-04) [EXP-01]
- [ ] 11-07-PLAN.md — $hasDone computed atom + Toolbar disable-then-explain (D-13) [OPT-02, EXP-01, EXP-02]
- [ ] 11-08-PLAN.md — SC-4 backpressure e2e on ≥20-file batch via window.__peakRunning bridge [OPT-02]
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
| 8. Worker Pipeline Foundation | v1.1 | 3/3 | Complete   | 2026-05-26 |
| 9. Codec Encoders | v1.1 | 4/4 | Complete   | 2026-05-26 |
| 10. Single-File Optimize Loop | v1.1 | 4/4 | Complete    | 2026-05-28 |
| 11. Batch Optimize + Export | v1.1 | 0/9 | Planned | - |
| 12. Real Snippets | v1.1 | 0/? | Not started | - |

---

*Active milestone: v1.1 — Phase 10 planned (4 plans, 4 waves). Next, run `/gsd-execute-phase 10`.*
