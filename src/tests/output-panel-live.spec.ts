// Phase 12 Plan 03 — D-05 live refresh + D-06 per-status + D-15 chokepoint capture
// Covers:
//   - Test 1 (D-05 SC-3): mutate encodedBuffer in filesAtom mid-flight → snippet text refreshes
//     WITHOUT re-selecting the file.
//   - Test 2 (D-06 processing): status='processing' renders a skeleton with
//     aria-label='Encoding in progress' and Copy is aria-disabled='true'.
//   - Test 3 (D-06 queued): status='queued' renders 'Optimize this file first' in each section.
//   - Test 4 (D-15 chokepoint): clipboard write fires via copyToClipboard and captures the
//     snippet text into window.__clipboardWrites.
//
// Strategy: injectEntries pattern is copied verbatim from src/tests/file-row-menu.spec.ts:34-72
// (project precedent — spec files copy helpers; no shared helper file). page.evaluate uses the
// '/src/...' Vite-dev import path (accepted project pattern per MEMORY).
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClipboardMocks } from './setup/clipboard-mocks'

interface InjectSpec {
  id: string
  name: string
  target: string
  /** Default 'done'. Non-'done' specs omit encodedBuffer (status-gate). */
  status?: 'done' | 'queued' | 'processing' | 'error'
  /** Override bytes used for the encodedBuffer. Default: [1,2,3] → base64 'AQID'. */
  bytes?: number[]
}

/** Inject FileEntry rows into filesAtom. Mirrors file-row-menu.spec.ts:34-72. */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(
    async ({ specs }) => {
      const filesUrl = '/src/stores/files.ts'
      const stubUrl = '/src/lib/stub-data.ts'
      const filesMod = (await import(/* @vite-ignore */ filesUrl)) as typeof import('../stores/files')
      const stubMod = (await import(/* @vite-ignore */ stubUrl)) as typeof import('../lib/stub-data')
      const { filesAtom } = filesMod
      const { defaultFileSettings } = stubMod

      const entries = specs.map((s, i) => {
        const byteArr = new Uint8Array(s.bytes ?? [1, 2, 3])
        const buffer = byteArr.buffer as ArrayBuffer
        const status = (s.status ?? 'done') as 'done' | 'queued' | 'processing' | 'error'
        return {
          id: s.id,
          name: s.name,
          type: 'png',
          orig: buffer.byteLength,
          opt: buffer.byteLength,
          status,
          target: s.target,
          dim: '1×1',
          q: 82,
          createdAt: Date.now() + i,
          settings: defaultFileSettings('png', 82),
          rawBuffer: buffer,
          // Only 'done' carries encodedBuffer (D-06 status-gate).
          ...(status === 'done' ? { encodedBuffer: buffer } : {}),
        }
      })

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    },
    { specs },
  )
}

async function openOutputTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'output' }).click()
  await expect(page.getByTestId('output-panel')).toBeVisible()
}

test.describe('OutputPanel — D-05 live refresh + D-06 per-status + D-15 chokepoint', () => {
  test('mutating encodedBuffer refreshes snippet text without re-selecting (D-05 SC-3)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp' }])
    await openOutputTab(page)

    // Initial snippet — base64 of [1,2,3] is 'AQID'.
    await page.waitForFunction(
      () => {
        const txt = document.querySelector('[data-testid="output-panel"] pre')?.textContent ?? ''
        return txt.includes('data:image/webp;base64,AQID')
      },
      undefined,
      { timeout: 3000 },
    )

    // Live mutation — swap bytes in-place. Mirrors useLiveEncode push path.
    await page.evaluate(async () => {
      // @ts-expect-error — `/src/...` is a Vite dev-server runtime path, not a TS-resolvable module specifier
      const filesMod = (await import(/* @vite-ignore */ '/src/stores/files.ts')) as typeof import('../stores/files')
      const { filesAtom } = filesMod
      const newBuf = new Uint8Array([89, 89, 89]).buffer
      const entries = filesAtom.get().entries.map((e) =>
        e.id === 'f1' ? { ...e, encodedBuffer: newBuf } : e,
      )
      filesAtom.setKey('entries', entries)
    })

    // Latch: base64 of [89,89,89] is 'WVlZ'. NO re-selection between mutation and assertion.
    await page.waitForFunction(
      () => {
        const txt = document.querySelector('[data-testid="output-panel"] pre')?.textContent ?? ''
        return txt.includes('WVlZ')
      },
      undefined,
      { timeout: 3000 },
    )
  })

  test('processing status renders skeleton + Copy is aria-disabled (D-06)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'f1', name: 'hero.png', target: 'webp', status: 'processing' },
    ])
    await openOutputTab(page)

    const skeleton = page.locator('[data-testid="output-panel"] [aria-label="Encoding in progress"]')
    // Three sections → three skeleton divs.
    await expect(skeleton.first()).toBeVisible()
    expect(await skeleton.count()).toBe(3)

    // Copy buttons are disabled (aria-disabled='true') with the 'Encoding in progress' tooltip.
    const copyBtn = page.getByRole('button', { name: 'Copy Base64 snippet' })
    await expect(copyBtn).toHaveAttribute('aria-disabled', 'true')
    await expect(copyBtn).toHaveAttribute('title', 'Encoding in progress')
  })

  test('queued status renders "Optimize this file first" in each section (D-06)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'f1', name: 'hero.png', target: 'webp', status: 'queued' },
    ])
    await openOutputTab(page)

    const placeholders = page
      .locator('[data-testid="output-panel"]')
      .getByText('Optimize this file first')
    expect(await placeholders.count()).toBe(3)

    // Copy disabled with the matching tooltip.
    const copyBtn = page.getByRole('button', { name: 'Copy Base64 snippet' })
    await expect(copyBtn).toHaveAttribute('aria-disabled', 'true')
    await expect(copyBtn).toHaveAttribute('title', 'Optimize this file first')
  })

  test('clicking Copy routes through copyToClipboard chokepoint (D-15)', async ({ page }) => {
    await installClipboardMocks(page, { mode: 'native' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp' }])
    await openOutputTab(page)

    // Wait for the snippet to derive (so the Copy button is enabled).
    await page.waitForFunction(
      () => {
        const txt = document.querySelector('[data-testid="output-panel"] pre')?.textContent ?? ''
        return txt.includes('data:image/webp;base64,')
      },
      undefined,
      { timeout: 3000 },
    )

    await page.getByRole('button', { name: 'Copy Base64 snippet' }).click()

    // Latch on the chokepoint write.
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __clipboardWrites?: string[] }
        return (w.__clipboardWrites?.length ?? 0) === 1
      },
      undefined,
      { timeout: 3000 },
    )

    const written = await page.evaluate(
      () => (window as unknown as { __clipboardWrites: string[] }).__clipboardWrites[0],
    )
    expect(written).toContain('data:image/webp;base64,')
    expect(written.startsWith('<img src="data:image/webp;base64,')).toBe(true)
  })
})
