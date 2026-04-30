// Phase 2 — WorkerPool singleton orchestrator.
// Source: 02-RESEARCH.md §Pattern 1-3 + Pitfalls 1, 2, 4, 6; 02-CONTEXT.md D-01..D-03, D-11, D-12.
//
// Lifecycle: lazy spawn on first enqueue (Open Question 1 recommendation).
// Cancel semantics: terminate all + respawn fresh (D-02). No cooperative cancel.
// Streaming concurrency: blob.arrayBuffer() ONLY when worker is free (D-11).
// Detach hygiene: never read `input` after Comlink.transfer (Pitfall 2 / D-12).

import * as Comlink from 'comlink'
import type {
  AdapterRunResult,
  PoolJob,
  WorkerProxyApi,
} from './types'

const POOL_SIZE_MAX = 4

function computePoolSize(): number {
  const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  return Math.min(hw, POOL_SIZE_MAX)
}

interface Slot {
  worker: Worker
  proxy: Comlink.Remote<WorkerProxyApi>
}

interface PendingJob extends PoolJob {
  resolve: (r: AdapterRunResult) => void
  reject: (err: unknown) => void
  // CR-02: explicit settled flag so cancel() does NOT fire onError for jobs
  // whose proxy.runJob already resolved/rejected before the abort tripped.
  settled: boolean
}

export interface PoolCallbacks {
  /** Pool dispatched the job to a worker (D-06: 'started' state). */
  onStarted?: (jobId: string) => void
  /** Adapter resolved successfully. */
  onDone?: (jobId: string, result: AdapterRunResult) => void
  /** Adapter rejected OR worker was terminated. */
  onError?: (jobId: string, error: unknown) => void
}

export class WorkerPool {
  private size: number
  private slots: (Slot | null)[] = []
  private idle: number[] = []
  private queue: PendingJob[] = []
  private inFlight = new Map<number, PendingJob>() // slot → job
  private abortController: AbortController | null = null
  private spawned = false
  // CR-01: monotonic generation counter. Each cancel() bumps this; runOnSlot
  // captures the value at dispatch time and bails out of its finally block if
  // the generation no longer matches — preventing stale slot indexes from
  // being pushed back onto the new pool's idle list.
  private generation = 0

  constructor(private callbacks: PoolCallbacks = {}) {
    this.size = computePoolSize()
  }

  get stats(): { size: number; busy: number; queueDepth: number; idle: number } {
    return {
      size: this.size,
      busy: this.size - this.idle.length,
      queueDepth: this.queue.length,
      idle: this.idle.length,
    }
  }

  /** Enqueue a job. Lazy-spawns the pool on first call. Returns a promise that
   * resolves with the adapter output (or rejects with AbortError on cancel). */
  enqueue(job: PoolJob): Promise<AdapterRunResult> {
    if (!this.spawned) this.spawnAll()
    return new Promise<AdapterRunResult>((resolve, reject) => {
      this.queue.push({ ...job, resolve, reject, settled: false })
      this.tryDispatch()
    })
  }

  /** Hard-stop all in-flight + queued jobs. Terminates workers, rejects
   * pending promises with AbortError, respawns the pool fresh (D-02). */
  cancel(): void {
    const error = new DOMException('Batch cancelled', 'AbortError')
    // CR-01: bump generation so any pending runOnSlot finally blocks tied to
    // the previous generation no-op when they unwind.
    this.generation += 1
    // Trip the abort controller so Promise.race in dispatched jobs rejects.
    this.abortController?.abort()
    // Terminate all workers — kills WASM regardless of state.
    for (const slot of this.slots) slot?.worker.terminate()
    // Reject still-queued jobs (never dispatched).
    for (const job of this.queue) {
      if (!job.settled) {
        job.settled = true
        job.reject(error)
        this.callbacks.onError?.(job.id, error)
      }
    }
    // CR-02: only fire onError for genuinely unsettled in-flight jobs. A job
    // whose proxy.runJob already resolved (and called job.resolve) but whose
    // finally block has not yet run will be settled=true; firing onError for
    // it would double-count via runtime.markError after markDone already ran.
    for (const job of this.inFlight.values()) {
      if (!job.settled) {
        job.settled = true
        job.reject(error)
        this.callbacks.onError?.(job.id, error)
      }
    }
    this.queue = []
    this.inFlight.clear()
    this.slots = []
    this.idle = []
    this.spawned = false
    this.abortController = null
    // Respawn fresh — codec WASM state discarded with terminated workers.
    this.spawnAll()
  }

