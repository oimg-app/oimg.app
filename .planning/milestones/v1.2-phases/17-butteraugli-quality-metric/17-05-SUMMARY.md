---
phase: 17-butteraugli-quality-metric
plan: 05
subsystem: metrics/report
tags: [butteraugli, visdif, report-panel, e2e, bundle-budget]
requires:
  - @/lib/metrics-bands (17-02 — BUTTERAUGLI_BANDS + butteraugliBand)
  - @/lib/settings (17-03 — FileEntry.metrics.butteraugli)
  - @/hooks/useMetricsAuto (17-04 — parallel SSIM + Butteraugli dispatch)
  - @squoosh-kit/visdif@0.2.4 (17-01 — pinned)
provides:
  - Banded Butteraugli row in ReportPanel Quality Section (MTR-03 UI)
  - e2e coverage: happy / parallel / thrash / SVG-N/A (MTR-02 flow)
  - Bundle-budget guard: VisDiff hoist-sentinel + visdif-chunk positive-presence check
affects:
  - src/components/panels/inspector/ReportPanel.tsx
  - src/workers/metrics.worker.ts (visdif rogue-handler disarm)
  - src/tests/build.test.ts
  - src/tests/butteraugli-metric.spec.ts (new)
tech-stack:
  added: []
  patterns:
    - "IDL-attribute reset (`self.onmessage = null`) to disarm rogue `addEventListener`-style
       message handlers installed by @squoosh-kit packages, preserving Comlink's parallel
       `addEventListener('message', ...)` listener."
key-files:
  created:
    - src/tests/butteraugli-metric.spec.ts
  modified:
    - src/components/panels/inspector/ReportPanel.tsx
    - src/workers/metrics.worker.ts
    - src/tests/build.test.ts
decisions:
  - "Wrap `createVisDiff('client')` return with a compare shim that nulls `self.onmessage`
     in `finally { ... }`. Nulling immediately after `createVisDiff` is insufficient:
     `init_visdif_worker()` (which installs the handler) is deferred via
     `Promise.resolve().then(...)` to the first `compare()` call — the earliest safe point
     is after each compare, before the next worker message arrives."
  - "Use 32×32 checker RGBA PNG fixture (not Phase-16's 16×16 solid-blue). visdif's
     frequency-domain analysis rejects too-small / zero-variance tiles."
metrics:
  duration: ~90m
  completed: 2026-07-23
tasks:
  - T-17-05-01: ReportPanel Quality Section extended with banded Butteraugli row + direction-hint caption
  - T-17-05-02: butteraugli-metric.spec.ts (happy + parallel + thrash + svg-N/A)
  - T-17-05-03: build.test.ts extended with VisDiff hoist-sentinel + visdif chunk positive-presence
requirements:
  - MTR-02
  - MTR-03
---

# Phase 17 Plan 05: ReportPanel banded Butteraugli row + Playwright e2e + build.test visdif assertions Summary

Ships the visible surface of Butteraugli MTR-03 into the Quality Section that Phase 16 introduced. Adds a second banded row with `data-testid="butteraugli-row"` / `data-testid="butteraugli-score"` / `data-band` attributes for stable e2e selectors. Replaces the single-line SSIM caption with a three-line block whose first line disambiguates direction (SSIM higher-better vs. Butteraugli lower-better). Adds a Playwright spec cloned from `ssim-metric.spec.ts` with one Phase-17-specific test (parallel dispatch proves both metrics fire under a single seqRef). Extends `build.test.ts` with two new bundle invariants: `VisDiff` sentinel absent from initial-route chunks, and a positive-presence check that walks `dist/` for a `visdif`-named file.

## Task Results

