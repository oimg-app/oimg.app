import { test, expect } from '@playwright/test'

// Phase 2 — Worker pool / stub adapter contract tests.
// VR-01: stub round-trip · VR-02: concurrency cap · VR-03: cancel correctness.
// Source: 02-VALIDATION.md VRs, 02-RESEARCH.md §Validation Architecture.
//
// Plan 02-04 flipped these from Wave 0 test.fail() stubs to live end-to-end
// assertions. The flow:
//   1. Use page.evaluate to access window.__OIMG_STORES__ (dev-only exposure).
//   2. Drop synthetic Blobs into useFilesStore via addFile().
//   3. Click the toolbar Optimize button (or trigger via store directly for
//      cancel race).
//   4. Read inFlight.size / doneCount / running from useRuntimeStore.

test.describe('Phase 2 — Worker pool (VR-01..VR-03)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )
  })

  test('stub round-trip: synthetic 1KB Blob completes in <500ms with optimizedSize === originalSize (VR-01)', async ({ page }) => {
    // Drop a single 1KB synthetic blob.
    await page.evaluate(() => {
      const stores = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any } }
      }).__OIMG_STORES__
      const blob = new Blob([new Uint8Array(1024)], { type: 'application/octet-stream' })
      stores.files.getState().addFile({
        id: 'vr01',
        name: 'synthetic-1kb.bin',
        format: 'png',
        originalSize: 1024,
        optimizedSize: null,
        status: 'idle',
        sourceDensity: '1x',
        thumbnail: null,
        sourceBlob: blob,
        optimizedBlob: null,
      })
    })

    const start = Date.now()
    await page.getByRole('button', { name: /Optimize all/i }).click()

    // Wait for completion.
    await page.waitForFunction(() => {
      const s = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any }; files: { getState: () => any } }
      }).__OIMG_STORES__
      const f = s.files.getState().byId.vr01
      return !s.runtime.getState().running && f && f.status === 'done'
    }, { timeout: 5000 })
    const elapsed = Date.now() - start

    // VR-01 contract: stub round-trip preserves byte count exactly.
    const result = await page.evaluate(() => {
      const f = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any } }
      }).__OIMG_STORES__.files.getState().byId.vr01
      return { originalSize: f.originalSize, optimizedSize: f.optimizedSize }
    })
    expect(result.optimizedSize).toBe(result.originalSize)
    expect(elapsed).toBeLessThan(500)
  })

  test('concurrency cap: inFlight.size <= min(hwConc, 4) throughout batch (VR-02)', async ({ page }) => {
    // Inject 100ms per-job delay via the stub adapter test affordance so the
    // observation loop has time to capture in-flight transitions.
    await page.evaluate(() => {
      ;(window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__ = 100
    })

    const poolSize = await page.evaluate(() =>
      (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState().poolSize
    )
    const total = poolSize + 4

    await page.evaluate(({ total }) => {
      const stores = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any } }
      }).__OIMG_STORES__
      const files = stores.files.getState()
      for (let i = 0; i < total; i++) {
        const blob = new Blob([new Uint8Array(128)], { type: 'application/octet-stream' })
        files.addFile({
          id: `vr02-${i}`,
          name: `vr02-${i}.bin`,
          format: 'png',
          originalSize: 128,
          optimizedSize: null,
          status: 'idle',
          sourceDensity: '1x',
          thumbnail: null,
          sourceBlob: blob,
          optimizedBlob: null,
        })
      }
    }, { total })

    // Start concurrent inFlight observation BEFORE clicking optimize.
    // Subscribe via store.subscribe AND tight setInterval for belt-and-braces;
    // store.subscribe captures every transition synchronously.
    await page.evaluate(() => {
      const win = window as unknown as {
        __MAX_INFLIGHT__?: number
        __INFLIGHT_TRACE__?: number[]
      }
      win.__MAX_INFLIGHT__ = 0
      win.__INFLIGHT_TRACE__ = []
      const runtime = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any; subscribe: any } }
      }).__OIMG_STORES__.runtime
      // Subscribe with selector so every change to inFlight.size invokes us.
      runtime.subscribe(
        (s: any) => s.inFlight.size,
        (size: number) => {
          win.__INFLIGHT_TRACE__!.push(size)
          if (size > win.__MAX_INFLIGHT__!) win.__MAX_INFLIGHT__ = size
        },
      )
      const id = setInterval(() => {
        const s = runtime.getState()
        if (s.inFlight.size > win.__MAX_INFLIGHT__!) win.__MAX_INFLIGHT__ = s.inFlight.size
        if (!s.running && s.inFlight.size === 0 && s.totalJobs > 0 && s.doneCount + s.errorCount === s.totalJobs) clearInterval(id)
      }, 5)
      setTimeout(() => clearInterval(id), 15000)
    })

    await page.getByRole('button', { name: /Optimize all/i }).click()

    await page.waitForFunction(() => {
      const s = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState()
      return !s.running && s.doneCount === s.totalJobs
    }, { timeout: 15000 })

    const maxInFlight = await page.evaluate(() =>
      (window as unknown as { __MAX_INFLIGHT__: number }).__MAX_INFLIGHT__
    )

    // Cleanup: clear the slowMs flag so it doesn't leak into other tests.
    await page.evaluate(() => {
      delete (window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__
    })

    // VR-02 contract: at no observed moment did inFlight exceed POOL_SIZE.
    expect(maxInFlight).toBeLessThanOrEqual(poolSize)
    // Sanity: at least 1 job was observed in flight (else we proved nothing).
    expect(maxInFlight).toBeGreaterThan(0)
  })

  test('cancel correctness: cancelBatch clears running + inFlight within 200ms (VR-03)', async ({ page }) => {
    // Inject 1000ms per-job delay so jobs are still in flight when we cancel.
    await page.evaluate(() => {
      ;(window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__ = 1000
    })

    // Drop 4 blobs; we will cancel immediately after the first dispatch.
    await page.evaluate(() => {
      const stores = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any } }
      }).__OIMG_STORES__
      const files = stores.files.getState()
      for (let i = 0; i < 4; i++) {
        const blob = new Blob([new Uint8Array(128)], { type: 'application/octet-stream' })
        files.addFile({
          id: `vr03-${i}`,
          name: `vr03-${i}.bin`,
          format: 'png',
          originalSize: 128,
          optimizedSize: null,
          status: 'idle',
          sourceDensity: '1x',
          thumbnail: null,
          sourceBlob: blob,
          optimizedBlob: null,
        })
      }
    })

    await page.getByRole('button', { name: /Optimize all/i }).click()

    // Wait for batch to start, then immediately cancel via Cmd+. shortcut.
    await page.waitForFunction(() =>
      (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState().running === true
    )
    await page.keyboard.press('Meta+.')

    // Within 200ms, runtime must report running=false AND inFlight.size=0.
    const cancelStart = Date.now()
    await page.waitForFunction(() => {
      const s = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState()
      return !s.running && s.inFlight.size === 0
    }, { timeout: 200 })
    expect(Date.now() - cancelStart).toBeLessThan(200)

    // Cleanup the slowMs flag.
    await page.evaluate(() => {
      delete (window as unknown as { __OIMG_SLOW_MS__?: number }).__OIMG_SLOW_MS__
    })
  })
})
