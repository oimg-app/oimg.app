// Quick 260603-s2x — Playwright e2e for "Watch folder" Toolbar flow.
// Three tests:
//   1. Snapshot ingest: showDirectoryPicker mock with 3 image entries → 3 rows + toast.
//   2. No-observer fallback: delete window.FileSystemObserver → "one-shot" toast + 3 rows.
//   3. Observer lifecycle: invoke captured observer cb with synthetic 'appeared' → +1 row + "Added: ..." toast.
//
// Mock strategy (page.addInitScript at navigation):
//   - window.showDirectoryPicker → fake FileSystemDirectoryHandle whose values() is an
//     async generator yielding fake FileSystemFileHandle entries that getFile() returns
//     a real Blob (synthetic 1×1 PNG) wrapped as File.
//   - window.FileSystemObserver → constructor stashing the callback into window.__fsoCb
//     and recording observe/disconnect into window.__fsoCalls.
//
// The Playwright spec NEVER touches the real OS file system.
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// 1×1 transparent PNG (verified bytes — atob-safe at module load time).
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

interface InitScriptOpts {
  /** When true, deletes window.FileSystemObserver before pickDirectory runs. */
  noObserver: boolean
  /** When true, installs a recording FileSystemObserver constructor. */
  withObserverMock: boolean
}

/**
 * Install the Watch-folder mocks via addInitScript. Mocks fire BEFORE the page's
 * own scripts load, so by the time the React tree mounts useWatchFolder, both
 * showDirectoryPicker and (conditionally) FileSystemObserver are in place.
 */
async function installWatchMocks(page: Page, opts: InitScriptOpts): Promise<void> {
  await page.addInitScript(
    ({ TINY_PNG_B64, opts }) => {
      const w = window as unknown as {
        __fsoCb?: (records: unknown[]) => void
        __fsoCalls?: { observed: number; disconnected: number }
        showDirectoryPicker?: () => Promise<unknown>
        FileSystemObserver?: unknown
      }
      w.__fsoCalls = { observed: 0, disconnected: 0 }

      // Build the fake directory handle. values() is an async generator
      // yielding fake file handles whose getFile() returns a real File wrapping
      // a tiny PNG Blob.
      function decodeBase64(b64: string): ArrayBuffer {
        const bin = atob(b64)
        const buf = new ArrayBuffer(bin.length)
        const u8 = new Uint8Array(buf)
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
        return buf
      }
      const pngBuf = decodeBase64(TINY_PNG_B64)

      function makeFileHandle(name: string): unknown {
        return {
          kind: 'file' as const,
          name,
          getFile: async () => {
            const blob = new Blob([pngBuf], { type: 'image/png' })
            return new File([blob], name, { type: 'image/png' })
          },
        }
      }

      const fakeHandle = {
        kind: 'directory' as const,
        name: 'Pictures',
        async *values() {
          yield makeFileHandle('alpha.png')
          yield makeFileHandle('beta.png')
          yield makeFileHandle('gamma.png')
        },
      }

      w.showDirectoryPicker = async () => fakeHandle

      if (opts.withObserverMock) {
        class FakeFSObserver {
          constructor(cb: (records: unknown[]) => void) {
            // Stash callback so test can invoke it from page.evaluate.
            ;(window as unknown as { __fsoCb: typeof cb }).__fsoCb = cb
          }
          async observe(): Promise<void> {
            ;(window as unknown as { __fsoCalls: { observed: number } }).__fsoCalls.observed += 1
          }
          disconnect(): void {
            ;(window as unknown as { __fsoCalls: { disconnected: number } }).__fsoCalls.disconnected += 1
          }
        }
        w.FileSystemObserver = FakeFSObserver as unknown
      }
      if (opts.noObserver) {
        // Ensure no observer constructor is present even if some other init injected one.
        try { delete (w as { FileSystemObserver?: unknown }).FileSystemObserver } catch { /* noop */ }
      }
    },
    { TINY_PNG_B64, opts },
  )
}

/** Open the Toolbar "Add files options" popover and click "Watch folder". */
async function clickWatchFolder(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add files options' }).click()
  await page.getByRole('button', { name: 'Watch folder' }).click()
}

/**
 * Bridge runtimeAtom.toasts onto window.__toasts so test asserts read from the
 * SAME module instance that the app's pushToast() writes to (backpressure.spec.ts
 * precedent — the dynamic-import path inside page.evaluate can resolve to a
 * different module URL than the alias resolution used by the React tree).
 */
