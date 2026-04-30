import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Phase 2 — Object URL leak parity (VR-04).
// Source: 02-VALIDATION.md VR-04, 02-RESEARCH.md Pitfall 3 + §Pattern 5.
//
// Plan 02-04 flipped this from a Wave 0 stub to a real lifecycle assertion:
// drop 4 blobs, optimize once, then re-optimize (each pass reuses the same
// fileIds so markDone calls revokeObjectURL BEFORE writing the new blob).
// Asserts: created === revoked + outstanding (still in urlCache).
//
// In Phase 2 the UI does not render thumbnails (Phase 5 wiring), so the only
// createObjectURL paths are explicit calls via getOrCreateObjectURL(). To
// exercise the full lifecycle we trigger getOrCreateObjectURL via page
// evaluate after each batch — proves the urlCache supersede flow revokes
// the OLD URL before issuing a fresh one.

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Plan 02-04 deviation (Rule 3 — blocking): the original .ts instrumentation
// was not transpiled by Playwright's addInitScript and produced no patches.
// Switched to a hand-written .js sibling file with no TS syntax.
const INSTRUMENT_PATH = path.resolve(__dirname, 'fixtures/instrument-blob-urls.js')

test.describe('Phase 2 — Object URL lifecycle (VR-04)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: INSTRUMENT_PATH })
    await page.goto('/')
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )
  })

  test('createObjectURL count matches revoke + outstanding cache after 4-file batch + re-optimize (VR-04)', async ({ page }) => {
    // Drop 4 blobs and run the batch.
    await page.evaluate(() => {
      const stores = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any } }
      }).__OIMG_STORES__
      const files = stores.files.getState()
      for (let i = 0; i < 4; i++) {
        const blob = new Blob([new Uint8Array(64)], { type: 'application/octet-stream' })
        files.addFile({
          id: `u${i}`,
          name: `vr04-${i}.bin`,
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

    await page.getByRole('button', { name: /Optimize all/i }).click()
    await page.waitForFunction(() => {
      const s = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState()
      return !s.running && s.doneCount === 4
    })

    // Allocate one URL per fileId via the runtime store (simulates first
    // render need for a thumbnail). Then re-optimize — markDone revokes the
    // OLD url before writing the fresh optimizedBlob.
    await page.evaluate(() => {
      const stores = (window as unknown as {
        __OIMG_STORES__: { files: { getState: () => any }; runtime: { getState: () => any } }
      }).__OIMG_STORES__
      const files = stores.files.getState()
      for (const id of files.order) {
        const f = files.byId[id]
        const blob = f.optimizedBlob ?? f.sourceBlob
        stores.runtime.getState().getOrCreateObjectURL(id, blob)
        // Reset status to idle so the next optimize pass picks them up.
        files.setStatus(id, 'idle')
      }
    })

    // Re-optimize — supersedes optimizedBlob; markDone revokes pre-existing URLs.
    await page.getByRole('button', { name: /Optimize all/i }).click()
    await page.waitForFunction(() => {
      const s = (window as unknown as {
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }).__OIMG_STORES__.runtime.getState()
      return !s.running && s.doneCount === 4
    })

    const result = await page.evaluate(() => {
      const w = window as unknown as {
        __OIMG_URL_COUNTS__: { created: number; revoked: number }
        __OIMG_STORES__: { runtime: { getState: () => any } }
      }
      const cacheSize = w.__OIMG_STORES__.runtime.getState().urlCache.size
      return { ...w.__OIMG_URL_COUNTS__, cacheSize }
    })

    // VR-04 contract: every created URL is either revoked or still cached.
    expect(result.created).toBe(result.revoked + result.cacheSize)
    // Sanity: at least 4 URLs were created (one per file post-batch).
    expect(result.created).toBeGreaterThanOrEqual(4)
  })
})
