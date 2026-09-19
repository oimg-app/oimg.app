---
phase: 17-butteraugli-quality-metric
plan: 02
subsystem: metrics/lib
tags: [tdd, pure-lib, thresholds, direction-inversion, MTR-03]
requires: [17-01]
provides:
  - BUTTERAUGLI_BANDS constant (green=1.5, yellow=3.0)
  - butteraugliBand(v: number) => Band classifier
  - Strict-< direction-inversion baseline (labeled unit tests)
affects:
  - 17-05 ReportPanel (future consumer of BUTTERAUGLI_BANDS + butteraugliBand)
tech-stack:
  added: []
  patterns: [pure classifier, boundary-sweep tests, RED->GREEN TDD]
key-files:
  created: []
  modified:
    - src/lib/metrics-bands.ts
    - src/tests/metrics-bands.test.ts
decisions:
  - "Butteraugli classifier uses strict '<' (v < 1.5 => green, v < 3.0 => yellow, else red) — inverse of SSIM's inclusive '>='. Boundary at 1.5 flips DOWN to yellow; boundary at 3.0 flips DOWN to red. Test labels carry 'STRICT <' hint so a future editor cannot swap the operator without failing a labeled test."
  - "Reused existing Band type — no redeclaration. Pure lib file with zero imports."
metrics:
  duration_min: 4
  completed: 2026-07-20
  tasks_total: 2
  tasks_completed: 2
  commits: 2
---

# Phase 17 Plan 02: Butteraugli band thresholds + butteraugliBand() classifier + boundary-sweep unit tests — Summary

**One-liner:** Promoted `src/lib/metrics-bands.ts` Phase 17 hook comment into live `BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 }` + strict-`<` `butteraugliBand()` classifier, locked with 8 explicit boundary-sweep assertions labeled to enforce direction-inversion vs. SSIM.

## Delivered

**metrics-bands.ts — exports (before → after):**
- Before: `Band` (type), `SSIM_BANDS`, `ssimBand`  (Phase 17 hook was a dormant comment on lines 20-21)
- After:  `Band` (type), `SSIM_BANDS`, `ssimBand`, **`BUTTERAUGLI_BANDS`**, **`butteraugliBand`**

**metrics-bands.test.ts — assertions:**
- Before: 7 SSIM assertions (2 constants + 5 boundary sweep)
- After: 19 total (7 SSIM + 2 BUTTERAUGLI_BANDS constants + 10 butteraugliBand boundary sweep incl. inverse-direction boundary labels)

## Test-run output (GREEN)

```
$ node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/metrics-bands.test.ts
19 passed, 0 failed
EXIT=0
```

## TDD Gate Compliance

| Gate    | Commit    | Message |
|---------|-----------|---------|
| RED     | `18f3c2d` | `test(phase-17): red-phase — butteraugliBand boundary sweep + BUTTERAUGLI_BANDS asserts` |
| GREEN   | `f77378c` | `feat(phase-17): green-phase — BUTTERAUGLI_BANDS + butteraugliBand() classifier` |
| REFACTOR | — | not needed — 4-line pure function |

RED verified: `TypeError: Cannot read properties of undefined (reading 'green')` at line 57 of test — confirming symbol was missing from lib before GREEN.

## Threat register mitigations applied

| Threat ID | Mitigation | Evidence |
|-----------|-----------|----------|
| T-17-02-01 (Tampering, constant drift) | Unit tests assert `BUTTERAUGLI_BANDS.green === 1.5` and `.yellow === 3.0` verbatim | 2 constant-assertion cases pass |
| T-17-02-02 (Direction-inversion) | 1.5 and 3.0 boundary tests labeled "STRICT <" | `grep -c "STRICT <" src/tests/metrics-bands.test.ts` = 2 |

## Deviations from Plan

None — plan executed exactly as written. Grep gates all pass, test count matches expected totals.

## Notes on baseline build

`npm run build` exits non-zero due to PRE-EXISTING type debt (CLAUDE.md documents this): `src/tests/stores.test.ts` missing `stageBg` property on `UiState` (Phase 15 debt) and `src/tests/ssim-metric.spec.ts` `/src/...` Vite dynamic-import pattern. Plus `src/workers/metrics.worker.ts:38` `getVisDif` unused — owned by sibling executor Plan 17-03. **Zero new errors from Plan 17-02 files** (`metrics-bands.ts` + `metrics-bands.test.ts` both clean).

## Self-Check: PASSED

- `src/lib/metrics-bands.ts` present, contains new exports (verified via grep)
- `src/tests/metrics-bands.test.ts` present, contains new assertions
- Commits `18f3c2d` (RED) and `f77378c` (GREEN) exist in `git log`
- Test runner exits 0 with 19/19 pass

## Next

Plan 17-03 (sibling executor, in-flight) will wire `metrics.worker.ts` visdif output into per-file butteraugli scoring; Plan 17-05 will consume `BUTTERAUGLI_BANDS`/`butteraugliBand` in ReportPanel for banded coloring.
