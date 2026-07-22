// Phase 16/17 — MTR-01/MTR-02: auto-dispatch SSIM + Butteraugli for the selected done file.
// Parallel dispatch under one seqRef ratchet. Four-slice buffer discipline (Pitfall 5).
// SVG source/target → both metrics N/A.
// Analog: src/hooks/useLiveEncode.ts (CR-02 seqRef pattern at lines 47-51,111,115,122; slice-before-transfer at line 78).
// PIPE-02: the metrics-worker module (and its ssim.js / visdif / jSquash decoders) are dynamic-imported
// inside the effect body so the initial route never pays for the metrics chunk.
import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { $selectedFile, setFileMetric } from '@/stores/files'
import type { MetricJob } from '@/workers/metrics.worker'

/**
 * useMetricsAuto — orchestrator that closes the auto-compute loop from 16-03 / 17-03.
 * Subscribes to `$selectedFile` via `useStore` so the effect re-runs whenever the
 * selected entry's status, encodedBuffer, or cached metric changes. When the file
 * is `done` with buffers and at least one metric still unset, dispatches BOTH
 * computeSSIM and computeButteraugli in parallel on the metrics worker under a
 * SINGLE seqRef ratchet. Selection thrash is defused by the CR-02 seqRef
 * monotonic token: an in-flight batch whose token no longer matches the latest
 * seq is stale and BOTH writes are dropped together (no two-clock race).
 *
 * SVG source or SVG target short-circuits — both SSIM and Butteraugli only make
 * sense for raster ↔ raster. ReportPanel (17-05) renders "N/A" when metrics stay
 * undefined for those.
 */
export function useMetricsAuto(): void {
  const selected = useStore($selectedFile)
  // CR-02: monotonic invocation token. Each dispatch bumps seqRef; an in-flight
  // batch whose token no longer matches the latest seq is stale (selection moved
  // on) and BOTH results must be dropped so they never land on the wrong file.
  const seqRef = useRef(0)

  useEffect(() => {
    // Guard chain (16-RESEARCH §Pattern 3 — order-sensitive).
    if (!selected) return
    if (selected.status !== 'done') return
    if (!selected.rawBuffer || !selected.encodedBuffer) return
    // Per-metric cache-hit: undefined = pending, null = failed, number = computed.
    // `null !== undefined` so a prior failure also short-circuits (Pitfall 4 —
    // avoid re-dispatching a known-bad metric). Early-return only when BOTH metrics
    // have a decision — otherwise we still need to dispatch the missing one.
    const ssimSettled = selected?.metrics?.ssim !== undefined
    const butSettled = selected?.metrics?.butteraugli !== undefined
    if (ssimSettled && butSettled) return
    // SVG source or SVG target: both SSIM and Butteraugli are raster metrics — skip.
    // ReportPanel renders N/A. Split guards onto their own lines so each branch is
    // independently greppable. One gate covers both metrics — no per-metric SVG check.
    const src = selected.type.toLowerCase()
    const tgt = selected.settings?.codec?.toLowerCase() ?? src
    if (src === 'svg') return
    if (tgt === 'svg') return

    // CR-02: claim this dispatch's token BEFORE the async IIFE. The IIFE captures
    // seq by closure; the SINGLE stale-drop check after the batch resolves compares
    // against seqRef.current and guards BOTH writes (no metric can leak to a stale file).
    const seq = ++seqRef.current
    // Copy id into the closure so a later selection change doesn't mutate what
    // we dispatched (belt-and-suspenders; nanostores snapshots are immutable but
    // the id is what we write back to on the success/failure paths).
    const fileId = selected.id
    // Phase 17 — MTR-02 Pitfall 5: FOUR slices. Comlink transfers DETACH per-buffer;
    // sharing across parallel dispatches zeroes the second call. Main-thread cache
    // (used by useLiveEncode/export) untouched — slice copies.
    const rawForSSIM = selected.rawBuffer.slice(0)
    const encForSSIM = selected.encodedBuffer.slice(0)
    const rawForBut = selected.rawBuffer.slice(0)
    const encForBut = selected.encodedBuffer.slice(0)

    void (async () => {
      // PIPE-02: dynamic import — the metrics worker singleton + ssim.js + visdif
      // chunks stay off the initial route until the first selection with a done file.
      const { getMetricsWorker } = await import('@/lib/metrics-worker')
      const worker = getMetricsWorker()
      const jobShape = {
        sourceFormat: src as MetricJob['sourceFormat'],
        targetFormat: tgt as MetricJob['targetFormat'],
      }
      // Use allSettled (NOT all): one metric failure must not cancel the other.
      // Each result is fulfilled|rejected individually; failed compute writes null
      // for that metric only. Per-metric skip-when-cached avoids redundant work
      // when the effect re-runs because the other metric's cache landed.
      const results = await Promise.allSettled([
        ssimSettled
          ? Promise.resolve(null)
          : worker.computeSSIM({ rawBuffer: rawForSSIM, encodedBuffer: encForSSIM, ...jobShape }),
        butSettled
          ? Promise.resolve(null)
          : worker.computeButteraugli({ rawBuffer: rawForBut, encodedBuffer: encForBut, ...jobShape }),
      ])
      // CR-02: drop superseded results — a newer selection has run since this batch
      // started, so writing either metric would land on the wrong file. SINGLE check
      // covers both writes (one clock for the batch — prevents two-clock race).
      if (seq !== seqRef.current) return
      // Per-metric conditional write — only for metrics that were dispatched (respects
      // the cache-skip branch). Distinguish failed compute (null) from pending
      // (undefined) so ReportPanel renders "N/A" instead of perpetual "Computing…".
      if (!ssimSettled) {
        const r = results[0]
        const mssim =
          r.status === 'fulfilled' && r.value ? (r.value as { mssim: number }).mssim : null
        setFileMetric(fileId, 'ssim', mssim !== null && Number.isFinite(mssim) ? mssim : null)
      }
      if (!butSettled) {
        const r = results[1]
        const distance =
          r.status === 'fulfilled' && r.value ? (r.value as { distance: number }).distance : null
        setFileMetric(
          fileId,
          'butteraugli',
          distance !== null && Number.isFinite(distance) ? distance : null,
        )
      }
    })()
  }, [
    selected?.id,
    selected?.status,
    selected?.encodedBuffer,
    selected?.metrics?.ssim,
    selected?.metrics?.butteraugli,
  ])
}
