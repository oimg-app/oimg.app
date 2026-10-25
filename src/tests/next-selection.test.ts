// change:remove-dead-ui-and-fix-a11y — roving-selection helper for the keyboard file queue (design D5).
//
// Pure-fn test — no fixtures, no worker, no React.
//
// Run: node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/next-selection.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

const { nextSelection } = await import('@/lib/next-selection')

const ids = ['a', 'b', 'c']

assert('ArrowDown from middle → next', nextSelection(ids, 'b', 'ArrowDown') === 'c')
assert('ArrowUp from middle → previous', nextSelection(ids, 'b', 'ArrowUp') === 'a')
assert('ArrowDown at end stays (no wrap)', nextSelection(ids, 'c', 'ArrowDown') === 'c')
assert('ArrowUp at start stays (no wrap)', nextSelection(ids, 'a', 'ArrowUp') === 'a')
assert('Home → first', nextSelection(ids, 'c', 'Home') === 'a')
assert('End → last', nextSelection(ids, 'a', 'End') === 'c')
assert('null current → first', nextSelection(ids, null, 'ArrowDown') === 'a')
assert('unknown current → first', nextSelection(ids, 'zzz', 'ArrowUp') === 'a')
assert('empty list → null', nextSelection([], 'a', 'ArrowDown') === null)
assert('unhandled key → null', nextSelection(ids, 'b', 'Enter') === null)

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
