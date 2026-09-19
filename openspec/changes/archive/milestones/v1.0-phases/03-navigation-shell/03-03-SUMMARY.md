---
phase: 03-navigation-shell
plan: "03"
subsystem: navigation-shell
tags: [command-palette, keyboard-nav, theme-switching, nanostores, cmdk, shell-03, nav-04, store-03, store-07]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [command-palette, $cmdFlat, registerCommands, html-data-theme, global-keydown]
  affects: [AppShell, ui-store, main-bootstrap]
tech_stack:
  added: [src/lib/commands.ts (ALL_COMMANDS registry)]
  patterns: [nanostores computed atom, type-only import ESM guard, role=searchbox, dynamic dark class]
key_files:
  created:
    - src/lib/commands.ts
    - src/components/shell/CommandPalette/CommandPalette.tsx
  modified:
    - src/stores/ui.ts
    - src/main.tsx
    - src/components/shell/AppShell/AppShell.tsx
    - src/tests/stores.test.ts
    - src/tests/navigation.spec.ts
decisions:
  - "type-only import (import type) in ui.ts prevents runtime ESM cycle; Vite erases type-only imports at build time"
  - "commands.ts uses relative imports not @/ aliases so Node --experimental-strip-types resolves without Vite"
  - "input role=searchbox explicit attribute added so Playwright getByRole('searchbox') resolves correctly"
  - "Popover.tsx renamed to popover.tsx to fix tsc -b TS1261 blocking build (pre-existing casing conflict)"
  - "dynamic dark class: cn(theme==='dark' && 'dark', '...') preserves foundation.spec.ts assertion while enabling light theme"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-17T23:49:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 5
---

# Phase 03 Plan 03: Command Palette + Theme Wire Summary

**One-liner:** $cmdFlat computed atom + ALL_COMMANDS registry (8 items/3 groups) + CommandPalette modal with full keyboard nav + html data-theme effect via nanostores, zero useState in shell components.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | $cmdFlat + registerCommands; ALL_COMMANDS; main.tsx boot | 661b293 | ui.ts, commands.ts, main.tsx, stores.test.ts |
| 2 | CommandPalette modal + AppShell theme/keydown wiring | bc3214a | CommandPalette.tsx, AppShell.tsx, navigation.spec.ts, popover.tsx |

## Task 3

**Status:** Awaiting human verification (checkpoint:human-verify)

Task 3 is a checkpoint — the developer must manually verify all 5 Phase 3 success criteria.

## Verification Results

- `npx tsc --noEmit` — exits 0
- `npm run build` — exits 0 (build passes, CSS var() warning is cosmetic only)
- `node --experimental-strip-types src/tests/stores.test.ts` — 63 assertions pass
- `npx playwright test navigation.spec.ts foundation.spec.ts --project=chromium` — 18/18 pass (0 fail)
- `grep -rc "useState" src/components/shell/` — 0 (STORE-08 holds)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed input missing role="searchbox" attribute**
- **Found during:** Task 2 verification (2 Playwright tests timing out at 30s)
- **Issue:** input with aria-label="Search commands" had implicit ARIA role textbox not searchbox; getByRole('searchbox') timed out
- **Fix:** Added role="searchbox" attribute to the CommandPalette search input
- **Files modified:** src/components/shell/CommandPalette/CommandPalette.tsx
- **Commit:** bc3214a (included in Task 2 commit)

**2. [Rule 3 - Blocking] Renamed Popover.tsx to popover.tsx (case conflict)**
- **Found during:** Task 2 build verification (npm run build)
- **Issue:** Pre-existing TS1261 error — Popover.tsx vs popover.tsx differ only in casing; imports used lowercase but file was uppercase on macOS
- **Fix:** Physical rename via temp file + git hash-object/git update-index to register lowercase name in git index
- **Files modified:** src/components/ui/popover.tsx (rename from Popover.tsx)
- **Commit:** bc3214a

**3. [Rule 1 - Bug] commands.ts uses relative imports instead of @/ aliases**
- **Found during:** Task 1 verification (Node test runner could not resolve @/ alias)
- **Issue:** commands.ts with @/stores/ui import fails under node --experimental-strip-types because Vite path alias is not available in Node
- **Fix:** Changed to relative imports (../stores/ui.ts, ../stores/runtime.ts)
- **Files modified:** src/lib/commands.ts
- **Commit:** 661b293

## Known Stubs

None. All command do() functions are wired to real store actions. "Add files" do() is intentionally a no-op as the file picker integration is Phase 4 scope.

## Threat Surface Scan

All threats in the plan threat model are mitigated:
- T-03-09: JSX text nodes only, no inline HTML injection
- T-03-10: substring match only, no regex from user input
- T-03-11: addEventListener + removeEventListener both present in AppShell
- T-03-12: theme value constrained by TypeScript union type
- T-03-13: accepted (cosmetic only)
- T-03-14: accepted (registerCommands called once at boot)

No new threat surface introduced.

## Self-Check

- [x] src/lib/commands.ts — FOUND
- [x] src/components/shell/CommandPalette/CommandPalette.tsx — FOUND
- [x] src/stores/ui.ts — modified, $cmdFlat + registerCommands FOUND
- [x] src/main.tsx — registerCommands(ALL_COMMANDS.flatMap...) FOUND
- [x] src/components/shell/AppShell/AppShell.tsx — data-theme + keydown + CommandPalette FOUND
- [x] Commits 661b293 and bc3214a — FOUND in git log

## Self-Check: PASSED
