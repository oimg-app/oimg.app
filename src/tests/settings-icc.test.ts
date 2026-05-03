// Phase 4 plan 04-01 Wave 0 — unit suite asserting the preserveIcc toggle is
// wired through DEFAULT_GLOBAL_SETTINGS into the settings store contract.
//
// Intent: assert (a) DEFAULT_GLOBAL_SETTINGS.preserveIccProfile === false,
//         (b) DEFAULT_GLOBAL_SETTINGS.stripMetadata === true,
//         (c) the GlobalSettings setGlobal contract is shape-compatible with
//             a partial { preserveIccProfile: true } update.
//
// Rule 3 deviation note (Plan 04-01 Task 2):
// The original plan called for a direct import of useSettingsStore from
// `src/stores/settings.ts`, but that module imports `@/data/defaults` which
// is a Vite-only alias that Node's `--experimental-strip-types` runner cannot
// resolve. Following the established Phase 3 pattern (svg-adapter.unit.ts
// imports pure svg-config.ts, not svg-adapter.ts which evaluates svgo/browser),
// this test imports the pure DEFAULT_GLOBAL_SETTINGS constant and emulates the
// setGlobal merge — same contract, no Vite-alias resolution needed. A live
// E2E verification of useSettingsStore.setGlobal will land in Wave 1+ via
// the existing __OIMG_STORES__ store-driven Playwright pattern.
//
// Run: node --experimental-strip-types src/tests/settings-icc.test.ts

import type { GlobalSettings } from '../types/index.ts'
import { DEFAULT_GLOBAL_SETTINGS } from '../data/defaults.ts'

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`FAIL: ${name}`)
  }
}

// (a) Default value contract.
assert(
  'preserveIccProfile defaults false',
  DEFAULT_GLOBAL_SETTINGS.preserveIccProfile === false,
)
assert('stripMetadata defaults true', DEFAULT_GLOBAL_SETTINGS.stripMetadata === true)

// (b) setGlobal({ preserveIccProfile: true }) merge contract — emulates the
// `set((s) => ({ global: { ...s.global, ...next } }))` logic from
// src/stores/settings.ts so we can validate the merge shape under Node.
const merged: GlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, preserveIccProfile: true }
assert(
  'setGlobal({preserveIccProfile:true}) merged shape flips state',
  merged.preserveIccProfile === true && merged.stripMetadata === true,
)

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
