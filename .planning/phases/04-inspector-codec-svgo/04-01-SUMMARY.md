---
phase: 04-inspector-codec-svgo
plan: "01"
subsystem: stores/inspector-primitives
tags: [store, nanostores, settings, inspector, primitives, tdd]
dependency_graph:
  requires: [src/lib/stub-data.ts, src/stores/ui.ts]
  provides: [src/stores/settings.ts, src/components/panels/inspector/Section.tsx, src/components/panels/inspector/SegControl.tsx, src/components/panels/inspector/SvgoPanel.tsx]
  affects: [04-02-PLAN.md, 04-03-PLAN.md]
tech_stack:
  added: []
  patterns: [nanostores map + setKey, Wave-0 TDD, circular ESM guard, relative imports for Node compat]
key_files:
  created:
    - src/tests/settings.test.ts
    - src/stores/settings.ts
    - src/components/panels/inspector/Section.tsx
    - src/components/panels/inspector/SegControl.tsx
    - src/components/panels/inspector/SvgoPanel.tsx
  modified: []
decisions:
  - "Use relative import path (../lib/stub-data.ts) in settings.ts for Node --experimental-strip-types compat; @/ alias only resolves under Vite"
  - "SvgoPanel is a minimal stub (SVGO — pending) to unblock Wave-2 imports; full implementation deferred to 04-03"
  - "SegControl active state uses bg-[var(--color-bg-3)] not accent color per UI-SPEC"
metrics:
  duration: "6m 32s"
  completed_date: "2026-05-20"
  tasks_completed: 3
  files_created: 5
---

# Phase 04 Plan 01: settingsAtom + Inspector Primitives Summary

**One-liner:** nanostores settingsAtom (STORE-02) with 12 actions + togglePlugin, plus Section/SegControl/SvgoPanel inspector primitives.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave-0 unit tests for settingsAtom | dac93af | src/tests/settings.test.ts |
| 2 | settingsAtom store (STORE-02) | c3449fe | src/stores/settings.ts |
| 3 | Section, SegControl, SvgoPanel stub | 69ee5ef | src/components/panels/inspector/{Section,SegControl,SvgoPanel}.tsx |

## Verification Results

- `node --experimental-strip-types src/tests/settings.test.ts` → 17 passed, 0 failed
- `node --experimental-strip-types src/tests/stores.test.ts` → 63 passed, 0 failed (no regression)
- `node --experimental-strip-types src/tests/stub-data.test.ts` → 6 passed, 0 failed (no regression)
- `npx tsc --noEmit -p tsconfig.app.json` → 0 errors in new files (pre-existing errors in ui/tabs.tsx, ui/sonner.tsx, lib/utils.ts, ui/button.tsx are out-of-scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Node path alias resolution for @/ imports**
- **Found during:** Task 2 verification
- **Issue:** `settings.ts` used `@/lib/stub-data` for a value import (`SVGO_PLUGINS`). Node's `--experimental-strip-types` cannot resolve `@/` aliases (Vite-only); the test's `ERR_MODULE_NOT_FOUND` catch silently treated it as "stub state" — a false positive.
- **Fix:** Changed value imports to relative path `../lib/stub-data.ts`; re-exports also use relative path. Vite resolves both `@/` aliases and relative paths equally.
- **Files modified:** src/stores/settings.ts
- **Commit:** c3449fe

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/components/panels/inspector/SvgoPanel.tsx | Returns `<div>SVGO — pending</div>` | Interface-first ordering: stub exists so 04-02 InspectorPane import resolves. Full implementation in 04-03-PLAN.md. |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Settings are in-memory only. T-04-01 mitigated: `togglePlugin` maps immutably (`{...p, on: !p.on}`) — SVGO_PLUGINS array never mutated in place.

## Self-Check: PASSED

- src/tests/settings.test.ts — FOUND
- src/stores/settings.ts — FOUND
- src/components/panels/inspector/Section.tsx — FOUND
- src/components/panels/inspector/SegControl.tsx — FOUND
- src/components/panels/inspector/SvgoPanel.tsx — FOUND
- Commit dac93af — FOUND
- Commit c3449fe — FOUND
- Commit 69ee5ef — FOUND
