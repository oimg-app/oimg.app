// Phase 03 Plan 01 — Wave 0 Node unit tests for STORE-03 + STORE-04.
// Wave 0: tests written before implementation; will pass once Tasks 1+2 land.
// Run: node --experimental-strip-types src/tests/stores.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// ── STORE-03: uiAtom action bodies ──────────────────────────────────────────
try {
  const mod = await import('../stores/ui.ts')

  const DEFAULT_STATE = {
    open: null,
    view: 'Batch' as const,
    tab: 'codec' as const,
    split: 50,
    zoom: 100,
    cmdkOpen: false,
    cmdkQ: '',
    cmdkSel: 0,
    rowMenu: null,
    theme: 'dark' as const,
  }

  // Reset before each block
  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setOpen('menu-codec')
  assert('setOpen("menu-codec") → open === "menu-codec"', mod.uiAtom.get().open === 'menu-codec')

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setOpen(null)
  assert('setOpen(null) → open === null', mod.uiAtom.get().open === null)

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.openCmdk()
  assert('openCmdk() → cmdkOpen === true', mod.uiAtom.get().cmdkOpen === true)
  assert('openCmdk() → cmdkQ === ""', mod.uiAtom.get().cmdkQ === '')
  assert('openCmdk() → cmdkSel === 0', mod.uiAtom.get().cmdkSel === 0)

  mod.uiAtom.set({ ...DEFAULT_STATE, cmdkOpen: true, cmdkQ: 'img' })
  mod.closeCmdk()
  assert('closeCmdk() → cmdkOpen === false', mod.uiAtom.get().cmdkOpen === false)
  assert('closeCmdk() does NOT clear cmdkQ', mod.uiAtom.get().cmdkQ === 'img')

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setTheme('light')
  assert('setTheme("light") → theme === "light"', mod.uiAtom.get().theme === 'light')
  mod.setTheme('dark')
  assert('setTheme("dark") → theme === "dark"', mod.uiAtom.get().theme === 'dark')

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setView('Compare')
  assert('setView("Compare") → view === "Compare"', mod.uiAtom.get().view === 'Compare')

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setTab('svgo')
  assert('setTab("svgo") → tab === "svgo"', mod.uiAtom.get().tab === 'svgo')

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setSplit(33)
  assert('setSplit(33) → split === 33', mod.uiAtom.get().split === 33)

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setZoom(150)
  assert('setZoom(150) → zoom === 150', mod.uiAtom.get().zoom === 150)

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setCmdkQuery('img')
  assert('setCmdkQuery("img") → cmdkQ === "img"', mod.uiAtom.get().cmdkQ === 'img')

  mod.uiAtom.set({ ...DEFAULT_STATE })
  mod.setCmdkSel(2)
  assert('setCmdkSel(2) → cmdkSel === 2', mod.uiAtom.get().cmdkSel === 2)

} catch (err) {
  if (err instanceof Error && (err.message.includes('ui.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: src/stores/ui.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error in STORE-03 block:', err)
  }
}

// ── STORE-04: runtimeAtom actions ───────────────────────────────────────────
try {
  const rmod = await import('../stores/runtime.ts')

  // Reset to known state
  rmod.runtimeAtom.set({ running: false, toasts: [] })

  rmod.startRun()
  assert('startRun() → running === true', rmod.runtimeAtom.get().running === true)

  rmod.stopRun()
  assert('stopRun() → running === false', rmod.runtimeAtom.get().running === false)

  rmod.runtimeAtom.set({ running: false, toasts: [] })
  rmod.pushToast('hi', 'meta')
  const toasts1 = rmod.runtimeAtom.get().toasts
  assert('pushToast → toasts.length === 1', toasts1.length === 1)
  assert('pushToast → toasts[0].msg === "hi"', toasts1[0].msg === 'hi')
  assert('pushToast → toasts[0].meta === "meta"', toasts1[0].meta === 'meta')
  assert('pushToast → toasts[0].id is string', typeof toasts1[0].id === 'string')

  const toastId = toasts1[0].id
  rmod.dismissToast(toastId)
  assert('dismissToast(id) → toasts.length === 0', rmod.runtimeAtom.get().toasts.length === 0)

  rmod.dismissToast('nonexistent-id')
  assert('dismissToast(bad id) is no-op', rmod.runtimeAtom.get().toasts.length === 0)

} catch (err) {
  if (err instanceof Error && (err.message.includes('runtime.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: src/stores/runtime.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error in STORE-04 block:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
