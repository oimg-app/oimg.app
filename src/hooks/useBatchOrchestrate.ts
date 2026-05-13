// Phase 10 plan 04 — extracted batch orchestration hook.
// Encapsulates pool singleton setup, startOptimize, cancelBatch, batch-completion
// subscriber, rename-collision subscriber, and computePluginSavings from App.tsx.
// App.tsx retains its own copies until Plan 05 removes them.

import { useEffect, useMemo } from 'react'
import { useStore } from '@nanostores/react'
import { listenKeys } from 'nanostores'
import { toast } from 'sonner'
import { filesStore, markDone as fileMarkDone, setStatus } from '@/stores/files'
import { settingsStore, setSvg } from '@/stores/settings'
import {
  runtimeStore,
  markStarted,
  markDone as runtimeMarkDone,
  markError,
  startBatch,
  cancelBatch as cancelBatchAction,
  setThrottleActive,
  markThrottle,
} from '@/stores/runtime'
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
const SAVINGS_TIMEOUT_MS = 5000

async function computePluginSavings(fileIds: string[]): Promise<void> {
  const settings = settingsStore.get().svg
  const pluginIds = Object.keys(settings.plugins)
  const savings: Record<string, { bytes: number; pct: number }> = {}
  const pool = getWorkerPool()

  const svgFiles = fileIds
    .map((id) => filesStore.get().byId[id])
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
                blob: file.sourceBlob,
              }
              const result = await pool.enqueue(job)
              if (timedOut) return
              totalDisabledBytes += result.output.byteLength
            }),
          )

          const bytesDiff = totalDisabledBytes - totalBaselineBytes
          const pct = totalBaselineBytes > 0 ? (bytesDiff / totalBaselineBytes) * 100 : 0
          savings[pluginId] = { bytes: bytesDiff, pct: Math.max(0, pct) }
        }
        setSvg({ pluginSavings: savings })
      })(),
      timeoutPromise,
    ])
  } catch (err) {
    if (err instanceof Error && err.message === 'savings timeout') {
      if (Object.keys(savings).length > 0) {
        setSvg({ pluginSavings: savings })
      }
      console.warn('[oimg] Plugin savings computation timed out after 5s — columns may show — for unmeasured plugins')
    } else {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (!isAbort) {
        console.error('[oimg] computePluginSavings failed:', err)
      }
    }
  }
}

function isAuxiliaryJob(jobId: string): boolean {
  return jobId.startsWith('preview-') || jobId.startsWith('savings-')
}

