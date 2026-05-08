// Phase 10 plan 04 — extracted batch orchestration hook.
// Encapsulates pool singleton setup, startOptimize, cancelBatch, batch-completion
// subscriber, rename-collision subscriber, and computePluginSavings from App.tsx.
// App.tsx retains its own copies until Plan 05 removes them.

import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useFilesStore, useSettingsStore, useRuntimeStore } from '@/stores'
import { getWorkerPool } from '@/workers/pool'
import type { PoolJob, AdapterFormat } from '@/workers/types'
import { announce, isQuartileBoundary } from '@/lib/live-region'
import { sanitizeSvg } from '@/lib/sanitize-svg'
import { buildPngResizeSettings } from '@/workers/png-config'
import { buildJpegSettings } from '@/workers/jpeg-config'
import { buildWebpSettings } from '@/workers/webp-config'
import { buildAvifSettings } from '@/workers/avif-config'
import type { CodecSettingsJpeg, CodecSettingsWebp, CodecSettingsAvif } from '@/types'

// Phase 3 plan 03-B (D-06) — post-batch per-plugin live savings.
// Wall-time cap: 5s. On timeout, pluginSavings stays empty (or partially
// populated up to the timeout) and the SvgoPanel column shows '—' / blank
// for un-measured plugins.
const SAVINGS_TIMEOUT_MS = 5000

async function computePluginSavings(fileIds: string[]): Promise<void> {
  const settings = useSettingsStore.getState().svg
  const pluginIds = Object.keys(settings.plugins)
  const savings: Record<string, { bytes: number; pct: number }> = {}
  const pool = getWorkerPool()

  const svgFiles = fileIds
    .map((id) => useFilesStore.getState().byId[id])
    .filter((f): f is NonNullable<typeof f> =>
      Boolean(f && f.format === 'svg' && f.optimizedBlob),
    )

  if (svgFiles.length === 0) return

  let timedOut = false
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      timedOut = true
      reject(new Error('savings timeout'))
    }, SAVINGS_TIMEOUT_MS),
  )

  try {
    await Promise.race([
      (async () => {
        for (const pluginId of pluginIds) {
          if (timedOut) break
          let totalBaselineBytes = 0
          let totalDisabledBytes = 0

          await Promise.all(
            svgFiles.map(async (file) => {
              // WR-08: check timedOut BEFORE enqueuing. Without this,
              // every file's pool.enqueue is fired synchronously inside
              // .map() and continues to occupy worker slots after the
              // 5s wall-clock timeout has already rejected the race.
              if (timedOut) return
              const baselineSize = file.optimizedSize ?? file.optimizedBlob!.size
              totalBaselineBytes += baselineSize

              const disabledSettings = {
                ...settings,
                plugins: { ...settings.plugins, [pluginId]: false },
              }
              const job: PoolJob = {
                id: `savings-${pluginId}-${file.id}`,
                fileId: file.id,
                format: 'svg',
                settings: disabledSettings,
                // Use the SOURCE blob — we want to measure full re-optimization
                // with this plugin disabled vs. the all-on baseline that
                // produced FileEntry.optimizedSize.
                blob: file.sourceBlob,
              }
              const result = await pool.enqueue(job)
              // WR-08: re-check after the await — the timeout may have
              // landed while the worker was running. Discarding the
              // late result keeps totalDisabledBytes consistent with
              // totalBaselineBytes for this plugin.
              if (timedOut) return
              totalDisabledBytes += result.output.byteLength
            }),
          )

          const bytesDiff = totalDisabledBytes - totalBaselineBytes
          const pct = totalBaselineBytes > 0 ? (bytesDiff / totalBaselineBytes) * 100 : 0
          // Negative pct (disabling the plugin made things smaller — surprising
          // but possible for plugins that interact). Clamp to 0 so the UI
          // shows '—' rather than a negative percent.
          savings[pluginId] = { bytes: bytesDiff, pct: Math.max(0, pct) }
        }
        useSettingsStore.getState().setSvg({ pluginSavings: savings })
      })(),
      timeoutPromise,
    ])
  } catch (err) {
    if (err instanceof Error && err.message === 'savings timeout') {
      // Persist whatever was measured before the timeout so partial info
      // appears in the panel rather than blanking everything.
      if (Object.keys(savings).length > 0) {
        useSettingsStore.getState().setSvg({ pluginSavings: savings })
      }
      console.warn('[oimg] Plugin savings computation timed out after 5s — columns may show — for unmeasured plugins')
    } else {
      // AbortError from a concurrent pool.cancel() (the user clicked Cancel
      // mid-savings). Bail silently — savings is best-effort.
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (!isAbort) {
        console.error('[oimg] computePluginSavings failed:', err)
      }
    }
  }
}

