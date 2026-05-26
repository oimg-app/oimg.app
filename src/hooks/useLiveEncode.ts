// Phase 09 — Plan 03: useLiveEncode — debounced single-file re-encode trigger (D-05/D-07)
// Analog: src/hooks/useOptimize.ts (same pool dispatch + Comlink.transfer + result handling)
import { useRef, useCallback } from 'react'
import { filesAtom, setFileResult, setFileError } from '@/stores/files'
import { getPool } from '@/lib/worker-pool'
import { setEncodingFile } from '@/stores/runtime'
import { toast } from 'sonner'
import type { EncodeJob } from '@/workers/codec.worker'

/** Normalize a FileEntry.type (lowercase) to the worker's EncodeJob.codec union (mixed case). */
function toCodec(type: string): EncodeJob['codec'] | null {
  switch (type.toLowerCase()) {
    case 'png':  return 'PNG'
    case 'jpg':
    case 'jpeg': return 'JPEG'
    case 'webp': return 'WebP'
    case 'avif': return 'AVIF'
    case 'svg':  return 'SVG'
    default:     return null
  }
}

/**
 * useLiveEncode — debounced single-file re-encode for the inspector (D-05/D-07).
 * Returns { trigger } — call trigger(fileId) on every settings change; only the last
 * call within 300 ms fires a pool job (debounce via clearTimeout, no library).
 */
export function useLiveEncode() {
  // Debounce timer ref — no library needed (09-RESEARCH "Don't Hand-Roll" table)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback((fileId: string) => {
    // Cancel any pending debounce before starting a new one
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)

      // Guard: rawBuffer and settings must both be present (T-9-V5)
      if (!entry?.rawBuffer || !entry.settings) return

      const codec = toCodec(entry.type)
      if (codec === null) return

      const job: EncodeJob = {
        codec,
        sourceFormat: entry.type.toLowerCase() as EncodeJob['sourceFormat'],
        // slice(0) = copy so the cached rawBuffer survives Comlink.transfer (Pitfall 3)
        buffer: entry.rawBuffer.slice(0),
        settings: entry.settings,
      }

      // Signal in-flight state to DeltaStrip shimmer (UI-SPEC §4)
      setEncodingFile(fileId)

      try {
        const pool = getPool()
        const result = await pool.run(job)
        setFileResult(fileId, result.buffer, result.optimizedSize)
      } catch (err) {
        // D-13: per-file error + sonner toast; original bytes retained as fallback
        setFileError(fileId, String(err))
        toast.error('Encode failed: ' + String(err))
      } finally {
        // Always clear the in-flight indicator — success or failure
        setEncodingFile(null)
      }
    }, 300) // 300 ms — within D-07 range (250–350 ms)
  }, [])

  return { trigger }
}
