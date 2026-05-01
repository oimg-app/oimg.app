---
phase: 03-svg-pipeline
plan: D
subsystem: tests
tags: [svg, e2e, playwright, xss, dompurify, svgo, snippets, regression, phase-gate]

# Dependency graph
requires:
  - phase: 03-svg-pipeline
    plan: A
    provides: svg-adapter (buildSvgoConfig), sanitize-svg pipeline, FileEntry.sanitizedCount
  - phase: 03-svg-pipeline
    plan: B
    provides: SvgoPanel rewrite (foot-gun hints, Sanitization Toggle), D-06 post-batch live savings, D-08 plugin-toggle re-optimize
  - phase: 03-svg-pipeline
    plan: C
    provides: SnippetPanel registry-driven render, snippet-registry, svg-snippets generators, snippetTogglesByFileId
  - phase: 02-worker-harness-state
    provides: window.__OIMG_STORES__ dev affordance, Worker pool callbacks contract, worker-pool.spec boilerplate
provides:
  - 6-case live unit test for buildSvgoConfig (preset overrides + extra-plugin behavior, including RESEARCH §Critical Contradiction)
  - 10 live svg-pipeline.spec.ts E2E tests covering OPT-01 (4 tests), PIPE-01, SNIP-01 (2), SNIP-03, SNIP-04, sanitized-badge regression
  - 10 live svg-xss.spec.ts E2E tests covering full T-V5-01..07 corpus (8 attack vectors + unsafe-export default + snippet-output)
  - svg-config.ts (extracted pure module so buildSvgoConfig is unit-testable without evaluating svgo/browser)
affects:
  - Phase 3 PHASE GATE — all 5 success criteria from ROADMAP Phase 3 row are now provably met by automated tests
  - Future phases — established the "auxiliary-job-prefix collision avoidance" rule for test fixture ids (NEVER prefix file ids with `preview-` or `savings-`)
  - sanitize-svg's `sanitizedCount` semantics tightened (excludes DOMPurify's synthetic <body> wrapper) — ripple-corrects the "sanitized · 1" badge that would have shown on every clean SVG

# Tech tracking
tech-stack:
  added:
    - (none — pure test activation + Rule 1 bugfixes; no new packages)
  patterns:
    - "Test fixture-id collision avoidance: file ids passed to addFile() in tests MUST NOT start with `preview-` or `savings-`. Those prefixes are reserved (App.tsx isAuxiliaryJob discriminator) for D-08 / D-06 auxiliary jobs and short-circuit runtime bookkeeping. Discovered when a file id `savings-test` produced a hung running=true forever batch."
    - "Pure-module extraction for unit-testability: when a function in a worker-side module needs Node-runnable unit tests, extract it (and its plain-data constants) into a sibling module that imports only types — the worker module re-exports the function so existing call sites (App.tsx, etc.) are unchanged. svg-adapter.ts now mirrors svg-config.ts the way runtime.ts mirrors files.ts: wide surface in the worker, tight pure surface for tests."
    - "Microtask deferral for cross-store reads from store-subscriber callbacks: when a subscriber's listener fires synchronously from one store's update but needs to read another store that updates in a follow-on microtask (the pool.then chain), wrap the cross-store read in queueMicrotask so it executes AFTER the resolve→sanitize→markDone microtask flush. Caller-side fix; the fired-twice-per-batch path stays clean."

key-files:
  created:
    - src/workers/svg-config.ts
  modified:
    - src/workers/svg-adapter.ts (extracted buildSvgoConfig + plugin sets to svg-config.ts; re-exports for callers)
    - src/tests/svg-adapter.unit.ts (Wave 0 stub → 6 live cases / 8 assertions)
    - src/tests/svg-pipeline.spec.ts (10 Wave 0 test.fail stubs → 10 live E2E tests)
    - src/tests/svg-xss.spec.ts (10 Wave 0 test.fail stubs → 10 live E2E tests)
    - src/components/panels/SnippetPanel.tsx (Rule 1 fix — store selector returned fresh {} every render)
    - src/lib/sanitize-svg.ts (Rule 1 fix — exclude DOMPurify synthetic BODY wrapper from sanitizedCount)
    - src/App.tsx (Rule 1 fix — defer post-batch savings file-state read by a microtask)
  deleted:
    - (none)

