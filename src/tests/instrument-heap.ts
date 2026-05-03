import type { Page } from '@playwright/test'

/** Phase 4 SC-2 verification helper — measures peak heap during a batch via CDP.
 *  Source: 04-RESEARCH.md §Risk 5; 04-PATTERNS.md lines 695-715.
 *  Falls back to `performance.memory.usedJSHeapSize` polling on non-Chromium. */
export async function probeHeapDuringBatch(
  page: Page,
  runBatch: () => Promise<void>,
): Promise<number> {
  const cdp = await page.context().newCDPSession(page).catch(() => null)
  let peak = 0
  let stop = false

  const poll = async () => {
    while (!stop) {
      try {
        if (cdp) {
          const counters = (await cdp
            .send('Memory.getDOMCounters' as any)
            .catch(() => null)) as { jsHeapSizeUsed?: number } | null
          if (counters?.jsHeapSizeUsed && counters.jsHeapSizeUsed > peak) {
            peak = counters.jsHeapSizeUsed
          }
        } else {
          const used = await page.evaluate(() =>
            (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
              ?.usedJSHeapSize ?? 0,
          )
          if (typeof used === 'number' && used > peak) peak = used
        }
      } catch {
        // swallow — best-effort sampling
      }
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  const pollPromise = poll()
  try {
    await runBatch()
  } finally {
    stop = true
    await pollPromise
    if (cdp) await cdp.detach().catch(() => undefined)
  }
  return peak
}
