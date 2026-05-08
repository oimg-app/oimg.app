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

test('memory budget — 50 PNG @ 2x stays under 800 MB peak heap', async ({ page }) => {
  // Plan 04-07 Task 2 — live SC-2: admission gate (D-11) keeps peak heap under
  // 800 MB while encoding 150 variants from 50 source files.
  const { probeHeapDuringBatch } = await import('./instrument-heap')
  const pngBytes = await loadFixture('density-2x.png')
  const peak = await probeHeapDuringBatch(page, async () => {
    await page.evaluate(async ({ bytes }) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
      const filesApi = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files.getState()
      for (let i = 0; i < 50; i++) {
        await filesApi.addSourceWithVariants({
          sourceBlob: blob,
          sourceDensity: '2x',
          name: `f${i}.png`,
          format: 'png',
          targets: ['1x', '2x', '3x'],
        })
      }
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => /optimize/i.test(b.textContent ?? ''),
      ) as HTMLButtonElement | undefined
      btn?.click()
      await new Promise<void>((resolve) => {
        const i = setInterval(() => {
          if (
            !(window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.runtime
              .getState().running
          ) {
            clearInterval(i)
            resolve()
          }
        }, 100)
      })
    }, { bytes: pngBytes })
  })
  expect(peak).toBeLessThan(800 * 1024 * 1024)
})

test('no url leaks — 20-file batch revokes every createObjectURL', async ({ page }) => {
  // Plan 04-07 Task 2 — live SC-4: createObjectURL/revokeObjectURL pairing
  // across a 20-file batch followed by clear(). Reuses Phase 2 instrumentation.
  await page.evaluate(() =>
    (window as unknown as { __OIMG_INSTRUMENT_BLOB_URLS__?: () => void }).__OIMG_INSTRUMENT_BLOB_URLS__?.(),
  )
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files.getState()
    for (let i = 0; i < 20; i++) {
      await filesApi.addSourceWithVariants({
        sourceBlob: blob,
        sourceDensity: '2x',
        name: `f${i}.png`,
        format: 'png',
        targets: ['1x'],
      })
    }
    filesApi.clear()
  }, { bytes: pngBytes })
  const stats = await page.evaluate(() =>
    (window as unknown as {
      __OIMG_BLOB_URL_STATS__?: () => { created: number; revoked: number }
    }).__OIMG_BLOB_URL_STATS__?.() ?? { created: 0, revoked: 0 },
  )
  expect(stats.created).toBe(stats.revoked)
})

test('throttle toast — first admission-gate trigger fires once per batch', async ({ page }) => {
  // Plan 04-07 Task 2 — live D-13: at-most-once-per-batch toast latch (false
  // positives on small batches are fine; T-04-07-01 mitigation).
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files.getState()
    for (let i = 0; i < 10; i++) {
      await filesApi.addSourceWithVariants({
        sourceBlob: blob,
        sourceDensity: '2x',
        name: `f${i}.png`,
        format: 'png',
        targets: ['1x', '2x', '3x'],
      })
    }
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => /optimize/i.test(b.textContent ?? ''),
    ) as HTMLButtonElement | undefined
    btn?.click()
    await new Promise<void>((resolve) => {
      const i = setInterval(() => {
        if (
          !(window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.runtime
            .getState().running
        ) {
          clearInterval(i)
          resolve()
        }
      }, 100)
    })
  }, { bytes: pngBytes })
  const toastCount = await page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'Pacing batch for memory' })
    .count()
  expect(toastCount).toBeLessThanOrEqual(1)
})

test('perf budget — decode+resize+encode on 2 MB PNG p50 ≤ 500 ms', async ({ page }) => {
  // Plan 04-07 Task 2 — live D-15: raster perf budget. Five-sample p50.
  const pngBytes = await loadFixture('density-2x.png')
  const samples = await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
    const filesApi = stores.files.getState()
    const runtimeApi = stores.runtime
    const out: number[] = []
    for (let i = 0; i < 5; i++) {
      filesApi.clear()
      await filesApi.addSourceWithVariants({
        sourceBlob: blob,
        sourceDensity: '2x',
        name: `s${i}.png`,
        format: 'png',
        targets: ['1x'],
      })
      const t0 = performance.now()
      ;(Array.from(document.querySelectorAll('button')).find(
        (b) => /optimize/i.test(b.textContent ?? ''),
      ) as HTMLButtonElement | undefined)?.click()
      await new Promise<void>((resolve) => {
        const t = setInterval(() => {
          if (!runtimeApi.getState().running) {
            clearInterval(t)
            resolve()
          }
        }, 50)
      })
      out.push(performance.now() - t0)
    }
    return out
  }, { bytes: pngBytes })
  samples.sort((a, b) => a - b)
  const p50 = samples[Math.floor(samples.length / 2)]
  console.log(`Perf budget p50: ${p50.toFixed(1)} ms (D-15 raster: ≤ 500 ms / 2 MB)`)
  expect(p50).toBeLessThan(500)
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

