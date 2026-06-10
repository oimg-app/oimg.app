// Phase 13 — DIA-02 (D-04): Node unit test for probeCaps() shape + never-throws contract.
// Run: node --experimental-strip-types src/tests/caps.test.ts
// Harness mirrors src/tests/stores.test.ts (let passed/failed + assert() tally + process.exit).

import { probeCaps, type Caps } from '../lib/caps.ts'

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// CRITICAL: do NOT wrap probeCaps() in try/catch — the never-throws contract IS
// the test. If it throws, Node exits non-zero and the test fails.
const result: Caps = probeCaps()
assert('probeCaps() does not throw under Node', true)

// Shape: exactly 5 keys (sorted): crossOriginIsolated, hardwareConcurrency,
// offlineReady, simd, threads
const keys = Object.keys(result).sort()
assert(
  'returns exactly 5 keys',
  keys.length === 5 &&
    keys.join(',') === 'crossOriginIsolated,hardwareConcurrency,offlineReady,simd,threads',
)

// Typeof: 4 booleans + 1 number
assert('typeof simd === "boolean"', typeof result.simd === 'boolean')
assert('typeof threads === "boolean"', typeof result.threads === 'boolean')
assert(
  'typeof crossOriginIsolated === "boolean"',
  typeof result.crossOriginIsolated === 'boolean',
)
assert('typeof offlineReady === "boolean"', typeof result.offlineReady === 'boolean')
assert(
  'typeof hardwareConcurrency === "number"',
  typeof result.hardwareConcurrency === 'number',
)

// Under Node (no `window`), hasWindow guard returns safe defaults:
//   - crossOriginIsolated === false (no globalThis.crossOriginIsolated)
//   - offlineReady === false (no navigator.serviceWorker.controller)
//   - hardwareConcurrency === 1 (hasWindow ? ... : 1)
assert(
  'under Node, crossOriginIsolated === false',
  result.crossOriginIsolated === false,
)
assert('under Node, offlineReady === false', result.offlineReady === false)
assert('under Node, hardwareConcurrency === 1', result.hardwareConcurrency === 1)

// Under Node, threads must be false: SAB may exist as a global in modern Node,
// but coi === false makes threads === false regardless. Pin the AND-guard.
assert('under Node, threads === false (coi gates it)', result.threads === false)

// SIMD may be true OR false in Node 20+ (depends on V8 flags). Both outcomes
// are valid — assert the call returned a boolean and didn't throw.
assert(
  'simd is a boolean (true or false both valid in Node)',
  typeof result.simd === 'boolean',
)

// hardwareConcurrency is always a finite positive integer ≥ 1.
assert('hardwareConcurrency >= 1', result.hardwareConcurrency >= 1)

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
