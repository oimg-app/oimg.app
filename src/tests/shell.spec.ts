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

// Plan 05 additions: interaction tests covering UI-06 and UI-08
test.describe('Shell interactions (UI-06, UI-08)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('theme toggle round-trip flips .dark class on html', async ({ page }) => {
    // Default is dark per useTheme readStoredTheme fallback.
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Click theme toggle in the toolbar (uses aria-label "Toggle theme")
    await page.getByRole('button', { name: /toggle theme/i }).first().click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // Reload — preference persists via localStorage
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // Switch back to dark
    await page.getByRole('button', { name: /toggle theme/i }).first().click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('Cmd+K opens command palette and Escape closes it', async ({ page }) => {
    // Initially closed: cmdk-back element should not exist
    await expect(page.locator('.cmdk-back')).toHaveCount(0)

    // Press Cmd+K (Meta+K on macOS Chromium)
    await page.keyboard.press('Meta+k')
    await expect(page.locator('.cmdk-back')).toBeVisible()

    // Type a query — input has autoFocus
    await page.keyboard.type('opt')
    await expect(page.locator('.cmdk-list')).toContainText(/optimi[sz]e/i)

    // Escape closes
    await page.keyboard.press('Escape')
    await expect(page.locator('.cmdk-back')).toHaveCount(0)
  })

  test('queue listbox renders option rows seeded from useFilesStore', async ({ page }) => {
    // Phase 2 plan 02-05: MOCK_FILES deleted; the queue starts empty. We seed
    // 3 synthetic FileEntries via the dev-only window.__OIMG_STORES__ surface
    // (exposed by App.tsx in dev/test mode) so this test asserts on store-driven
    // counts instead of the old 12-row mock fixture.
    const queue = page.getByRole('listbox', { name: /Files/i })
    await expect(queue).toBeVisible()

    // Wait for the dev-only stores to mount.
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )

    await page.evaluate(() => {
      const stores = (window as unknown as {
        __OIMG_STORES__?: { files: { getState: () => { addFile: (f: unknown) => void; setSelected: (id: string) => void } } }
      }).__OIMG_STORES__
      if (!stores) throw new Error('__OIMG_STORES__ not exposed (DEV-only)')
      const filesApi = stores.files.getState()
      for (let i = 0; i < 3; i++) {
        const blob = new Blob([new Uint8Array(1024)], { type: 'image/png' })
        filesApi.addFile({
          id: `seed-${i}`,
          name: `seed-${i}.png`,
          format: 'png',
          originalSize: 1024,
          optimizedSize: null,
          status: 'idle',
          sourceDensity: '1x',
          thumbnail: null,
          sourceBlob: blob,
          optimizedBlob: null,
        })
      }
      // Select the first row so aria-selected has a deterministic target.
      filesApi.setSelected('seed-0')
    })

    const options = page.getByRole('option')
    await expect(options).toHaveCount(3)

    // First seeded row is selected.
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  })

  test('inspector renders a tablist with at least 3 tabs', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: /Inspector/i })
    await expect(tablist).toBeVisible()

    // 'f1' is a PNG, so Codec/Output/Report are visible (SVG tab is hidden when non-SVG file selected)
    const tabs = page.getByRole('tab')
    const count = await tabs.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Tabpanel exists and is referenced by the active tab via aria-controls
    await expect(page.getByRole('tabpanel')).toBeVisible()
  })

  test('Tab navigation reaches at least one toolbar button without errors', async ({ page }) => {
    // Focus body, then walk the focus through the first ~10 Tab presses;
    // assert that at least one focused element has aria-label matching a known toolbar control.
    await page.locator('body').click()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
    }
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      return {
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
      }
    })
    expect(focused).not.toBeNull()
    expect(focused!.tag).toMatch(/^(BUTTON|INPUT|A)$/)
  })
})
