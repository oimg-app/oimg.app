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
