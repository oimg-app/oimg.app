import { test, expect } from '@playwright/test'

// UI-08: ARIA landmark tests for the shell components.
// Activated in Plan 01-04: AppShell + TitleBar + Toolbar + StatusBar are now mounted.

test.describe('Shell ARIA landmarks (UI-08)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    // Allow crossOriginIsolated warning from Plan 01 — it is a console.error, not a crash
    const hardErrors = errors.filter((e) => !e.includes('crossOriginIsolated'))
    expect(hardErrors).toHaveLength(0)
  })

  test('application landmark renders with correct label', async ({ page }) => {
    await expect(page.getByRole('application', { name: /OIMG Image Optimizer/i })).toBeVisible()
  })

  test('banner landmark renders (TitleBar)', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible()
  })

  test('toolbar landmark renders with label "Actions"', async ({ page }) => {
    await expect(page.getByRole('toolbar', { name: /Actions/i })).toBeVisible()
  })

  test('main landmark renders (work area)', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('contentinfo landmark renders (StatusBar)', async ({ page }) => {
    await expect(page.getByRole('contentinfo')).toBeVisible()
  })
})
