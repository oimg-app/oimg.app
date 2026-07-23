---
phase: 17-butteraugli-quality-metric
verified: 2026-07-23T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps: []
scope_deviation_approved:
  original: "Hand-built Emscripten wasm Butteraugli (REQUIREMENTS.md MTR-02 verbatim)"
  actual: "@squoosh-kit/visdif@0.2.4 — Squoosh's canonical Butteraugli, publisher continuity with @squoosh-kit/imagequant"
  approved_by: user
  approved_at: 2026-07-20
  note: "ROADMAP.md §Scope note (2026-07-20) documents user approval; matches Phase 16's ssim.js pattern; no Emscripten CI burden."
---

# Phase 17: Butteraugli Quality Metric — Verification Report

**Phase Goal:** Land real perceptual quality measurement via `@squoosh-kit/visdif@0.2.4`; lazy-loaded; runs alongside SSIM in the metrics worker.
**Verified:** 2026-07-23
**Status:** passed
**Re-verification:** No — initial verification

## Success Criteria (Goal-Backward)

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `@squoosh-kit/visdif@0.2.4` installed; `createVisDiff('client')` — same in-worker pattern as `createImagequantQuantizer('client')` | PASS | `package.json` pins `"@squoosh-kit/visdif": "0.2.4"`; `metrics.worker.ts:60-61` `const { createVisDiff } = await import('@squoosh-kit/visdif'); const rawCompare = createVisDiff('client')`. Grep: `createVisDiff('client')` = 1, `createVisDiff('worker')` = 0. |
| 2 | Butteraugli auto-computes alongside SSIM for selected `done` file; cached on `FileEntry.metrics.butteraugli`; refreshes on re-encode via Phase 16 invalidation | PASS | `useMetricsAuto.ts:82-89` dispatches `computeSSIM` + `computeButteraugli` under `Promise.allSettled`; `setFileMetric(fileId, 'butteraugli', …)` at line 107. `settings.ts:28` widens `metrics?: { ssim?…; butteraugli?… }`. `files.ts:161` `setFileResult` writes `metrics: undefined` (wipes both atomically). |
| 3 | Report panel renders Butteraugli with banded coloring green < 1.5, yellow < 3.0, red ≥ 3.0; thresholds in `BUTTERAUGLI_BANDS` | PASS | `metrics-bands.ts:20` `BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 }`; `metrics-bands.ts:26-30` strict `<` classifier; `ReportPanel.tsx:19` imports; line 222/233 use `BUTTERAUGLI_BANDS.green`/`.yellow` — zero magic literals. 19/19 boundary sweep asserts pass. |
| 4 | Initial bundle budget (200 KB gzipped) preserved — visdif wasm NOT in initial chunk | PASS | `build.test.ts` output: `Initial JS gzip total: 197.2 KB (budget: 200 KB)` (2.8 KB headroom). `VISDIF_HOIST_SENTINEL='VisDiff'` absence check passes; positive-presence `hasVisdifChunk` finds 14 chunked files under `dist/squoosh-kit/visdif/`. |
| 5 | `versionsAtom.butteraugli.buildHash` reads `BUILD_VERSIONS.butteraugli` via `readVer('@squoosh-kit/visdif')` | PASS | `vite.config.ts:63` `butteraugli: readVer('@squoosh-kit/visdif')`; `vite.config.ts:149` `__BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli)`; `versions.ts:49-50` non-optional `butteraugli: { buildHash: … }`; `versions.test.ts` — 22/22 pass including 4 new semver asserts. |

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| MTR-02 | 17-01, 17-03, 17-04, 17-05 | Butteraugli integrated post-`done`, cached on `FileEntry.metrics.butteraugli`, lazy-loaded | SATISFIED | Full worker (`computeButteraugli`) + hook (parallel dispatch) + Report row + separate dist chunk (see SC-1/2/4). |
| MTR-03 | 17-02, 17-05 | Banded coloring with documented thresholds | SATISFIED | `BUTTERAUGLI_BANDS` constants + `butteraugliBand()` classifier consumed in ReportPanel (see SC-3). |

## Test Suite Results

| Test | Command | Result |
|---|---|---|
| Vite build | `./node_modules/.bin/vite build` | exit 0 (`built in 3.82s`; PWA `precache 66 entries`) |
| versions unit | `node --experimental-strip-types … src/tests/versions.test.ts` | exit 0 (22 passed / 0 failed) |
| metrics-bands unit | `… src/tests/metrics-bands.test.ts` | exit 0 (19 passed / 0 failed) |
| stores unit | `… src/tests/stores.test.ts` | exit 0 (76 passed / 0 failed) |
| build/bundle unit | `… src/tests/build.test.ts` | exit 0 — initial route 197.2 KB gzip; VisDiff hoist sentinel absent; visdif chunk present |
| butteraugli e2e | `npx playwright test src/tests/butteraugli-metric.spec.ts` | exit 0 (PASS 4 / FAIL 0, 154s) |
| ssim regression e2e | `npx playwright test src/tests/ssim-metric.spec.ts` | exit 0 (PASS 3 / FAIL 0, 154s) |

