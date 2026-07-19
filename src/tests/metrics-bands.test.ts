// Phase 16 Plan 02 — Wave 1 (TDD RED) — MTR-03: SSIM threshold constants + banded classifier.
//
// Verifies that `src/lib/metrics-bands.ts` exports the verbatim thresholds documented in
// REQUIREMENTS.md MTR-03 (green >= 0.95, yellow >= 0.85, red below) and that `ssimBand()`
// returns the correct band at exact boundaries and adjacent epsilons.
//
// Pure-fn test — no fixtures, no worker, no React, no stub-data.
//
// Run: node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/metrics-bands.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// Import via `@/` alias — resolved by `src/tests/_alias-loader.mjs`.
const mod = await import('@/lib/metrics-bands')
const { SSIM_BANDS, ssimBand } = mod
// Type-only import so the runner erases it; also asserts the exported type name exists.
type _Band = import('@/lib/metrics-bands').Band

// ── describe: SSIM_BANDS — verbatim thresholds per REQUIREMENTS.md MTR-03 ─────
assert('SSIM_BANDS.green === 0.95 (MTR-03 verbatim)',
  SSIM_BANDS.green === 0.95)
assert('SSIM_BANDS.yellow === 0.85 (MTR-03 verbatim)',
  SSIM_BANDS.yellow === 0.85)

// ── describe: ssimBand — boundary sweep ───────────────────────────────────────
// Green band: v >= 0.95
assert('ssimBand(1.0) returns "green"',
  ssimBand(1.0) === 'green')
assert('ssimBand(0.95) returns "green" (>= inclusive boundary)',
  ssimBand(0.95) === 'green')

// Yellow band: 0.85 <= v < 0.95
assert('ssimBand(0.9499) returns "yellow" (just below green)',
  ssimBand(0.9499) === 'yellow')
assert('ssimBand(0.90) returns "yellow" (mid-band)',
  ssimBand(0.90) === 'yellow')
assert('ssimBand(0.85) returns "yellow" (>= inclusive boundary)',
  ssimBand(0.85) === 'yellow')

// Red band: v < 0.85
assert('ssimBand(0.8499) returns "red" (just below yellow)',
  ssimBand(0.8499) === 'red')
assert('ssimBand(0) returns "red" (lower floor)',
  ssimBand(0) === 'red')

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
