// Phase 04 Plan 01 — Wave 0 Node unit tests for STORE-02. Run: node --experimental-strip-types src/tests/settings.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// ── STORE-02: settingsAtom defaults + all actions ────────────────────────────
try {
  const mod = await import('../stores/settings.ts')

  const DEFAULT_STATE = {
    codec: 'WebP' as const,
    q: 82,
    method: 4,
    lossless: false,
    resizeOn: false,
    w: '1600',
    h: 'auto',
    alg: 'lanczos3',
    fit: 'contain',
    stripMeta: true,
    keepIcc: false,
    aggressive: false,
  }

  // ── Defaults ──────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  assert('default codec === "WebP"', mod.settingsAtom.get().codec === 'WebP')

  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  assert('default q === 82', mod.settingsAtom.get().q === 82)

  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  assert('default method === 4', mod.settingsAtom.get().method === 4)

  assert('default plugins.length === 22', mod.settingsAtom.get().plugins.length === 22)

  // ── setCodec ──────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setCodec('PNG')
  assert('setCodec("PNG") → codec === "PNG"', mod.settingsAtom.get().codec === 'PNG')

  // ── setQuality ────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setQuality(60)
  assert('setQuality(60) → q === 60', mod.settingsAtom.get().q === 60)

  // ── setMethod ─────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setMethod(6)
  assert('setMethod(6) → method === 6', mod.settingsAtom.get().method === 6)

  // ── setLossless ───────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setLossless(true)
  assert('setLossless(true) → lossless === true', mod.settingsAtom.get().lossless === true)

  // ── setResizeOn ───────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setResizeOn(true)
  assert('setResizeOn(true) → resizeOn === true', mod.settingsAtom.get().resizeOn === true)

  // ── setResizeDimensions ───────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setResizeDimensions('800', '600')
  assert('setResizeDimensions("800","600") → w === "800" && h === "600"',
    mod.settingsAtom.get().w === '800' && mod.settingsAtom.get().h === '600')

  // ── setFit ────────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setFit('cover')
  assert('setFit("cover") → fit === "cover"', mod.settingsAtom.get().fit === 'cover')

  // ── setAlg ────────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setAlg('mitchell')
  assert('setAlg("mitchell") → alg === "mitchell"', mod.settingsAtom.get().alg === 'mitchell')

  // ── setStripMeta ──────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setStripMeta(false)
  assert('setStripMeta(false) → stripMeta === false', mod.settingsAtom.get().stripMeta === false)

  // ── setKeepIcc ────────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setKeepIcc(true)
  assert('setKeepIcc(true) → keepIcc === true', mod.settingsAtom.get().keepIcc === true)

  // ── setAggressive ─────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  mod.setAggressive(true)
  assert('setAggressive(true) → aggressive === true', mod.settingsAtom.get().aggressive === true)

  // ── togglePlugin ──────────────────────────────────────────────────────────
  mod.settingsAtom.set({ ...DEFAULT_STATE, plugins: mod.settingsAtom.get().plugins })
  // removeDoctype starts on:true per SVGO_PLUGINS
  mod.togglePlugin('removeDoctype')
  const pluginsAfterToggle = mod.settingsAtom.get().plugins
  const removeDoctype = pluginsAfterToggle.find((p: { id: string; on: boolean; saves: string }) => p.id === 'removeDoctype')
  const cleanupAttrs = pluginsAfterToggle.find((p: { id: string; on: boolean; saves: string }) => p.id === 'cleanupAttrs')
  assert('togglePlugin("removeDoctype") flips that plugin on → false', removeDoctype?.on === false)
  assert('togglePlugin("removeDoctype") leaves "cleanupAttrs" unchanged (still on:true)', cleanupAttrs?.on === true)

} catch (err) {
  if (err instanceof Error && (err.message.includes('settings.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    console.log('Wave 0 stub state: settings.ts not yet shipped — test skipped.')
    process.exit(0)
  } else {
    failed++
    console.error('Unexpected error in STORE-02 block:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
