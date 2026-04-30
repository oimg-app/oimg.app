---
phase: 02-worker-harness-state
verified: 2026-04-30T17:16:27Z
status: human_needed
score: 22/22 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "DevTools Performance worker tracks (ROADMAP SC-4 manual)"
    expected: "Open DevTools → Performance → record a 50-file batch with synthetic 5MB blobs. Verify exactly min(hardwareConcurrency, 4) parallel worker tracks during run; main thread blocks <50ms continuously."
    why_human: "Browser-internal threading visualization not Playwright-observable; complements VR-02 store-state assertion."
  - test: "Reduced-motion preference respected (UI-SPEC §10)"
    expected: "Set prefers-reduced-motion: reduce in DevTools Rendering tab. Run Optimize. Confirm no pulse animation on running rows, no transition on Workers pill, no toast slide-in."
    why_human: "OS-level preference toggle; CSS rule presence verified, but visual behavior not assertable."
  - test: "Open code-review BLOCKERs in 02-REVIEW.md (CR-01 through CR-04, WR-03, WR-06)"
    expected: "Code reviewer flagged 4 critical and several warning issues including a WorkerPool.cancel() generation/race window, WR-03 quartile flooding for batches < 4, WR-06 'Batch complete' toast firing on cancel paths, and silent error swallowing. Decide whether to fix in Phase 2 or defer; verify these defects do not cause regressions in real user batches."
    why_human: "Concurrency races and toast-on-cancel UX issues are timing-dependent — VR-03 only checks state ≤200ms post-cancel and does not exercise re-batch after cancel. Human judgment needed on accept/defer."
---

# Phase 2: Worker Harness + State Verification Report

**Phase Goal:** A generic worker pipeline processes files in parallel with bounded memory and wired state stores, validated by a stub adapter that round-trips bytes unchanged

**Verified:** 2026-04-30T17:16:27Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Uploading any file triggers a job through the worker pool; UI shows progress without freezing | VERIFIED | `App.tsx:298-340` startOptimize wires queued/idle/error files into `pool.enqueue`; Toolbar shows "Optimizing…" and live region announces start; VR-01 test PASS asserts <500ms round-trip |
| SC-2 | Stub adapter returns original file unchanged; file list updates with "0 bytes saved" | VERIFIED | `src/workers/stub-adapter.ts:22` `output = input.slice(0)`; `App.tsx:177` `savedHuman = '0 bytes'`; VR-01 test PASS asserts `optimizedSize === originalSize` |
| SC-3 | Cancelling a queued batch before completion stops in-flight jobs and clears file list cleanly | VERIFIED | `pool.ts:76-99` cancel() terminates workers + AbortSignal trips Promise.race; `App.tsx:347-353` cancelBatch calls pool.cancel + runtime.cancelBatch; VR-03 test PASS asserts <200ms `running===false && inFlight.size===0` |
| SC-4 | Worker pool respects min(hardwareConcurrency, 4) concurrency cap | VERIFIED | `pool.ts:18-21` computePoolSize = `Math.min(navigator.hardwareConcurrency \|\| 2, 4)`; runtime.ts mirrors POOL_SIZE; VR-02 test PASS asserts `maxInFlight <= poolSize` across `poolSize+4` jobs |

**Score:** 4/4 ROADMAP SCs verified

### Plan-Level Must-Have Truths

