// Phase 11 — Plan 02: OPT-02 SC-1 — StatusBar aggregate X/Y counter advances mid-batch
// and announces politely. Analog: src/tests/batch-progress.spec.ts (Optimize-all click +
// ingestFixtureFiles + resetAllToQueued helper to avoid D-11 skip).
//
// Fixtures inject status:'done' for chrome correctness; tests flip them to 'queued' via
// page.evaluate before clicking Optimize all, so the pool actually has work.
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

/** Reset every entry in filesAtom to status:'queued' so runOptimize will dispatch them. */
async function resetAllToQueued(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    // Absolute /src/... path per MEMORY note; computed specifier so TS skips static
    // resolution (the dev-server URL contract isn't known to the bundler resolver).
    const filesUrl = '/src/stores/files.ts'
    const mod = (await import(/* @vite-ignore */ filesUrl)) as typeof import('../stores/files')
    const { filesAtom } = mod
    const { entries } = filesAtom.get()
    filesAtom.setKey(
      'entries',
      entries.map((e) => ({ ...e, status: 'queued' as const })),
    )
  })
}

test.describe('OPT-02 — Aggregate Counter', () => {
  test('counter carries polite aria-live + aria-atomic attributes (WCAG-AA)', async ({ page }) => {
    await page.goto('/')
    // One file is enough to make the counter render a non-empty string.
    await ingestFixtureFiles(page, 1)
    const counter = page.getByTestId('agg-counter')
    await expect(counter).toHaveAttribute('aria-live', 'polite')
    await expect(counter).toHaveAttribute('aria-atomic', 'true')
    await expect(counter).toHaveAttribute('role', 'status')
  })

  test('counter advances mid-batch and lands on N/N optimized (D-01)', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 6)
    await resetAllToQueued(page)

    // Sanity: pre-click, counter reads 0/6 optimized (none done after reset-to-queued).
    await expect(page.getByTestId('agg-counter')).toHaveText('0/6 optimized')

    await page.getByRole('button', { name: 'Optimize all' }).click()

    // Mid-batch latch — proves the counter passes through an intermediate value during
    // the batch. If streaming write-back (Plan 01 D-03) regressed back to allSettled,
    // every entry would flip 0→6 in one terminal frame and this would time out.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="agg-counter"]')
        if (!el) return false
        const m = (el.textContent ?? '').match(/^(\d+)\/6 optimized$/)
        if (!m) return false
        const k = Number.parseInt(m[1]!, 10)
        return k > 0 && k < 6
      },
      undefined,
      { timeout: 10_000 },
    )

    // Final landing state — every file done.
    await expect(page.getByTestId('agg-counter')).toHaveText('6/6 optimized', { timeout: 30_000 })
  })

  test('empty state renders empty string — no 0/0 optimized clutter', async ({ page }) => {
    await page.goto('/')
    // No ingestFixtureFiles call — app boots with entries: [] per D-04 (Phase 10 Plan 02).
    await expect(page.getByTestId('agg-counter')).toHaveText('')
  })
})
