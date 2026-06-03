// Phase 12 Plan 04 — Toolbar bulk D-08/D-09/D-10/D-11 + D-15 chokepoint capture.
// Four tests:
//   1. D-08 disable-then-explain — all three bulk items aria-disabled=true +
//      title='Optimize at least one file first' when no file has status==='done'.
//   2. D-09 Copy <picture> HTML — 3 done files, click menu item, captured text
//      contains 3 <picture> blocks separated by blank lines.
//   3. D-10 Copy as data URIs — 3 done files, click menu item, captured text
//      is exactly 3 lines (split by \n), each line starts with the expected
//      data: prefix.
//   4. D-11 Manifest JSON — 3 done files, click menu item, captured text is
//      pretty-printed JSON array with 3 entries × {filename, target,
//      originalSize, optimizedSize, quality}.
//
// Analog 1: src/tests/export-disabled.spec.ts (Phase 11 D-13 disable-then-explain).
// Analog 2: src/tests/file-row-menu.spec.ts injectEntries helper (verbatim copy).
// Analog 3: src/tests/output-panel-live.spec.ts (Plan 03) — installClipboardMocks
//           + page.waitForFunction latch on window.__clipboardWrites.length.
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClipboardMocks } from './setup/clipboard-mocks'

// Tiny valid 1×1 WebP (verified atob-safe at module load).
const TINY_WEBP_B64 = 'UklGRiYAAABXRUJQVlA4IBoAAADQAQCdASoBAAEAAUAmJbACdAEO/g3OAAAA'

interface InjectSpec {
  id: string
  name: string
  target: string
  status?: 'done' | 'queued' | 'processing' | 'error'
}

/**
 * Inject FileEntry rows into filesAtom. 'done' status carries an encodedBuffer; non-'done'
 * omits it so the D-08 bulk gate / per-method `e.encodedBuffer != null` filter exercises both
 * paths. Mirrors the pattern in file-row-menu.spec.ts:34-72.
 */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(
    async ({ specs, TINY_WEBP_B64 }) => {
      const filesUrl = '/src/stores/files.ts'
      const stubUrl = '/src/lib/stub-data.ts'
      const filesMod = (await import(/* @vite-ignore */ filesUrl)) as typeof import('../stores/files')
      const stubMod = (await import(/* @vite-ignore */ stubUrl)) as typeof import('../lib/stub-data')
      const { filesAtom } = filesMod
      const { defaultFileSettings } = stubMod

      const bin = atob(TINY_WEBP_B64)
      const ab = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i)
      const buffer = ab.buffer as ArrayBuffer

      const entries = specs.map((s, i) => ({
        id: s.id,
        name: s.name,
        type: 'png',
        orig: 100000 + i,
        opt: 20000 + i,
        status: (s.status ?? 'done') as 'done' | 'queued' | 'processing' | 'error',
        target: s.target,
        dim: '1×1',
        q: 82,
        createdAt: Date.now() + i,
        settings: defaultFileSettings('png', 82),
        rawBuffer: buffer,
        ...(s.status === 'done' || s.status == null ? { encodedBuffer: buffer } : {}),
      }))

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    },
    { specs, TINY_WEBP_B64 },
  )
}

test.describe('Toolbar — D-08/D-09/D-10/D-11 bulk snippets', () => {
  test('D-08: all three bulk items aria-disabled + title when no done files', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    // Inject queued-only entries so $hasDone === false.
    await injectEntries(page, [
      { id: 'q1', name: 'q1.png', target: 'webp', status: 'queued' },
    ])

    // Open the Export Popover via the caret button.
    await page.getByRole('button', { name: 'Export options' }).click()

    for (const label of [/^Copy <picture> HTML$/, /^Copy as data URIs$/, /^Manifest JSON$/]) {
      const item = page.getByRole('button', { name: label })
      await expect(item).toBeVisible()
      await expect(item).toBeDisabled()
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      await expect(item).toHaveAttribute('title', 'Optimize at least one file first')
    }
  })

  test('D-09: Copy <picture> HTML joins per-file blocks with blank lines', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'd1', name: 'a.png', target: 'webp' },
      { id: 'd2', name: 'b.png', target: 'webp' },
      { id: 'd3', name: 'c.png', target: 'webp', status: 'queued' }, // excluded from bulk
    ])

    await page.getByRole('button', { name: 'Export options' }).click()
    await page.getByRole('button', { name: /^Copy <picture> HTML$/ }).click()

    await page.waitForFunction(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )

    // D-09: blocks joined by '\n\n' (single blank line between blocks). Queued entry excluded.
    const blocks = text.split('\n\n')
    expect(blocks).toHaveLength(2)
    expect(text).toContain('<source srcset="')
    expect(text).toContain('a.webp')
    expect(text).toContain('b.webp')
    expect(text).not.toContain('c.webp')
  })

  test('D-10: Copy as data URIs emits one URI per line, ready for <img src>', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'd1', name: 'a.png', target: 'webp' },
      { id: 'd2', name: 'b.png', target: 'webp' },
      { id: 'q1', name: 'q1.png', target: 'webp', status: 'queued' },
    ])

    await page.getByRole('button', { name: 'Export options' }).click()
    await page.getByRole('button', { name: /^Copy as data URIs$/ }).click()

    await page.waitForFunction(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )

    // D-10: one URI per line — no <img> wrapper, no CSS rule.
    const lines = text.split('\n')
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(line.startsWith('data:image/webp;base64,')).toBe(true)
      // Sanity: should NOT contain any HTML / CSS wrapper.
      expect(line).not.toContain('<img')
      expect(line).not.toContain('background-image')
    }
  })

  test('D-11: Manifest JSON is pretty-printed with five fields per entry', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'd1', name: 'a.png', target: 'webp' },
      { id: 'd2', name: 'b.png', target: 'webp' },
      { id: 'q1', name: 'q1.png', target: 'webp', status: 'queued' }, // excluded
    ])

    await page.getByRole('button', { name: 'Export options' }).click()
    await page.getByRole('button', { name: /^Manifest JSON$/ }).click()

    await page.waitForFunction(
      () => (window as unknown as { __clipboardWrites?: string[] }).__clipboardWrites?.length === 1,
      undefined,
      { timeout: 5000 },
    )
    const text = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )

    const parsed = JSON.parse(text)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(2)
    for (const entry of parsed) {
      expect(entry).toHaveProperty('filename')
      expect(entry).toHaveProperty('target')
      expect(entry).toHaveProperty('originalSize')
      expect(entry).toHaveProperty('optimizedSize')
      expect(entry).toHaveProperty('quality')
    }
    // D-11: filename is the swapped-extension name (renameExtension(a.png, webp) === a.webp).
    expect(parsed.map((e: { filename: string }) => e.filename)).toEqual(['a.webp', 'b.webp'])
    // Pretty-printed: contains newlines (vs single-line minified).
    expect(text).toContain('\n  ')
  })
})
