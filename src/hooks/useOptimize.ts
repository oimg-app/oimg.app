// Phase 08 — PIPE-04: useOptimize — bridge filesAtom → WorkerPool. Source: 08-02-PLAN.md
// Phase 09 — Plan 03: Real-bytes dispatch + rawBuffer caching + setFileResult/setFileError (D-04/D-13)
import { useStore } from '@nanostores/react'
import { filesAtom, setFileResult, setFileError, setFileRawBuffer, setFileProcessing } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { getPool } from '@/lib/worker-pool'
import { toast } from 'sonner'
import type { EncodeJob } from '@/workers/codec.worker'

/** Normalize a FileEntry.type (lowercase) to the worker's EncodeJob.codec union (mixed case). */
function toCodec(type: string): EncodeJob['codec'] | null {
  switch (type.toLowerCase()) {
    case 'png':
      return 'PNG'
    case 'jpg':
    case 'jpeg':
      return 'JPEG'
    case 'webp':
      return 'WebP'
    case 'avif':
      return 'AVIF'
    case 'svg':
      return 'SVG'
    default:
      return null
  }
}

/**
 * WR-03: validate a FileEntry.type against the worker's known source formats before dispatch,
 * instead of an unchecked `as EncodeJob['sourceFormat']` cast. Returns null for unsupported inputs
 * (e.g. gif/bmp) so the caller can skip with a clear message rather than letting decodeSource throw
 * a generic "Unknown source format" deep in the worker.
 */
function toSourceFormat(type: string): EncodeJob['sourceFormat'] | null {
  switch (type.toLowerCase()) {
    case 'png':
      return 'png'
    case 'jpg':
      return 'jpg'
    case 'jpeg':
      return 'jpeg'
    case 'webp':
      return 'webp'
    case 'avif':
      return 'avif'
    case 'svg':
      return 'svg'
    default:
      return null
  }
}

export function useOptimize() {
  // useStore subscription kept for components that useOptimize for reactive UI (e.g. progress).
  // runOptimize reads filesAtom.get() directly to avoid stale-closure bug: when ingest() calls
  // runOptimize() synchronously after setKey(), the useStore snapshot hasn't re-rendered yet
  // and would be empty. Direct .get() always reflects the current atom value. (Rule 1 fix)
  useStore(filesAtom)

  async function runOptimize(): Promise<void> {
    const pool = getPool()
    // Always read the live atom value — not the stale useStore snapshot
    const { entries } = filesAtom.get()

    // Build jobs with real bytes — read File handles where rawBuffer not yet cached (D-04)
    // Pairs: [entryId, name, job] — kept together so streaming .then can map results back to ids
    const pairs: Array<[id: string, name: string, job: EncodeJob]> = []

    for (const entry of entries) {
      // Phase 11 — Plan 01 (D-11): skip already-optimized files on Optimize-all. Errored files
      // (status === 'error') are still retried; only successful 'done' entries are filtered out.
      if (entry.status === 'done') continue

      const codec = toCodec(entry.type)
      if (codec === null) continue

      // WR-03: validate the source format up front — skip unsupported inputs with a clear toast
      // instead of dispatching a job that throws "Unknown source format" inside the worker.
      const sourceFormat = toSourceFormat(entry.type)
      if (sourceFormat === null) {
        toast.error('Unsupported input format: ' + entry.name)
        continue
      }

      let rawBuffer = entry.rawBuffer ?? null

      // If rawBuffer absent, try reading from the File handle (if entry carries one)
      if (rawBuffer === null) {
        const fileHandle = (entry as { file?: File }).file
        if (fileHandle) {
          rawBuffer = await fileHandle.arrayBuffer()
          setFileRawBuffer(entry.id, rawBuffer)
        }
      }

      // T-9-V5: never dispatch a 0-byte buffer; skip entries with no bytes available
      if (!rawBuffer || rawBuffer.byteLength === 0) continue

      const job: EncodeJob = {
        codec,
        sourceFormat,
        // slice(0) = copy so the cached rawBuffer survives Comlink.transfer (Pitfall 3)
        buffer: rawBuffer.slice(0),
        settings: entry.settings ?? settingsAtom.get(),
      }

      pairs.push([entry.id, entry.name, job])
    }

    // Phase 11 — Plan 01 (D-03): per-promise streaming write-back. Each pool.run(job).then(...)
    // fires setFileResult/setFileError AS the worker returns, so FileRow status dots flip
    // queued → processing → done LIVE during the batch (not all at once after allSettled).
    //
    // Pitfall 1 mitigation: all N promises are created in a single .map(...) synchronously,
    // THEN awaited as Promise.all — NEVER `await pool.run(job)` inside the loop, which would
    // serialize to concurrency = 1 and defeat WorkerPool._drain()'s bounded cap (min(hwConc, 4)).
    //
    // Per-promise rejection is swallowed inside .then(_, err) → setFileError + toast, so
    // Promise.all never rejects (D-13 / T-9-FB: per-file failure never aborts the batch).
    const promises = pairs.map(([id, name, job]) => {
      // Flip to in-flight state BEFORE awaiting the worker — gives the FileRow status dot
      // its 'processing' phase. Synchronous nanostores setKey, no race with the .then below.
      setFileProcessing(id)
      return pool.run(job).then(
        ({ buffer, optimizedSize }) => setFileResult(id, buffer, optimizedSize),
        (err) => {
          setFileError(id, String(err))
          toast.error('Encode failed: ' + name)
        },
      )
    })
    await Promise.all(promises)
  }

  return { runOptimize }
}
