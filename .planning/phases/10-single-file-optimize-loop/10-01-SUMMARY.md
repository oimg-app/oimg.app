---
phase: 10-single-file-optimize-loop
plan: "01"
subsystem: tests
tags: [playwright, fixtures, wave-0, nyquist, tdd, d-05-migration]
dependency_graph:
  requires: []
  provides:
    - src/tests/fixtures/ingest-helper.ts (ingestFixtureFiles helper)
    - src/tests/ingest.spec.ts (OPT-01 SC-1/2/3 + D-04 + D-06/D-07 validation contract)
  affects:
    - src/tests/inspector-tabs.spec.ts
    - src/tests/per-file-settings.spec.ts
    - src/tests/navigation.spec.ts
    - src/tests/backpressure.spec.ts
tech_stack:
  added: []
  patterns:
    - page.evaluate store injection via dynamic import('/src/stores/files.ts')
    - files-pane scoped selectors to avoid strict-mode ambiguity on multi-pane filename display
key_files:
  created:
    - src/tests/fixtures/ingest-helper.ts
    - src/tests/ingest.spec.ts
  modified:
    - src/tests/inspector-tabs.spec.ts
    - src/tests/per-file-settings.spec.ts
    - src/tests/navigation.spec.ts
    - src/tests/backpressure.spec.ts
decisions:
  - Scope file-name clicks to getByTestId('files-pane') because the filename renders in 3 panes simultaneously (files-pane list, center-pane header, inspector pane)
  - output-panel.spec.ts required no D-05 migration (no seed-file name references found)
metrics:
  duration: "~13m"
  completed: "2026-05-28T12:41:42Z"
  tasks_completed: 3
  files_changed: 6
---

# Phase 10 Plan 01: Wave 0 Test Scaffolding Summary

Playwright fixture helper + ingest spec written FIRST (Nyquist); 5 existing specs migrated off the seeded demo list to use injected fixtures.

## What Was Built

**Task 1 — ingestFixtureFiles helper** (`src/tests/fixtures/ingest-helper.ts`): exports `ingestFixtureFiles(page, n)` which injects `n` synthetic `FileEntry` objects (1×1 PNG bytes decoded from TINY_PNG_B64) directly into `filesAtom` via `page.evaluate`. Deterministic IDs `fixture-${i}`, monotonic `createdAt` for stable queue-order sort. Typechecks clean.

**Task 2 — ingest.spec.ts** (`src/tests/ingest.spec.ts`): 5-test spec covering the full OPT-01 validation contract. All 5 greppable titles confirmed present via `--list`:
- `empty` — D-04: app starts with zero entries
- `drop` — OPT-01 SC-1: file → queue entry + selected
- `Report` — OPT-01 SC-2: Report panel shows real byte values
- `re-optimize` — OPT-01 SC-3: settings change → re-encode
- `skip` — D-06/D-07: unsupported files silently skipped, no toast

**Task 3 — D-05 migrations** (4 files updated, 1 unchanged): replaced seeded-demo-list dependencies with `ingestFixtureFiles` calls. All 35 tests in the 5 migrated specs pass on `--project=chromium`.

## Expected-RED State (Intentional — Nyquist Wave 0)

The following ingest.spec.ts behavior assertions are RED at end of this plan by design:

| Test | Expected state | Unblocked by |
|------|---------------|--------------|
| `D-04: app starts empty` | RED — seed still present in filesAtom | Plan 02 (removes seed) |
| `OPT-01 SC-1: drop a file` | RED — no real drop/ingest wired | Plan 02 (useIngest) + Plan 04 (file input) |
| `OPT-01 SC-2: Report panel shows real bytes` | RED — fixture has no encodedBuffer | Plan 02/03 (useIngest + live encode) |
| `OPT-01 SC-3: re-optimize` | RED — setFileSettings does not trigger re-encode yet | Plan 03 (useLiveEncode settings wire) |
| `D-06/D-07: silent skip` | PASSES with fixture (no toast expected, no entry count mismatch) | — |

These are the intended RED state — they are the validation targets for Plans 02-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Strict-mode selector ambiguity on fixture filename**
- **Found during:** Task 3 first run
- **Issue:** `page.getByText('fixture-0.png')` resolved to 3 elements — files-pane list row, center-pane header span, and inspector-pane span — causing Playwright strict-mode violation
- **Fix:** Scoped all file-list clicks to `page.getByTestId('files-pane').getByText('fixture-0.png')` in both `inspector-tabs.spec.ts` and `per-file-settings.spec.ts`
- **Files modified:** `src/tests/inspector-tabs.spec.ts`, `src/tests/per-file-settings.spec.ts`
- **Commits:** 295a635

**2. output-panel.spec.ts — No migration needed**
- File contained no seeded-file-name selectors; all tests use conditional `isVisible` guards or unconditional-pass assertions. Left unchanged.

## Known Stubs

None — this plan creates test fixtures only. No production stubs introduced.

## Threat Flags

None — test-only code; not shipped in production bundle.

## Self-Check: PASSED

- [x] `src/tests/fixtures/ingest-helper.ts` — exists and typechecks clean
- [x] `src/tests/ingest.spec.ts` — `--list` shows 5 greppable titles (empty, drop, Report, re-optimize, skip)
- [x] 5 migrated specs — 35/35 tests pass on `--project=chromium`
- [x] Commits: 13b308f (task 1), 2759bdd (task 2), 295a635 (task 3)
