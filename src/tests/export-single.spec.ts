// Phase 11 — Plan 04 (EXP-01): single-file Inspector Download e2e.
// Covers three paths required by D-04 + D-07:
//   1. Native picker path (Chromium-style): showSaveFilePicker is called with
//      the swapped extension (D-05) and the file appears in window.__savedFiles.
//   2. Fallback path (Firefox/Safari simulation): saveAs anchor-click recorded
//      in window.__saveAsCalls.
//   3. User-cancel: AbortError from the picker is swallowed silently — no toast
//      surfaces (Pitfall 2).
//
// Setup helpers: src/tests/setup/save-file-mocks.ts (Plan 00).
// Test discipline: latches use page.waitForFunction (deterministic state checks
// rather than fixed sleeps) per MEMORY note "latch transient e2e states".
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSaveFileMocks } from './setup/save-file-mocks'

/**
 * Inject a single "done" PNG entry with an `encodedBuffer` set, ready for Download.
 * ingestFixtureFiles seeds entries with status:'done' but no encodedBuffer; the
 * Download button gates on encodedBuffer being present, so we set it explicitly
 * here using the same TINY_PNG bytes as the raw buffer.
 *
 * The entry's `target` is set to 'webp' so the test asserts D-05 ext-swap
 * (png → webp) actually happened in the saved filename.
 */
