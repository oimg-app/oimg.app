// Phase 12 Plan 05 — D-12 + D-13 + D-15 chokepoint capture for FileRow per-row items.
// Four tests:
//   1. D-12 Copy <picture> menuitem invokes useSnippets.copyPictureOne — captured
//      clipboard text contains a <picture> block with <source srcset="…">.
//   2. D-13 Copy data-URI disabled when status !== 'done' — aria-disabled='true' +
//      title='Optimize this file first'.
//   3. D-12 Copy data-URI emits URI ALONE (no <img> wrapper) — captured text starts
//      with `data:image/webp;base64,` and does NOT contain `<img`.
//   4. D-12 SVG dispatch — Copy data-URI on an SVG file uses the URL-encoded path
//      (`data:image/svg+xml;charset=utf-8,`), proving T-12-01 mitigation chain.
//
// Analog: src/tests/file-row-menu.spec.ts (Phase 11 D-04) — injectEntries + rightClickRow
// helpers copied verbatim per 12-PATTERNS.md carry-forward.
// Clipboard chokepoint: installClipboardMocks (Plan 01) records every navigator.clipboard
// .writeText into window.__clipboardWrites.
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClipboardMocks } from './setup/clipboard-mocks'

// Tiny valid 1×1 WebP (verified atob-safe at module load).
const TINY_WEBP_B64 = 'UklGRiYAAABXRUJQVlA4IBoAAADQAQCdASoBAAEAAUAmJbACdAEO/g3OAAAA'

interface InjectSpec {
  id: string
  name: string
  target: string
  /** Default 'done'. When non-'done', encodedBuffer is omitted (D-13 disabled gate). */
  status?: 'done' | 'queued' | 'processing' | 'error'
  /** When 'svg', encode `<svg/>` UTF-8 bytes into encodedBuffer for SVG dispatch path. */
  bufferKind?: 'webp' | 'svg'
}

/**
 * Inject FileEntry rows into filesAtom. 'done' status gets an encodedBuffer; non-'done'
 * omits it so the D-13 disabled gate (file.status !== 'done') is exercised.
 * bufferKind='svg' encodes `<svg/>` UTF-8 bytes so buildDataUri's SVG dispatch path
 * (T-12-01 mitigation) is reached through copyDataUriOne.
 */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(
    async ({ specs, TINY_WEBP_B64 }) => {


      const filesMod = (await import('../stores/files'))
      const stubMod = (await import('../lib/settings'))
      const { filesAtom } = filesMod
      const { defaultFileSettings } = stubMod

      const webpBin = atob(TINY_WEBP_B64)
      const webpAb = new Uint8Array(webpBin.length)
      for (let i = 0; i < webpBin.length; i++) webpAb[i] = webpBin.charCodeAt(i)
      const webpBuffer = webpAb.buffer as ArrayBuffer

      const svgBuffer = new TextEncoder().encode('<svg/>').buffer as ArrayBuffer

      const entries = specs.map((s, i) => {
        const buffer = s.bufferKind === 'svg' ? svgBuffer : webpBuffer
        const type = s.bufferKind === 'svg' ? 'svg' : 'png'
        return {
          id: s.id,
          name: s.name,
          type,
          orig: buffer.byteLength,
          opt: buffer.byteLength,
          status: (s.status ?? 'done') as 'done' | 'queued' | 'processing' | 'error',
          target: s.target,
          dim: '1×1',
          q: 82,
          createdAt: Date.now() + i,
          settings: defaultFileSettings(type, 82),
          rawBuffer: buffer,
          ...(s.status === 'done' || s.status == null ? { encodedBuffer: buffer } : {}),
        }
      })

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    },
    { specs, TINY_WEBP_B64 },
  )
}

/**
 * Right-click on the row matching the given filename. Mirrors file-row-menu.spec.ts:78-81.
 */
async function rightClickRow(page: Page, filename: string): Promise<void> {
  const row = page.getByTestId('files-pane').getByText(filename)
  await row.click({ button: 'right' })
}

test.describe('FileRow — D-12/D-13 per-row snippet items', () => {
  test('Copy <picture> menuitem invokes useSnippets.copyPictureOne (D-12)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp' }])

    await rightClickRow(page, 'hero.png')

    const item = page.getByRole('menuitem', { name: /^Copy <picture>$/ })
    await expect(item).toBeVisible()
    await item.click()

    await page.waitForFunction(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )
    expect(text).toContain('<picture>')
    expect(text).toContain('<source srcset="')
  })

  test('Copy data-URI menuitem disabled when status !== "done" (D-13)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'f1', name: 'hero.png', target: 'webp', status: 'queued' },
    ])

    await rightClickRow(page, 'hero.png')

    const item = page.getByRole('menuitem', { name: /^Copy data-URI$/ })
    await expect(item).toBeVisible()
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toHaveAttribute('title', 'Optimize this file first')

    // Also assert the Copy <picture> sibling carries the same disabled triple.
    const pic = page.getByRole('menuitem', { name: /^Copy <picture>$/ })
    await expect(pic).toHaveAttribute('aria-disabled', 'true')
    await expect(pic).toHaveAttribute('title', 'Optimize this file first')
  })

  test('Copy data-URI emits URI alone for raster target (D-12)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp' }])

    await rightClickRow(page, 'hero.png')

    const item = page.getByRole('menuitem', { name: /^Copy data-URI$/ })
    await expect(item).toBeVisible()
    await item.click()

    await page.waitForFunction(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )
    expect(text).toMatch(/^data:image\/webp;base64,/)
    expect(text).not.toContain('<img')
  })

  test('Copy data-URI dispatches SVG to URL-encoded path (D-12 / T-12-01)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'f1', name: 'logo.svg', target: 'svg', bufferKind: 'svg' },
    ])

    await rightClickRow(page, 'logo.svg')

    const item = page.getByRole('menuitem', { name: /^Copy data-URI$/ })
    await expect(item).toBeVisible()
    await item.click()

    await page.waitForFunction(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )
    expect(text).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(text).not.toContain('<img')
  })
})
