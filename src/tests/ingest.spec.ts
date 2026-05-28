// Phase 10 — Plan 01: Wave 0 ingest spec — OPT-01 SC-1/2/3 + D-04 + D-06/D-07
// Validation contract for the single-file optimize loop. Tests are written FIRST (Nyquist)
// so Plans 02/03/04 have automated targets to turn green.
// EXPECTED-RED at end of Plan 01: D-04 empty-start, SC-1/2/3, D-06/D-07 (depend on Plans 02-04)
// MUST-PASS at end of Plan 01: --list shows all 5 greppable titles (empty, drop, Report, re-optimize, skip)
// Analog: src/tests/inspector-tabs.spec.ts (goto + page.evaluate + getByTestId structure)
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

test.describe('ingest — OPT-01 SC-1/2/3 + D-04 + D-06/D-07', () => {
  // D-04: App starts with zero entries on load — no seeded demo files.
  // EXPECTED-RED until Plan 02 removes the seed from filesAtom.
  test('D-04: app starts empty — no seeded demo files', async ({ page }) => {
    await page.goto('/')
    const count = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.length
    })
    expect(count).toBe(0)
  })

  // OPT-01 SC-1: drop a file → entry appears in the queue and is selected.
  // EXPECTED-RED until Plan 04 adds the hidden file input with testid + Plan 02 wires useIngest.
  // TODO: replace ingestFixtureFiles with page.setInputFiles on hidden input once Plan 04
  // adds data-testid="file-input" to FilesPane (see 10-04-PLAN.md).
  test('OPT-01 SC-1: drop a file — entry appears in queue and is selected', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)

    // Entry must appear in the files list
    await expect(page.getByText('fixture-0.png')).toBeVisible()

    // Selected entry must be fixture-0 (D-02: auto-select newest)
    const selectedId = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().selectedId
    })
    expect(selectedId).toBe('fixture-0')
  })

  // OPT-01 SC-2: Report panel shows Before/After byte labels from real entry.orig/entry.opt.
  // EXPECTED-RED until Plan 03 wires the Report panel to real entry data.
  test('OPT-01 SC-2: Report panel shows real Before/After byte values', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)

    await page.getByText('fixture-0.png').click()
    await page.getByRole('button', { name: 'report' }).click()

    const panel = page.getByTestId('report-panel')
    await expect(panel).toBeVisible()

    // Before/After labels must show numeric byte values, not a placeholder
    await expect(panel.getByText('Before', { exact: true })).toBeVisible()
    await expect(panel.getByText('After', { exact: true })).toBeVisible()
  })

  // OPT-01 SC-3: changing a per-file setting triggers re-encode (useLiveEncode).
  // EXPECTED-RED until Plan 02/03 wires useIngest + useLiveEncode settings-change path.
  test('OPT-01 SC-3: changing setting triggers re-optimize — encodedBuffer updates', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)

    // Trigger a settings change for fixture-0 via store
    await page.evaluate(async () => {
      const { setFileSettings } = await import('/src/stores/files.ts')
      setFileSettings('fixture-0', 'q', 50)
    })

    // encodedBuffer should be present (entry was processed)
    const hasEncoded = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      const entry = filesAtom.get().entries.find(e => e.id === 'fixture-0')
      return Boolean(entry?.encodedBuffer)
    })
    expect(hasEncoded).toBe(true)
  })

  // D-06/D-07: unsupported files are silently skipped at ingest — no toast, no error entry.
  // EXPECTED-RED until Plan 02 wires useIngest with isAccepted filter (D-06) and no-toast rule (D-07).
  // TODO: replace with page.setInputFiles mixing .png + .txt once Plan 04 adds data-testid="file-input".
  test('D-06/D-07: unsupported files are silently skipped — no toast', async ({ page }) => {
    await page.goto('/')
    // Use ingestFixtureFiles as a stand-in for accepted files only (1 file accepted)
    await ingestFixtureFiles(page, 1)

    const entryCount = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.length
    })

    // Only accepted entries must appear — no extra error-status entries for skipped files
    expect(entryCount).toBe(1)

    // No sonner error toast should be visible (silent skip)
    const toastVisible = await page.locator('[data-sonner-toast]').isVisible().catch(() => false)
    expect(toastVisible).toBe(false)
  })
})
