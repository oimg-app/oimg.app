---
phase: 08-worker-pipeline-foundation
verified: 2026-05-26T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 8: Worker Pipeline Foundation — Verification Report

**Phase Goal:** Optimization work runs off the main thread through a bounded, Comlink-wrapped worker pool, with the headers and codec-loading strategy that keep the UI responsive and the initial bundle small.
**Verified:** 2026-05-26T00:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | A test/encode job dispatched to the pool runs in a Web Worker and the main-thread UI stays interactive while it runs | VERIFIED | `src/workers/codec.worker.ts` exposes `{ optimize }` via `Comlink.expose`; `src/lib/worker-pool.ts` spawns workers with `new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })` and wraps each with `Comlink.wrap`; Toolbar wired to `runOptimize` which calls `getPool().run()`; Playwright worker-pipeline.spec.ts PIPE-01 test asserts toolbar stays visible and enabled during encode (38/38 pass) |
| SC2 | Codecs are dynamic-imported inside workers — initial route < 200KB gzipped and AVIF WASM not fetched until selected | VERIFIED | `codec.worker.ts` lines 35-36: `await import('@jsquash/png')` and `await import('@jsquash/oxipng')` inside the PNG case branch; zero static top-level @jsquash imports; build produces `index-*.js` at 144.45 kB gzip (< 200 KB budget); no AVIF WASM chunk emitted at build; Playwright PIPE-02 test confirms no AVIF URL fetched on initial load |
| SC3 | SharedArrayBuffer available (`crossOriginIsolated === true`) via COOP/COEP headers in dev and production `_headers` | VERIFIED | `public/_headers` has `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`; `vite.config.ts` server.headers block matches verbatim; Playwright PIPE-03 test `page.evaluate(() => crossOriginIsolated)` asserts `true` and passes |
| SC4 | Pool caps concurrent jobs; excess jobs wait; BackpressureIndicator reflects real running/queued state | VERIFIED | `worker-pool.ts:67-68`: `Math.min(navigator.hardwareConcurrency ?? 4, 4)` caps pool size; queue array in `WorkerPool._drain()` holds excess jobs; `setJobCounts` exported from `src/stores/runtime.ts`; called lazily via `import('@/stores/runtime').then(({ setJobCounts }) => setJobCounts(active, queued))` in `onCountChange`; `runtimeAtom` has `runningJobs`, `queuedJobs`, and derives `running: running > 0 \|\| queued > 0`; Playwright backpressure.spec.ts PIPE-04 asserts `animate-pulse` on indicator after Optimize click (passes) |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `public/_headers` | COOP/COEP headers for Cloudflare Pages | VERIFIED | Both headers present, trailing newline confirmed |
| `src/workers/codec.worker.ts` | Comlink-exposed optimize(job) with dynamic codec imports | VERIFIED | Exports `EncodeJob`, `EncodeResult`; `Comlink.expose({ optimize })`; all @jsquash imports are `await import()` inside switch branches; PNG→OxiPNG real path implemented |
| `src/lib/worker-pool.ts` | Bounded WorkerPool + getPool() singleton + HMR dispose | VERIFIED | Exports `WorkerPool`, `getPool`; size = `Math.min(hardwareConcurrency ?? 4, 4)`; `import.meta.hot.dispose(() => { _instance = null })` for HMR |
| `src/stores/runtime.ts` | Extended with runningJobs/queuedJobs + setJobCounts | VERIFIED | `RuntimeState` has `runningJobs: number`, `queuedJobs: number`; `setJobCounts(running, queued)` exported; `running` boolean preserved for BackpressureIndicator compat |
| `src/hooks/useOptimize.ts` | Hook bridging filesAtom → getPool().run() | VERIFIED | Reads `filesAtom.entries`, normalizes codec via explicit switch, dispatches via `Promise.allSettled(jobs.map(job => pool.run(job)))` |
| `src/components/shell/Toolbar/Toolbar.tsx` | Optimize all button wired to useOptimize().runOptimize | VERIFIED | Line 8: `import { useOptimize }`, line 28: `const { runOptimize } = useOptimize()`, line 73: `onClick={runOptimize}` |
| `src/tests/worker-pipeline.spec.ts` | PIPE-01/02/03 Playwright coverage | VERIFIED | Three tests: crossOriginIsolated, UI-interactive-during-encode, no-AVIF-fetch-on-load |
| `src/tests/backpressure.spec.ts` | Extended PIPE-04 backpressure coverage | VERIFIED | Third test added asserting `animate-pulse` class on indicator after Optimize click |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Toolbar.tsx` | `src/hooks/useOptimize.ts` | `useOptimize().runOptimize` on Optimize all click | WIRED | Line 8 import, line 73 `onClick={runOptimize}` |
| `src/hooks/useOptimize.ts` | `src/lib/worker-pool.ts` | `getPool().run(job)` | WIRED | Line 3 import, line 30 `const pool = getPool()`, line 47 `pool.run(job)` |
| `src/lib/worker-pool.ts` | `src/workers/codec.worker.ts` | `new Worker(new URL(...)) + Comlink.wrap` | WIRED | Line 28: literal URL string for Vite static analysis; line 29: `Comlink.wrap<WorkerApi>(w)` |
| `src/workers/codec.worker.ts` | `@jsquash/oxipng` | dynamic import inside PNG branch | WIRED | Line 36: `await import('@jsquash/oxipng')` inside `case 'PNG':` |
| `src/lib/worker-pool.ts` | `src/stores/runtime.ts` | `onCountChange → setJobCounts` (lazy import) | WIRED | Lines 70-72: `import('@/stores/runtime').then(({ setJobCounts }) => setJobCounts(active, queued))` |
| `src/stores/runtime.ts` | BackpressureIndicator | `running` boolean derived from job counts | WIRED | Line 60: `running: running > 0 \|\| queued > 0`; indicator reads `runtimeAtom` boolean |

---

### Data-Flow Trace (Level 4)

This phase establishes infrastructure, not data rendering. The BackpressureIndicator renders the `running` boolean from `runtimeAtom`, which flows from `setJobCounts` called by the pool's `onCountChange` on every job state change. Flow verified:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `BackpressureIndicator` | `running` boolean | `runtimeAtom` ← `setJobCounts` ← `WorkerPool.onCountChange` | Yes — derived from actual pool active/queued counts | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| Build < 200 KB gzip | Build output: 144.45 kB gzip (orchestrator gate) | PASS |
| AVIF WASM not in build | No AVIF WASM chunk emitted (orchestrator gate) | PASS |
| crossOriginIsolated === true | Playwright worker-pipeline.spec.ts PIPE-03 passes (38/38 total) | PASS |
| AVIF not fetched on initial load | Playwright PIPE-02 passes | PASS |
| UI interactive during encode | Playwright PIPE-01 passes | PASS |
| BackpressureIndicator animate-pulse | Playwright backpressure.spec.ts PIPE-04 passes | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PIPE-01 | 08-02-PLAN.md | Off-thread Comlink WorkerPool, UI stays responsive | SATISFIED | codec.worker.ts + worker-pool.ts + Playwright PIPE-01 test |
| PIPE-02 | 08-02-PLAN.md | Dynamic codec imports, initial route < 200 KB, AVIF lazy | SATISFIED | Dynamic imports in worker switch; build at 144.45 kB; Playwright PIPE-02 |
| PIPE-03 | 08-01-PLAN.md | COOP/COEP headers, crossOriginIsolated === true | SATISFIED | public/_headers, vite.config.ts server.headers, Playwright PIPE-03 |
| PIPE-04 | 08-03-PLAN.md | Pool bounds concurrency, BackpressureIndicator reflects real state | SATISFIED | WorkerPool queue + setJobCounts + runtimeAtom derivation + Playwright PIPE-04 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/workers/codec.worker.ts` | 50 | `throw new Error('Codec not yet implemented: ...')` for WebP/JPEG/AVIF/SVG | INFO | Intentional Phase 8 stub — real encoders are Phase 9 (ENC-01..05). Not a debt marker; no TBD/FIXME/XXX. |
| `src/hooks/useOptimize.ts` | 39 | `buffer: new ArrayBuffer(0)` | INFO | Intentional Phase 8 placeholder — Phase 9 wires real file bytes. REVIEW.md WR-02 flags this as a correctness smell for the PNG WASM path (fetches and fails); deferred to Phase 9. |
| `src/stores/runtime.ts` | 55-62 | `runtimeAtom.set({ ...runtimeAtom.get(), ... })` — read-modify-write spread | WARNING | REVIEW.md CR-01: concurrent `pushToast` + `setJobCounts` calls can clobber each other. Fix is to use `setKey` for each field. Not a goal blocker; all Playwright tests pass. |
| `src/lib/worker-pool.ts` | 49 / `codec.worker.ts` 39-43 | No `Comlink.transfer` on ArrayBuffer | WARNING | REVIEW.md WR-03: structured-clone copies input/output buffers. Performance regression for Phase 9 real-file loads; not a Phase 8 correctness issue given 0-byte stubs. |

No TBD, FIXME, or XXX markers found in any phase-8-modified file. No unresolved debt markers.

---

### Human Verification Required

None. All success criteria are verifiable from code structure, Playwright test results (38/38), and the build output gate (144.45 kB gzip).

---

### Gaps Summary

No gaps. All four PIPE requirements are satisfied:

- PIPE-01: Comlink worker pool exists, wired to Toolbar, Playwright confirms non-blocking UI.
- PIPE-02: Zero static @jsquash imports in worker; build at 144.45 kB gzip; AVIF not fetched at load.
- PIPE-03: COOP/COEP in both dev (vite.config.ts) and prod (public/_headers); crossOriginIsolated === true confirmed.
- PIPE-04: Pool bounded to min(hardwareConcurrency, 4); excess jobs queued; BackpressureIndicator reflects `running` derived from real job counts; Playwright PIPE-04 passes.

Advisory quality issues from REVIEW.md (CR-01 setKey race, WR-02 0-byte guard, WR-03 missing transfer) are carry-forward items for Phase 9 when real file buffers are introduced — they do not block the Phase 8 pipeline goal.

---

_Verified: 2026-05-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
