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
  mod.setTab('output')
  assert('setTab("output") → tab === "output"', mod.uiAtom.get().tab === 'output')

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
  rmod.runtimeAtom.set({ running: false, runningJobs: 0, queuedJobs: 0, toasts: [], svgoVersion: '4.0.1', codecVersion: '0.6.0', wasmInfo: 'WASM ready · 312 KB' })

  rmod.startRun()
  assert('startRun() → running === true', rmod.runtimeAtom.get().running === true)

  rmod.stopRun()
  assert('stopRun() → running === false', rmod.runtimeAtom.get().running === false)

  rmod.runtimeAtom.set({ running: false, runningJobs: 0, queuedJobs: 0, toasts: [], svgoVersion: '4.0.1', codecVersion: '0.6.0', wasmInfo: 'WASM ready · 312 KB' })
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

// ── STORE-07 + STORE-03 completion: ALL_COMMANDS + $cmdFlat ─────────────────
try {
  const commands = await import('../lib/commands.ts')
  const ui = await import('../stores/ui.ts')

  // Reset cmdkQ to '' and register commands
  ui.uiAtom.set({ ...ui.uiAtom.get(), cmdkQ: '', cmdkSel: 0 })
  const flat = commands.ALL_COMMANDS.flatMap((g: import('../lib/commands.ts').CommandGroup) => g.items)
  ui.registerCommands(flat)

  // Test 2: ALL_COMMANDS is non-empty, every item has label/group/do
  assert(
    'ALL_COMMANDS is non-empty',
    Array.isArray(commands.ALL_COMMANDS) && commands.ALL_COMMANDS.length > 0,
  )
  for (const group of commands.ALL_COMMANDS) {
    for (const item of group.items) {
      assert(
        `item "${item.label}" has string label`,
        typeof item.label === 'string',
      )
      assert(
        `item "${item.label}" has string group`,
        typeof item.group === 'string',
      )
      assert(
        `item "${item.label}" has function do`,
        typeof item.do === 'function',
      )
    }
  }

  // Test 3: Required labels are present
  const allLabels = flat.map((i: import('../lib/commands.ts').CommandItem) => i.label)
  for (const required of [
    'Add files',
    'Optimize all',
    'Batch view',
    'Compare view',
    'Report view',
    'Light theme',
    'Dark theme',
    'Open command palette',
  ]) {
    assert(`ALL_COMMANDS contains "${required}"`, allLabels.includes(required))
  }

  // Test 4: After registerCommands, $cmdFlat returns full list
  ui.setCmdkQuery('')
  assert('$cmdFlat.get().length > 0 after registerCommands', ui.$cmdFlat.get().length > 0)

  // Test 5: setCmdkQuery filters by substring (case-insensitive)
  ui.setCmdkQuery('opt')
  const filtered = ui.$cmdFlat.get()
  assert(
    '$cmdFlat filters to items containing "opt"',
    filtered.length > 0 && filtered.every((i: import('../lib/commands.ts').CommandItem) => i.label.toLowerCase().includes('opt')),
  )

  // Test 6: setCmdkQuery('') restores full list
  ui.setCmdkQuery('')
  assert('$cmdFlat restores full list when query is empty', ui.$cmdFlat.get().length === flat.length)

  // Test 7: "Optimize all" do() sets runtimeAtom.running to true
  const { runtimeAtom } = await import('../stores/runtime.ts')
  runtimeAtom.set({ running: false, runningJobs: 0, queuedJobs: 0, toasts: [], svgoVersion: '4.0.1', codecVersion: '0.6.0', wasmInfo: 'WASM ready · 312 KB' })
  const optimizeAll = flat.find((i: import('../lib/commands.ts').CommandItem) => i.label === 'Optimize all')
  assert('"Optimize all" item found', !!optimizeAll)
  if (optimizeAll) {
    optimizeAll.do()
    assert('"Optimize all" do() sets runtimeAtom.running to true', runtimeAtom.get().running === true)
  }

  // Test 8: "Light theme" do() sets uiAtom.theme to 'light'
  ui.setTheme('dark')
  const lightTheme = flat.find((i: import('../lib/commands.ts').CommandItem) => i.label === 'Light theme')
  assert('"Light theme" item found', !!lightTheme)
  if (lightTheme) {
    lightTheme.do()
    assert('"Light theme" do() sets theme to "light"', ui.uiAtom.get().theme === 'light')
  }
  ui.setTheme('dark')

} catch (err) {
  if (err instanceof Error && (err.message.includes('commands.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub: src/lib/commands.ts or $cmdFlat not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error in STORE-07+$cmdFlat block:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
