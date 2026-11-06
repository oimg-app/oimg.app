// Phase 08 — PIPE-04: useOptimize — bridge filesAtom → WorkerPool. Source: 08-02-PLAN.md
// Phase 09 — Plan 03: Real-bytes dispatch + rawBuffer caching + setFileResult/setFileError (D-04/D-13)
// change:deepen-encode-entry — job building/dispatch live in lib/encode-entry.ts; this hook is
// only the batch policy: skip done entries, run everything concurrently, stream results back.
import { useStore } from '@nanostores/react'
import { filesAtom, setFileResult, setFileError, setFileProcessing } from '@/stores/files'
import { encodeEntry } from '@/lib/encode-entry'
import { toast } from 'sonner'

// change:remove-dead-ui-and-fix-a11y — module scope (design D1) so non-React callers (the command
// palette, registered in main.tsx) dispatch the exact same path as the Toolbar button.
export async function runOptimize(): Promise<void> {
  // Always read the live atom value — not the stale useStore snapshot.
  const { entries } = filesAtom.get()

  // Phase 11 — Plan 01 (D-11): skip already-optimized files; errored files are retried.
  //
  // All promises are created synchronously in one .map, THEN awaited — never `await` inside
  // the loop, which would serialize to concurrency 1 and defeat WorkerPool's bounded cap.
  // Each result streams back as its worker returns, so FileRow dots flip live (D-03).
  // Per-file failure → setFileError + toast; the batch never aborts (D-13 / T-9-FB).
  await Promise.all(
    entries
      .filter((entry) => entry.status !== 'done')
      .map((entry) =>
        encodeEntry(entry, () => setFileProcessing(entry.id)).then(
          (r) => { if (r) setFileResult(entry.id, r.buffer, r.optimizedSize, r.codec) },
          (err) => {
            setFileError(entry.id, String(err))
            toast.error('Encode failed: ' + entry.name)
          },
        ),
      ),
  )
}

export function useOptimize() {
  // useStore subscription kept for components that useOptimize for reactive UI (e.g. progress).
  // runOptimize reads filesAtom.get() directly to avoid the stale-closure bug: when ingest() calls
  // runOptimize() synchronously after setKey(), the useStore snapshot hasn't re-rendered yet.
  useStore(filesAtom)
  return { runOptimize }
}
