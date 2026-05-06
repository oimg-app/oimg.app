---
phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co
plan: "04"
subsystem: hooks
tags: [batch-orchestration, keyboard-shortcuts, worker-pool, refactor]
dependency_graph:
  requires: [10-01]
  provides: [useBatchOrchestrate, useKeyboardShortcuts]
  affects: [src/App.tsx]
tech_stack:
  added: []
  patterns: [zustand-subscribe-with-selector, useMemo-singleton, useEffect-subscriber]
key_files:
  created:
    - src/hooks/useBatchOrchestrate.ts
    - src/hooks/useKeyboardShortcuts.ts
  modified: []
decisions:
  - "computePluginSavings is a module-level private async function (not exported) to keep it co-located with the hook that depends on it"
  - "isAuxiliaryJob is a module-level private function (not exported) preserving the preview-/savings- discriminator from App.tsx"
  - "App.tsx NOT modified — removal deferred to Plan 05 per spec"
metrics:
  duration: 10min
  completed_date: "2026-05-06"
---

# Phase 10 Plan 04: useBatchOrchestrate + useKeyboardShortcuts Extraction Summary

**One-liner:** Batch orchestration (~400 LOC) and keyboard shortcuts extracted from App.tsx into two focused hooks with zero behaviour changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useBatchOrchestrate + useKeyboardShortcuts | 5661480 | src/hooks/useBatchOrchestrate.ts, src/hooks/useKeyboardShortcuts.ts |

## What Was Built

### src/hooks/useBatchOrchestrate.ts

- `computePluginSavings` — private module-level async function (verbatim from App.tsx lines 77-171). `SAVINGS_TIMEOUT_MS=5000` constant at module level. WR-08 timedOut guard preserved.
- `isAuxiliaryJob` — private module-level function guarding `preview-` / `savings-` prefixed pool jobs from inflating runtime-store batch counters.
- `useBatchOrchestrate()` — returns `{ startOptimize, cancelBatch, running }`:
  - Pool singleton via `useMemo(() => getWorkerPool({...}), [])` with onStarted/onDone/onError/onThrottle callbacks
  - Batch-completion subscriber `useEffect` with quartile ARIA cadence, batch-end toast, and microtask-deferred computePluginSavings call (Plan 03-D Rule 1 fix preserved)
  - Rename-collision subscriber `useEffect` firing toast.info per positive delta
  - `startOptimize` with SVG/PNG/stub routing, byteEstimate admission gate, DEV-only slowMs affordance
  - `cancelBatch` with pool.cancel() → cancelBatch() → announce ordering

### src/hooks/useKeyboardShortcuts.ts

- `useKeyboardShortcuts({ startOptimize, cancelBatch, cmdkOpen, setCmdkOpen, setOpen, setRowMenu })` — lifts keyboard handler from App.tsx, accepting actions as params to avoid prop-chaining `setCmdkOpen` through useBatchOrchestrate.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `ls src/hooks/useBatchOrchestrate.ts` — found
- `ls src/hooks/useKeyboardShortcuts.ts` — found
- `npx tsc --noEmit` — exits 0

## Self-Check: PASSED

- src/hooks/useBatchOrchestrate.ts: FOUND
- src/hooks/useKeyboardShortcuts.ts: FOUND
- Commit 5661480: confirmed in git log