key-decisions:
  - "Extracted buildSvgoConfig + PRESET_DEFAULT_PLUGINS + EXTRA_PLUGINS into svg-config.ts so the unit test can run under Node's --experimental-strip-types without evaluating the `svgo/browser` package (a Vite-browser-only build path). svg-adapter.ts re-exports so App.tsx and worker code are unchanged."
  - "T-V5-02 onmouseover assertion changed from `<rect` literal to `/<rect|<path/` regex. SVGO preset-default's convertShapeToPath plugin rewrites <rect> as <path d='…'/>; the renderable geometry survives in either form, and the threat-register intent (event-handler attribute stripped) is unchanged. This is a runtime-discovered SVGO behavior, not a test plan change."
  - "runXssTest helper no longer requires sanitizedCount > 0 for every fixture. Some XSS payloads (notably `javascript:` href + xlink:href) get neutralized by SVGO BEFORE DOMPurify runs — DOMPurify's removed[] is empty because there's nothing dangerous left to remove. The threat-register contract is 'final output is safe', verified by the cleanSvg checks (no <script/onload=/javascript:) and __XSS_FIRED__ undefined; sanitizedCount is incidental telemetry."
  - "Three Rule 1 bugfixes shipped alongside test activation rather than deferred. The bugs were discovered BY the new tests but root-caused in upstream plans (03-A: BODY-wrapper count, 03-B: post-batch microtask race, 03-C: store-selector fresh-object). Per executor deviation rules, in-scope discoveries are auto-fixed; logging them as deferred would have left Phase 3 acceptance criteria unverifiable. All three are documented under 'Deviations from Plan' below."

patterns-established:
  - "End-to-end SVG pipeline test boilerplate: addSvgFile(page, id, svgContent) helper → click Optimize → waitForDone(page, id) → assert. Mirrors worker-pool.spec.ts (Phase 2 VR-01) verbatim. Phase 5/6 raster pipeline tests will follow the same shape with format='png' / 'jpeg' / etc."
  - "XSS corpus driver: shared runXssTest(page, fixtureFile, testId) helper enforces the three-part safety check ((a) sanitizedCount captured for telemetry, (b) __XSS_FIRED__ undefined, (c) cleanSvg free of dangerous markers) and returns the captured fields so per-fixture tests can layer fixture-specific assertions (e.g., specific attribute absence) on top."
  - "Auxiliary-job-prefix discriminator boundary: documented (in the test file's frontmatter comment) that test file ids MUST NOT start with `preview-` or `savings-`. App.tsx's isAuxiliaryJob short-circuits runtime bookkeeping for those prefixes by design (so D-06/D-08 jobs don't inflate doneCount), and an in-test fileId starting with `savings-` accidentally triggers the same short-circuit, hanging the batch."

requirements-completed:
  - OPT-01
  - SNIP-01
  - SNIP-03
  - SNIP-04
  - PIPE-01

# Metrics
duration: ~125min
completed: 2026-05-01
---

# Phase 03 Plan D: SVG Pipeline Phase Gate Summary

**All 20 Wave 0 stubs replaced with live assertions; full Playwright suite green at 37/37 across phases 1+2+3, both unit-test scripts green, three Rule 1 bugs surfaced and fixed alongside the test activation. Phase 3 success criteria (OPT-01, SNIP-01/03/04, PIPE-01, T-V5-01..07) all provably met by automated regression tests.**

## Performance

- **Duration:** ~125 min
- **Started:** 2026-05-01T11:21:11Z
- **Completed:** 2026-05-01T13:26:21Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 7
- **Commits:** 5 (1 unit-test activation, 3 Rule 1 fixes, 1 E2E test activation)

## Accomplishments

