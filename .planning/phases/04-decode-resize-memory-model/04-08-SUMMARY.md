---
phase: 04-decode-resize-memory-model
plan: 08
subsystem: file-row/inspector
tags: [density-variants, store-wiring, inspector, TargetDensityCheckboxes]
dependency_graph:
  requires: [04-07]
  provides: [PIPE-04-live-toggle]
  affects: [src/components/file-row/TargetDensityCheckboxes.tsx]
tech_stack:
  added: []
  patterns: [zustand-useShallow-selector, async-store-action-void]
key_files:
  created: []
  modified:
    - src/components/file-row/TargetDensityCheckboxes.tsx
decisions:
  - "Used void operator on addSourceWithVariants call to explicitly discard the Promise — avoids floating-promise lint warnings without adding await (component is not async)"
  - "Resolved sourceBlob ref via family.find(e => e.targetDensity === sourceDensity) ?? family[0] to always use the original source entry when available"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-12"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 1
---

# Phase 04 Plan 08: Wire TargetDensityCheckboxes onToggle Summary

Wire the TODO(P5) stub in TargetDensityCheckboxes.tsx so toggling a density checkbox calls addSourceWithVariants (check) or removeFile/removeFamily (uncheck) in the files store.

## What Was Built

The `onToggle` handler in `TargetDensityCheckboxes.tsx` was previously an empty no-op with a `TODO(P5)` comment. This plan wires it to three store actions:

- **Check path** (density not in targetSet): calls `addSourceWithVariants({ sourceBlob, sourceDensity, name, format, targets: [density] })` — fans out a new variant row using the shared sourceBlob from the source-density family member.
- **Uncheck path, siblings remain** (`family.length > 1`): calls `removeFile(toRemove.id)` — removes only the one variant row.
- **Uncheck path, last variant** (`family.length === 1`): calls `removeFamily(selectedFamilyId)` — removes the entire family to avoid an orphaned family with zero entries.
- **Guard**: returns early if `selectedFamilyId` is undefined or `family` is empty.
- **Locked density**: the existing `onClick` guard (`if (locked) return`) prevents `onToggle` from being called for the source density button.

Store actions selector added via `useShallow` — consistent with the existing family selector pattern already in the component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire onToggle in TargetDensityCheckboxes | 32fce5a | src/components/file-row/TargetDensityCheckboxes.tsx |
| 2 | checkpoint:human-verify | — | (awaiting user verification) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The onToggle handler is fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The change is entirely within the React component layer, calling pre-existing store actions behind a user gesture boundary. Matches the threat model in the plan (T-04-08-01 and T-04-08-02 both accepted).

## Self-Check

- [x] `src/components/file-row/TargetDensityCheckboxes.tsx` modified
- [x] Commit 32fce5a exists
- [x] TypeScript compiles with zero errors (`npx tsc --noEmit` exit 0)
- [x] TODO(P5) comment removed — handler calls store actions

## Self-Check: PASSED
