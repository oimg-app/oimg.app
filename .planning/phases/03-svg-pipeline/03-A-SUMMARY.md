---
phase: 03-svg-pipeline
plan: A
subsystem: optimization
tags: [svgo, dompurify, web-worker, comlink, vite, react, typescript, xss, sanitization]

# Dependency graph
requires:
  - phase: 02-worker-harness-state
    provides: WorkerPool (lazy-spawn, terminate-and-respawn cancel), three-store architecture, ADAPTERS map, AdapterMeta contract, Comlink.transfer pipeline, __OIMG_STORES__ test affordance
provides:
  - First production codec adapter (SVGO v4 browser ESM) wired through the Phase 2 worker contract
  - Main-thread DOMPurify helper with sanitizedCount surfacing (D-01 + D-03)
  - Curated 12-plugin DEFAULT_CODEC_SVG record (D-05/D-07; SVGO_PLUGINS mock array deleted)
  - SVG routing in App.tsx batch dispatcher (format='svg' → real adapter; others fall back to stub)
  - Sanitized badge ".pill.warn.sm" in file row (D-03)
  - 9 XSS fixture SVGs + 20 Playwright spec stubs (test.fail markers) covering OPT-01/PIPE-01/SNIP-01/SNIP-03/SNIP-04/SC-3/T-V5-01..07
  - Type extensions: AdapterMeta.sanitizedCount, FileEntry.sanitizedCount, CodecSettingsSvg.unsafeExport+pluginSavings, SnippetId union
  - Vite optimizeDeps.include = ['svgo/browser', 'dompurify']
  - Empirically-verified Pitfall 1: DOMPurify cannot init without document
affects:
  - 03-B-PLAN (SvgoPanel rewrite consumes the curated plugin record + pluginSavings)
  - 03-C-PLAN (SnippetPanel + svg-snippets.ts consume sanitized FileEntry.optimizedBlob; SnippetId union ready)
  - 03-D-PLAN (test corpus extends the stubs landed here)
  - Phase 5 (raster encoders reuse the main-thread post-processing pattern; markDone signature stable)

# Tech tracking
tech-stack:
  added:
    - svgo@4.0.1 (browser ESM via 'svgo/browser')
    - dompurify@3.4.2 (USE_PROFILES.svg + svgFilters)
  patterns:
    - Worker = SVGO only (text in/out); main thread = DOMPurify post-pool (D-01)
    - buildSvgoConfig() splits curated record → preset-default overrides + opt-in extras (D-07)
    - Sanitized blob is the single source of truth; sanitizedCount flows through markDone(...4th param)
    - File-row badge reads FileEntry.sanitizedCount directly (no view-model duplication)
    - Defensive `byId[fileId]` existence check in pool .then path (replaces stale `inFlight.has` race)

key-files:
  created:
    - src/workers/svg-adapter.ts
    - src/lib/sanitize-svg.ts
    - src/tests/svg-pipeline.spec.ts
    - src/tests/svg-xss.spec.ts
    - src/tests/svg-adapter.unit.ts
    - src/tests/svg-snippets.unit.ts
    - src/tests/fixtures/xss-script.svg
    - src/tests/fixtures/xss-onload.svg
    - src/tests/fixtures/xss-javascript-href.svg
    - src/tests/fixtures/xss-data-href.svg
    - src/tests/fixtures/xss-foreignobject.svg
    - src/tests/fixtures/xss-xlink-href.svg
    - src/tests/fixtures/xss-use-data.svg
    - src/tests/fixtures/xss-css-expression.svg
    - src/tests/fixtures/xss-onmouseover.svg
    - .planning/phases/03-svg-pipeline/deferred-items.md
  modified:
    - src/workers/worker.ts (ADAPTERS svg slot wired to dynamic import)
    - src/workers/types.ts (AdapterMeta.sanitizedCount?)
    - src/types/index.ts (FileEntry.sanitizedCount?, CodecSettingsSvg fields, SnippetId)
    - src/data/defaults.ts (12-plugin curated record; SVGO_PLUGINS deleted)
    - src/stores/files.ts (markDone accepts optional sanitizedCount)
    - src/App.tsx (route SVG → svg adapter; main-thread DOMPurify post-pool; sanitized badge in file row; CR-04 race fix)
    - src/index.css (.pill.sm modifier)
    - vite.config.ts (optimizeDeps.include for svgo + dompurify)
    - package.json + package-lock.json (svgo, dompurify install)

