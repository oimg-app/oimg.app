---
phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co
plan: 01
subsystem: ui
tags: [zustand, react, typescript, settings-store, codec]

requires:
  - phase: 04-decode-resize-memory-model
    provides: useSettingsStore with resize slice (pattern for new codec slice)

provides:
  - useSettingsStore.codec slice with label/quality/method/lossless + setCodec action
  - CodecPanel reading codec settings from store instead of props
  - App() with 4 fewer useState calls (codec, q, method, lossless)

affects: [phase-05-raster-encoders, phase-10-remaining-plans]

tech-stack:
  added: []
  patterns:
    - "Store slice pattern: CodecSlice interface + setCodec(patch) merge action, following setResize precedent"
    - "Component store connection: useSettingsStore selectors inline in function body, getState().setCodec in callbacks"

key-files:
  created: []
  modified:
    - src/stores/settings.ts
    - src/components/panels/CodecPanel.tsx
    - src/App.tsx

key-decisions:
  - "CodecSlice interface defined locally in settings.ts (store-internal) — not re-exported from @/types, same pattern as CodecSettingsWebp etc."
  - "setCodec callbacks use getState() pattern (not inline selector) per zustand best practice for event handlers"
  - "resizeOn/w/h/alg/fit/stripMeta/keepIcc left as App() local state + CodecPanel props for now — wiring those to store is follow-up work documented with TODO comment"

patterns-established:
  - "Store-connected panel: remove prop pairs, add import useSettingsStore, add selectors at top of function body"

requirements-completed: []

duration: 10min
completed: 2026-05-06
---

# Phase 10 Plan 01: Codec Store Migration Summary

**Codec panel prop-drilling eliminated: useSettingsStore.codec slice with label/quality/method/lossless wired to CodecPanel, removing 4 useState calls from App()**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-06T00:00:00Z
- **Completed:** 2026-05-06T00:10:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added CodecSlice interface + codec field + setCodec action to useSettingsStore following the setResize pattern
- Rewrote CodecPanel to import useSettingsStore and read codec/q/method/lossless from store via selectors
- Removed 4 useState calls from App() (codec, q, method, lossless) and updated all 3 downstream usages (setCodecFromMenu, TitleBar codec prop, delta-strip display)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add codec slice to useSettingsStore** - `3480ba2` (feat)
2. **Task 2: Rewrite CodecPanel to use store directly + remove codec useState from App()** - `7d0b522` (feat)

## Files Created/Modified
- `src/stores/settings.ts` - Added CodecLabel import, CodecSlice interface, codec field, setCodec action
- `src/components/panels/CodecPanel.tsx` - Removed codec/q/method/lossless props, added useSettingsStore selectors
- `src/App.tsx` - Removed 4 useState calls, updated setCodecFromMenu + TitleBar + delta-strip to use store

## Decisions Made
- CodecSlice defined locally in settings.ts — consistent with keeping store-internal shape out of public @/types
- setCodec callbacks use `useSettingsStore.getState().setCodec(...)` pattern (not closures over selectors) — correct for event handlers per zustand docs
- resizeOn/w/h/alg/fit/stripMeta/keepIcc NOT migrated in this plan — they remain as App() local state passed to CodecPanel; a TODO comment documents the follow-up migration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- useSettingsStore.codec slice is ready for Phase 5 raster encoders to read via `useSettingsStore.getState().codec`
- CodecPanel is now store-connected — future plans can extend the codec slice without touching CodecPanel props
- Remaining App() local state (resizeOn/w/h/alg/fit etc.) documented for follow-up in Phase 10

## Self-Check: PASSED
- `src/stores/settings.ts` contains codec slice with setCodec action
- `src/components/panels/CodecPanel.tsx` imports useSettingsStore and uses store selectors
- `src/App.tsx` has 0 occurrences of useState<CodecLabel>
- TypeScript compiles clean (npx tsc --noEmit exits 0)
- Commits 3480ba2 and 7d0b522 exist in git log

---
*Phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co*
*Completed: 2026-05-06*
