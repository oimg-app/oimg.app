// Phase 16 — MTR-01: subscribe to $selectedFile; on status==='done' + missing metric + non-SVG, dispatch computeSSIM with CR-02 stale-drop guard.
// Analog: src/hooks/useLiveEncode.ts (CR-02 seqRef pattern at lines 47-51,111,115,122; slice-before-transfer at line 78).
// PIPE-02: the metrics-worker module (and its ssim.js / jSquash decoders) are dynamic-imported
// inside the effect body so the initial route never pays for the metrics chunk.
import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { $selectedFile, setFileMetric } from '@/stores/files'
import type { SSIMJob } from '@/workers/metrics.worker'

/**
 * useMetricsAuto — orchestrator that closes the auto-compute loop from 16-03.
 * Subscribes to `$selectedFile` via `useStore` so the effect re-runs whenever the
 * selected entry's status, encodedBuffer, or cached metric changes. When the file
 * is `done` with buffers and no cached SSIM (undefined), dispatches computeSSIM on
 * the metrics worker. Selection thrash is defused by the CR-02 seqRef monotonic
 * token: an in-flight compute whose token no longer matches the latest seq is
 * stale (the user switched files mid-compute) and its result is dropped so it
 * cannot land on the wrong entry.
 *
 * SVG source or SVG target short-circuits — SSIM only makes sense for raster ↔ raster.
 * ReportPanel (16-05) renders "N/A" when metrics.ssim stays undefined for those.
 */
export function useMetricsAuto(): void {
  const selected = useStore($selectedFile)
  // CR-02: monotonic invocation token. Each dispatch bumps seqRef; an in-flight
  // computeSSIM whose token no longer matches the latest seq is stale (selection
  // moved on) and its result must be dropped so it never lands on the wrong file.
  const seqRef = useRef(0)

  useEffect(() => {
    // Guard chain (16-RESEARCH §Pattern 3 — order-sensitive).
    if (!selected) return
    if (selected.status !== 'done') return
    if (!selected.rawBuffer || !selected.encodedBuffer) return
    // Cache hit: undefined = pending, null = failed, number = computed. `null !== undefined`
    // so a prior failure also short-circuits (Pitfall 4 — avoid re-dispatching a known-bad file).
    if (selected.metrics?.ssim !== undefined) return
    // SVG source or SVG target: SSIM is a raster metric — skip. ReportPanel renders N/A.
    // Split guards onto their own lines so each branch is independently greppable.
    const src = selected.type.toLowerCase()
    const tgt = selected.settings?.codec?.toLowerCase() ?? src
    if (src === 'svg') return
    if (tgt === 'svg') return

    // CR-02: claim this dispatch's token BEFORE the async IIFE. The IIFE captures
    // seq by closure; the two stale-drop checks (try + catch) compare against seqRef.current.
    const seq = ++seqRef.current
    // Copy id + buffers into the closure so a later selection change doesn't mutate
    // what we dispatched (belt-and-suspenders; nanostores snapshots are immutable but
    // the id is what we write back to on the success/catch paths).
    const fileId = selected.id
    // Copy bytes so the main-thread cache (used by live-encode + export) survives
    // the Comlink transfer — same pattern as useLiveEncode.ts:78.
    const rawBuffer = selected.rawBuffer.slice(0)
    const encodedBuffer = selected.encodedBuffer.slice(0)

    void (async () => {
      try {
        // PIPE-02: dynamic import — the metrics worker singleton + ssim.js chunk
        // stay off the initial route until the first selection with a done file.
        const { getMetricsWorker } = await import('@/lib/metrics-worker')
        const worker = getMetricsWorker()
        const job: SSIMJob = {
          rawBuffer,
          encodedBuffer,
          sourceFormat: src as SSIMJob['sourceFormat'],
          targetFormat: tgt as SSIMJob['targetFormat'],
        }
        const { mssim } = await worker.computeSSIM(job)
        // CR-02: drop superseded results — a newer selection has run since this
        // job started, so writing this mssim would land on the wrong file.
        if (seq !== seqRef.current) return
        setFileMetric(fileId, 'ssim', mssim)
      } catch {
        // CR-02: only surface failures from the still-current invocation.
        if (seq !== seqRef.current) return
        // Distinguish failed compute (null) from pending (undefined) so ReportPanel
        // renders "N/A" instead of a perpetual "Computing…" (T-16-04-03 mitigation).
        setFileMetric(fileId, 'ssim', null)
      }
    })()
  }, [selected?.id, selected?.status, selected?.encodedBuffer, selected?.metrics?.ssim])
}
