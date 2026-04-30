---
phase: 02-worker-harness-state
plan: 01
subsystem: testing
tags: [phase-02, wave-0, playwright, fixtures, test-scaffolds, vr-01, vr-02, vr-03, vr-04, vr-05]

# Dependency graph
requires:
  - phase: 01-shell-foundation
    provides: "Playwright e2e harness (shell.spec.ts) with describe/beforeEach pattern; crossOriginIsolated console-error filter"
provides:
  - "Wave-0 failing-stub specs for VR-01..VR-05 on disk so downstream waves have a verification surface to satisfy"
  - "Deterministic Blob factory (makeSyntheticBlob, makeSyntheticBatch) for memory-budget tests"
  - "URL.createObjectURL/revokeObjectURL counter instrumentation for VR-04 leak parity tests"
  - "Convention: window.__OIMG_URL_COUNTS__ for page-context counter inspection (probes for window.__OIMG_STORES__ documented but not yet exposed)"
affects: [02-02-stores, 02-03-worker-harness, 02-04-ui-wiring, 02-05-cleanup]

# Tech tracking
tech-stack:
  added: []  # no production deps; pure test scaffolds
  patterns:
    - "test.fail() failing-stub markers — specs run cleanly and report intentional failures rather than crashing with TypeErrors"
    - "page.addInitScript({ path }) for pre-boot monkey-patch of browser globals (URL.createObjectURL/revokeObjectURL)"
    - "Deterministic synthetic Blob factory — sparse-fill Uint8Array (every 1024th byte), seeded by index"

key-files:
  created:
    - "src/tests/fixtures/synthetic.ts"
    - "src/tests/fixtures/instrument-blob-urls.ts"
    - "src/tests/worker-pool.spec.ts"
    - "src/tests/object-url.spec.ts"
    - "src/tests/aria-live.spec.ts"
  modified: []

key-decisions:
  - "Failing stubs use test.fail() markers (not toBe('NOT_YET_IMPLEMENTED') comparisons) — Playwright reports them as PASS when they fail as expected, giving a clean signal in CI"
  - "instrument-blob-urls.ts is an IIFE-style page-init script (no exports/imports) — runs in page context, not Playwright Node"

patterns-established:
  - "test.fail() probe-against-window pattern: stubs probe window.__OIMG_STORES__ which doesn't exist yet — fails cleanly with a typeof check rather than TypeError"
  - "page.addInitScript path resolution via fileURLToPath(import.meta.url) — avoids brittle CWD-relative paths"

requirements-completed: []  # PERF-01/02/03 are listed in frontmatter but Wave 0 ships only test scaffolds; full requirement closure happens in 02-02..02-04.

# Metrics
duration: 4min
completed: 2026-04-30
---

# Phase 2 Plan 01: Wave 0 Test Scaffolds Summary

**5 failing-stub Playwright specs + 2 deterministic fixtures establish the VR-01..VR-05 verification surface before any Phase 2 production code lands (Nyquist Rule).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-30T15:47:57Z
- **Completed:** 2026-04-30T15:52:00Z (approx)
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 0

## Accomplishments

- 5 new files in `src/tests/` establishing the testing contract for VR-01..VR-05
- All Wave-0 specs run without TypeErrors and report expected `test.fail()` markers (3 + 1 + 2 = 6 total stubs)
- Phase 1 regression preserved: `shell.spec.ts` still 11/11 PASS
- `tsc -b` exits 0; no type leakage from new fixtures into production bundle (test files excluded by Vite)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test fixtures (synthetic blobs + URL instrumentation)** - `07363ff` (test)
2. **Task 2: Create failing-stub Playwright specs (worker-pool, object-url, aria-live)** - `0a6db9a` (test)

**Plan metadata:** TBD (final docs commit follows this SUMMARY)

## Files Created

- `src/tests/fixtures/synthetic.ts` — Deterministic Blob factory: `makeSyntheticBlob(sizeBytes, seed)`, `makeSyntheticBatch(count, sizeBytes)`. Sparse-fill (every 1024th byte) to avoid quadratic alloc cost in 50×50 MB scenarios.
- `src/tests/fixtures/instrument-blob-urls.ts` — IIFE page-init script that monkey-patches `URL.createObjectURL`/`revokeObjectURL` and exposes counters on `window.__OIMG_URL_COUNTS__`. Loaded via `page.addInitScript({ path })` before app boots.
- `src/tests/worker-pool.spec.ts` — VR-01 (stub round-trip), VR-02 (concurrency cap), VR-03 (cancel correctness). 3 `test.fail()` stubs probing `window.__OIMG_STORES__`.
- `src/tests/object-url.spec.ts` — VR-04 (URL leak parity). 1 `test.fail()` stub; uses `addInitScript` to load instrumentation; reads `window.__OIMG_URL_COUNTS__`.
- `src/tests/aria-live.spec.ts` — VR-05 (quartile cadence). 2 `test.fail()` stubs (live-region presence + 12-file cadence).

