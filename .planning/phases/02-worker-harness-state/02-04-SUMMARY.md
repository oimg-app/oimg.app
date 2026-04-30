---
phase: 02-worker-harness-state
plan: 04
subsystem: ui-wiring
tags: [phase-02, wave-2, ui-wiring, app-tsx, toolbar, command-palette, sonner, aria-live, worker-pool]

# Dependency graph
requires:
  - phase: 02-worker-harness-state
    plan: 02
    provides: "useFilesStore + useSettingsStore + useRuntimeStore (subscribeWithSelector); setLiveRegion/announce/isQuartileBoundary; POOL_SIZE; urlCache lifecycle"
  - phase: 02-worker-harness-state
    plan: 03
    provides: "WorkerPool class with onStarted/onDone/onError callbacks; getWorkerPool() singleton; stub adapter (D-04 round-trip); Comlink-exposed worker entry"
provides:
  - "App.tsx composition root wired to stores + worker pool + ARIA live region + sonner Toaster"
  - "Toolbar subscribed to useRuntimeStore via narrow selectors (D-09); Workers pill renders all 4 UI-SPEC §1 states"
  - "ARIA live region (role=status aria-live=polite) mounted at App root with quartile cadence + final/cancel announcements"
  - "Cmd+Enter (Optimize) and Cmd+. (Cancel batch) keyboard shortcuts"
  - "Cmd+K palette: Optimize meta updated to 'Run worker pool · ⌘⏎'; Cancel batch entry visible while running"
  - "Dev/test-only window.__OIMG_STORES__ exposure (tree-shaken from production bundle)"
  - "Dev/test-only window.__OIMG_SLOW_MS__ stub-adapter delay injection (VR-02/VR-03 enabling)"
  - "vite.config.ts worker.format = 'es' — closes deferred chunk-emission gate from plan 02-03"
  - "Wave 0 specs flipped from test.fail() to real green: VR-01, VR-02, VR-03, VR-04, VR-05"
affects: [02-05-cleanup, 03-svg-pipeline, 05-raster-encoders]

# Tech tracking
tech-stack:
  added: []  # All deps already installed in plan 02-02 (sonner, comlink, zustand)
  patterns:
    - "Toolbar reads useRuntimeStore via narrow selectors (running, busy, poolSize, errorCount) + useFilesStore.order.length for the Optimize disabled rule"
    - "ARIA live region owned via setLiveRegion ref callback so non-React modules can announce()"
    - "subscribeWithSelector listener pattern: narrow selector → handler with curr/prev for quartile detection + batch-end transition"
    - "Sonner Toaster mounted once at App overlays; pushToast() shim routes legacy onToast props through toast()"
    - "Worker pool memoized with stable callbacks bound to runtime store actions"
    - "Test affordance window.__OIMG_SLOW_MS__ — App.tsx threads it into pool job settings.slowMs (gated by import.meta.env.DEV/MODE === 'test', tree-shaken from prod)"
    - "Vite worker.format='es' enables code-splitting of dynamic imports inside the worker"
    - "Playwright addInitScript path must point at .js (NOT .ts) — addInitScript does not transpile TypeScript syntax"

key-files:
  created:
    - "src/tests/fixtures/instrument-blob-urls.js"
  modified:
    - "src/App.tsx"
    - "src/components/shell/Toolbar.tsx"
    - "src/index.css"
    - "src/workers/stub-adapter.ts"
    - "src/tests/aria-live.spec.ts"
    - "src/tests/object-url.spec.ts"
    - "src/tests/worker-pool.spec.ts"
    - "vite.config.ts"
  removed:
    - "src/tests/fixtures/instrument-blob-urls.ts"

