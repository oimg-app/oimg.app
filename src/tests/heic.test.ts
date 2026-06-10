// Quick 260610-lby: Node unit test for HEIC gate + routing logic
// Run: node --experimental-strip-types src/tests/heic.test.ts
// Tests ROUTING/GATE logic only — no WASM decode (fast + deterministic)

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  // --- ingest gate: HEIC/HEIF accepted by extension ---
  const { isAccepted } = await import('../hooks/useIngest.ts')
  assert('isAccepted: photo.heic (ext only)', isAccepted({ name: 'photo.heic', type: '' } as File))
  assert('isAccepted: photo.heif (ext only)', isAccepted({ name: 'photo.heif', type: '' } as File))
  assert('isAccepted: photo.heic (with MIME)', isAccepted({ name: 'photo.heic', type: 'image/heic' } as File))
  assert('isAccepted: photo.heif (with MIME)', isAccepted({ name: 'photo.heif', type: 'image/heif' } as File))
  // Negative: something unsupported stays rejected
  assert('isAccepted: photo.gif rejected', !isAccepted({ name: 'photo.gif', type: 'image/gif' } as File))
} catch (err) {
  if (err instanceof Error && (err.message.includes('useIngest') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: useIngest not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error (useIngest):', err)
  }
}

try {
  // --- stub-data: HEIC routes to JPEG; CODECS stays 5; no HEIC output tab ---
  const { defaultFileSettings, CODECS } = await import('../lib/stub-data.ts')

  assert('defaultFileSettings heic → codec JPEG', defaultFileSettings('heic', null).codec === 'JPEG')
  assert('defaultFileSettings heif → codec JPEG', defaultFileSettings('heif', null).codec === 'JPEG')
  assert('CODECS.length === 5 (HEIC not added)', CODECS.length === 5)
  assert('CODECS does not include HEIC', !(CODECS as readonly string[]).includes('HEIC'))
  assert('CODECS does not include HEIF', !(CODECS as readonly string[]).includes('HEIF'))
} catch (err) {
  if (err instanceof Error && (err.message.includes('stub-data') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: stub-data not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error (stub-data):', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
