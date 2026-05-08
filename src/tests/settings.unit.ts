// Phase 5 Wave 0 — per-file codec override merge logic unit test stub.
// Requirement: PIPE-03 (per-file override takes precedence over global settings).
// Runner: node --experimental-strip-types src/tests/settings.unit.ts
//
// Wave 1 plan 03 ships the perFile slice in useSettingsStore and the
// buildXxxSettings() merge functions; this stub will be activated then.

import { test } from 'node:test'
import assert from 'node:assert/strict'

// STUB: Wave 1 plan 03 will import real merge functions and flip these to live assertions.

test('PIPE-03: perFile override merges over global JPEG settings', () => {
  assert.fail('not yet implemented — Wave 1 plan 03 adds perFile slice and buildJpegSettings()')
})

test('PIPE-03: perFile override merges over global WebP settings', () => {
  assert.fail('not yet implemented — Wave 1 plan 03 adds perFile slice and buildWebpSettings()')
})

test('PIPE-03: perFile override merges over global PNG settings', () => {
  assert.fail('not yet implemented — Wave 1 plan 03 adds perFile slice and buildPngSettings()')
})

test('PIPE-03: when no perFile override exists, global settings are used unmodified', () => {
  assert.fail('not yet implemented — Wave 1 plan 03 adds perFile slice and config builders')
})
