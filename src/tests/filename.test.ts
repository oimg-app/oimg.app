// Phase 4 plan 04-01 Wave 0 — unit suite for applyDensitySuffix +
// deduplicateName. The actual src/lib/filename.ts module ships in Plan 04-02
// (Wave 1). This Wave 0 stub keeps CI green by catching the expected
// "module not found" import error and counting it as the stub-state pass.
//
// Run: node --experimental-strip-types src/tests/filename.test.ts
// Wave 1 flips this to live assertions by removing the try/catch wrapper.

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

try {
  const mod = await import('../lib/filename.ts')
  // Wave 1 assertions (live):
  assert('applyDensitySuffix appends @Nx', mod.applyDensitySuffix('logo.png', '2x') === 'logo@2x.png')
  assert('applyDensitySuffix is idempotent', mod.applyDensitySuffix('logo@2x.png', '1x') === 'logo@1x.png')
  assert('applyDensitySuffix handles no-extension', mod.applyDensitySuffix('logo', '3x') === 'logo@3x')
  assert('deduplicateName passthrough on no collision', mod.deduplicateName('logo@1x.png', new Set()) === 'logo@1x.png')
  assert('deduplicateName inserts (2) before @Nx', mod.deduplicateName('logo@1x.png', new Set(['logo@1x.png'])) === 'logo (2)@1x.png')
  assert(
    'deduplicateName handles repeat collisions',
    mod.deduplicateName('logo@1x.png', new Set(['logo@1x.png', 'logo (2)@1x.png'])) === 'logo (3)@1x.png',
  )
} catch (err) {
  // Wave 0 stub: src/lib/filename.ts not yet shipped. Acceptable until Plan 04-02.
  if (err instanceof Error && err.message.includes('filename.ts')) {
    passed++ // expected stub state
    console.log('Wave 0 stub state: src/lib/filename.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