| # | Plan | Truth | Status | Evidence |
|---|------|-------|--------|----------|
| 1 | 02-01 | Wave 0 test files exist on disk | VERIFIED | All 5 files in `src/tests/` and `src/tests/fixtures/` |
| 2 | 02-01 | Synthetic Blob fixture deterministic, no 50×50MB upfront alloc | VERIFIED | `synthetic.ts:5-9` lazy factory pattern |
| 3 | 02-01 | instrument-blob-urls helper exposes `__OIMG_URL_COUNTS__` | VERIFIED | `instrument-blob-urls.js` (note: .js, not .ts; documented deviation in object-url.spec.ts:21-23) |
| 4 | 02-02 | Three independent zustand stores exist | VERIFIED | files.ts, settings.ts, runtime.ts all use `create<...>()(subscribeWithSelector(...))` |
| 5 | 02-02 | urlCache lazy-creates URLs via getOrCreateObjectURL | VERIFIED | `runtime.ts:106-114` cache miss → URL.createObjectURL |
| 6 | 02-02 | removeFile cascades to revokeObjectURL BEFORE byId removal | VERIFIED | `files.ts:43-54` |
| 7 | 02-02 | markDone revokes OLD url BEFORE writing new optimizedBlob | VERIFIED | `files.ts:56-75` |
| 8 | 02-02 | ARIA live-region helper exists with quartile cadence | VERIFIED | `live-region.ts` exports announce + isQuartileBoundary |
| 9 | 02-02 | Stores subscribable via narrow selectors | VERIFIED | `subscribeWithSelector` middleware applied to all three |
| 10 | 02-03 | WorkerPool singleton with size=min(hwConc, 4) | VERIFIED | `pool.ts:42-53,189-192` |
| 11 | 02-03 | Stub adapter round-trips bytes unchanged | VERIFIED | `stub-adapter.ts:22` `input.slice(0)` |
| 12 | 02-03 | FIFO queue dispatches to idle workers | VERIFIED | `pool.ts:128-137` tryDispatch loop |
| 13 | 02-03 | Cancel terminates workers + respawns + rejects with AbortError | VERIFIED | `pool.ts:76-99` |
| 14 | 02-03 | ArrayBuffer Comlink.transfer'd both directions | VERIFIED | `pool.ts:153` + `worker.ts:47` |
| 15 | 02-03 | Worker imports adapter via static map (NOT template-literal) | VERIFIED | `worker.ts:21-40` static record |
| 16 | 02-04 | Toolbar Optimize button drives real worker batch via runtime store | VERIFIED | `Toolbar.tsx:62-69` selectors + `App.tsx:298` startOptimize |
| 17 | 02-04 | Workers status pill shows live `{busy}/{total} busy` | VERIFIED | `Toolbar.tsx:75-86,151-153` |
| 18 | 02-04 | Cmd+K palette includes Cancel batch entry | VERIFIED | `App.tsx:374` conditional palette item |
| 19 | 02-04 | ARIA live region exists at App root with quartile updates | VERIFIED | `App.tsx:771-788` + VR-05 test PASS asserts 5 announcements for 12 files |
| 20 | 02-04 | App.tsx exposes `window.__OIMG_STORES__` in dev/test | VERIFIED | `App.tsx:195-203` gated; production grep returns NO_LEAK |
| 21 | 02-05 | src/data/mock.ts deleted | VERIFIED | filesystem check returns DELETED |
| 22 | 02-05 | No remaining import of @/data/mock anywhere | VERIFIED | grep returns matches in COMMENTS only |

