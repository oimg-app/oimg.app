---
phase: 02-worker-harness-state
plan: 02
subsystem: state
tags: [phase-02, wave-1, stores, zustand, object-url, live-region]

# Dependency graph
requires:
  - phase: 01-shell-foundation
    provides: "FileEntry/CodecSettings* domain types; DEFAULT_CODEC_* seeds; Phase 1 ARIA tests (regression target)"
  - phase: 02-worker-harness-state
    plan: 01
    provides: "VR-04 URL counter instrumentation; failing-stub specs probing window.__OIMG_STORES__/__OIMG_URL_COUNTS__"
provides:
  - "useFilesStore: byId/order, addFile, removeFile (revoke-before-delete), markDone (revoke-before-supersede), clear"
  - "useSettingsStore: codec configs (svg/png/jpeg/webp/avif) + global, all seeded from DEFAULT_CODEC_*"
  - "useRuntimeStore: queue/inFlight, doneCount/errorCount, urlCache (Map<fileId, string>), POOL_SIZE = min(hardwareConcurrency || 2, 4)"
  - "Cancel-race guard: markDone/markError early-return when !inFlight.has(jobId) (T-02-01 partial mitigation)"
  - "T-02-02 leak mitigation: revokeObjectURL called BEFORE byId mutation in both removeFile and markDone"
  - "src/lib/object-url.ts: non-React-call-site facade over urlCache"
  - "src/lib/live-region.ts: setLiveRegion + announce (clear-then-rAF) + isQuartileBoundary (stride=max(1,floor(total/4)))"
  - "src/stores/index.ts barrel: useFilesStore, useSettingsStore, useRuntimeStore, FileEntryWithBlob, POOL_SIZE"
affects: [02-03-worker-harness, 02-04-ui-wiring, 02-05-cleanup]

# Tech tracking
tech-stack:
  added:
    - "zustand@^5 (peer-free, ~3 KB gzip; subscribeWithSelector middleware)"
    - "sonner@^2 (added now to avoid a separate install task in 02-04)"
    - "comlink@^4.4 (added now to avoid a separate install task in 02-03)"
  patterns:
    - "subscribeWithSelector middleware on every store — narrow-selector subscription is the convention"
    - "urlCache keyed by FileEntry.id (string), NOT by Blob identity — A3 from RESEARCH.md"
    - "Cross-store calls via getState() — files store calls useRuntimeStore.getState().revokeObjectURL"
    - "Defensive POOL_SIZE: Math.min(navigator.hardwareConcurrency || 2, 4) — Pitfall 6"
    - "live-region clear-then-rAF dance to defeat screen-reader dedup"

key-files:
  created:
    - "src/stores/runtime.ts"
    - "src/stores/files.ts"
    - "src/stores/settings.ts"
    - "src/stores/index.ts"
    - "src/lib/object-url.ts"
    - "src/lib/live-region.ts"
  modified:
    - "package.json (zustand, sonner, comlink added)"
    - "package-lock.json"

key-decisions:
  - "urlCache is a Map<string,string> keyed by FileEntry.id (not Blob identity) — supports supersede semantics where the same fileId points to a fresh URL after markDone"
  - "removeFile and markDone both call revokeObjectURL via useRuntimeStore.getState() to keep files store free of React-only imports while still cascading lifecycle"
  - "POOL_SIZE is exported from runtime.ts as a top-level const so the Toolbar Workers pill (Phase 1 placeholder) can read it without subscribing to runtime state"
  - "isQuartileBoundary skips doneCount === 0 and doneCount === totalJobs — caller emits 'starting' and 'final' messages explicitly, helper only signals interior strides"

requirements-completed: []
# PERF-03 progresses but does not close until 02-04 wires the live region into App.tsx and verifies VR-05 quartile cadence end-to-end

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 2 Plan 02: Stores + Helpers Summary

**Three sliced zustand stores (files / settings / runtime) plus object-url and live-region helper modules — the canonical Phase 2 state surface, with urlCache lifecycle (D-10) and ARIA quartile bus wired but not yet consumed.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-30T15:55:57Z
- **Completed:** 2026-04-30T15:58:42Z
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- 3 zustand stores compile cleanly with `subscribeWithSelector` middleware
- urlCache lifecycle (D-10) wired through both eviction (`removeFile`) and supersede (`markDone`) paths
- T-02-01 cancel-race guard present in `markDone` and `markError`
- T-02-02 URL-leak mitigation present in `removeFile`, `markDone`, and `clear`
- `POOL_SIZE` exported from runtime store with Pitfall-6-safe defaults
- `live-region.ts` quartile helper ships with the exact `Math.max(1, Math.floor(total/4))` stride
- Phase 1 regression preserved: `shell.spec.ts` still 11/11 PASS after both task commits
- `tsc -b` exits 0 throughout

