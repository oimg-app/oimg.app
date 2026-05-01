---
phase: 03-svg-pipeline
plan: B
subsystem: optimization
tags: [svgo, svgomg, ui, react, zustand, web-worker, debounce, real-time]

# Dependency graph
requires:
  - phase: 03-svg-pipeline
    plan: A
    provides: svg-adapter, sanitize-svg, DEFAULT_CODEC_SVG (12-plugin curated record), CodecSettingsSvg type extensions (unsafeExport + pluginSavings)
  - phase: 02-worker-harness-state
    provides: WorkerPool (lazy spawn, terminate-and-respawn cancel), three-store architecture, sonner Toaster
provides:
  - SvgoPanel rewrite — 12-plugin curated set with always-visible foot-gun hints + live per-plugin savings column + Sanitization section (D-04)
  - useRuntimeStore.enqueuePreview — debounced (200ms) single-file re-optimize via worker pool with cancel-and-restart (D-08/D-10/D-11)
  - useSettingsStore.snippetTogglesByFileId + setSnippetToggle (D-13) — Plan C consumes
  - computePluginSavings() — post-batch N+1 SVGO passes via WorkerPool with 5s wall-time cap (D-06)
  - Plugin-change subscriber wired in App.tsx — live re-optimize on plugin toggle for selected SVG file
  - Auxiliary-job (preview-/savings-) discriminator in App.tsx pool callbacks — keeps runtime-store batch bookkeeping clean
affects:
  - 03-C-PLAN (SnippetPanel reads useSettingsStore.snippetTogglesByFileId; setSnippetToggle action ready)
  - 03-D-PLAN (test corpus can flip the OPT-01 plugin-toggle, savings-column, foot-gun stubs to live tests)
  - Phase 5 (auxiliary-job prefix discriminator extends cleanly to per-file preview re-optimize for raster codecs)

# Tech tracking
tech-stack:
  added:
    - (none — Plan A introduced svgo + dompurify; Plan B is pure UI + state wiring)
  patterns:
    - Auxiliary-job discriminator: jobIds prefixed with 'preview-' or 'savings-' route through pool but skip runtime-store batch bookkeeping (markStarted/markDone/markError)
    - Inline debounce inside zustand store action — 200ms coalesce + last-call-wins, no lodash dep
    - Late-resolution cross-store reads via getState() — runtime/files static cycle resolved at call time
    - Per-row view-model assembled in App.tsx (plugin id + on flag + savings + footgun) → flat props prop-drilled to SvgoPanel; PLUGIN_FOOTGUNS map exported from SvgoPanel as the single source of truth for foot-gun copy
    - 5s wall-time cap on auxiliary computation with partial-result persistence on timeout

key-files:
  created:
    - (none)
  modified:
    - src/stores/runtime.ts (previewJobId slot + debounced enqueuePreview action; static imports of files+settings stores at runtime)
    - src/stores/settings.ts (snippetTogglesByFileId record + setSnippetToggle action)
    - src/components/panels/SvgoPanel.tsx (full rewrite — 12 curated plugins + foot-gun hints + Sanitization section; legacy perceptual-loss block deleted)
    - src/App.tsx (Plan-A SVGO_PLUGINS shim + aggressive useState removed; live binding to useSettingsStore.svg; plugin-change subscriber; auxiliary-job pool callback discriminator; computePluginSavings() function + post-batch trigger)

key-decisions:
  - "Auxiliary-job prefix discriminator (preview-/savings-) at the pool callback boundary in App.tsx — chosen over a separate pool instance or per-job opt-out flag because (a) it kept the Phase 2 PoolJob contract unchanged, (b) the runtime store's batch bookkeeping is App's concern, not the pool's. Phase 5 raster encoders inherit this pattern when they add per-file preview/savings paths."
  - "Inline 200ms debounce inside the runtime store action body (rather than introducing a debounce util in src/lib/) — the only caller is the plugin-change subscriber and the helper is 8 lines. If a second consumer appears, extract."
  - "Static imports of useFilesStore + useSettingsStore in runtime.ts (silencing the Vite chunk-split warning) instead of dynamic await import — the cycle resolves correctly at runtime because both modules export zustand store hooks whose getState() is lazy."
  - "Savings job uses sourceBlob (not optimizedBlob) — measures full re-optimization with the plugin disabled vs. the all-on baseline already stored in FileEntry.optimizedSize. Using optimizedBlob would re-optimize already-optimized output, producing meaningless deltas."
  - "Negative savings clamped to 0 in computePluginSavings — disabling a plugin can occasionally produce smaller output (plugins interact); negative percent in the UI is confusing, so clamp and let the column show '—' for those plugins."
  - "Auxiliary-job onError swallows AbortError silently — the user clicking Cancel during a savings run shouldn't surface an error toast; partial savings (whatever was measured before the cancel) stay in the store from the most recent completed batch."