key-decisions:
  - "Codec UI state (codec/q/method/lossless/resizeOn/w/h/alg/fit/stripMeta/keepIcc/aggressive/plugins) STAYS in App.tsx local state. Plan offered the choice; only selectedId/running/toasts are MUST-MIGRATE in Phase 2. CodecPanel is not yet wired to a real codec — full migration to useSettingsStore deferred to Phase 5 panel work."
  - "pushToast helper RETAINED as a sonner shim. Plan acceptance criterion called for grep -c 'pushToast' === 0, but TitleBar (Phase 1 component) still consumes an onToast prop; renaming the callback throughout TitleBar would be out-of-scope for plan 02-04. Documented as a deviation; pushToast routes through toast() with description, preserving the visual contract via sonner."
  - "Toolbar Optimize disabled rule changed from `queueDepth === 0` (plan literal) to `fileCount === 0`. The plan literal was internally inconsistent: queueDepth (runtime FIFO queue) is always 0 BEFORE Optimize is clicked, so the button would never enable. The semantic intent is 'no files to optimize' which the files store order.length captures correctly. Verified through Playwright (button enables once files exist)."
  - "Replaced src/tests/fixtures/instrument-blob-urls.ts with .js. Plan 02-01 wrote it as TS, but Playwright's addInitScript({ path }) injects raw file contents into a <script> tag without transpilation — the TS type-cast syntax silently failed to parse, leaving __OIMG_URL_COUNTS__ undefined. The original file would have been caught only by a non-test.fail() VR-04 assertion."
  - "vite.config.ts worker.format='es'. Plan 02-03 documented the chunk-emission gate as deferred to 02-04, but did not flag the secondary requirement: once pool.ts is reachable from the entry tree, Vite tries to bundle worker.ts AND its dynamic adapter imports — which fails with the default 'iife' worker format ('UMD and IIFE output formats are not supported for code-splitting builds')."
  - "window.__OIMG_SLOW_MS__ test affordance. VR-02 (concurrency cap) and VR-03 (cancel correctness) need the otherwise-microsecond stub adapter to take observable time. Routed through the existing settings.slowMs hook in stub-adapter.ts via App.tsx's startOptimize. Gated behind import.meta.env.DEV/MODE === 'test' so the read is dead code in production (verified: 0 matches in dist/assets/*.js)."

requirements-completed: [PERF-01, PERF-03]
# PERF-01 (worker pool): structurally satisfied since plan 02-03; UI wiring + VR-01..VR-03 green close it.
# PERF-03 (progress UI + ARIA cadence): closed by VR-05 quartile cadence + indeterminate progbar guard from plan 01-04.
# PERF-02 (lazy-load codecs): structurally satisfied (stub-adapter is its own chunk; AVIF will lazy-import in Phase 5).

# Metrics
duration: 23min
completed: 2026-04-30
---

# Phase 2 Plan 04: UI Wiring Summary

**App.tsx + Toolbar wired to the new stores and worker pool — Workers pill, ARIA live region, sonner Toaster, Cmd+Enter/Cmd+. shortcuts, dev-only window store exposure. All 5 Wave 0 VR specs (VR-01..VR-05) flip from `test.fail()` stubs to live green; the deferred worker-chunk emission gate from plan 02-03 closes here via `vite.config.ts worker.format='es'`.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-04-30T16:19:36Z
- **Completed:** 2026-04-30T16:42:39Z
- **Tasks:** 2
- **Files created:** 1 (`src/tests/fixtures/instrument-blob-urls.js`)
- **Files modified:** 8
- **Files removed:** 1 (`src/tests/fixtures/instrument-blob-urls.ts`, replaced by .js sibling)

## Accomplishments

