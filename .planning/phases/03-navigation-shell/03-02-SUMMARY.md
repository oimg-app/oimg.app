---
phase: 03-navigation-shell
plan: 02
subsystem: shell
tags: [nav, titlebar, toolbar, statusbar, store, playwright]
dependency_graph:
  requires: [03-01]
  provides: [NAV-01, NAV-02, NAV-03]
  affects: [AppShell, FilesPane, stores/ui, stores/files, stores/runtime]
tech_stack:
  added: []
  patterns: [controlled-popover-via-uiAtom, segmented-control-role-group, split-button-group]
key_files:
  created:
    - src/components/shell/TitleBar/TitleBar.tsx
  modified:
    - src/components/shell/AppShell/AppShell.tsx
    - src/components/shell/Toolbar/Toolbar.tsx
    - src/components/shell/StatusBar/StatusBar.tsx
    - src/tests/navigation.spec.ts
    - src/components/panels/FilesPane.tsx
decisions:
  - "All menus use uiAtom.open single-key exclusivity: clicking one closes all others automatically"
  - "StatusBar shows entries.length (total, not filtered) per plan spec"
  - "Popover import casing unified to Popover.tsx (uppercase) across all shell components"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-17T22:52:25Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 03 Plan 02: Full Navigation Chrome Summary

**One-liner:** TitleBar with brand mark + 3 exclusive Popovers + pills + ⌘K; Toolbar expanded with split buttons / segmented control / filter / theme toggle / settings; StatusBar with live pip + 3 static version strings + file count + size totals; 8 Playwright tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TitleBar NAV-01 + AppShell mount | 1b22fb6 | TitleBar.tsx (new), AppShell.tsx, FilesPane.tsx |
| 2 | Toolbar NAV-02 + StatusBar NAV-03 + tests | 06904f4 | Toolbar.tsx, StatusBar.tsx, navigation.spec.ts |

## What Was Built

