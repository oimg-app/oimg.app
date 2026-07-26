---
gsd_state_version: 1.0
milestone: none
milestone_name: null
status: quiescent
last_updated: "2026-07-23T17:20:00.000Z"
last_activity: 2026-07-23 -- v1.2 milestone archived
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# STATE: oimg.app — between milestones

**Last updated:** 2026-07-23
**Status:** v1.2 shipped and archived. No active milestone.

---

## Project Reference

**Core value:** A developer drops assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste snippets — with real perceptual quality scores, installable as a desktop/mobile PWA, fully offline-capable on second visit. Nothing leaves the browser.

**Current focus:** Between milestones. Start next via `/gsd-new-milestone`.

---

## Shipped Milestones

- ✅ **v1.0** (2026-05-25) — UI Port. Phases 1–7; 22 plans. Shipped as Executed (phase verification skipped as tech debt). Archive: `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v1.1** (2026-06-03) — Real Optimization Pipeline. Phases 8–12 + Watch folder quick task. 15/15 requirements satisfied; audit `tech_debt`. Archive: `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2** (2026-07-23) — Polish, Diagnostics, PWA + Quality Metrics. Phases 13–17 + 4 quick tasks. 15/15 requirements satisfied; audit `conditional`. Archive: `.planning/milestones/v1.2-ROADMAP.md`

---

## v1.3 Candidates (Deferred from Earlier Milestones)

- **VAR-01 / VAR-02** — 1×/2×/3× density variants via `@jsquash/resize` (twice-deferred from v1.0 and v1.2)
- **PERS-01** — Named setting presets via `idb-keyval` (twice-deferred)
- **PWA-NEXT** — Web Share Target API ("Share to oimg.app" from Photos/Files apps)
- **Watch-folder polish** — Stop watching UI, IDB handle persistence, recursive traversal, multi-folder
- **Snippet follow-ups** — multi-format `<picture>`, customization toggles, inline SVG snippet, manifest JSON in ZIP
- **v1.2 human-verification dogfood** — 12 checkpoints across Phase 13/14/15 (clipboard round-trip, PWA install/offline flows, Cloudflare `_headers` curl checks)
- **HEIC quick-task dogfood** — 260610-lby needs a real `.heic` file for final verify

---

## Accumulated Wisdom (persistent across milestones)

### Discipline gates that repeatedly matter

- **PIPE-02 dynamic imports** — every codec/metric wasm inside the async worker function body, never hoisted to file top. Grep-asserted in `build.test.ts` via hoist sentinels (e.g. `bezkrovny` for ssim, `VisDiff` for visdif).
- **WR-02 single funnel** — all per-entry mutations through `updateEntry(id, patch)` in `src/stores/files.ts` (synchronous read-map-write, no `await` between read and write).
- **CR-02 seqRef stale-drop** — every metrics/live-encode dispatch guards against selection thrash with a monotonic seqRef check on result write.
- **Comlink 4-slice buffer discipline** (Phase 17 lesson) — when parallel-dispatching multiple worker RPCs that consume the same ArrayBuffers, `.slice(0)` each independently (Comlink transfer detaches).
- **`client`-mode wasm loading** for `@squoosh-kit/*` packages (Phase 17 lesson via imagequant precedent from Phase 8 commit d3d2d2e) — default `'worker'` mode spawns nested worker with broken wasm URL under Vite SPA fallback.
- **Comlink method-name hoist sentinels are FALSE POSITIVES** for bundle-budget asserts (Phase 16 lesson) — Comlink-referenced method names survive minification into initial route. Use package-internal identifiers (e.g. `bezkrovny`, `VisDiff`) as sentinels.

### Baseline health

- `tsc -b` red on pre-existing debt (stores.test.ts `stageBg`, test spec `/src/…` patterns). Build gate uses `./node_modules/.bin/vite build` directly.
- Bundle: 197.2 KB gzipped initial route (200 KB PIPE-02 budget). ~2.8 KB headroom.
- Playwright specs use `data-testid` + `data-band` attributes for stability; base64-embedded fixtures for determinism.

---

## Session Continuity

**Last session:** 2026-07-26 — Quick task 260726-3cp shipped (SVG source + raster output codec-mismatch fix in CompareStage)
**To resume:** Start v1.3 via `/gsd-new-milestone` — questioning → research → requirements → roadmap. Or `/gsd-review-backlog` to promote v1.3 candidates from deferred lists into a new milestone scope. Or knock off automatable follow-ups from `.planning/v1.2-DOGFOOD-CHECKLIST.md`.

## Quick Tasks Completed (post-v1.2)

| ID | Slug | Date | Status | Notes |
|----|------|------|--------|-------|
| 260726-3cp | svg-encoded-layer | 2026-07-26 | ✅ complete | Codec-mismatch gate in CompareStage encoded-layer — `FileEntry.encodedCodec` tags each buffer with its producing codec; render placeholder on mismatch. Commit `05e3290`. |
