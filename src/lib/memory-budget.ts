// Phase 4 D-12 + D-11(b) — dynamic device-aware memory budget + per-job byte estimate.
// Source: 04-RESEARCH.md §3 (cross-browser deviceMemory survey, lines 379-385)
// + §2.2 (peak working-set formula, lines 293-303).
//
// Firefox + Safari return undefined for navigator.deviceMemory → ?? 4 fallback.
// Chrome reports 0.25 | 0.5 | 1 | 2 | 4 | 8 (capped at 8 to mitigate fingerprinting).
// 600 MB cap leaves 200 MB headroom under SC-2's 800 MB ceiling for non-pipeline
// browser overhead.

const MAX_BUDGET_BYTES = 600 * 1024 * 1024

export function computeMemoryBudget(): number {
  const dm = (typeof navigator !== 'undefined'
    ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
    : undefined) ?? 4
  const rawMb = 0.75 * dm * 1024
  return Math.min(rawMb * 1024 * 1024, MAX_BUDGET_BYTES)
}

// 1.75x multiplier on (src + tgt) × 4 bytes covers WASM heap intermediate
// buffers (decode + resize linear-RGB temp + encode). Wave 0 perf budget
// task (Plan 04-03) validates empirically; revisit if SC-2 50-file batch
// exceeds 800 MB peak.
export function estimateJobBytes(
  srcW: number,
  srcH: number,
  tgtW: number,
  tgtH: number,
): number {
  const srcPixels = srcW * srcH
  const tgtPixels = tgtW * tgtH
  return Math.ceil((srcPixels + tgtPixels) * 4 * 1.75)
}
