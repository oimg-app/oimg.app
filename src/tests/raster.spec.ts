import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Phase 4 plan 04-01 Wave 0 — failing-stub spec covering SC-1 / SC-2 / SC-3 /
// SC-4, the throttle toast (D-13), the raster perf budget (D-15), and the
// collision-rename behavior (D-16). Each test is marked test.fail() with a
// comment naming the later wave / plan that flips it green.
//
// Pattern is the established Phase 2 + Phase 3 store-driven E2E shape:
// goto('/') → wait for window.__OIMG_STORES__ → drive the store directly.

const FIXTURE_DIR = 'src/tests/fixtures'

async function loadFixture(name: string): Promise<number[]> {
  const buf = await readFile(join(FIXTURE_DIR, name))
  return Array.from(new Uint8Array(buf))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
})

test('density variants — source 2x emits @1x/@2x/@3x FileEntries', async ({ page }) => {
  test.fail(true, 'Wave 2/3 flips this — addSourceWithVariants + png-adapter not yet shipped')
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    ;(window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files
      .getState()
      .addSourceWithVariants({
        sourceBlob: blob,
        sourceDensity: '2x',
        name: 'logo.png',
        format: 'png',
        targets: ['1x', '2x', '3x'],
      })
  }, { bytes: pngBytes })
  const names = await page.evaluate(() =>
    Object.values(
      (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files.getState().byId,
    ).map((f: any) => f.name).sort(),
  )
  expect(names).toEqual(['logo@1x.png', 'logo@2x.png', 'logo@3x.png'])
})

test('memory budget — 50 PNG @ 2x stays under 800 MB peak heap', async ({ page: _page }) => {
  test.fail(true, 'Wave 2 flips this — admission gate + CDP heap probe wiring required')
  // Real implementation will use src/tests/instrument-heap.ts probeHeapDuringBatch.
  expect(true).toBe(false)
})

test('no url leaks — 20-file batch revokes every createObjectURL', async ({ page: _page }) => {
  test.fail(true, 'Wave 3 flips this — uses existing src/tests/fixtures/instrument-blob-urls.js')
  expect(true).toBe(false)
})

test('throttle toast — first admission-gate trigger fires once per batch', async ({ page: _page }) => {
  test.fail(true, 'Wave 2 flips this — pool onThrottle + runtime store flag required')
  expect(true).toBe(false)
})

test('perf budget — decode+resize+encode on 2 MB PNG p50 ≤ 500 ms', async ({ page: _page }) => {
  test.fail(true, 'Wave 2 flips this — D-15 raster perf budget (RESEARCH §4)')
  expect(true).toBe(false)
})

test('collision rename — duplicate @Nx names auto-suffix (2)', async ({ page: _page }) => {
  test.fail(true, 'Wave 2 flips this — deduplicateName + addSourceWithVariants required')
  expect(true).toBe(false)
})

test('metadata strip — output bytes contain no iCCP chunk by default', async ({ page: _page }) => {
  test.fail(true, 'Wave 2 flips this — png-adapter must round-trip without ICC')
  expect(true).toBe(false)
})