- Toolbar now subscribes to useRuntimeStore via narrow selectors (running, busy, poolSize, errorCount) + useFilesStore.order.length. Workers pill renders all 4 UI-SPEC §1 states with mono tabular-nums and an ARIA-correct `role="status" aria-live="off"` (the global live region in App.tsx owns announcements).
- App.tsx migrated `selectedId` to useFilesStore, `running` to useRuntimeStore, REMOVED the local `toasts` state. Sonner Toaster mounts at App overlays; the legacy `pushToast` helper is now a thin sonner shim that preserves Phase 1 child-component prop contracts.
- Real worker-pool batch dispatcher: `startOptimize` filters files-store entries by status, calls `useRuntimeStore.startBatch`, announces start, enqueues stub jobs into the pool, and routes pool results into `useFilesStore.markDone` (which revokes the OLD object URL before writing the new optimized blob — D-10 + Pitfall 3).
- Cancel handler with correct ordering (T-02-01 mitigation): `pool.cancel()` trips the AbortController BEFORE `useRuntimeStore.cancelBatch()` clears the in-flight set. Pool's onError fires for every in-flight + queued job; runtime store's cancel-race guard handles late-arriving markDone/markError.
- ARIA live region (`<div role="status" aria-live="polite" aria-atomic="true" sr-only>`) mounted at App overlays. setLiveRegion ref callback binds the DOM element so non-React modules can announce via @/lib/live-region.
- subscribeWithSelector listener emits exactly 5 announcements per 12-file batch (VR-05 contract): start + 3 quartile strides + final. Batch-end transition also fires the appropriate sonner toast (success/mixed/all-error).
- Cmd+Enter triggers Optimize; Cmd+. cancels (UI-SPEC §8). Both shortcuts are no-ops when target is an INPUT/TEXTAREA/contentEditable.
- Cmd+K palette: Optimize meta updated to `'Run worker pool · ⌘⏎'`. Cancel batch entry inserted into Actions group, conditionally visible only while `useRuntimeStore.running === true`.
- `window.__OIMG_STORES__` exposed in dev/test mode for Playwright store inspection (`useFilesStore`, `useSettingsStore`, `useRuntimeStore`). Verified absent from `dist/assets/*.js` (T-02-EXP threat closed).
- prefers-reduced-motion CSS guard added (UI-SPEC §4 + §9): `.file-status.processing` pulse and `.progbar > div` slide both honor the user preference.
- `vite.config.ts worker.format='es'`: production build now emits `worker-yLMyQuJU.js` (4.57 kB) AND `stub-adapter-DGDK3pfx.js` (0.15 kB) chunks, closing the deferred chunk-emission gate from plan 02-03.
- Wave 0 specs flipped from `test.fail()` to live assertions: VR-01 stub round-trip, VR-02 concurrency cap (≤ POOL_SIZE), VR-03 cancel correctness (<200ms transition), VR-04 URL leak parity (created === revoked + cached), VR-05 ARIA quartile cadence (exactly 5 updates) — ALL GREEN.
- Phase 1 regression preserved: `npx playwright test src/tests/shell.spec.ts` reports 11/11 PASS.

## Task Commits

1. **Task 1: Wire Toolbar — Workers pill + Optimize button + reduced-motion CSS guard** — `d3269f4` (feat)
2. **Task 2: Wire App.tsx — store migration, worker pool batch handler, ARIA live region, sonner Toaster, dev store exposure, Wave 0 spec activation** — `d970ec7` (feat)

## Files Created

- **`src/tests/fixtures/instrument-blob-urls.js`** (33 LOC) — Hand-written JS counterpart to the original TS instrumentation file. IIFE-style monkey-patch of `URL.createObjectURL` / `URL.revokeObjectURL` exposing counters on `window.__OIMG_URL_COUNTS__`. Replaces the TS sibling because Playwright `addInitScript({ path })` does not transpile TypeScript.

## Files Modified

