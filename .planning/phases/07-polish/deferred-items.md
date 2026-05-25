# Phase 07 — Deferred Items

Out-of-scope discoveries logged during execution. These are NOT fixed by the plan that found them.

## Pre-existing TypeScript error (found during plan 07-01)

- **File:** `src/components/panels/inspector/ReportPanel.tsx:13`
- **Error:** `TS1261: Already included file name '.../src/components/ui/Tooltip.tsx' differs from file name '.../src/components/ui/tooltip.tsx' only in casing.`
- **Cause:** Import `@/components/ui/Tooltip` (capital T) resolves on case-insensitive macOS filesystem to `tooltip.tsx` (lowercase), but TS already included it under a different casing. Not caused by 07-01 changes — belongs to inspector/ReportPanel work (likely a concurrent or prior plan).
- **Impact:** Halts `tsc -b` early, blocking full-build typecheck for unrelated files.
- **Recommended fix:** Normalize the import to match the on-disk filename casing (`@/components/ui/tooltip`), or rename the file consistently. Owner: phase 06/inspector plan.
- **Status:** Deferred — do NOT fix in 07-01.
