// Phase 03 Plan 01 — Wave 0 Playwright smoke: Toolbar Optimize + StatusBar pip slice.
import { test, expect } from '@playwright/test'

test('Toolbar mounts (NAV-02 slice)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('toolbar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Optimize all' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Optimize all' }).click()
  const pip = page.getByTestId('worker-pip')
  await expect(pip).toHaveAttribute('aria-label', 'Worker status: Running')
})

// NAV-01: TitleBar tests
test('TitleBar renders (NAV-01)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('titlebar')).toBeVisible()
  await expect(page.getByText('OIMG · image optimizer')).toBeVisible()
  await expect(page.getByRole('banner')).toBeVisible()
})

test('TitleBar Codec menu opens (NAV-01)', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Codec' }).click()
  await expect(page.getByRole('button', { name: 'WebP' })).toBeVisible()
  await page.getByRole('button', { name: 'View' }).click()
  await expect(page.getByRole('button', { name: 'WebP' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Light theme' })).toBeVisible()
})

// NAV-02: Toolbar segmented control + filter tests
test('Toolbar segmented control switches view (NAV-02)', async ({ page }) => {
  await page.goto('/')
  const batchBtn = page.getByRole('radio', { name: 'Batch' })
  const compareBtn = page.getByRole('radio', { name: 'Compare' })
  await expect(batchBtn).toHaveAttribute('aria-checked', 'true')
  await compareBtn.click()
  await expect(compareBtn).toHaveAttribute('aria-checked', 'true')
  await expect(batchBtn).toHaveAttribute('aria-checked', 'false')
})

test('Toolbar filter input updates files store (NAV-02)', async ({ page }) => {
  await page.goto('/')
  const filterInput = page.getByRole('searchbox', { name: 'Filter files' })
  // Verify the input is present and accepts input
  await expect(filterInput).toBeVisible()
  await filterInput.fill('hero')
  // Verify the value was accepted (store is wired)
  await expect(filterInput).toHaveValue('hero')
})

// NAV-03: StatusBar versions and totals
test('StatusBar shows versions and totals (NAV-03)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('SVGO 4.0.1')).toBeVisible()
  await expect(page.getByText('@squoosh-kit/core 0.6.0')).toBeVisible()
  const totals = page.getByTestId('status-totals')
  await expect(totals).toContainText('→')
  const fileCount = page.getByTestId('status-filecount')
  await expect(fileCount).toHaveText(/^\d+ files$/)
})

// SHELL-03: html data-theme attribute
test('html data-theme attribute set (SHELL-03)', async ({ page }) => {
  await page.goto('/')
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  expect(theme).toBe('dark')
})

test('Toolbar theme toggle swaps html data-theme (SHELL-03)', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  const themeLight = await page.evaluate(() => document.documentElement.dataset.theme)
  expect(themeLight).toBe('light')
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  const themeDark = await page.evaluate(() => document.documentElement.dataset.theme)
  expect(themeDark).toBe('dark')
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
  await page.getByRole('searchbox', { name: 'Search commands' }).fill('opt')
  // Optimize all should be visible
  await expect(page.getByRole('option', { name: /optimize/i })).toBeVisible()
  // Batch view should NOT be visible
  await expect(page.getByRole('option', { name: 'Batch view' })).not.toBeVisible()
})

test('Arrow keys move selection (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  // First item should be selected
  const firstOption = page.locator('[role="option"][aria-selected="true"]')
  await expect(firstOption).toBeVisible()
  // Press ArrowDown — selection moves to next item
  await page.keyboard.press('ArrowDown')
  const selected = page.locator('[role="option"][aria-selected="true"]')
  const selectedId = await selected.getAttribute('id')
  expect(selectedId).toBe('cmd-item-1')
})

test('Enter on Optimize all sets running (NAV-04 + STORE-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await page.getByRole('searchbox', { name: 'Search commands' }).fill('Optimize')
  // Press Enter to execute first (and only) result
  await page.keyboard.press('Enter')
  // Palette should be closed
  await expect(page.getByTestId('command-palette')).not.toBeVisible()
  // Worker pip should show Running
  await expect(page.getByTestId('worker-pip')).toHaveAttribute('aria-label', 'Worker status: Running')
})