- **`src/App.tsx`** — store + worker pool + live region + sonner wiring. New imports (`sonner`, `@/stores`, `@/workers/pool`, `@/workers/types`, `@/lib/live-region`). Removed `toasts` useState + `pushToast` legacy helper (replaced with sonner shim that satisfies child onToast props). New useEffects for live-region listener and dev store exposure. New keyboard handler for Cmd+Enter / Cmd+. Reorganized startOptimize/cancelBatch around the worker pool callbacks. Updated cmdGroups with the Optimize meta + Cancel batch entry. Replaced `<div className="toast-wrap">` JSX with `<Toaster position="bottom-right" />` and the sr-only live region div.
- **`src/components/shell/Toolbar.tsx`** — Subscribed to useRuntimeStore via narrow selectors. Added Workers pill between segmented view control and search input. Optimize button disabled rule moved from prop to store-derived state (running OR fileCount === 0). Settings popover Pool size value reads from poolSize selector instead of hardcoded `5`.
- **`src/index.css`** — Added `@media (prefers-reduced-motion: reduce)` block disabling `.file-status.processing` pulse and `.progbar > div` slide (UI-SPEC §4 + §9).
- **`src/workers/stub-adapter.ts`** — Added optional `slowMs` settings field for VR-02/VR-03 test injection. Production adapters MUST NOT implement slowMs; documented as a stub-only test affordance.
- **`src/tests/aria-live.spec.ts`** — Removed `test.fail()` markers. Live region presence test asserts `[role=status][aria-live=polite]` count = 1. 12-file batch test installs a MutationObserver, drops 12 synthetic blobs, clicks Optimize, asserts exactly 5 textContent updates with the expected substring sequence.
- **`src/tests/object-url.spec.ts`** — Removed `test.fail()` marker. Path resolution updated to `.js`. 4-file batch + getOrCreateObjectURL allocation + re-optimize flow validates `created === revoked + cacheSize` after the supersede pass.
- **`src/tests/worker-pool.spec.ts`** — Removed all 3 `test.fail()` markers. VR-01 asserts byte-exact round-trip in <500ms. VR-02 injects slowMs=100, observes inFlight via `useRuntimeStore.subscribe` selector + setInterval, asserts maxInFlight ∈ (0, POOL_SIZE]. VR-03 injects slowMs=1000, presses Cmd+. mid-batch, asserts running=false ∧ inFlight.size=0 within 200ms.
- **`vite.config.ts`** — Added `worker: { format: 'es' }` so dynamic imports inside `src/workers/worker.ts` ADAPTERS map can be code-split. Pairs with the `new Worker(new URL(...), { type: 'module' })` idiom in `src/workers/pool.ts`.

## Files Removed

- **`src/tests/fixtures/instrument-blob-urls.ts`** — Replaced by the `.js` sibling. The TS file's type-cast expressions (`as unknown as { ... }`) failed to parse when Playwright's addInitScript injected raw contents into a `<script>` tag, leaving `window.__OIMG_URL_COUNTS__` undefined. This was a latent defect in plan 02-01 hidden by VR-04's `test.fail()` marker.

## Decisions Made

- **Codec UI state stays local** — Plan 02-04 §B2 explicitly offered the choice: full migration to useSettingsStore vs. minimum migration (selectedId, running, toasts only). Chose minimum because the codec settings are not yet wired to a real codec — Phase 5 owns CodecPanel migration. Documented inline with `// Codec UI state — full migration to settings store deferred to Phase 5`.
- **pushToast helper retained as a sonner shim** — Plan acceptance gate `grep -c 'pushToast' === 0` would have required renaming `onToast` props throughout TitleBar.tsx + Toolbar.tsx. Out-of-scope for plan 02-04 (those are Phase 1 components). Shim is a 4-line wrapper that calls `toast(msg, { description: meta })` — visual contract preserved through sonner. Future plans may rename the callback when those components are revisited.
- **Toolbar Optimize disabled rule = `running || fileCount === 0`** instead of the plan-literal `running || queueDepth === 0`. The runtime FIFO queue is always 0 BEFORE Optimize is clicked, so the plan-literal would have made the button never enable. Files store `order.length` is the correct semantic source for "is there work to do".
- **Worker pool memoized with `useMemo([])`** — Plan offered "useMemo or module-level singleton call". Chose useMemo with an empty dep array because the pool callbacks reference store actions via getState() (no closure capture issue), and the memoization keeps the same pool reference for the component lifetime. The underlying `getWorkerPool` is itself a module-level singleton.
- **Live-region quartile listener uses subscribeWithSelector** — Plan code sample passes a selector function `(s) => ({ ... })` and a handler `(curr, prev) => { ... }`. Zustand v5's `subscribe` with the `subscribeWithSelector` middleware supports exactly this signature. The listener guards the batch-end branch with `curr.doneCount + curr.errorCount === curr.totalJobs` to distinguish a natural finish from a cancel transition (cancel emits its own announce/toast inline).
- **vite.config.ts `worker.format='es'`** — Required to fix a real build failure once `pool.ts` joins the entry tree. Plan 02-03 documented the chunk-emission deferral but did not flag this secondary requirement. Without `format: 'es'`, Vite's `worker-import-meta-url` plugin fails with 'UMD and IIFE output formats are not supported for code-splitting builds'.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Toolbar Optimize disabled rule used wrong source of truth**

