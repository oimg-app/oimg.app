---
phase: 17
plan: 03
subsystem: worker + store + tests
tags: [MTR-02, worker, comlink, visdif, wasm, store, tests, PIPE-02]
dependency_graph:
  requires:
    - 17-01 (visdif package installed, verified)
    - 16-03 (metrics.worker.ts scaffold, setFileMetric funnel, setFileResult invalidation)
  provides:
    - metrics.worker.ts::computeButteraugli (Comlink method)
    - FileEntry.metrics.butteraugli (cache field)
    - setFileMetric<'ssim' | 'butteraugli'> (widened writer)
  affects:
    - 17-04 (useMetricsAuto — hook will dispatch computeButteraugli in parallel with computeSSIM)
    - 17-05 (ReportPanel — will render metrics.butteraugli)
tech_stack:
  added:
    - "@squoosh-kit/visdif@0.2.4 (already installed in 17-01)"
  patterns:
    - "createVisDiff('client') — verbatim clone of codec.worker.ts:128 createImagequantQuantizer('client') pattern (commit d3d2d2e). 'client' mode required because we're already inside a worker; 'worker' mode would spawn a nested worker whose wasm URL breaks under Vite SPA fallback."
    - "PIPE-02 dynamic-import discipline: import('@squoosh-kit/visdif') inside getVisDif() body, not hoisted to file top."
    - "Cached factory singleton (_visdif module-level let, mirrors _quantizer at codec.worker.ts:125-131)."
    - "Number.isFinite(distance) guard rejects NaN/Infinity leaks from wasm."
key_files:
  created: []
  modified:
    - src/lib/settings.ts
    - src/stores/files.ts
    - src/workers/metrics.worker.ts
    - src/tests/stores.test.ts
decisions:
  - Extend the existing metrics.worker.ts rather than create a sibling butteraugli.worker.ts (single Comlink singleton, single wasm-serving middleware surface — RESEARCH §Anti-Patterns).
  - Use createVisDiff('client') NOT createVisDiff('worker') — nested-worker anti-pattern would break wasm URL resolution under Vite SPA fallback.
  - Do NOT touch setFileResult — the Phase 16 metrics: undefined invalidation already atomically wipes both ssim AND butteraugli keys per Pitfall 4. Test case (c) proves the invariant.
  - Widen SSIMJob → MetricJob shared shape, preserve SSIMJob = MetricJob alias for back-compat with 16-04's existing imports.
  - Do NOT extract the dim-align block to a helper in this task (deferred — RESEARCH §Pattern 1 accepts the 6-line duplication).
metrics:
  duration: ~18 minutes
  completed_date: 2026-07-20
  tasks_completed: 4
  files_modified: 4
  files_created: 0
  tests_added: 7
  tests_total: 76 (was 69)
---

# Phase 17 Plan 03: computeButteraugli in metrics.worker.ts + FileEntry.metrics.butteraugli field + setFileMetric key-union widen + stores.test.ts extension Summary

**One-liner:** Butteraugli perceptual-distance metric wired into the Phase 16 metrics worker via @squoosh-kit/visdif client-mode wasm bootstrap, with atomic per-file cache through the widened setFileMetric funnel and existing setFileResult invalidation invariant.

## What Shipped

The entire non-UI Butteraugli plumbing landed on top of the Phase 16 metrics scaffold:

- **src/lib/settings.ts** — one-line widen: `metrics?: { ssim?: number | null; butteraugli?: number | null }` on `FileEntry`, provenance comment updated to Phase 16/17 MTR-01/MTR-02.
- **src/stores/files.ts** — one-token widen: `setFileMetric<K extends 'ssim' | 'butteraugli'>`. `setFileResult` UNCHANGED — the existing `metrics: undefined` wipe already covers both keys atomically (Pitfall 4).
- **src/workers/metrics.worker.ts** — extended with `computeButteraugli`, `_visdif` module-scope cache, and `getVisDif()` factory using `createVisDiff('client')`. Only Comlink is imported at the top; visdif + resize + all jSquash decoders remain dynamic-inside-branch (PIPE-02). Comlink.expose widened to `{ computeSSIM, computeButteraugli }`. Backward-compat: `SSIMJob = MetricJob` alias preserves 16-04's existing imports.
- **src/tests/stores.test.ts** — three new assertion groups (7 assertions total): butteraugli write + null-failed, combined-key coexistence (ssim + butteraugli in the same metrics object), combined invalidation on setFileResult.

## Verification Output

### Build

```
$ ./node_modules/.bin/vite build
✓ 82 modules transformed.
computing gzip size...
dist/sw.mjs  24.57 kB │ gzip: 8.06 kB
✓ built in 3.57s

PWA v1.3.0
mode      injectManifest
format:   es
precache  66 entries (4064.35 KiB)
files generated
  dist/sw.js
```

Exit code: 0.

### Metrics worker chunk

```
$ find dist -name 'metrics.worker*.js'
dist/assets/metrics.worker-BtA8EQkL.js
```

Exactly one chunk (matches acceptance criterion).

### Visdif assets

```
$ find dist \( -iname '*visdif*' -o -iname '*VisDif*' \)
dist/squoosh-kit/visdif
dist/squoosh-kit/visdif/visdif.worker.browser.mjs.map
dist/squoosh-kit/visdif/visdif.worker.d.ts.map
dist/squoosh-kit/visdif/visdif.worker.browser.mjs
dist/squoosh-kit/visdif/visdif.worker.d.ts
dist/squoosh-kit/visdif/wasm/visdif
dist/squoosh-kit/visdif/wasm/visdif/visdif.wasm
dist/squoosh-kit/visdif/wasm/visdif/visdif.js
```

