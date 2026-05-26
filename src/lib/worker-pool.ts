// Phase 08 — PIPE-01/04: WorkerPool — bounded concurrency + job queue. Source: 08-02-PLAN.md
import * as Comlink from 'comlink'
import type { EncodeJob, EncodeResult } from '@/workers/codec.worker'

type WorkerApi = { optimize: (job: EncodeJob) => Promise<EncodeResult> }

interface PendingJob {
  job: EncodeJob
  resolve: (r: EncodeResult) => void
  reject: (e: unknown) => void
}

export class WorkerPool {
  private workers: Array<Comlink.Remote<WorkerApi>> = []
  private idle: Array<Comlink.Remote<WorkerApi>> = []
  private queue: PendingJob[] = []
  private _active = 0

  get active() { return this._active }
  get queued() { return this.queue.length }

  constructor(
    private readonly size: number,
    private readonly onCountChange: (active: number, queued: number) => void,
  ) {
    for (let i = 0; i < size; i++) {
      // CRITICAL: literal URL string — no template literals; Vite static analysis requires this form
      const w = new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })
      const proxy = Comlink.wrap<WorkerApi>(w)
      this.workers.push(proxy)
      this.idle.push(proxy)
    }
  }

  run(job: EncodeJob): Promise<EncodeResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject })
      this.onCountChange(this._active, this.queue.length)
      this._drain()
    })
  }

  private _drain(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!
      const pending = this.queue.shift()!
      this._active++
      this.onCountChange(this._active, this.queue.length)
      worker.optimize(pending.job).then(
        (result) => { pending.resolve(result); this._release(worker) },
        (err) => { pending.reject(err); this._release(worker) },
      )
    }
  }

  private _release(worker: Comlink.Remote<WorkerApi>): void {
    this._active--
    this.idle.push(worker)
    this.onCountChange(this._active, this.queue.length)
    this._drain()
  }
}

let _instance: WorkerPool | null = null

export function getPool(): WorkerPool {
  if (!_instance) {
    const size = Math.min(navigator.hardwareConcurrency ?? 4, 4)
    _instance = new WorkerPool(size, (active, queued) => {
      // Lazy import avoids circular dep: worker-pool → stores/runtime
      import('@/stores/runtime').then(({ setJobCounts }) => setJobCounts(active, queued))
    })
  }
  return _instance
}

// HMR cleanup — terminate stale workers on hot reload (Open Question 2)
if (import.meta.hot) {
  import.meta.hot.dispose(() => { _instance = null })
}