key-decisions:
  - "Pitfall 1 verified empirically: DOMPurify reports isSupported=false without `document`, so the SVG adapter (worker) does SVGO only and src/lib/sanitize-svg.ts runs DOMPurify on the main thread post-pool. D-01 is satisfied (logical post-SVGO ordering preserved)."
  - "RESEARCH §Critical Contradiction confirmed at implementation time: removeViewBox and removeDimensions are NOT in SVGO v4 preset-default (verified by reading svgo@4.0.1/plugins/preset-default.js). DEFAULT_CODEC_SVG.plugins keeps both at false (UI-SPEC row 11 'on' is a documented spec error)."
  - "The SVGO_PLUGINS mock array was deleted from defaults.ts in Plan A (not deferred to Plan B) so the canonical plugin record has a single source of truth. App.tsx derives a temporary SvgoPlugin[] view-model shim until Plan B rewrites SvgoPanel."
  - "Pre-existing CR-04 race (App.tsx pool .then guard `inFlight.has(fileId)`) was incidentally surfaced and fixed during Plan A. Cancel-race correctness preserved via .catch AbortError discriminator."

patterns-established:
  - "Adapter shape: TextDecoder → optimize() → TextEncoder → ArrayBuffer; all errors throw AdapterError(format, 'process', message). Phase 5 raster encoders follow the same shape with WASM codec calls in place of optimize()."
  - "Main-thread post-processing: pool.enqueue → .then(async result => { if (format-specific) { decode + transform on main thread + sanitize-style helper }; markDone(...) }). Phase 5 may reuse for ICC profile preservation, EXIF stripping in supplemental main-thread passes."
  - "Type extension via optional fields: every Phase 3 type addition (sanitizedCount, unsafeExport, pluginSavings) is `?` so prior tests/code work unchanged."
  - "Vite optimizeDeps.include for large ESM packages used in workers — required so dynamic-import resolution doesn't stall on cold module loads in dev."

requirements-completed:
  - OPT-01
  - PIPE-01

# Metrics
duration: ~70min
completed: 2026-05-01
---

# Phase 03 Plan A: SVG Pipeline Wave 0 + 1 Summary

**SVGO v4 worker adapter + main-thread DOMPurify sanitization wired end-to-end; XSS-laden SVGs round-trip through optimize → sanitize → store with sanitizedCount surfaced on the file row.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-05-01T09:35:00Z
- **Completed:** 2026-05-01T10:46:00Z
- **Tasks:** 2 (Wave 0 scaffolding + Wave 1 wiring)
- **Files modified/created:** 22

## Accomplishments

- First production codec adapter wired behind the Phase 2 worker contract — SVGO v4 browser ESM in worker, DOMPurify on main thread (D-01 logical ordering, physical separation per Pitfall 1).
- Empirical probe confirms DOMPurify cannot init in standard Web Workers (`isSupported=false`, `sanitize=undefined` without `document`); architecture matches RESEARCH.md §Pattern 2.
- Curated 12-plugin DEFAULT_CODEC_SVG.plugins record (10 in preset-default + 2 opt-in extras) replaces both the 5-plugin record and the 22-plugin mock; resolves UI-SPEC row 11 spec error per RESEARCH §Critical Contradiction.
- 9 XSS fixture SVGs + 20 Playwright spec stubs (test.fail markers) ready for Plan A Wave 1 / Plan B / Plan C activation.
- Live-verified end-to-end: dropping `xss-script.svg` → optimize → `FileEntry.status='done'`, `sanitizedCount=2`, file row renders `pill.warn.sm` "sanitized · 2" badge.
- Full Playwright suite (37 tests) green — Plan A's auto-fix incidentally cleared the previously-flaky VR-01.

## Task Commits

1. **Task 1: Wave 0 scaffolding (install + specs + XSS corpus + DOMPurify probe)** — `68195ad` (test)
2. **Task 2: Wave 1 wiring (svg-adapter + sanitize-svg + types + ADAPTERS + markDone + sanitized badge)** — `2f1051b` (feat)

**Plan metadata:** _(filed in next commit alongside SUMMARY + STATE updates)_

## Files Created/Modified

### Created (16)

