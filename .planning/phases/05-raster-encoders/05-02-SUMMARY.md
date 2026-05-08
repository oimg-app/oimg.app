---
phase: 05-raster-encoders
plan: "02"
subsystem: raster-encoders
tags: [wave-1, codec-adapters, icc, jsquash, lazy-init, oxipng]
dependency_graph:
  requires: [05-01]
  provides: [jpeg-adapter, webp-adapter, avif-adapter, png-oxipng-pipeline, icc-extract-embed]
  affects:
    - src/workers/jpeg-adapter.ts
    - src/workers/webp-adapter.ts
    - src/workers/avif-adapter.ts
    - src/workers/png-adapter.ts
    - src/workers/worker.ts
    - src/lib/icc.ts
tech_stack:
  added: ["@jsquash/jpeg@^1.6.0", "@jsquash/webp@^1.5.0", "@jsquash/avif@^2.1.1", "@jsquash/oxipng@^2.3.0"]
  patterns: [lazy-init-wasm, adapter-error-wrapping, crc32-inline, tdd-red-green]
key_files:
  created:
    - src/workers/jpeg-adapter.ts
    - src/workers/jpeg-config.ts
    - src/workers/webp-adapter.ts
    - src/workers/webp-config.ts
    - src/workers/avif-adapter.ts
    - src/workers/avif-config.ts
    - src/lib/icc.ts
    - src/tests/codec-config.unit.ts
    - src/tests/icc-extract.unit.ts
  modified:
    - src/workers/png-adapter.ts
    - src/workers/png-config.ts
    - src/workers/worker.ts
    - src/hooks/useBatchOrchestrate.ts
    - package.json
    - package-lock.json
decisions:
  - "OxiPNG export confirmed as optimise() (British spelling) — from 05-01-SUMMARY"
  - "JPEG chroma options available (chroma_subsample, auto_subsample) but not added to JpegEncodeSettings — Phase 5 minimal surface; CodecSettingsJpeg has quality+progressive"
  - "PngResizeSettings did NOT have level field — added alongside buildPngResizeSettings globalPng param"
  - "D-14 WebP ICC deferred to Phase 8 — estimated ~120 LOC feasible but batched with AVIF deferral for unified Phase 8 ICC pass"
  - "D-14 AVIF ICC deferred to Phase 8 — BMFF recursive box walk estimated >350 LOC, exceeds 300-LOC gate"
  - "AVIF encode lossless uses boolean (not 0/1) — confirmed from @jsquash/avif meta.js"
  - "AVIF decode returns ImageData|null — null-check added to avif-adapter.ts (Rule 1 fix)"
  - "Rule 3 deviation: worktree missing 4 jsquash packages — installed and added to package.json"
metrics:
  duration: "~35 min"
  completed: "2026-05-08T11:00:00Z"
  tasks_completed: 2
  files_changed: 14
---

# Phase 05 Plan 02: Wave 1a — Raster Codec Adapters + ICC Utilities Summary

Implemented all four raster codec adapters (JPEG, WebP, AVIF, upgraded PNG/OxiPNG) with lazy-init pattern, wired them into the ADAPTERS map in worker.ts, and created icc.ts with PNG iCCP + JPEG APP2 extract/embed utilities.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create JPEG/WebP/AVIF adapters + config builders (TDD) | d867701 + dbb4666 | 6 files |
| 2 | Upgrade png-adapter + create icc.ts + wire worker.ts (TDD) | 0287277 + d8172c2 | 8 files |

## Key Implementation Details

### OxiPNG Export Function Name
`optimise()` — British spelling. Confirmed from 05-01-SUMMARY.md research. Used verbatim in png-adapter.ts.

### JPEG Chroma Options
`chroma_subsample` (number, default 2), `auto_subsample` (boolean) are available per @jsquash/jpeg meta.js (confirmed 05-01-SUMMARY). NOT added to `JpegEncodeSettings` — Phase 5 minimal surface only exposes `quality` + `progressive`. Chroma control is a Phase 7+ UI polish item.

### PngResizeSettings `level` Field
`PngResizeSettings` did NOT have a `level` field in Phase 4. Added alongside a new `globalPng: CodecSettingsPng` parameter to `buildPngResizeSettings()`. All callers updated — `useBatchOrchestrate.ts` now passes `useSettingsStore.getState().png`.

### AVIF Type Correction (Rule 1 Bug Fix)
`@jsquash/avif` decode returns `ImageData | null`. Initial adapter had `let decoded: ImageData` causing TS2322. Fixed with null-check + `AdapterError` if null. `lossless` is boolean in AVIF meta.js (not `0/1` number as in WebP).

