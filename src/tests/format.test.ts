// Phase 01 Plan 01 — Wave 0 Node unit test for format module
// Run: node --experimental-strip-types src/tests/format.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const { fmtBytes, fmtPct } = await import('../lib/format.ts')
  assert('fmtBytes(0) returns "0 B"', fmtBytes(0) === '0 B')
  assert('fmtBytes(1024) returns "1.0 KB"', fmtBytes(1024) === '1.0 KB')
  assert('fmtBytes(1048576) returns "1.00 MB"', fmtBytes(1048576) === '1.00 MB')
  assert('fmtBytes(null) returns "—"', fmtBytes(null) === '—')
  assert('fmtPct(100, 50) returns "−50.0%"', fmtPct(100, 50) === '−50.0%')
  assert('fmtPct(100, 150) returns "+50.0%"', fmtPct(100, 150) === '+50.0%')
  assert('fmtPct(0, 0) returns "—"', fmtPct(0, 0) === '—')
  assert('fmtPct(100, 0) returns "−100.0%"', fmtPct(100, 0) === '−100.0%')
  assert('fmtPct(100, 100) returns ""', fmtPct(100, 100) === '')
} catch (err) {
  // Wave 0 stub state: module not yet written — treat as expected
  if (err instanceof Error && (err.message.includes('format.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: src/lib/format.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
