---
phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co
plan: "02"
subsystem: ui
tags: [react, hooks, file-picker, drag-drop, zustand]

requires:
  - phase: 04-decode-resize-memory-model
    provides: addSourceWithVariants, memory-budget admission gate
  - phase: 10-01
    provides: phase context and hook directory established

provides:
  - useFilePicker hook at src/hooks/useFilePicker.ts
  - formatFromFile and ingestDroppedFiles as private module helpers
  - fileInputRef, handleFilePick, handleDrop, handleDragOver, handleDragLeave API

affects:
  - 10-03-FilePanel (will consume useFilePicker)
  - App.tsx slim-down (Plan 05)

tech-stack:
  added: []
  patterns:
    - "Hook extraction pattern: module-level App.tsx helpers become private functions inside a hook file"
    - "useRef<HTMLInputElement | null>(null) pattern for file input delegation"

key-files:
  created:
    - src/hooks/useFilePicker.ts
  modified: []

key-decisions:
  - "handleDragLeave added as stub (not in App.tsx) — FilePanel will use it for drag-over visual state"
  - "DragEvent and RefObject imported from react (not React namespace) per plan spec"
  - "App.tsx copies of formatFromFile/ingestDroppedFiles remain untouched — removal deferred to Plan 05"

patterns-established:
  - "Private helpers in hook file: formatFromFile and ingestDroppedFiles are module-level but not exported"

requirements-completed: []

duration: 5min
completed: 2026-05-06
---

# Phase 10 Plan 02: useFilePicker Hook Extraction Summary

**useFilePicker hook extracting formatFromFile, ingestDroppedFiles, and all drag-drop/file-pick handlers from App.tsx into src/hooks/useFilePicker.ts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-06T21:30:00Z
- **Completed:** 2026-05-06T21:35:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created src/hooks/useFilePicker.ts with all file-pick logic extracted verbatim from App.tsx
- Hook exposes fileInputRef, handleFilePick, handleDrop, handleDragOver, handleDragLeave
- Private helpers formatFromFile and ingestDroppedFiles are module-scoped, not exported
- TypeScript compiles clean with no errors

## Task Commits

1. **Task 1: Create useFilePicker hook** - `94eec12` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/hooks/useFilePicker.ts` - Standalone hook with file-pick, drag-drop, and ingest logic

## Decisions Made

- `handleDragLeave` added as a no-op stub — not present in App.tsx but needed by FilePanel for drag-over visual state (per plan spec)
- `DragEvent` and `RefObject` imported directly from `react` package (not React namespace import) per plan spec
- App.tsx copies remain untouched — Plan 05 will perform the actual removal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- useFilePicker hook is ready for consumption by FilePanel (Plan 03)
- App.tsx still has its own copies of formatFromFile/ingestDroppedFiles — Plan 05 will remove them during App.tsx slim-down

---
*Phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co*
*Completed: 2026-05-06*
