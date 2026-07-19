// Phase 16 — MTR-03: SSIM band thresholds. Source of truth for banded coloring in Report panel.
// Phase 16 Plan 02 — pure utility module (no I/O, no imports); consumed by ReportPanel (Plan 16-05).

export type Band = 'green' | 'yellow' | 'red'

/** SSIM: higher is better (0 = no similarity, 1 = identical). Verbatim per REQUIREMENTS.md MTR-03. */
export const SSIM_BANDS = { green: 0.95, yellow: 0.85 } as const

/**
 * Classify an SSIM score into a band. Pure function over the reals — no clamp, no validation.
 * `>=` is inclusive at both boundaries so v === 0.95 is green and v === 0.85 is yellow.
 */
export function ssimBand(v: number): Band {
  if (v >= SSIM_BANDS.green) return 'green'
  if (v >= SSIM_BANDS.yellow) return 'yellow'
  return 'red'
}

// Phase 17 hook — populated when Butteraugli vendored build lands. Lower is better (distance metric).
// export const BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 } as const
