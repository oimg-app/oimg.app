---
phase: 10-single-file-optimize-loop
plan: "03"
subsystem: hooks
tags: [ingest, format-gate, file-entry, auto-optimize, useIngest]
dependency_graph:
  requires: ["10-02"]
  provides: ["useIngest"]
  affects: ["src/hooks/useIngest.ts"]
tech_stack:
  added: []
  patterns:
    - "Format gate: ACCEPTED_EXTS + ACCEPTED_MIMES sets, silent skip (D-06/D-07)"
    - "fileToEntry: crypto.randomUUID, Date.now() createdAt, status=processing (D-08/D-10)"
    - "readDimensions: SVG short-circuit '—', raster createImageBitmap try/catch (Pitfall 6)"
    - "ingest(): append-then-runOptimize via useOptimize (no new dispatch loop, D-03)"
    - "openPicker(): showOpenFilePicker + AbortError swallow + fallbackTrigger callback (Pitfall 4)"
key_files:
  created:
    - src/hooks/useIngest.ts
  modified: []
decisions:
  - "jpg extension normalized to jpeg for codec dispatch consistency with useOptimize toSourceFormat"
  - "openPicker exposes optional fallbackTrigger callback so component owns the hidden input element (Plan 04 concern) while picker logic stays in the hook"
  - "status='processing' (not 'queued') at ingest so DeltaStrip shimmer is visible during pending window (D-10)"
metrics:
  duration: "8m"
  completed_date: "2026-05-28"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 10 Plan 03: useIngest Hook Summary

**One-liner:** useIngest hook with ext+MIME format gate, File→FileEntry mapping (createdAt, rawBuffer), silent skip, and auto-optimize via reused runOptimize.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Format gate + File→FileEntry mapping + dimension read | be84b42 | src/hooks/useIngest.ts |
| 2 | useIngest hook — ingest() + openPicker() with auto-optimize dispatch | be84b42 | src/hooks/useIngest.ts |

## What Was Built

`src/hooks/useIngest.ts` — the single ingestion entry point. Components (Plan 04) wire DOM events here; this hook owns all format-gate/map/append/auto-optimize logic.

**Module-level constants:** `ACCEPTED_EXTS` (png/jpg/jpeg/webp/svg/avif) + `ACCEPTED_MIMES` (5 MIME types). `isAccepted(file)` checks ext OR MIME (D-06).

**`readDimensions(file, type)`:** SVG returns `'—'` immediately without `createImageBitmap` (Pitfall 6). Raster: `createImageBitmap` in try/catch, `bitmap.close()`, returns `'—'` on any throw (never blocks ingest — T-10-V5).

**`fileToEntry(file)`:** Returns `FileEntry` with `id=crypto.randomUUID()`, `createdAt=Date.now()` (D-04 sort key), `status='processing'` (D-10 shimmer), `orig=opt=file.size` (pending), `rawBuffer=await file.arrayBuffer()`, `settings=defaultFileSettings(type, 82)`.

**`useIngest()`:** Returns `{ ingest, openPicker }`.
- `ingest(files)`: filters → maps → appends with `filesAtom.setKey` → `selectFile(newest)` (D-02) → `setFileRawBuffer` per entry → `await runOptimize()` (D-03, reuses Phase 9 path, no new dispatch loop).
- `openPicker(fallbackTrigger?)`: `showOpenFilePicker` with AbortError swallow (Pitfall 4); fallback calls optional trigger callback so the hidden `<input>` element stays in the component.

## Verification

- `npx tsc -b 2>&1 | grep useIngest` → no output (type-clean, zero new errors)
- `grep "@jsquash" src/hooks/useIngest.ts` → 0 matches (200KB budget preserved)
- ingest.spec "skip" test (D-06/D-07): PASSED (1 passed, via background run)
- Pre-existing tsc-b errors in stores.test.ts/codec.worker.ts/CodecPanel.tsx/codec-encoders.spec.ts — out of scope, unchanged

## Deviations from Plan

**1. [Rule 1 - Bug] jpg → jpeg normalization in fileToEntry**
- **Found during:** Task 1 — reviewing useOptimize.ts toSourceFormat which maps `'jpg'` and `'jpeg'` separately, but EncodeJob sourceFormat codec dispatch needs consistency.
- **Issue:** Plan pattern showed `ext === 'jpg' ? 'jpg' : ext` — keeping `jpg` as type. However useOptimize.ts already handles both `'jpg'` and `'jpeg'` in toSourceFormat, so this is safe. Normalized to `'jpeg'` for consistency with the codec layer's canonical type.
- **Fix:** `type = ext === 'jpg' ? 'jpeg' : ext` (one normalized canonical form flows to settings and codec).
- **Files modified:** src/hooks/useIngest.ts

**2. [Rule 2 - Missing] openPicker fallbackTrigger pattern documented in comment**
- **Found during:** Task 2 — Plan 04 needs to know the contract for the hidden input fallback.
- **Fix:** Added JSDoc comment to `openPicker` explaining the `fallbackTrigger` callback contract so Plan 04 author has clear integration guidance.

## Known Stubs

None — hook is fully implemented. The drop/Report/re-optimize ingest.spec tests remain EXPECTED-RED because they need Plan 04 DOM wiring (hidden `<input data-testid="file-input">` + drag events on FilesPane).

## Threat Flags

None — no new network endpoints, no new auth paths. T-10-V5 (ext+MIME gate + createImageBitmap try/catch) implemented as planned.

## Self-Check: PASSED

- `src/hooks/useIngest.ts` exists: FOUND
- Commit `be84b42` exists: FOUND
- `npx tsc -b 2>&1 | grep useIngest` returns nothing: CONFIRMED
- No @jsquash imports: CONFIRMED (0 matches)