patterns-established:
  - "Debounced auxiliary worker job: subscriber → debounced action → optional pool.cancel() → enqueue with prefixed jobId → await result → main-thread post-process → markDone. Phase 5 reuses for per-file preview re-optimize on quality slider changes."
  - "Post-batch parameter-sensitivity sweep: subscriber detects batch completion → enumerate parameter values × completed files → enqueue N×M jobs with prefixed jobIds → aggregate deltas → write to settings store. Phase 5 may reuse for 'show me what each codec/quality combo would produce'."
  - "Foot-gun hint copy as a const map exported from the panel module — one source of truth; both the panel and the App.tsx prop-builder import from it."

requirements-completed:
  - OPT-01

# Metrics
duration: ~13min
completed: 2026-05-01
---

# Phase 03 Plan B: SVGO Inspector + Live Re-optimize Summary

**SvgoPanel rewritten as the SVGOMG-style "toggle a plugin and watch it shrink" surface — 12 curated plugins with always-visible foot-gun hints, live per-plugin savings column, and the Sanitization toggle (unsafe export). Plugin toggles fire 200ms-debounced single-file re-optimize via the worker pool; post-batch N+1 SVGO passes populate the savings column without blocking the main thread.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-01T10:51:35Z
- **Completed:** 2026-05-01T11:04:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- SvgoPanel renders the 12-plugin curated set in locked order (removeComments → removeDimensions); the 10 preset-default plugins on top, the 2 opt-in extras (removeViewBox, removeDimensions) at the bottom — both default OFF per Plan A's RESEARCH §Critical Contradiction resolution.
- Foot-gun hints (cleanupIds / removeViewBox / removeDimensions) render inline below their plugin row with the warn-color triangle glyph; copy is verbatim from 03-UI-SPEC.md §Foot-gun hint copy.
- Sanitization section ships with the "Disable on export" Toggle wired to `useSettingsStore.svg.unsafeExport`. Default OFF; badge flips between `safe` (acc) and `unsafe` (warn). Threat T-V5-06 mitigation in place.
- Toggling any SVGO plugin while a SVG file is selected fires `useRuntimeStore.enqueuePreview(fileId)`. The 200ms debounce + pool cancel-and-restart implements D-08/D-10/D-11 (last-toggle-wins). The same `markDone` path that Plan A wired updates the file row size delta and sanitized badge for free.
- Post-batch live savings: when an Optimize batch completes with at least one done SVG, `computePluginSavings()` enqueues N+1 SVGO passes per file through the WorkerPool (jobId prefix `savings-`). Aggregated byte deltas land in `useSettingsStore.svg.pluginSavings` and the SvgoPanel's `.saves` column flips from blank to `'%.1f%'` per plugin.
- Auxiliary-job discriminator in the pool callbacks keeps the runtime store's batch bookkeeping clean — preview / savings jobs route through the same pool but don't inflate `doneCount`/`totalJobs`.
- Legacy perceptual-loss section deleted from SvgoPanel; `SvgoPlugin` view-model type and `SVGO_PLUGINS` shim removed from `App.tsx`. The `aggressive` useState slice is gone.
- Full Playwright suite (37/37) green; production build succeeds (152.21 KB initial gzip, well under 200KB budget); no TypeScript errors.

## Task Commits

1. **Task 1: Extend stores — settings (snippetTogglesByFileId + setSnippetToggle) + runtime (previewJobId + debounced enqueuePreview) + plugin-change subscriber in App** — `9cacb6b` (feat)
2. **Task 2: Rewrite SvgoPanel + wire D-06 post-batch live savings** — `c585787` (feat)

**Plan metadata:** _(filed in next commit alongside SUMMARY + STATE updates)_

## Files Created/Modified

### Modified (4)

