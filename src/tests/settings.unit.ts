// Phase 5 plan 06 — per-file codec override merge logic unit tests (PIPE-03).
// Runner: node --experimental-strip-types src/tests/settings.unit.ts
//
// Pattern: relative imports only (no @/ alias) — @/types is erased as `import type`
// at runtime so the transitive @/types reference in jpeg-config.ts / webp-config.ts /
// png-config.ts is safe under node --experimental-strip-types.
// Precedent: Phase 4 plan 04-01 settings-store.unit.ts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildJpegSettings } from '../workers/jpeg-config.ts'
import { buildWebpSettings } from '../workers/webp-config.ts'
import { buildPngResizeSettings } from '../workers/png-config.ts'

// ─── JPEG ────────────────────────────────────────────────────────────────────

test('PIPE-03: perFile override merges over global JPEG settings', () => {
  const global = { quality: 80, progressive: true }
  const override = { quality: 55 }
  const result = buildJpegSettings({ globalJpeg: global, fileOverride: override })
  assert.equal(result.quality, 55)
  assert.equal(result.progressive, true)
})

test('PIPE-03: when no perFile override exists, global JPEG settings are used unmodified', () => {
  const global = { quality: 75, progressive: false }
  const result = buildJpegSettings({ globalJpeg: global })
  assert.equal(result.quality, 75)
  assert.equal(result.progressive, false)
})

// ─── WebP ────────────────────────────────────────────────────────────────────

test('PIPE-03: perFile override merges over global WebP settings', () => {
  const global = { quality: 80, lossless: false, method: 4 }
  const override = { quality: 60, lossless: true }
  const result = buildWebpSettings({ globalWebp: global, fileOverride: override })
  assert.equal(result.quality, 60)
  assert.equal(result.lossless, true)
  assert.equal(result.method, 4) // untouched by override
})

test('PIPE-03: when no perFile override exists, global WebP settings are used unmodified', () => {
  const global = { quality: 85, lossless: false, method: 2 }
  const result = buildWebpSettings({ globalWebp: global })
  assert.equal(result.quality, 85)
  assert.equal(result.lossless, false)
  assert.equal(result.method, 2)
})

// ─── PNG ─────────────────────────────────────────────────────────────────────

test('PIPE-03: perFile override merges over global PNG settings', () => {
  const result = buildPngResizeSettings({
    sourceDensity: '2x',
    targetDensity: '1x',
    globalAlg: 'lanczos3',
    fileOverride: 'triangle',
    globalPreserveIcc: false,
    filePreserveIcc: true,
    globalPng: { level: 3 },
  })
  assert.equal(result.method, 'triangle')       // fileOverride wins
  assert.equal(result.preserveIcc, true)         // filePreserveIcc wins
  assert.equal(result.level, 3)
  assert.equal(result.sourceDensity, '2x')
  assert.equal(result.targetDensity, '1x')
})

test('PIPE-03: when no perFile PNG override exists, global settings are used unmodified', () => {
  const result = buildPngResizeSettings({
    sourceDensity: '1x',
    targetDensity: '1x',
    globalAlg: 'lanczos3',
    globalPreserveIcc: true,
    globalPng: { level: 6 },
  })
  assert.equal(result.method, 'lanczos3')
  assert.equal(result.preserveIcc, true)
  assert.equal(result.level, 6)
})
