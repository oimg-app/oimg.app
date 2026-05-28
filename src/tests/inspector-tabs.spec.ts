// Phase 06, Plan 03 — INSP-07 + INSP-08 end-to-end: Output + Report tabs wired
// into InspectorPane. Exercises the full vertical slice: file select → tab click → panel render.
// Phase 10, Plan 01 — D-05 migration: replaced hero-banner@2x.png selectors with ingestFixtureFiles
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
})

test.describe('Output tab — OutputPanel wired into InspectorPane', () => {
  test('Output tab renders output-panel after selecting a file', async ({ page }) => {
    await page.goto('/')

    // D-05: inject fixture files instead of relying on seeded demo list
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()

    // Click the Output tab button
    await page.getByRole('button', { name: 'output' }).click()

    // OutputPanel should be visible
    await expect(page.getByTestId('output-panel')).toBeVisible()
  })

  test('Output tab shows three snippet sections with copy buttons', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'output' }).click()

    await expect(page.getByTestId('output-panel')).toBeVisible()

    // All three copy buttons should be present
    await expect(page.getByRole('button', { name: 'Copy Base64 snippet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy URL-encoded snippet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy picture snippet' })).toBeVisible()
  })

  test('Copy Base64 snippet button flashes "Copied!" then reverts', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'output' }).click()

    const copyBtn = page.getByRole('button', { name: 'Copy Base64 snippet' })
    await expect(copyBtn).toBeVisible()

    await copyBtn.click()

    // Button should flash "Copied!"
    await expect(copyBtn).toContainText('Copied!')

    // After 1600ms it should revert to original label
    await page.waitForTimeout(1600)
    await expect(copyBtn).toContainText('Copy snippet')
  })

  test('Clipboard receives real snippet text after copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'output' }).click()

    const copyBtn = page.getByRole('button', { name: 'Copy Base64 snippet' })
    await copyBtn.click()

    // Wait for copy to complete
    await expect(copyBtn).toContainText('Copied!')

    const clipText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipText.length).toBeGreaterThan(10)
  })
})

test.describe('Report tab — ReportPanel wired into InspectorPane', () => {
  test('Report tab renders report-panel after selecting a file', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'report' }).click()

    await expect(page.getByTestId('report-panel')).toBeVisible()
  })

  test('Report panel shows at least one savings bar', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'report' }).click()

    await expect(page.getByTestId('report-panel')).toBeVisible()

    // At least one bar from the per-file bar chart
    const bars = page.getByTestId('report-bar')
    await expect(bars.first()).toBeVisible()
    expect(await bars.count()).toBeGreaterThanOrEqual(1)
  })

  test('Report panel shows at least one format-row', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'report' }).click()

    await expect(page.getByTestId('report-panel')).toBeVisible()

    const formatRows = page.getByTestId('format-row')
    await expect(formatRows.first()).toBeVisible()
    expect(await formatRows.count()).toBeGreaterThanOrEqual(1)
  })

  test('Report panel shows Total savings section with stat cells', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'report' }).click()

    await expect(page.getByTestId('report-panel')).toBeVisible()

    // Stats grid labels should be visible (exact match to avoid ambiguity with format-row counts)
    const panel = page.getByTestId('report-panel')
    await expect(panel.getByText('Before', { exact: true })).toBeVisible()
    await expect(panel.getByText('After', { exact: true })).toBeVisible()
    await expect(panel.getByText('Saved', { exact: true })).toBeVisible()
    await expect(panel.getByText('Files', { exact: true })).toBeVisible()
  })
})

test('Placeholder divs are gone — InspectorPane no longer shows "coming in Phase 6"', async ({ page }) => {
  await page.goto('/')
  await ingestFixtureFiles(page, 1)
  await page.getByTestId('files-pane').getByText('fixture-0.png').click()

  // Check output tab
  await page.getByRole('button', { name: 'output' }).click()
  await expect(page.getByText('coming in Phase 6')).not.toBeVisible()

  // Check report tab
  await page.getByRole('button', { name: 'report' }).click()
  await expect(page.getByText('coming in Phase 6')).not.toBeVisible()
})