- **Found during:** Task 2 verification (VR-05 aria-live test failed because the Optimize button was always disabled).
- **Issue:** Plan literal `disabled={running || queueDepth === 0}` used the runtime store's FIFO queue length. That queue is populated only WHILE a batch is dispatching — it is empty BEFORE Optimize is clicked, so the button would never enable.
- **Fix:** Switched to `useFilesStore((s) => s.order.length) === 0` as the "no files to optimize" gate. Same UX semantic as the plan intent.
- **Files modified:** `src/components/shell/Toolbar.tsx`
- **Committed in:** `d970ec7` (Task 2)

**2. [Rule 3 — Blocking] Vite production build failed with iife-vs-code-splitting error once pool.ts joined the entry tree**

- **Found during:** Task 2 verification (`npm run build`).
- **Issue:** Vite default `worker.format = 'iife'`. When `pool.ts` is imported by App.tsx, Vite traces `new Worker(new URL('./worker.ts', ...))` and tries to bundle the worker plus its dynamic imports — which iife cannot do. Build error: `Invalid value "iife" for option "worker.format" - UMD and IIFE output formats are not supported for code-splitting builds.`
- **Fix:** Added `worker: { format: 'es' }` to vite.config.ts. Pairs with the `{ type: 'module' }` already in pool.ts. Build now emits `worker-*.js` and `stub-adapter-*.js` chunks correctly.
- **Files modified:** `vite.config.ts`
- **Committed in:** `d970ec7` (Task 2)

**3. [Rule 3 — Blocking] Playwright addInitScript path could not parse TypeScript instrumentation file**

- **Found during:** Task 2 verification (VR-04 object-url test failed with `result.created === undefined`).
- **Issue:** Plan 02-01 wrote `src/tests/fixtures/instrument-blob-urls.ts` with TS type-cast expressions (`as unknown as { ... }`). Playwright's `addInitScript({ path })` injects raw file contents into a `<script>` tag without transpilation. The TS syntax silently failed to parse, leaving `window.__OIMG_URL_COUNTS__` undefined — and the VR-04 test.fail() marker hid the bug until plan 02-04 flipped the assertion.
- **Fix:** Created `src/tests/fixtures/instrument-blob-urls.js` (plain JS, no type casts). Updated `object-url.spec.ts` `INSTRUMENT_PATH` to point at the `.js` file. Removed the broken `.ts` sibling.
- **Files modified:** `src/tests/fixtures/instrument-blob-urls.js` (created), `src/tests/fixtures/instrument-blob-urls.ts` (deleted), `src/tests/object-url.spec.ts` (path update)
- **Committed in:** `d970ec7` (Task 2)

### Documented Deviations

**4. [Documented] pushToast helper retained**