- `src/stores/runtime.ts` — Added `previewJobId: string \| null` slot; added `enqueuePreview(fileId)` action with inline 200ms debounce. Action: optional pool.cancel() (only if no batch running), allocate prefixed jobId, enqueue SVG job, on resolve decode + DOMPurify-sanitize on main thread + `markDone`. Static imports of `useFilesStore` + `useSettingsStore` (cycle resolves via lazy `getState()`).
- `src/stores/settings.ts` — Added `snippetTogglesByFileId: Record<string, Record<string, boolean>>` slot + `setSnippetToggle(fileId, snippetId, value)` action (D-13). Plan A's `setSvg` already covers `unsafeExport` + `pluginSavings` partial updates.
- `src/components/panels/SvgoPanel.tsx` — Complete rewrite. 12 curated plugins with locked order + always-visible foot-gun hints (warn-glyph + verbatim copy from UI-SPEC) + Sanitization section with Toggle. `PLUGIN_FOOTGUNS` map exported. Component props now: `{ plugins: Array<{id, on, savings, footgun}>, togglePlugin, unsafeExport, setUnsafeExport }`.
- `src/App.tsx` — Removed Plan-A `SVGO_PLUGINS` shim, `aggressive` useState, `SvgoPlugin` import; replaced with live `useSettingsStore.svg` binding. `togglePlugin` updates the plugins record via `setSvg`. Added `useEffect` plugin-change subscriber → `enqueuePreview`. Pool callbacks now skip jobIds prefixed `preview-` / `savings-`. Added `computePluginSavings()` (top-level function); called from the existing batch-completion subscriber when SVGs are done.

## Decisions Made

- **Auxiliary-job prefix discriminator (`preview-` / `savings-`)** — chosen over a separate worker pool instance, a per-job opt-out flag, or runtime-store-aware pool callbacks. Keeps the Phase 2 `PoolJob` contract unchanged; App.tsx is the natural place to decide what's "tracked" vs. "fire-and-forget through the same workers." Phase 5 raster encoders inherit this pattern.
- **Inline debounce inside the runtime store action** rather than a `src/lib/debounce.ts` helper — 8 lines, single caller. Extract on second consumer.
- **Static cross-store imports in `runtime.ts`** instead of dynamic `await import()` — silences Vite's "dynamic import will not move module into another chunk" warning. The `runtime ↔ files` cycle is correctly resolved because zustand exposes only `getState()` lazily.
- **Savings job uses `sourceBlob` not `optimizedBlob`** — measures full re-optimization with the plugin disabled vs. the all-on baseline. Using `optimizedBlob` would double-optimize and produce meaningless deltas.
- **Negative savings clamped to 0** — plugin interactions can occasionally produce smaller output when one is disabled; negative percent in the UI is confusing.
- **Partial-result persistence on 5s timeout** — whatever savings completed before the deadline are written to the store; the panel shows `—` for unmeasured plugins. The user gets *some* signal rather than total blanking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Auxiliary-job pollution of runtime store batch bookkeeping**
- **Found during:** Task 2, while implementing `computePluginSavings()` and reading the existing pool-callback wiring.
- **Issue:** The Plan-2 pool callbacks in `App.tsx` route every job's `onStarted` / `onDone` / `onError` through `useRuntimeStore.markStarted` / `markDone` / `markError`. These actions add the jobId to `inFlight` and bump `doneCount`. With Plan B introducing two new auxiliary job categories (debounced preview re-optimize + post-batch savings sweep), every preview/savings job would inflate `doneCount` past `totalJobs`, and worse, the cancel path would fan out spurious `markError` calls. The batch-completion subscriber in `App.tsx` only fires its toast/announcement when `prev.running && !curr.running && totalJobs > 0` — that guard would protect against most false positives, but the `inFlight` set would be polluted, and a real cancel during an in-flight preview would race.
- **Fix:** Added an `isAuxiliaryJob(jobId)` discriminator at the pool-callback boundary in `App.tsx`. Jobs whose ids start with `preview-` or `savings-` skip all three runtime-store actions. The pool itself still tracks them (so its own bookkeeping for `cancel()` etc. is correct); only the App-level mirror skips. The promise-based `pool.enqueue` return value is what the auxiliary callers consume.
- **Files modified:** `src/App.tsx`.
- **Verification:** Full Playwright suite still green (37/37); no test specifically asserts auxiliary-job isolation yet (Plan D will add one).
- **Committed in:** `c585787` (Task 2)