## Task Commits

1. **Task 1: Install zustand+sonner+comlink; scaffold three sliced stores + barrel** — `ec81197` (feat)
2. **Task 2: Add object-url + live-region helper modules** — `4add7b2` (feat)

## Files Created

- `src/stores/runtime.ts` (122 LOC) — `useRuntimeStore` with queue/inFlight/urlCache/poolSize and the full batch lifecycle. Cancel-race guards in markDone/markError; revoke-and-evict in revokeObjectURL.
- `src/stores/files.ts` (95 LOC) — `useFilesStore` with `FileEntryWithBlob` extension that adds `sourceBlob: Blob` and `optimizedBlob: Blob | null` to the existing `FileEntry`. `removeFile`/`markDone`/`clear` cascade revokes through runtime store.
- `src/stores/settings.ts` (54 LOC) — `useSettingsStore` seeded from `DEFAULT_CODEC_*` and `DEFAULT_GLOBAL_SETTINGS`. Per-format setters use shallow merge.
- `src/stores/index.ts` — barrel re-export.
- `src/lib/object-url.ts` — thin facade exposing `getOrCreateObjectURL`/`revokeObjectURL` for non-React callers.
- `src/lib/live-region.ts` — `setLiveRegion` (DOM ref binder), `announce` (clear-then-rAF), `isQuartileBoundary` (stride helper).

## Decisions Made

- **`FileEntryWithBlob` extends `FileEntry` instead of mutating the type** — keeps the Phase 1 type contract intact (no rewrite of `src/types/index.ts`); Blob payloads live only in the store. Phase 7 persistence will serialize the parent `FileEntry` shape and re-hydrate the Blob from IndexedDB.
- **urlCache keyed by FileEntry.id (string), not Blob identity** — supports the supersede flow where the same fileId points to a different Blob after `markDone`. RESEARCH.md A3 explicitly directs this.
- **Cross-store wiring via `useRuntimeStore.getState()` in files store** — not via React hooks. This keeps the files store callable from non-component contexts (worker pool callbacks, tests). The reverse direction does not happen in Phase 2.
- **POOL_SIZE exported as a top-level const, not just a state field** — runtime state field shadows the const for selector reads, but the const is what the Toolbar pill imports synchronously without needing to subscribe.

## Deviations from Plan

None — plan executed exactly as written. All acceptance gates passed on first run.

## Issues Encountered

- The plan's per-task `<verify>` line uses a chained `grep -c 'subscribeWithSelector' | grep -q '^[12]$'` which accepts 1 OR 2 matches; the acceptance-criteria text below it asserts `1`. Actual counts: runtime/files/settings each have 2 matches (one import + one usage), which the verify regex accepts. No fix needed; flagged here so future planners normalize the criteria text.

## Threat Flags

None — no new trust boundaries, no new network/auth surface. Two pre-existing partial threats (T-02-01 cancel race, T-02-02 URL leak) are now MITIGATED for the store layer; their full closure depends on 02-03 worker termination semantics.

## Known Stubs

None.

## Next Plan Readiness

- **02-03 (Worker harness):** Has `useRuntimeStore.startBatch/markStarted/markDone/markError/cancelBatch` ready to drive from the worker pool. POOL_SIZE is the cap. comlink is installed.
- **02-04 (UI wiring):** Has `useFilesStore`, `useSettingsStore`, `useRuntimeStore` to migrate App.tsx useState hooks into. `setLiveRegion` is ready to be passed as a ref callback to a `<div role="status" aria-live="polite" sr-only>`.
- **VR-04 closure (02-04):** `getOrCreateObjectURL`/`revokeObjectURL` already cascade — Wave 0 instrumentation will report created === revoked once UI consumers route through these.
- **Window probe `__OIMG_STORES__`:** Wave 0 stubs probe this and intentionally fail. 02-04 will expose the three stores on `window` in dev/test mode (PATTERNS.md §"Page-context store inspection") to flip the stubs green.

## Self-Check: PASSED

- `test -f src/stores/runtime.ts` → FOUND
- `test -f src/stores/files.ts` → FOUND
- `test -f src/stores/settings.ts` → FOUND
- `test -f src/stores/index.ts` → FOUND
- `test -f src/lib/object-url.ts` → FOUND
- `test -f src/lib/live-region.ts` → FOUND
- `git log --oneline | grep ec81197` → FOUND
- `git log --oneline | grep 4add7b2` → FOUND
- `./node_modules/.bin/tsc -b` exits 0
- `npx playwright test src/tests/shell.spec.ts` → 11/11 PASS (Phase 1 regression preserved)
- All grep-based acceptance gates from the plan: PASS

---
*Phase: 02-worker-harness-state*
*Completed: 2026-04-30*
