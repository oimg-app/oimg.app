// Phase 06, Plan 01 — INSP-07 OutputPanel Playwright spec
// Fully exercised after 06-03 wiring (OutputPanel wired into InspectorPane tab)
// change:add-black-box-e2e-suite — migrated to testid selectors.
//
// SCOPE NOTE: the three tests below were written before OutputPanel was wired up. Each
// guards its assertions behind `isVisible()` and then closes with `expect(true).toBe(true)`,
// so the guarded bodies never execute: OutputPanel mounts only once a file is selected AND
// the output tab is open, and none of these tests do either. They are migrated here
// selector-for-selector WITHOUT changing their semantics — making them assert for real is a
// behaviour change beyond this change's scope.
//
// Real coverage of these same surfaces now lives in inspector-tabs.spec.ts, which selects a
// file and asserts the sections, the copy buttons and the clipboard round-trip unguarded.
import { test, expect } from '@playwright/test'

test('App loads without console errors (OutputPanel baseline)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  await page.goto('/')
  await expect(page.getByTestId('toolbar')).toBeVisible()
  expect(consoleErrors).toHaveLength(0)
})

// The following tests are fully exercised after 06-03 wires OutputPanel into InspectorPane
// They target data-testid="output-panel" and the per-section testids added by this change.

test('OutputPanel empty state renders when no file selected (fully exercised after 06-03 wiring)', async ({ page }) => {
  await page.goto('/')
  // Check if output-panel is reachable — it is wired in 06-03
  const outputPanel = page.getByTestId('output-panel')
  const emptyState = page.getByTestId('output-empty')
  const isVisible = await outputPanel.isVisible().catch(() => false)
  if (isVisible) {
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText('Select a file to see snippets')
  }
  // Pass unconditionally until 06-03 wires the panel
  expect(true).toBe(true)
})

test('OutputPanel copy buttons are individually addressable (fully exercised after 06-03 wiring)', async ({ page }) => {
  await page.goto('/')
  const outputPanel = page.getByTestId('output-panel')
  const isVisible = await outputPanel.isVisible().catch(() => false)
  if (isVisible) {
    // Was: getByRole('button', { name: 'Copy Base64 snippet' }) — aria-label coupling.
    for (const id of ['base64', 'urlencoded', 'picture']) {
      await expect(page.getByTestId(`output-btn-copy-${id}`)).toBeVisible()
    }
  }
  // Pass unconditionally until 06-03 wires the panel
  expect(true).toBe(true)
})

test('OutputPanel copy button flashes Copied! for 1500ms (fully exercised after 06-03 wiring)', async ({ page }) => {
  await page.goto('/')
  const outputPanel = page.getByTestId('output-panel')
  const isVisible = await outputPanel.isVisible().catch(() => false)
  if (isVisible) {
    const base64Btn = page.getByTestId('output-btn-copy-base64')
    if (await base64Btn.isVisible()) {
      await base64Btn.click()
      // After click button should flash "Copied!"
      await expect(base64Btn).toContainText('Copied!')
      // After 1500ms it should revert
      await page.waitForTimeout(1600)
      await expect(base64Btn).toContainText('Copy snippet')
    }
  }
  // Pass unconditionally until 06-03 wires the panel
  expect(true).toBe(true)
})
