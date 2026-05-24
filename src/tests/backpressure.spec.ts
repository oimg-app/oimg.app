// Phase 07-polish / Plan 01 — SHELL-02 spec. Source: 07-01-PLAN.md
import { test, expect } from '@playwright/test'

test.describe('BackpressureIndicator — SHELL-02', () => {
  test('is hidden on initial load', async ({ page }) => {
    await page.goto('/')
    // StatusBar also uses role="status"; scope to the indicator via testid.
    const indicator = page.getByTestId('backpressure-indicator')
    await expect(indicator).toHaveClass(/opacity-0/)
  })

  test('becomes visible when Optimize is clicked', async ({ page }) => {
    await page.goto('/')
    // Toolbar's primary action calls startRun (runtimeAtom.running = true)
    await page.getByRole('button', { name: 'Optimize all' }).click()
    // StatusBar also uses role="status"; scope to the indicator via testid.
    const indicator = page.getByTestId('backpressure-indicator')
    await expect(indicator).not.toHaveClass(/opacity-0/)
  })
})
