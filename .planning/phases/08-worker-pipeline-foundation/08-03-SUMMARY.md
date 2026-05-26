---
phase: 08-worker-pipeline-foundation
plan: "03"
subsystem: worker-pipeline
tags: [worker-pool, nanostores, hooks, pipeline, PIPE-04]
dependency_graph:
  requires: ["08-02"]
  provides: ["PIPE-04", "useOptimize-hook", "toolbar-wired"]
  affects: ["BackpressureIndicator", "StatusBar", "Toolbar"]
tech_stack:
  added: []
  patterns: ["nanostores map atom", "Promise.allSettled batch dispatch", "codec type normalization map"]
key_files:
  created:
    - src/hooks/useOptimize.ts
  modified:
    - src/components/shell/Toolbar/Toolbar.tsx
decisions:
  - "Task 1 already satisfied by plan 08-02 deviation — setJobCounts/runningJobs/queuedJobs were added there"
  - "useOptimize uses explicit codec normalization switch (not toUpperCase) to handle jpg→JPEG and webp→WebP"
  - "Promise.allSettled isolates per-job rejections so Phase-8 NotImplemented stubs don't abort the batch"
  - "Hook does NOT call setJobCounts directly — pool's own onCountChange owns the count lifecycle"
metrics:
  duration: "~10 min"
  completed: "2026-05-26"
  tasks_completed: 3
  files_changed: 2
---

# Phase 08 Plan 03: Worker Pipeline Hook + Toolbar Wire-up Summary

## One-liner

`useOptimize` hook bridges `filesAtom` entries → `getPool().run()` with normalized codec mapping; Toolbar's "Optimize all" now dispatches the real bounded pool (PIPE-04).

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Extend runtimeAtom with job counts + setJobCounts | Already satisfied (08-02 deviation) | — |
| 2 | Create useOptimize hook bridging files → pool | Done | ba86cd9 |
| 3 | Wire Toolbar 'Optimize all' to the real pipeline | Done | ba86cd9 |

## What Was Built

**Task 1 (already done by 08-02):** `src/stores/runtime.ts` already exports `setJobCounts(running, queued)` which sets `runningJobs`, `queuedJobs`, and derives `running: boolean` as `running > 0 || queued > 0`. The existing boolean contract for `BackpressureIndicator` and `StatusBar` is preserved.

**Task 2 — `src/hooks/useOptimize.ts`:**
- Reads `filesAtom.entries` via `useStore(filesAtom)`
- Normalizes `FileEntry.type` (lowercase) to `EncodeJob['codec']` (mixed case) via explicit switch: `png→PNG`, `jpg/jpeg→JPEG`, `webp→WebP`, `avif→AVIF`, `svg→SVG` — unknown types are filtered out
- Dispatches all jobs via `Promise.allSettled(jobs.map(job => pool.run(job)))` — Phase-8 NotImplemented rejections for WebP/JPEG/AVIF/SVG do not abort the batch
- File buffers are `new ArrayBuffer(0)` placeholders — Phase 9 wires real bytes
- Hook does NOT import or call `setJobCounts` — the pool's `onCountChange` owns count updates (single source of truth)

**Task 3 — `src/components/shell/Toolbar/Toolbar.tsx`:**
- Removed `startRun` import (no longer referenced)
- Added `import { useOptimize } from '@/hooks/useOptimize'`
- Added `const { runOptimize } = useOptimize()` inside `Toolbar()`
- Changed `onClick={startRun}` → `onClick={runOptimize}` on "Optimize all" button
- `setWorkerCount` import retained (settings popover at line 213 still uses it)
- Button text, role, and classes unchanged — `getByRole('button', { name: 'Optimize all' })` still matches

## Deviations from Plan

### Already-Satisfied Task

**Task 1 — runtimeAtom extension:** Plan 08-02 added `runningJobs`, `queuedJobs`, and `setJobCounts` as a justified deviation (worker-pool.ts needed to lazily import `setJobCounts`, which required the function to exist). Verified the existing shape matches this plan's spec exactly — no changes needed or made.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `src/hooks/useOptimize.ts` | `buffer: new ArrayBuffer(0)` | `FileEntry` has no real buffer field in Phase 8; Phase 9/10 wires real bytes from file reads |
| `src/workers/codec.worker.ts` | WebP/JPEG/AVIF/SVG throw `NotImplemented` | Phase 8 only implements PNG→OxiPNG; other codecs land in Phase 9 |

## Threat Mitigations Applied

- **T-08-03:** Codec normalization uses an explicit switch — no dynamic property indexing; unknown types return null and are filtered before reaching the worker
- **T-08-05:** `running` boolean derives from counts on every `setJobCounts` call; pool calls it on drain/release so `running` returns to false exactly when queue empties
- **T-08-06:** `Promise.allSettled` isolates per-job failures; batch always completes

## Verification

- `npx tsc -b --noEmit` — clean
- `npx playwright test src/tests/backpressure.spec.ts` — exit 0 (boolean contract + PIPE-04 count test green)

## Self-Check: PASSED

- `src/hooks/useOptimize.ts` — created and committed (ba86cd9)
- `src/components/shell/Toolbar/Toolbar.tsx` — modified and committed (ba86cd9)
- `src/stores/runtime.ts` — already has `setJobCounts`/`runningJobs`/`queuedJobs` from 08-02
- All greps verify: `getPool`, `Promise.allSettled`, `useStore(filesAtom)`, `useOptimize`, `onClick={runOptimize}`, `Optimize all`, `runningJobs`, `queuedJobs`, `running: running > 0 || queued > 0`
