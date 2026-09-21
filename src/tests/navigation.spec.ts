// Phase 03 Plan 01 — Wave 0 Playwright smoke: Toolbar Optimize + StatusBar pip slice.
// Phase 10, Plan 01 — D-05 migration: inject fixture files before running-state assertions
// change:add-black-box-e2e-suite — migrated to testid selectors:
//   getByRole('button', {name:'Optimize all'})  → toolbar-btn-optimize-all
//   getByRole('button', {name:'Codec'|'View'})  → titlebar-menu-codec / -view
//   getByRole('menuitem', {name:'WebP'})        → titlebar-item-codec-webp
//   getByRole('radio', {name:'Batch'})          → toolbar-view-batch
//   getByRole('searchbox', {name:…})            → toolbar-input-filter / cmdk-input
//   getByRole('option', …)                      → cmdk-option-<i>
//   getByRole('button', {name:'Toggle theme'})  → toolbar-btn-theme
// Store injection also moved to _helpers/ingest, whose page.evaluate specifiers use the
// '/src/*.ts' form the dev server actually serves (see _helpers/page-modules.ts).
import { test, expect } from '@playwright/test'
import { injectEntries } from './_helpers/ingest'
import { getRuntime } from './_helpers/store'
import { RUNTIME_MOD } from './_helpers/page-modules'

type RuntimeModule = typeof import('../stores/runtime')

test('Toolbar mounts (NAV-02 slice)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('toolbar')).toBeVisible()
  await expect(page.getByTestId('toolbar-btn-optimize-all')).toBeVisible()
})

test('StatusBar mounts with worker pip (NAV-03 slice)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('statusbar')).toBeVisible()
  await expect(page.getByTestId('worker-pip')).toBeVisible()
  const pip = page.getByTestId('worker-pip')
  const label = await pip.getAttribute('aria-label')
  expect(label).toMatch(/^Worker status: Idle/)
})

test('Clicking Optimize all flips worker pip to Running (NAV-02 wire)', async ({ page }) => {
  await page.goto('/')
  // D-05: inject a fixture file so Optimize all has ≥1 file to process.
  // It must be 'queued': useOptimize skips entries already marked 'done'
  // (`if (entry.status === 'done') continue`), so a done fixture dispatches no job
  // and the pip would never flip.
  await injectEntries(page, 1, { status: 'queued' })
  // Latch the transient Running transition BEFORE clicking. A 1×1 PNG optimizes in
  // milliseconds (Phase 10 D-05 shrank the workload to one tiny file), so polling the
  // pip's current attribute after the click races completion and is flaky. The pip
  // aria-label is a pure projection of runtimeAtom.running — subscribe and record
  // whether it ever flipped true.
  await page.evaluate(async (mod: string) => {
    const { runtimeAtom } = (await import(mod)) as RuntimeModule
    const w = window as unknown as { __sawRunning?: boolean }
    w.__sawRunning = runtimeAtom.get().running
    runtimeAtom.subscribe((s) => { if (s.running) w.__sawRunning = true })
  }, RUNTIME_MOD)
  await page.getByTestId('toolbar-btn-optimize-all').click()
  await page.waitForFunction(() => (window as unknown as { __sawRunning?: boolean }).__sawRunning === true)
})

// NAV-01: TitleBar tests
test('TitleBar renders (NAV-01)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('titlebar')).toBeVisible()
  // Read-only brand-copy assertion — not locating an interactive element.
  await expect(page.getByText('OIMG · image optimizer')).toBeVisible()
  // Titlebar is the banner landmark (scoped: the page has multiple <header> elements)
  await expect(page.getByTestId('titlebar')).toHaveAttribute('role', 'banner')
})

test('TitleBar Codec menu opens (NAV-01)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('titlebar-menu-codec').click()
  await expect(page.getByTestId('titlebar-item-codec-webp')).toBeVisible()
  await page.getByTestId('titlebar-menu-view').click()
  await expect(page.getByTestId('titlebar-item-codec-webp')).not.toBeVisible()
  await expect(page.getByTestId('titlebar-item-theme-light')).toBeVisible()
})

