// Phase 15 — ING-01: Playwright e2e for the Toolbar "From URL or paste"
// wire-up shipped in 15-04 (Toolbar.tsx onClick → pickFromClipboard).
// Source: 15-04-PLAN.md Task 3 + 15-RESEARCH.md §9 task 15-04.
//
// Three scenarios:
//   A) Happy path  — navigator.clipboard.read is stubbed to return a
//      ClipboardItem holding a tiny PNG. Clicking "Add files ▾" → "From
//      URL or paste" must produce an entry in filesAtom AND surface the
//      'Pasted image imported' sonner toast AND close the popover.
//   B) Negative   — navigator.clipboard.read is stubbed to throw
//      NotAllowedError and navigator.clipboard.readText to return empty.
//      Clicking the same menu item must surface the 'Clipboard has no
//      image or image URL' toast (D-03 negative path) AND NOT add a file.
//   C) Stub retired — Node-side fs.readFileSync assertion that
//      src/stores/files.ts and src/components/shell/Toolbar.tsx contain
//      zero `addFromUrl` references (SC-5 / D-14 enforcement).
//
// page.addInitScript installs the clipboard shim BEFORE app boot so the
// shim is in place by the time React renders the Toolbar onClick handler.
// Toast assertions use the sonner DOM render selector `[data-sonner-toast]`
// (same pattern as url-ingest.spec.ts / paste-ingest.spec.ts).
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 1×1 transparent PNG (verified bytes — shared with url-ingest.spec.ts and
// paste-ingest.spec.ts).
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

test.describe('Phase 15 ING-01 — Toolbar From URL or paste (e2e)', () => {
  test('Case A: clipboard image → entry appears + success toast + popover closes', async ({
    page,
  }) => {
    // Install the clipboard shim BEFORE navigation so it's in place at boot.
    // navigator.clipboard.read() returns a single ClipboardItem whose getType
    // resolves to a tiny PNG Blob.
    await page.addInitScript((pngB64: string) => {
      const bin = atob(pngB64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      const item = {
        types: ['image/png'],
        getType: async (_t: string) => blob,
      }
      const shim = {
        read: async () => [item],
        readText: async () => '',
        // Phase 12 write-direction methods remain available for unrelated paths.
        writeText: async (_t: string) => {},
        write: async (_items: unknown[]) => {},
      }
      // Override the clipboard property (read-only on most surfaces).
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: shim,
      })
    }, TINY_PNG_B64)

    await page.goto('/')

    // Toolbar must be mounted before we click the caret.
    await expect(page.getByTestId('toolbar')).toBeVisible()

    // Open the Add files ▾ popover.
    await page.getByRole('button', { name: 'Add files options' }).click()

    // Click the "From URL or paste" menu item.
    await page.getByRole('button', { name: 'From URL or paste' }).click()

    // Entry must land in filesAtom (pickFromClipboard is async → ingest writes
    // synchronously after the await). Filename is `pasted-<ts>.png` per
    // clipboard-ingest.ts:68.
    await page.waitForFunction(
      async () => {
        const mod = (await import(/* @vite-ignore */ '/src/stores/files.ts')) as {
          filesAtom: { get(): { entries: { name: string }[] } }
        }
        return mod.filesAtom
          .get()
          .entries.some((e) => /^pasted-\d+\.png$/.test(e.name))
      },
      undefined,
      { timeout: 10_000 },
    )

    // Sonner success toast for the image branch — see clipboard-ingest.ts:71.
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /Pasted image imported/,
    })
    await expect(toast).toBeVisible({ timeout: 5_000 })

    // Popover closed: the "From URL or paste" menu item must no longer be in
    // the DOM (Radix unmounts content on close).
    await expect(
      page.getByRole('button', { name: 'From URL or paste' }),
    ).toHaveCount(0)
  })

  test('Case B: empty clipboard → "no image or image URL" toast + no entry', async ({
    page,
  }) => {
    // Install a shim that fails the image branch AND returns empty text. This
    // exercises the D-03 negative path in clipboard-ingest.ts:102.
    await page.addInitScript(() => {
      const shim = {
        read: async () => {
          throw new DOMException('denied', 'NotAllowedError')
        },
        readText: async () => '',
        writeText: async (_t: string) => {},
        write: async (_items: unknown[]) => {},
      }
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: shim,
      })
    })

    await page.goto('/')
    await expect(page.getByTestId('toolbar')).toBeVisible()

    await page.getByRole('button', { name: 'Add files options' }).click()
    await page.getByRole('button', { name: 'From URL or paste' }).click()

    // Negative toast — clipboard-ingest.ts:102 toast.message wording.
    const noImageToast = page.locator('[data-sonner-toast]').filter({
      hasText: /Clipboard has no image or image URL/,
    })
    await expect(noImageToast).toBeVisible({ timeout: 5_000 })

    // No entry was added.
    const count = await page.evaluate(async () => {
      const mod = (await import(/* @vite-ignore */ '/src/stores/files.ts')) as {
        filesAtom: { get(): { entries: unknown[] } }
      }
      return mod.filesAtom.get().entries.length
    })
    expect(count).toBe(0)

    // Success toast must NOT be present.
    const successToast = page.locator('[data-sonner-toast]').filter({
      hasText: /Pasted image imported/,
    })
    await expect(successToast).toHaveCount(0)
  })

  test('Case C: addFromUrl stub fully retired in src tree (D-14 / SC-5)', () => {
    // Static source-grep guard — protects against future regressions that
    // accidentally reintroduce the empty stub or its import.
    const filesSrc = readFileSync(
      resolve(process.cwd(), 'src/stores/files.ts'),
      'utf8',
    )
    const toolbarSrc = readFileSync(
      resolve(process.cwd(), 'src/components/shell/Toolbar.tsx'),
      'utf8',
    )

    expect(filesSrc).not.toContain('addFromUrl')
    expect(toolbarSrc).not.toContain('addFromUrl')

    // And the new dispatcher import IS present (positive regression lock).
    expect(toolbarSrc).toContain("from \"@/lib/clipboard-ingest\"")
    expect(toolbarSrc).toContain('pickFromClipboard({ ingest })')
  })
})
