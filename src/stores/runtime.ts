// Phase 2 — Runtime store (ephemeral; queue + urlCache + pool stats).
// Source: 02-CONTEXT.md D-07/D-08/D-10/D-11; 02-RESEARCH.md §Pattern 4 + Pattern 5.
// IN-MEMORY ONLY (Phase 7 wires persistence — NOT here, per D-08).
//
// Phase 3 plan 03-B — added previewJobId + enqueuePreview action (D-10/D-11
// real-time re-optimize on selected file with debounce + cancel race
// protection). Plugin-toggle subscriber wired in App.tsx fires this.

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { getWorkerPool } from '@/workers/pool'
import type { PoolJob } from '@/workers/types'
import { sanitizeSvg } from '@/lib/sanitize-svg'
// Phase 3 plan 03-B — enqueuePreview reads from the files + settings stores.
// `files.ts` already statically imports `useRuntimeStore` from this module,
// so the static cycle here is intentional. JS resolves it because both
// modules export named bindings (the zustand store hooks) that are accessed
// lazily at call time via getState() — neither side needs the other's
// internals at module-init time.
import { useFilesStore } from './files'
import { useSettingsStore } from './settings'

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
  // Phase 3 (D-11) — id of the currently-pending single-file preview job,
  // or null if no preview is in flight. The plugin-toggle subscriber writes
  // a fresh UUID here on each enqueue; pool.cancel() before re-enqueue means
  // last-toggle-wins (terminate-and-respawn cancel from Phase 2 D-02).
  previewJobId: string | null

  // Batch lifecycle
  startBatch: (jobIds: string[]) => void
  markStarted: (jobId: string) => void
  markDone: (jobId: string) => void
  markError: (jobId: string, message: string) => void
  cancelBatch: () => void

  // Object URL lifecycle (D-10)
  getOrCreateObjectURL: (fileId: string, blob: Blob) => string
  revokeObjectURL: (fileId: string) => void

  // Phase 3 (D-08/D-10/D-11) — debounced single-file preview re-optimize.
  // Toggling a plugin while a SVG file is selected enqueues a fresh job
  // through the worker pool; rapid toggles within 200ms coalesce; an
  // in-flight preview is cancelled if no batch is running.
  enqueuePreview: (fileId: string) => void
}

// Inline debounce — keeps the runtime store self-contained. Coalesces rapid
// invocations within `ms`; the last call wins (D-11).
function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: TArgs) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, ms)
  }
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
    previewJobId: null,

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

    markError: (jobId, message) =>
      set((s) => {
        if (!s.inFlight.has(jobId)) return {}
        const inFlight = new Set(s.inFlight)
        inFlight.delete(jobId)
        // WR-06: cancel-induced AbortError fan-out from WorkerPool.cancel()
        // hits markError for every in-flight job. Bumping errorCount in that
        // path makes the App-level "Batch complete" subscriber see
        // doneCount + errorCount === totalJobs and announce a misleading
        // partial-success toast on user cancel. Discriminate the cancel
        // message so cancelled jobs are removed from inFlight without
        // counting as real adapter failures.
        const isCancel =
          message === 'Batch cancelled' ||
          message === 'Batch canceled' ||
          message.includes('AbortError')
        const errorCount = isCancel ? s.errorCount : s.errorCount + 1
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

    // Phase 3 (D-08/D-10/D-11) — debounced single-file preview re-optimize.
    //
    // Flow on each call:
    //   1. Coalesce within 200 ms (D-11): the inner fn fires only after the
    //      caller stops toggling for 200 ms.
    //   2. If no batch is running, cancel the worker pool (terminate-and-
    //      respawn from Phase 2 D-02) so any in-flight preview is dropped.
    //      Skipped while a batch is running — we never disrupt the batch path.
    //   3. Allocate a fresh jobId (tracked in `previewJobId`) and enqueue a
    //      single-file SVG job through the existing pool. The pool's onDone /
    //      onError callbacks (bound in App.tsx) fire markDone/markError as
    //      with batch jobs.
    //   4. Resolve the result on the main thread: decode → DOMPurify (D-01)
    //      → useFilesStore.markDone with sanitizedCount. Mirrors the
    //      App.tsx startOptimize SVG branch verbatim, so byte deltas + the
    //      sanitized badge update for free.
    //
    // The cross-store reads (files + settings) are resolved lazily via
    // getState() so the runtime/files static cycle does not blow up on init.
    enqueuePreview: debounce((fileId: string) => {
      // WR-07: the inner try/catch only covers code AFTER the synchronous
      // setup (state/pool reads, crypto.randomUUID, set()). Anything that
      // throws BEFORE the try (e.g. a future store-immutability tightening
      // or a missing crypto on a hostile platform) would otherwise become
      // an unhandled rejection — the `void` operator silences the lint but
      // does not register a .catch. Tail-attach a catch to the IIFE result.
      ;(async () => {
        const state = get()
        const pool = getWorkerPool()
        if (!state.running) {
          // WR-01: only cancel preview jobs — never the post-batch
          // 'savings-' benchmark that runs once `running` flips false.
          // The previous full pool.cancel() terminated savings workers
          // mid-iteration, partially populating pluginSavings and
          // suppressing the timeout warning. cancelByPrefix leaves the
          // in-flight savings jobs alone and only aborts older previews.
          pool.cancelByPrefix('preview-')
        }
        const jobId = `preview-${crypto.randomUUID()}`
        set({ previewJobId: jobId })

        const fileEntry = useFilesStore.getState().byId[fileId]
        if (!fileEntry || fileEntry.format !== 'svg' || !fileEntry.sourceBlob) return

        const svgSettings = useSettingsStore.getState().svg
        const job: PoolJob = {
          id: jobId,
          fileId,
          format: 'svg',
          settings: svgSettings,
          blob: fileEntry.sourceBlob,
        }

        // Mirror App.tsx batch SVG branch: pool returns SVGO bytes, main
        // thread runs DOMPurify, then markDone updates UI + sanitized badge.
        try {
          const result = await pool.enqueue(job)
          // If a newer preview superseded this one (set previewJobId !== jobId),
          // bail out so the older result doesn't clobber the newer one.
          if (get().previewJobId !== jobId) return
          if (!useFilesStore.getState().byId[fileId]) return
          const svgText = new TextDecoder().decode(result.output)
          const unsafe = useSettingsStore.getState().svg.unsafeExport ?? false
          const { clean, sanitizedCount } = sanitizeSvg(svgText, unsafe)
          const sanitizedBlob = new Blob([clean], { type: 'image/svg+xml' })
          useFilesStore
            .getState()
            .markDone(fileId, sanitizedBlob, sanitizedBlob.size, sanitizedCount)
        } catch (err) {
          // AbortError is the cancel path (pool.cancel() trips it on next
          // toggle); swallow silently — the new preview job will produce the
          // authoritative result.
          const isAbort = err instanceof DOMException && err.name === 'AbortError'
          if (isAbort) return
          // Real adapter errors surface to the console for dev visibility.
          // The file-row status will not flip to 'error' here because the
          // preview path is auxiliary; the next batch optimize is the
          // authoritative status writer.
          console.error(`[enqueuePreview] ${fileId}:`, err)
        }
      })().catch((err) => {
        // Tail catch — covers throws BEFORE the inner try (see WR-07 note).
        console.error(`[enqueuePreview] ${fileId} (outer):`, err)
      })
    }, 200),
  })),
)