- **`src/tests/svg-adapter.unit.ts`** — Wave 0 stub flipped to 6 live test cases (8 assertions): all-on settings → empty preset overrides + no extras, preset-default plugin off → overrides[id]=false, extra plugin on → appears as bare-string entry, extra plugin off → absent from BOTH overrides and extras (RESEARCH §Critical Contradiction), multi-plugin override aggregation. `node --experimental-strip-types src/tests/svg-adapter.unit.ts` exits 0.
- **`src/workers/svg-config.ts`** — extracted pure module (buildSvgoConfig + PRESET_DEFAULT_PLUGINS + EXTRA_PLUGINS sets) so unit tests can import without evaluating `svgo/browser`. svg-adapter.ts re-exports buildSvgoConfig so callers (App.tsx D-06 live-savings benchmark, worker run path) are unchanged.
- **`src/tests/svg-pipeline.spec.ts`** — 10 Wave 0 stubs flipped to 10 live tests: PIPE-01+OPT-01 byte-delta, SVGO preset-default removes comment+metadata, plugin toggle re-optimize (D-08 debounce), foot-gun warnings render, live savings column populated post-batch (D-06), SnippetPanel renders inline+data-URI sections (SNIP-01), per-snippet checkbox hides body (D-13), copy button + 1100ms reset (SNIP-03), URL-encoded output CSS-safe (SNIP-04), clean SVG → no sanitized badge.
- **`src/tests/svg-xss.spec.ts`** — 10 Wave 0 stubs flipped to 10 live tests via shared `runXssTest` helper: T-V5-01..05 (script tag, onload, javascript: href / xlink:href, data: URI href, foreignObject), onmouseover handler, CSS expression, T-V5-06 unsafeExport defaults OFF, T-V5-07 snippet output for XSS SVG. All 8 attack vectors confirm `__XSS_FIRED__ === undefined` AND cleanSvg free of `<script/onload=/javascript:`.
- **Three Rule 1 bugs caught by the new tests, fixed alongside activation:**
  - SnippetPanel selector returned a fresh `{}` literal every render → React 19 "Maximum update depth exceeded" → entire inspector pane unmounted on Output-tab click. Fix: hoist selector to parent record + module-level EMPTY_TOGGLES constant.
  - DOMPurify's synthetic `<body>` wrapper was being counted in `sanitizedCount` → every clean SVG showed "sanitized · 1" badge. Fix: filter `removed[]` to drop entries whose `element.nodeName === 'BODY'`.
  - Post-batch savings file-state read raced ahead of the pool's `.then` microtask → `completedSvgIds` always empty → `computePluginSavings` never ran. Fix: wrap the cross-store read in `queueMicrotask` so the .then→sanitize→markDone microtask chain flushes first.
- **Verification:** `npx playwright test` 37/37 green (Phase 1 + 2 + 3); `node --experimental-strip-types` for both unit-test scripts exits 0 (8 + 11 = 19 assertions); `npx tsc --noEmit` clean; `vite build` clean (478 KB main bundle, well under 200 KB gzipped budget per route).

## Task Commits

1. **Task 1: svg-adapter.unit.ts Wave 0 stub → 6 live cases (+ svg-config.ts extraction)** — `6e05988` (test)
2. **Rule 1 fix: SnippetPanel selector fresh-object infinite loop** — `bd63023` (fix)
3. **Rule 1 fix: sanitize-svg BODY-wrapper exclusion from sanitizedCount** — `24a4409` (fix)
4. **Rule 1 fix: post-batch savings microtask deferral** — `f12ca49` (fix)
5. **Task 2: svg-pipeline.spec.ts + svg-xss.spec.ts Wave 0 stubs → 20 live E2E tests** — `4669b06` (test)

**Plan metadata:** _(filed in next commit alongside SUMMARY + STATE + ROADMAP updates)_

## Files Created/Modified

### Created (1)

- `src/workers/svg-config.ts` — pure module (buildSvgoConfig + PRESET_DEFAULT_PLUGINS + EXTRA_PLUGINS). No external imports beyond a type-only `CodecSettingsSvg`. Returns a structural `SvgoConfigShape` that matches what SVGO accepts at runtime, so the worker's `optimize(string, buildSvgoConfig(settings))` keeps working without forcing svg-config to import svgo.

### Modified (7)

