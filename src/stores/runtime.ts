// Phase 2 — Runtime store (ephemeral; queue + urlCache + pool stats).
// Source: 02-CONTEXT.md D-07/D-08/D-10/D-11; 02-RESEARCH.md §Pattern 4 + Pattern 5.
// IN-MEMORY ONLY (Phase 7 wires persistence — NOT here, per D-08).
// Migrated from zustand to nanostores.

import { map } from 'nanostores'
import { toast } from 'sonner'
import { getWorkerPool } from '@/workers/pool'
import type { PoolJob } from '@/workers/types'
import { sanitizeSvg } from '@/lib/sanitize-svg'
// Phase 3 plan 03-B — enqueuePreview reads from the files + settings stores.
// Cross-store reads use require() lazily to avoid circular import at module init.

export const POOL_SIZE = Math.min(
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2,
  4,
) // Pitfall 6 defensive default — lower bound 2, upper bound 4.

export interface RuntimeData {
  running: boolean
  queue: string[]
  inFlight: Set<string>
  doneCount: number
  totalJobs: number
  errorCount: number
  poolSize: number
  urlCache: Map<string, string>
  presets: Map<string, Record<string, string>>
  previewJobId: string | null
  inflightBytes: number
  throttleToastFiredThisBatch: boolean
  throttleActive: boolean
  renameCountThisBatch: number
}

export const runtimeStore = map<RuntimeData>({
  running: false,
  queue: [],
  inFlight: new Set<string>(),
  doneCount: 0,
  totalJobs: 0,
  errorCount: 0,
  poolSize: POOL_SIZE,
  urlCache: new Map<string, string>(),
  presets: new Map<string, Record<string, string>>(),
  previewJobId: null,
  inflightBytes: 0,
  throttleToastFiredThisBatch: false,
  throttleActive: false,
  renameCountThisBatch: 0,
})

// ─── Actions ─────────────────────────────────────────────────────────────────

export function savePreset(settings: Record<string, string>) {
  const next = new Map(runtimeStore.get().presets)
  next.set('WebP q82 1600w', settings)
  toast.success('Saved as preset', { description: 'WebP q82 1600w' })
  runtimeStore.setKey('presets', next)
}

export function optimizeAll() {
  // @TODO: fetch all files, and optimize them using given settings and global
}

export type ExportType = 'zip' | 'individual' | 'snippets' | 'data-uris'

export function exportFiles(_type: ExportType) {
  // @TODO: export files using given settings and global
}

export function startBatch(jobIds: string[]) {
  runtimeStore.set({
    ...runtimeStore.get(),
    running: jobIds.length > 0,
    queue: [...jobIds],
    inFlight: new Set<string>(),
    totalJobs: jobIds.length,
    doneCount: 0,
    errorCount: 0,
    throttleToastFiredThisBatch: false,
    throttleActive: false,
    renameCountThisBatch: 0,
  })
}

export function markStarted(jobId: string) {
  const s = runtimeStore.get()
  const inFlight = new Set(s.inFlight)
  if (inFlight.has(jobId)) return
  inFlight.add(jobId)
  runtimeStore.set({
    ...s,
    queue: s.queue.filter((id) => id !== jobId),
    inFlight,
  })
}

export function markDone(jobId: string) {
  const s = runtimeStore.get()
  if (!s.inFlight.has(jobId)) return
  const inFlight = new Set(s.inFlight)
  inFlight.delete(jobId)
  const doneCount = s.doneCount + 1
  const stillRunning = inFlight.size > 0 || s.queue.length > 0
  runtimeStore.set({ ...s, inFlight, doneCount, running: stillRunning })
}

export function markError(jobId: string, message: string) {
  const s = runtimeStore.get()
  if (!s.inFlight.has(jobId)) return
  const inFlight = new Set(s.inFlight)
  inFlight.delete(jobId)
  const isCancel =
    message === 'Batch cancelled' ||
    message === 'Batch canceled' ||
    message.includes('AbortError')
  const errorCount = isCancel ? s.errorCount : s.errorCount + 1
  const stillRunning = inFlight.size > 0 || s.queue.length > 0
  runtimeStore.set({ ...s, inFlight, errorCount, running: stillRunning })
}

export function cancelBatch() {
  runtimeStore.set({
    ...runtimeStore.get(),
    running: false,
    queue: [],
    inFlight: new Set<string>(),
    inflightBytes: 0,
    throttleToastFiredThisBatch: false,
    throttleActive: false,
    renameCountThisBatch: 0,
  })
}

export function getOrCreateObjectURL(fileId: string, blob: Blob): string {
  const s = runtimeStore.get()
  const cached = s.urlCache.get(fileId)
  if (cached) return cached
  const url = URL.createObjectURL(blob)
  const next = new Map(s.urlCache)
  next.set(fileId, url)
  runtimeStore.setKey('urlCache', next)
  return url
}

export function revokeObjectURL(fileId: string) {
  const s = runtimeStore.get()
  const url = s.urlCache.get(fileId)
  if (!url) return
  URL.revokeObjectURL(url)
  const next = new Map(s.urlCache)
  next.delete(fileId)
  runtimeStore.setKey('urlCache', next)
}

export function markThrottle() {
  const s = runtimeStore.get()
  if (s.throttleActive && s.throttleToastFiredThisBatch) return
  runtimeStore.set({ ...s, throttleActive: true, throttleToastFiredThisBatch: true })
}

export function setThrottleActive(v: boolean) {
  runtimeStore.setKey('throttleActive', v)
}

export function markRename(count: number) {
  runtimeStore.setKey('renameCountThisBatch', runtimeStore.get().renameCountThisBatch + count)
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

// Phase 3 (D-08/D-10/D-11) — debounced single-file preview re-optimize.
export const enqueuePreview = debounce((fileId: string) => {
  ;(async () => {
    const state = runtimeStore.get()
    const pool = getWorkerPool()
    if (!state.running) {
      pool.cancelByPrefix('preview-')
    }
    const jobId = `preview-${crypto.randomUUID()}`
    runtimeStore.setKey('previewJobId', jobId)

    // Lazy cross-store reads to avoid circular import at module init.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { filesStore } = require('./files') as typeof import('./files')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { settingsStore } = require('./settings') as typeof import('./settings')

    const fileEntry = filesStore.get().byId[fileId]
    if (!fileEntry || fileEntry.format !== 'svg' || !fileEntry.sourceBlob) return

    const svgSettings = settingsStore.get().svg
    const job: PoolJob = {
      id: jobId,
      fileId,
      format: 'svg',
      settings: svgSettings,
      blob: fileEntry.sourceBlob,
    }

    try {
      const result = await pool.enqueue(job)
      if (runtimeStore.get().previewJobId !== jobId) return
      if (!filesStore.get().byId[fileId]) return
      const svgText = new TextDecoder().decode(result.output)
      const unsafe = settingsStore.get().svg.unsafeExport ?? false
      const { clean, sanitizedCount } = sanitizeSvg(svgText, unsafe)
      const sanitizedBlob = new Blob([clean], { type: 'image/svg+xml' })
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { markDone: fileMarkDone } = require('./files') as typeof import('./files')
      fileMarkDone(fileId, sanitizedBlob, sanitizedBlob.size, sanitizedCount)
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (isAbort) return
      console.error(`[enqueuePreview] ${fileId}:`, err)
    }
  })().catch((err) => {
    console.error(`[enqueuePreview] ${fileId} (outer):`, err)
  })
}, 200)
