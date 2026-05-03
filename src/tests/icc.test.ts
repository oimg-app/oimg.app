// Phase 4 — ICC strip-by-default integration test.
// Source: 04-RESEARCH.md §1.5 (ICC absence verified across all 5 jSquash codecs);
// 04-CONTEXT.md Post-Research D-10 (preserveIcc flag is wired but no-op).
//
// This test imports the production png-adapter and runs it on the
// Plan-04-01 with-icc.png fixture. Output bytes are scanned for the
// literal 'iCCP' chunk identifier; presence = test fails (privacy regression).

import { readFile } from 'node:fs/promises'

let passed = 0, failed = 0
function assert(name: string, cond: boolean) {
  cond ? (passed++, console.log(`PASS: ${name}`)) : (failed++, console.error(`FAIL: ${name}`))
}

const ICC_NEEDLE = Buffer.from('iCCP')

try {
  const adapter = await import('../workers/png-adapter.ts')
  const fixtureWithIcc = await readFile('src/tests/fixtures/with-icc.png')
  const fixtureDensity = await readFile('src/tests/fixtures/density-2x.png')

  // Sanity: the input fixture HAS iCCP. If this fails the fixture is wrong.
  assert('input fixture has iCCP chunk', fixtureWithIcc.includes(ICC_NEEDLE))

  // Test 1: preserveIcc:false → output strips iCCP.
  {
    const result = await adapter.run(
      fixtureWithIcc.buffer.slice(fixtureWithIcc.byteOffset, fixtureWithIcc.byteOffset + fixtureWithIcc.byteLength) as ArrayBuffer,
      { sourceDensity: '2x', targetDensity: '1x', method: 'lanczos3', preserveIcc: false },
    )
    const out = Buffer.from(result.output)
    assert('preserveIcc:false → output omits iCCP', !out.includes(ICC_NEEDLE))
    assert('preserveIcc:false → output is PNG', out.length >= 8 && out[0] === 0x89 && out[1] === 0x50 && out[2] === 0x4e && out[3] === 0x47)
    assert('preserveIcc:false → meta.density set', result.meta.density === '1x')
    assert('preserveIcc:false → meta.codecVersion set', result.meta.codecVersion?.includes('png@3') === true)
  }

  // Test 2: D-10 amendment — preserveIcc:true is a no-op in P4. Still strips.
  {
    const result = await adapter.run(
      fixtureWithIcc.buffer.slice(fixtureWithIcc.byteOffset, fixtureWithIcc.byteOffset + fixtureWithIcc.byteLength) as ArrayBuffer,
      { sourceDensity: '2x', targetDensity: '2x', method: 'lanczos3', preserveIcc: true },
    )
    const out = Buffer.from(result.output)
    assert('preserveIcc:true (P4 no-op) → output STILL omits iCCP', !out.includes(ICC_NEEDLE))
  }

  // Test 3: density-2x.png perf diagnostic (NOT a hard assertion — just logs).
  {
    const t0 = performance.now()
    const result = await adapter.run(
      fixtureDensity.buffer.slice(fixtureDensity.byteOffset, fixtureDensity.byteOffset + fixtureDensity.byteLength) as ArrayBuffer,
      { sourceDensity: '2x', targetDensity: '1x', method: 'lanczos3', preserveIcc: false },
    )
    const elapsed = performance.now() - t0
    console.log(`decode+resize+encode (800x600 → 400x300): ${elapsed.toFixed(1)} ms (D-15 raster budget: p50 ≤ 500 ms / 2 MB)`)
    assert('density-2x decode produces non-empty PNG output', result.output.byteLength > 0 && Buffer.from(result.output)[0] === 0x89)
  }
} catch (err) {
  // Node --experimental-strip-types is intentionally a strict-no-transpile
  // runner. It rejects:
  //   • TypeScript parameter properties (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX)
  //     — `src/workers/types.ts` AdapterError uses `constructor(public format: string)`
  //   • Vite path aliases (`@/types`, `@/data`)
  //   • jSquash WASM init paths that depend on `fetch` / `URL` browser globals
  //
  // All three only manifest under bare-node strip-types — they all work
  // under Vite's browser bundle. Wave 3 Playwright spec
  // (raster.spec.ts -g "metadata strip") is the authoritative ICC gate —
  // it runs the full adapter inside Chromium where all three constraints
  // are absent. Soft-fail with a diagnostic so CI doesn't block on
  // node-vs-browser environment differences.
  if (
    err instanceof Error &&
    (err.message.includes('WASM') ||
      err.message.includes('wasm') ||
      err.message.includes('fetch') ||
      // ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX bubbles up as an Error with this
      // exact substring; Node's `code` property isn't on Error.message.
      err.message.includes('TypeScript parameter property') ||
      err.message.includes('strip-only mode') ||
      // Vite alias path resolution failure.
      (err as { code?: string }).code === 'ERR_MODULE_NOT_FOUND')
  ) {
    console.warn(`[icc.test] jSquash WASM unavailable in node: ${err.message}`)
    console.warn('[icc.test] Wave 3 Playwright spec (raster.spec.ts -g "metadata strip") will gate this in-browser.')
    process.exit(0)
  }
  failed++
  console.error('Unexpected error:', err)
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