- `src/workers/svg-adapter.ts` — re-exports buildSvgoConfig from svg-config.ts so existing call sites (App.tsx D-06 benchmark, worker `run()`) are unchanged. The worker-side `run()` function is untouched; only the helper extraction is new.
- `src/tests/svg-adapter.unit.ts` — Wave 0 stub → 6 live cases / 8 assertions. Imports buildSvgoConfig from svg-config.ts (NOT from svg-adapter.ts) so the test runs under Node's --experimental-strip-types without evaluating svgo/browser.
- `src/tests/svg-pipeline.spec.ts` — 10 Wave 0 test.fail stubs → 10 live tests. Adds `addSvgFile`, `waitForDone` helpers + `CLEAN_SVG`, `NUMERIC_SVG` fixtures. Renames the savings-test file id to `live-savings` to avoid the auxiliary-job-prefix collision.
- `src/tests/svg-xss.spec.ts` — 10 Wave 0 test.fail stubs → 10 live tests. Adds shared `runXssTest` helper that captures `(xssFired, sanitizedCount, cleanSvg)` and enforces the three-part safety check. Per-fixture tests layer specific attribute-absence assertions on top.
- `src/components/panels/SnippetPanel.tsx` — Rule 1 fix: hoist zustand selector to `(s) => s.snippetTogglesByFileId` (stable reference) and derive the file-specific slice via `togglesByFile[file.id] ?? EMPTY_TOGGLES` outside the selector. Latent bug shipped in 03-C.
- `src/lib/sanitize-svg.ts` — Rule 1 fix: filter `DOMPurify.removed[]` to drop entries whose `element.nodeName === 'BODY'` before computing `sanitizedCount`. The synthetic wrapper would otherwise inflate the count by 1 on every input. Latent bug shipped in 03-A.
- `src/App.tsx` — Rule 1 fix: wrap the post-batch `useFilesStore.getState()` read in `queueMicrotask` so it executes AFTER the pool.enqueue().then() microtask chain. Latent bug shipped in 03-B (D-06 wiring).

## Decisions Made

- **Extract a pure svg-config module rather than mock svgo in the unit test.** Mocking the SVGO type just to make a unit test runnable would couple the test to internal SVGO type structure and break on any svgo upgrade. Extracting the pure function (which has zero SVGO API dependencies — it only emits a config payload) costs one new file and makes the test bulletproof.
- **Document the auxiliary-job-prefix collision in the test file's frontmatter comment AND in this summary's patterns-established rather than rename `isAuxiliaryJob`'s prefixes.** The prefixes (`preview-`, `savings-`) are baked into App.tsx, runtime.ts, and the documented D-06/D-08 contracts; renaming them would ripple across multiple plan summaries and obscure intent. Documenting the test-author rule (file ids MUST NOT start with these prefixes) is a one-line discipline that future test plans can follow.
- **Auto-fix the three Rule 1 bugs rather than defer them.** Each bug was directly blocking a Phase 3 acceptance criterion (`SnippetPanel renders` → blocks SNIP-01/03/04, `sanitizedCount` → blocks badge regression, `microtask race` → blocks live savings). Deferring would have left Phase 3 acceptance unverifiable. Per executor deviation rules, in-scope discoveries that affect correctness are auto-fixed inline.
- **Relax the runXssTest sanitizedCount > 0 assertion to a non-asserting capture.** SVGO's preset-default removes most dangerous attributes (javascript: href, xlink:href, data:text/html href) BEFORE DOMPurify ever runs. The threat-register contract is "final output is safe" — verified by cleanSvg checks + __XSS_FIRED__ undefined — not "DOMPurify specifically did the cleaning." Asserting >0 over-constrains the implementation and rejects valid defense-in-depth.
- **T-V5-02 onmouseover: accept either `<rect>` or `<path>` in cleaned output.** SVGO's `convertShapeToPath` plugin (in preset-default) rewrites `<rect>` as `<path d="M0 0h…"/>`. Either way, the renderable geometry survives and the event-handler attribute is gone. The plan's literal `<rect` assertion was written before the plan author re-confirmed SVGO behavior on a rect fixture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SnippetPanel selector returned fresh empty object on every render**
- **Found during:** Task 2 — first attempt to render SnippetPanel via the Output tab in tests.
- **Issue:** `useSettingsStore((s) => file ? (s.snippetTogglesByFileId[file.id] ?? {}) : {})` returns a brand-new `{}` literal whenever the file has no per-snippet toggles. React 19's getSnapshot caching guard logs "The result of getSnapshot should be cached to avoid an infinite loop", then crashes the component with "Maximum update depth exceeded". The entire inspector pane unmounted, taking 4 SVG-pipeline tests + the T-V5-07 snippet-output test down with it.
- **Fix:** Hoist the selector to `(s) => s.snippetTogglesByFileId` (stable parent record) and derive `togglesByFile[file.id] ?? EMPTY_TOGGLES` outside zustand, where `EMPTY_TOGGLES` is a module-level frozen-by-convention `{}` constant. No behavior change visible to users; SnippetPanel renders correctly.
- **Files modified:** src/components/panels/SnippetPanel.tsx
- **Commit:** bd63023
- **Bug origin:** 03-C (the SnippetPanel that landed in 07618e6 had this selector pattern from day 1; latent because no E2E test exercised the panel until 03-D).