- **Plan acceptance gate:** `grep -c 'pushToast' src/App.tsx returns 0 (helper removed)`
- **Actual:** `grep -c 'pushToast' src/App.tsx returns 14` — the helper is now a 4-line sonner shim, and 13 call sites in App.tsx + child component prop passes still invoke it.
- **Why no removal:** TitleBar.tsx + Toolbar.tsx are Phase 1 components that consume `onToast: (msg, meta) => void`. Renaming those prop contracts is out-of-scope for plan 02-04. The shim routes through `toast(msg, { description: meta })` — the visual contract is preserved via sonner's identical position/animation/duration defaults.
- **Carry-over:** Phase 5 panel migrations (or a dedicated cleanup plan) can replace the prop with direct sonner imports inside child components.

**5. [Documented] Codec settings stay in App.tsx local state**

- **Plan §B2 explicit choice:** "If migrating ALL codec settings is too invasive ... use the minimum migration: KEEP these as local state in App.tsx for Phase 2 if they are not yet wired to a real codec (Phase 5 owns full codec wiring)."
- **Actual:** All 13 codec-related useState hooks (codec/q/method/lossless/resizeOn/w/h/alg/fit/stripMeta/keepIcc/aggressive/plugins) remain as local state. Documented inline with `// Codec UI state — full migration to settings store deferred to Phase 5`.
- **Why:** CodecPanel/SvgoPanel are not yet driving real codecs; full migration would touch >100 lines of prop plumbing for no behavioral benefit in Phase 2.
- **Carry-over:** Phase 5 raster encoders plan owns the migration.

## Issues Encountered