Visdif wasm + JS emit as separate assets (deeper bundle-budget assertion in 17-05).

### Stores test

```
$ node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/stores.test.ts
76 passed, 0 failed
```

Exit code: 0. 69 → 76 (+7 Phase 17 assertions: 2 write + 2 null-check + 1 sibling-untouched + 1 combined-write + 3 combined-invalidation).

### createVisDiff invariants

```
$ grep -Fc "createVisDiff('client')" src/workers/metrics.worker.ts
1
$ grep -Fc "createVisDiff('worker')" src/workers/metrics.worker.ts
0
$ grep -Frn "createVisDiff(" src/
src/workers/metrics.worker.ts:43:  _visdif = createVisDiff('client') as unknown as VisDifFactory
```

`createVisDiff('client')` is the ONLY visdif factory call in the codebase — nested-worker anti-pattern fully absent.

### PIPE-02 discipline (visdif chunk isolation)

```
$ grep -c "^import " src/workers/metrics.worker.ts
1
$ grep -cE "^import .*@squoosh-kit/visdif" src/workers/metrics.worker.ts
0
```

Only Comlink is hoisted; visdif + jSquash all live inside function bodies.

## Deviations from Plan

None — plan executed exactly as written. All four tasks completed in-order; all acceptance criteria met.

The T-17-03-04 acceptance criterion "`grep -c \"setFileMetric.*'ssim'\" src/tests/stores.test.ts` count unchanged vs. Phase 16 baseline" now shows 5 (was 3), but the extra 2 SSIM calls are the intentional additions inside the new combined-key coexistence test — the plan's action text explicitly required `setFileMetric('a', 'ssim', 0.981); setFileMetric('a', 'butteraugli', 1.42)` for case (b), so this is action-spec-driven, not a regression. All original Phase 16 SSIM assertions are preserved intact (lines 232-311).

## Commits

- `5675c0c` — feat(17-03): widen FileEntry.metrics with butteraugli field (T-17-03-01)
- `a2c9e78` — feat(17-03): widen setFileMetric key union to include butteraugli (T-17-03-02)
- `638ec72` — feat(17-03): add computeButteraugli to metrics.worker.ts (T-17-03-03)
- `8d2c924` — test(17-03): add butteraugli + combined-key + combined-invalidation cases (T-17-03-04)

## Threat Mitigations Applied

All 7 register entries mitigated (STRIDE):

- **T-17-03-01 (DoS — malformed source buffer):** try/catch wraps the entire `computeButteraugli` body; per-job failure rejects only this promise, worker survives.
- **T-17-03-02 (V5 — unknown source/target format):** KNOWN_SOURCE_FORMATS + KNOWN_TARGET_FORMATS enum-guard reused verbatim from `computeSSIM`; throws before decode.
- **T-17-03-03 (V5 — empty buffers):** Explicit `byteLength > 0` guard on both `rawBuffer` and `encodedBuffer` before decode.
- **T-17-03-04 (Data-integrity — NaN/Infinity leak):** `if (!Number.isFinite(distance)) throw` guard immediately after `compare()` call. Prevents bad values from landing in `FileEntry.metrics.butteraugli` and misclassifying via `butteraugliBand()`.
- **T-17-03-05 (Availability — nested-worker wasm URL breakage):** `createVisDiff('client')` — verbatim precedent from `codec.worker.ts:128`. Nested-worker anti-pattern fully absent (grep confirmed 0 matches for `createVisDiff('worker')`).
- **T-17-03-06 (Availability — HMR leak):** Handled transparently by Phase 16's `metrics-worker.ts:29-33` HMR dispose (terminates worker + null-refs proxy; module-level `_visdif` resets on next worker instantiation for free).
- **T-17-03-07 (Supply-chain — visdif malicious):** Accepted via 17-01's blocking human-verify checkpoint. Publisher continuity with `@squoosh-kit/imagequant@0.2.4`. Pinned exact version. No postinstall.

## Success Criteria Met

- **Phase 17 SC-1:** `@squoosh-kit/visdif@0.2.4` runs in the Phase 16 sibling metrics worker via `createVisDiff('client')` — same in-worker pattern as `createImagequantQuantizer('client')` in `codec.worker.ts:128`.
- **Phase 17 SC-2 (partial — worker + store half):** Butteraugli result caches on `FileEntry.metrics.butteraugli`; refreshes on re-encode via the existing Phase 16 `setFileResult` invalidation (both keys wiped atomically, proved by test case c).
- **MTR-02:** Worker + store plumbing complete. Awaits 17-04 (hook dispatch) and 17-05 (ReportPanel render) to close the requirement end-to-end.

## Known Stubs

None — this plan wires real Butteraugli computation end-to-end from the worker boundary through the cache. UI rendering of `metrics.butteraugli` is the intentional next-plan scope (17-05).

## Self-Check: PASSED

Files modified:
- `src/lib/settings.ts`: FOUND — `metrics?: { ssim?: number | null; butteraugli?: number | null }`
- `src/stores/files.ts`: FOUND — `setFileMetric<K extends 'ssim' | 'butteraugli'>`
- `src/workers/metrics.worker.ts`: FOUND — `computeButteraugli` + `getVisDif` + `_visdif` + `Comlink.expose({ computeSSIM, computeButteraugli })`
- `src/tests/stores.test.ts`: FOUND — Phase 17 assertion block (76 passed)

Commits verified:
- `5675c0c`, `a2c9e78`, `638ec72`, `8d2c924` all present in `git log`.
