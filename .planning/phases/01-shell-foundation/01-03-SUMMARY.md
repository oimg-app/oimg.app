---
phase: 01-shell-foundation
plan: 03
subsystem: ui
tags: [foundation, types, defaults, mocks, icons, theme, ratification]

# Dependency graph
requires:
  - phase: 01-shell-foundation
    provides: foundation atoms shipped in commit c13506a (types, defaults, mocks, icons, useTheme)
provides:
  - locked-foundation-surface (FormatId, FileEntry, CodecSettings* types)
  - production-codec-defaults (DEFAULT_CODEC_SVG/PNG/JPEG/WEBP/AVIF, DEFAULT_GLOBAL_SETTINGS)
  - visual-shell-fixtures (MOCK_FILES, SVGO_PLUGINS, CODECS, RESIZE_ALG, FIT_MODES)
  - Icons object (26 hairline SVG icons)
  - useTheme hook (dark/light + localStorage 'oimg-theme' + .dark class toggle)
affects:
  - 01-04 (panels) — imports MOCK_FILES, SVGO_PLUGINS from src/data/mock
  - 01-05 (tweaks panel) — imports CODECS, RESIZE_ALG, FIT_MODES, type CodecLabel/ResizeAlg/FitMode
  - Phase 2+ (codec pipeline) — imports DEFAULT_CODEC_* from src/data/defaults
  - Future settings store — consumes CodecSettings union type

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-file split: defaults.ts (production codec configs) + mock.ts (Phase 1 visual fixtures) — coexist intentionally with self-documenting headers"
    - "Domain types in src/types/index.ts are the single published surface (13 type/interface exports); defaults.ts and consumers import via @/types"
    - "useTheme hook: STORAGE_KEY constant 'oimg-theme', .dark class toggled on documentElement, T-03-01 mitigation casts unknown localStorage values back to 'dark'"

key-files:
  created: []
  modified:
    - src/data/mock.ts
    - src/data/defaults.ts

key-decisions:
  - "mock.ts and defaults.ts coexist by design: defaults.ts is the typed contract for the Phase 2 pipeline; mock.ts mirrors example-ui/data.jsx 1:1 for the Phase 1 visual shell and is deleted in Phase 2"
  - "FormatId uses 'jpeg' (defaults.ts) while MockFile.type uses 'jpg' (mock.ts) intentionally — mock.ts mirrors the original prototype 1:1 and is throwaway"
  - "Foundation surface is locked: no exports renamed, no shapes changed; Plans 04 and 05 may import by name without exploring the codebase"

patterns-established:
  - "Header-comment pattern for docs that exist as siblings with different roles — each file's header points to its sibling and explains the split"
  - "Ratification plan pattern: Wave 2 cleanup work that verifies prior commits via grep/tsc gates rather than re-implementing"

requirements-completed: [UI-01]

# Metrics
duration: 4min
completed: 2026-04-30
---

# Phase 01 Plan 03: Foundation Atoms Ratification Summary

**Plan 03 was a ratification of the foundation atoms shipped in commit c13506a, plus header-comment documentation of the mock.ts vs defaults.ts split. No code shapes were changed; this plan locks the surface area Plans 04 and 05 will consume.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-30T10:11:06Z
- **Completed:** 2026-04-30T10:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Verified all 13 type/interface exports in `src/types/index.ts` (ThemeMode, FormatId, FileStatus, SourceDensity, FormatDefinition, FileEntry, CodecSettingsSvg/Png/Jpeg/Webp/Avif, CodecSettings union, GlobalSettings)
- Verified all 7 production codec defaults in `src/data/defaults.ts` (DEFAULT_FORMATS, DEFAULT_CODEC_SVG/PNG/JPEG/WEBP/AVIF, DEFAULT_GLOBAL_SETTINGS) and the `from '@/types'` import
- Verified all 5 mock-fixture exports in `src/data/mock.ts` (MOCK_FILES with 12 entries, SVGO_PLUGINS with 22 entries, CODECS, RESIZE_ALG, FIT_MODES) plus the type exports App.tsx consumes (CodecLabel, ResizeAlg, FitMode, SvgoPlugin, MockFile)
- Verified `Icons` object with 26 entries and `IconProps` type export in `src/components/icons/index.tsx`
- Verified `useTheme` hook exposes `{ theme, setTheme, toggle }`, uses STORAGE_KEY 'oimg-theme', toggles `.dark` on `documentElement`
- Confirmed `tsc -b` exits 0 against the entire foundation
- Added 5-line header comment to `src/data/mock.ts` explaining it ships Phase 1 visual fixtures and pointing to `defaults.ts`
- Added 4-line header comment to `src/data/defaults.ts` explaining it is the Phase 2+ pipeline's source of truth and pointing to `mock.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify foundation surface area and assert grep gates** — verification-only, no commit (per plan: "DO NOT touch source files for this task")
2. **Task 2: Document the mock.ts vs defaults.ts split with header comments** — `18f0689` (docs)

**Plan metadata:** committed in this same SUMMARY commit