async function injectDoneFile(page: Page, id = 'fixture-0', name = 'fixture-0.png'): Promise<void> {
  await page.evaluate(
    async ({ id, name }) => {
      
      
      const filesMod = (await import('../stores/files'))
      const stubMod = (await import('../lib/stub-data'))
      const { filesAtom } = filesMod
      const { defaultFileSettings } = stubMod

      const TINY_PNG_B64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const bin = atob(TINY_PNG_B64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      const ab = buf.buffer as ArrayBuffer

      const entry = {
        id,
        name,
        type: 'png',
        orig: ab.byteLength,
        opt: ab.byteLength,
        status: 'done' as const,
        target: 'webp', // D-05: ensure ext-swap is visible in the saved filename
        dim: '1×1',
        q: 82,
        createdAt: Date.now(),
        settings: defaultFileSettings('png', 82),
        rawBuffer: ab,
        encodedBuffer: ab, // required for exportOne guard
      }

      filesAtom.setKey('entries', [entry])
      filesAtom.setKey('selectedId', id)
    },
    { id, name },
  )
}

/**
 * Open the inspector Report tab and wait for the Download button to be visible.
 * The Inspector defaults to the codec tab; report carries the Download button.
 */
async function openReportTab(page: Page): Promise<void> {
  await page.getByTestId('files-pane').getByText('fixture-0.png').click()
  await page.getByRole('button', { name: 'report' }).click()
  await expect(page.getByRole('button', { name: 'Download optimized file' })).toBeVisible()
}

test.describe('EXP-01 — Inspector single-file Download', () => {
  test('native picker path: showSaveFilePicker fires with swapped extension (D-05)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectDoneFile(page)
    await openReportTab(page)

    await page.getByRole('button', { name: 'Download optimized file' }).click()

    // Latch on the recorded save (deterministic vs fixed sleep)
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<{ name: string }> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 5000 },
    )

    // ArrayBuffers don't serialize cleanly through page.evaluate's JSON channel —
    // pull name + byteLength via evaluate, not the raw ArrayBuffer instance.
    const saved = await page.evaluate(() => {
      const arr = (window as unknown as { __savedFiles: Array<{ name: string; bytes: ArrayBuffer }> }).__savedFiles
      return arr.map((s) => ({ name: s.name, byteLength: s.bytes.byteLength }))
    })
    expect(saved).toHaveLength(1)
    // D-05: name was renamed from fixture-0.png → fixture-0.webp (target='webp')
    expect(saved[0].name).toBe('fixture-0.webp')
    // Bytes flowed through (non-zero)
    expect(saved[0].byteLength).toBeGreaterThan(0)

    // The fallback path must NOT have fired when the native picker succeeded
    const fallbackCalls = await page.evaluate(
      () => (window as unknown as { __saveAsCalls: Array<unknown> }).__saveAsCalls.length,
    )
    expect(fallbackCalls).toBe(0)
  })

  test('fallback path: no showSaveFilePicker → file-saver saveAs fires (Firefox/Safari)', async ({ page }) => {
    // Install accept-mode mocks first (sets up the saveAs anchor-click spy),
    // then strip showSaveFilePicker BEFORE app boot to simulate Firefox/Safari.
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.addInitScript(() => {
      try {
        delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
      } catch {
        // some browsers refuse `delete` on window props — overwrite instead
        ;(window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined
      }

      // file-saver dispatches a click on a DETACHED anchor (it never appends to DOM
      // before click(a)). Save-file-mocks' document-level click listener can't see
      // detached-node events, so wrap HTMLAnchorElement.prototype.dispatchEvent to
      // also record the (download, href→blob) pair into __saveAsCalls. The mocks'
      // createObjectURL wrapper has already populated the blob-by-url map.
      type Win = Window & {
        __saveAsCalls?: Array<{ name: string; blobSize: number }>
        __blobByUrl?: Map<string, Blob>
      }
      const w = window as unknown as Win
      const origDispatch = HTMLAnchorElement.prototype.dispatchEvent
      // Hijack createObjectURL again to populate a window-visible map (the
      // save-file-mocks version keeps its blobByUrl in a closure).
      const origCreate = URL.createObjectURL.bind(URL)
      w.__blobByUrl = new Map()
      URL.createObjectURL = function patched(obj: Blob | MediaSource) {
        const url = origCreate(obj)
        if (obj instanceof Blob) w.__blobByUrl!.set(url, obj)
        return url
      }
      HTMLAnchorElement.prototype.dispatchEvent = function patchedDispatch(this: HTMLAnchorElement, ev: Event) {
        if (ev.type === 'click' && this.hasAttribute('download')) {
          const href = this.getAttribute('href') ?? ''
          const blob = w.__blobByUrl?.get(href)
          if (blob) {
            const name = this.getAttribute('download') ?? 'unnamed.bin'
            const arr = w.__saveAsCalls ?? (w.__saveAsCalls = [])
            arr.push({ name, blobSize: blob.size })
            return true // suppress navigation
          }
        }
        return origDispatch.call(this, ev)
      }
    })

    await page.goto('/')
    await injectDoneFile(page)
    await openReportTab(page)

    await page.getByRole('button', { name: 'Download optimized file' }).click()

    // Latch on the recorded saveAs call (deterministic vs fixed sleep)
    await page.waitForFunction(
      () => (window as unknown as { __saveAsCalls?: Array<{ name: string }> }).__saveAsCalls?.length === 1,
      undefined,
      { timeout: 5000 },
    )

    const saveAsCalls = await page.evaluate(
      () => (window as unknown as { __saveAsCalls: Array<{ name: string; blobSize: number }> }).__saveAsCalls,
    )
    expect(saveAsCalls).toHaveLength(1)
    expect(saveAsCalls[0].name).toBe('fixture-0.webp')
    expect(saveAsCalls[0].blobSize).toBeGreaterThan(0)

    // showSaveFilePicker was removed → no __savedFiles entry
    const saved = await page.evaluate(
      () => (window as unknown as { __savedFiles: Array<unknown> }).__savedFiles.length,
    )
    expect(saved).toBe(0)
  })

  test('user cancel (AbortError) is silently swallowed — no toast', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'cancel' })
    await page.goto('/')
    await injectDoneFile(page)
    await openReportTab(page)

    // Capture any console errors to assert silent failure
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.getByRole('button', { name: 'Download optimized file' }).click()

    // Settle window: 500ms is enough for any erroneous toast or fallback to fire.
    await page.waitForTimeout(500)

    // No sonner toast must appear
    const toastCount = await page.locator('[data-sonner-toast]').count()
    expect(toastCount).toBe(0)

    // Neither native nor fallback path recorded a file (cancel = silent no-op)
    const saved = await page.evaluate(
      () => (window as unknown as { __savedFiles: Array<unknown> }).__savedFiles.length,
    )
    expect(saved).toBe(0)
    const fallbackCalls = await page.evaluate(
      () => (window as unknown as { __saveAsCalls: Array<unknown> }).__saveAsCalls.length,
    )
    expect(fallbackCalls).toBe(0)

    // No console errors leaked from the AbortError
    expect(consoleErrors).toEqual([])
  })
})
