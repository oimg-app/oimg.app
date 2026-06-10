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

/** WR-03: validate FileEntry.type against the worker's known source formats (no unchecked cast). */
function toSourceFormat(type: string): EncodeJob['sourceFormat'] | null {
  switch (type.toLowerCase()) {
    case 'png':  return 'png'
    case 'jpg':  return 'jpg'
    case 'jpeg': return 'jpeg'
    case 'webp': return 'webp'
    case 'avif': return 'avif'
    case 'svg':  return 'svg'
    // Quick 260610-lby: HEIC/HEIF are INPUT-only decode formats
    case 'heic': return 'heic'
    case 'heif': return 'heif'
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
  // CR-02: monotonic invocation token. Each trigger bumps seqRef; an in-flight pool.run whose
  // token no longer matches the latest seq is stale (the user changed settings or switched files
  // mid-encode) and its result must be dropped so it never lands on the wrong/superseded file.
  const seqRef = useRef(0)

  const trigger = useCallback((fileId: string) => {
    // Cancel any pending debounce before starting a new one
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    // Claim this invocation's token now; the debounced callback captures it by closure.
    const seq = ++seqRef.current

    timerRef.current = setTimeout(async () => {
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)

      // Guard: rawBuffer and settings must both be present (T-9-V5)
      if (!entry?.rawBuffer || !entry.settings) return

      // Quick 260610-lby: HEIC/HEIF have no output codec — fall back to settings.codec (seeded 'JPEG')
      const codec = toCodec(entry.type) ?? (entry.settings?.codec ?? null)
      if (codec === null) return

      // WR-03: validate source format (no unchecked cast); silently skip unsupported live re-encode
      const sourceFormat = toSourceFormat(entry.type)
      if (sourceFormat === null) return

      const job: EncodeJob = {
        codec,
        sourceFormat,
        // slice(0) = copy so the cached rawBuffer survives Comlink.transfer (Pitfall 3)
        buffer: entry.rawBuffer.slice(0),
        settings: entry.settings,
      }

      // Signal in-flight state to DeltaStrip shimmer (UI-SPEC §4)
      setEncodingFile(fileId)

      try {
        const pool = getPool()
        const result = await pool.run(job)
        // CR-02: drop superseded results — a newer trigger has run since this job started,
        // so applying this result would write stale (or another file's) bytes.
        if (seq !== seqRef.current) return
        setFileResult(fileId, result.buffer, result.optimizedSize)
      } catch (err) {
        // CR-02: only surface errors from the still-current invocation
        if (seq !== seqRef.current) return
        // D-13: per-file error + sonner toast; original bytes retained as fallback
        setFileError(fileId, String(err))
        toast.error('Encode failed: ' + String(err))
      } finally {
        // CR-02: only the latest invocation clears the shimmer — an earlier job's finally
        // must not clear the in-flight flag set by a later job (shared single-slot bug).
        if (seq === seqRef.current) setEncodingFile(null)
      }
    }, 300) // 300 ms — within D-07 range (250–350 ms)
  }, [])

  return { trigger }
}