## Discipline Gates

| Gate | Requirement | Evidence |
|---|---|---|
| PIPE-02 dynamic import | `@squoosh-kit/visdif` only inside async fn | `metrics.worker.ts:60` `await import('@squoosh-kit/visdif')` inside `getVisDif()`; 0 top-level visdif imports; only Comlink hoisted. |
| WR-02 update funnel | `setFileMetric` uses `updateEntry` | `files.ts:148-149` `setFileMetric<K …>` calls `updateEntry(id, e => ({ metrics: { ...(e.metrics ?? {}), [key]: value }}))`. |
| CR-02 single seqRef | ONE seqRef guards both SSIM + Butteraugli | `useMetricsAuto.ts:31` single `useRef(0)`; `:56` `const seq = ++seqRef.current`; `:93` single `if (seq !== seqRef.current) return` covers both write branches. |
| Direction inversion | Strict `<` (not `>=`) in BUTTERAUGLI_BANDS classifier | `metrics-bands.ts:27-28` `v < BUTTERAUGLI_BANDS.green` / `.yellow`. Boundary-sweep tests labeled "STRICT <". |
| No magic numbers in ReportPanel | `1.5` / `3.0` literals absent from JSX | Only matches for `1.5`/`3.0` in ReportPanel.tsx are Tailwind class fragments (`gap-1.5`, `py-1.5`); band displays reference `BUTTERAUGLI_BANDS.green`/`.yellow`. |
| Four-slice buffer discipline | Exactly 4 `.slice(0)` in useMetricsAuto.ts | Verified: lines 64-67 — `rawForSSIM`, `encForSSIM`, `rawForBut`, `encForBut`. |
| Client-mode visdif | `createVisDiff('client')` never `'worker'` | Grep: 1 vs 0. |
| Bundle isolation | VisDiff sentinel absent / visdif chunk present in dist/ | `build.test.ts` output: "visdif body absent from initial-route chunks … PASS"; positive chunk-presence PASS. |
| Rogue onmessage disarm | wrap-and-null pattern present | `metrics.worker.ts:83-93` `disarm()` fn nulls `self.onmessage`; `wrappedCompare` calls it in `finally`. Documented Rule 1 auto-fix survived. |

## Anti-Patterns Scanned

No blockers. No stubs. No debt markers (`TBD`/`FIXME`/`XXX`) in phase-modified files. `PLACEHOLDER`/"not yet implemented" strings absent. Every render path reads real metric data (via `selected.metrics.butteraugli` — number/null/undefined trio → banded score / "N/A" / "Computing…").

## Deferred Items

None. All 5 success criteria are satisfied end-to-end in the codebase.

## Notes on Non-Trivial Auto-Fixes (from 17-05 SUMMARY)

- **Rule 3 auto-fix** — `@squoosh-kit/visdif@0.2.4` ships a Node-only Emscripten glue (`visdif.js` w/ `ENVIRONMENT_IS_NODE=true`). Shim `__dirname='/'` + `process={argv:[],exit:()=>{}}` on `globalThis` added in `metrics.worker.ts:48-57` before dynamic import. Verified in-place.
- **Rule 1 auto-fix** — visdif installs `self.onmessage = handler` on first `compare()` (via `Promise.resolve().then(init_visdif_worker)`), poisoning Comlink's message channel. Wrapper `disarm()` nulls it after each compare (`metrics.worker.ts:83-93`). Necessity re-proved by e2e thrash test in `butteraugli-metric.spec.ts` (PASS).

## Scope Deviation (User-Approved)

REQUIREMENTS.md MTR-02 originally prescribed a "hand-built wasm Butteraugli (Emscripten compile of Google libjxl's butteraugli comparator)". Implementation uses `@squoosh-kit/visdif@0.2.4` — the same publisher as our existing `@squoosh-kit/imagequant@0.2.4`, wrapping Squoosh's canonical Butteraugli binary. Deviation documented in ROADMAP.md §"Scope note (2026-07-20)" with rationale: dramatically simpler, mirrors Phase 16's ssim.js pattern, no Emscripten toolchain, no CI reproducibility burden. Semantic MTR-02 goal ("real perceptual distance, cached, lazy-loaded, refresh on re-encode") fully achieved.

## Recommendation

**Proceed to `/gsd-complete-milestone v1.2`.**

All 5 success criteria pass. All 7 test commands exit 0. All 9 discipline gates hold. Bundle budget: 197.2 KB gzip / 200 KB (2.8 KB headroom). MTR-02 + MTR-03 satisfied end-to-end.

---

_Verified: 2026-07-23_
_Verifier: Claude (gsd-verifier)_