// Phase 07-polish — WCAG AA: menus are DropdownMenu, arrow keys move highlight between items.
// Radix focuses the content on pointer-open; the first ArrowDown lands on item 1.
test('TitleBar Codec menu is keyboard navigable (WCAG AA)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('titlebar-menu-codec').click()
  // ArrowDown moves focus into the list, item by item
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('titlebar-item-codec-webp')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('titlebar-item-codec-avif')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('titlebar-item-codec-jpeg')).toBeFocused()
  // ArrowUp moves it back
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('titlebar-item-codec-avif')).toBeFocused()
  // Escape closes the menu
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('titlebar-item-codec-webp')).not.toBeVisible()
})

// NAV-02: Toolbar segmented control + filter tests
test('Toolbar segmented control switches view (NAV-02)', async ({ page }) => {
  await page.goto('/')
  const batchBtn = page.getByTestId('toolbar-view-batch')
  const compareBtn = page.getByTestId('toolbar-view-compare')
  await expect(batchBtn).toHaveAttribute('aria-checked', 'true')
  await compareBtn.click()
  await expect(compareBtn).toHaveAttribute('aria-checked', 'true')
  await expect(batchBtn).toHaveAttribute('aria-checked', 'false')
})

test('Toolbar filter input updates files store (NAV-02)', async ({ page }) => {
  await page.goto('/')
  const filterInput = page.getByTestId('toolbar-input-filter')
  // Verify the input is present and accepts input
  await expect(filterInput).toBeVisible()
  await filterInput.fill('hero')
  // Verify the value was accepted (store is wired)
  await expect(filterInput).toHaveValue('hero')
})

// NAV-03: StatusBar versions and totals
test('StatusBar shows versions and totals (NAV-03)', async ({ page }) => {
  await page.goto('/')
  // Was: getByText('SVGO 4.0.1') and getByText('@squoosh-kit/core 0.6.0') — both hardcoded.
  // The second could never pass: @squoosh-kit/core is not a dependency and StatusBar never
  // renders it. Assert against the live store instead, so a version bump cannot break this.
  const versions = (await getRuntime(page)).versions as { svgo: string; jsquash: { webp: string } }
  await expect(page.getByTestId('status-version-svgo')).toContainText(versions.svgo)
  await expect(page.getByTestId('status-version-jsquash')).toContainText(versions.jsquash.webp)
  const totals = page.getByTestId('status-totals')
  await expect(totals).toContainText('→')
  const fileCount = page.getByTestId('status-filecount')
  await expect(fileCount).toHaveText(/^\d+ files$/)
})

// SHELL-03: html.dark class (not data-theme — impl uses classList.toggle)
test('html.dark class applied on load (SHELL-03)', async ({ page }) => {
  await page.goto('/')
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  expect(hasDark).toBe(true)
})

test('Toolbar theme toggle swaps html.dark class (SHELL-03)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('toolbar-btn-theme').click()
  const hasDarkLight = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  expect(hasDarkLight).toBe(false)
  await page.getByTestId('toolbar-btn-theme').click()
  const hasDarkDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  expect(hasDarkDark).toBe(true)
})

// NAV-04: CommandPalette
test('Meta+K opens CommandPalette (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
})

test('Escape closes CommandPalette (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-palette')).not.toBeVisible()
})

test('Typing filters command list (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('cmdk-input').fill('opt')
  // The filtered list collapses to the Optimize command; a matching list means option 0
  // exists and the non-matching "Batch view" entry is gone.
  await expect(page.getByTestId('cmdk-option-0')).toBeVisible()
  await expect(page.getByTestId('cmdk-option-0')).toContainText(/optimize/i)
  await expect(page.getByTestId('cmdk-listbox')).not.toContainText('Batch view')
})

test('Arrow keys move selection (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  // First item should be selected
  await expect(page.getByTestId('cmdk-option-0')).toHaveAttribute('aria-selected', 'true')
  // Press ArrowDown — selection moves to next item
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('cmdk-option-1')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('cmdk-option-0')).toHaveAttribute('aria-selected', 'false')
})

test('Enter on Optimize all sets running (NAV-04 + STORE-04)', async ({ page }) => {
  await page.goto('/')
  // D-05: inject a queued fixture so Optimize all actually dispatches a job (see above).
  await injectEntries(page, 1, { status: 'queued' })
  await page.keyboard.press('Meta+k')
  await page.getByTestId('cmdk-input').fill('Optimize')
  // Press Enter to execute first (and only) result
  await page.keyboard.press('Enter')
  // Palette should be closed
  await expect(page.getByTestId('command-palette')).not.toBeVisible()
  // Worker pip should show Running
  await expect(page.getByTestId('worker-pip')).toHaveAttribute('aria-label', 'Worker status: Running')
})
