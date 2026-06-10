// Phase 11 — Plan 06 (EXP-01): D-04 per-row "File options" ContextMenu wiring +
// WCAG-AA keyboard openable, ESC close, arrow nav.
// Covers:
//   - Test 1 (D-04): right-click row → "Save as…" → useExport.exportOne fires
//     (saveBlob recorded into window.__savedFiles)
//   - Test 2 (D-04): ctxbtn click also opens the menu (synthesized contextmenu)
//   - Test 3 (WCAG-AA): ESC closes the open menu
//   - Test 4 (WCAG-AA): ArrowDown moves keyboard focus through menu items
//   - Test 5 (D-04 / RESEARCH Q1): "Save as…" is `aria-disabled` when status !== 'done'
//
// Strategy: inject a "done" entry with encodedBuffer directly into filesAtom
// (analog: src/tests/export-zip.spec.ts) — avoids the codec encode path.
// installSaveFileMocks captures the saved blob.
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSaveFileMocks } from './setup/save-file-mocks'

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

interface InjectSpec {
  id: string
  name: string
  target: string
  /** Default 'done'. When non-'done', encodedBuffer is omitted (Test 5 disabled gate). */
  status?: 'done' | 'queued' | 'processing' | 'error'
}

/**
 * Inject one or more FileEntry rows into filesAtom. 'done' status gets an
 * encodedBuffer so exportOne actually runs; non-'done' status omits it so the
 * D-04 disable gate (file.status !== 'done') is exercised.
 */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(
    async ({ specs, TINY_PNG_B64 }) => {
      
      
      const filesMod = (await import('../stores/files'))
      const stubMod = (await import('../lib/stub-data'))
      const { filesAtom } = filesMod
      const { defaultFileSettings } = stubMod

      const bin = atob(TINY_PNG_B64)
      const ab = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i)
      const buffer = ab.buffer as ArrayBuffer

      const entries = specs.map((s, i) => ({
        id: s.id,
        name: s.name,
        type: 'png',
        orig: buffer.byteLength,
        opt: buffer.byteLength,
        status: (s.status ?? 'done') as 'done' | 'queued' | 'processing' | 'error',
        target: s.target,
        dim: '1×1',
        q: 82,
        createdAt: Date.now() + i,
        settings: defaultFileSettings('png', 82),
        rawBuffer: buffer,
        // Only 'done' carries an encodedBuffer (defense-in-depth: useExport
        // guards on this in addition to the menu disabled prop).
        ...(s.status === 'done' || s.status == null ? { encodedBuffer: buffer } : {}),
      }))

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    },
    { specs, TINY_PNG_B64 },
  )
}

/**
 * Right-click on the row matching the given filename. The row is identified by
 * the file's name text inside the files-pane testid scope.
 */
async function rightClickRow(page: Page, filename: string): Promise<void> {
  const row = page.getByTestId('files-pane').getByText(filename)
  await row.click({ button: 'right' })
}

test.describe('EXP-01 — Per-row File Options Menu (D-04)', () => {
  test('right-click → Save as… invokes useExport.exportOne (D-04)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'fixture-0', name: 'fixture-0.png', target: 'webp' }])

    await rightClickRow(page, 'fixture-0.png')

    // The menu's "Save as…" item is visible
    const saveAs = page.getByRole('menuitem', { name: /^Save as…$/ })
    await expect(saveAs).toBeVisible()
    await saveAs.click()

    // Latch on the recorded save — deterministic (vs fixed sleep).
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 5000 },
    )

    const saved = await page.evaluate(() => {
      const arr = (window as unknown as { __savedFiles: Array<{ name: string; bytes: ArrayBuffer }> }).__savedFiles
      return arr.map((s) => ({ name: s.name, byteLength: s.bytes.byteLength }))
    })
    expect(saved).toHaveLength(1)
    // D-05 ext-swap: png → webp because target='webp'
    expect(saved[0].name).toBe('fixture-0.webp')
    expect(saved[0].byteLength).toBeGreaterThan(0)
  })

  test('ctxbtn click also opens the menu (synthesized contextmenu)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'fixture-0', name: 'fixture-0.png', target: 'webp' }])

    // The ctxbtn has aria-label="File options" (FileRow.tsx line 119)
    await page.getByRole('button', { name: 'File options' }).click()

    await expect(page.getByRole('menuitem', { name: /^Save as…$/ })).toBeVisible()
  })

  test('Escape closes the open menu (WCAG-AA)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'fixture-0', name: 'fixture-0.png', target: 'webp' }])

    await rightClickRow(page, 'fixture-0.png')
    await expect(page.getByRole('menuitem', { name: /^Save as…$/ })).toBeVisible()

    await page.keyboard.press('Escape')

    // Radix unmounts the menuitem from the DOM on close.
    await expect(page.getByRole('menuitem', { name: /^Save as…$/ })).toHaveCount(0)
  })

  test('ArrowDown navigates between menu items (WCAG-AA)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'fixture-0', name: 'fixture-0.png', target: 'webp' }])

    await rightClickRow(page, 'fixture-0.png')
    await expect(page.getByRole('menuitem', { name: /^Save as…$/ })).toBeVisible()

    // Radix focuses the first enabled item on open; ArrowDown moves to the next.
    // After any arrow nav, exactly one menuitem must hold focus.
    await page.keyboard.press('ArrowDown')

    const focusedMenuitems = page.locator('[role="menuitem"]:focus')
    await expect(focusedMenuitems).toHaveCount(1)
  })

  test('Save as… is aria-disabled when file.status !== "done" (D-04)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    // Queued entry (no encodedBuffer) — D-04 gate must render the item disabled.
    await injectEntries(page, [{ id: 'fixture-0', name: 'fixture-0.png', target: 'webp', status: 'queued' }])

    await rightClickRow(page, 'fixture-0.png')

    const saveAs = page.getByRole('menuitem', { name: /^Save as…$/ })
    await expect(saveAs).toBeVisible()
    // Radix maps the React `disabled` prop to BOTH aria-disabled AND data-disabled.
    await expect(saveAs).toHaveAttribute('aria-disabled', 'true')
    await expect(saveAs).toHaveAttribute('title', 'Optimize this file first')
  })
})