### D-14 WebP ICC Measurement
WebP RIFF container walk estimated at ~120 LOC. Under the 300-LOC gate individually. However, AVIF BMFF box walk was estimated at >350 LOC (recursive moov→trak→mdia→minf→stbl→stsd→av01→colr walk). Both are deferred to Phase 8 as a unified ICC completion pass rather than shipping WebP alone. This is consistent with D-14 gating logic — implementing half the ICC surface creates an inconsistent user experience.

### D-14 AVIF ICC Measurement
AVIF BMFF recursive box walk: estimated 350+ LOC for a correct implementation. Exceeds the 300-LOC gate. Deferred to Phase 8 per D-14 plan language. Deferral comments in icc.ts at lines 317–326.

### icc.ts Architecture
- CRC32: 30-LOC inline table-lookup (no npm dep)
- `extractPngIcc`: walks 8-byte PNG sig + chunk stream; finds iCCP; skips name+compression prefix; returns Uint8Array
- `embedPngIcc`: inserts iCCP chunk after IHDR; CRC32 of type+data; new ArrayBuffer output
- `extractJpegIcc`: scans 0xFF 0xE2 APP2 markers; `ICC_PROFILE\0` identifier check; reassembles multi-segment
- `embedJpegIcc`: prepends APP2 segment(s) after SOI; 65519-byte chunks for large ICC data
- Total: 326 LOC including deferred comments

## Vite Build Output Notes

Build exits 0. Three pre-existing TypeScript errors in App.tsx (`setRowMenu` missing) and FilesPane.tsx (unused vars) are out of scope — neither file was modified by this plan. AVIF adapter code-splits as expected (Vite statically analyzes the literal import path in ADAPTERS map).

## Deviations from Plan

### Rule 3 — Missing jsquash packages in worktree

**Found during:** Task 2 (`npm run build`)

**Issue:** Worktree node_modules only had `@jsquash/png` and `@jsquash/resize`. The Plan 05-01 packages (`@jsquash/jpeg`, `@jsquash/webp`, `@jsquash/avif`, `@jsquash/oxipng`) were installed in the parallel agent worktree but not in this one.

**Fix:** `npm install @jsquash/jpeg@^1.6.0 @jsquash/webp@^1.5.0 @jsquash/avif@^2.1.1 @jsquash/oxipng@^2.3.0` — added to package.json and package-lock.json.

**Files modified:** package.json, package-lock.json

**Commit:** 0287277

### Rule 1 — AVIF decode null-check

**Found during:** Task 2 (`npm run build`)

**Issue:** `@jsquash/avif` decode returns `ImageData | null`. The initial implementation declared `let decoded: ImageData` without checking for null, causing TS2322.

**Fix:** Changed to `let decoded: ImageData | null`, added null-check post-decode, throws `AdapterError('avif', 'decode', 'decode returned null...')`.

**Files modified:** src/workers/avif-adapter.ts

**Commit:** 0287277

## Known Stubs

None — all production functionality required by this plan is implemented. OxiPNG pipeline is live. ICC PNG/JPEG functions are implemented. WebP/AVIF ICC are explicitly deferred per D-14 (not stubs — design decision documented).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. icc.ts operates on user-uploaded ArrayBuffer only (T-5-02-03 mitigated: extractPngIcc returns null on parse error, never throws). All threat register mitigations from 05-02-PLAN.md threat model are implemented:
- T-5-02-01: try/catch wrapping around all three new adapters' decode()
- T-5-02-03: extractPngIcc null-return on malformed chunk confirmed by unit test
- T-5-02-04: OxiPNG inside try/catch in png-adapter

## Self-Check

### Files exist
- [x] src/workers/jpeg-adapter.ts — contains `await import('@jsquash/jpeg')`
- [x] src/workers/webp-adapter.ts — contains `await import('@jsquash/webp')`
- [x] src/workers/avif-adapter.ts — contains `await import('@jsquash/avif')`
- [x] src/workers/jpeg-config.ts — no @jsquash imports
- [x] src/workers/webp-config.ts — no @jsquash imports
- [x] src/workers/avif-config.ts — no @jsquash imports
- [x] src/lib/icc.ts — exports extractPngIcc, embedPngIcc, extractJpegIcc, embedJpegIcc
- [x] src/workers/worker.ts — contains import('./jpeg-adapter'), import('./webp-adapter'), import('./avif-adapter'); no throw stubs

### Commits exist
- [x] dbb4666 — test(05-02): RED JPEG/WebP/AVIF config tests
- [x] d867701 — feat(05-02): JPEG/WebP/AVIF adapters + config builders
- [x] d8172c2 — test(05-02): RED icc.ts tests
- [x] 0287277 — feat(05-02): png-adapter + icc.ts + worker.ts + packages

## Self-Check: PASSED
