---
phase: 01-foundation
plan: "03"
subsystem: ui
tags: [shadcn, radix-ui, ui-primitives, tailwind-v4, components]

# Dependency graph
requires:
  - phase: 01-foundation plan 01
    provides: node_modules, package.json
  - phase: 01-foundation plan 02
    provides: src/lib/utils.ts (cn() helper), src/index.css (CSS tokens)
provides:
  - src/components/ui/button.tsx
  - src/components/ui/separator.tsx
  - src/components/ui/tooltip.tsx
  - src/components/ui/popover.tsx
  - src/components/ui/slider.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/tabs.tsx
  - src/components/ui/input.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/switch.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/components/ui/context-menu.tsx
  - src/components/ui/menubar.tsx
  - src/components/ui/kbd.tsx
  - src/components/ui/resizable.tsx
  - src/components/ui/sonner.tsx
  - src/components/ui/spinner.tsx
affects:
  - Phase 1 Plan 04 (app shell + store scaffolding)
  - Phase 1 Plan 05 (AppShell — imports resizable, tabs, tooltip)
  - All downstream UI phases

# Tech tracking
tech-stack:
  added:
    - react-resizable-panels (resizable.tsx wrapper)
  patterns:
    - "shadcn CLI generation: npm exec -- shadcn@4.7.0 add <names> --overwrite --yes"
    - "All UI primitives import cn() from @/lib/utils"
    - "radix-lyra style + phosphor iconLibrary per components.json"

key-files:
  created:
    - src/components/ui/button.tsx
    - src/components/ui/resizable.tsx
    - src/components/ui/sonner.tsx
    - src/components/ui/kbd.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/slider.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/input.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/switch.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/context-menu.tsx
    - src/components/ui/menubar.tsx
    - src/components/ui/spinner.tsx
  modified:
    - package.json (react-resizable-panels added)
    - package-lock.json

key-decisions:
  - "Used npm exec -- shadcn@4.7.0 (not npx) because npm 11.x treats npx <pkg>@ver as a script name"
  - "14 of 17 components were already identical at HEAD; only checkbox, dropdown-menu, sonner needed updating"

patterns-established:
  - "shadcn CLI invocation: npm exec -- shadcn@4.7.0 add <components> --overwrite --yes"

requirements-completed: [SETUP-03]

# Metrics
duration: ~10min
completed: 2026-05-14
---

# Phase 1 Plan 3: Shadcn UI Component Primitives Summary

**17 shadcn/radix-lyra UI primitives generated via CLI and verified type-correct — complete component vocabulary for AppShell and all downstream phases**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-14T20:24:00Z
- **Completed:** 2026-05-14T20:34:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 UI components updated + package.json + package-lock.json; 14 already at HEAD)

## Accomplishments
- All 17 shadcn UI components generated via `shadcn@4.7.0` CLI using radix-lyra style + phosphor iconLibrary
- resizable.tsx wraps react-resizable-panels and exports ResizablePanelGroup, ResizablePanel, ResizableHandle
- Scoped TypeScript compile (--noEmit --skipLibCheck) exits 0 for all ui components
- 16 of 17 components import cn() from @/lib/utils

## Task Commits

Each task was committed atomically:

1. **Task 1: Run shadcn CLI to generate all 17 components** - `8a601c9` (feat)
2. **Task 2: TypeScript compile gate** - (no commit — compile-only, no file changes)

## Files Created/Modified
- `src/components/ui/button.tsx` - Button with cva variants
- `src/components/ui/resizable.tsx` - react-resizable-panels wrapper (ResizablePanelGroup, ResizablePanel, ResizableHandle)
- `src/components/ui/sonner.tsx` - Sonner toast container wrapper
- `src/components/ui/kbd.tsx` - Keyboard shortcut display primitive
- `src/components/ui/separator.tsx` - Horizontal/vertical separator
- `src/components/ui/tooltip.tsx` - Radix tooltip wrapper
- `src/components/ui/popover.tsx` - Radix popover wrapper
- `src/components/ui/slider.tsx` - Radix slider wrapper
- `src/components/ui/dialog.tsx` - Radix dialog wrapper
- `src/components/ui/tabs.tsx` - Radix tabs wrapper
- `src/components/ui/input.tsx` - Input primitive
- `src/components/ui/checkbox.tsx` - Radix checkbox wrapper
- `src/components/ui/switch.tsx` - Radix switch wrapper
- `src/components/ui/dropdown-menu.tsx` - Radix dropdown menu wrapper
- `src/components/ui/context-menu.tsx` - Radix context menu wrapper
- `src/components/ui/menubar.tsx` - Radix menubar wrapper
- `src/components/ui/spinner.tsx` - Loading spinner primitive

## Decisions Made
- Used `npm exec -- shadcn@4.7.0` instead of `npx shadcn@4.7.0` because npm 11.x interprets the latter as an npm script name, not a package runner
- 14 of 17 component files were already present and correct at HEAD (button, separator, tooltip, popover, slider, dialog, tabs, input, switch, context-menu, menubar, kbd, resizable, spinner); only checkbox, dropdown-menu, and sonner received updates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI invocation incompatibility with npm 11.x**
- **Found during:** Task 1
- **Issue:** `npx shadcn@4.7.0 add ...` fails with "Missing script: shadcn@4.7.0" in npm 11.x (it treats `shadcn@4.7.0` as an npm run script name)
- **Fix:** Used `npm exec -- shadcn@4.7.0 add ...` which works correctly
- **Files modified:** None (process fix only)
- **Verification:** CLI ran successfully, all 17 files confirmed present
- **Committed in:** 8a601c9

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Required substituting `npm exec` for `npx` — functionally equivalent, no scope change.

## Issues Encountered
- npm 11.x `npx <pkg>@<ver>` changed behavior interprets package name+version as a script name. Resolved by using `npm exec --`.

## Known Stubs

None — all 17 components are fully generated CLI output, not hand-rolled stubs.

## Threat Flags

None — UI primitive components only; no network endpoints, auth paths, or external data access introduced.

## Next Phase Readiness
- All 17 UI primitives available at `@/components/ui/<name>` for Plans 04 and 05
- AppShell can import from `@/components/ui/resizable` for the three-pane layout
- SETUP-03 requirement fulfilled

---
*Phase: 01-foundation*
*Completed: 2026-05-14*

## Self-Check: PASSED

- src/components/ui/button.tsx — FOUND
- src/components/ui/resizable.tsx — FOUND
- src/components/ui/sonner.tsx — FOUND
- src/components/ui/kbd.tsx — FOUND
- All 17 component files — FOUND (ls count: 17)
- Commit 8a601c9 — FOUND
- components.json UNCHANGED — VERIFIED
- TypeScript compile (scoped) — EXIT 0
