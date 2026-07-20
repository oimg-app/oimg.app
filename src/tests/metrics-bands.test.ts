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
// Type-side: use `typeof ssimBand` to assert the exported `Band` union at type-check time
// without introducing an unused-type-alias warning under `tsc -b`.
const mod = await import('@/lib/metrics-bands')
const { SSIM_BANDS, ssimBand, BUTTERAUGLI_BANDS, butteraugliBand } = mod
const _bandCheck: ReturnType<typeof ssimBand> extends 'green' | 'yellow' | 'red' ? true : never = true
void _bandCheck
const _bandCheckB: ReturnType<typeof butteraugliBand> extends 'green' | 'yellow' | 'red' ? true : never = true
void _bandCheckB

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

// ── describe: BUTTERAUGLI_BANDS — verbatim thresholds per REQUIREMENTS.md MTR-03 ──
assert('BUTTERAUGLI_BANDS.green === 1.5 (MTR-03 verbatim)',
  BUTTERAUGLI_BANDS.green === 1.5)
assert('BUTTERAUGLI_BANDS.yellow === 3.0 (MTR-03 verbatim)',
  BUTTERAUGLI_BANDS.yellow === 3.0)

// ── describe: butteraugliBand — strict-< direction (inverse of ssimBand) ──────
// Green band: v < 1.5 (lower is better; 0 = identical pixel-for-pixel)
assert('butteraugliBand(0.0) returns "green" (lower floor, identical images)',
  butteraugliBand(0.0) === 'green')
assert('butteraugliBand(1.499) returns "green" (just under green boundary)',
  butteraugliBand(1.499) === 'green')

// Yellow band: 1.5 <= v < 3.0 — CRITICAL boundary flip vs. SSIM's inclusive >=
assert('butteraugliBand(1.5) returns "yellow" (STRICT < — boundary flips to yellow, NOT green)',
  butteraugliBand(1.5) === 'yellow')
assert('butteraugliBand(2.0) returns "yellow" (mid-band)',
  butteraugliBand(2.0) === 'yellow')
assert('butteraugliBand(2.999) returns "yellow" (just under yellow boundary)',
  butteraugliBand(2.999) === 'yellow')

// Red band: v >= 3.0 — visible artifacts
assert('butteraugliBand(3.0) returns "red" (STRICT < — boundary flips to red, NOT yellow)',
  butteraugliBand(3.0) === 'red')
assert('butteraugliBand(5.0) returns "red" (upper realistic value)',
  butteraugliBand(5.0) === 'red')
assert('butteraugliBand(10) returns "red" (upper floor)',
  butteraugliBand(10) === 'red')

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