  /** Permanent teardown — used during app unmount or test cleanup. */
  terminate(): void {
    for (const slot of this.slots) slot?.worker.terminate()
    this.slots = []
    this.idle = []
    this.queue = []
    this.inFlight.clear()
    this.spawned = false
    // WR-07: clear stale abortController so a subsequent re-spawn doesn't
    // observe a controller whose signal is already aborted.
    this.abortController = null
    // Bump generation for symmetry with cancel(): any in-flight finally
    // closures captured against the old generation will no-op.
    this.generation += 1
  }

  private spawnAll(): void {
    this.abortController = new AbortController()
    for (let i = 0; i < this.size; i++) this.spawnOne(i)
    this.spawned = true
  }

  private spawnOne(slot: number): void {
    // CRITICAL: new URL + import.meta.url + { type: 'module' } — Vite canonical idiom.
    // DO NOT use ?worker suffix (Pitfall 1).
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })
    const proxy = Comlink.wrap<WorkerProxyApi>(worker)
    this.slots[slot] = { worker, proxy }
    this.idle.push(slot)
  }

  private tryDispatch(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const slot = this.idle.shift()!
      const job = this.queue.shift()!
      this.inFlight.set(slot, job)
      this.callbacks.onStarted?.(job.id)
      // Fire-and-forget — do NOT await; tryDispatch is sync drain.
      void this.runOnSlot(slot, job)
    }
  }

  private async runOnSlot(slot: number, job: PendingJob): Promise<void> {
    const slotRef = this.slots[slot]
    if (!slotRef) {
      // Slot was terminated mid-flight — abort path already handled.
      return
    }
    // CR-01: capture pool generation at dispatch time. If cancel()/terminate()
    // bumps it before this job unwinds, the finally block becomes a no-op so
    // we don't push a stale slot index onto the new pool's idle list.
    const generation = this.generation
    const signal = this.abortController!.signal
    try {
      // D-11/D-12: derive ArrayBuffer immediately before postMessage; never store.
      const input = await job.blob.arrayBuffer()
      // Pitfall 4: race the proxy call against the abort signal so cancel rejects.
      const result = await Promise.race([
        slotRef.proxy.runJob(
          // Pitfall 2: after this transfer, `input` is detached in main thread.
          Comlink.transfer(input, [input]),
          job.settings,
          job.format
        ),
        new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new DOMException('Batch cancelled', 'AbortError'))
            return
          }
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Batch cancelled', 'AbortError')),
            { once: true }
          )
        }),
      ])
      // CR-02: mark settled BEFORE the resolve callback runs so a racing
      // cancel() observes the settled=true flag and skips its onError fan-out.
      if (!job.settled) {
        job.settled = true
        job.resolve(result)
        this.callbacks.onDone?.(job.id, result)
      }
    } catch (err) {
      if (!job.settled) {
        job.settled = true
        job.reject(err)
        this.callbacks.onError?.(job.id, err)
      }
    } finally {
      // CR-01: stale generation → cancel() already wiped slots[]/idle[] and
      // (re)spawned a fresh pool. Touching this.slots / this.idle now would
      // corrupt the new generation's bookkeeping.
      if (generation !== this.generation) return
      this.inFlight.delete(slot)
      // Worker may have been terminated mid-flight (cancel) — guard.
      if (this.slots[slot]) {
        this.idle.push(slot)
        this.tryDispatch()
      }
    }
  }
}

/** Module-level singleton — one pool per app lifetime. Exposed for the runtime
 * store to call enqueue/cancel from action handlers (D-08). */
let _pool: WorkerPool | null = null

export function getWorkerPool(callbacks?: PoolCallbacks): WorkerPool {
  if (!_pool) _pool = new WorkerPool(callbacks)
  return _pool
}

/** Test-only — replace the singleton (e.g., to inject a fake pool in unit tests). */
export function __setWorkerPoolForTesting(pool: WorkerPool | null): void {
  _pool?.terminate()
  _pool = pool
}
