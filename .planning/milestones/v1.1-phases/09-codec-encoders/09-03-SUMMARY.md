---
phase: 09-codec-encoders
plan: "03"
subsystem: hooks/stores
tags: [real-bytes, useOptimize, useLiveEncode, rawBuffer, Comlink-transfer, D-04, D-05, D-07, D-13, ENC-06]
dependency_graph:
  requires:
    - FileSettings + setFileResult/setFileError/setFileRawBuffer (Plan 01)
    - EncodeJob.sourceFormat + codec adapters (Plan 02)
  provides:
    - Real-bytes batch dispatch in useOptimize (src/hooks/useOptimize.ts)
    - Debounced single-file re-encode hook useLiveEncode (src/hooks/useLiveEncode.ts)
    - encodingFileId state + setEncodingFile action (src/stores/runtime.ts)
  affects:
    - Plan 04 (inspector controls) — depends on useLiveEncode.trigger + runtimeAtom.encodingFileId
    - DeltaStrip — reads encodingFileId for in-flight shimmer (UI-SPEC §4)
tech_stack:
  added: []
  patterns:
    - rawBuffer.slice(0) before pool.run — preserves cached bytes across repeated Comlink.transfer (Pitfall 3)
    - Promise.allSettled paired with [id, name, job] tuples — per-file result routing without batch abort
    - useRef+clearTimeout+setTimeout(300ms) debounce — no external library (D-07)
    - setEncodingFile before/finally pattern — atomic CR-01 setKey drives DeltaStrip shimmer
    - D-13 error path: setFileError + toast.error, original bytes retained as fallback
key_files:
  created:
    - src/hooks/useLiveEncode.ts
  modified:
    - src/hooks/useOptimize.ts
    - src/stores/runtime.ts
decisions:
  - pool.run(job) — not pool.run(Comlink.transfer(...)) — because WorkerPool._drain already wraps in Comlink.transfer; double-transfer would be incorrect
  - Pairs array [id, name, job] keeps allSettled results aligned with entry identity without a second entries.find pass
  - setEncodingFile placed before try (not inside) so shimmer appears even if pool.run throws synchronously
  - toCodec helper copied into useLiveEncode (not shared module) to avoid creating a new import coupling
metrics:
  duration: "~20m"
  completed: "2026-05-26"
  tasks: 2
  files: 3
---

# Phase 09 Plan 03: Real-bytes optimize path + useLiveEncode debounced hook Summary

**One-liner:** Real File→ArrayBuffer bytes dispatched via pool with rawBuffer.slice(0) copy, results routed to setFileResult/setFileError, and new useLiveEncode debounce hook with encodingFileId shimmer signal.

## What Was Built

**Task 1 — Real-bytes useOptimize (src/hooks/useOptimize.ts):**
- Removed `new ArrayBuffer(0)` stubs; now reads `entry.rawBuffer` or `entry.file.arrayBuffer()` (D-04)
- Calls `setFileRawBuffer(id, buf)` to cache bytes before dispatch
- Builds `EncodeJob` with `rawBuffer.slice(0)` so cached raw bytes survive Comlink.transfer (Pitfall 3)
- `Promise.allSettled` over `[id, name, job]` pairs — fulfilled → `setFileResult`; rejected → `setFileError` + `toast.error` (D-13)
- Entries with no rawBuffer and no File handle are silently skipped — never dispatches empty buffers (T-9-V5)

**Task 2 — useLiveEncode hook + encodingFileId (src/hooks/useLiveEncode.ts + src/stores/runtime.ts):**
- `src/stores/runtime.ts`: added `encodingFileId: string | null` to `RuntimeState` (initial `null`) and exported `setEncodingFile(id)` using atomic `setKey` (CR-01 pattern)
- `src/hooks/useLiveEncode.ts`: exports `useLiveEncode()` returning `{ trigger }`
- `trigger(fileId)` debounces via `useRef<ReturnType<typeof setTimeout>>` + `clearTimeout` + `setTimeout(..., 300)` — no external debounce library (D-07)
- Inside timeout: guard for `entry.rawBuffer` + `entry.settings`; `setEncodingFile(fileId)` before dispatch; `pool.run(job)` with `buffer: rawBuffer.slice(0)`; `setFileResult` on success; `setFileError + toast.error` on catch (D-13); `setEncodingFile(null)` in finally

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — Real-bytes useOptimize | 96b887f | src/hooks/useOptimize.ts |
| 2 — useLiveEncode + encodingFileId | 6e44bdf | src/hooks/useLiveEncode.ts, src/stores/runtime.ts |

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| codec-encoders.spec.ts (Chromium) | 7/7 | PASS |

All 7 tests (ENC-01 PNG, ENC-02 WebP, ENC-03 JPEG, ENC-04 AVIF, ENC-05 SVG, ENC-06 settings delta, D-13 error) pass after Plan 03 changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deviation] pool.run() called directly, not pool.run(Comlink.transfer(...))**
- **Found during:** Task 1 implementation
- **Issue:** The plan spec says `pool.run(Comlink.transfer(job, [job.buffer]))` but `WorkerPool.run()` takes `EncodeJob` (a plain TypeScript function). `Comlink.transfer()` returns a `TransferDescriptor` — valid only for Comlink proxied functions. The pool's `_drain()` already calls `worker.optimize(Comlink.transfer(pending.job, [pending.job.buffer]))` internally (line 49 of worker-pool.ts), so double-wrapping would be incorrect and would break the pool's type signature.
- **Fix:** Called `pool.run(job)` directly with `job.buffer = rawBuffer.slice(0)` — the transfer is handled inside the pool. Zero behavior difference; rawBuffer copy protection is preserved.
- **Files modified:** src/hooks/useOptimize.ts, src/hooks/useLiveEncode.ts
- **Commit:** 96b887f, 6e44bdf

## Known Stubs

None. Both hooks dispatch real bytes and route results to real store actions.

## Threat Surface Scan

No new network endpoints introduced. All changes are in-memory hook/store mutations. Threat mitigations per plan:

| Threat ID | Status |
|-----------|--------|
| T-9-V5 (DoS — empty buffer) | Mitigated: guard in useOptimize and useLiveEncode skips entries with no rawBuffer |
| T-9-FB (D-13 error path) | Mitigated: catch → setFileError + toast.error + retain original bytes; batch continues |
| T-9-XFER (Comlink.transfer neuters buffer) | Mitigated: rawBuffer.slice(0) copy passed to pool.run — cached rawBuffer survives repeated triggers |
| T-9-PII (rawBuffer in memory) | Accepted: zero-server/zero-telemetry (CLAUDE.md); bytes never leave the browser |

## Self-Check: PASSED

- src/hooks/useOptimize.ts: no `ArrayBuffer(0)`, contains `slice(0)` x2, `setFileResult`, `setFileError`, `toast.error`
- src/hooks/useLiveEncode.ts: exports `useLiveEncode`, contains `setTimeout` x2, `clearTimeout`, `setEncodingFile` x3, `slice(0)`, `setFileResult`, `setFileError`, `toast.error`
- src/stores/runtime.ts: `encodingFileId` in RuntimeState + initial value `null` + `setEncodingFile` export using `setKey`
- `npx tsc --noEmit` clean (0 errors)
- 7/7 codec-encoders Playwright tests pass on Chromium (exit code 0)
- Commits 96b887f and 6e44bdf verified in git log