| Task | Files | Commit(s) | Notes |
|------|-------|-----------|-------|
| T-17-05-01 | src/components/panels/inspector/ReportPanel.tsx | c946beb | Committed prior to this executor session; verified in place. |
| T-17-05-02 | src/tests/butteraugli-metric.spec.ts (new) | 045a150 | Cloned from ssim-metric.spec.ts with global identifier swaps + parallel-dispatch test. 32×32 checker PNG fixture. |
| T-17-05-03 | src/tests/build.test.ts | e703cce | Extended with VISDIF_HOIST_SENTINEL absence check + recursive dist/ walk for hasVisdifChunk. Preserves all Phase 16 assertions. |

## Verification

- `./node_modules/.bin/vite build` → exit 0
- `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/build.test.ts` → **PASS**
  - Initial route JS gzip: **197.2 KB** (budget 200 KB — 2.8 KB headroom)
  - Metrics-worker chunk: `metrics.worker-BgkoSEdB.js` (7.1 KB)
  - SSIM chunk: `ssim.web-ZbAMM8G6.js` (17.4 KB)
  - Visdif chunks emitted (all under `dist/squoosh-kit/visdif/`):
    - `bridge.d.ts`, `bridge.d.ts.map`
    - `index.browser.mjs` (9.4 KB), `index.browser.mjs.map`
    - `index.d.ts`, `index.d.ts.map`
    - `types.d.ts`, `types.d.ts.map`
    - `visdif.worker.browser.mjs` (15.3 KB), `visdif.worker.browser.mjs.map`
    - `visdif.worker.d.ts`, `visdif.worker.d.ts.map`
    - `wasm/visdif/visdif.js`, `wasm/visdif/visdif.wasm`
- `npx playwright test src/tests/butteraugli-metric.spec.ts` → **4/4 PASS** (154 s wall-clock)
- `npx playwright test src/tests/ssim-metric.spec.ts` → **3/3 PASS** (154 s; no regression)

## ReportPanel screenshot description

For a done PNG (identical raw/encoded bytes): Quality Section renders TWO metric rows separated by `mt-2` vertical breathing room:

- **SSIM** label (uppercase mono, small) with score `1.000` in accent-green (Green ≥ 0.95).
- **Butteraugli** label with score `0.00` in accent-green (Green < 1.5).
- Caption below (three lines, small mono):
  - Line 1 (direction hint): `SSIM: higher is better · Butteraugli: lower is better`
  - Line 2 (SSIM bands): `SSIM: Green ≥ 0.95 · Yellow ≥ 0.85 · Red below.`
  - Line 3 (Butteraugli bands): `Butteraugli: Green < 1.5 · Yellow < 3 · Red above.`

For a done SVG: entire Quality Section is absent (SVG-N/A gate; unchanged from Phase 16).

## Deviations from Plan

### Rule 3 auto-fix — visdif Node-only wasm glue shim

**Found during:** T-17-05-02 first run.
**Issue:** `@squoosh-kit/visdif@0.2.4` ships an Emscripten WASM glue (`visdif.js`) with `ENVIRONMENT_IS_NODE=true` hardcoded. Its top-level module init reads `__dirname` and `process.argv` — undefined in a browser Web Worker context — so the dynamic `import(jsPath)` throws before any code runs.
**Fix:** Added bare `__dirname='/'` + `process={argv:[],exit:()=>{}}` shims on `globalThis` before the visdif dynamic import in `metrics.worker.ts::getVisDif()`. The Node fs/path branches are never *executed* because the wrapper passes `wasmBinary` directly.
**Files modified:** `src/workers/metrics.worker.ts`
**Commit:** `fb25307 fix(17-05): shim __dirname/process for @squoosh-kit/visdif Node-only wasm glue` (committed early in executor session)

### Rule 1 auto-fix — visdif rogue self.onmessage disarm

