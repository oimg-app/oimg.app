import { test, expect } from '@playwright/test'

// Phase 2 — ARIA live-region quartile cadence (VR-05).
// Source: 02-VALIDATION.md VR-05, 02-RESEARCH.md §Pattern 6 + Pitfall 5, 02-UI-SPEC.md §5.
// Asserts: 12-file batch → role=status text updated exactly 5x (start + N=3,6,9 quartiles + final).
//
// Plan 02-04 flipped these from test.fail() stubs to live assertions: the
// global live region mounts at App root in App.tsx overlays, and the
// useRuntimeStore.subscribe quartile-cadence handler announces interior
// strides + final completion. The Toolbar Workers pill also has role=status
// (with aria-live=off so it never announces) — locator must filter on
// aria-live=polite to target ONLY the global live region.

test.describe('Phase 2 — ARIA live region quartile cadence (VR-05)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('role=status aria-live=polite element exists at App root', async ({ page }) => {
    const liveRegion = page.locator('[role=status][aria-live=polite]')
    await expect(liveRegion).toHaveCount(1)
  })

  test('12-file batch updates live region exactly 5 times: start + 3 quartiles + final (VR-05)', async ({ page }) => {
    // Wait for stores to be exposed (App effect runs after mount).
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )

    // Pre-batch: install MutationObserver to capture every textContent update.
    await page.evaluate(() => {
      const win = window as unknown as { __ARIA_UPDATES__?: string[] }
      win.__ARIA_UPDATES__ = []
      const region = document.querySelector('[role=status][aria-live=polite]')
      if (!region) throw new Error('live region not found')
      const obs = new MutationObserver(() => {
        const txt = (region.textContent ?? '').trim()
        // De-dupe: skip empty clears (announce() does a clear-then-rAF dance).
        if (txt) win.__ARIA_UPDATES__!.push(txt)
      })
      obs.observe(region, { childList: true, characterData: true, subtree: true })
    })

    // Drop a 12-file synthetic batch into the files store.
    await page.evaluate(() => {
      const stores = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any }; runtime: { getState: () => any } }
      }).__OIMG_STORES__
      const files = stores.files.getState()
      for (let i = 0; i < 12; i++) {
        const blob = new Blob([new Uint8Array(64)], { type: 'application/octet-stream' })
        files.addFile({
          id: `t${i}`,
          name: `synthetic-${i}.bin`,
          format: 'png',
          originalSize: 64,
          optimizedSize: null,
          status: 'idle',
          sourceDensity: '1x',
          thumbnail: null,
          sourceBlob: blob,
          optimizedBlob: null,
        })
      }
    })

    // Click Optimize.
    await page.getByRole('button', { name: /Optimize all/i }).click()

    // Wait until runtime store reports running===false AND doneCount===12.
    await page.waitForFunction(() => {
      const s = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState()
      return !s.running && s.doneCount === 12
    }, { timeout: 5000 })

    // Allow the announce() rAF dance to flush the final message.
    await page.waitForTimeout(100)

    const updates = await page.evaluate(() =>
      (window as unknown as { __ARIA_UPDATES__: string[] }).__ARIA_UPDATES__
    )

    // Expected: start + quartiles at done=3,6,9 + final = 5 updates.
    // Stride for total=12 is Math.max(1, floor(12/4)) = 3 → boundaries at 3, 6, 9.
    expect(updates).toHaveLength(5)
    expect(updates[0]).toMatch(/Optimizing 12 files/)
    expect(updates[1]).toMatch(/3 of 12 files complete/)
    expect(updates[2]).toMatch(/6 of 12 files complete/)
    expect(updates[3]).toMatch(/9 of 12 files complete/)
    expect(updates[4]).toMatch(/Batch complete\. 12 files optimized/)
  })
})
