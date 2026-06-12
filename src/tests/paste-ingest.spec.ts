// Phase 15 — ING-02: Playwright e2e for the document-level paste hook
// (src/hooks/useClipboardIngest.ts) mounted at App root.
// Source: 15-03-PLAN.md Task 3 + 15-RESEARCH.md §9 task 15-03.
//
// Three scenarios:
//   A) Image paste anywhere outside text inputs → ingests + success toast.
//   B) Image-URL text paste → page.route serves a PNG → ingests + URL toast.
//   C) Same image paste targeted at the Toolbar filter <input> → D-11 guard
//      blocks ingest; entry count stays at zero, no toast.
//
// Synthetic-ClipboardEvent strategy: page.evaluate constructs a real
// ClipboardEvent('paste') with a freshly-built DataTransfer (Chromium supports
// `new DataTransfer()` since 2019). DataTransferItemList .add() accepts both
// File objects (image branch) and strings with a MIME (URL branch).
//
// Same DOM dispatch pattern as src/tests/url-ingest.spec.ts (page.evaluate +
// page.route interception); identical sonner-toast selector
// (`[data-sonner-toast]`).
import { test, expect } from '@playwright/test'

// 1×1 transparent PNG (verified bytes — shared with url-ingest.spec.ts).
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const PASTE_URL = 'https://cors-test.example/paste-via-url.png'

test.describe('Phase 15 ING-02 — useClipboardIngest (document paste)', () => {
  test('Case A: image paste on document.body → entry appears + success toast', async ({ page }) => {
    await page.goto('/')

    // Wait for the boot to mount the hook (useStore subscription is sync,
    // but make sure the AppShell rendered first).
    await expect(page.getByTestId('files-pane')).toBeVisible()

    // Dispatch a synthetic paste event on document.body carrying an image File.
    await page.evaluate(async (pngB64: string) => {
      // base64 → Uint8Array → File('image/png')
      const bin = atob(pngB64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const file = new File([bytes], 'pasted.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      document.body.dispatchEvent(ev)
    }, TINY_PNG_B64)

    // Entry must land in filesAtom (async dispatcher → ingest → setKey).
    await page.waitForFunction(
      async () => {
        const mod = (await import(/* @vite-ignore */ '/src/stores/files.ts')) as {
          filesAtom: { get(): { entries: { name: string }[] } }
        }
        return mod.filesAtom.get().entries.some((e) => e.name === 'pasted.png')
      },
      undefined,
      { timeout: 10_000 },
    )

    // Sonner success toast for the image branch — see clipboard-ingest.ts:135.
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /Pasted image imported/,
    })
    await expect(toast).toBeVisible({ timeout: 5_000 })
  })

  test('Case B: text/plain image-URL paste → fetch routed → URL toast', async ({ page }) => {
    // page.route MUST be set up before the page issues the fetch.
    await page.route(PASTE_URL, (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'image/png' },
        body: Buffer.from(TINY_PNG_B64, 'base64'),
      }),
    )
    await page.goto('/')
    await expect(page.getByTestId('files-pane')).toBeVisible()

    await page.evaluate((url: string) => {
      const dt = new DataTransfer()
      dt.items.add(url, 'text/plain')
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      document.body.dispatchEvent(ev)
    }, PASTE_URL)

    // The url-ingest path derives filename = 'paste-via-url.png' from the URL last segment.
    await page.waitForFunction(
      async () => {
        const mod = (await import(/* @vite-ignore */ '/src/stores/files.ts')) as {
          filesAtom: { get(): { entries: { name: string }[] } }
        }
        return mod.filesAtom.get().entries.some((e) => e.name === 'paste-via-url.png')
      },
      undefined,
      { timeout: 10_000 },
    )

    // Sonner success toast for the URL branch — see clipboard-ingest.ts:156.
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /Imported from URL: cors-test\.example/,
    })
    await expect(toast).toBeVisible({ timeout: 5_000 })
  })

  test('Case C: paste targeted at Toolbar filter input → D-11 guard blocks ingest', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('files-pane')).toBeVisible()

    // The only text input on the boot screen is the Toolbar filter
    // (aria-label="Filter files", placeholder="Filter files…").
    const filterInput = page.getByRole('searchbox', { name: 'Filter files' })
    await expect(filterInput).toBeVisible()
    await filterInput.click()
    await expect(filterInput).toBeFocused()

    // Dispatch the same image paste event, but originate it from the focused
    // filter <input>. The hook's tagName/contenteditable check must early-return.
    await filterInput.evaluate((el, pngB64: string) => {
      const bin = atob(pngB64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const file = new File([bytes], 'should-not-ingest.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      el.dispatchEvent(ev)
    }, TINY_PNG_B64)

    // Give the hook a real-time window to (incorrectly) ingest if the guard breaks.
    // Settle for 750ms — useIngest dispatches async; 750ms is multiples of a single
    // setKey-React-render cycle.
    await page.waitForTimeout(750)

    const count = await page.evaluate(async () => {
      const mod = (await import(/* @vite-ignore */ '/src/stores/files.ts')) as {
        filesAtom: { get(): { entries: unknown[] } }
      }
      return mod.filesAtom.get().entries.length
    })
    expect(count).toBe(0)

    // No success toast must have fired.
    const successToast = page.locator('[data-sonner-toast]').filter({
      hasText: /Pasted image imported/,
    })
    await expect(successToast).toHaveCount(0)
  })
})