// Phase 5 plan 05-05 — Debounced raster re-optimize for InspectorPane codec panel.
export async function enqueueRasterPreview(fileId: string): Promise<void> {
  const pool = getWorkerPool()
  pool.cancelByPrefix('preview-')

  const fileEntry = filesStore.get().byId[fileId]
  if (!fileEntry) return
  const format = fileEntry.format
  if (format === 'svg') return

  const s = settingsStore.get()
  let settings: unknown
  if (format === 'jpeg') {
    const perFile = s.perFile[fileId] ?? {}
    settings = buildJpegSettings({ globalJpeg: s.jpeg, fileOverride: perFile as Partial<CodecSettingsJpeg> })
  } else if (format === 'webp') {
    const perFile = s.perFile[fileId] ?? {}
    settings = buildWebpSettings({ globalWebp: s.webp, fileOverride: perFile as Partial<CodecSettingsWebp> })
  } else if (format === 'avif') {
    const perFile = s.perFile[fileId] ?? {}
    settings = buildAvifSettings({ globalAvif: s.avif, fileOverride: perFile as Partial<CodecSettingsAvif> })
  } else if (format === 'png') {
    const perFile = s.perFile[fileId] ?? {}
    settings = buildPngResizeSettings({
      sourceDensity: fileEntry.sourceDensity ?? '1x',
      targetDensity: fileEntry.targetDensity ?? fileEntry.sourceDensity ?? '1x',
      globalAlg: s.resize.alg,
      fileOverride: fileEntry.resizeOverride,
      globalPreserveIcc: s.global.preserveIccProfile,
      filePreserveIcc: fileEntry.preserveIcc,
      globalPng: s.png,
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
    if (!filesStore.get().byId[fileId]) return
    const mimeByFormat: Record<string, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      avif: 'image/avif',
    }
    const mime = mimeByFormat[format] ?? 'application/octet-stream'
    const optimizedBlob = new Blob([result.output], { type: mime })
    fileMarkDone(fileId, optimizedBlob, optimizedBlob.size)
  } catch (err) {
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
  const pool = useMemo(() => getWorkerPool({
    onStarted: (jobId) => {
      if (isAuxiliaryJob(jobId)) return
      markStarted(jobId)
    },
    onDone: (jobId) => {
      if (isAuxiliaryJob(jobId)) return
      runtimeMarkDone(jobId)
    },
    onError: (jobId, err) => {
      if (isAuxiliaryJob(jobId)) return
      const msg = err instanceof Error ? err.message : String(err)
      markError(jobId, msg)
    },
    onThrottle: () => {
      const r = runtimeStore.get()
      const wasFired = r.throttleToastFiredThisBatch
      markThrottle()
      if (!wasFired) {
        toast.info('Pacing batch for memory', {
          description: 'Some files are queued briefly to keep the tab responsive.',
        })
      }
    },
  }), [])

  // Phase 2 plan 02-04 — Live-region quartile cadence + completion toast.
  useEffect(() => {
    let prev = {
      doneCount: runtimeStore.get().doneCount,
      errorCount: runtimeStore.get().errorCount,
      totalJobs: runtimeStore.get().totalJobs,
      running: runtimeStore.get().running,
    }
    return listenKeys(runtimeStore, ['doneCount', 'errorCount', 'totalJobs', 'running'], (curr) => {
      const currSnap = {
        doneCount: curr.doneCount,
        errorCount: curr.errorCount,
        totalJobs: curr.totalJobs,
        running: curr.running,
      }

      if (currSnap.doneCount !== prev.doneCount && currSnap.doneCount > 0 && currSnap.doneCount < currSnap.totalJobs) {
        if (isQuartileBoundary(currSnap.doneCount, currSnap.totalJobs)) {
          announce(`${currSnap.doneCount} of ${currSnap.totalJobs} files complete`)
        }
      }

      if (prev.running && !currSnap.running && currSnap.totalJobs > 0) {
        setThrottleActive(false)
        const finished = currSnap.doneCount + currSnap.errorCount === currSnap.totalJobs
        if (!finished) {
          prev = currSnap
          return
        }
        const successCount = currSnap.totalJobs - currSnap.errorCount
        const savedHuman = '0 bytes'
        announce(`Batch complete. ${successCount} files optimized, ${savedHuman} saved.`)
        if (currSnap.errorCount === 0) {
          toast.success(`Optimized ${successCount} files`, { description: savedHuman })
        } else if (currSnap.errorCount === currSnap.totalJobs) {
          toast.error(`Optimization failed for ${currSnap.errorCount} files`, { description: 'Click for details' })
        } else {
          toast(`Optimized ${successCount} of ${currSnap.totalJobs} files`, { description: `${currSnap.errorCount} failed` })
        }

        queueMicrotask(() => {
          const filesNow = filesStore.get()
          const completedSvgIds = filesNow.order.filter((id) => {
            const f = filesNow.byId[id]
            return f && f.format === 'svg' && f.status === 'done' && f.optimizedBlob
          })
          if (completedSvgIds.length > 0) {
            void computePluginSavings(completedSvgIds)
          }
        })
      }

      prev = currSnap
    })
  }, [])

  // Phase 4 plan 04-07 (D-16) — collision-rename toast subscriber.
  useEffect(() => {
    let lastCount = runtimeStore.get().renameCountThisBatch
    return listenKeys(runtimeStore, ['renameCountThisBatch'], (curr) => {
      const delta = curr.renameCountThisBatch - lastCount
      lastCount = curr.renameCountThisBatch
      if (delta > 0) {
        toast.info(
          `${delta} ${delta === 1 ? 'file' : 'files'} renamed to avoid collisions`,
          {
            description: 'Suffix "(2)", "(3)", … inserted before "@Nx" so each variant has a unique name.',
          },
        )
      }
    })
  }, [])

  const startOptimize = () => {
    const filesState = filesStore.get()
    const fileIds = filesState.order.filter((id) => {
      const f = filesState.byId[id]
      return f && (f.status === 'idle' || f.status === 'queued' || f.status === 'error')
    })
    if (fileIds.length === 0) return
    startBatch(fileIds)
    announce(`Optimizing ${fileIds.length} files`)
    for (const fileId of fileIds) {
      const f = filesState.byId[fileId]
      if (!f) continue
      const slowMs = import.meta.env.DEV
        ? (window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__ ?? 0
        : 0
      const isSvg = f.format === 'svg'
      const fileEntry = filesStore.get().byId[fileId]
      const hasPngFanoutShape =
        f.format === 'png' &&
        typeof (fileEntry as { byteEstimate?: number } | undefined)?.byteEstimate === 'number'
      const isRealRasterFile = (
        f.format === 'jpeg' ||
        f.format === 'webp' ||
        f.format === 'avif' ||
        hasPngFanoutShape
      )
      const adapterFormat: AdapterFormat = isSvg
        ? 'svg'
        : isRealRasterFile
          ? f.format
          : 'stub'
      const s = settingsStore.get()
      let settings: unknown
      if (isSvg) {
        settings = s.svg
      } else if (hasPngFanoutShape) {
        const perFile = s.perFile[fileId] ?? {}
        settings = buildPngResizeSettings({
          sourceDensity: fileEntry?.sourceDensity ?? '1x',
          targetDensity: fileEntry?.targetDensity ?? fileEntry?.sourceDensity ?? '1x',
          globalAlg: s.resize.alg,
          fileOverride: fileEntry?.resizeOverride,
          globalPreserveIcc: s.global.preserveIccProfile,
          filePreserveIcc: fileEntry?.preserveIcc,
          globalPng: s.png,
          ...perFile,
        })
      } else if (f.format === 'jpeg') {
        const perFile = s.perFile[fileId] ?? {}
        settings = buildJpegSettings({ globalJpeg: s.jpeg, fileOverride: perFile as Partial<CodecSettingsJpeg> })
      } else if (f.format === 'webp') {
        const perFile = s.perFile[fileId] ?? {}
        settings = buildWebpSettings({ globalWebp: s.webp, fileOverride: perFile as Partial<CodecSettingsWebp> })
      } else if (f.format === 'avif') {
        const perFile = s.perFile[fileId] ?? {}
        settings = buildAvifSettings({ globalAvif: s.avif, fileOverride: perFile as Partial<CodecSettingsAvif> })
      } else {
        settings = slowMs > 0 ? { slowMs } : {}
      }
      const job: PoolJob = {
        id: fileId,
        fileId,
        format: adapterFormat,
        settings,
        blob: f.sourceBlob,
        byteEstimate: (
          filesStore.get().byId[fileId] as | { byteEstimate?: number } | undefined
        )?.byteEstimate,
      }
      pool.enqueue(job)
        .then(async (result) => {
          if (!filesStore.get().byId[fileId]) return
          if (isSvg) {
            const svgText = new TextDecoder().decode(result.output)
            const unsafe = settingsStore.get().svg.unsafeExport ?? false
            const { clean, sanitizedCount } = sanitizeSvg(svgText, unsafe)
            const sanitizedBlob = new Blob([clean], { type: 'image/svg+xml' })
            fileMarkDone(fileId, sanitizedBlob, sanitizedBlob.size, sanitizedCount)
          } else if (isRealRasterFile) {
            const mimeByFormat: Record<string, string> = {
              png: 'image/png',
              jpeg: 'image/jpeg',
              webp: 'image/webp',
              avif: 'image/avif',
            }
            const mime = mimeByFormat[f.format] ?? 'application/octet-stream'
            const optimizedBlob = new Blob([result.output], { type: mime })
            fileMarkDone(fileId, optimizedBlob, optimizedBlob.size)
          } else {
            const optimizedBlob = new Blob([result.output])
            fileMarkDone(fileId, optimizedBlob, optimizedBlob.size)
          }
        })
        .catch((err) => {
          const isAbort = err instanceof DOMException && err.name === 'AbortError'
          if (isAbort) return
          setStatus(fileId, 'error')
          console.error(`[startOptimize] ${fileId}:`, err)
        })
    }
  }

  const cancelBatch = () => {
    const inFlightCount = runtimeStore.get().inFlight.size
    pool.cancel()
    cancelBatchAction()
    announce('Batch canceled')
    toast(`Batch canceled`, { description: `${inFlightCount} files were processing` })
  }

  const { running } = useStore(runtimeStore)

  return { startOptimize, cancelBatch, running }
}
