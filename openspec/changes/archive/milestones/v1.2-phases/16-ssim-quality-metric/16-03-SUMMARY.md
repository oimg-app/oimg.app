---
phase: 16-ssim-quality-metric
plan: 03
subsystem: workers + stores
tags: [ssim, metrics, worker, comlink, wr-02, pipe-02]
dependency_graph:
  requires: [16-01]
  provides:
    - "getMetricsWorker() singleton"
    - "computeSSIM Comlink API"
    - "FileEntry.metrics field"
    - "setFileMetric store action"
    - "setFileResult metrics-invalidation invariant"
  affects: [16-04 useMetricsAuto hook, 16-05 ReportPanel Quality section]
tech-stack:
  added:
    - "ssim.js@3.5.0 dynamic import (wired via runtime dep from 16-01)"
  patterns:
    - "PIPE-02: dynamic-import-in-branch discipline"
    - "WR-02: single updateEntry funnel for per-entry mutations"
    - "V5: KNOWN_SOURCE/TARGET_FORMATS enum guards mirror KNOWN_CODECS"
    - "HMR dispose with explicit worker.terminate() (Pitfall 6)"
key-files:
  created:
    - src/workers/metrics.worker.ts
    - src/lib/metrics-worker.ts
    - .planning/phases/16-ssim-quality-metric/16-03-SUMMARY.md
  modified:
    - src/lib/settings.ts
    - src/stores/files.ts
    - src/tests/stores.test.ts
decisions:
  - "metrics.worker.ts is a sibling worker (not codec.worker.ts) — isolates ssim.js from the codec pipeline and keeps its ~130 kB out of the codec chunk"
  - "FileEntry.metrics carries three states: undefined (pending), null (failed compute), number (computed). setFileMetric writes number|null; setFileResult writes undefined."
  - "Generic setFileMetric<K extends 'ssim'> so Phase 17 can widen to 'ssim' | 'butteraugli' in one place with zero call-site rewrites."
  - "Enum guards + empty-buffer guards run BEFORE any dynamic import in computeSSIM — malformed input can't trigger a partial WASM load."
metrics:
  duration_min: ~15
  completed_date: 2026-07-20
---

# Phase 16 Plan 03: Metrics worker + singleton + FileEntry.metrics field + setFileMetric funnel + setFileResult invalidation Summary

Wired every non-UI piece of the SSIM pipeline: sibling Comlink worker (`computeSSIM`), singleton wrapper (`getMetricsWorker()`), `FileEntry.metrics` field, `setFileMetric` store action, and the cache-invalidation invariant on `setFileResult` that makes Phase 9 `useLiveEncode` re-encodes auto-recompute SSIM.

## What Changed

### New files

**`src/workers/metrics.worker.ts`** (134 LOC)
- Only Comlink imported at the top of the file (PIPE-02).
- Types: `SSIMJob`, `SSIMResult`, `MetricsApi`.
- `KNOWN_SOURCE_FORMATS` = `{png, jpeg, jpg, webp, avif, heic, heif}`, `KNOWN_TARGET_FORMATS` = `{png, jpeg, webp, avif}` — V5 enum guards run BEFORE any decode.
- `decode(buffer, fmt)` mirrors `codec.worker.ts:decodeSource` including the HEIC branch (`@/lib/heic/decode`). Each codec `await import(...)` lives inside its `switch` case.
- `computeSSIM(job)`: validates formats → guards empty buffers → parallel-decodes raw+enc → resizes raw to enc dims (only when needed, `method: 'lanczos3'`, `fitMethod: 'stretch'`) → dynamic `import('ssim.js')` (destructured `default ?? ssim` to survive UMD/ESM shim ambiguity) → returns `{ mssim, ms }` scalars only.
- Full body wrapped in try/catch → `return Promise.reject(err)` — worker survives malformed inputs.
- Bottom: `Comlink.expose({ computeSSIM })`.

**`src/lib/metrics-worker.ts`** (34 LOC)
- `import * as Comlink from 'comlink'` + `import type { MetricsApi }` (type-only).
- Module-scope `_worker: Worker | null` + `_proxy: Comlink.Remote<MetricsApi> | null`.
- `getMetricsWorker()` lazy-instantiates with **literal URL string** `new URL('../workers/metrics.worker.ts', import.meta.url)` — no backticks anywhere (Vite static-analysis requirement).
- HMR dispose explicitly calls `_worker?.terminate()` (Pitfall 6) then nulls both refs.

### Modified files

