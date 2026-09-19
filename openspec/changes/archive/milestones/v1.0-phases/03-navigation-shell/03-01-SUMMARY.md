---
phase: 03-navigation-shell
plan: "01"
subsystem: stores + shell chrome
tags: [nanostores, react, toolbar, statusbar, runtime-atom, ui-atom]
dependency_graph:
  requires: [02-02-SUMMARY.md]
  provides: [runtimeAtom, startRun, stopRun, pushToast, dismissToast, Toolbar, StatusBar]
  affects: [AppShell, stores/index.ts, all future Plan 02/03 chrome]
tech_stack:
  added: []
  patterns: [nanostores map + setKey actions, useStore(runtimeAtom) in StatusBar, startRun as onClick handler]
key_files:
  created:
    - src/stores/runtime.ts
    - src/components/shell/Toolbar/Toolbar.tsx
    - src/components/shell/StatusBar/StatusBar.tsx
    - src/tests/navigation.spec.ts
    - src/tests/stores.test.ts
  modified:
    - src/stores/ui.ts
    - src/stores/index.ts
    - src/components/shell/AppShell/AppShell.tsx
decisions:
  - "closeCmdk() only sets cmdkOpen=false; preserves cmdkQ so user sees last query on reopen"
  - "pushToast id generated as String(Date.now() + Math.random()) — no external dep"
  - "className='dark' left hardcoded on AppShell; data-theme effect deferred to Plan 03"
  - "playwright.preview.config.ts added to run nav tests against dist/preview (port 5174) since main repo dev server occupies 5173"
  - "Pre-existing tsc casing error in FilesPane.tsx (popover vs Popover) logged as deferred — out of scope for this plan"
metrics:
  duration: "~12min"
  completed: "2026-05-17T21:48:51Z"
  tasks_completed: 3
  files_created: 5
  files_modified: 3
---

# Phase 03 Plan 01: Navigation Shell — Store Actions + Minimal Toolbar/StatusBar Slice Summary

**One-liner:** Fill 10 ui.ts action stubs and ship runtimeAtom + minimal Toolbar/StatusBar chrome so clicking "Optimize all" visibly flips the worker pip from accent-green to info-blue.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Wave-0 test scaffolds | 9b503fc | navigation.spec.ts, stores.test.ts |
| 1 | Fill ui.ts stubs + runtimeAtom + barrel | 2fc2bb0 | ui.ts, runtime.ts, index.ts |
| 2 | Minimal Toolbar + StatusBar in AppShell | 3114a9e | Toolbar.tsx, StatusBar.tsx, AppShell.tsx |

---

## Verification Results

- `npx tsc --noEmit` exits 0
- `node --experimental-strip-types src/tests/stores.test.ts` — 23 passed, 0 failed
- `npx playwright test navigation.spec.ts --project=chromium` — 3/3 PASS
- Vite build: 4714 modules, 371 KB JS, built in 1.89s

---

## What Was Built

### STORE-03: ui.ts action bodies (10 stubs filled)

All 10 `/* @TODO Phase 3 */` stubs replaced with real `uiAtom.setKey()` calls:
- `setOpen`, `setView`, `setTab`, `setSplit`, `setZoom`
- `openCmdk` (sets cmdkOpen=true, cmdkQ='', cmdkSel=0 in three setKey calls)
- `closeCmdk` (sets cmdkOpen=false only — preserves cmdkQ for reopen)
- `setCmdkQuery`, `setCmdkSel`, `setTheme`

### STORE-04: runtime.ts (new)

`runtimeAtom = map<RuntimeState>({ running: false, toasts: [] })` with 4 actions:
- `startRun()` / `stopRun()` — toggle running flag
- `pushToast(msg, meta?)` — immutable append with unique string id
- `dismissToast(id)` — immutable filter

### Minimal Toolbar (NAV-02 slice)

`data-testid="toolbar"`, role="toolbar", one primary button "Optimize all" with `onClick={startRun}` and Lightning icon. Height h-11, accent background.

### Minimal StatusBar (NAV-03 slice)

`data-testid="statusbar"`, role="status", aria-live="polite". Worker pip with `data-testid="worker-pip"` and dynamic aria-label `Worker status: Idle|Running`. Pip color: accent (idle) vs info + animate-pulse (running).

### AppShell layout

Vertical order: Toolbar, ResizablePanelGroup, StatusBar. `className="dark"` preserved.

---

## Deviations from Plan

### Auto-handled Issues

**1. [Rule 3 - Blocking] Playwright tests needed preview server on alternate port**
- **Found during:** Task 2 verification
- **Issue:** Existing dev server on port 5173 serves main repo (no Toolbar/StatusBar). `reuseExistingServer: true` in playwright.config.ts prevented auto-start.
- **Fix:** Built dist with `vite build`, started `vite preview` on port 5174, created `playwright.preview.config.ts` pointing to 5174.
- **Files modified:** playwright.preview.config.ts (new, worktree-only temp artifact)
- **Commit:** included in 3114a9e

### Deferred (Out of Scope)

**Pre-existing tsc casing issue:** `FilesPane.tsx` imports `@/components/ui/popover` but file is `Popover.tsx`. This causes `tsc -b` to emit a casing error but does NOT block vite build or any functionality. This existed before Plan 01 and is out of scope.

---

## Known Stubs

None — all components in this plan render from real store state. `className="dark"` on AppShell is intentional (theme effect deferred to Plan 03, per plan spec).

---

## Threat Surface Scan

T-03-01 (mitigate): "Optimize all" button label is a static JSX text node — no interpolation. No unsafe HTML injection anywhere in shell components (grep confirms 0 matches).

T-03-02 (mitigate): StatusBar pip aria-label interpolates only the boolean `running` as "Idle"/"Running" — both React text node escaped. No external string reaches this surface.

No new threat surface introduced beyond the plan's threat model.

---

## Self-Check: PASSED

- src/stores/runtime.ts — FOUND
- src/components/shell/Toolbar/Toolbar.tsx — FOUND
- src/components/shell/StatusBar/StatusBar.tsx — FOUND
- src/tests/navigation.spec.ts — FOUND
- src/tests/stores.test.ts — FOUND
- Commit 9b503fc — FOUND (git log confirms)
- Commit 2fc2bb0 — FOUND
- Commit 3114a9e — FOUND
