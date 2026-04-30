// Phase 2 — Runtime store (ephemeral; queue + urlCache + pool stats).
// Source: 02-CONTEXT.md D-07/D-08/D-10/D-11; 02-RESEARCH.md §Pattern 4 + Pattern 5.
// IN-MEMORY ONLY (Phase 7 wires persistence — NOT here, per D-08).

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export const POOL_SIZE = Math.min(
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2,
  4,
) // Pitfall 6 defensive default — lower bound 2, upper bound 4.

interface RuntimeState {
  running: boolean
  queue: string[] // jobIds in FIFO order (D-03, D-08)
  inFlight: Set<string> // jobIds currently dispatched
  doneCount: number
  totalJobs: number
  errorCount: number
  poolSize: number // exposed for Toolbar Workers pill (UI-SPEC §1)
  urlCache: Map<string, string> // FileEntry.id → object URL (D-10, A3)

  // Batch lifecycle
  startBatch: (jobIds: string[]) => void
  markStarted: (jobId: string) => void
  markDone: (jobId: string) => void
  markError: (jobId: string, message: string) => void
  cancelBatch: () => void

  // Object URL lifecycle (D-10)
  getOrCreateObjectURL: (fileId: string, blob: Blob) => string
  revokeObjectURL: (fileId: string) => void
}

export const useRuntimeStore = create<RuntimeState>()(
  subscribeWithSelector((set, get) => ({
    running: false,
    queue: [],
    inFlight: new Set<string>(),
    doneCount: 0,
    totalJobs: 0,
    errorCount: 0,
    poolSize: POOL_SIZE,
    urlCache: new Map<string, string>(),

    startBatch: (jobIds) =>
      set({
        running: jobIds.length > 0,
        queue: [...jobIds],
        inFlight: new Set<string>(),
        totalJobs: jobIds.length,
        doneCount: 0,
        errorCount: 0,
      }),

    markStarted: (jobId) =>
      set((s) => {
        // CR-03: pool is the source of truth for "this job is dispatched."
        // Idempotent — already-dispatched jobs no-op. Queue membership is
        // NOT a precondition: if a future caller orders enqueue() before
        // startBatch(), or strict-mode renders the queue write twice, we
        // still want inFlight populated so subsequent markDone/markError
        // run their bookkeeping.
        const inFlight = new Set(s.inFlight)
        if (inFlight.has(jobId)) return {}
        inFlight.add(jobId)
        return {
          queue: s.queue.filter((id) => id !== jobId),
          inFlight,
        }
      }),

    markDone: (jobId) =>
      set((s) => {
        // Pitfall 4 / T-02-01 (cancel race): if cancelBatch already cleared inFlight,
        // ignore the late markDone — do NOT bump doneCount, do NOT flip running.
        if (!s.inFlight.has(jobId)) return {}
        const inFlight = new Set(s.inFlight)
        inFlight.delete(jobId)
        const doneCount = s.doneCount + 1
        const stillRunning = inFlight.size > 0 || s.queue.length > 0
        return {
          inFlight,
          doneCount,
          running: stillRunning,
        }
      }),

    markError: (jobId, _message) =>
      set((s) => {
        if (!s.inFlight.has(jobId)) return {}
        const inFlight = new Set(s.inFlight)
        inFlight.delete(jobId)
        const errorCount = s.errorCount + 1
        const stillRunning = inFlight.size > 0 || s.queue.length > 0
        return {
          inFlight,
          errorCount,
          running: stillRunning,
        }
      }),

    cancelBatch: () =>
      set({
        running: false,
        queue: [],
        inFlight: new Set<string>(),
        // doneCount, errorCount, totalJobs preserved for post-cancel UI.
      }),

    getOrCreateObjectURL: (fileId, blob) => {
      const cached = get().urlCache.get(fileId)
      if (cached) return cached
      const url = URL.createObjectURL(blob)
      const next = new Map(get().urlCache)
      next.set(fileId, url)
      set({ urlCache: next })
      return url
    },

    revokeObjectURL: (fileId) => {
      const url = get().urlCache.get(fileId)
      if (!url) return
      URL.revokeObjectURL(url)
      const next = new Map(get().urlCache)
      next.delete(fileId)
      set({ urlCache: next })
    },
  })),
)