## Decisions Made

- **`test.fail()` markers over sentinel-string comparisons** — Plan offered both options (`test.fail()` or `expect(...).toBe('NOT_YET_IMPLEMENTED')`). Picked `test.fail()` because Playwright treats expected failures as PASS, giving a green CI signal that the scaffolds are correctly red-but-interpretable. Sentinel comparisons would clutter the test runner with persistent FAIL output until Wave 1 lands.
- **`__filename`/`__dirname` reconstruction via `fileURLToPath(import.meta.url)`** — `object-url.spec.ts` resolves `INSTRUMENT_PATH` from its own file location rather than hardcoding `'src/tests/fixtures/...'` against process CWD. Robust to test invocation from any directory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Adjusted comment phrasing in `worker-pool.spec.ts` to satisfy strict `grep -c 'test.fail()'` acceptance gate**

- **Found during:** Task 2 verification
- **Issue:** The plan's `<verify>` automated gate is `grep -c 'test.fail()' src/tests/worker-pool.spec.ts | grep -q '^3$'`. The original docstring contained the literal string `test.fail()` in prose ("All tests in this file are CURRENTLY FAILING (test.fail()). They turn green when..."), which made the count 4 instead of 3.
- **Fix:** Reworded the comment to "All tests in this file are CURRENTLY FAILING via the test-fail marker. They turn green when..." — now exactly 3 actual `test.fail()` invocations match.
- **Files modified:** `src/tests/worker-pool.spec.ts`
- **Verification:** `awk '/test\.fail\(\)/{c++} END{print c}'` returns 3.
- **Committed in:** `0a6db9a` (part of Task 2 commit; correction made before commit)

---

**Total deviations:** 1 auto-fixed (1 trivial wording fix to satisfy strict grep gate)
**Impact on plan:** Cosmetic; comment retains the same meaning. No code-behavior change.

## Issues Encountered

- **RTK token-killer grep wraps results inconsistently** — interactive `grep -c` calls produced inflated match counts (e.g., 4 when the underlying file had 3). Used `awk` and `rtk proxy grep` to confirm exact counts. Verified the Playwright execution counts (3+1+2=6 expected fails) matches the actual `test.fail()` invocations.

## Threat Flags

None — Wave 0 ships test scaffolding only. The two threats in the plan's threat register (T-02-W0-01 page-init injection, T-02-W0-02 URL counter exposure) are accepted-disposition risks already documented as test-fixture-only and never bundled to dist.

## Next Plan Readiness

- **02-02 (Stores):** Has the failing specs probing `window.__OIMG_STORES__` and `window.__OIMG_URL_COUNTS__`. Plan 02-02 will create the three zustand stores and decide where/how to expose `__OIMG_STORES__` (App.tsx in dev/test mode per PATTERNS.md §"Page-context store inspection").
- **02-03 (Worker harness):** Has the VR-01/VR-02/VR-03 stubs ready to flip from `test.fail()` to real assertions once `WorkerPool` + stub adapter exist.
- **02-04 (UI wiring):** Has the ARIA live region (VR-05) and object-URL lifecycle (VR-04) stubs ready to flip green when Toolbar Optimize, palette Cancel, and the live-region announce wiring land.
- **PERF-01/02/03 closure** is deferred to 02-02..02-04 — Wave 0 establishes the verification scaffolds; the requirements are satisfied when stubs flip green.

## Self-Check: PASSED

Verification (commands run, all GREEN):
- `test -f src/tests/fixtures/synthetic.ts` → FOUND
- `test -f src/tests/fixtures/instrument-blob-urls.ts` → FOUND
- `test -f src/tests/worker-pool.spec.ts` → FOUND
- `test -f src/tests/object-url.spec.ts` → FOUND
- `test -f src/tests/aria-live.spec.ts` → FOUND
- `git log --oneline | grep 07363ff` → FOUND
- `git log --oneline | grep 0a6db9a` → FOUND
- `awk '/test\.fail\(\)/{c++} END{print c}'` worker-pool=3 / object-url=1 / aria-live=2 — matches acceptance criteria
- `./node_modules/.bin/tsc -b` exits 0
- `npx playwright test src/tests/shell.spec.ts` → 11/11 PASS (Phase 1 regression)
- `npx playwright test src/tests/worker-pool.spec.ts src/tests/object-url.spec.ts src/tests/aria-live.spec.ts` → 6 expected `test.fail()` stubs reported as PASS (Playwright treats expected failures as PASS)

---
*Phase: 02-worker-harness-state*
*Completed: 2026-04-30*