**Found during:** T-17-05-02 thrash test failure investigation (deep dive of ~2 h).
**Issue:** Even after T-17-05-01/T-17-05-02 landed, the thrash test failed because `worker.computeSSIM/computeButteraugli` resolved to `undefined` for the second-selected file. Diagnosis via worker-side `postMessage` interception revealed a rogue response `{id, ok:false, error:"Unknown message type: APPLY"}` posted synchronously BEFORE Comlink's real response arrived. Comlink's `pendingListeners` map resolves-and-deletes on the first message matching the id, so the malformed response wins and `fromWireValue` returns `undefined` (no `type` field). Root cause: `@squoosh-kit/visdif@0.2.4`'s `VisDifClientBridge.compare` defers `init_visdif_worker()` via `Promise.resolve().then(...)`, and `init_visdif_worker()` installs `self.onmessage = handler` that intercepts EVERY worker message.
**Fix:** Wrapped `createVisDiff('client')`'s returned compare function in a shim that nulls `self.onmessage` in `finally { ... }` after every call. Comlink's `addEventListener('message', ...)` listener is unaffected (they're independent event surfaces). Client-mode `visdifCompareClient(...)` doesn't rely on postMessage-loopback, so no functionality is lost. Nulling immediately after `createVisDiff` is insufficient — `init_visdif_worker()` runs on FIRST compare(), so the earliest safe disarm point is after each compare, before the next worker message arrives.
**Files modified:** `src/workers/metrics.worker.ts`
**Commit:** `a560005 fix(17-05): wrap visdif compare() to disarm its rogue self.onmessage handler`

### Fixture size change

**Found during:** T-17-05-02 initial run.
**Issue:** Phase 16's 16×16 solid-blue PNG fixture passes ssim.js but returns null through visdif — Butteraugli's frequency-domain analysis rejects too-small / zero-variance tiles.
**Fix:** Switched fixture to 32×32 4-px checker PNG (~139 bytes). Both SSIM (≈1.0) and Butteraugli (≈0.0) land in green band for identical raw/encoded bytes.
**Files modified:** `src/tests/butteraugli-metric.spec.ts` (BLUE_PNG_B64 constant)
**Commit:** included in `045a150`

## Threat Flags

None — the visdif-handler-disarm patch stays within the metrics worker's own global scope; no new network surface, no schema change, no new file-system access. The threat register's `T-17-05-01` (bundle-budget regression) is now positively guarded by the `VisDiff` sentinel + `hasVisdifChunk` check in `build.test.ts`.

## Known Stubs

None. All display paths are wired to real metric data.

## Self-Check: PASSED

- **File assertions** (`ls`):
  - `src/components/panels/inspector/ReportPanel.tsx` — FOUND
  - `src/tests/butteraugli-metric.spec.ts` — FOUND
  - `src/tests/build.test.ts` — FOUND
  - `src/workers/metrics.worker.ts` — FOUND
- **Commit hash assertions** (`git log --oneline --all | grep`):
  - `c946beb` (T-17-05-01) — FOUND
  - `fb25307` (Rule 3 auto-fix) — FOUND
  - `045a150` (T-17-05-02) — FOUND
  - `a560005` (Rule 1 auto-fix) — FOUND
  - `e703cce` (T-17-05-03) — FOUND
- **Grep-gate assertions** (from PLAN acceptance criteria):
  - `grep -c "butteraugliBand, BUTTERAUGLI_BANDS" src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c 'data-testid="butteraugli-score"' src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c 'data-testid="butteraugli-row"' src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c "toFixed(2)" src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c "toFixed(3)" src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c "BUTTERAUGLI_BANDS.green" src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c "SSIM: higher is better · Butteraugli: lower is better" src/components/panels/inspector/ReportPanel.tsx` = 1 ✓
  - `grep -c "VISDIF_HOIST_SENTINEL" src/tests/build.test.ts` ≥ 2 ✓
  - `grep -c "'VisDiff'" src/tests/build.test.ts` ≥ 1 ✓
  - `grep -c "computeButteraugli" src/tests/build.test.ts` = 0 ✓ (Pitfall 6 respected)
  - `grep -c "200 \* 1024" src/tests/build.test.ts` ≥ 1 ✓ (budget preserved)
  - `grep -c "bezkrovny" src/tests/build.test.ts` ≥ 1 ✓ (Phase 16 sentinel preserved)
