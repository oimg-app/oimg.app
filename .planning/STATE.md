---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Polish, Diagnostics, PWA + Quality Metrics
status: in_progress
stopped_at: Phase 15 complete; Phase 16 (SSIM) next
last_updated: "2026-07-19T14:38:00.000Z"
last_activity: 2026-07-19 -- STATE.md reconciled with archived v1.1 phases
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 18
  completed_plans: 18
  percent: 60
---

# STATE: oimg.app — v1.2 Polish, Diagnostics, PWA + Quality Metrics

**Last updated:** 2026-07-19
**Milestone:** v1.2 Polish, Diagnostics, PWA + Quality Metrics (Phases 13–17)

---

## Project Reference

**Core value:** A developer drops assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste snippets — without anything leaving the browser.

**Current focus:** Phase 16 — SSIM Quality Metric

---

## Current Position

Phase: 15 — COMPLETE; Phase 16 pending
Status: 3 of 5 v1.2 phases complete
Progress: [██████░░░░] 60%

Prior milestone artifacts archived under `.planning/milestones/`:
- v1.0 (Phases 1–7) → `milestones/v1.0-phases/`
- v1.1 (Phases 8–12) → `milestones/v1.1-phases/`

---

## Accumulated Context (v1.2)

### Decisions

- [Phase 13]: Versions injected at build time via Vite `define` (only reads `node_modules/<pkg>/package.json` version fields — never env vars, never filesystem paths); consumers read `BUILD_VERSIONS` from `src/lib/versions.ts`
- [Phase 13]: `versionsAtom` combines build-time versions + runtime caps (SIMD, threads, `crossOriginIsolated`, `hardwareConcurrency`)
- [Phase 14]: vite-plugin-pwa@1.3.0 in injectManifest mode; theme_color `#5eb87a` verbatim; `globIgnores` excludes wasm; AVIF's 3.4 MB wasm runtime-cached only, never precached
- [Phase 14 Plan 02]: combined ServiceWorkerGlobalScope + `__WB_MANIFEST` in single intersection-typed `declare const self` in `src/sw.ts`
- [Phase 14 Plan 02]: bypassed `npm run build`'s `tsc -b` gate (pre-existing RED baseline); ran `vite build` directly to verify `dist/sw.js`
- [Phase 15]: `pickFromUrl` + `pickFromClipboard` dispatchers with document-level Cmd/Ctrl+V handler; CORS-honest failure messaging; empty `addFromUrl` stub deleted from `src/stores/files.ts`

### Blockers

- None

### Todos

- Phase 16 (SSIM): plan + execute
- Phase 17 (Butteraugli): plan + execute

---

## Session Continuity

**Last significant activity:** Quick task 260610-lby (HEIC decode support) — code-complete, human verify pending
**To resume:** Milestone v1.2 track. Phases 13–15 shipped. Next: `/gsd-plan-phase 16` for SSIM integration.

## Quick Tasks Completed (v1.2 era)

| ID | Slug | Date | Tasks | Status |
|----|------|------|-------|--------|
| 260610-lby | add-heic-extension-support | 2026-06-10 | 2 (+1 type fix) | ⚠️ code-complete (heic.test 6/6 green, tsc clean after c7f4994 type-decl fix) — Task 3 needs human verify with a real .heic file |
| fast | svg-compare-iframe | 2026-06-10 | 1 | ✅ CompareStage renders SVG layers in sandboxed iframe (cc0fb7b) |
| fast | svg-compare-codec-switch | 2026-06-10 | 1 | ✅ Encoded layer iframe/img switches on output codec; orig stays iframe for SVG source (1124b39) |
| fast | svg-export-raster-codec | 2026-06-10 | 1 | ✅ SVG exports to selected raster codec via main-thread canvas (single/ZIP/individual); new src/lib/svg-export.ts (9a50b56) |

---

## Requirements Coverage (v1.2)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIA-01 | 13 | Complete |
| DIA-02 | 13 | Complete |
| DIA-03 | 13 | Complete |
| DIA-04 | 13 | Complete |
| CLR-01 | 13 | Complete |
| PWA-01 | 14 | Complete |
| PWA-02 | 14 | Complete |
| PWA-03 | 14 | Complete |
| PWA-04 | 14 | Complete |
| PWA-05 | 14 | Complete |
| ING-01 | 15 | Complete |
| ING-02 | 15 | Complete |
| MTR-01 | 16 | Pending |
| MTR-02 | 17 | Pending |
| MTR-03 | 16/17 | Pending |

**Coverage:** 12/15 complete

---

## Operator Next Steps

- Plan Phase 16 (SSIM): `/gsd-plan-phase 16`