// Phase 3 plan 03-B — auxiliary job prefix discriminator.
// preview- and savings- prefixed jobs bypass runtime-store batch bookkeeping
// to prevent inflating doneCount past totalJobs.
function isAuxiliaryJob(jobId: string): boolean {
  return jobId.startsWith('preview-') || jobId.startsWith('savings-')
}

// Phase 5 plan 05-05 — Debounced raster re-optimize for InspectorPane codec panel.
// D-04: 200ms debounce + cancel-and-restart, identical to Phase 3 SVG enqueuePreview.
// T-5-05-01 mitigation: cancelByPrefix('preview-') cancels ALL pending preview jobs
// before each new enqueue, preventing unbounded queue growth from rapid slider drags.
// T-5-05-04 mitigation: cross-file preview cancellation is intentional — only one
// file is selected at a time in Phase 5.
//
// Placed as a standalone exported function (not inside the hook) to avoid circular
// dependency with runtime.ts (which already exports enqueuePreview for SVG).
export async function enqueueRasterPreview(fileId: string): Promise<void> {
  const pool = getWorkerPool()
  // Cancel all pending preview jobs (not just this fileId) to prevent queue buildup.
  pool.cancelByPrefix('preview-')

  const fileEntry = useFilesStore.getState().byId[fileId]
  if (!fileEntry) return
  const format = fileEntry.format
  if (format === 'svg') return // SVG uses enqueuePreview from runtime.ts

  let settings: unknown
  if (format === 'jpeg') {
    const globalJpeg = useSettingsStore.getState().jpeg
    const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
    settings = buildJpegSettings({ globalJpeg, fileOverride: perFile as Partial<CodecSettingsJpeg> })
  } else if (format === 'webp') {
    const globalWebp = useSettingsStore.getState().webp
    const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
    settings = buildWebpSettings({ globalWebp, fileOverride: perFile as Partial<CodecSettingsWebp> })
  } else if (format === 'avif') {
    const globalAvif = useSettingsStore.getState().avif
    const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
    settings = buildAvifSettings({ globalAvif, fileOverride: perFile as Partial<CodecSettingsAvif> })
  } else if (format === 'png') {
    const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
    settings = buildPngResizeSettings({
      sourceDensity: fileEntry.sourceDensity ?? '1x',
      targetDensity: fileEntry.targetDensity ?? fileEntry.sourceDensity ?? '1x',
      globalAlg: useSettingsStore.getState().resize.alg,
      fileOverride: fileEntry.resizeOverride,
      globalPreserveIcc: useSettingsStore.getState().global.preserveIccProfile,
      filePreserveIcc: fileEntry.preserveIcc,
      globalPng: useSettingsStore.getState().png,
      ...perFile,
    })
  } else {
    return
  }

  const jobId = `preview-${crypto.randomUUID()}`
  const job: PoolJob = {
    id: jobId,
    fileId,
    format: format as AdapterFormat,
    settings,
    blob: fileEntry.sourceBlob,
  }

  try {
    const result = await pool.enqueue(job)
    // Guard: file may have been removed while the preview job was running.
    if (!useFilesStore.getState().byId[fileId]) return
    const mimeByFormat: Record<string, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      avif: 'image/avif',
    }
    const mime = mimeByFormat[format] ?? 'application/octet-stream'
    const optimizedBlob = new Blob([result.output], { type: mime })
    useFilesStore.getState().markDone(fileId, optimizedBlob, optimizedBlob.size)
  } catch (err) {
    // AbortError = job was superseded by a newer preview — discard silently.
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    if (!isAbort) {
      console.error(`[enqueueRasterPreview] ${fileId}:`, err)
    }
  }
}

export interface UseBatchOrchestrateReturn {
  startOptimize: () => void
  cancelBatch: () => void
  running: boolean
}

