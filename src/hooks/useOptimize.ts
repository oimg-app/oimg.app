// Phase 08 — PIPE-04: useOptimize — bridge filesAtom → WorkerPool. Source: 08-03-PLAN.md
import { useStore } from '@nanostores/react'
import { filesAtom } from '@/stores/files'
import { getPool } from '@/lib/worker-pool'
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

    const jobs: EncodeJob[] = entries.flatMap((entry) => {
      const codec = toCodec(entry.type)
      if (codec === null) return []
      return [
        {
          codec,
          // Phase 9 wires real buffers — stub ArrayBuffer for now
          buffer: new ArrayBuffer(0),
          settings: {},
        } satisfies EncodeJob,
      ]
    })

    // allSettled: a NotImplemented rejection for WebP/JPEG/AVIF/SVG (Phase 8 stubs)
    // must not abort the whole batch; pool drains its counts back to zero regardless.
    await Promise.allSettled(jobs.map((job) => pool.run(job)))
  }

  return { runOptimize }
}
