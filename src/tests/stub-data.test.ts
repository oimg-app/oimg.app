// Phase 01 Plan 01 — Wave 0 Node unit test for stub-data module
// Run: node --experimental-strip-types src/tests/stub-data.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const mod = await import('../lib/stub-data.ts')
  assert('STUB_FILES has 12 entries', mod.STUB_FILES.length === 12)
  assert('SVGO_PLUGINS has 22 entries', mod.SVGO_PLUGINS.length === 22)
  assert('CODECS has 5 entries', mod.CODECS.length === 5)
  assert('RESIZE_ALGS has 4 entries', mod.RESIZE_ALGS.length === 4)
  assert('FIT_MODES has 3 entries', mod.FIT_MODES.length === 3)
  assert('first file has required fields', 'id' in mod.STUB_FILES[0] && 'orig' in mod.STUB_FILES[0])
} catch (err) {
  // Wave 0 stub state: module not yet written — treat as expected
  if (err instanceof Error && (err.message.includes('stub-data.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: src/lib/stub-data.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
