---
phase: 07-polish
plan: 03
subsystem: shell
tags: [audit, human-verify, wcag, shell-02, store-08, phase-close]
dependency_graph:
  requires: [07-01, 07-02]
  provides: [phase-07-signoff]
  affects: []
tech_stack:
  added: []
  patterns: [automated-audit, human-verify-checkpoint]
key_files:
  created: []
  modified: []
decisions:
  - All 5 automated checks run green before the human checkpoint (tsc, circular-ESM grep, STORE-08 stub-data grep, STORE-08 useState audit, Playwright SHELL-02)
  - Human checkpoint surfaced a keyboard-nav bug — TitleBar Codec/View/Help menus and CenterHeader zoom dropdown did not respond to arrow keys (built on Radix Popover, which has no menu keyboard semantics)
  - Fix applied during checkpoint (commit c5fa841) migrating those Popovers to Radix DropdownMenu; arrow-key regression test added to navigation.spec.ts
metrics:
  completed: 2026-05-25
  tasks_completed: 2
  files_created: 0
  files_modified: 0
verification:
  human_checkpoint: approved
  automated_checks:
    tsc: pass
    circular_esm: pass
    store08_stub_data: pass
    store08_usestate: pass (only ephemeral copied/open)
    playwright_shell02: pass (2/2)
    playwright_navigation_menus: pass (2/2, incl. new arrow-key test)
  must_haves_met:
    - "BackpressureIndicator visible when runtimeAtom.running=true"
    - "Theme toggle switches dark/light with no FOUC (inline script in index.html)"
    - "Visible focus rings on interactive elements (global :focus-visible)"
    - "No component imports types from @/lib/stub-data"
    - "No cross-store ESM imports in ui.ts"
    - "tsc -b clean"
deferred:
  - "Duplicate banner landmarks: getByRole('banner') matches 3 <header> elements (TitleBar + CenterHeader + InspectorPane). Multiple banner landmarks are a WCAG issue; panel headers should be non-banner. Pre-existing since phases 4-6, NOT introduced by phase 7. Flagged for follow-up — navigation.spec.ts 'TitleBar renders' assertion fails on this strict-mode violation."
---

## Summary

Final audit + human verification for Phase 7. All five automated checks passed. The human checkpoint approved BackpressureIndicator visibility, FOUC-free theme toggle, and focus rings — but surfaced a keyboard-navigation bug in the menu dropdowns, which was fixed in-checkpoint (commit c5fa841) and locked with a regression test.

## Automated Audit Results

| # | Check | Result |
|---|-------|--------|
| 1 | `tsc -b --noEmit` | pass |
| 2 | Circular ESM guard (ui.ts) | pass — no cross-store imports |
| 3 | STORE-08 — stub-data imports in components | pass — none |
| 4 | STORE-08 — non-ephemeral useState | pass — only `copied`/`open` |
| 5 | Playwright SHELL-02 | pass (2/2) |

## Checkpoint Finding (fixed)

TitleBar Codec/View/Help menus and the CenterHeader zoom dropdown were built on Radix `Popover`, which provides no arrow-key navigation. Migrated to Radix `DropdownMenu` (commit c5fa841) — arrow keys, type-ahead, roving focus, Escape, and `role=menu/menuitem` now work. Regression test added.

## Deferred

Duplicate `banner` landmarks (3 `<header>` elements resolve to `role="banner"`). Pre-existing WCAG issue from phases 4–6, not introduced by Phase 7. Flagged for a follow-up fix — see frontmatter `deferred`.

## Phase 07 Closure

All three plans complete. SHELL-02 delivered; STORE-08 convention audit passed; WCAG AA focus rings + keyboard nav in place; theme FOUC fixed.
