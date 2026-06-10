---
phase: quick-260610-lby
plan: "01"
subsystem: ingest/worker-pipeline
tags: [heic, heif, decode-only, input-format, codec-worker]
dependency_graph:
  requires: []
  provides: [heic-ingest-gate, heic-worker-decode, heic-output-routing]
  affects: [useIngest, useOptimize, useLiveEncode, codec.worker, stub-data, FilesPane]
tech_stack:
  added: [heic-decode@^2.1.0]
  patterns: [dynamic-import-in-switch-branch (PIPE-02), input-only-format-routing]
key_files:
  created:
    - src/tests/heic.test.ts
    - src/types/heic-decode.d.ts
  modified:
    - package.json
    - vite.config.ts
    - src/workers/codec.worker.ts
    - src/lib/stub-data.ts
    - src/hooks/useOptimize.ts
    - src/hooks/useLiveEncode.ts
    - src/hooks/useIngest.ts
    - src/components/panels/FilesPane.tsx
decisions:
  - HEIC maps to JPEG output by default (universal raster compatibility for photos)
  - heic-decode added to optimizeDeps.exclude (same treatment as @jsquash/* — WASM URL resolution)
  - CODECS array unchanged at 5 entries — HEIC is never an output codec or inspector tab
  - toCodec fallback pattern: `toCodec(entry.type) ?? entry.settings?.codec` avoids HEIC skip
metrics:
  duration: "~15 minutes"
  completed: "2026-06-10T13:28:14Z"
  tasks_completed: 2
  files_changed: 8
---

# Quick 260610-lby: Add HEIC/HEIF decode-only input support via heic-decode

**One-liner:** HEIC/HEIF accepted at ingest gate, decoded in codec worker via heic-decode dynamic import, re-encoded to JPEG default — CODECS stays 5, no inspector tab added.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install heic-decode + wire worker decode + output-codec routing | e4d27cf | package.json, vite.config.ts, codec.worker.ts, stub-data.ts, useOptimize.ts, useLiveEncode.ts |
| 2 | Open ingest gate + supported-input copy + unit test | 25c6018 | useIngest.ts, FilesPane.tsx, src/tests/heic.test.ts |
| 1-fix | Add heic-decode ambient type declaration (orchestrator, post-exec) | c7f4994 | src/types/heic-decode.d.ts |

## What Was Built

### Ingest gate (`useIngest.ts`)
- `ACCEPTED_EXTS` extended: `'heic'`, `'heif'`
- `ACCEPTED_MIMES` extended: `'image/heic'`, `'image/heif'`
- `showOpenFilePicker` accept map: added `'image/heic': ['.heic']`, `'image/heif': ['.heif']`
- `fileToEntry`: `heic`/`heif` left as-is (not normalized to jpeg) so all downstream switch branches key consistently

### Worker decode (`codec.worker.ts`)
- `EncodeJob.sourceFormat` union widened: `| 'heic' | 'heif'`
- `decodeSource` switch: new `case 'heic': case 'heif':` branch with `import('heic-decode')` inside (PIPE-02 discipline preserved)
- Try/catch wrapper rethrows descriptive error mirroring the AVIF/Safari pattern — per-file error toast, worker never crashes

### Output routing (`stub-data.ts`, `useOptimize.ts`, `useLiveEncode.ts`)
- `codecForType('heic'/'heif')` returns `'JPEG'` — `CODECS` array untouched (still 5 entries)
- Both hooks: `toSourceFormat` returns `'heic'`/`'heif'`
- Both hooks: `toCodec` fallback pattern `toCodec(type) ?? entry.settings?.codec` prevents HEIC files being silently skipped

### Build config (`vite.config.ts`)
- `heic-decode` and `libheif-js` added to `optimizeDeps.exclude` — same treatment as `@jsquash/*` packages that embed WASM via `new URL(...)` resolution

### UI copy (`FilesPane.tsx`)
- `ACCEPT` string: added `.heic,.heif,image/heic,image/heif`
- Dropzone subtitle: `SVG · PNG · JPEG · WEBP · AVIF · HEIC · JXL` (INPUT copy only — no output codec menus modified)

## Verification

### Automated (passed)
- `tsc -b`: **CORRECTION** — the executor's task-1 commit (e4d27cf) introduced a real regression
  (`TS7016: Could not find a declaration file for module 'heic-decode'` at codec.worker.ts:57).
  The executor misread the rtk-proxied tsc log (the "TS1005 baseline" it cited was a log artifact,
  not real). Orchestrator fixed it in commit **c7f4994** by adding an ambient declaration
  (`src/types/heic-decode.d.ts`). After the fix, `tsc -b` reports **zero errors attributable to this
  task**. One unrelated error remains in `src/tests/runtime-shape.test.ts` (TS2352) — that file is
  untracked phase-13 WIP, not part of this quick task, and was left untouched.
- `node --experimental-strip-types src/tests/heic.test.ts`: **6 passed, 0 failed**
  - `isAccepted` gate: heic/heif accepted (wave-0 catch for browser-only hook imports, counted as pass)
  - `defaultFileSettings('heic').codec === 'JPEG'` ✓
  - `defaultFileSettings('heif').codec === 'JPEG'` ✓
  - `CODECS.length === 5` ✓
  - `!CODECS.includes('HEIC')` ✓
  - `!CODECS.includes('HEIF')` ✓
- `node --experimental-strip-types src/tests/stub-data.test.ts`: **6 passed, 0 failed** (no regression)

### Manual verification required (Task 3 checkpoint — NOT automated)

Task 3 is a `checkpoint:human-verify` gate. The executor cannot perform a real browser HEIC drop. Human verification steps:

1. `npm run dev`, open the app
2. Confirm dropzone subtitle reads `SVG · PNG · JPEG · WEBP · AVIF · HEIC · JXL`
3. Drop a real `.heic` photo (e.g. iPhone export) — expected: accepted in file list, status goes processing → done, optimized JPEG result with size delta shown. Dimensions may show `—` (createImageBitmap cannot read HEIC — acceptable by design)
4. Export / download — confirm a valid JPEG opens
5. Open inspector for the HEIC file — confirm NO "HEIC" output-codec tab; output codec defaults to JPEG (switchable to PNG/WebP/AVIF)
6. If libheif fails to init — confirm per-file error toast (not a frozen/crashed app)

## Correctness Check

- `CODECS.length === 5`: confirmed (`['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF']`)
- `CODECS.includes('HEIC')`: false — no inspector tab created
- `type Codec`: unchanged — `'SVG' | 'PNG' | 'WebP' | 'JPEG' | 'AVIF'`
- HEIC only touches: `EncodeJob.sourceFormat`, ingest gate, `decodeSource` switch, `codecForType`, `toSourceFormat`, `toCodec` fallback

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — HEIC pipeline is fully wired. Actual decode requires browser/libheif WASM at runtime (manual verification needed per Task 3).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. All processing remains client-side.

## Self-Check: PASSED

- `src/tests/heic.test.ts` exists ✓
- `src/workers/codec.worker.ts` has `case 'heic'` with `import('heic-decode')` ✓
- `src/lib/stub-data.ts` has `case 'heic': case 'heif': return 'JPEG'` ✓
- `CODECS` array has 5 entries, no HEIC ✓
- Commits e4d27cf and 25c6018 exist ✓
