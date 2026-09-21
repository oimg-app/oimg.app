// Phase 06, Plan 03 — INSP-07 + INSP-08 end-to-end: Output + Report tabs wired
// into InspectorPane. Exercises the full vertical slice: file select → tab click → panel render.
// Phase 10, Plan 01 — D-05 migration: replaced hero-banner@2x.png selectors with ingestFixtureFiles
// change:add-black-box-e2e-suite — migrated to testid selectors + _helpers/. Same assertions;
// only the addressing changed: getByRole('button', { name: 'output' }) → inspector-tab-output,
// aria-label copy buttons → output-btn-copy-<id>, filename text click → selectRowById.
import { test, expect } from '@playwright/test'
import { injectEntries } from './_helpers/ingest'
import { selectRowById } from './_helpers/select'
import { openInspectorTab } from './_helpers/inspector'
import { grantClipboard, readClipboard } from './_helpers/clipboard'

test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
})

/** Boots the app with one injected entry selected. Returns its id. */
async function bootWithOneFile(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/')
  const [id] = await injectEntries(page, 1)
  await selectRowById(page, id)
  return id
}

test.describe('Output tab — OutputPanel wired into InspectorPane', () => {
  test('Output tab renders output-panel after selecting a file', async ({ page }) => {
    await bootWithOneFile(page)
    await openInspectorTab(page, 'output')

    await expect(page.getByTestId('output-panel')).toBeVisible()
  })

  test('Output tab shows three snippet sections with copy buttons', async ({ page }) => {
    await bootWithOneFile(page)
    await openInspectorTab(page, 'output')

    await expect(page.getByTestId('output-panel')).toBeVisible()

    // All three sections and their copy buttons, addressed by section id rather than label.
    for (const id of ['base64', 'urlencoded', 'picture']) {
      await expect(page.getByTestId(`output-section-${id}`)).toBeVisible()
      await expect(page.getByTestId(`output-btn-copy-${id}`)).toBeVisible()
    }
  })

  test('Copy Base64 snippet button flashes "Copied!" then reverts', async ({ page, context }) => {
    await grantClipboard(context)
    await bootWithOneFile(page)
    await openInspectorTab(page, 'output')

    const copyBtn = page.getByTestId('output-btn-copy-base64')
    await expect(copyBtn).toBeVisible()

    await copyBtn.click()

    // Button should flash "Copied!" — a label assertion on an already-testid-located
    // element, which the testing spec permits.
    await expect(copyBtn).toContainText('Copied!')

    // After 1600ms it should revert to original label
    await page.waitForTimeout(1600)
    await expect(copyBtn).toContainText('Copy snippet')
  })

  test('Clipboard receives real snippet text after copy', async ({ page, context }) => {
    await grantClipboard(context)
    await bootWithOneFile(page)
    await openInspectorTab(page, 'output')

    const copyBtn = page.getByTestId('output-btn-copy-base64')
    await copyBtn.click()

    // Wait for copy to complete
    await expect(copyBtn).toContainText('Copied!')

    const clipText = await readClipboard(page)
    expect(clipText.length).toBeGreaterThan(10)
  })
})

test.describe('Report tab — ReportPanel wired into InspectorPane', () => {
  test('Report tab renders report-panel after selecting a file', async ({ page }) => {
    await bootWithOneFile(page)
    await openInspectorTab(page, 'report')

    await expect(page.getByTestId('report-panel')).toBeVisible()
  })

  test('Report panel shows at least one savings bar', async ({ page }) => {
    await bootWithOneFile(page)
    await openInspectorTab(page, 'report')

    await expect(page.getByTestId('report-panel')).toBeVisible()

    // At least one bar from the per-file bar chart
    const bars = page.getByTestId('report-bar')
    await expect(bars.first()).toBeVisible()
    expect(await bars.count()).toBeGreaterThanOrEqual(1)
  })

  test('Report panel shows at least one format-row', async ({ page }) => {
    await bootWithOneFile(page)
    await openInspectorTab(page, 'report')

    await expect(page.getByTestId('report-panel')).toBeVisible()

    const formatRows = page.getByTestId('format-row')
    await expect(formatRows.first()).toBeVisible()
    expect(await formatRows.count()).toBeGreaterThanOrEqual(1)
  })

  test('Report panel shows Total savings section with stat cells', async ({ page }) => {
    await bootWithOneFile(page)
    await openInspectorTab(page, 'report')

    await expect(page.getByTestId('report-panel')).toBeVisible()

    // The four stat values, addressed directly instead of matching their heading text.
    for (const cell of ['before', 'after', 'saved', 'files']) {
      await expect(page.getByTestId(`report-savings-${cell}`)).toBeVisible()
    }
  })
})

test('Placeholder divs are gone — InspectorPane no longer shows "coming in Phase 6"', async ({ page }) => {
  await bootWithOneFile(page)

  // Check output tab
  await openInspectorTab(page, 'output')
  // Read-only negative assertion on absent copy — no interactive element is being located,
  // so getByText is permitted here by the testing spec.
  await expect(page.getByText('coming in Phase 6')).not.toBeVisible()

  // Check report tab
  await openInspectorTab(page, 'report')
  await expect(page.getByText('coming in Phase 6')).not.toBeVisible()
})
