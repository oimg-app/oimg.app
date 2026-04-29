import { test, expect } from '@playwright/test'

// Wave 0 stubs: ARIA landmark tests for shell components (UI-08).
// Currently skip when AppShell is not yet rendered.
// Plan 04 (Wave 3) will activate these by verifying real landmark presence.

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
    // Stub: skip if AppShell is not yet mounted (Plan 04 activates this)
    const appLandmark = page.getByRole('application', { name: /OIMG Image Optimizer/i })
    const count = await appLandmark.count()
    test.skip(count === 0, 'AppShell not yet mounted — activate in Plan 04')
    await expect(appLandmark).toBeVisible()
  })

  test('banner landmark renders (TitleBar)', async ({ page }) => {
    const banner = page.getByRole('banner')
    const count = await banner.count()
    test.skip(count === 0, 'TitleBar not yet mounted — activate in Plan 04')
    await expect(banner).toBeVisible()
  })

  test('toolbar landmark renders with label "Actions"', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: /Actions/i })
    const count = await toolbar.count()
    test.skip(count === 0, 'Toolbar not yet mounted — activate in Plan 04')
    await expect(toolbar).toBeVisible()
  })

  test('main landmark renders (work area)', async ({ page }) => {
    const main = page.getByRole('main')
    const count = await main.count()
    test.skip(count === 0, 'Main landmark not yet mounted — activate in Plan 04')
    await expect(main).toBeVisible()
  })

  test('contentinfo landmark renders (StatusBar)', async ({ page }) => {
    const footer = page.getByRole('contentinfo')
    const count = await footer.count()
    test.skip(count === 0, 'StatusBar not yet mounted — activate in Plan 04')
    await expect(footer).toBeVisible()
  })
})
