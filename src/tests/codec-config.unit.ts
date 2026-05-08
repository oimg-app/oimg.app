// Phase 5 plan 02 — TDD RED: unit tests for JPEG/WebP/AVIF config builders.
// These tests run under node --experimental-strip-types (no Vite, no @/ aliases).
// Pattern: Phase 4 png-config.ts, svg-config.ts precedent.
//
// Run: node --experimental-strip-types src/tests/codec-config.unit.ts
//
// These tests MUST FAIL before implementation exists (RED phase).

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) {
    passed++
    console.log(`PASS: ${name}`)
  } else {
    failed++
    console.error(`FAIL: ${name}`)
  }
}

// ── JPEG config ────────────────────────────────────────────────────────────────
{
  const { buildJpegSettings } = await import('../workers/jpeg-config.ts')

  // Defaults pass through cleanly.
  const result = buildJpegSettings({ globalJpeg: { quality: 80, progressive: true } })
  assert('jpeg: quality passed through', result.quality === 80)
  assert('jpeg: progressive passed through', result.progressive === true)

  // fileOverride wins over global.
  const overridden = buildJpegSettings({
    globalJpeg: { quality: 80, progressive: true },
    fileOverride: { quality: 60, progressive: false },
  })
  assert('jpeg: fileOverride.quality wins', overridden.quality === 60)
  assert('jpeg: fileOverride.progressive wins', overridden.progressive === false)

  // Quality is clamped to [0,100].
  const clamped = buildJpegSettings({ globalJpeg: { quality: 150, progressive: false } })
  assert('jpeg: quality clamped to 100', clamped.quality === 100)
  const clampedLow = buildJpegSettings({ globalJpeg: { quality: -5, progressive: false } })
  assert('jpeg: quality clamped to 0', clampedLow.quality === 0)
}

// ── WebP config ────────────────────────────────────────────────────────────────
{
  const { buildWebpSettings } = await import('../workers/webp-config.ts')

  const result = buildWebpSettings({ globalWebp: { quality: 75, lossless: false, method: 4 } })
  assert('webp: quality passed through', result.quality === 75)
  assert('webp: lossless passed through', result.lossless === false)
  assert('webp: method passed through', result.method === 4)

  // fileOverride wins.
  const overridden = buildWebpSettings({
    globalWebp: { quality: 75, lossless: false, method: 4 },
    fileOverride: { quality: 50, lossless: true, method: 6 },
  })
  assert('webp: fileOverride.quality wins', overridden.quality === 50)
  assert('webp: fileOverride.lossless wins', overridden.lossless === true)
  assert('webp: fileOverride.method wins', overridden.method === 6)
}

// ── AVIF config ────────────────────────────────────────────────────────────────
{
  const { buildAvifSettings } = await import('../workers/avif-config.ts')

  const result = buildAvifSettings({ globalAvif: { quality: 50, lossless: false } })
  assert('avif: quality passed through', result.quality === 50)
  assert('avif: lossless passed through', result.lossless === false)

  // fileOverride wins.
  const overridden = buildAvifSettings({
    globalAvif: { quality: 50, lossless: false },
    fileOverride: { quality: 30, lossless: true },
  })
  assert('avif: fileOverride.quality wins', overridden.quality === 30)
  assert('avif: fileOverride.lossless wins', overridden.lossless === true)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