- `src/workers/svg-adapter.ts` — SVGO-only adapter (TextDecoder → optimize() → TextEncoder); exports `run`, `buildSvgoConfig`.
- `src/lib/sanitize-svg.ts` — Main-thread DOMPurify helper; exports `sanitizeSvg(svgString, unsafe)`.
- `src/tests/svg-pipeline.spec.ts` — 10 spec stubs covering OPT-01, PIPE-01, SNIP-01, SNIP-03, SNIP-04, plus the sanitized-badge stub.
- `src/tests/svg-xss.spec.ts` — 10 spec stubs covering 8 XSS attack vectors + unsafe-export + snippet-output.
- `src/tests/svg-adapter.unit.ts` + `src/tests/svg-snippets.unit.ts` — Wave 0 unit-test stubs.
- `src/tests/fixtures/xss-{script,onload,onmouseover,javascript-href,xlink-href,data-href,use-data,foreignobject,css-expression}.svg` — 9 attack fixtures, each carrying `window.__XSS_FIRED__` payload.
- `.planning/phases/03-svg-pipeline/deferred-items.md` — Records the CR-04 race fix and notes that Plan A surfaced no truly-deferred items.

### Modified (9)

- `src/workers/worker.ts` — `svg: () => import('./svg-adapter')` (replaces throw stub).
- `src/workers/types.ts` — `AdapterMeta.sanitizedCount?: number`.
- `src/types/index.ts` — `FileEntry.sanitizedCount?`; `CodecSettingsSvg.unsafeExport?` + `.pluginSavings?`; new `SnippetId` union.
- `src/data/defaults.ts` — 12-plugin curated `DEFAULT_CODEC_SVG.plugins`; `SVGO_PLUGINS` array deleted; `SvgoPlugin` import removed.
- `src/stores/files.ts` — `markDone` signature accepts optional `sanitizedCount`; idempotent for non-SVG calls.
- `src/App.tsx` — SVG routing in startOptimize batch dispatcher; main-thread DOMPurify branch; sanitized badge inline in file row; CR-04 race fix; SVGO_PLUGINS shim derived from DEFAULT_CODEC_SVG.plugins.
- `src/index.css` — `.pill.sm` small-variant modifier.
- `vite.config.ts` — `optimizeDeps.include = ['svgo/browser', 'dompurify']` (pre-bundle large ESM for worker).
- `package.json` + `package-lock.json` — svgo@4.0.1, dompurify@3.4.2 added.

## Decisions Made

- **DOMPurify lives on main thread** — confirmed by empirical no-document probe (`DOMPurify.isSupported === false`, `sanitize === undefined`). Adapter does SVGO only. D-01 satisfied as logical-pipeline ordering.
- **`removeViewBox` + `removeDimensions` default to `false`** — both are NOT in SVGO v4 preset-default (verified against `svgo@4.0.1/plugins/preset-default.js`); D-07 "mirror preset-default" → keep them off; UI-SPEC row 11 is a documented spec error.
- **`SVGO_PLUGINS` mock array deleted in Plan A** (not deferred to Plan B) — single source of truth principle; App.tsx derives a one-line shim until Plan B rewrites SvgoPanel.
- **Vite `optimizeDeps.include`** — empirically required: without pre-bundling, worker dynamic-import of svg-adapter stalled in dev mode (svgo ships ~200 plugin files served as raw ESM).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Pre-existing CR-04 race in App.tsx pool .then handler**
- **Found during:** Task 2 (Wave 1 wiring), live smoke test.
- **Issue:** The original guard `if (!useRuntimeStore.getState().inFlight.has(fileId)) return` raced with the pool's own `onDone` callback. `pool.runOnSlot` calls `job.resolve(result)` and then synchronously `callbacks.onDone(...)` — runtime.markDone removes the job from inFlight BEFORE the .then microtask runs. The guard then incorrectly bailed on every successful job, so files never reached `status='done'`. Bug existed since Phase 2 plan 02-04 but was latent (aria-live/object-url tests waited on `runtime.doneCount`, not `file.status`; only worker-pool VR-01 hit it and was a flaky 30s timeout).
- **Fix:** Replaced the inFlight guard with a defensive `byId[fileId]` existence check. Cancel-race correctness preserved because cancelled jobs route through `.catch` (`job.reject(AbortError)`), not `.then`.
- **Files modified:** `src/App.tsx`.
- **Verification:** Full Playwright suite (37/37 tests) green after the fix — including the previously-flaky VR-01. Smoke test (deleted post-debug) confirmed live SVG path produces `status='done'` + `sanitizedCount=2` for `xss-script.svg`.
- **Committed in:** `2f1051b` (Task 2 commit)

