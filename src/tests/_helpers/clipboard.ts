// change:add-black-box-e2e-suite — clipboard access for snippet/diagnostics copy paths.
//
// All app copies route through lib/clipboard's copyToClipboard chokepoint, so reading the
// real clipboard back is a genuine end-to-end assertion rather than a spy on an internal.
import type { BrowserContext, Page } from '@playwright/test'

/**
 * Grants clipboard permissions. Chromium-only, which matches the shipped single-project
 * config; on other engines grantPermissions rejects for these names, and the catch keeps a
 * spec from dying in setup when only the write path is exercised.
 */
export async function grantClipboard(context: BrowserContext): Promise<void> {
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  } catch {
    // Non-chromium engine — the write path still works without an explicit grant.
  }
}

/** Reads the clipboard's text. Requires grantClipboard first. */
export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}

/** Seeds the clipboard — used by the paste-ingest paths. */
export async function writeClipboard(page: Page, text: string): Promise<void> {
  await page.evaluate((t: string) => navigator.clipboard.writeText(t), text)
}

/** Clears the clipboard so a later read cannot pass on a previous test's leftovers. */
export async function clearClipboard(page: Page): Promise<void> {
  await writeClipboard(page, '')
}

/**
 * Runs `action`, then waits for the clipboard to hold something other than what it held
 * before. Copies are async (build snippet → write → toast), so reading straight after the
 * click races the write.
 */
export async function copyAndRead(page: Page, action: () => Promise<void>, timeout = 5_000): Promise<string> {
  const before = await readClipboard(page).catch(() => '')
  await action()
  await page.waitForFunction(
    async (prev: string) => (await navigator.clipboard.readText()) !== prev,
    before,
    { timeout },
  )
  return readClipboard(page)
}
