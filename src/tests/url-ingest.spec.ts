// Phase 15 — ING-01: Playwright e2e for src/lib/url-ingest.ts
// Source: 15-01-PLAN.md Task 3 + 15-RESEARCH.md §9 task 15-01 e2e block.
//
// Strategy:
//   - page.route(...) intercepts `https://cors-test.example/...` URLs entirely
//     in the browser network stack. Test 1 returns a 1×1 PNG with
//     `Content-Type: image/png`; Test 2 returns a 403 with text body.
//   - page.evaluate dynamically imports /src/lib/url-ingest (Vite static-import
//     pattern called out in CLAUDE.md; same approach as watch-folder.spec.ts
//     bridgeRuntimeToasts).
//   - Toast assertion uses the sonner DOM render selector (`[data-sonner-toast]`),
//     established in export-zip.spec.ts.
import { test, expect } from '@playwright/test'

// 1×1 transparent PNG (verified bytes — reused from watch-folder.spec.ts).
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function tinyPngBuffer(): Buffer {
  return Buffer.from(TINY_PNG_B64, 'base64')
}

const PNG_URL = 'https://cors-test.example/photo.png'
const FORBIDDEN_URL = 'https://cors-test.example/forbidden.png'

test.describe('Phase 15 ING-01 — pickFromUrl (e2e)', () => {
  test('happy path: routed PNG → returns File with name/type/size', async ({ page }) => {
    // page.route MUST be registered before navigation so the interceptor is
    // active for the first fetch the page makes from the lib.
    await page.route(PNG_URL, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          // No Content-Disposition → filename derives from URL last path segment.
        },
        body: tinyPngBuffer(),
      }),
    )
    await page.goto('/')

    const result = await page.evaluate(async (u: string) => {
      const mod = (await import(/* @vite-ignore */ '/src/lib/url-ingest.ts')) as {
        pickFromUrl: (url: string) => Promise<File | null>
      }
      const f = await mod.pickFromUrl(u)
      return f ? { name: f.name, type: f.type, size: f.size } : null
    }, PNG_URL)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('photo.png')
    expect(result?.type).toBe('image/png')
    expect(result?.size).toBeGreaterThan(0)
  })

  test('non-2xx (403): returns null + emits "URL fetch failed (403)" toast', async ({ page }) => {
    await page.route(FORBIDDEN_URL, (route) =>
      route.fulfill({
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
        body: 'forbidden',
      }),
    )
    await page.goto('/')

    const result = await page.evaluate(async (u: string) => {
      const mod = (await import(/* @vite-ignore */ '/src/lib/url-ingest.ts')) as {
        pickFromUrl: (url: string) => Promise<File | null>
      }
      const f = await mod.pickFromUrl(u)
      return f ? { name: f.name, type: f.type, size: f.size } : null
    }, FORBIDDEN_URL)

    expect(result).toBeNull()

    // sonner renders each toast as a `[data-sonner-toast]` node. The exact text
    // is the finalized RESEARCH §5 wording: `URL fetch failed (403)`.
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /URL fetch failed \(403\)/,
    })
    await expect(toast).toBeVisible({ timeout: 5_000 })
  })
})
