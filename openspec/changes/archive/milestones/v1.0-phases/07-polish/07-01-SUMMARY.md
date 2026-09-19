---
phase: 07-polish
plan: 01
subsystem: shell
tags: [backpressure-indicator, shell-02, theme, data-theme, accessibility]
dependency_graph:
  requires: [src/stores/runtime.ts, src/lib/utils.ts]
  provides: [src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx]
  affects: [src/components/shell/AppShell/AppShell.tsx]
tech_stack:
  added: []
  patterns: [nanostores-useStore, cn-classlist, role-status-aria-live, data-testid-scoping]
key_files:
  created:
    - src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx
    - src/tests/backpressure.spec.ts
  modified:
    - src/components/shell/AppShell/AppShell.tsx
decisions:
  - BackpressureIndicator is a pure derived view of runtimeAtom.running — no local state, no timers
  - Visibility driven by opacity-0 vs animate-pulse class toggle; GPU-composited, negligible cost
  - data-testid="backpressure-indicator" added so Playwright can scope past the StatusBar role="status" collision
  - AppShell edits (mount + data-theme useEffect line) consolidated into this plan's Task 2 to avoid parallel write conflict with 07-02
metrics:
  completed: 2026-05-24
  tasks_completed: 3
  files_created: 2
  files_modified: 1
commits:
  - hash: 6d6d3f5
    message: "feat(07-01): add BackpressureIndicator component for SHELL-02"
  - hash: e193ca4
    message: "feat(07-01): mount BackpressureIndicator + wire data-theme in AppShell"
  - hash: (task3)
    message: "feat(07-01): Playwright spec for SHELL-02 BackpressureIndicator"
verification:
  tsc: pass
  must_haves_met:
    - "BackpressureIndicator component exists and exports a named function"
    - "AppShell mounts it inside the role=application div"
    - "Visible (no opacity-0) when running=true, hidden when running=false"
    - "data-theme attribute now set on documentElement alongside .dark class"
notes:
  - "Execution interrupted twice by transient API errors (socket close, stream stall); Tasks 1-2 committed by the executor, Task 3 commit + this SUMMARY completed by the orchestrator after verifying tsc clean."
---

## Summary

Built `BackpressureIndicator` — a top-edge animated sliver that reads `runtimeAtom.running` and becomes visible during optimization runs (SHELL-02). Mounted in AppShell as the last child of the role="application" div. Also wired the `data-theme` attribute onto `documentElement` in AppShell's theme useEffect (consolidated here to avoid a parallel write conflict with 07-02's FOUC work).

## What Was Built

- `BackpressureIndicator.tsx` — pure derived component: `useStore(runtimeAtom)` → `opacity-0` (idle) vs `bg-[var(--color-accent)] animate-pulse` (running). `role="status"`, `aria-live="polite"`, `aria-label` set only when running.
- `AppShell.tsx` — imports + mounts the indicator; theme useEffect now sets both `.dark` class and `data-theme` attribute.
- `backpressure.spec.ts` — Playwright spec: hidden on load, visible after clicking "Optimize all". Scopes via `data-testid` to avoid StatusBar's `role="status"`.

## Verification

- `npx tsc -b --noEmit` → clean
- Component + AppShell mount confirmed in code
- Playwright "visible-after-click" test requires a running dev server — gated for the human checkpoint in 07-03
