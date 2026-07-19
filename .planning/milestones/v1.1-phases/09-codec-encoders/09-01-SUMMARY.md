---
phase: 09-codec-encoders
plan: "01"
subsystem: stores/types/tests
tags: [per-file-settings, types, store, CR-01, wave-0-tests]
dependency_graph:
  requires: []
  provides:
    - FileSettings interface (src/lib/stub-data.ts)
    - initFileSettings helper (src/lib/stub-data.ts)
    - setFileSettings/setFileError/setFileResult/setFileRawBuffer (src/stores/files.ts)
    - applyToAll (src/stores/settings.ts)
    - CR-01 fix setJobCounts atomic (src/stores/runtime.ts)
    - Wave 0 codec-encoders tests (src/tests/codec-encoders.spec.ts)
    - Wave 0 per-file-settings tests (src/tests/per-file-settings.spec.ts)
  affects:
    - All downstream plans in Phase 09 (02/03/04) depend on FileSettings + per-file actions
tech_stack:
  added: []
  patterns:
    - nanostores setKey per field (CR-01 atomic pattern)
    - lazy import() for circular ESM guard (applyToAll → files.ts)
    - TypeScript generic action: setFileSettings<K extends keyof FileSettings>
key_files:
  created:
    - src/tests/codec-encoders.spec.ts
    - src/tests/per-file-settings.spec.ts
  modified:
    - src/lib/stub-data.ts
    - src/stores/files.ts
    - src/stores/settings.ts
    - src/stores/runtime.ts
decisions:
  - FileSettings is a separate interface (not an alias of SettingsState) so FileEntry can own it independently
  - initFileSettings does a shallow copy (not deep) — plugins array is shared until setFileSettings('plugins') replaces it
  - applyToAll uses lazy import(@/stores/files) to honor the CIRCULAR ESM GUARD comment in settings.ts
  - setJobCounts uses three atomic setKey calls (CR-01) — eliminates read-modify-write race with pushToast
metrics:
  duration: "~20m"
  completed: "2026-05-26"
  tasks: 3
  files: 6
---

# Phase 09 Plan 01: Per-File Settings Foundation + Wave 0 Test Scaffolds Summary

**One-liner:** Per-file FileSettings type + store actions (D-01/02/03) with CR-01 atomic fix and red Wave 0 Playwright specs for ENC-01..06.

## What Was Built

**Task 1 — stub-data.ts types:**
- `FileSettings` interface with 13 fields (`codec`, `q`, `method`, `lossless`, `resizeOn`, `w`, `h`, `alg`, `fit`, `stripMeta`, `keepIcc`, `aggressive`, `plugins`) plus optional `progressive` (JPEG-only default true)
- `FileEntry` extended with four optional fields: `settings?`, `rawBuffer?`, `encodedBuffer?`, `error?`
- `initFileSettings(defaults)` shallow-copy helper preventing aliasing bugs when entries are created (D-01 Pitfall 5)
- STUB_FILES literals unchanged — `settings` absent on stubs is intentional; store initializer uses `initFileSettings` fallback

**Task 2 — store actions:**
- `files.ts`: `setFileSettings<K extends keyof FileSettings>` (typed key prevents arbitrary write — T-9-01 mitigation), `setFileError`, `setFileResult`, `setFileRawBuffer`; re-exports `FileSettings` type
- `settings.ts`: `applyToAll()` via lazy `import('@/stores/files')` (circular ESM guard — mirrors worker-pool.ts pattern)
- `runtime.ts`: CR-01 fix — `setJobCounts` now uses three atomic `runtimeAtom.setKey(...)` calls instead of full-object spread

**Task 3 — Wave 0 test scaffolds:**
- `codec-encoders.spec.ts`: 7 tests covering ENC-01 (PNG), ENC-02 (WebP), ENC-03 (JPEG), ENC-04 (AVIF), ENC-05 (SVG), ENC-06 (quality diff), D-13 (empty buffer rejects) — RED until Plans 02/03 land
- `per-file-settings.spec.ts`: 3 tests covering D-01 (isolation), D-02 (applyToAll), D-03 (inspector reads own settings) — RED until Plan 04 lands

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — FileEntry/FileSettings types | 3ee4ff1 | src/lib/stub-data.ts |
| 2 — Store actions + CR-01 fix | 45ea372 | src/stores/files.ts, settings.ts, runtime.ts |
| 3 — Wave 0 test scaffolds | f9cec09 | src/tests/codec-encoders.spec.ts, per-file-settings.spec.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced. The Wave 0 tests are intentionally RED (not stubs) — they assert final expected behavior that Plans 02/03/04 will satisfy.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. All changes are in-memory store mutations. T-9-01 mitigated via generic `<K extends keyof FileSettings>` type constraint.

## Self-Check: PASSED

- src/lib/stub-data.ts exists with FileSettings interface and initFileSettings export
- src/stores/files.ts exports setFileSettings, setFileError, setFileResult, setFileRawBuffer, FileSettings
- src/stores/settings.ts exports applyToAll with lazy import pattern
- src/stores/runtime.ts setJobCounts uses three atomic setKey calls
- src/tests/codec-encoders.spec.ts exists with PNG/WebP/JPEG/AVIF/SVG/settings/error test titles
- src/tests/per-file-settings.spec.ts exists with "per-file settings — D-01/D-02/D-03" describe block
- npx tsc --noEmit: zero errors
- Commits 3ee4ff1, 45ea372, f9cec09 verified in git log
