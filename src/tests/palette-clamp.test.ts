// change:fix-reduce-palette-pipeline — palette parameter clamp (color-quantize: `numColors`
// and `dither` parameters). Run: node --experimental-strip-types src/tests/palette-clamp.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

const { clampPalette } = await import('../lib/settings.ts')

const inRange = (n: number) => Number.isInteger(n) && n >= 2 && n <= 256
for (const v of [1, 0, -5, 300, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 'abc', undefined, null]) {
  const { numColors } = clampPalette(v, 1)
  assert(`numColors ${String(v)} → integer in 2–256 (got ${numColors})`, inRange(numColors))
}
assert('numColors 1 → 2', clampPalette(1, 1).numColors === 2)
assert('numColors 300 → 256', clampPalette(300, 1).numColors === 256)
assert('numColors 32 unchanged', clampPalette(32, 1).numColors === 32)
assert('numColors "64" coerced', clampPalette('64', 1).numColors === 64)
assert('numColors NaN → 256', clampPalette(Number.NaN, 1).numColors === 256)

for (const v of [-1, 2, Number.NaN, 'abc', undefined]) {
  const { dither } = clampPalette(256, v)
  assert(`dither ${String(v)} → 0–1 (got ${dither})`, Number.isFinite(dither) && dither >= 0 && dither <= 1)
}
assert('dither 0 stays 0', clampPalette(256, 0).dither === 0)
assert('dither 0.5 unchanged', clampPalette(256, 0.5).dither === 0.5)
assert('dither NaN → 1', clampPalette(256, Number.NaN).dither === 1)

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
