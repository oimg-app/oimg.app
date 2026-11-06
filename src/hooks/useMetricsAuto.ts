// Phase 16/17 — MTR-01/MTR-02: auto-compute SSIM + Butteraugli for the selected done file.
// change:deepen-worker-decode — one computeMetrics() round-trip (two buffer copies, one decode
// pair) instead of two parallel calls with four copies.
// PIPE-02: the metrics-worker module (ssim.js / visdif / decoders) is dynamic-imported inside the
// effect body so the initial route never pays for the metrics chunk.
import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { $selectedFile, setFileMetric } from '@/stores/files'
import type { MetricJob } from '@/workers/metrics.worker'

/**
 * Subscribes to `$selectedFile`; when the file is `done` with buffers and a metric is still
 * unset (undefined = pending, null = failed, number = computed), dispatches one metrics job.
 * CR-02 seqRef: a result whose token no longer matches the latest dispatch is dropped, so
 * selection thrash never lands a score on the wrong file.
 * SVG source or SVG target → both metrics stay undefined (ReportPanel renders N/A).
 */
export function useMetricsAuto(): void {
  const selected = useStore($selectedFile)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!selected || selected.status !== 'done') return
    if (!selected.rawBuffer || !selected.encodedBuffer) return
    const ssimSettled = selected.metrics?.ssim !== undefined
    const butSettled = selected.metrics?.butteraugli !== undefined
    if (ssimSettled && butSettled) return
    const src = selected.type.toLowerCase()
    const tgt = selected.settings?.codec?.toLowerCase() ?? src
    if (src === 'svg' || tgt === 'svg') return

    const seq = ++seqRef.current
    const fileId = selected.id
    // slice(0): Comlink transfer detaches the dispatched buffers; the store's copies must survive.
    const job: MetricJob = {
      rawBuffer: selected.rawBuffer.slice(0),
      encodedBuffer: selected.encodedBuffer.slice(0),
      sourceFormat: src as MetricJob['sourceFormat'],
      targetFormat: tgt as MetricJob['targetFormat'],
    }

    void (async () => {
      const { getMetricsWorker } = await import('@/lib/metrics-worker')
      // A rejected job (bad format / decode failure) marks both metrics failed.
      const r = await getMetricsWorker().computeMetrics(job).catch(() => ({ ssim: null, butteraugli: null }))
      if (seq !== seqRef.current) return
      if (!ssimSettled) setFileMetric(fileId, 'ssim', r.ssim)
      if (!butSettled) setFileMetric(fileId, 'butteraugli', r.butteraugli)
    })()
  }, [
    selected?.id,
    selected?.status,
    selected?.encodedBuffer,
    selected?.metrics?.ssim,
    selected?.metrics?.butteraugli,
  ])
}
