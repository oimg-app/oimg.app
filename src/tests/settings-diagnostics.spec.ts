// Phase 13 — DIA-04 / D-10 / D-11 / D-12: Settings Tabs + Diagnostics tab + Copy via chokepoint.
// Four tests:
//   1. D-10: Tabs render with General + Diagnostics triggers (default = General).
//   2. D-11: Diagnostics tab shows the <dl> with svgo + jsquash webp + caps rows.
//   3. D-15 chokepoint: Copy diagnostics writes JSON.stringify({versions, caps}) via the
//      Phase 12 copyToClipboard chokepoint (captured by installClipboardMocks 'native' mode).
//   4. Plan 05 regression: General tab is the default and Clear all + Workers stay reachable
//      through the new Tabs composition.
//
// Analog 1: src/tests/toolbar-snippets.spec.ts (Phase 12 chokepoint capture pattern).
// Analog 2: src/tests/filespane-clear.spec.ts (Plan 05 Settings popover open + Clear all click).
import { test, expect } from '@playwright/test'
import { installClipboardMocks } from './setup/clipboard-mocks'

test.describe('Settings — Tabs + Diagnostics (D-10/D-11/D-12)', () => {
  test('D-10: Settings popover renders General + Diagnostics tab triggers', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open settings' }).click()

    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Diagnostics' })).toBeVisible()
  })

  test('D-11: Diagnostics tab shows <dl> with svgo + jsquash + caps rows', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('tab', { name: 'Diagnostics' }).click()

    // Spot-check representative <dt> labels — verifies <dl> renders + atom subscribed.
    await expect(page.getByText('svgo', { exact: true })).toBeVisible()
    await expect(page.getByText('jsquash webp', { exact: true })).toBeVisible()
    await expect(page.getByText('jsquash jpeg', { exact: true })).toBeVisible()
    await expect(page.getByText('jsquash avif', { exact: true })).toBeVisible()
    await expect(page.getByText('jsquash oxipng', { exact: true })).toBeVisible()
    await expect(page.getByText('SIMD', { exact: true })).toBeVisible()
    await expect(page.getByText('WASM threads', { exact: true })).toBeVisible()
    await expect(page.getByText('COOP/COEP', { exact: true })).toBeVisible()
    await expect(page.getByText('CPUs', { exact: true })).toBeVisible()
  })

  test('D-15: Copy diagnostics writes valid JSON via Phase 12 chokepoint', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('tab', { name: 'Diagnostics' }).click()
    await page.getByRole('button', { name: 'Copy diagnostics' }).click()

    // Phase 12 chokepoint contract: toast appended ' copied' to the label.
    await expect(page.getByText('Diagnostics copied')).toBeVisible()

    // D-15 chokepoint capture — exactly one write recorded.
    await page.waitForFunction(
      () =>
        (window as unknown as { __clipboardWrites?: string[] })
          .__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () =>
        (window as unknown as { __clipboardWrites: string[] })
          .__clipboardWrites[0],
    )

    // Validate manifest shape — proves the click serialized {versions, caps} pretty-printed JSON.
    const parsed = JSON.parse(text) as {
      versions: { svgo: string; jsquash: { webp: string } }
      caps: { simd: boolean; hardwareConcurrency: number }
    }
    expect(typeof parsed.versions.svgo).toBe('string')
    expect(typeof parsed.versions.jsquash.webp).toBe('string')
    expect(typeof parsed.caps.simd).toBe('boolean')
    expect(typeof parsed.caps.hardwareConcurrency).toBe('number')
    // Pretty-printed: 2-space indent => '\n  ' substring present.
    expect(text).toContain('\n  ')
  })

  test('Plan 05 regression: General tab is default + Clear all / Workers preserved', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open settings' }).click()

    // Radix Tabs marks the active trigger via data-state=active; aria-selected mirrors it.
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // Plan 05 buttons must remain visible through the Tabs wrapping.
    await expect(page.getByRole('button', { name: /^Clear all$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Workers/ })).toBeVisible()
  })
})