**2. [Rule 1 - Bug] sanitize-svg counted DOMPurify's synthetic <body> wrapper**
- **Found during:** Task 2 — "clean SVG → sanitizedCount === 0" regression test failed (Expected 0, Received 1) for both pristine and cruft-bearing SVG inputs.
- **Issue:** DOMPurify wraps every parsed input in a synthetic `<body>` element for HTML-style parsing and unwraps it on serialize. The wrapper's removal is recorded in `DOMPurify.removed[]` for every sanitize() call, so `removed.length` was always >= 1 even for completely clean SVGs. The user-visible consequence: every optimized SVG would have shown the warn-style "sanitized · 1" badge in its file row, defeating the badge's purpose (signal that the file had dangerous content removed).
- **Fix:** Filter `DOMPurify.removed[]` to drop entries whose `element.nodeName === 'BODY'` before computing `sanitizedCount`. The remaining entries reflect actual dangerous-content removals (script tags, on* handlers, javascript: hrefs, etc.), which is the badge's real semantic.
- **Files modified:** src/lib/sanitize-svg.ts
- **Commit:** 24a4409
- **Bug origin:** 03-A (sanitize-svg.ts shipped this counting logic in 2f1051b; latent because Plan A's spec stubs only checked `sanitizedCount > 0` for fixtures that already contained dangerous content, never the clean-SVG case).

**3. [Rule 1 - Bug] Post-batch savings file-state read raced ahead of the pool's .then microtask**
- **Found during:** Task 2 — "live savings column populated post-batch" test timed out at the `pluginSavings != {}` waitForFunction.
- **Issue:** `pool.runOnSlot` calls `job.resolve(result); callbacks.onDone(...)` synchronously. `job.resolve(result)` queues the .then microtask that runs DOMPurify on the SVGO output and writes `useFilesStore.markDone(fileId, sanitizedBlob, …)`. The synchronous `callbacks.onDone` fires `runtime.markDone` FIRST, flipping `running: true → false` in the same tick. The batch-end subscriber in App.tsx then reads `useFilesStore.getState()` synchronously, filters for `status === 'done' && optimizedBlob`, and finds the file is still `status='processing'` / `optimizedBlob === null`. `completedSvgIds` is empty, so `computePluginSavings` is never invoked, so `useSettingsStore.svg.pluginSavings` stays `{}` forever.
- **Fix:** Wrap the file-state read + `computePluginSavings` invocation in `queueMicrotask` so it executes AFTER the pool.enqueue().then() microtask chain has flushed the file write. The batch-end toast/announce/live-region path remains synchronous on the running flip; only the deferred completedSvgIds derivation moved.
- **Files modified:** src/App.tsx
- **Commit:** f12ca49
- **Bug origin:** 03-B (D-06 wiring landed in c585787; latent because the plan A→B integration test only checked the `pluginSavings != {}` post-condition through manual smoke testing, never through an automated test, so the race was masked).

### Test-time deviations from plan (no production code change)

- **File-id naming convention:** the plan's example used `id: 'savings-test'` for the live-savings test. `App.tsx isAuxiliaryJob` treats any jobId starting with `preview-` or `savings-` as a D-06/D-08 auxiliary job and short-circuits runtime bookkeeping (so the Plan-B savings benchmark doesn't inflate doneCount past totalJobs). A test file id starting with `savings-` accidentally triggers the same short-circuit. Renamed `savings-test` → `live-savings`. Documented the rule in the spec frontmatter and this summary.
- **T-V5-02 onmouseover assertion:** the plan asserted `<rect` literal in cleaned output. SVGO's preset-default `convertShapeToPath` plugin rewrites `<rect>` as `<path d="…">`. Changed the assertion to `/<rect|<path/` regex. Threat-register intent (event-handler attribute stripped, renderable geometry preserved) is unchanged.
- **runXssTest sanitizedCount assertion:** the plan asserted `sanitizedCount > 0` for every fixture. Some fixtures (javascript: href, data: href in <a>) are neutralized by SVGO before DOMPurify runs, so DOMPurify's removed[] is empty. Replaced the hard >0 assertion with a non-asserting capture for downstream telemetry; the safety contract is enforced by the cleanSvg checks (no <script/onload=/javascript:) + __XSS_FIRED__ undefined.

