// Phase 01 Plan 01 — Wave 0 Playwright smoke tests
// Run: npm test -- --project=chromium
import { test, expect } from '@playwright/test'

test('dark background applied (SETUP-01/02)', async ({ page }) => {
  await page.goto('/')
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-0').trim()
  )
  expect(bg).toBeTruthy()
  const hasDark = await page.locator('[role="application"]').evaluate(
    (el: Element) => el.classList.contains('dark')
  )
  expect(hasDark).toBe(true)
})

test('3 panes render (SHELL-01)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('files-pane')).toBeVisible()
  await expect(page.getByTestId('center-pane')).toBeVisible()
  await expect(page.getByTestId('inspector-pane')).toBeVisible()
})

test('viewport fills screen', async ({ page }) => {
  await page.goto('/')
  const app = page.locator('[role="application"]')
  const box = await app.boundingBox()
  expect(box?.width).toBeGreaterThan(0)
  expect(box?.height).toBeGreaterThan(0)
})
