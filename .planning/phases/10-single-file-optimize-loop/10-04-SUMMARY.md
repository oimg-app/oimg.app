---
phase: 10-single-file-optimize-loop
plan: "04"
subsystem: components
tags: [dropzone, drag-drop, file-picker, useIngest, FilesPane, Toolbar, OPT-01]
dependency_graph:
  requires: ["10-03"]
  provides: ["OPT-01 SC-1/2/3", "D-04", "D-06/D-07", "file-input DOM seam"]
  affects:
    - src/components/panels/FilesPane.tsx
    - src/components/shell/Toolbar.tsx
    - src/hooks/useOptimize.ts
    - src/tests/ingest.spec.ts
tech_stack:
  added: []
  patterns:
    - "dragover preventDefault + stopPropagation enables drop (Pitfall 3)"
    - "dragleave relatedTarget guard: !e.currentTarget.contains(e.relatedTarget as Node) (Pitfall 1)"
    - "hidden <input data-testid=file-input> as picker fallback; openPicker(trigger) callback contract"
    - "dragActive useState for ephemeral UI state (STORE-08 allowed)"
    - "page.setInputFiles on hidden input replaces ingestFixtureFiles for SC-1/D-06-D-07 tests"
    - "waitForFunction + opt-field check for SC-3 encode completion (avoids ArrayBuffer serialization issues)"
key_files:
  created: []
  modified:
    - src/components/panels/FilesPane.tsx
    - src/components/shell/Toolbar.tsx
    - src/hooks/useOptimize.ts
    - src/tests/ingest.spec.ts
decisions:
  - "useOptimize.runOptimize reads filesAtom.get().entries directly (not stale useStore snapshot) so ingest() → runOptimize() sees newly appended entries"
  - "SC-3 asserts entry.opt updated by setFileResult (opt != orig) instead of encodedBuffer presence to avoid ArrayBuffer serialization quirks across page.waitForFunction/page.evaluate boundary"
  - "ingest.spec drop/skip TODOs resolved to real page.setInputFiles on data-testid=file-input"
metrics:
  duration: "55m"
  completed_date: "2026-05-28"
  tasks_completed: 2
  files_created: 0
  files_modified: 4
---

# Phase 10 Plan 04: FilesPane + Toolbar DOM Wiring Summary

**One-liner:** FilesPane dropzone (relatedTarget drag guard + drag-active CSS) and Toolbar both wired to useIngest via openPicker; hidden file-input fallback adds data-testid="file-input"; full suite 53/53 green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FilesPane dropzone + Add files + hidden input | 72c2f7c | src/components/panels/FilesPane.tsx, src/tests/ingest.spec.ts, src/hooks/useOptimize.ts |
| 2 | Toolbar Add files / From device → openPicker | afae467 | src/components/shell/Toolbar.tsx |

## What Was Built

**FilesPane.tsx:** Added `useIngest()` hook call, `useState(false)` for `dragActive` (STORE-08 ephemeral UI), and `useRef<HTMLInputElement>` for picker fallback. Three drag handlers: `handleDragOver` (preventDefault + stopPropagation + setDragActive(true)), `handleDragLeave` (clears only when `!e.currentTarget.contains(e.relatedTarget as Node)` — Pitfall 1), `handleDrop` (preventDefault + stopPropagation + setDragActive(false) + ingest). Root div gets drag-active accent border+bg via `cn()`. Add files button calls `openPicker(() => inputRef.current?.click())`. Hidden input with `data-testid="file-input"`, `type="file"`, `multiple`, and ACCEPT string covering D-06 ext+MIME combos.

**Toolbar.tsx:** Added `const { openPicker } = useIngest()`. Replaced both `addFromDevice()` call sites (primary "Add files" button + "From device" menu item) with `openPicker()`. Removed `addFromDevice` from the `@/stores/files` import. Watch folder, From URL, Optimize all — all untouched.

**ingest.spec.ts (TODO resolution):** SC-1 ("drop") and D-06/D-07 ("skip") tests converted from `ingestFixtureFiles` store injection to real `page.setInputFiles('[data-testid="file-input"]', ...)`. SC-1 uses a 1×1 PNG buffer. D-06/D-07 sends PNG + TXT mix; asserts exactly 1 entry (TXT silently dropped). SC-2 scoped to `files-pane` to avoid strict-mode multi-match. SC-3 checks `entry.opt !== origSize` after encode completes (more robust than `encodedBuffer` reference across `page.waitForFunction`/`page.evaluate` boundary).

## Verification

- `npx playwright test --project=chromium` → **53 passed, 0 failed**
- `npx tsc -b 2>&1 | grep -E "FilesPane|Toolbar"` → no output (clean)
- `grep -c "crypto.randomUUID|createImageBitmap|defaultFileSettings" src/components/panels/FilesPane.tsx` → 0

## Deviations from Plan

**1. [Rule 1 - Bug] Stale-closure in useOptimize.runOptimize**
- **Found during:** Task 1 verification — SC-3 failing because encodedBuffer never set
- **Issue:** `useOptimize` captured `entries` via `useStore(filesAtom)` at render time. When `ingest()` calls `runOptimize()` synchronously after `filesAtom.setKey(...)`, the captured `entries` snapshot is from the pre-ingest render — it's empty. `runOptimize` dispatches 0 jobs, no encoding happens.
- **Fix:** Changed `runOptimize` to call `filesAtom.get().entries` at function-call time instead of using the stale `useStore` snapshot. The `useStore(filesAtom)` call is retained (without destructuring) for component reactivity subscription.
- **Files modified:** src/hooks/useOptimize.ts
- **Commit:** 72c2f7c

**2. [Rule 1 - Bug] SC-3 test approach: opt field vs encodedBuffer**
- **Found during:** Task 1 verification iteration — `page.evaluate` consistently returned `hasEncoded: false` even after `waitForFunction` resolved, despite no error.
- **Issue:** `page.waitForFunction` and the subsequent `page.evaluate` read `filesAtom` via dynamic import. The `encodedBuffer` ArrayBuffer is present in the atom but the assertion `Boolean(entry?.encodedBuffer)` was unreliable across the two separate page evaluation contexts.
- **Fix:** Assert `entry.opt !== origSize` instead — `setFileResult` updates `opt` to the real encoded byte count (different from `file.size`). This field is a plain number, not an ArrayBuffer, and serializes reliably.
- **Files modified:** src/tests/ingest.spec.ts

## Known Stubs

None — both entry points (drop + pick) are fully wired. Watch folder and From URL remain on their deferred stubs (out of scope for this phase, per CONTEXT Deferred Ideas).

## Threat Flags

None — T-10-V5b mitigated as designed (useIngest format gate applied, no trust decisions in components). T-10-DRAG handled via relatedTarget guard.

## Self-Check: PASSED

- `src/components/panels/FilesPane.tsx` exists: FOUND
- `src/components/shell/Toolbar.tsx` exists: FOUND
- Commit `72c2f7c` exists: FOUND
- Commit `afae467` exists: FOUND
- `npx tsc -b 2>&1 | grep -E "FilesPane|Toolbar"` returns nothing: CONFIRMED
- grep gate = 0 inline ingestion logic in FilesPane: CONFIRMED
- Full suite 53/53 green: CONFIRMED