**`src/lib/settings.ts`** — Added one optional field to `FileEntry`:
```
metrics?: { ssim?: number | null }; // Phase 16 — MTR-01: perceptual-quality cache; undefined=pending, null=failed, number=computed
```
`defaultFileSettings()` untouched — `metrics` lives on `FileEntry`, not `FileSettings`.

**`src/stores/files.ts`** — Two surgical edits (WR-02 discipline preserved):
1. New `setFileMetric<K extends 'ssim'>(id, key, value)` above `setFileResult`, threads through the existing `updateEntry` funnel with `metrics: { ...(e.metrics ?? {}), [key]: value }`.
2. Extended `setFileResult` patch to include `metrics: undefined` — invalidates stale cache on every re-encode (Pitfall 4).

**`src/tests/stores.test.ts`** — New try/catch block with 6 assertions:
- setFileMetric writes only to target entry (sibling untouched)
- setFileMetric accepts `null` for failed-compute semantics
- setFileResult clears prior `metrics` while preserving status/encodedBuffer

## Deviations from Plan

### Deferred to 16-04 (documented, not a bug)

**T-16-03-05 acceptance criterion — `metrics.worker-*.js` chunk in `dist/`.** The build succeeds cleanly (`vite build` exits 0), but no `metrics*` chunks appear in `dist/` because Vite tree-shakes modules with no consumer. `src/lib/metrics-worker.ts` is imported only by `src/hooks/useMetricsAuto.ts` (Wave 2 / plan 16-04), which does not yet exist. Once 16-04 lands and imports `getMetricsWorker()`, both the singleton module and the worker chunk emit. Plan 16-05 will re-verify the chunk in its bundle-budget check per the phase success criteria. No code change needed — this is expected behavior for a Wave 1 pipe-laying plan.

### None else — all other acceptance criteria met on first pass.

## Verification

**Build gate:** `./node_modules/.bin/vite build` → exit 0 (3.53s + PWA 58ms).

**Unit gate:** `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/stores.test.ts` → `69 passed, 0 failed` (up from 63 baseline — 6 new assertions all pass).

**Acceptance greps** (all match plan expectations):
- `metrics.worker.ts`: 1 top-level import (Comlink only), 7 `await import` calls, 6 `@jsquash/` references, exactly 1 `Comlink.expose`, exactly 1 `fitMethod: 'stretch'`, 0 `ssim_map` references, 4 `KNOWN_*_FORMATS` references, exactly 1 `await import('ssim.js')`.
- `metrics-worker.ts`: exactly 1 literal URL, 0 backticks, 1 `Comlink.wrap<MetricsApi>`, 1 exported `getMetricsWorker`, 1 `_worker?.terminate()`, 2 `import.meta.hot` references, 1 type-only MetricsApi import.
- `stores/files.ts`: 1 `export function setFileMetric`, 1 `metrics: undefined`, 7 total `updateEntry(id,` calls (was 6).
- `stores.test.ts`: `setFileMetric` mentioned 4 times, `metrics: undefined` mentioned 1 time, `0.981` mentioned 5 times.

## Commits

| Task | Hash | Message |
|------|------|---------|
| T-16-03-01 | c3b4dfc | feat(phase-16): add FileEntry.metrics field for SSIM cache |
| T-16-03-02 | 6b09975 | feat(phase-16): add setFileMetric + invalidate metrics in setFileResult |
| T-16-03-03 | eb1a1bc | test(phase-16): assert setFileMetric writer + setFileResult invalidates metrics |
| T-16-03-04 | cc6e01b | feat(phase-16): create metrics.worker.ts with Comlink-exposed computeSSIM |
| T-16-03-05 | 5cad24f | feat(phase-16): getMetricsWorker() singleton with HMR-safe dispose |

## Self-Check: PASSED

- `src/workers/metrics.worker.ts` — FOUND
- `src/lib/metrics-worker.ts` — FOUND
- All 5 task commits present in `git log`.
- Build exits 0, unit tests 69/0.

## Handoff to 16-04

`useMetricsAuto` (Wave 2) can now:
```typescript
const worker = (await import('@/lib/metrics-worker')).getMetricsWorker()
const { mssim } = await worker.computeSSIM({
  rawBuffer: selected.rawBuffer!.slice(0),
  encodedBuffer: selected.encodedBuffer!.slice(0),
  sourceFormat: selected.type as 'png' | 'jpeg' | 'webp' | 'avif',
  targetFormat: selected.target as 'png' | 'jpeg' | 'webp' | 'avif',
})
setFileMetric(selected.id, 'ssim', mssim)
```
On failure, hook writes `null`. On any `setFileResult` (via `useLiveEncode` or `useOptimize`), the cache clears automatically — no explicit invalidation call needed at any call site.
