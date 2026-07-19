// Phase 16 — MTR-01: singleton Comlink wrapper around the metrics worker.
// Analog: src/lib/worker-pool.ts (getPool). The metrics worker is a N=1 reduction —
// no job queue, no bounded concurrency; the hook (16-04) guards concurrent dispatch
// via a CR-02 seqRef so back-to-back computeSSIM calls simply supersede each other.
import * as Comlink from 'comlink'
import type { MetricsApi } from '@/workers/metrics.worker'

let _worker: Worker | null = null
let _proxy: Comlink.Remote<MetricsApi> | null = null

/**
 * Lazy-instantiate the metrics worker + its Comlink proxy. Callers invoke
 * getMetricsWorker().computeSSIM(job) directly — no queue helper needed because
 * the metrics worker owns a single in-flight computation at a time by design.
 */
export function getMetricsWorker(): Comlink.Remote<MetricsApi> {
  if (_proxy) return _proxy
  // CRITICAL: literal URL string — no template literals; Vite static analysis
  // requires this exact shape to detect the worker entry at build time.
  _worker = new Worker(new URL('../workers/metrics.worker.ts', import.meta.url), { type: 'module' })
  _proxy = Comlink.wrap<MetricsApi>(_worker)
  return _proxy
}

// HMR cleanup — Pitfall 6: an explicit terminate() is REQUIRED. worker-pool.ts
// relies on the WorkerPool instance holding its internal worker refs and being
// GC'd; the singleton has no such wrapper, so we must terminate the raw Worker.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _worker?.terminate()
    _worker = null
    _proxy = null
  })
}
