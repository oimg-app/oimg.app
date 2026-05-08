---
phase: 05-raster-encoders
plan: "01"
subsystem: raster-encoders
tags: [wave-0, test-scaffolding, jsquash, npm-install]
dependency_graph:
  requires: []
  provides: [raster-test-stubs, jsquash-packages]
  affects: [src/tests/raster.spec.ts, src/tests/settings.unit.ts]
tech_stack:
  added: ["@jsquash/jpeg@^1.6.0", "@jsquash/webp@^1.5.0", "@jsquash/avif@^2.1.1", "@jsquash/oxipng@^2.3.0"]
  patterns: [test.fail-wave-0-stub, node-strip-types-unit-test]
key_files:
  created: [src/tests/settings.unit.ts]
  modified: [src/tests/raster.spec.ts, package.json, package-lock.json]
decisions:
  - "OxiPNG export function is optimise() (British spelling) — confirmed from @jsquash/oxipng README"
  - "JPEG chroma: chroma_subsample (number, default 2), auto_subsample (boolean), separate_chroma_quality (boolean), chroma_quality (number) — confirmed from meta.js"
metrics:
  duration: "~8 min"
  completed: "2026-05-08T09:45:00Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 05 Plan 01: Wave 0 Scaffolding — jSquash Install + Test Stubs Summary

Installed four jSquash raster codec packages and wrote 12 failing-stub tests (8 E2E + 4 unit) establishing the Phase 5 test contract before any production code ships.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install jSquash codec packages | e255c56 | package.json, package-lock.json |
| 2 | Write failing-stub test scaffolds | cbf6450 | src/tests/raster.spec.ts, src/tests/settings.unit.ts |

## Installed Packages

| Package | Version in package.json | Underlying codec |
|---------|------------------------|-----------------|
| `@jsquash/jpeg` | `^1.6.0` | MozJPEG |
| `@jsquash/webp` | `^1.5.0` | libwebp |
| `@jsquash/avif` | `^2.1.1` | libavif |
| `@jsquash/oxipng` | `^2.3.0` | OxiPNG (Rust) |

## Key Research Findings (for Plan 02)

### OxiPNG Export Function Name
`optimise()` — British spelling. Confirmed from `@jsquash/oxipng` README:
```
optimise(data: ArrayBuffer, options?: OptimiseOptions): Promise<ArrayBuffer>
```
Also exports MT variant via `@jsquash/oxipng/optimise` sub-path.

### JPEG Chroma Subsampling Options
Available via `@jsquash/jpeg` encode options (from `meta.js`):
- `auto_subsample: boolean` (default: true)
- `chroma_subsample: number` (default: 2)
- `separate_chroma_quality: boolean` (default: false)
- `chroma_quality: number` (default: 75)

RESEARCH.md Open Question 2 is now resolved: chroma subsampling IS supported as a numeric `chroma_subsample` field.

## Test Stubs Created

### raster.spec.ts — 8 new test.fail() stubs appended after Phase 4 tests

| Stub | Requirement | Wave/Plan to flip |
|------|-------------|------------------|
| OPT-02 | PNG + OxiPNG reduces file size | Wave 2 plan 05 |
| OPT-03 | WebP encode produces valid WebP | Wave 2 plan 05 |
| OPT-04 | JPEG encode produces valid JPEG | Wave 2 plan 05 |
| OPT-05 | AVIF lazy-loads (no WASM at init) | Wave 2 plan 05 |
| PIPE-02 | Settings change re-optimizes only that file | Wave 2 plan 05 |
| UI-03 | File list shows byte reduction | Wave 2 plan 05 |
| UI-04 | Click file row opens split slider | Wave 2 plan 05 |
| UI-05 | InspectorPane Codec + Snippets tabs | Wave 2 plan 05 |

### settings.unit.ts — 4 new PIPE-03 stubs (node --experimental-strip-types)

| Stub | Wave/Plan to flip |
|------|-----------------|
| PIPE-03: perFile override merges over global JPEG | Wave 1 plan 03 |
| PIPE-03: perFile override merges over global WebP | Wave 1 plan 03 |
| PIPE-03: perFile override merges over global PNG | Wave 1 plan 03 |
| PIPE-03: no override → global used unmodified | Wave 1 plan 03 |

## Verification Results

- `npm install` exited 0, no peer-dep errors
- All 4 packages present in `package.json` dependencies
- `grep -c` returns 8 matches for requirement IDs in raster.spec.ts
- `npx playwright test --grep "raster"` exits 0 — 16 pass (Phase 4 live + Phase 5 expected-failures), 1 pre-existing flake (metadata strip WASM race, documented in 04-07-SUMMARY Deferred Issues)
- settings.unit.ts contains no `@/` aliases (node strip-types compatible)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

All stubs are intentional Wave 0 placeholders. Each is tagged with the Wave/Plan that will activate it. No production functionality is blocked by these stubs.

## Self-Check: PASSED

- [x] `src/tests/raster.spec.ts` exists and contains OPT-02 through UI-05
- [x] `src/tests/settings.unit.ts` exists and contains PIPE-03
- [x] Commit e255c56 exists (Task 1)
- [x] Commit cbf6450 exists (Task 2)
- [x] All 4 jSquash packages in package.json dependencies
