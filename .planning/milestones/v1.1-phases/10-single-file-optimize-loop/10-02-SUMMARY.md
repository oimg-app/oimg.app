---
phase: 10-single-file-optimize-loop
plan: "02"
subsystem: stores
tags: [nanostores, filesAtom, d-04, queue-order, createdAt, seed-removal]
dependency_graph:
  requires:
    - src/tests/ingest.spec.ts (Plan 01 — test contract)
    - src/tests/fixtures/ingest-helper.ts (Plan 01 — ingestFixtureFiles with createdAt)
  provides:
    - src/lib/stub-data.ts (FileEntry.createdAt field)
    - src/stores/files.ts (empty seed + createdAt-based queue-order sort)
  affects:
    - src/hooks/useIngest.ts (Plan 03 — will set createdAt: Date.now() on ingest)
    - src/tests/ingest.spec.ts (D-04 "empty" test flips GREEN)
tech_stack:
  added: []
  patterns:
    - Optional interface field (createdAt?: number) keeps legacy entries valid without migration
    - ?? 0 fallback in comparator prevents NaN sort instability for entries without createdAt
key_files:
  created: []
  modified:
    - src/lib/stub-data.ts
    - src/stores/files.ts
decisions:
  - "createdAt is optional (not required) so STUB_FILES entries need no values — test fixtures set their own (already done in Plan 01)"
  - "STUB_FILES kept exported — still used by test fixtures via ingest-helper.ts"
  - "STUB_FILES import removed from files.ts (was only used as seed + findIndex comparator — both removed)"
metrics:
  duration: "~10m"
  completed: "2026-05-28T13:00:00Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 10 Plan 02: Seed Removal + createdAt Queue-Order Summary

Empty `filesAtom` seed (app starts on dropzone) + `createdAt`-based queue-order sort replacing broken `STUB_FILES.findIndex` comparator.

## What Was Built

**Task 1 — `FileEntry.createdAt` field** (`src/lib/stub-data.ts`): Added `createdAt?: number` to the `FileEntry` interface, placed after `q`. Field is optional so all 12 existing `STUB_FILES` entries remain valid without requiring values. Inline JSDoc documents it as the D-04 queue-order sort key set at ingest. Phase 10 Plan 02 attribution added to header.

**Task 2 — Empty seed + createdAt sort** (`src/stores/files.ts`): Changed `filesAtom` initializer from `entries: STUB_FILES` to `entries: []` (D-04). Replaced `STUB_FILES.findIndex` comparator in `$filteredFiles` 'queue order' case with `(a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)` (Pitfall 2 fix). Removed now-unused `STUB_FILES` import; `defaultFileSettings` import retained (still used by `setFileSettings`/CR-01).

## Verification Results

- `tsc -b` — no new errors in modified files (pre-existing Phase 9 debt unchanged)
- `ingest.spec.ts -g "empty" --project=chromium` — **1 passed** (D-04 GREEN)
- 5 migrated specs (`inspector-tabs`, `per-file-settings`, `navigation`, `backpressure`, `output-panel`) — **35/35 passed** (seed-independent via ingestFixtureFiles)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — pure model/store change; no production data stubs introduced.

## Threat Flags

None — in-memory sort comparator change only; no new network/auth/file surface.

## Self-Check: PASSED

- [x] `src/lib/stub-data.ts` — `FileEntry.createdAt?: number` exists; `STUB_FILES` export intact
- [x] `src/stores/files.ts` — `entries: []` in initializer; `(a.createdAt ?? 0) - (b.createdAt ?? 0)` comparator; `STUB_FILES` import removed
- [x] Commits: de07346 (task 1), d183358 (task 2)
- [x] D-04 "empty" test: GREEN (1 passed)
- [x] 5 migrated specs: 35/35 passed
