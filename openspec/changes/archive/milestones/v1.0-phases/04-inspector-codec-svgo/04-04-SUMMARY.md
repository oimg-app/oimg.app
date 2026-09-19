---
phase: 04-inspector-codec-svgo
plan: "04"
subsystem: inspector
tags: [svgo, plugin-list, settings, ui]
dependency_graph:
  requires: [04-01]
  provides: [INSP-06]
  affects: [src/components/panels/inspector/SvgoPanel.tsx]
tech_stack:
  added: []
  patterns: [settingsAtom, useStore, Section, togglePlugin]
key_files:
  created: []
  modified:
    - src/components/panels/inspector/SvgoPanel.tsx
decisions:
  - Vertical list layout per UI-SPEC (overrides PATTERNS.md 2-column grid suggestion)
  - button element for plugin rows (keyboard accessible, cursor-default per spec)
metrics:
  duration: "3min"
  completed: "2026-05-20"
  tasks: 1
  files: 1
---

# Phase 04 Plan 04: SvgoPanel INSP-06 Summary

**One-liner:** Full SvgoPanel with aggressive Switch wired to settingsAtom and 22 SVGO plugin rows with on/off accent/strikethrough visual states.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | SvgoPanel aggressive toggle + plugin list | `1ad079e` | `src/components/panels/inspector/SvgoPanel.tsx` |

## What Was Built

Replaced the Plan 01 stub (`SVGO — pending`) with the full INSP-06 implementation:

- **Section 1 — SVGO preset**: accent badge `preset-default`, aggressive mode Switch (`checked={settings.aggressive}` → `onCheckedChange={setAggressive}`), butteraugli subtext below toggle
- **Section 2 — Plugins**: dynamic title `Plugins · N / 22`, flex-col list of 22 plugin rows
- Each plugin row: `grid grid-cols-[16px_1fr_auto]` with 13×13px checkbox (accent fill + SVG checkmark when on), plugin id in font-mono (line-through + fg-3 when off), saves badge (accent when on, fg-3 when off)
- Click handler: `() => togglePlugin(p.id)` — uses immutable map in settings store

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — plugin data sourced from `settingsAtom.plugins` (seeded from `SVGO_PLUGINS` in stub-data.ts, 22 entries with real id/saves fields).

## Threat Flags

None — all data from static `SVGO_PLUGINS` constant; no user-controlled strings passed to togglePlugin.

## Self-Check: PASSED

- `src/components/panels/inspector/SvgoPanel.tsx` exists (83 lines, > 60 minimum)
- Commit `1ad079e` verified in git log
- No TypeScript errors in SvgoPanel.tsx (853 pre-existing errors in node_modules/@types/node only)
- Stub text "SVGO — pending" removed