**2. [Rule 3 — Blocking] Vite "dynamic import will not move module into another chunk" warnings**
- **Found during:** Task 2 production build (`npm run build`) after Task 1 had landed dynamic imports in `runtime.ts`.
- **Issue:** Plan B's prescribed pattern was `await import('./files')` / `await import('./settings')` inside `enqueuePreview` to avoid the static cycle with `files.ts → runtime.ts`. Vite emitted two warnings noting that the dynamic imports wouldn't actually split into separate chunks because both modules are also imported statically by `src/stores/index.ts` (the barrel). Functionally fine, but noise in the build output.
- **Fix:** Switched both `await import()` calls to static imports. The runtime cycle is safe because zustand store hooks (`useFilesStore`, `useSettingsStore`) are accessed only via `getState()` at call time, not at module-init time. The static cycle resolves cleanly: index.ts pulls all three stores; runtime.ts and files.ts cross-reference the hook objects by name; neither side reads the other's internals during init.
- **Files modified:** `src/stores/runtime.ts`.
- **Verification:** `npm run build` clean (no warnings); `npx tsc --noEmit` clean; full Playwright suite green.
- **Committed in:** `c585787` (Task 2)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both in scope: the auxiliary-job pollution surfaced because Plan B is the first plan that introduces non-batch jobs through the shared pool; the Vite warning is a direct consequence of the dynamic-import pattern the plan suggested. Neither deviation changed the architectural intent — Plan B shipped exactly the behavior in the plan spec (12-plugin panel + foot-gun hints + Sanitization toggle + debounced re-optimize + post-batch savings sweep), with the runtime-store contract preserved.

**Impact on plan:** None. Plan B's contracts (component props, store shapes, action signatures) match the plan verbatim.

## Issues Encountered

- **Initial false positive on the "no butteraugli/aggressive" grep** — the rewrite originally included two documentation comments in `SvgoPanel.tsx` referring to the deleted Aggressive-mode/butteraugli toggle ("the legacy 'Aggressive mode' / butteraugli toggle is REMOVED..."). The acceptance grep for the panel is case-insensitive, so those comments would have failed verification. Rewrote the comments to use "perceptual-loss toggle" / "raster-only fidelity metric" instead, which preserves the historical context without tripping the grep. Took ~30 sec to discover and fix.

## User Setup Required

None. Plan B is pure code (state + UI rewiring) — no environment, dependency, or service changes.

## Next Phase Readiness

- **Plan 03-C (SnippetPanel rewrite):** ready. `useSettingsStore.snippetTogglesByFileId` + `setSnippetToggle` are in place for D-13 per-file per-snippet checkboxes. The `unsafeExport` toggle's effect on the export blob already flows through Plan A's `sanitize-svg` (which Plan A wired into the SVG `markDone` path); SnippetPanel will read `FileEntry.optimizedBlob` (the sanitized — or unsanitized when `unsafeExport=true` — single source of truth) directly.
- **Plan 03-D (test corpus):** ready. The OPT-01 stubs for plugin-toggle (D-08), live savings column (D-06), and foot-gun warnings can flip from `test.fail()` to live tests using the 12-plugin record + `__OIMG_STORES__.settings.getState().svg.pluginSavings` + the rendered `<p>` foot-gun copy.
- **Phase 5 (raster encoders):** the auxiliary-job prefix pattern (`preview-` / `savings-` jobIds skipping runtime-store bookkeeping) is the canonical way to add new non-batch worker jobs without disturbing the batch progress UX. Per-file quality-slider preview re-optimize for PNG/WebP/JPEG/AVIF will follow this pattern verbatim.

## Self-Check: PASSED

- All 4 modified files exist on disk.
- Both task commits exist in git log: `9cacb6b` (Task 1) and `c585787` (Task 2).
- `npx tsc --noEmit`: clean.
- `npm run build`: succeeds; no Vite warnings; bundle 152.21 KB gzip initial (well under 200 KB budget).
- `npx playwright test`: 37/37 green.
- Acceptance greps:
  - `grep "removeViewBox" src/components/panels/SvgoPanel.tsx` → matches (plugin in list).
  - `grep "Sanitization" src/components/panels/SvgoPanel.tsx` → matches (Section title).
  - `grep -i "butteraugli\|aggressive" src/components/panels/SvgoPanel.tsx` → 0 matches (deleted).
  - `grep "footgun" src/components/panels/SvgoPanel.tsx` → matches (5+ occurrences).
  - 12 plugin entries in `PLUGIN_META` (verified by `grep -c "id: '"`).
  - `grep "Disable on export" src/components/panels/SvgoPanel.tsx` → matches.
  - `grep "pluginSavings" src/App.tsx` → matches.
  - `grep "enqueuePreview" src/App.tsx` → matches.
  - Savings path uses `WorkerPool.enqueue` (`grep "pool.enqueue(job)" src/App.tsx` inside `computePluginSavings` body).
- Threat T-V5-06 mitigation: Sanitization Toggle defaults to OFF (`safe` badge, accent modifier); copy reads "Advanced. Skips the DOMPurify pass on the exported SVG..."

---

*Phase: 03-svg-pipeline*
*Completed: 2026-05-01*
