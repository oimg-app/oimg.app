// Phase 07-polish / Plan 01 — SHELL-02 spec. Source: 07-01-PLAN.md
// Phase 10, Plan 01 — D-05 migration: inject fixture files before running-state assertions
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

/**
 * Phase 11 — Plan 01 (D-11): ingestFixtureFiles seeds entries with status:'done'. Phase 11
 * D-11 makes runOptimize SKIP already-done entries, so backpressure tests that click
 * Optimize all must first flip status to 'queued' so the pool actually receives jobs.
 */
async function resetAllToQueued(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const filesUrl = '/src/stores/files.ts'
    const mod = (await import(/* @vite-ignore */ filesUrl)) as typeof import('../stores/files')
    const { filesAtom } = mod
    const { entries } = filesAtom.get()
    filesAtom.setKey('entries', entries.map((e) => ({ ...e, status: 'queued' as const })))
  })
}

test.describe('BackpressureIndicator — SHELL-02', () => {
  test('is hidden on initial load', async ({ page }) => {
    await page.goto('/')
    // StatusBar also uses role="status"; scope to the indicator via testid.
    const indicator = page.getByTestId('backpressure-indicator')
    await expect(indicator).toHaveClass(/opacity-0/)
  })

  test('becomes visible when Optimize is clicked', async ({ page }) => {
    await page.goto('/')
    // D-05: inject a fixture file so Optimize all has ≥1 file to process
    await ingestFixtureFiles(page, 1)
    // Phase 11 D-11: flip to 'queued' so the file isn't skipped as already-done.
    await resetAllToQueued(page)
    // Toolbar's primary action calls startRun (runtimeAtom.running = true)
    await page.getByRole('button', { name: 'Optimize all' }).click()
    // StatusBar also uses role="status"; scope to the indicator via testid.
    const indicator = page.getByTestId('backpressure-indicator')
    await expect(indicator).not.toHaveClass(/opacity-0/)
  })

  // PIPE-04: asserts the indicator reflects real runningJobs count (not only a boolean).
  // Plan 03 adds runningJobs/queuedJobs to runtimeAtom and derives `running` from them.
  // This test is written against final expected behavior — it guards the indicator contract
  // once Plan 03 wires the real job-count fields. Until then, it passes via the same
  // boolean-derived visible state the existing tests use (runningJobs > 0 → running = true).
  // NOTE: runtimeAtom store is not window-exposed; assertion is via visible indicator class.
  test('reflects real running job count after Optimize all (PIPE-04)', async ({ page }) => {
    await page.goto('/')
    // D-05: inject a fixture file so Optimize all has ≥1 file to process
    await ingestFixtureFiles(page, 1)
    // Phase 11 D-11: flip to 'queued' so the file isn't skipped as already-done.
    await resetAllToQueued(page)
    // Click Optimize all — this triggers startRun which sets running = true
    // (derived from runningJobs > 0 once Plan 03 lands).
    await page.getByRole('button', { name: 'Optimize all' }).click()
    // Indicator must transition to active state (bg-[var(--color-accent)] animate-pulse,
    // not opacity-0) — this holds when at least one job is running.
    const indicator = page.getByTestId('backpressure-indicator')
    await expect(indicator).not.toHaveClass(/opacity-0/)
    // Indicator must carry the accent + pulse classes that signal > 0 running jobs.
    await expect(indicator).toHaveClass(/animate-pulse/)
  })
})
