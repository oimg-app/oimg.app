// Phase 4 plan 04-01 Wave 0 — unit suite asserting iCCP chunk handling.
// Wave 0: asserts the fixture has the iCCP chunk before optimization.
// Wave 2 (Plan 04-03 PNG adapter) flips this to also assert the optimized
// output bytes contain NO `iCCP` chunk identifier.
//
// Run: node --experimental-strip-types src/tests/icc.test.ts

import { readFile } from 'node:fs/promises'

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

const fixture = await readFile('src/tests/fixtures/with-icc.png')
assert('fixture has iCCP chunk before optimization', fixture.includes(Buffer.from('iCCP')))
// TODO Wave 2: import { run } from '../workers/png-adapter.ts'; const result = await run(...);
// assert('output strips iCCP', !Buffer.from(result.output).includes(Buffer.from('iCCP')))

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
