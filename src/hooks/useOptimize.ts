// Phase 08 — PIPE-04: useOptimize — bridge filesAtom → WorkerPool. Source: 08-02-PLAN.md
// Phase 09 — Plan 03: Real-bytes dispatch + rawBuffer caching + setFileResult/setFileError (D-04/D-13)
import { useStore } from '@nanostores/react'
import { filesAtom, setFileResult, setFileError, setFileRawBuffer } from '@/stores/files'
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

export function useOptimize() {
  const { entries } = useStore(filesAtom)

  async function runOptimize(): Promise<void> {
    const pool = getPool()

    // Build jobs with real bytes — read File handles where rawBuffer not yet cached (D-04)
    // Pairs: [entryId, job] — kept together so allSettled can map results back to ids
    const pairs: Array<[id: string, name: string, job: EncodeJob]> = []

    for (const entry of entries) {
      const codec = toCodec(entry.type)
      if (codec === null) continue

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
        sourceFormat: entry.type.toLowerCase() as EncodeJob['sourceFormat'],
        // slice(0) = copy so the cached rawBuffer survives Comlink.transfer (Pitfall 3)
        buffer: rawBuffer.slice(0),
        settings: entry.settings ?? settingsAtom.get(),
      }

      pairs.push([entry.id, entry.name, job])
    }

    // allSettled: per-file failure never aborts the batch (D-13 / T-9-FB)
    const settled = await Promise.allSettled(pairs.map(([, , job]) => pool.run(job)))

    for (let i = 0; i < settled.length; i++) {
      const [id, name] = pairs[i]
      const outcome = settled[i]
      if (outcome.status === 'fulfilled') {
        const { buffer, optimizedSize } = outcome.value
        setFileResult(id, buffer, optimizedSize)
      } else {
        const reason = String((outcome as PromiseRejectedResult).reason)
        setFileError(id, reason)
        // D-13: sonner toast per failure; other files continue (batch always completes)
        toast.error('Encode failed: ' + name)
      }
    }
  }

  return { runOptimize }
}
