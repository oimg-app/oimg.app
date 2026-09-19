---
phase: 11-batch-optimize-export
plan: 07
subsystem: export-ui
tags: [phase-11, wave-2, disable-then-explain, computed-atom, D-13, WCAG-AA]
requires: [11-00, 11-04, 11-05, 11-06]
provides: ["$hasDone computed atom", "Toolbar export controls gated by D-13"]
affects: [src/components/shell/Toolbar.tsx, src/stores/files.ts]
tech_stack:
  added: []
  patterns: ["nanostores computed atom matching existing $filteredFiles/$selectedFile/$totals shape"]
key_files:
  created:
    - src/tests/export-disabled.spec.ts
  modified:
    - src/stores/files.ts
    - src/components/shell/Toolbar.tsx
decisions:
  - "$hasDone is derived via nanostores `computed(filesAtom, ...)` — single source of truth, no component-local state"
  - "Tooltip copy: 'Optimize at least one file first' (user-facing, leaks no internal state)"
  - "Visual disabled treatment: opacity-50 cursor-not-allowed appended via existing `cn` helper"
  - "Inspector Download stays render-gated (Plan 04) — not attribute-gated — because Inspector content is selection-driven"
  - "Phase 12 stub menu items (Copy <picture>, Copy data URIs, Manifest JSON) intentionally not gated by D-13 in this plan"
metrics:
  duration_minutes: 8
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  completed_date: 2026-06-02
---

# Phase 11 Plan 07: D-13 Disable-Then-Explain Export Gating — Summary

D-13 implemented across both Toolbar export entry points via a single `$hasDone` nanostores computed atom, with WCAG-AA-compliant disabled + aria-disabled + title attributes; Inspector Download remains Plan-04 render-gated.

## What was built

- **`$hasDone` computed atom** (src/stores/files.ts) — derives `true` iff any entry has `status === 'done'`. Shape matches existing `$filteredFiles` / `$selectedFile` / `$totals` atoms (same `computed(filesAtom, …)` idiom).
- **Toolbar Export button gating** (src/components/shell/Toolbar.tsx) — three controls bound to `$hasDone`:
  - Main "Export" button (split-group primary): `disabled` + `aria-disabled` + `title="Optimize at least one file first"`
  - Popover "All as ZIP" menu item: same triple
  - Popover "Save individually" menu item: same triple
  - All three carry `opacity-50 cursor-not-allowed` visual treatment when disabled.
- **E2E spec** (src/tests/export-disabled.spec.ts, 5 tests, all green) — covers empty-load, queued-only, first-done-flip enables, "Save individually" parity, Inspector Download invisible-when-not-done.

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | feat | `ae156e0` | add $hasDone computed atom for D-13 export gating |
| 2 | feat | `5987106` | bind Toolbar export controls to $hasDone (D-13) |
| 3 | test | `0df8975` | D-13 export disable-then-explain e2e |

## Verification

- `./node_modules/.bin/tsc -b` → exit 0
- `npx playwright test src/tests/export-disabled.spec.ts --reporter=dot` → **PASS (5) FAIL (0)** in 153.8s
- `grep -c '^export const \$hasDone' src/stores/files.ts` → 1
- `grep -c "hasDone" src/components/shell/Toolbar.tsx` → 11 (well above the ≥1 minimum)
- Inspector ReportPanel (src/components/panels/inspector/ReportPanel.tsx) verified unchanged — Plan 04's `{selected && selected.status === 'done' && (…)}` conditional render still gates the Download button.

## Deviations from Plan

None — plan executed exactly as written. The Phase 12 stub menu items (Copy `<picture>`, Copy data URIs, Manifest JSON) were intentionally NOT gated, per plan scope (those are placeholder hooks; Phase 12 will introduce their own readiness gating).

## Carry-forward for Plan 08

- `$hasDone` is now part of the public store surface in `src/stores/files.ts`. Plan 08 (Status-Bar batch-progress indicator) can read it directly if needed for "ready to export" affordances.
- Toolbar disable pattern (`disabled` + `aria-disabled` + `title` + opacity class) is the project convention for future button-gating tasks.
- E2E helper `waitForHasDone(page, expected)` and `resetAllToQueued(page)` patterns are reusable for any test that needs to toggle the queued↔done store state.

## Self-Check: PASSED

- src/stores/files.ts — FOUND
- src/components/shell/Toolbar.tsx — FOUND
- src/tests/export-disabled.spec.ts — FOUND
- ae156e0 — FOUND in git log
- 5987106 — FOUND in git log
- 0df8975 — FOUND in git log
