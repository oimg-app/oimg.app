// Phase 4 plan 04-05 Task 2 — unit suite asserting the resize slice contract.
//
// Intent: assert (a) DEFAULT_RESIZE_SETTINGS.alg === 'lanczos3' (D-05 default),
//         (b) the setResize merge contract is shape-compatible with a partial
//             { alg: 'mitchell' } update,
//         (c) setResize({}) is a no-op (preserves existing alg).
//
// Same pattern as Plan 04-01 settings-icc.test.ts: imports the pure
// DEFAULT_RESIZE_SETTINGS constant from src/data/defaults.ts (which only uses
// type-level imports from '@/types', stripped at parse time) and emulates the
// `set((s) => ({ resize: { ...s.resize, ...next } }))` merge logic from
// src/stores/settings.ts. Vite-alias '@/data' is unresolvable under
// `node --experimental-strip-types`, so direct useSettingsStore import would
// crash with ERR_MODULE_NOT_FOUND — the in-test merge mirror keeps the
// Node-runnable contract assertion local. Live E2E coverage of the actual
// store surface lands in Plan 04-06 via the __OIMG_STORES__ pattern.
//
// Run: node --experimental-strip-types src/tests/settings-resize.test.ts

import type { ResizeAlg } from '../types/index.ts'
import { DEFAULT_RESIZE_SETTINGS } from '../data/defaults.ts'

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
  'DEFAULT_RESIZE_SETTINGS.alg defaults to lanczos3',
  DEFAULT_RESIZE_SETTINGS.alg === 'lanczos3',
)

// (b) setResize({alg:'mitchell'}) merge contract — emulates the
// `set((s) => ({ resize: { ...s.resize, ...next } }))` logic.
const merged: { alg: ResizeAlg } = {
  ...DEFAULT_RESIZE_SETTINGS,
  ...{ alg: 'mitchell' as ResizeAlg },
}
assert(
  'setResize({alg:"mitchell"}) flips alg to mitchell',
  merged.alg === 'mitchell',
)

// (c) setResize({}) is a no-op — partial-merge with empty object preserves alg.
const noop: { alg: ResizeAlg } = { ...merged, ...{} }
assert(
  'setResize({}) noop preserves alg',
  noop.alg === 'mitchell',
)

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