**Score:** 22/22 plan-level must-have truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/workers/pool.ts` | VERIFIED | 198 lines, WorkerPool class + singleton, all required patterns present |
| `src/workers/worker.ts` | VERIFIED | 51 lines, Comlink.expose(api), static ADAPTERS map |
| `src/workers/stub-adapter.ts` | VERIFIED | 24 lines, input.slice(0), slowMs test affordance |
| `src/workers/types.ts` | VERIFIED | AdapterFormat, AdapterRunResult, PoolJob, AdapterError |
| `src/stores/runtime.ts` | VERIFIED | 125 lines, urlCache lifecycle, T-02-01 cancel-race guards |
| `src/stores/files.ts` | VERIFIED | 102 lines, revoke-before-mutate enforced |
| `src/stores/settings.ts` | VERIFIED | Codec defaults seeded |
| `src/stores/index.ts` | VERIFIED | Barrel re-exports all three stores |
| `src/lib/object-url.ts` | VERIFIED (orphan-prone) | Re-exports runtime store helpers; reviewer noted unused — see IN-05 |
| `src/lib/live-region.ts` | VERIFIED | setLiveRegion/announce/isQuartileBoundary |
| `src/components/shell/Toolbar.tsx` | VERIFIED | Workers pill + selector subscriptions wired |
| `src/App.tsx` | VERIFIED | Worker pool batch handler, live-region quartile cadence, Sonner Toaster |
| `src/tests/worker-pool.spec.ts` | VERIFIED | 3 live tests (VR-01/02/03) — all PASS |
| `src/tests/object-url.spec.ts` | VERIFIED | VR-04 live test — PASS |
| `src/tests/aria-live.spec.ts` | VERIFIED | VR-05 live test — PASS |
| `src/tests/fixtures/synthetic.ts` | VERIFIED | Deterministic factory |
| `src/tests/fixtures/instrument-blob-urls.js` | VERIFIED | (.js not .ts — deviation documented in object-url.spec.ts:21-23) |
| `src/data/mock.ts` | VERIFIED (deleted per plan) | Cleanup wave success |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `App.tsx` | `pool.ts` | `getWorkerPool()` | WIRED | line 105 useMemo + line 328 enqueue + line 349 cancel |
| `App.tsx` | `runtime.ts` | `useRuntimeStore` selectors + getState() actions | WIRED | live-region effect line 151-190 + dispatch line 308 |
| `App.tsx` | `files.ts` | `useFilesStore` getState/markDone/setSelected | WIRED | line 53-55, 332 |
| `App.tsx` | `live-region.ts` | `setLiveRegion(el)` ref + announce(...) | WIRED | line 773 + 309/178/351 |
| `Toolbar.tsx` | `runtime.ts` | `useRuntimeStore((s) => ...)` narrow selectors | WIRED | line 62-65 |
| `pool.ts` | `worker.ts` | `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` | WIRED | line 120-122 |
| `pool.ts` | `comlink` | `Comlink.wrap`, `Comlink.transfer` | WIRED | line 123, 153 |
| `worker.ts` | `stub-adapter.ts` | static map dynamic import | WIRED | line 22 `import('./stub-adapter')` |
| `files.ts` | `runtime.ts` | `useRuntimeStore.getState().revokeObjectURL` | WIRED | line 45, 59, 96 |
| `settings.ts` | `defaults.ts` | DEFAULT_CODEC_* imports | WIRED | seed values |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| App.tsx SHELL_FILES | `filesById`, `filesOrder` | useFilesStore byId/order populated by addFile() | Yes (test seed + Phase 5 drag-drop) | FLOWING |
| Toolbar Workers pill | `running`, `busy`, `poolSize`, `errorCount` | useRuntimeStore (set by pool callbacks) | Yes (VR-02 demonstrates live updates) | FLOWING |
| Live region textContent | announced strings | useRuntimeStore.subscribe → announce() | Yes (VR-05 PASS: 5 announcements observed) | FLOWING |
| Sonner toasts | success/error/cancel branches | runtime store state transitions | Yes (start/cancel paths exercised) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `./node_modules/.bin/tsc -b` | exit 0, no output | PASS |
| Production build | `npm run build` | exit 0; index 282KB / 86.44KB gzipped | PASS |
| Worker chunk emitted | `ls dist/assets/worker-*.js` | `worker-yLMyQuJU.js` (4.57 KB) | PASS |
| Stub adapter chunk emitted | `ls dist/assets/stub-adapter*` | `stub-adapter-DGDK3pfx.js` (0.15 KB) | PASS |
| Stub adapter NOT in initial bundle | `grep 'input.slice(0)' dist/assets/index-*.js` | no match (STUB_NOT_IN_INITIAL) | PASS |
| `__OIMG_STORES__` NOT in production | `grep '__OIMG_STORES__' dist/assets/*.js` | no match (NO_LEAK) | PASS |
| Bundle budget | `npm run test:bundle` | `PASS: 84.4 KB < 200 KB` | PASS |
| Full Playwright suite | `npx playwright test --reporter=list` | `PASS (17) FAIL (0)` in 3.4s | PASS |
| `test.fail()` markers absent | `grep -rn 'test.fail()' src/tests/` | only in code comments | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERF-01 | 02-01, 02-03, 02-04, 02-05 | WASM codecs run in Web Worker pool (non-blocking UI) | SATISFIED | WorkerPool spawns Workers, Comlink RPC, main-thread free; VR-01/02/03 verify; REQUIREMENTS.md marked [x] |
| PERF-02 | 02-01, 02-03, 02-05 | Lazy-load codecs on first use | SATISFIED | Static-map dynamic import in worker.ts; build emits separate stub-adapter chunk; VR-07 stub-adapter NOT in initial bundle; REQUIREMENTS.md marked [x] |
| PERF-03 | 02-01, 02-02, 02-04, 02-05 | Progress UI for batch operations | SATISFIED | Toolbar Workers pill + ARIA live region + Sonner toasts + per-file progbar; VR-05 verifies quartile cadence; REQUIREMENTS.md marked [x] |

No orphaned requirements: REQUIREMENTS.md maps PERF-01/02/03 to Phase 2; all are covered by plan frontmatter.

### Validation Rule Coverage (VR-01..VR-07)

| VR | Description | Spec File | Status |
|----|-------------|-----------|--------|
| VR-01 | Stub round-trip <500ms, optimizedSize===originalSize, status done | worker-pool.spec.ts | PASS (live, no test.fail) |
| VR-02 | Concurrency cap: inFlight.size <= min(hwConc, 4) | worker-pool.spec.ts | PASS (poolSize+4 jobs, 100ms slow stub) |
| VR-03 | Cancel kills in-flight within 200ms; running=false, inFlight.size=0 | worker-pool.spec.ts | PASS (1000ms stub + Cmd+. shortcut) |
| VR-04 | Object URL leak-free: created === revoked + outstanding cache | object-url.spec.ts | PASS (4-file batch + re-optimize) |
| VR-05 | ARIA quartile cadence: 12-file batch → exactly 5 announcements | aria-live.spec.ts | PASS (start + 3,6,9 + final) |
| VR-06 | Phase 1 ARIA contract preserved (11 shell.spec.ts tests) | shell.spec.ts | PASS (all green in 17/17 sweep) |
| VR-07 | Bundle <200KB gzipped; worker + stub-adapter NOT in initial route | build.test.ts | PASS (84.4 KB; chunks separate) |

### Anti-Patterns Found

Per code review (02-REVIEW.md), 4 critical and 8 warning issues exist. The Phase 2 codebase ships with these defects:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| pool.ts | 76-99,171-181 | CR-01 cancel/respawn pool-generation race (stale `finally` against new generation) | Critical | Old job's finally pushes index back into new pool's idle list — slot can dispatch twice; reachable in re-batch after cancel (not in VR-03 test path). |
| pool.ts | 88-90 | CR-02 onError fires for jobs that already resolved | Critical | inFlight contains races between Promise.race resolution and `finally` cleanup; markError after markDone causes errorCount > totalJobs. |
| runtime.ts | 56-66 | CR-03 markStarted no-ops if queue write didn't commit | Critical | Future caller inverting startBatch/enqueue order will silently hang. |
| App.tsx | 334-338 | CR-04 startOptimize .catch swallows real adapter errors | Critical | Production codec errors invisible (Phase 5 will hit this). |
| ReportPanel.tsx | 14-15 | WR-01 division-by-zero → "NaN%" with empty file list | Warning | Visible UI bug. |
| App.tsx | 228-246 | WR-02 SHELL_FILES dereferences undefined `byId[id]` | Warning | Crash in racy double-render. |
| live-region.ts | 30-36 | WR-03 quartile flooding for batches < 4 (3 files → 3 announcements) | Warning | Violates "no per-file announcement" contract for 2-3 file batches. |
| App.tsx | 347-353 | WR-06 cancel triggers misleading "Batch complete" toast | Warning | UX defect; reachable in real cancel flow. |
| object-url.ts | (whole file) | IN-05 module unused (no importers) | Info | Dead-on-arrival surface area. |
| OutputPanel.tsx | 23-25 | IN-03 invalid base64 sample with `…` literal | Info | Phase 2 placeholder — flagged for Phase 3+. |

**Decision required (human verification):** Whether to fix CR-01..CR-04, WR-03, WR-06 in Phase 2 or accept and defer. None of these break the four ROADMAP SCs as currently tested, but CR-01..CR-04 are time-bomb defects for Phase 3+ when real codecs replace the stub.

### Human Verification Required

1. **DevTools Performance worker tracks** — Per 02-VALIDATION.md "Manual-Only Verifications". Open DevTools Performance, record a 50-file synthetic batch, confirm exactly `min(hardwareConcurrency, 4)` parallel worker tracks. VR-02 asserts `inFlight.size` cap from store state but does not visualize OS-thread parallelism.

2. **Reduced-motion preference** — Toggle `prefers-reduced-motion: reduce` in DevTools Rendering tab and run an Optimize batch. Confirm CSS rule (index.css `@media (prefers-reduced-motion: reduce)`) actually disables `.file-status.processing` pulse and `.progbar > div` animation.

3. **Open code-review BLOCKERs (02-REVIEW.md CR-01..CR-04, WR-03, WR-06)** — All four ROADMAP success criteria pass on the test paths exercised, but the reviewer flagged 4 critical defects in cancel/race handling and 2 user-facing warnings. Decide: fix-now (gap-closure plan) vs accept-and-track (carry into Phase 3 backlog). The phase as shipped passes its declared validation contract; the question is whether the code-review findings rise to BLOCKER.

### Gaps Summary

No gaps blocking the four ROADMAP success criteria or any of the 22 plan-level must-have truths. All 17 Playwright tests pass. Build emits worker + stub-adapter as separate chunks at 84.4 KB initial gzipped JS. Production bundle confirmed free of `__OIMG_STORES__` and stub-adapter code.

The verification status is `human_needed` rather than `passed` because:
- 02-VALIDATION.md defines two manual-only verifications (worker thread visualization, reduced-motion) that are inherent to Phase 2's contract and cannot be automated
- 02-REVIEW.md identifies 4 critical defects in cancel/race handling that the test surface does not cover; human must decide whether to address before Phase 3 plugs into the adapter contract

---

_Verified: 2026-04-30T17:16:27Z_
_Verifier: Claude (gsd-verifier)_