- **VR-02 inFlight observation needed both store.subscribe AND setInterval polling** — A bare `setInterval(..., 5)` missed the in-flight transitions because Comlink resolves stub jobs in microseconds. Added `useRuntimeStore.subscribe(s => s.inFlight.size, ...)` for synchronous capture of every change. Belt-and-braces approach catches all transitions deterministically.
- **VR-03 cancel timing race** — Without slowMs, jobs complete before Cmd+. fires. Set slowMs=1000 so the worker is mid-sleep when the AbortController fires. The 200ms gate proves the cancel teardown (terminate + reject + cancelBatch) is synchronous within a microtask.
- **`window.__OIMG_SLOW_MS__` test affordance design** — Considered patching the worker pool from page context (`window.__OIMG_POOL__`) but that would require module-level state exposure that contradicts the gating story. Settled on a window flag that App.tsx reads at job-enqueue time, gated behind `import.meta.env.DEV/MODE === 'test'`. Tree-shaken from prod (verified: 0 matches in dist/assets/*.js).

## Threat Flags

None new. The existing threat register entries are now mitigated:

- **T-02-01 (cancel race)** — fully mitigated. Pool's `cancel()` aborts the controller + terminates workers + rejects pending in synchronous order; runtime store's `markDone`/`markError` guards (Plan 02-02) handle late-arrival no-ops. VR-03 asserts within 200ms.
- **T-02-02 (URL leak)** — fully mitigated. `useFilesStore.markDone` calls `revokeObjectURL` BEFORE writing the new blob; `removeFile` revokes BEFORE deletion. VR-04 asserts created === revoked + cached.
- **T-02-EXP (`__OIMG_STORES__` info disclosure)** — fully mitigated. Gated by `import.meta.env.DEV || import.meta.env.MODE === 'test'`. Verified absent from `dist/assets/*.js` (0 matches).

## Known Stubs

- **Codec UI state in App.tsx** — Codec settings useState hooks are not yet wired to a real codec (stub adapter ignores all settings except slowMs). UI shows the controls; the values do nothing functionally until Phase 5 raster encoders + Phase 3 SVG pipeline. Documented inline with the deferred migration comment. Not a stub that prevents the plan's goal — Phase 2's gate is "stub round-trip" which is now green.
- **`saved bytes` in batch-end announce + sonner toast** — Hard-coded to `'0 bytes'` because the stub adapter outputs the same byte count. Plan 02-04 §B7 explicitly notes "Phase 2 stub. Phase 3+ derives from filesStore optimizedSize delta." Not a defect; this is the documented Phase 2 acceptance gate ("0 bytes saved" UI-SPEC line 277).

## Next Plan Readiness

- **02-05 (Cleanup):** Has the full Phase 2 surface to verify and the `mock.ts` deletion target. Can run the final regression sweep (shell.spec.ts 11/11 + worker-pool 3/3 + object-url 1/1 + aria-live 2/2 = 17 tests). Should also remove the deprecated `running` prop on Toolbar (now ignored) once App.tsx stops passing it.
- **Phase 3 (SVG):** Has a clean adapter slot in `src/workers/worker.ts` ADAPTERS map. Replace the `'svg'` throw with `() => import('./svg-adapter')`. The pool, runtime store wiring, and live region all just work — Phase 3 only needs to swap the `'stub'` format reference in App.tsx's startOptimize for a per-FormatId picker.
- **Phase 5 (Raster encoders):** Same pattern as Phase 3. Each codec adapter is its own chunk; AVIF lazy-imports keep PERF-02 honored. Can also finally migrate the codec UI state to useSettingsStore now that real codec runs depend on those values.
- **Production build:** 283.21 kB initial / 86.79 kB gzipped — comfortably under the 200 KB initial-route budget.

## Self-Check: PASSED

Verification commands run, all GREEN:

- `test -f src/tests/fixtures/instrument-blob-urls.js` → FOUND
- `test ! -f src/tests/fixtures/instrument-blob-urls.ts` → CORRECT (deleted)
- `git log --oneline | grep d3269f4` → FOUND (Task 1 commit)
- `git log --oneline | grep d970ec7` → FOUND (Task 2 commit)
- `./node_modules/.bin/tsc -b` exits 0
- `npm run build` exits 0; emits `dist/assets/worker-yLMyQuJU.js` (4.57 kB) and `dist/assets/stub-adapter-DGDK3pfx.js` (0.15 kB)
- `awk '/__OIMG_STORES__/{c++} END{print c+0}' dist/assets/*.js` → 0 (T-02-EXP mitigated)
- `awk '/__OIMG_SLOW_MS__/{c++} END{print c+0}' dist/assets/*.js` → 0 (test affordance tree-shaken)
- `npx playwright test src/tests/shell.spec.ts` → 11/11 PASS (Phase 1 regression — VR-06)
- `npx playwright test src/tests/worker-pool.spec.ts src/tests/object-url.spec.ts src/tests/aria-live.spec.ts` → 6/6 PASS (VR-01 + VR-02 + VR-03 + VR-04 + 2 × VR-05)
- `awk '/role="status"/{c++} END{print c+0}' src/App.tsx` → 1 (single live region)
- `awk '/aria-live="polite"/{c++} END{print c+0}' src/App.tsx` → 1
- `awk '/getWorkerPool/{c++} END{print c+0}' src/App.tsx` → 2 (import + call)
- `awk '/setLiveRegion/{c++} END{print c+0}' src/App.tsx` → 3 (import + ref binder + comment ref)
- `awk '/announce\(/{c++} END{print c+0}' src/App.tsx` → 4 (start + cancel + interior + final)
- `awk '/__OIMG_STORES__/{c++} END{print c+0}' src/App.tsx` → 1
- `awk '/metaKey/{c++} END{print c+0}' src/App.tsx` → 3 (Cmd+K + Cmd+Enter + Cmd+.)
- `awk '/Cancel batch/{c++} END{print c+0}' src/App.tsx` → 3 (palette label + handler doc + cancel handler doc)
- `awk '/useRuntimeStore/{c++} END{print c+0}' src/components/shell/Toolbar.tsx` → 5 (import + 4 selectors)
- `awk '/prefers-reduced-motion: reduce/{c++} END{print c+0}' src/index.css` → 2 (comment + media query)

---
*Phase: 02-worker-harness-state*
*Completed: 2026-04-30*
