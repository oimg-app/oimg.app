// Phase 5 plan 02 — TDD RED: unit tests for icc.ts extract/embed functions.
// Pure ArrayBuffer/DataView operations — no WASM, no browser globals.
// Run: node --experimental-strip-types src/tests/icc-extract.unit.ts
//
// These tests MUST FAIL before icc.ts exists (RED phase).

import { readFile } from 'node:fs/promises'

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) {
    passed++
    console.log(`PASS: ${name}`)
  } else {
    failed++
    console.error(`FAIL: ${name}`)
  }
}

try {
  const { extractPngIcc, embedPngIcc, extractJpegIcc } = await import('../lib/icc.ts')

  // ── PNG ICC ────────────────────────────────────────────────────────────────
  // Test with the real fixture from Phase 4.
  const iccFixture = await readFile('src/tests/fixtures/with-icc.png')
  const iccBuf = iccFixture.buffer.slice(
    iccFixture.byteOffset,
    iccFixture.byteOffset + iccFixture.byteLength,
  ) as ArrayBuffer

  // Load a known-clean PNG (density-2x.png has no iCCP by default).
  const cleanFixture = await readFile('src/tests/fixtures/density-2x.png')
  const cleanBuf = cleanFixture.buffer.slice(
    cleanFixture.byteOffset,
    cleanFixture.byteOffset + cleanFixture.byteLength,
  ) as ArrayBuffer

  // extractPngIcc on file WITH iCCP → returns non-null Uint8Array.
  const iccData = extractPngIcc(iccBuf)
  assert('extractPngIcc: fixture with iCCP returns non-null', iccData !== null)
  assert('extractPngIcc: returns Uint8Array', iccData instanceof Uint8Array)
  assert('extractPngIcc: ICC data has positive length', (iccData?.length ?? 0) > 0)

  // extractPngIcc on clean PNG → returns null.
  const noIcc = extractPngIcc(cleanBuf)
  assert('extractPngIcc: clean PNG returns null', noIcc === null)

  // extractPngIcc on malformed data → returns null (T-5-02-03 — no throw).
  const malformed = new ArrayBuffer(20) // too small to be a valid PNG
  assert('extractPngIcc: malformed returns null (T-5-02-03)', extractPngIcc(malformed) === null)

  // embedPngIcc: roundtrip — embed ICC into clean PNG, then re-extract.
  if (iccData) {
    const embedded = embedPngIcc(cleanBuf, iccData)
    assert('embedPngIcc: returns ArrayBuffer', embedded instanceof ArrayBuffer)
    assert('embedPngIcc: output larger than input', embedded.byteLength > cleanBuf.byteLength)
    // Re-extract from the output should give back the same ICC data.
    const extracted2 = extractPngIcc(embedded)
    assert('embedPngIcc: roundtrip — ICC re-extractable', extracted2 !== null)
    assert(
      'embedPngIcc: roundtrip — ICC byte-identical',
      extracted2 !== null &&
        extracted2.length === iccData.length &&
        iccData.every((b, i) => extracted2[i] === b),
    )
    // The output must remain a valid PNG (magic bytes).
    const view = new DataView(embedded)
    assert(
      'embedPngIcc: output has PNG magic bytes',
      view.getUint8(0) === 0x89 && view.getUint8(1) === 0x50,
    )
  }

  // ── JPEG ICC ───────────────────────────────────────────────────────────────
  // We don't have a JPEG with-icc fixture, so just test that the function
  // returns null on a non-JPEG buffer without throwing.
  const jpegNullResult = extractJpegIcc(new ArrayBuffer(100))
  assert('extractJpegIcc: short buffer returns null (no throw)', jpegNullResult === null)

} catch (err) {
  failed++
  console.error('Unexpected error:', err)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
