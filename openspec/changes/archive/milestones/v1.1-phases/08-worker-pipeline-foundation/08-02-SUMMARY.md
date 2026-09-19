---
phase: 08-worker-pipeline-foundation
plan: "02"
subsystem: worker-pipeline
tags: [comlink, worker, wasm, dynamic-import, pool, backpressure]
dependency_graph:
  requires: []
  provides:
    - src/workers/codec.worker.ts
    - src/lib/worker-pool.ts
  affects:
    - src/stores/runtime.ts
tech_stack:
  added: []
  patterns:
    - Comlink.expose/wrap for typed worker RPC
    - Dynamic await import() inside worker switch branch (code-splitting)
    - Hand-rolled bounded WorkerPool (~80 lines, no extra dependency)
    - Lazy store import in onCountChange to avoid circular dep
    - import.meta.hot.dispose for HMR worker teardown
key_files:
  created:
    - src/workers/codec.worker.ts
    - src/lib/worker-pool.ts
  modified:
    - src/stores/runtime.ts
decisions:
  - "PNG→OxiPNG is the one real codec path in Phase 8; all others throw NotImplemented"
  - "setJobCounts added to runtimeAtom (Rule 2 deviation) — required for worker-pool lazy import"
  - "running: boolean preserved in RuntimeState for BackpressureIndicator backward compat"
metrics:
  duration: "~20m"
  completed: "2026-05-26"
  tasks: 2
  files: 3
---

# Phase 08 Plan 02: Codec Worker + WorkerPool Summary

**One-liner:** Comlink-exposed codec worker with PNG→OxiPNG real path, all other codecs dynamically-imported stubs, plus a hand-rolled bounded WorkerPool singleton with HMR-safe teardown.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create codec.worker.ts | `3684848` | src/workers/codec.worker.ts |
| 2 | Create worker-pool.ts | `ff134d9` | src/lib/worker-pool.ts |

---

## Exported Interfaces (for Plan 03 consumption)

### `src/workers/codec.worker.ts`
```typescript
export interface EncodeJob {
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'
  buffer: ArrayBuffer
  settings: Record<string, unknown>
}

export interface EncodeResult {
  buffer: ArrayBuffer
  originalSize: number
  optimizedSize: number
}
```
Worker exposes `{ optimize(job: EncodeJob): Promise<EncodeResult> }` via `Comlink.expose`.

### `src/lib/worker-pool.ts`
```typescript
export class WorkerPool {
  get active(): number
  get queued(): number
  run(job: EncodeJob): Promise<EncodeResult>
}

export function getPool(): WorkerPool
// Singleton; size = Math.min(navigator.hardwareConcurrency ?? 4, 4)
// Lazy-imports setJobCounts from @/stores/runtime in onCountChange
```

### `src/stores/runtime.ts` (extended)
```typescript
export function setJobCounts(running: number, queued: number): void
// Sets runningJobs, queuedJobs, and derives running: boolean for BackpressureIndicator
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added setJobCounts to runtime.ts**
- **Found during:** Task 2 verification
- **Issue:** worker-pool.ts lazy-imports `{ setJobCounts }` from `@/stores/runtime` in its `onCountChange` callback. The function did not exist — the import would resolve to `undefined`, silently breaking backpressure store updates.
- **Fix:** Extended `RuntimeState` with `runningJobs: number` and `queuedJobs: number`; added `setJobCounts(running, queued)` action that derives `running: boolean` from counts (preserving BackpressureIndicator contract).
- **Files modified:** `src/stores/runtime.ts`
- **Commit:** `4ae454e`

---

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/workers/codec.worker.ts | `case 'WebP'/'JPEG'/'AVIF'/'SVG': throw NotImplemented` | Real encoders land in Phase 9 (ENC-01 through ENC-05) |

---

## Threat Model Coverage

| Threat ID | Mitigation | Implemented |
|-----------|------------|-------------|
| T-08-01 | try/catch wraps switch; malformed buffer rejects job Promise, never crashes worker | codec.worker.ts lines 31-54 |
| T-08-03 | KNOWN_CODECS Set validation before switch; invalid codec throws | codec.worker.ts lines 23-26 |
| T-08-04 | All @jsquash/* imports are await import() inside branch — no static top-level imports | codec.worker.ts — grep count 0 |
| T-08-SC | No new packages installed | confirmed — package.json unchanged |

---

## Self-Check: PASSED

- [x] `src/workers/codec.worker.ts` exists
- [x] `src/lib/worker-pool.ts` exists
- [x] `src/stores/runtime.ts` exports `setJobCounts`
- [x] Commits 3684848, ff134d9, 4ae454e verified in git log
- [x] `npx tsc -b --noEmit` clean
- [x] Zero static top-level `@jsquash/*` imports in codec.worker.ts
- [x] Literal Worker URL (no template literal) in worker-pool.ts
