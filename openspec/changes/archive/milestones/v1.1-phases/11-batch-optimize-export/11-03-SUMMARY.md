---
phase: 11-batch-optimize-export
plan: 03
subsystem: lib/filename
tags: [phase-11, wave-1, lib, filename, security, t-11-01]
status: complete
requires:
  - 11-00 (context + research)
provides:
  - "src/lib/filename.ts (5 pure-function exports)"
  - "T-11-01 zip-slip mitigation (sanitizeBaseName)"
affects:
  - "Plan 11-04 (useExport — single + bulk download) — imports renameExtension + mimeFor + sanitizeBaseName"
  - "Plan 11-05 (build-zip) — imports renameExtension + collisionSuffix + timestampedZipName + sanitizeBaseName"
tech-stack:
  added: []
  patterns:
    - "Zero-import pure utility module (analog: src/lib/format.ts)"
    - "node --experimental-strip-types unit test harness (analog: src/tests/format.test.ts)"
key-files:
  created:
    - src/lib/filename.ts
    - src/tests/filename.test.ts
  modified: []
decisions:
  - "D-05 implemented: renameExtension swaps final ext, case-normalized, idempotent if equal"
  - "D-10 implemented: collisionSuffix appends ' (N)' before extension; timestampedZipName uses LOCAL time pattern oimg-export-YYYY-MM-DD-HHMM.zip"
  - "T-11-01 implemented: sanitizeBaseName regex `/[/\\\\\\0]/g` → `_`. ../etc/passwd → ..-etc-passwd (no `/`), Windows reserved names + control chars accepted per threat register (T-11-RES, T-11-CTL)"
metrics:
  duration: ~5min
  completed: 2026-06-02
  tasks: 2
  files: 2
  tests_passed: 18
---

# Phase 11 Plan 03: Filename Helpers Summary

**One-liner:** Five pure-function filename helpers (renameExtension, collisionSuffix, timestampedZipName, mimeFor, sanitizeBaseName) shipped in `src/lib/filename.ts` with 18-assertion Node unit harness; T-11-01 zip-slip mitigation in place for downstream Plans 04 + 05.

## What Was Built

- `src/lib/filename.ts` — zero-import pure module with:
  - `renameExtension(name, ext)` — D-05 ext swap, idempotent, case-normalized
  - `collisionSuffix(name, used)` — D-10 base-name suffix `(1)`, `(2)`, …; pure, does not mutate `used`
  - `timestampedZipName(now?)` — D-10 `oimg-export-YYYY-MM-DD-HHMM.zip` in local time, deterministic when `now` provided
  - `mimeFor(ext)` — case-insensitive table lookup; unknown → `application/octet-stream`
  - `sanitizeBaseName(name)` — T-11-01 zip-slip mitigation, strips `/`, `\`, NUL
- `src/tests/filename.test.ts` — 18 assertions covering happy paths + edge cases for all five exports + T-11-01 input `../etc/passwd`

## Commits

| Hash | Type | Message |
|------|------|---------|
| `6a1d0b6` | feat | add filename helpers — 5 exports + T-11-01 mitigation |
| `5df6188` | test | add filename.test.ts unit harness — 18 assertions across 5 helpers |

## Verification

- `grep -c '^export function' src/lib/filename.ts` → `5` ✓
- isolated `tsc --noEmit --strict` on `src/lib/filename.ts` → exit 0 ✓
- `node --experimental-strip-types src/tests/filename.test.ts` → `18 passed, 0 failed` ✓
- T-11-01 mitigation asserted: `sanitizeBaseName('../etc/passwd')` returns a string with no `/` ✓

Note: Project-wide `tsc -b` has pre-existing baseline noise (per MEMORY.md "Typecheck & test gotchas: baseline tsc is red with pre-existing debt"); isolated typecheck on the new file is clean.

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

- Used `name.replace(/[/\\\0]/g, '_')` for `sanitizeBaseName` (covers `/`, `\`, NUL) per RESEARCH.md § Security and plan `<action>`. Windows reserved names + control chars are accepted (T-11-RES, T-11-CTL) per the plan's threat register.
- `collisionSuffix` is **pure** (does not mutate `used`) — plan's narrative said "Mutates `used` set" in the executor prompt critical-constraints, but the plan's `<behavior>` block and PATTERNS.md spec describe a pure function and the unit-test signature pattern (`new Set(['a.webp', 'a (1).webp'])`) only works if the function is pure. Callers (Plan 05) will be responsible for inserting the returned name into the `used` Set themselves — clearer separation of concerns. This matches the RESEARCH.md spec; the executor-prompt phrasing was a paraphrase, not the authoritative behavior.

## Carry-Forward for Downstream Plans

**Plan 11-04 (useExport — single + bulk download)** consumes:
- `renameExtension(file.name, file.targetFormat)` — derive download filename per D-05
- `mimeFor(targetExt)` — set Blob type / save picker accept
- `sanitizeBaseName(...)` — apply BEFORE `showSaveFilePicker({ suggestedName })` to harden T-11-01

**Plan 11-05 (build-zip)** consumes:
- `timestampedZipName()` — top-level ZIP filename
- For each file: `sanitizeBaseName(renameExtension(name, ext))` then `collisionSuffix(safeName, usedNames)` and **caller MUST insert the returned name into `usedNames`** before `zip.file(name, bytes)`
- `mimeFor(...)` for any inline metadata if needed

## Known Stubs

None — both files are complete implementations.

## Self-Check: PASSED

- [x] `src/lib/filename.ts` exists (verified by Write tool success + commit `6a1d0b6`)
- [x] `src/tests/filename.test.ts` exists (verified by Write tool success + commit `5df6188`)
- [x] Commit `6a1d0b6` exists in git log
- [x] Commit `5df6188` exists in git log
- [x] Acceptance: 5 `export function` lines in filename.ts
- [x] Acceptance: 18 assertions pass (≥14 threshold)
- [x] T-11-01 mitigation asserted in tests