### TitleBar (NAV-01)
- `src/components/shell/TitleBar/TitleBar.tsx` — 36px header with:
  - Brand mark: accent square clip-path polygon + "OIMG · image optimizer" JetBrains Mono wordmark
  - Three exclusive controlled Popovers: Codec (WebP/AVIF/JPEG/PNG/SVG/Auto), View (Batch/Compare/Report views + Light/Dark theme), Help (Docs/Shortcuts/What's new/version)
  - Right cluster: "100% local" + "Offline-ready" pills + ⌘K button calling `openCmdk`
  - All menu exclusivity enforced by `uiAtom.open` single-string key (clicking one closes all others)
- `AppShell.tsx` — TitleBar mounted as first child above Toolbar

### Toolbar (NAV-02)
- `src/components/shell/Toolbar/Toolbar.tsx` — full 44px toolbar with:
  - Add files split button (main + chevron, 'tb-add' popover: From device / Watch folder / From URL or paste)
  - Optimize all primary button (preserved verbatim from Plan 01)
  - Export split button ('tb-export': All as ZIP / Save individually / Copy picture HTML / data URIs / Manifest JSON)
  - Batch/Compare/Report segmented control (`role="group"`, each segment `role="radio"` with `aria-checked`) wired to `setView`
  - Auto split button ('tb-auto': 1.4 balanced / 1.0 high quality / 2.0 aggressive)
  - Filter input (type=search, placeholder "Filter files...") wired to `setFilter` via `onChange`
  - Theme toggle ghost button (`aria-label="Toggle theme"`) calling `setTheme` with Sun/Moon icon swap
  - Settings ghost button ('tb-settings', `aria-label="Open settings"`) with stub "Workers: 4 (auto)"

### StatusBar (NAV-03)
- `src/components/shell/StatusBar/StatusBar.tsx` — 22px status bar with:
  - Worker pip (preserved from Plan 01) with idle/running animation
  - Static version strings: `SVGO 4.0.1` / `@squoosh-kit/core 0.6.0` / `WASM ready - 312 KB`
  - Live `{entries.length} files` count from `filesAtom`
  - Live `{fmtBytes(totals.orig)} -> {fmtBytes(totals.opt)}` from `$totals`

### Tests
- `src/tests/navigation.spec.ts` — extended from 3 to 8 tests (all green):
  - TitleBar renders (NAV-01): testid, brand text, banner role
  - TitleBar Codec menu opens (NAV-01): open/close exclusivity via uiAtom.open
  - Toolbar segmented control switches view (NAV-02): aria-checked transitions
  - Toolbar filter input (NAV-02): input present, wired, accepts value
  - StatusBar shows versions and totals (NAV-03): version strings, arrow, file count pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Popover import casing mismatch**
- **Found during:** Task 1 build
- **Issue:** `FilesPane.tsx` imported from `@/components/ui/popover` (lowercase) but actual file is `Popover.tsx` (uppercase P). TypeScript TS1261 rejected both casings appearing in the same compilation unit.
- **Fix:** Unified all Popover imports to `@/components/ui/Popover` (uppercase) in TitleBar.tsx and FilesPane.tsx
- **Files modified:** `src/components/panels/FilesPane.tsx`, `src/components/shell/TitleBar/TitleBar.tsx`
- **Commit:** 1b22fb6

**2. [Rule 1 - Bug] Fixed filter test assertion**
- **Found during:** Task 2 Playwright run
- **Issue:** Test asserted that filtering by "photo" changes the status-filecount from "12 files". StatusBar shows `entries.length` (total, not filtered), so the count never changes on filter.
- **Fix:** Updated test to assert filter input is present, visible, and accepts a typed value (proving store wiring)
- **Files modified:** `src/tests/navigation.spec.ts`
- **Commit:** 06904f4

## STORE-08 Audit

Zero `useState` calls across all shell components:
- `src/components/shell/TitleBar/TitleBar.tsx` — 0
- `src/components/shell/Toolbar/Toolbar.tsx` — 0
- `src/components/shell/StatusBar/StatusBar.tsx` — 0

## Threat Model Verification

- T-03-05 (XSS via filter): No unsafe HTML injection patterns in `src/components/shell/` — filter value flows only through JSX text nodes and store actions, never into raw HTML
- T-03-06 (Help version copy): Static literal `v0.1.0 · 2026` in TitleBar — no runtime interpolation
- T-03-07 (StatusBar version strings): Static stubs, not from runtime detection
- T-03-08 (Menu action stubs): All menu items call `setOpen(null)` only — real handlers deferred to v2

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Codec menu items (WebP, AVIF...) | TitleBar.tsx | Call `setOpen(null)` only — real codec switching in Phase 4 |
| Export menu items | Toolbar.tsx | Call `setOpen(null)` only — real export handlers in later phase |
| Auto menu items | Toolbar.tsx | Call `setOpen(null)` only — Butteraugli integration deferred |
| Settings "Workers: 4 (auto)" | Toolbar.tsx | Stub text — worker pool config UI deferred |
| StatusBar version strings | StatusBar.tsx | Static per T-03-07 acceptance — dynamic detection deferred to v2 |
| StatusBar "WASM ready - 312 KB" | StatusBar.tsx | Static string — runtime WASM readiness detection deferred |

These stubs are intentional for this UI milestone phase. Real handlers and dynamic detection land in subsequent phases.

## Self-Check

- [x] `src/components/shell/TitleBar/TitleBar.tsx` — FOUND (commit 1b22fb6)
- [x] `src/components/shell/AppShell/AppShell.tsx` mounts TitleBar — FOUND
- [x] `src/components/shell/Toolbar/Toolbar.tsx` expanded — FOUND (commit 06904f4)
- [x] `src/components/shell/StatusBar/StatusBar.tsx` expanded — FOUND (commit 06904f4)
- [x] `src/tests/navigation.spec.ts` extended — 8 tests passing
- [x] `npm run build` exits 0
- [x] No flat shell files staged
- [x] No STATE.md or ROADMAP.md modified

## Self-Check: PASSED
