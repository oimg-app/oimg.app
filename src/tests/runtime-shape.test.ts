// Phase 13 — D-06 / DIA-01 / DIA-02: runtime atom shape contract (Wave 1 unit).
// Asserts the post-reshape runtimeAtom has `versions` + `caps` and the three
// legacy string fields (svgoVersion/codecVersion/wasmInfo) are gone.
//
// Loader contract: runtime.ts imports BUILD_VERSIONS via the `@/` Vite alias
// which Node cannot resolve. Mirrors stores.test.ts:117-124 — under bare Node
// the import fails with ERR_MODULE_NOT_FOUND, which is the expected
// "Wave 0 stub" path. When the alias DOES resolve (vitest / browser bundle),
// the full shape contract executes.
//
// Run: node --experimental-strip-types src/tests/runtime-shape.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean): void {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const rmod = await import('../stores/runtime.ts')
  const state = rmod.runtimeAtom.get() as unknown as Record<string, unknown>

  // Post-reshape keys present
  assert("runtimeAtom has 'versions' key", 'versions' in state)
  assert("runtimeAtom has 'caps' key", 'caps' in state)

  // Legacy keys absent
  assert("runtimeAtom does NOT have 'svgoVersion'", !('svgoVersion' in state))
  assert("runtimeAtom does NOT have 'codecVersion'", !('codecVersion' in state))
  assert("runtimeAtom does NOT have 'wasmInfo'", !('wasmInfo' in state))

  // versions shape
  const versions = state.versions as {
    svgo: unknown
    jsquash: Record<string, unknown>
  }
  assert('versions.svgo is string', typeof versions.svgo === 'string')
  assert('versions.jsquash is object', typeof versions.jsquash === 'object' && versions.jsquash !== null)

  for (const codec of ['webp', 'jpeg', 'avif', 'oxipng', 'png', 'resize'] as const) {
    assert(
      `versions.jsquash.${codec} is string`,
      typeof versions.jsquash[codec] === 'string',
    )
  }

  // caps shape (5 fields per Plan 02 Caps interface)
  const caps = state.caps as {
    simd: unknown
    threads: unknown
    crossOriginIsolated: unknown
    hardwareConcurrency: unknown
    offlineReady: unknown
  }
  assert('caps.simd is boolean', typeof caps.simd === 'boolean')
  assert('caps.threads is boolean', typeof caps.threads === 'boolean')
  assert('caps.crossOriginIsolated is boolean', typeof caps.crossOriginIsolated === 'boolean')
  assert('caps.hardwareConcurrency is number', typeof caps.hardwareConcurrency === 'number')
  assert('caps.offlineReady is boolean', typeof caps.offlineReady === 'boolean')

  // Static-text contract: re-read the source and assert no legacy field
  // DECLARATIONS remain (allow legacy names inside comments documenting the
  // retirement). Catches the case where the dynamic import path can't resolve
  // but the file might still carry orphan field declarations.
  const fs = await import('node:fs')
  const src = fs.readFileSync(
    new URL('../stores/runtime.ts', import.meta.url),
    'utf-8',
  )
  // Strip line-comments + block-comments before scanning for field decls.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
  assert("runtime.ts has no 'svgoVersion' decl/ref outside comments", !stripped.includes('svgoVersion'))
  assert("runtime.ts has no 'codecVersion' decl/ref outside comments", !stripped.includes('codecVersion'))
  assert("runtime.ts has no 'wasmInfo' decl/ref outside comments", !stripped.includes('wasmInfo'))
  assert("runtime.ts source declares 'versions:'", src.includes('versions:'))
  assert("runtime.ts source declares 'caps:'", src.includes('caps:'))
  assert("runtime.ts source exports setCaps", /export\s+function\s+setCaps\b/.test(src))
} catch (err) {
  if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
    // Vite `@/` alias path — runtime.ts can't load under bare Node. Fall back to
    // a static-source check so the shape contract is still enforced.
    try {
      const fs = await import('node:fs')
      const src = fs.readFileSync(
        new URL('../stores/runtime.ts', import.meta.url),
        'utf-8',
      )
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '')
      assert("runtime.ts has no 'svgoVersion' decl/ref outside comments", !stripped.includes('svgoVersion'))
      assert("runtime.ts has no 'codecVersion' decl/ref outside comments", !stripped.includes('codecVersion'))
      assert("runtime.ts has no 'wasmInfo' decl/ref outside comments", !stripped.includes('wasmInfo'))
      assert("runtime.ts source declares 'versions:'", src.includes('versions:'))
      assert("runtime.ts source declares 'caps:'", src.includes('caps:'))
      assert("runtime.ts source exports setCaps", /export\s+function\s+setCaps\b/.test(src))
      console.log('Note: @/ alias unresolvable under Node — static-source contract applied.')
    } catch (fsErr) {
      failed++
      console.error('Unexpected error in static-source fallback:', fsErr)
    }
  } else {
    failed++
    console.error('Unexpected error in runtime-shape block:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
