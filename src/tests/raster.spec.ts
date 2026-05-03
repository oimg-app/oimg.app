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
  // Plan 04-05 — addSourceWithVariants fans out N FileEntries with shared
  // sourceFamilyId, density-suffixed names, and a positive byteEstimate per variant.
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    await (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files
      .getState()
      .addSourceWithVariants({
        sourceBlob: blob,
        sourceDensity: '2x',
        name: 'logo.png',
        format: 'png',
        targets: ['1x', '2x', '3x'],
      })
  }, { bytes: pngBytes })
  const result = await page.evaluate(() => {
    const byId = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files
      .getState().byId
    const entries = Object.values(byId) as Array<{
      name: string
      sourceFamilyId?: string
      targetDensity?: string
      sourceDensity?: string
      byteEstimate?: number
      id: string
    }>
    return {
      names: entries.map((f) => f.name).sort(),
      familyIds: [...new Set(entries.map((f) => f.sourceFamilyId))],
      targetDensities: entries.map((f) => f.targetDensity).sort(),
      allHavePositiveEstimate: entries.every(
        (f) => typeof f.byteEstimate === 'number' && f.byteEstimate > 0,
      ),
      ids: entries.map((f) => f.id).sort(),
    }
  })
  expect(result.names).toEqual(['logo@1x.png', 'logo@2x.png', 'logo@3x.png'])
  expect(result.familyIds).toHaveLength(1) // all variants share one sourceFamilyId
  expect(result.targetDensities).toEqual(['1x', '2x', '3x'])
  expect(result.allHavePositiveEstimate).toBe(true)
  // Variant ids are `${sourceUuid}-${density}` — three entries, three suffixes.
  const suffixes = result.ids.map((id) => id.slice(-2)).sort()
  expect(suffixes).toEqual(['1x', '2x', '3x'])
})

test('removeFamily cascades through removeFile preserving URL revoke', async ({ page }) => {
  const pngBytes = await loadFixture('density-2x.png')
  const after = await page.evaluate(async ({ bytes }) => {
    const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    await stores.files.getState().addSourceWithVariants({
      sourceBlob: blob,
      sourceDensity: '2x',
      name: 'family-test.png',
      format: 'png',
      targets: ['1x', '2x', '3x'],
    })
    const familyId = (Object.values(stores.files.getState().byId) as Array<any>)[0]
      .sourceFamilyId
    // Seed urlCache for one variant to verify revoke discipline (D-10/PATTERNS Pitfall 3).
    const ids = Object.keys(stores.files.getState().byId)
    stores.runtime.getState().getOrCreateObjectURL(ids[0], blob)
    const beforeUrlCount = stores.runtime.getState().urlCache.size
    stores.files.getState().removeFamily(familyId)
    return {
      remainingOrder: stores.files.getState().order.length,
      remainingByIdKeys: Object.keys(stores.files.getState().byId).length,
      urlCountBefore: beforeUrlCount,
      urlCountAfter: stores.runtime.getState().urlCache.size,
    }
  }, { bytes: pngBytes })
  expect(after.remainingOrder).toBe(0)
  expect(after.remainingByIdKeys).toBe(0)
  expect(after.urlCountBefore).toBe(1)
  expect(after.urlCountAfter).toBe(0)
})

test('settings resize slice — defaults lanczos3 + setResize partial merge', async ({ page }) => {
  // Plan 04-05 Task 2 — live store contract for the new resize slice
  // (D-05 + D-06). DEFAULT_RESIZE_SETTINGS exported by Plan 04-01; this test
  // gates the actual useSettingsStore wiring.
  const result = await page.evaluate(() => {
    const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
    const s = stores.settings.getState()
    const initialAlg = s.resize?.alg
    s.setResize({ alg: 'mitchell' })
    const afterSet = stores.settings.getState().resize?.alg
    s.setResize({})
    const afterNoop = stores.settings.getState().resize?.alg
    // global.preserveIccProfile must be untouched by resize-slice mutations.
    const iccPreserved = stores.settings.getState().global?.preserveIccProfile
    return { initialAlg, afterSet, afterNoop, iccPreserved }
  })
  expect(result.initialAlg).toBe('lanczos3')
  expect(result.afterSet).toBe('mitchell')
  expect(result.afterNoop).toBe('mitchell')
  expect(result.iccPreserved).toBe(false)
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

test('collision rename — duplicate @Nx names auto-suffix (2)', async ({ page }) => {
  // Plan 04-05 — addSourceWithVariants applies applyDensitySuffix FIRST, then
  // deduplicateName against the existing FileEntry name set. Collisions are
  // reported via useRuntimeStore.markRename(N) for the D-13 / D-16 toast latch.
  const pngBytes = await loadFixture('density-2x.png')
  const result = await page.evaluate(async ({ bytes }) => {
    const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    // First drop seeds @1x/@2x/@3x.
    await stores.files.getState().addSourceWithVariants({
      sourceBlob: blob,
      sourceDensity: '2x',
      name: 'logo.png',
      format: 'png',
      targets: ['1x', '2x', '3x'],
    })
    // Reset rename counter (the runtime store may have prior batch state).
    stores.runtime.setState({ renameCountThisBatch: 0 })
    // Second drop with identical name — every variant collides.
    await stores.files.getState().addSourceWithVariants({
      sourceBlob: blob,
      sourceDensity: '2x',
      name: 'logo.png',
      format: 'png',
      targets: ['1x', '2x', '3x'],
    })
    const allNames = (
      Object.values(stores.files.getState().byId) as Array<{ name: string }>
    )
      .map((f) => f.name)
      .sort()
    return {
      names: allNames,
      renameCount: stores.runtime.getState().renameCountThisBatch,
    }
  }, { bytes: pngBytes })
  expect(result.names).toEqual([
    'logo (2)@1x.png',
    'logo (2)@2x.png',
    'logo (2)@3x.png',
    'logo@1x.png',
    'logo@2x.png',
    'logo@3x.png',
  ])
  expect(result.renameCount).toBe(3)
})

test('metadata strip — output bytes contain no iCCP chunk by default', async ({ page: _page }) => {
  test.fail(true, 'Wave 2 flips this — png-adapter must round-trip without ICC')
  expect(true).toBe(false)
})
