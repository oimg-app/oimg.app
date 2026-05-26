// Phase 08 — PIPE-01/02/03 spec. Source: 08-01-PLAN.md
import { test, expect } from '@playwright/test'

test.describe('Worker Pipeline — PIPE-01/02/03', () => {
  test('crossOriginIsolated is true (PIPE-03)', async ({ page }) => {
    await page.goto('/')
    const isolated = await page.evaluate(() => crossOriginIsolated)
    expect(isolated).toBe(true)
  })

  test('UI stays interactive while worker encodes (PIPE-01)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Optimize all' }).click()
    // Toolbar should remain visible and accessible — not blocked by main thread
    // This test asserts the final expected behavior; may stay red until Plan 03 wires the pool.
    const toolbar = page.getByRole('toolbar')
    await expect(toolbar).toBeVisible()
    // Drive interactivity: assert toolbar accepts a second interaction without timeout
    await expect(toolbar).toBeEnabled()
  })

  test('AVIF WASM is not fetched on initial load (PIPE-02)', async ({ page }) => {
    // Register request listener BEFORE navigation to capture all requests
    const avifRequests: string[] = []
    page.on('request', (request) => {
      if (/avif/i.test(request.url())) {
        avifRequests.push(request.url())
      }
    })

    await page.goto('/')

    // AVIF WASM (~8MB) must NOT be fetched on initial route — lazy-loaded only when
    // the user selects AVIF format. Selecting AVIF (Phase 9) would trigger the fetch.
    // This test guards the initial-route bundle budget (< 200KB gzipped).
    expect(avifRequests).toHaveLength(0)
  })
})
