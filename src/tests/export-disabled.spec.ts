// Phase 11 — Plan 07 (D-13): Export disable-then-explain.
// Five tests covering:
//   1. Initial empty state — All as ZIP disabled + aria-disabled + title.
//   2. Queued-only state — still disabled (status='queued' ≠ 'done').
//   3. First-done state — All as ZIP enabled (no disabled, no title).
//   4. Save individually parallels #3.
//   5. Inspector Download hidden when selected file is not done (Plan 04 conditional render).
//
// Helpers:
//   - ingestFixtureFiles seeds entries with status:'done' for code that needs ≥1 ready
//     entry. To produce a 'queued' state (Tests 2 + 5) we override status post-ingest
//     via page.evaluate, analog to `resetAllToQueued` in backpressure.spec.ts.
// Test discipline: latches use waitForFunction (deterministic state checks per MEMORY).
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

/**
 * Flip every entry in filesAtom to status='queued'.
 * Used to simulate "ingested but not yet optimized" — $hasDone must be false.
 */
async function resetAllToQueued(page: Page): Promise<void> {
  await page.evaluate(async () => {
    
    const mod = (await import('../stores/files'))
    const { filesAtom } = mod
    const { entries } = filesAtom.get()
    filesAtom.setKey('entries', entries.map((e) => ({ ...e, status: 'queued' as const })))
  })
}

/**
 * Latch on $hasDone via store snapshot — deterministic and faster than waiting on
 * a DOM mutation. Returns once the predicate matches or times out.
 */
async function waitForHasDone(page: Page, expected: boolean): Promise<void> {
  await page.waitForFunction(
    async (want) => {
      
      const mod = (await import('../stores/files'))
      return mod.filesAtom.get().entries.some((e) => e.status === 'done') === want
    },
    expected,
  )
}

test.describe('D-13 — Export disable-then-explain', () => {
  test('Toolbar Export button is disabled on initial empty load', async ({ page }) => {
    await page.goto('/')
    const exportBtn = page.getByRole('button', { name: /^Export$/ })
    await expect(exportBtn).toBeDisabled()
    await expect(exportBtn).toHaveAttribute('aria-disabled', 'true')
    await expect(exportBtn).toHaveAttribute('title', /Optimize at least one file first/)
  })

  test('Toolbar Export button stays disabled when files are queued (not done)', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await resetAllToQueued(page)
    await waitForHasDone(page, false)
    const exportBtn = page.getByRole('button', { name: /^Export$/ })
    await expect(exportBtn).toBeDisabled()
    await expect(exportBtn).toHaveAttribute('aria-disabled', 'true')
    await expect(exportBtn).toHaveAttribute('title', /Optimize at least one file first/)
  })

  test('Toolbar Export button enables when ≥1 file has status=done', async ({ page }) => {
    await page.goto('/')
    // ingestFixtureFiles seeds with status='done' — $hasDone flips to true immediately.
    await ingestFixtureFiles(page, 1)
    await waitForHasDone(page, true)
    const exportBtn = page.getByRole('button', { name: /^Export$/ })
    await expect(exportBtn).not.toBeDisabled()
    await expect(exportBtn).not.toHaveAttribute('aria-disabled', 'true')
    // title is set to undefined when enabled → attribute absent.
    await expect(exportBtn).not.toHaveAttribute('title', /Optimize at least one file first/)
  })

  test('Toolbar "Save individually" menu item gates on $hasDone (disabled → enabled)', async ({ page }) => {
    await page.goto('/')
    // First: queued-only — assert disabled.
    await ingestFixtureFiles(page, 1)
    await resetAllToQueued(page)
    await waitForHasDone(page, false)
    // Open the Export Popover by clicking the caret button.
    await page.getByRole('button', { name: 'Export options' }).click()
    const saveItem = page.getByRole('button', { name: 'Save individually' })
    await expect(saveItem).toBeVisible()
    await expect(saveItem).toBeDisabled()
    await expect(saveItem).toHaveAttribute('aria-disabled', 'true')
    await expect(saveItem).toHaveAttribute('title', /Optimize at least one file first/)
    // Close popover by pressing Escape, then flip entry to done.
    await page.keyboard.press('Escape')
    await page.evaluate(async () => {
      
      const mod = (await import('../stores/files'))
      const { filesAtom } = mod
      const { entries } = filesAtom.get()
      filesAtom.setKey('entries', entries.map((e) => ({ ...e, status: 'done' as const })))
    })
    await waitForHasDone(page, true)
    await page.getByRole('button', { name: 'Export options' }).click()
    const saveItemEnabled = page.getByRole('button', { name: 'Save individually' })
    await expect(saveItemEnabled).not.toBeDisabled()
    await expect(saveItemEnabled).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('Inspector Download is invisible when selected file is not done (Plan 04 render gate)', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 1)
    await resetAllToQueued(page)
    await waitForHasDone(page, false)
    // Select the row (already selected by ingestFixtureFiles, but click is idempotent).
    await page.getByTestId('files-pane').getByText('fixture-0.png').click()
    // Open report tab where the Download button lives (per Plan 04).
    await page.getByRole('button', { name: 'report' }).click()
    // Plan 04 conditional render: not visible because status !== 'done'.
    await expect(page.getByRole('button', { name: 'Download optimized file' })).not.toBeVisible()
  })
})
