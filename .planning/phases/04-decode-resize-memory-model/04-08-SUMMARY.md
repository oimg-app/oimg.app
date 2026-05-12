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
| 2 | checkpoint:human-verify + post-verify bug fix | ea0d0b9 | src/components/panels/InspectorPane.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrapped perFileOverride selector with useShallow to prevent getSnapshot infinite loop**
- **Found during:** Post-checkpoint user verification (browser console error)
- **Issue:** `useSettingsStore((s) => selectedId ? (s.perFile[selectedId] ?? {}) : {})` returned a new `{}` object literal on every call when `selectedId` was null or the key was absent. Zustand's `useSyncExternalStore` requires stable snapshot references — the new object reference each render caused: `The result of getSnapshot should be cached to avoid an infinite loop`
- **Fix:** Added `import { useShallow } from 'zustand/react/shallow'` and wrapped the selector: `useSettingsStore(useShallow((s) => selectedId ? (s.perFile[selectedId] ?? {}) : {}))`
- **Files modified:** `src/components/panels/InspectorPane.tsx`
- **Commit:** ea0d0b9

## Known Stubs

None. The onToggle handler is fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The change is entirely within the React component layer, calling pre-existing store actions behind a user gesture boundary. Matches the threat model in the plan (T-04-08-01 and T-04-08-02 both accepted).

## Self-Check

- [x] `src/components/file-row/TargetDensityCheckboxes.tsx` modified
- [x] Commit 32fce5a exists
- [x] `src/components/panels/InspectorPane.tsx` fixed (useShallow)
- [x] Commit ea0d0b9 exists
- [x] TypeScript compiles with zero errors (`npx tsc --noEmit` exit 0)
- [x] TODO(P5) comment removed — handler calls store actions
- [x] getSnapshot infinite loop resolved — useShallow stabilizes object reference

## Self-Check: PASSED
