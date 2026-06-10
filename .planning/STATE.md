---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Polish, Diagnostics, PWA + Quality Metrics
status: executing
stopped_at: Completed quick task 260603-s2x — Watch folder (showDirectoryPicker + FileSystemObserver)
last_updated: "2026-06-10T13:04:56.245Z"
last_activity: 2026-06-10 -- Phase 13 planning complete
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 8
  completed_plans: 0
  percent: 0
---

# STATE: oimg.app — v1.2 Polish, Diagnostics, PWA + Quality Metrics

**Last updated:** 2026-06-10
**Milestone:** v1.2 Polish, Diagnostics, PWA + Quality Metrics (Phases 13–17)

---

## Project Reference

**Core value:** A developer drops assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste snippets — without anything leaving the browser.

**Current focus:** Phase 11 — batch optimize + export

---

## Current Position

Phase: 12 — COMPLETE
Plan: 12-05 complete (Wave 2 — FileRow ContextMenu Copy <picture> + Copy data-URI siblings)
Status: Ready to execute
Last activity: 2026-06-10 -- Phase 13 planning complete
Progress: [██████████] 100%

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total (v1.1) | 5 |
| Phases complete | 0 |
| Requirements total (v1.1) | 15 |
| Requirements complete | 0 |
| Phases with plans | 0 |

---
| Phase 08-worker-pipeline-foundation P01 | 35m | 3 tasks | 3 files |
| Phase 08-worker-pipeline-foundation P03 | 10 | 3 tasks | 2 files |
| Phase 09-codec-encoders P01 | 20m | 3 tasks | 6 files |
| Phase 09-codec-encoders P02 | 35m | 3 tasks | 3 files |
| Phase 09-codec-encoders P03 | 20m | 2 tasks | 3 files |
| Phase 10-single-file-optimize-loop P02 | 10m | 2 tasks | 2 files |
| Phase 11-batch-optimize-export P05 | ~13m | 4 tasks | 6 files |
| Phase 12-real-snippets P05 | ~15m | 2 tasks | 2 files |

## Accumulated Context

### Decisions

- v1.1 phases numbered 8–12, continuing from v1.0's Phase 7 (no reset)
- Phase order follows dependency chain: pool foundation → encoders → single-file loop → batch+export → snippets
- mvp mode: every phase delivers something demonstrable in the browser (vertical slices)
- Pre-existing v1.0 scaffolding to wire (not rebuild): BackpressureIndicator (SHELL-02), runtimeStore running/startRun, OutputPanel snippet builders (`src/lib/snippets.ts`), ReportPanel
- Codecs MUST be dynamic-imported inside workers to hold initial route < 200KB gzipped; AVIF (~8MB) lazy-loaded only on selection
- OxiPNG is encode-only — decode PNG via @jsquash/png to ImageData first, then re-encode
- comlink for worker RPC; roll-your-own bounded WorkerPool for backpressure
- COOP/COEP headers required for SharedArrayBuffer (MT codecs) — dev server + Cloudflare Pages `_headers`
- svgo v4 browser ESM, preset-default + overrides (no legacy `extendDefaultPlugins`)
- [Phase ?]: Codec worker stubs all non-PNG formats
- [Phase ?]: runtime.ts extended for worker-pool backpressure
- [Phase ?]: pool.run API correction
- [Phase ?]: filesAtom starts empty (D-04) — app opens on dropzone first-run view
- [Phase ?]: queue-order sort uses createdAt timestamp replacing STUB_FILES.findIndex
- [Phase ?]: useOptimize stale-closure fix: read filesAtom.get() at call time
- [Phase 11-05]: buildZip uses streamFiles:true + DEFLATE level:1 (codec outputs already compressed); sanitizeBaseName(renameExtension) composed before zip.file (T-11-01); empty input throws NO_EXPORTABLE_FILES
- [Phase 11-05]: Rule-2 auto-add — mounted sonner Toaster in App.tsx (was missing app-wide; blocked D-12 toast contract)
- [Phase 12-05]: FileRow ContextMenu Copy <picture> + Copy data-URI siblings wired via useSnippets per-file methods; D-13 disable-then-explain triple matches Phase 11 Save as… analog; label standardized to 'Copy data-URI' (hyphenated)
- [Phase 12-05]: Rule-3 env repair — installed @esbuild/darwin-arm64 platform binary (npm-cli/4828 family, same precedent as scripts/ensure-rollup-binding.mjs); --no-save --ignore-scripts --cpu=arm64 flags; no package.json/lockfile change

