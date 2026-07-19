// Phase 13 Plan 01 — Wave 0 Node unit test for DIA-01 (D-03 + safe-fallback).
//
// Verifies that `src/lib/versions.ts` exports `BUILD_VERSIONS` with the
// documented `BuildVersions` shape AND that the `typeof X === 'string'` /
// `typeof X === 'object'` guards safe-fallback cleanly outside Vite.
//
// Outside Vite (this Node runtime), `__SVGO_VERSION__` and
// `__JSQUASH_VERSIONS__` are undefined — every value must collapse to the
// `'0.0.0'` sentinel without throwing a ReferenceError at module-init.
//
// Run: node --experimental-strip-types src/tests/versions.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// ── DIA-01: BUILD_VERSIONS shape + safe-fallback ───────────────────────────
const mod = await import('../lib/versions.ts')
const v = mod.BUILD_VERSIONS

// Shape: top-level keys
assert('BUILD_VERSIONS.svgo is a string',
  typeof v.svgo === 'string')
assert('BUILD_VERSIONS.jsquash is an object',
  typeof v.jsquash === 'object' && v.jsquash !== null)

// Shape: all six codec keys present and string-typed
const codecs = ['webp', 'jpeg', 'avif', 'oxipng', 'png', 'resize'] as const
for (const c of codecs) {
  assert(`BUILD_VERSIONS.jsquash.${c} is a string`,
    typeof v.jsquash[c] === 'string')
}

// Safe-fallback: outside Vite, the guards yield '0.0.0' sentinels.
// This proves the `typeof X === 'string'` / `typeof X === 'object'` checks
// in src/lib/versions.ts neutralize the undefined globals (no ReferenceError).
assert('svgo safe-fallback === "0.0.0" outside Vite',
  v.svgo === '0.0.0')
for (const c of codecs) {
  assert(`jsquash.${c} safe-fallback === "0.0.0" outside Vite`,
    v.jsquash[c] === '0.0.0')
}

// Phase 16 — MTR-01: ssim is now populated (Phase 17 butteraugli still deferred).
// Outside Vite, __SSIM_VERSION__ is undefined and the guard yields '0.0.0'.
// Inside Vite the constant is inlined to the installed semver.
assert('BUILD_VERSIONS.ssim is a string',
  typeof v.ssim === 'string')
assert('BUILD_VERSIONS.ssim matches semver shape',
  /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v.ssim))
// When run outside Vite the value must be the '0.0.0' fallback; when run
// inside Vite the constant is set and must differ. Assert whichever matches
// the current runtime — but always require a well-formed semver string.
if (typeof __SSIM_VERSION__ === 'undefined') {
  assert('BUILD_VERSIONS.ssim safe-fallback === "0.0.0" outside Vite',
    v.ssim === '0.0.0')
} else {
  assert('BUILD_VERSIONS.ssim !== "0.0.0" when __SSIM_VERSION__ is defined',
    v.ssim !== '0.0.0')
}

// Phase 17 hook remains undefined.
assert('butteraugli hook is undefined in Phase 13',
  v.butteraugli === undefined)

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
