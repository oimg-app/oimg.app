// change:deepen-encode-entry — debounced single-file re-encode for the inspector (D-05/D-07).
// Module-level (not a React hook): every settings edit anywhere funnels through one debounce
// timer and one monotonic token, so there is exactly one in-flight live encode app-wide.
import { filesAtom, setFileResult, setFileError } from '@/stores/files'
import { setEncodingFile } from '@/stores/runtime'
import { encodeEntry } from '@/lib/encode-entry'
import { toast } from 'sonner'

const DEBOUNCE_MS = 300 // within D-07 range (250–350 ms)

let timer: ReturnType<typeof setTimeout> | null = null
// CR-02: monotonic invocation token. An in-flight encode whose token no longer matches is
// stale (settings changed or selection moved mid-encode) and its result must be dropped.
let seq = 0

/** Call on every per-file settings change; only the last call within 300 ms fires a job. */
export function triggerLiveEncode(fileId: string): void {
  if (timer !== null) clearTimeout(timer)
  const mine = ++seq
  timer = setTimeout(async () => {
    const entry = filesAtom.get().entries.find((e) => e.id === fileId)
    if (!entry?.rawBuffer || !entry.settings) return

    setEncodingFile(fileId) // DeltaStrip shimmer (UI-SPEC §4)
    try {
      const result = await encodeEntry(entry)
      if (mine !== seq) return
      if (result) setFileResult(fileId, result.buffer, result.optimizedSize, result.codec)
    } catch (err) {
      if (mine !== seq) return
      // D-13: per-file error + toast; original bytes retained as fallback.
      setFileError(fileId, String(err))
      toast.error('Encode failed: ' + String(err))
    } finally {
      // Only the latest invocation clears the shimmer.
      if (mine === seq) setEncodingFile(null)
    }
  }, DEBOUNCE_MS)
}
