import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Phase 2 — Object URL leak parity (VR-04).
// Source: 02-VALIDATION.md VR-04, 02-RESEARCH.md Pitfall 3 + §Pattern 5.
// Asserts `created === revoked + stillRendered` after a 12-file batch with re-optimize.

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const INSTRUMENT_PATH = path.resolve(__dirname, 'fixtures/instrument-blob-urls.ts')

test.describe('Phase 2 — Object URL lifecycle (VR-04)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: INSTRUMENT_PATH })
    await page.goto('/')
  })

  test('createObjectURL count matches revoke + stillRendered after 12-file batch + re-optimize (VR-04)', async ({ page }) => {
    test.fail() // Wave 0 stub — turns green in 02-02 (urlCache lifecycle) + 02-04 (UI wiring)
    const counts = await page.evaluate(() => (window as unknown as {
      __OIMG_URL_COUNTS__?: { created: number; revoked: number }
    }).__OIMG_URL_COUNTS__)
    expect(counts).toBeDefined()
    expect(counts!.created).toBe(0) // pre-batch baseline check; will be replaced
  })
})