export function useBatchOrchestrate(): UseBatchOrchestrateReturn {
  // Phase 2 plan 02-04 — Worker pool singleton, instantiated once with
  // callbacks bound to runtime store actions (D-08). The pool lazy-spawns
  // workers on first enqueue, so importing the module here is what causes
  // Vite to trace and split out the worker-*.js / stub-adapter-*.js chunks
  // (closes the deferred chunk-emission gate from plan 02-03).
  //
  // Phase 3 plan 03-B — preview / savings jobs use prefixed jobIds
  // ('preview-...' from enqueuePreview, 'savings-...' from
  // computePluginSavings). They are awaited via pool.enqueue's returned
  // promise; bookkeeping in the runtime store (markStarted / markDone /
  // markError) MUST NOT count them — the auxiliary jobs would otherwise
  // inflate doneCount past totalJobs, corrupt the batch-completion subscriber,
  // and double-fire on cancel. Discriminate by prefix.
  const pool = useMemo(() => getWorkerPool({
    onStarted: (jobId) => {
      if (isAuxiliaryJob(jobId)) return
      useRuntimeStore.getState().markStarted(jobId)
    },
    onDone: (jobId) => {
      if (isAuxiliaryJob(jobId)) return
      useRuntimeStore.getState().markDone(jobId)
    },
    onError: (jobId, err) => {
      if (isAuxiliaryJob(jobId)) return
      const msg = err instanceof Error ? err.message : String(err)
      useRuntimeStore.getState().markError(jobId, msg)
    },
    // Phase 4 plan 04-07 (D-13) — admission gate held the queue. Snapshot the
    // toast latch BEFORE markThrottle() flips it (markThrottle is idempotent
    // and sets throttleToastFiredThisBatch=true on first call). The toast
    // therefore fires at most once per batch even if the gate trips 50 times.
    // UI-SPEC §Surface 7.
    onThrottle: () => {
      const r = useRuntimeStore.getState()
      const wasFired = r.throttleToastFiredThisBatch
      r.markThrottle()
      if (!wasFired) {
        toast.info('Pacing batch for memory', {
          description:
            'Some files are queued briefly to keep the tab responsive.',
        })
      }
    },
  }), [])

  // Phase 2 plan 02-04 — Live-region quartile cadence + completion toast.
  // Subscribes narrowly to runtime store via subscribeWithSelector so we only
  // re-fire on real transitions (D-09 selector convention).
  useEffect(() => {
    const unsub = useRuntimeStore.subscribe(
      (s) => ({
        doneCount: s.doneCount,
        errorCount: s.errorCount,
        totalJobs: s.totalJobs,
        running: s.running,
      }),
      (curr, prev) => {
        // Quartile completion announcement on each interior stride.
        if (curr.doneCount !== prev.doneCount && curr.doneCount > 0 && curr.doneCount < curr.totalJobs) {
          if (isQuartileBoundary(curr.doneCount, curr.totalJobs)) {
            announce(`${curr.doneCount} of ${curr.totalJobs} files complete`)
          }
        }
        // Batch end transition (running flipped true → false). cancelBatch()
        // also flips running → false but resets totalJobs to its preserved
        // value — cancel emits its own "Batch canceled" announcement directly,
        // so we guard here with `totalJobs > 0` AND a non-zero done+error sum
        // to avoid double-announcing on cancel.
        if (prev.running && !curr.running && curr.totalJobs > 0) {
          // Phase 4 plan 04-07 (D-13) — clear the StatusBar Pacing pill at
          // batch end. setThrottleActive(false) preserves the toast latch
          // (throttleToastFiredThisBatch) — that latch resets on the next
          // startBatch, ensuring the toast can fire once per future batch.
          // UI-SPEC §Surface 6.
          useRuntimeStore.getState().setThrottleActive(false)
          const finished = curr.doneCount + curr.errorCount === curr.totalJobs
          if (!finished) return // cancel path — handled in cancelBatch()
          const successCount = curr.totalJobs - curr.errorCount
          // Stub adapter saves 0 bytes (Phase 2 acceptance gate). Phase 3+
          // derives savedBytes from useFilesStore originalSize - optimizedSize.
          const savedHuman = '0 bytes'
          announce(`Batch complete. ${successCount} files optimized, ${savedHuman} saved.`)
          if (curr.errorCount === 0) {
            toast.success(`Optimized ${successCount} files`, { description: savedHuman })
          } else if (curr.errorCount === curr.totalJobs) {
            toast.error(`Optimization failed for ${curr.errorCount} files`, { description: 'Click for details' })
          } else {
            toast(`Optimized ${successCount} of ${curr.totalJobs} files`, { description: `${curr.errorCount} failed` })
          }
          // Phase 3 plan 03-B (D-06) — post-batch live per-plugin savings.
          // Run only when at least one SVG file finished successfully.
          // Fire-and-forget; the function handles its own 5s timeout + error
          // path. Errors are logged, not surfaced as toasts.
          //
          // Plan 03-D fix (Rule 1): defer the file-state read by a microtask.
          // pool.runOnSlot calls `job.resolve(result); callbacks.onDone(...)`
          // synchronously — onDone fires runtime.markDone BEFORE the
          // pool.enqueue().then() microtask runs the SVG `useFilesStore
          // .markDone(fileId, sanitizedBlob, …, sanitizedCount)` write. If we
          // read useFilesStore synchronously here, files are still
          // status='processing' / optimizedBlob === null — `completedSvgIds`
          // is empty and computePluginSavings never runs. queueMicrotask
          // schedules our read AFTER the resolve→sanitize→markDone microtask
          // chain has flushed, so file state is current.
          queueMicrotask(() => {
            const filesNow = useFilesStore.getState()
            const completedSvgIds = filesNow.order.filter((id) => {
              const f = filesNow.byId[id]
              return f && f.format === 'svg' && f.status === 'done' && f.optimizedBlob
            })
            if (completedSvgIds.length > 0) {
              void computePluginSavings(completedSvgIds)
            }
          })
        }
      },
    )
    return unsub
  }, [])

  // Phase 4 plan 04-07 (D-16) — collision-rename toast subscriber.
  // useFilesStore.addSourceWithVariants calls
  // useRuntimeStore.markRename(N) once per drop that produced collisions.
  // We listen for renameCountThisBatch transitions and fire one toast.info
  // per batched increment (lastCount → curr; delta = curr - lastCount).
  // startBatch / cancelBatch reset renameCountThisBatch to 0 — those zero
  // transitions produce a negative delta which the if-guard drops. UI-SPEC
  // §Surface 8.
  useEffect(() => {
    let lastCount = useRuntimeStore.getState().renameCountThisBatch
    const unsub = useRuntimeStore.subscribe(
      (s) => s.renameCountThisBatch,
      (curr) => {
        const delta = curr - lastCount
        lastCount = curr
        if (delta > 0) {
          toast.info(
            `${delta} ${delta === 1 ? 'file' : 'files'} renamed to avoid collisions`,
            {
              description:
                'Suffix "(2)", "(3)", … inserted before "@Nx" so each variant has a unique name.',
            },
          )
        }
      },
    )
    return unsub
  }, [])

  // Phase 2 plan 02-04 — Real worker-pool batch dispatcher.
  // Reads queued/idle/error files from useFilesStore, calls startBatch on the
  // runtime store (sets running=true + populates queue/totalJobs), enqueues
  // each fileId as a stub job into the pool, and flips files.byId statuses
  // through the pool's onStarted/onDone/onError callbacks.
  //
  // UI-SPEC §7: silent batch start — NO toast, only the live region announces.
  const startOptimize = () => {
    const filesState = useFilesStore.getState()
    const fileIds = filesState.order.filter((id) => {
      const f = filesState.byId[id]
      return f && (f.status === 'idle' || f.status === 'queued' || f.status === 'error')
    })
    if (fileIds.length === 0) return
    // Phase 4 (D-04 + D-14) — 1:1 jobs:FileEntries. addSourceWithVariants in
    // useFilesStore materializes one FileEntry per density variant up-front;
    // each entry is its own pool job here.
    useRuntimeStore.getState().startBatch(fileIds)
    announce(`Optimizing ${fileIds.length} files`)
    for (const fileId of fileIds) {
      const f = filesState.byId[fileId]
      if (!f) continue
      // Phase 2 plan 02-04 — TEST AFFORDANCE: window.__OIMG_SLOW_MS__ injects
      // an artificial per-job delay through the stub adapter (worker reads
      // settings.slowMs). VR-02 (concurrency cap) and VR-03 (cancel correctness)
      // tests set this so the otherwise-microsecond stub run becomes observable.
      // WR-05: gated on import.meta.env.DEV ONLY so accidental `vite build
      // --mode test` does NOT ship this affordance to production.
      const slowMs = import.meta.env.DEV
        ? (window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__ ?? 0
        : 0
      // Phase 3 plan 03-A — route SVG files through the real SVG adapter.
      // Phase 4 plan 04-07 — route PNG files through the real PNG adapter
      // (decode → resize → encode). PNG branch is gated on byteEstimate
      // (set ONLY by addSourceWithVariants, never by Phase-2 test affordances
      // calling addFile directly). This preserves Phase 4 test contract.
      // Phase 5 plan 05-05 — route JPEG/WebP/AVIF through real adapters
      // with per-file override merge (D-02).
      const isSvg = f.format === 'svg'
      const fileEntry = useFilesStore.getState().byId[fileId]
      // Plan 04-07 Rule 1 fix — PNG branch is gated on the byteEstimate field
      // (set ONLY by addSourceWithVariants, never by Phase-2 test affordances
      // calling addFile directly). Without this gate, the worker-pool VR-01/02,
      // object-url VR-04, and aria-live VR-05 specs regressed because their
      // synthetic 1KB octet-stream blobs (format='png' as a stand-in for stub)
      // started routing through the real png-adapter, which threw AdapterError
      // on the bogus PNG header and the tests timed out on never-'done' status.
      // Real user-dropped PNGs always carry byteEstimate (Plan 04-05 seeds it
      // during fan-out via addSourceWithVariants), so this preserves the Phase 4
      // contract end-to-end.
      // Phase 5 plan 05-05: useFilePicker.ts confirmed to call addSourceWithVariants
      // (not addFile), so byteEstimate IS set for real user-dropped PNG files.
      // Case A (byteEstimate is reliable) applies here.
      const hasPngFanoutShape =
        f.format === 'png' &&
        typeof (fileEntry as { byteEstimate?: number } | undefined)?.byteEstimate ===
          'number'
      // Phase 5: JPEG/WebP/AVIF always route to real adapters (no synthetic stubs in tests).
      const isRealRasterFile = (
        f.format === 'jpeg' ||
        f.format === 'webp' ||
        f.format === 'avif' ||
        hasPngFanoutShape
      )
      const adapterFormat: AdapterFormat = isSvg
        ? 'svg'
        : isRealRasterFile
          ? f.format  // 'jpeg' | 'webp' | 'avif' | 'png'
          : 'stub'
      let settings: unknown
      if (isSvg) {
        settings = useSettingsStore.getState().svg
      } else if (hasPngFanoutShape) {
        // Plan 04-05 enriched FileEntry: targetDensity, sourceDensity guaranteed
        // for PNG variants emitted by addSourceWithVariants; resizeOverride +
        // preserveIcc are optional per-file overrides (UI deferred to Phase 5
        // per D-07/D-09; data shape only).
        const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
        settings = buildPngResizeSettings({
          sourceDensity: fileEntry?.sourceDensity ?? '1x',
          targetDensity:
            fileEntry?.targetDensity ?? fileEntry?.sourceDensity ?? '1x',
          globalAlg: useSettingsStore.getState().resize.alg,
          fileOverride: fileEntry?.resizeOverride,
          globalPreserveIcc:
            useSettingsStore.getState().global.preserveIccProfile,
          filePreserveIcc: fileEntry?.preserveIcc,
          globalPng: useSettingsStore.getState().png,
          ...perFile,
        })
      } else if (f.format === 'jpeg') {
        // Phase 5 — MozJPEG encode with per-file override merge (D-02).
        const globalJpeg = useSettingsStore.getState().jpeg
        const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
        settings = buildJpegSettings({ globalJpeg, fileOverride: perFile as Partial<CodecSettingsJpeg> })
      } else if (f.format === 'webp') {
        // Phase 5 — libwebp encode with per-file override merge (D-02).
        const globalWebp = useSettingsStore.getState().webp
        const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
        settings = buildWebpSettings({ globalWebp, fileOverride: perFile as Partial<CodecSettingsWebp> })
      } else if (f.format === 'avif') {
        // Phase 5 — libavif encode with per-file override merge (D-02).
        // Lazy-loaded by avif-adapter.ts on first use (D-09 / D-10).
        const globalAvif = useSettingsStore.getState().avif
        const perFile = useSettingsStore.getState().perFile[fileId] ?? {}
        settings = buildAvifSettings({ globalAvif, fileOverride: perFile as Partial<CodecSettingsAvif> })
      } else {
        settings = slowMs > 0 ? { slowMs } : {}
      }
      const job: PoolJob = {
        id: fileId,
        fileId,
        format: adapterFormat,
        settings,
        blob: f.sourceBlob,
        // Phase 4 D-11(b) — admission gate input. Plan 04-05 seeded
        // byteEstimate on FileEntryWithBlob during addSourceWithVariants.
        // Optional — SVG / stub jobs may have undefined and the gate no-ops.
        byteEstimate: (
          useFilesStore.getState().byId[fileId] as
            | { byteEstimate?: number }
            | undefined
        )?.byteEstimate,
      }
      pool.enqueue(job)
        .then(async (result) => {
          // Phase 3 plan 03-A (Rule 1 fix) — the original CR-04 guard
          // `if (!inFlight.has(fileId)) return` raced with the pool's onDone
          // callback: pool.runOnSlot calls `job.resolve(result); callbacks.onDone(...)`
          // synchronously, so runtime.markDone removes the job from inFlight
          // BEFORE the .then microtask runs. The guard then incorrectly bailed
          // on every successful job — files never reached status='done'. This
          // bug existed since Phase 2 (latent because aria-live tests waited
          // on runtime.doneCount, not file.status; only worker-pool VR-01 hit it).
          //
          // Cancel-race is already handled correctly without this guard: a
          // cancelled job calls `job.reject(AbortError)` which routes through
          // .catch (the AbortError discriminator below skips setStatus('error')).
          // Surviving guard: file may have been removed between enqueue and
          // resolve — bail if byId entry is gone.
          if (!useFilesStore.getState().byId[fileId]) return
          if (isSvg) {
            // Phase 3 (D-01 + Pitfall 1) — SVGO ran in the worker; DOMPurify
            // runs HERE on the main thread because it needs `document`.
            // Read DOMPurify.removed.length immediately after sanitize() —
            // do not await between (Pitfall 5).
            const svgText = new TextDecoder().decode(result.output)
            const unsafe = useSettingsStore.getState().svg.unsafeExport ?? false
            const { clean, sanitizedCount } = sanitizeSvg(svgText, unsafe)
            const sanitizedBlob = new Blob([clean], { type: 'image/svg+xml' })
            useFilesStore
              .getState()
              .markDone(fileId, sanitizedBlob, sanitizedBlob.size, sanitizedCount)
          } else if (isRealRasterFile) {
            // Phase 4 plan 04-07 (PNG) / Phase 5 plan 05-05 (JPEG/WebP/AVIF) —
            // encoded raster bytes from jSquash adapter. Wrap as Blob with correct
            // MIME type and store. No main-thread post-processing needed (unlike SVG DOMPurify).
            // markDone revokes the OLD object URL before writing the new optimizedBlob (Pitfall 3).
            const mimeByFormat: Record<string, string> = {
              png: 'image/png',
              jpeg: 'image/jpeg',
              webp: 'image/webp',
              avif: 'image/avif',
            }
            const mime = mimeByFormat[f.format] ?? 'application/octet-stream'
            const optimizedBlob = new Blob([result.output], { type: mime })
            useFilesStore
              .getState()
              .markDone(fileId, optimizedBlob, optimizedBlob.size)
          } else {
            // Stub round-trip (Phase 2 contract): byte-equal output.
            const optimizedBlob = new Blob([result.output])
            useFilesStore.getState().markDone(fileId, optimizedBlob, optimizedBlob.size)
          }
        })
        .catch((err) => {
          // CR-04 / WR-08: discriminate AbortError (cancel path — already
          // surfaced via pool onError → runtime.markError) from real adapter
          // failures, which must flip the files-store entry to 'error' so the
          // queue row reflects the failed run instead of an old 'done' state.
          const isAbort =
            err instanceof DOMException && err.name === 'AbortError'
          if (isAbort) return
          useFilesStore.getState().setStatus(fileId, 'error')
          // Phase 2 has no UI surface for adapter errors yet (Phase 5 adds an
          // inline retry affordance per UI-SPEC §7). Surface to console so
          // real bugs are not silently swallowed during dev.
          console.error(`[startOptimize] ${fileId}:`, err)
        })
    }
  }

  // Phase 2 plan 02-04 — Cancel handler.
  // Order matters: pool.cancel() trips AbortController (T-02-01 mitigation)
  // BEFORE useRuntimeStore.cancelBatch() clears the in-flight set. Pool
  // onError fires for each in-flight job; runtime store guards late
  // markDone/markError arrivals via the inFlight.has(jobId) check.
  const cancelBatch = () => {
    const inFlightCount = useRuntimeStore.getState().inFlight.size
    pool.cancel()
    useRuntimeStore.getState().cancelBatch()
    announce('Batch canceled')
    toast(`Batch canceled`, { description: `${inFlightCount} files were processing` })
  }

  const running = useRuntimeStore((s) => s.running)

  return { startOptimize, cancelBatch, running }
}