async function bridgeRuntimeToasts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const runtimeUrl = '/src/stores/runtime.ts'
    const mod = (await import(/* @vite-ignore */ runtimeUrl)) as typeof import('../stores/runtime')
    mod.runtimeAtom.subscribe((s) => {
      ;(window as unknown as { __toasts: string[] }).__toasts = s.toasts.map((t) => t.msg)
    })
  })
}

test.describe('Toolbar — Watch folder (Quick 260603-s2x)', () => {
  test('snapshot ingest with observer mock — 3 entries + Watching toast', async ({ page }) => {
    await installWatchMocks(page, { noObserver: false, withObserverMock: true })
    await page.goto('/')
    await bridgeRuntimeToasts(page)

    await clickWatchFolder(page)

    // Expect 3 image entries to land in the files pane.
    const pane = page.getByTestId('files-pane')
    await expect(pane.getByText('alpha.png')).toBeVisible({ timeout: 5000 })
    await expect(pane.getByText('beta.png')).toBeVisible()
    await expect(pane.getByText('gamma.png')).toBeVisible()

    // The Watching toast should surface (via runtimeAtom.toasts, bridged to window.__toasts).
    await page.waitForFunction(
      () => {
        const t = (window as unknown as { __toasts?: string[] }).__toasts ?? []
        return t.some((m) => m.startsWith('Watching Pictures'))
      },
      undefined,
      { timeout: 5000 },
    )

    // Observer was attached (no disconnect yet — the watcher is active).
    const calls = await page.evaluate(
      () => (window as unknown as { __fsoCalls: { observed: number; disconnected: number } }).__fsoCalls,
    )
    expect(calls.observed).toBeGreaterThanOrEqual(1)
  })

  test('no-observer fallback — one-shot toast surfaces and 3 entries still ingest', async ({ page }) => {
    await installWatchMocks(page, { noObserver: true, withObserverMock: false })
    await page.goto('/')
    await bridgeRuntimeToasts(page)

    await clickWatchFolder(page)

    const pane = page.getByTestId('files-pane')
    await expect(pane.getByText('alpha.png')).toBeVisible({ timeout: 5000 })
    await expect(pane.getByText('beta.png')).toBeVisible()
    await expect(pane.getByText('gamma.png')).toBeVisible()

    await page.waitForFunction(
      () => {
        const t = (window as unknown as { __toasts?: string[] }).__toasts ?? []
        return t.some((m) => m.includes('one-shot'))
      },
      undefined,
      { timeout: 5000 },
    )
  })

  test('observer callback ingests appeared file + Added toast', async ({ page }) => {
    await installWatchMocks(page, { noObserver: false, withObserverMock: true })
    await page.goto('/')
    await bridgeRuntimeToasts(page)

    await clickWatchFolder(page)

    // Wait for snapshot ingest to settle (3 rows) AND the observer constructor to be called.
    const pane = page.getByTestId('files-pane')
    await expect(pane.getByText('alpha.png')).toBeVisible({ timeout: 5000 })

    await page.waitForFunction(
      () => typeof (window as unknown as { __fsoCb?: unknown }).__fsoCb === 'function',
      undefined,
      { timeout: 5000 },
    )

    // Manually invoke the captured observer callback with a synthetic 'appeared' record
    // for a brand-new file 'delta.png'.
    await page.evaluate(async () => {
      const w = window as unknown as {
        __fsoCb: (records: unknown[]) => void
      }
      const newFileHandle = {
        kind: 'file' as const,
        name: 'delta.png',
        getFile: async () => {
          // Decode a tiny PNG inline for the appeared file too.
          const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
          const bin = atob(b64)
          const u8 = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
          const blob = new Blob([u8], { type: 'image/png' })
          return new File([blob], 'delta.png', { type: 'image/png' })
        },
      }
      w.__fsoCb([{ type: 'appeared', changedHandle: newFileHandle }])
    })

    // The new row should appear, and an "Added: delta.png" toast should land.
    await expect(pane.getByText('delta.png')).toBeVisible({ timeout: 5000 })
    await page.waitForFunction(
      () => {
        const t = (window as unknown as { __toasts?: string[] }).__toasts ?? []
        return t.some((m) => m === 'Added: delta.png')
      },
      undefined,
      { timeout: 5000 },
    )
  })
})