## Issues Encountered

- **The auxiliary-job-prefix collision was not obvious from reading the plan or App.tsx in isolation.** The `isAuxiliaryJob` discriminator looks like an internal implementation detail; only the runtime trace of "running stays true forever, doneCount stays 0, file goes to done anyway" surfaced it. Future test plans should call out reserved file-id prefixes explicitly in their fixtures section.
- **DOMPurify's synthetic `<body>` is a documented quirk** but the project's sanitize-svg implementation copied the canonical `DOMPurify.removed.length` pattern from the DOMPurify README, which assumes the consumer treats removed.length as "approximate count of bad things." For our use case (a user-visible badge that promises "this file had dangerous content"), 0/1 must distinguish clean from "removed something." Filtering BODY restores that promise.
- **Verification took longer than expected because RTK truncates Playwright's JSON output** (consistently buffer-cuts at "PASS (n) FAIL (m)" summary). Worked around by parsing the raw tee log files directly via Node — slower iteration cycle. Documented for future executors who hit the same.

## User Setup Required

None. Plan D is pure test activation + isolated Rule 1 bugfixes; no environment, dependency, or service changes.

## Phase 3 Gate — Success Criteria Verification

| Phase 3 ROADMAP Success Criterion | Verified by |
|-----------------------------------|-------------|
| **SVG drop → SVGO → byte delta visible** | `svg-pipeline.spec.ts > "PIPE-01 + OPT-01: drop SVG → enqueue → optimize → status done + byte delta in row"` |
| **Plugin toggles update output in real time** | `svg-pipeline.spec.ts > "OPT-01: plugin toggle re-optimizes selected file (D-08) — debounced re-run completes"` |
| **XSS SVGs sanitized — preview and snippets clean (SC-3)** | `svg-xss.spec.ts > T-V5-01..05 (5 attack vectors)` + `T-V5-07 snippet output check` |
| **Inline SVG + URL-encoded data URI copy correctly** | `svg-pipeline.spec.ts > "SNIP-01: …"`, `"SNIP-03: copy button writes snippet to clipboard"`, `"SNIP-04: URL-encoded output is CSS-safe"` |
| **Live per-plugin savings populate post-batch** | `svg-pipeline.spec.ts > "OPT-01: live savings column populated post-batch (D-06)"` |

All 5 ROADMAP Phase 3 success criteria provably met by automated regression tests.

## Self-Check: PASSED

- All 1 created file exists on disk (`test -f src/workers/svg-config.ts` verified).
- All 5 task commits exist in git log: `6e05988` (Task 1 unit tests), `bd63023` (Rule 1 — SnippetPanel), `24a4409` (Rule 1 — sanitize-svg BODY), `f12ca49` (Rule 1 — microtask), `4669b06` (Task 2 E2E specs).
- `npx tsc --noEmit` — clean.
- `node node_modules/vite/bin/vite.js build` — succeeds; 478 KB main bundle (gzip < 200 KB target maintained).
- `node --experimental-strip-types src/tests/svg-adapter.unit.ts` — 8 PASS, 0 FAIL.
- `node --experimental-strip-types src/tests/svg-snippets.unit.ts` — 11 PASS, 0 FAIL.
- `npx playwright test` — 37/37 green (Phase 1 aria-live/build/object-url/shell + Phase 2 worker-pool VR-01/02/03 + Phase 3 svg-pipeline 10 + svg-xss 10).
- Acceptance greps:
  - `grep -E "test\.fail\(\)" src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts` → 0 actual stub calls (1 mention in a comment, NOT a callable).
  - `grep "buildSvgoConfig" src/workers/svg-config.ts` → matches the export.
  - `grep "queueMicrotask" src/App.tsx` → matches the deferred-savings fix.
  - `grep "BODY" src/lib/sanitize-svg.ts` → matches the synthetic-wrapper filter.
  - `grep "EMPTY_TOGGLES" src/components/panels/SnippetPanel.tsx` → matches the stable-reference constant.