### Conventions (carried from v1.0)

- Business logic in `src/hooks/*` and `src/stores/*` — never inline in components
- STORE-08: zero `useState` for data in components; only ephemeral hover/focus allowed
- Circular ESM guard: `files.ts ↔ runtime.ts ↔ settings.ts` — avoid cross-imports
- Workers use literal string paths in ADAPTERS map (no template literals)
- All files require phase/plan attribution header comment
- Tailwind utility classes only — no CSS modules, no inline styles

### Blockers

- None

### Todos

- None

---

## Session Continuity

**Last session:** 2026-06-10
**Stopped At:** Completed quick task 260610-lby — HEIC/HEIF decode-only input support via heic-decode
**To resume:** HEIC code-complete + typecheck-clean. Manual check pending: `npm run dev`, drop a real `.heic`, confirm decode→JPEG export and NO inspector HEIC tab (see 260610-lby-SUMMARY.md §Manual verification). Milestone v1.2 (Phases 13–17) is the active track.

## Quick Tasks Completed

| ID | Slug | Date | Tasks | Status |
|----|------|------|-------|--------|
| 260603-s2x | watch-folder | 2026-06-03 | 8 | ✅ complete (3 e2e + 6 unit green; T-WF-01..04 mitigated) |
| 260610-lby | add-heic-extension-support | 2026-06-10 | 2 (+1 type fix) | ⚠️ code-complete (heic.test 6/6 green, tsc clean after c7f4994 type-decl fix) — Task 3 needs human verify with a real .heic file |

---

## Requirements Coverage (v1.1)

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | 8 | Pending |
| PIPE-02 | 8 | Pending |
| PIPE-03 | 8 | Pending |
| PIPE-04 | 8 | Pending |
| ENC-01 | 9 | Pending |
| ENC-02 | 9 | Pending |
| ENC-03 | 9 | Pending |
| ENC-04 | 9 | Pending |
| ENC-05 | 9 | Pending |
| ENC-06 | 9 | Pending |
| OPT-01 | 10 | Pending |
| OPT-02 | 11 | Pending |
| EXP-01 | 11 | Pending |
| EXP-02 | 11 | Pending |
| SNIP-01 | 12 | Pending |

**Coverage:** 15/15 mapped ✓

---

## Deferred Items

Acknowledged and deferred at v1.0 milestone close (2026-05-25). Milestone shipped as **Executed** — all 22 plans built + summarized, formal verification skipped per user decision.

| Category | Item | Status |
|----------|------|--------|
| verification_gap | Phase 01 VERIFICATION.md | human_needed |
| verification_gap | Phase 02 VERIFICATION.md | human_needed |
| verification_gap | Phase 04 VERIFICATION.md | human_needed |
| verification_gap | Phases 03/05/06/07 — no VERIFICATION.md | unverified (executed) |
| requirements | 18/36 v1.0 requirements unchecked in traceability (likely tracking drift; code largely shipped) | accepted as tech debt |
| wcag | Duplicate `banner` landmarks — 3 `<header>` elements (TitleBar + CenterHeader + InspectorPane) | deferred follow-up |
| git | 3 stale locked `agent-*` worktrees from flaky-agent sessions | cleanup pending |
| variants | 1×/2×/3× density variants (VAR-01/VAR-02) | deferred to future milestone |
| persistence | Named setting presets via idb-keyval (PERS-01) | deferred to future milestone |

## Operator Next Steps

- Plan the first v1.1 phase: `/gsd-plan-phase 8`
