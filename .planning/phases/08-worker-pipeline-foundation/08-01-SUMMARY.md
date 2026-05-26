---
phase: 08-worker-pipeline-foundation
plan: "01"
subsystem: testing-infrastructure
tags: [coop-coep, cross-origin-isolation, playwright, pipe-03, pipe-04]
dependency_graph:
  requires: []
  provides: [PIPE-03-verified, wave-0-test-scaffolds]
  affects: [src/tests/worker-pipeline.spec.ts, src/tests/backpressure.spec.ts, public/_headers]
tech_stack:
  added: []
  patterns: [playwright-page-evaluate, request-interception, indicator-class-assertion]
key_files:
  created:
    - src/tests/worker-pipeline.spec.ts
  modified:
    - src/tests/backpressure.spec.ts
    - public/_headers (verified byte-complete — no content change required)
decisions:
  - "PIPE-01/02 scaffold tests written against final behavior; expected red until Plan 03 wires WorkerPool"
  - "PIPE-04 asserts via visible indicator class (not window-exposed store) — runtimeAtom not window-exposed"
  - "public/_headers verified complete; already had trailing newline and both COOP/COEP headers"
metrics:
  duration: "~35 minutes (includes prior aborted attempt recovery)"
  completed_date: "2026-05-26"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 08 Plan 01: COOP/COEP Verification + Wave 0 Test Scaffolds Summary

**One-liner:** COOP/COEP headers verified byte-complete; crossOriginIsolated Playwright test passes; PIPE-01/02/04 Wave 0 scaffolds laid for Plans 02/03.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify and complete public/_headers COOP/COEP | (no change needed) | public/_headers (verified) |
| 2 | Create worker-pipeline.spec.ts PIPE-01/02/03 scaffold | 3bfdd25 | src/tests/worker-pipeline.spec.ts |
| 3 | Extend backpressure.spec.ts for real job counts | 1d43079 | src/tests/backpressure.spec.ts |

---

## What Was Built

**Task 1 — public/_headers verification:**
`public/_headers` was read and confirmed byte-complete:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```
File has trailing newline, both headers, and matches `vite.config.ts server.headers` verbatim. No modification needed. `vite.config.ts` was not touched (dev headers already correct).

**Task 2 — worker-pipeline.spec.ts (PIPE-01/02/03):**
Created Wave 0 test scaffold with three tests:
- `crossOriginIsolated is true (PIPE-03)` — `page.evaluate(() => crossOriginIsolated)` asserts `true`; PASSES.
- `UI stays interactive while worker encodes (PIPE-01)` — clicks Optimize all, asserts toolbar visible and enabled; expected RED until Plan 03 wires the WorkerPool.
- `AVIF WASM is not fetched on initial load (PIPE-02)` — registers `page.on('request')` listener before navigation, asserts no URL matches `/avif/i`; PASSES.

**Task 3 — backpressure.spec.ts extension (PIPE-04):**
Appended a third test to the existing `BackpressureIndicator — SHELL-02` describe block:
- `reflects real running job count after Optimize all (PIPE-04)` — clicks Optimize all, asserts indicator has `animate-pulse` class (active state).
- Both original tests (`is hidden on initial load`, `becomes visible when Optimize is clicked`) unchanged and green.

---

## Test Status After This Plan

| Test | File | Status | Notes |
|------|------|--------|-------|
| PIPE-03 crossOriginIsolated | worker-pipeline.spec.ts | GREEN | crossOriginIsolated === true confirmed |
| PIPE-01 UI interactive | worker-pipeline.spec.ts | EXPECTED RED | Needs Plan 03 WorkerPool wiring |
| PIPE-02 no AVIF on load | worker-pipeline.spec.ts | GREEN | No AVIF WASM fetched on initial route |
| PIPE-04 job count indicator | backpressure.spec.ts | GREEN | Via boolean running flag until Plan 03 |
| SHELL-02 hidden on load | backpressure.spec.ts | GREEN | Existing test unchanged |
| SHELL-02 visible on click | backpressure.spec.ts | GREEN | Existing test unchanged |

---

## Deviations from Plan

### No-op Tasks

**Task 1 — public/_headers already byte-complete**
- Found during: Task 1 read
- Issue: Plan noted file "may be truncated" per RESEARCH.md Pitfall 1; actual inspection showed file was complete with trailing newline.
- Fix: No modification needed. Verified via `python3` byte inspection: last byte `0xa`, content matches both header lines + `/*` route.
- No commit generated for this task (file unchanged).

---

## PIPE-01/02/04 Red Test Notes

Per plan design, these tests are Wave 0 scaffolds written against final behavior:
- **PIPE-01** stays red until Plan 03 lands the bounded WorkerPool and real worker offloading.
- **PIPE-04** currently passes via the boolean `running` flag but is written to gate the Plan 03 `runningJobs > 0` derivation. If `animate-pulse` class is removed from BackpressureIndicator.tsx, this test will catch the regression.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test files only.

## Known Stubs

None. Test files contain no placeholder data stubs.

---

## Self-Check: PASSED

- src/tests/worker-pipeline.spec.ts: FOUND
- src/tests/backpressure.spec.ts: FOUND (extended)
- public/_headers: FOUND (verified)
- Commit 3bfdd25: FOUND (git log confirms)
- Commit 1d43079: FOUND (git log confirms)
- PIPE-03 test: PASSED (Playwright exit 0)
- backpressure "becomes visible" test: PASSED (Playwright exit 0)
