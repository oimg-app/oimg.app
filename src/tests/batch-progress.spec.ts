// Phase 11 — Plan 01: OPT-02 SC-1 — per-row status flips queued → processing → done LIVE
// during a batch (D-03 streaming write-back), and D-11 already-`done` files are skipped on
// re-Optimize. Analog: src/tests/backpressure.spec.ts (Optimize-all click + ingestFixtureFiles).
//
// The fixture helper injects entries with status:'done' (so the FileRow chrome looks right
// out of the box); these tests flip them to 'queued' via page.evaluate before clicking
// Optimize all, so runOptimize actually has work to dispatch.
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

/** Reset every entry in filesAtom to status:'queued' so runOptimize will dispatch them. */
async function resetAllToQueued(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    // Absolute /src/... path per MEMORY note; computed specifier so TS skips static
    // resolution (the dev-server URL contract isn't known to the bundler resolver).
    
    const mod = (await import('../stores/files'))
    const { filesAtom } = mod
    const { entries } = filesAtom.get()
    filesAtom.setKey(
      'entries',
      entries.map((e) => ({ ...e, status: 'queued' as const })),
    )
  })
}

test.describe('OPT-02 — Batch Progress', () => {
  test('per-row status flips queued → processing → done live (D-03)', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 10)
    await resetAllToQueued(page)

    // Sanity: all 10 rows start in 'queued'.
    await expect(page.locator('[aria-label="Status: queued"]')).toHaveCount(10)

    await page.getByRole('button', { name: 'Optimize all' }).click()

    // Mid-batch latch: BOTH conditions must hold in one tick — at least one row is
    // 'processing' AND at least one row is still 'queued'. If the OLD allSettled
    // behavior is in place, this will NEVER hold (every row goes queued → done in
    // one terminal frame), and the waitForFunction will time out.
    await page.waitForFunction(
      () => {
        const processing = document.querySelectorAll('[aria-label="Status: processing"]').length
        const queued = document.querySelectorAll('[aria-label="Status: queued"]').length
        return processing >= 1 && queued >= 1
      },
      undefined,
      { timeout: 10_000 },
    )

    // Eventually every row converges to 'done'.
    await expect(page.locator('[aria-label="Status: done"]')).toHaveCount(10, { timeout: 30_000 })
  })

  test('D-11: already-done files are skipped on re-Optimize all', async ({ page }) => {
    await page.goto('/')
    // ingestFixtureFiles injects entries already in 'done' state — perfect for D-11.
    await ingestFixtureFiles(page, 10)
    await expect(page.locator('[aria-label="Status: done"]')).toHaveCount(10)

    await page.getByRole('button', { name: 'Optimize all' }).click()

    // Brief settle then assert: no row flips to 'processing'. D-11 means runOptimize
    // skips every entry where status === 'done', so the pool is never dispatched to.
    await page.waitForTimeout(500)
    await expect(page.locator('[aria-label="Status: processing"]')).toHaveCount(0)
    // And the 'done' count is unchanged — still 10.
    await expect(page.locator('[aria-label="Status: done"]')).toHaveCount(10)
  })

  test('aggregate done count rises while queue is still nonempty (D-03)', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 10)
    await resetAllToQueued(page)

    // Pre-flight: nothing is 'done' yet.
    await expect(page.locator('[aria-label="Status: done"]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Optimize all' }).click()

    // Mid-batch latch: done count rising (≥ 3) AND at least one row not yet 'done'
    // (still queued or processing). Proves the per-promise streaming write-back —
    // the OLD allSettled behavior would flip everything to 'done' in one terminal
    // frame with no rising-while-pending overlap.
    await page.waitForFunction(
      () => {
        const done = document.querySelectorAll('[aria-label="Status: done"]').length
        const pending =
          document.querySelectorAll('[aria-label="Status: queued"]').length +
          document.querySelectorAll('[aria-label="Status: processing"]').length
        return done >= 3 && pending >= 1
      },
      undefined,
      { timeout: 10_000 },
    )

    // Sanity: the batch eventually finishes.
    await expect(page.locator('[aria-label="Status: done"]')).toHaveCount(10, { timeout: 30_000 })
  })
})