_Note: Task 1 is a deliberate no-commit verification task. Per the plan, the whole point was to ratify what shipped in commit c13506a; touching files would have defeated the purpose._

## Files Created/Modified

- `src/data/mock.ts` — Added 5-line header comment explaining Phase 1 visual-shell role and pointing to defaults.ts; replaced existing 2-line header
- `src/data/defaults.ts` — Added 4-line header comment above the existing import block explaining Phase 2+ pipeline role and pointing to mock.ts; no other lines changed

## Decisions Made

- **mock.ts and defaults.ts coexist by design.** defaults.ts is the typed contract the Phase 2 pipeline reads when creating a new run; mock.ts ships static fixtures the Phase 1 prototype renders today and is deleted in Phase 2. The header comments lock this so a future contributor cannot accidentally collapse them.
- **Foundation surface area is locked.** All 13 types, 7 default constants, 5 mock constants, 26 icons, and the useTheme contract are now grep-asserted; Plans 04 and 05 can import by name without spelunking.

## Deviations from Plan

None — plan executed exactly as written. Two-line existing header in mock.ts was replaced with the prescribed 5-line header (the plan asked to "replace the existing two-line header" — done verbatim).

## Issues Encountered

None.

### Pre-existing rolldown-vite arm64 binding bug

Carried forward from `01-01-SUMMARY.md` and `01-02-SUMMARY.md` and tracked in `.planning/phases/01-shell-foundation/deferred-items.md`. Plan 03 sidestepped this by using `./node_modules/.bin/tsc -b` directly per the plan's `<action>` instructions. No new symptoms.

## Verification

```bash
$ ./node_modules/.bin/tsc -b
# exit 0, no diagnostics

$ grep -c "^export" src/types/index.ts
13

$ grep -c "^export const" src/data/defaults.ts
7

$ grep -c "^export const" src/data/mock.ts
5

$ grep -c "id:" src/data/mock.ts
36   # 12 MOCK_FILES + 22 SVGO_PLUGINS + 2 interface declarations

$ grep -c "^  [A-Z][a-zA-Z]*:" src/components/icons/index.tsx
26

$ grep -q "Visual-shell fixtures for Phase 1" src/data/mock.ts && echo OK
OK

$ grep -q "Production codec defaults consumed by the Phase 2" src/data/defaults.ts && echo OK
OK

$ git diff --stat src/data/mock.ts src/data/defaults.ts
 src/data/defaults.ts | 5 +++++
 src/data/mock.ts     | 7 +++++--
 2 files changed, 10 insertions(+), 2 deletions(-)
```

All 32 acceptance-criteria gates from Task 1 passed. All 8 acceptance-criteria gates from Task 2 passed. Export lines in both data files are byte-identical to before the plan (only header-comment lines added).

## Threat Surface Scan

All three threat-register items reviewed; no new surface introduced:

- **T-03-01 (useTheme tampering):** Already mitigated — `readStoredTheme()` casts unknown values back to `'dark'` (verified at src/hooks/useTheme.ts L9–L10). No change in this plan.
- **T-03-02 (FileEntry.thumbnail Object URL):** Accepted risk; Phase 1 never assigns one (mock.ts uses no thumbnails). No change in this plan; Phase 2+ that introduces real Object URLs must call URL.revokeObjectURL on row removal.
- **T-03-03 (mock.ts/defaults.ts split contributor confusion):** Mitigated this plan via Task 2 header comments — both files now self-document the split.

No new network endpoints, auth paths, file-access patterns, or schema changes.

## Known Stubs

None. mock.ts is itself a fixture file (intentional), but it is fully wired into App.tsx and is not a placeholder masquerading as a real data source. The intent is documented in the new header comment, which also names the phase that deletes it (Phase 2).

## User Setup Required

None.

## Next Phase Readiness

- **Plan 04 (Layout & Panels)** can import `MOCK_FILES`, `SVGO_PLUGINS`, `type MockFile`, `type SvgoPlugin` from `@/data/mock` without verification spelunking.
- **Plan 05 (Tweaks Panel)** can import `CODECS`, `RESIZE_ALG`, `FIT_MODES`, `type CodecLabel`, `type ResizeAlg`, `type FitMode` from `@/data/mock` and any of the `DEFAULT_CODEC_*` constants from `@/data/defaults` without verification spelunking.
- **Phase 2 codec pipeline** has a stable typed contract: `CodecSettings` union and `GlobalSettings` interface from `@/types`, with `DEFAULT_CODEC_*` consts as starting values.
- **Pre-existing rolldown-vite arm64 binding bug** still blocks `npm run build`; tracked in `deferred-items.md`. Direct `./node_modules/.bin/tsc -b` and `./node_modules/.bin/vite build` still work.

## Self-Check: PASSED

- `src/data/mock.ts` — FOUND (modified)
- `src/data/defaults.ts` — FOUND (modified)
- Commit `18f0689` — FOUND in git log
- All grep gates from `<verification>` block passed against working tree

---
*Phase: 01-shell-foundation*
*Completed: 2026-04-30*