**2. [Rule 3 — Blocking] Vite optimizeDeps.include required for worker svg-adapter dynamic import**
- **Found during:** Task 2 verification (live smoke test).
- **Issue:** Worker's first `import('./svg-adapter')` stalled indefinitely in dev mode because svgo ships ~200 plugin source files served as raw ESM by Vite; the worker's import graph never settled within the 30s test budget.
- **Fix:** Added `optimizeDeps: { include: ['svgo/browser', 'dompurify'] }` to `vite.config.ts` so Vite pre-bundles both packages into single chunks before serving them.
- **Files modified:** `vite.config.ts`.
- **Verification:** `npm run dev` cold-start serves svg-adapter under 1s; dev playwright run completes in standard timing.
- **Committed in:** `2f1051b` (Task 2 commit)

**3. [Rule 3 — Blocking] SVGO PluginConfig TypeScript signature for extra-plugin names**
- **Found during:** Task 2 (`npm run build` after writing svg-adapter.ts).
- **Issue:** Initial code used `extraPlugins: string[]` then spread into the plugins array; SVGO's `PluginConfig` union expects `keyof BuiltinsWithOptionalParams` (a literal-name union) rather than a bare string, so `tsc --build` rejected the cast.
- **Fix:** Inferred the per-element type via `NonNullable<...>['plugins'] extends (infer U)[] | undefined ? U : never` and cast the bare strings to that type. Runtime behavior unchanged — SVGO accepts the bare-name form.
- **Files modified:** `src/workers/svg-adapter.ts`.
- **Verification:** `npx tsc --noEmit` clean; `npm run build` produces svg-adapter chunk (552KB unbuilt → lazy-loaded).
- **Committed in:** `2f1051b` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking). All in scope: the CR-04 race surfaced because Plan A is the first plan whose pipeline actually depends on `file.status === 'done'`; the optimizeDeps and TS cast were direct prerequisites for the new SVG path to work.

**Impact on plan:** None of the deviations changed the architectural intent. Plan A shipped exactly the contracts called out in the plan spec — adapter signature, sanitize helper signature, type extensions, ADAPTERS map wiring, markDone signature, file-row badge — and additionally restored a pre-existing latent bug (VR-01 now green).

## Issues Encountered

- **rtk Bash output truncation** delayed debugging the smoke test: `console.log()` lines and `text` fields inside playwright JSON logs were filtered by the Bash wrapper, masking the runtime state mid-debug. Worked around by writing browser logs + final state JSON to `/tmp/svg-smoke-result.json` from the spec body, which `cat` could read directly. The smoke test was deleted before the Task 2 commit; the working pattern is now part of the team's mental model for next debugging session.

## User Setup Required

None — Plan 03-A makes no external service or environment changes. `npm install` is required to pull svgo + dompurify (already executed during Task 1).

## Next Phase Readiness

- **Plan 03-B (SvgoPanel rewrite):** ready. The curated 12-plugin record is in `useSettingsStore.svg.plugins`; the temporary `SVGO_PLUGINS` shim in App.tsx must be deleted when Plan B replaces the SvgoPanel props shape. `pluginSavings` slot is already typed in `CodecSettingsSvg`.
- **Plan 03-C (SnippetPanel):** ready. `FileEntry.optimizedBlob` is now the sanitized blob (D-04 single source of truth); `SnippetId` union is exported; `useSettingsStore.svg.unsafeExport` flag is wired through to `sanitize-svg.ts`.
- **Plan 03-D (test corpus):** ready. 20 spec stubs + 9 XSS fixtures already in place; Plan A Wave 1 stubs (OPT-01 + sanitized-badge + 5 of 8 XSS) can flip to live tests using the patterns established in `worker-pool.spec.ts` and the smoke-test approach proven during this plan.
- **Phase 5 (raster encoders):** the main-thread post-processing pattern (worker returns bytes → main thread decodes + does extra work → builds final blob → markDone with metadata) is now established and can extend cleanly for ICC profile preservation, EXIF stripping, etc.

## Self-Check: PASSED

- All 16 created files exist on disk (verified via `test -f`).
- Both task commits exist in git log: `68195ad` and `2f1051b`.
- `npx tsc --noEmit`: clean.
- `npm run build`: produces svg-adapter chunk; bundle still well under budgets.
- `npx playwright test`: 37/37 tests pass.

---

*Phase: 03-svg-pipeline*
*Completed: 2026-05-01*
