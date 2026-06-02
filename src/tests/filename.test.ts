// Phase 11 Plan 03 — Wave 1 Node unit test for filename module
// Run: node --experimental-strip-types src/tests/filename.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const { renameExtension, collisionSuffix, timestampedZipName, mimeFor, sanitizeBaseName } =
    await import('../lib/filename.ts')

  // renameExtension (D-05)
  assert("renameExtension('hero.png','webp') === 'hero.webp'", renameExtension('hero.png', 'webp') === 'hero.webp')
  assert("renameExtension('hero','png') === 'hero.png'", renameExtension('hero', 'png') === 'hero.png')
  assert("renameExtension('HERO.PNG','webp') === 'HERO.webp'", renameExtension('HERO.PNG', 'webp') === 'HERO.webp')
  assert("renameExtension('hero.png','png') idempotent", renameExtension('hero.png', 'png') === 'hero.png')

  // collisionSuffix (D-10)
  assert("collisionSuffix unchanged when empty set", collisionSuffix('a.webp', new Set()) === 'a.webp')
  assert("collisionSuffix first collision → '(1)'", collisionSuffix('a.webp', new Set(['a.webp'])) === 'a (1).webp')
  assert(
    "collisionSuffix second collision → '(2)'",
    collisionSuffix('a.webp', new Set(['a.webp', 'a (1).webp'])) === 'a (2).webp',
  )
  assert(
    "collisionSuffix dotless name → 'name (1)'",
    collisionSuffix('name', new Set(['name'])) === 'name (1)',
  )

  // timestampedZipName (D-10)
  const zipName = timestampedZipName(new Date('2026-06-01T12:34:56'))
  assert(
    `timestampedZipName matches regex (got: ${zipName})`,
    /^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/.test(zipName),
  )
  assert(
    "timestampedZipName default arg returns valid pattern",
    /^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/.test(timestampedZipName()),
  )

  // mimeFor
  assert("mimeFor('webp') === 'image/webp'", mimeFor('webp') === 'image/webp')
  assert("mimeFor('WEBP') case-insensitive", mimeFor('WEBP') === 'image/webp')
  assert("mimeFor('zip') === 'application/zip'", mimeFor('zip') === 'application/zip')
  assert("mimeFor('xyz') unknown → octet-stream", mimeFor('xyz') === 'application/octet-stream')
  assert("mimeFor('jpeg') === 'image/jpeg'", mimeFor('jpeg') === 'image/jpeg')

  // sanitizeBaseName (T-11-01 zip-slip mitigation)
  const traversal = sanitizeBaseName('../etc/passwd')
  assert(
    `sanitizeBaseName('../etc/passwd') has no '/' (got: ${traversal})`,
    !traversal.includes('/'),
  )
  assert("sanitizeBaseName('a\\\\b\\\\c') === 'a_b_c'", sanitizeBaseName('a\\b\\c') === 'a_b_c')
  assert("sanitizeBaseName NUL stripped → 'a_b'", sanitizeBaseName('a\0b') === 'a_b')
} catch (err) {
  failed++
  console.error('Unexpected error:', err)
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
