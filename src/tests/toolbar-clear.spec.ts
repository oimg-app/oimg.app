// Phase 13 — CLR-01 / D-14 / T-13-03: Toolbar Clear all disable + warning-toast e2e.
// Covers:
//   Test 1 (D-14): empty queue → 'Clear all' has aria-disabled=true AND title='No files to clear'
//   Test 2 (idle path, runningJobs=0, entries exist): click 'Clear all' → filesAtom emptied + popover closes
//   Test 3 (T-13-03 in-flight): inject entries + setJobCounts(2,0) → click 'Clear all' →
//     sonner toast 'Cancel 2 in-flight jobs?' appears, queue NOT yet emptied; click 'Clear anyway' → queue empties.
//
// Analog: src/tests/file-row-menu.spec.ts injectEntries (lines 34-72) +
//         src/tests/status-bar.spec.ts page.goto + page.evaluate dynamic-import pattern
//         (MEMORY: /src/... page.evaluate imports are an accepted Vite pattern).
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

interface InjectSpec {
  id: string
  name: string
  target: string
  status?: 'done' | 'queued' | 'processing' | 'error'
}

/** Inject FileEntry rows into filesAtom — mirrors file-row-menu.spec.ts:34-72. */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(
    async ({ specs, TINY_PNG_B64 }) => {
      // Absolute /src/... per CLAUDE.md MEMORY (accepted Vite pattern).
      const filesMod = (await import('/src/stores/files.ts'))
      const stubMod = (await import('/src/lib/stub-data.ts'))
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
        status: (s.status ?? 'queued') as 'done' | 'queued' | 'processing' | 'error',
        target: s.target,
        dim: '1×1',
        q: 82,
        createdAt: Date.now() + i,
        settings: defaultFileSettings('png', 82),
        rawBuffer: buffer,
      }))

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    },
    { specs, TINY_PNG_B64 },
  )
}

/** Force runtimeAtom.runningJobs > 0 via the existing setJobCounts setter. */
async function setRunningJobs(page: Page, running: number, queued: number): Promise<void> {
  await page.evaluate(
    async ({ running, queued }) => {
      const m = (await import('/src/stores/runtime.ts'))
      m.setJobCounts(running, queued)
    },
    { running, queued },
  )
}

test.describe('Toolbar — Clear all (D-14 + T-13-03)', () => {
  test('D-14: empty queue → Clear all has aria-disabled=true + title="No files to clear"', async ({ page }) => {
    await page.goto('/')
    // No entries injected — queue is empty.
    await page.getByRole('button', { name: 'Open settings' }).click()
    const clearBtn = page.getByRole('button', { name: /^Clear all$/ })
    await expect(clearBtn).toBeVisible()
    await expect(clearBtn).toHaveAttribute('aria-disabled', 'true')
    await expect(clearBtn).toHaveAttribute('title', 'No files to clear')
  })

  test('idle path (runningJobs=0): click Clear all → queue empties + popover closes', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'a.png', target: 'webp' },
      { id: 'b', name: 'b.png', target: 'webp' },
      { id: 'c', name: 'c.png', target: 'webp' },
    ])
    await expect(page.getByTestId('status-filecount')).toHaveText('3 files')

    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('button', { name: /^Clear all$/ }).click()

    // Queue empties via clearFiles() called directly.
    await expect(page.getByTestId('status-filecount')).toHaveText('0 files')

    // Popover closed via setOpen(null) — the menu Clear all button no longer in DOM.
    await expect(page.getByRole('button', { name: /^Clear all$/ })).toHaveCount(0)
  })

  test('T-13-03: in-flight runningJobs>0 → warning toast + Clear anyway empties queue', async ({ page }) => {
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'a.png', target: 'webp' },
      { id: 'b', name: 'b.png', target: 'webp' },
      { id: 'c', name: 'c.png', target: 'webp' },
    ])
    await expect(page.getByTestId('status-filecount')).toHaveText('3 files')

    // Force runtimeAtom.runningJobs = 2 via the existing exported setter.
    await setRunningJobs(page, 2, 0)

    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('button', { name: /^Clear all$/ }).click()

    // Warning toast appears with the template-literal message.
    await expect(page.getByText(/Cancel 2 in-flight jobs/)).toBeVisible()

    // Queue NOT yet emptied — confirmation gate held.
    await expect(page.getByTestId('status-filecount')).toHaveText('3 files')

    // User clicks "Clear anyway" → clearFiles fires from the toast action.
    await page.getByRole('button', { name: /^Clear anyway$/ }).click()

    await expect(page.getByTestId('status-filecount')).toHaveText('0 files')
  })
})
