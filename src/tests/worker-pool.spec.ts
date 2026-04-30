import { test, expect } from '@playwright/test'

// Phase 2 — Worker pool / stub adapter contract tests.
// VR-01: stub round-trip · VR-02: concurrency cap · VR-03: cancel correctness.
// Source: 02-VALIDATION.md VRs, 02-RESEARCH.md §Validation Architecture.
//
// All tests in this file are CURRENTLY FAILING via the test-fail marker. They turn green when:
//   - 02-02 lands useFilesStore + useRuntimeStore + window.__OIMG_STORES__ exposure
//   - 02-03 lands WorkerPool + stub adapter
//   - 02-04 wires Toolbar Optimize / palette Cancel into the runtime store

test.describe('Phase 2 — Worker pool (VR-01..VR-03)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('stub round-trip: synthetic 1KB Blob completes in <500ms with 0 bytes saved (VR-01)', async ({ page }) => {
    test.fail() // Wave 0 stub — turns green in 02-03 + 02-04
    // Wave 0 stub probe: __OIMG_STORES__ does not exist yet, so this fails cleanly.
    const exposed = await page.evaluate(() => typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__)
    expect(exposed).toBe('object')
  })

  test('concurrency cap: inFlight.size <= min(hwConc, 4) throughout batch (VR-02)', async ({ page }) => {
    test.fail() // Wave 0 stub — turns green in 02-03 + 02-04
    const exposed = await page.evaluate(() => typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__)
    expect(exposed).toBe('object')
  })

  test('cancel correctness: terminate kills in-flight; no markDone within 2s post-cancel (VR-03)', async ({ page }) => {
    test.fail() // Wave 0 stub — turns green in 02-03 + 02-04
    const exposed = await page.evaluate(() => typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__)
    expect(exposed).toBe('object')
  })
})
