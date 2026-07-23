# ROADMAP: oimg.app

## Milestones

- ✅ **v1.0 — UI Port** — Phases 1–7 (shipped 2026-05-25) — full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Real Optimization Pipeline** — Phases 8–12 + quick task 260603-s2x (shipped 2026-06-03) — full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 — Polish, Diagnostics, PWA + Quality Metrics** — Phases 13–17 + 4 quick tasks (shipped 2026-07-23) — full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 — TBD** — awaiting `/gsd-new-milestone` for direction (VAR-01/02 density variants, PERS-01 presets, PWA-NEXT Share Target are leading candidates from v1.2 deferred list)

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

<details>
<summary>✅ v1.1 Real Optimization Pipeline (Phases 8–12) — SHIPPED 2026-06-03 (audit: tech_debt)</summary>

- [x] Phase 8: Worker Pipeline Foundation (3/3 plans) — PIPE-01..04
- [x] Phase 9: Codec Encoders (4/4 plans) — ENC-01..06
- [x] Phase 10: Single-File Optimize Loop (4/4 plans) — OPT-01
- [x] Phase 11: Batch Optimize + Export (9/9 plans) — OPT-02, EXP-01, EXP-02
- [x] Phase 12: Real Snippets (5/5 plans) — SNIP-01
- [x] Quick task 260603-s2x: Watch folder (showDirectoryPicker + FileSystemObserver)

15/15 requirements satisfied. Bundle 194.88 KB gzipped (under 200 KB PIPE-02 budget). 4 Phase 12 paste-into-real-browser dogfood checks deferred to follow-up (see `milestones/v1.1-ROADMAP.md` and `v1.1-MILESTONE-AUDIT.md`).

</details>

<details>
<summary>✅ v1.2 Polish, Diagnostics, PWA + Quality Metrics (Phases 13–17) — SHIPPED 2026-07-23 (audit: conditional)</summary>

- [x] Phase 13: Diagnostics + Clear Queue (8/8 plans) — DIA-01..04, CLR-01
- [x] Phase 14: Installable PWA (6/6 plans) — PWA-01..05
- [x] Phase 15: From URL or paste (4/4 plans) — ING-01, ING-02
- [x] Phase 16: SSIM Quality Metric (5/5 plans) — MTR-01, MTR-03 (SSIM half)
- [x] Phase 17: Butteraugli Quality Metric (5/5 plans) — MTR-02, MTR-03 (Butteraugli half); scope pivot to `@squoosh-kit/visdif` from hand-built Emscripten (user-approved 2026-07-20)
- [x] 4 quick tasks: HEIC decode (260610-lby); svg-compare-iframe; svg-compare-codec-switch; svg-export-raster-codec

15/15 requirements satisfied. Bundle 197.2 KB gzipped (under 200 KB PIPE-02 budget with both metrics phases + PWA stacked). 12 human-verification checkpoints across Phases 13/14/15 deferred as dogfood follow-ups (see `milestones/v1.2-ROADMAP.md` and `v1.2-MILESTONE-AUDIT.md`).

</details>

### 🚧 v1.3 — TBD

Awaiting `/gsd-new-milestone` to define direction. Deferred candidates from v1.2:

- **VAR-01 / VAR-02** — 1×/2×/3× density variants via `@jsquash/resize`
- **PERS-01** — Named setting presets via `idb-keyval`
- **PWA-NEXT** — Web Share Target API ("Share to oimg.app" from Photos/Files apps)
- Watch-folder polish: "Stop watching" affordance + IDB handle persistence + recursive/multi-folder
- Snippet follow-ups: multi-format `<picture>`, customization toggles, inline SVG snippet, manifest JSON in ZIP
- 12 human-verification checkpoints from Phase 13/14/15 (dogfood)
- HEIC quick-task human verification (260610-lby)

---

*Active milestone: none — awaiting v1.3 kickoff via `/gsd-new-milestone`.*
*Last archived: 2026-07-23 via `/gsd-complete-milestone v1.2`.*