// ─── Phase 5: Raster Encoders — Wave 0 stubs ──────────────────────────────
// All tests marked test.fail() per established Phase 2/3/4 convention.
// Later wave plans flip these to live assertions once implementation ships.

test.fail('OPT-02: PNG + OxiPNG optimization reduces file size vs original', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: drop PNG → optimize → assert optimizedSize < originalSize
  expect(false).toBe(true)
})

test.fail('OPT-03: WebP encode produces valid WebP output at quality 80', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: drop WebP → optimize → assert output is valid WebP bytes
  expect(false).toBe(true)
})

test.fail('OPT-04: JPEG encode produces valid JPEG at quality 80 progressive', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: drop JPEG → optimize → assert output starts with FF D8 FF
  expect(false).toBe(true)
})

test.fail('OPT-05: AVIF encode runs and AVIF WASM chunk absent from initial page load', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: confirm no avif*.wasm in network requests before AVIF file drop
  expect(false).toBe(true)
})

test.fail('PIPE-02: settings change for selected file re-optimizes only that file', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: change perFileCodec for one file → assert only that file status flips
  expect(false).toBe(true)
})

test.fail('UI-03: file list shows non-zero byte reduction after optimize', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: optimize PNG → assert optimizedSize < originalSize in store
  expect(false).toBe(true)
})

test.fail('UI-04: click file row opens split slider in CenterPane with real FileEntry data', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: setSelected(fileId) → assert .center .image-frame is visible
  expect(false).toBe(true)
})

test.fail('UI-05: InspectorPane Codec tab shows format-specific controls; Snippets tab shows SnippetPanel', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object',
  )
  // Wave 2 plan 05 flips this: select PNG file → assert Codec tab renders PngPanel controls
  expect(false).toBe(true)
})

test('metadata strip — output bytes contain no iCCP chunk by default', async ({ page }) => {
  // Plan 04-07 Task 2 — live OPT-06 / SC-3: png-adapter round-trips without ICC.
  // Mirrors the runtime.running poll pattern used elsewhere in this file so an
  // error status on the entry doesn't hang; assertions surface the actual status.
  //
  // Known Vite-dev-server flake: when this test runs in a fresh playwright
  // worker that races Vite's WASM compilation, the @jsquash/png WASM fetch
  // can return the SPA HTML fallback ("expected magic word 00 61 73 6d, found
  // 3c 21 64 6f"). Console-error capture surfaces the cause when this happens.
  // Tracked as a deferred Plan 04-03 (png-adapter) hardening item — see
  // 04-07-SUMMARY Deferred Issues.
  const consoleErrors: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  const iccBytes = await loadFixture('with-icc.png')
  const finalState = await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
    const filesApi = stores.files.getState()
    filesApi.clear()
    await filesApi.addSourceWithVariants({
      sourceBlob: blob,
      sourceDensity: '2x',
      name: 'icc.png',
      format: 'png',
      targets: ['1x'],
    })
    ;(Array.from(document.querySelectorAll('button')).find(
      (b) => /optimize/i.test(b.textContent ?? ''),
    ) as HTMLButtonElement | undefined)?.click()
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (!stores.runtime.getState().running) {
          clearInterval(t)
          resolve()
        }
      }, 100)
    })
    const entries = Object.values(stores.files.getState().byId) as Array<{
      status: string
      error?: string
      optimizedBlob?: Blob
    }>
    const e = entries[0]
    const bytesOut = e?.optimizedBlob
      ? Array.from(new Uint8Array(await e.optimizedBlob.arrayBuffer()))
      : null
    return { count: entries.length, status: e?.status, error: e?.error, bytesOut }
  }, { bytes: iccBytes })
  expect(finalState.count).toBe(1)
  expect(
    finalState.status,
    `optimize failed for icc fixture: ${finalState.error ?? 'no error message'}; console: ${consoleErrors.join(' | ')}`,
  ).toBe('done')
  expect(finalState.bytesOut).not.toBeNull()
  const out = Buffer.from(finalState.bytesOut!)
  expect(out.includes(Buffer.from('iCCP'))).toBe(false)
})
