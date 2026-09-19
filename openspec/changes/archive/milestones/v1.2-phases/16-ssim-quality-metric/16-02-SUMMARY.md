---
phase: 16-ssim-quality-metric
plan: 02
subsystem: metrics-bands
tags: [tdd, ssim, thresholds, css-tokens]
requires: [16-01]
provides: [SSIM_BANDS, ssimBand, Band, --color-error]
affects: [16-03, 16-05]
tech_stack_added: []
patterns_used: [tiny-pure-lib, boundary-sweep-unit-test, phase-provenance-comment]
key_files_created:
  - src/lib/metrics-bands.ts
  - src/tests/metrics-bands.test.ts
key_files_modified:
  - src/index.css
decisions:
  - "SSIM_BANDS uses `as const` so consumers see literal-type thresholds (0.95 | 0.85), not widened number."
  - "`>=` inclusive at both boundaries (0.95 → green, 0.85 → yellow); documented in ssimBand() JSDoc."
  - "Added --color-error as new token (not alias) matching --color-err oklch value at each theme; separate identity preserves 16-05 semantic call site while --color-err retains destructive-alias consumers."
  - "Phase 17 BUTTERAUGLI_BANDS left as commented placeholder — same file, lower-is-better semantics documented."
metrics:
  duration_min: 12
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  commits: 3
completed_date: 2026-07-19
requirements_completed: [MTR-03]
---

# Phase 16 Plan 02: SSIM band thresholds library + boundary unit tests Summary

Isolate MTR-03's verbatim SSIM thresholds (0.95 green / 0.85 yellow / red below) into a tiny pure-utility module with a boundary-sweep unit test, and add the `--color-error` CSS token that 16-05's ReportPanel will consume for the red band.

## What shipped

- **`src/lib/metrics-bands.ts`** — new pure-utility module exporting:
  - `type Band = 'green' | 'yellow' | 'red'`
  - `const SSIM_BANDS = { green: 0.95, yellow: 0.85 } as const`
  - `function ssimBand(v: number): Band` — `>=` inclusive at both boundaries
  - Commented Phase 17 hook line for `BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 } as const`
  - Zero imports, zero I/O, no default export.
- **`src/tests/metrics-bands.test.ts`** — new Node-runner unit test covering 9 assertions:
  - 2 verbatim threshold assertions (`SSIM_BANDS.green === 0.95`, `.yellow === 0.85`)
  - 7 boundary/mid-band cases for `ssimBand` (`1.0`, `0.95`, `0.9499`, `0.90`, `0.85`, `0.8499`, `0`)
  - Type-side assertion via `ReturnType<typeof ssimBand>` (no unused-alias warning)
- **`src/index.css`** — added `--color-error` in both light `:root` (line 59) and dark `.dark` (line 130) palette blocks, adjacent to `--color-warn` and matching the existing `--color-err` oklch value at each theme's lightness/chroma.

## Task timeline

| Task | Type | Commit | Result |
|------|------|--------|--------|
| T-16-02-01 (RED) | test | `05ea6ad` | Failing spec — `ERR_MODULE_NOT_FOUND` for `@/lib/metrics-bands` |
| T-16-02-02 (GREEN) | feat | `2130425` | Implementation — 9 passed, 0 failed |
| T-16-02-03 | feat | `0fa01f6` | `--color-error` added to both themes |

## Verification

- `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/metrics-bands.test.ts` → `9 passed, 0 failed` (exit 0)
- `./node_modules/.bin/vite build` → `✓ built in 3.61s` (no CSS parse errors, PWA generation succeeded)
- `tsc -b` source-file error count: 11 (all pre-existing `src/tests/stores.test.ts` "Property 'stageBg' is missing" — baseline debt inherited from 16-01, unchanged by this plan)
- Grep gates:
  - `grep -c "ssimBand" src/tests/metrics-bands.test.ts` → 16 (≥ 8 required)
  - `grep -c "SSIM_BANDS" src/tests/metrics-bands.test.ts` → 5 (≥ 2 required)
  - `grep -c "export" src/lib/metrics-bands.ts` → 4 (≥ 3 required)
  - `grep -c "^import" src/lib/metrics-bands.ts` → 0 (= 0 required)
  - `grep -cF "SSIM_BANDS = { green: 0.95, yellow: 0.85 } as const" src/lib/metrics-bands.ts` → 1 (= 1 required)
  - `grep -c "BUTTERAUGLI_BANDS" src/lib/metrics-bands.ts` → 1 (≥ 1 required)
  - `grep -cE "\-\-color-error" src/index.css` → 2 (both themes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed unused `_Band` type alias in test**
- **Found during:** Task 2 GREEN verification via `npm run build`.
- **Issue:** Initial RED test used `type _Band = import('@/lib/metrics-bands').Band` to assert the exported type name — but `tsc -b` flagged `_Band` as declared-but-never-used (new source-file error).
- **Fix:** Replaced with `const _bandCheck: ReturnType<typeof ssimBand> extends 'green' | 'yellow' | 'red' ? true : never = true; void _bandCheck` — same type-side assertion, no unused-alias warning, and the Node runner erases the `void _bandCheck` no-op.
- **Files modified:** `src/tests/metrics-bands.test.ts`.
- **Commit:** `2130425` (folded into GREEN commit).

None of the plan's task actions or acceptance criteria required changes; both stayed satisfied.

## Coordination note (sibling executor)

Sibling executor was running plan 16-03 in parallel. Confirmed:
- No overlap with `files_modified`: this plan touched only `src/lib/metrics-bands.ts` (NEW), `src/tests/metrics-bands.test.ts` (NEW), `src/index.css` (2 additive lines).
- `--color-err` was preserved (existing consumers via `--destructive` and `--err` aliases stay green); `--color-error` is a new token, not a rename.
- All commits landed on `main` without conflict.

## Known Stubs

None. Every export is fully implemented and covered by the unit test.

## Threat Flags

None. Pure library + CSS additive token. No I/O, no user input, no build-time inject.

## Self-Check: PASSED

- `[ -f src/lib/metrics-bands.ts ]` → FOUND
- `[ -f src/tests/metrics-bands.test.ts ]` → FOUND
- `git log --oneline --all | grep -q 05ea6ad` → FOUND (RED commit `test(phase-16): red-phase — add failing spec for SSIM band thresholds`)
- `git log --oneline --all | grep -q 2130425` → FOUND (GREEN commit `feat(phase-16): green-phase — implement SSIM band thresholds library`)
- `git log --oneline --all | grep -q 0fa01f6` → FOUND (CSS commit `feat(phase-16): add --color-error CSS token for SSIM red band`)
- `--color-error` present in both light and dark palette blocks of `src/index.css` → CONFIRMED

## TDD Gate Compliance

- RED gate: commit `05ea6ad` — `test(phase-16): red-phase — …`
- GREEN gate: commit `2130425` — `feat(phase-16): green-phase — …` (after RED, verified fails-then-passes)
- REFACTOR gate: not required (implementation was minimal; no additional cleanup needed).
