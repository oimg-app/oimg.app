// Phase 11 — Plan 05 (EXP-02): batch ZIP export e2e.
// Covers:
//   - Test 1 (happy): 5 entries → ZIP with 5 entries, extensions swapped (D-05)
//   - Test 2 (D-10): saved filename matches /^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/
//   - Test 3 (D-10): 3 entries named dup.png → dup.webp, dup (1).webp, dup (2).webp
//   - Test 4 (D-08): ZIP entry count === done count (no originals)
//   - Test 5 (D-09): no entry name contains '/' (flat layout)
//   - Test 6 (D-12): one error-state entry → toast surfaces "N exported, 1 skipped"
//
// Strategy:
//   - Inject ready-to-export FileEntry objects directly into filesAtom (status:'done',
//     encodedBuffer:set). This avoids the codec encode path (already covered by
//     codec-encoders.spec.ts) and lets us pin exactly which names + targets land
//     in the ZIP.
//   - installSaveFileMocks captures the ZIP blob into window.__savedFiles. The blob
//     bytes round-trip through page.evaluate as a number[] (ArrayBuffers don't
//     serialize) so we can parse the local-file-header records on the Node side
//     without adding a fflate dep.
//   - Click the Toolbar Export button (primary action = exportZip) to drive the
//     real production path through useExport → buildZip → saveBlob.
//
// Setup: src/tests/setup/save-file-mocks.ts (Plan 00).
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSaveFileMocks } from './setup/save-file-mocks'

// 1×1 PNG bytes — same constant used by ingest-helper, kept inline so the
// page.evaluate body is self-contained.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

interface InjectSpec {
  id: string
  name: string
  target: string
  status?: 'done' | 'error'
  error?: string
}

/**
 * Inject one or more FileEntry rows with `encodedBuffer` set (or error state)
 * so the export path treats them as ready / skipped without running a codec.
 */
async function injectEntries(page: Page, specs: InjectSpec[]): Promise<void> {
  await page.evaluate(
    async ({ specs, TINY_PNG_B64 }) => {
      const filesUrl = '/src/stores/files.ts'
      const stubUrl = '/src/lib/stub-data.ts'
      const filesMod = (await import(/* @vite-ignore */ filesUrl)) as typeof import('../stores/files')
      const stubMod = (await import(/* @vite-ignore */ stubUrl)) as typeof import('../lib/stub-data')
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
        status: (s.status ?? 'done') as 'done' | 'error',
        target: s.target,
        dim: '1×1',
        q: 82,
        createdAt: Date.now() + i,
        settings: defaultFileSettings('png', 82),
        rawBuffer: buffer,
        // Error entries must NOT carry an encodedBuffer (D-12 skip).
        ...(s.status === 'error'
          ? { error: s.error ?? 'mock failure' }
          : { encodedBuffer: buffer }),
      }))

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
    },
    { specs, TINY_PNG_B64 },
  )
}

/**
 * Pull the last saved-file payload bytes out of the page as a Node Buffer.
 * Returns null if no save was recorded.
 */
async function readSavedZipBytes(page: Page): Promise<{ name: string; bytes: Buffer } | null> {
  const payload = await page.evaluate(() => {
    type Win = Window & {
      __savedFiles?: Array<{ name: string; bytes: ArrayBuffer }>
    }
    const arr = (window as unknown as Win).__savedFiles ?? []
    if (arr.length === 0) return null
    const last = arr[arr.length - 1]
    // Serialize the ArrayBuffer as a number[] so it survives JSON channel.
    return { name: last.name, bytes: Array.from(new Uint8Array(last.bytes)) }
  })
  if (!payload) return null
  return { name: payload.name, bytes: Buffer.from(payload.bytes) }
}

/**
 * Minimal local-file-header scanner — extracts entry names + file sizes from a
 * ZIP blob WITHOUT needing a full unzip dep. Walks PK\x03\x04 signatures
 * (0x04034b50 little-endian), reads filename length at offset +26 and the
 * filename string at offset +30.
 *
 * jszip writes local file headers up-front for every entry (streamFiles:true
 * mode included). The central directory at the tail is ignored — we only need
 * entry names and counts for the assertions in this spec.
 */
function parseZipEntries(buf: Buffer): Array<{ name: string; compressedSize: number; uncompressedSize: number }> {
  const SIG = 0x04034b50
  const entries: Array<{ name: string; compressedSize: number; uncompressedSize: number }> = []
  let off = 0
  while (off + 30 <= buf.length) {
    const sig = buf.readUInt32LE(off)
    if (sig !== SIG) break
    const compressedSize = buf.readUInt32LE(off + 18)
    const uncompressedSize = buf.readUInt32LE(off + 22)
    const nameLen = buf.readUInt16LE(off + 26)
    const extraLen = buf.readUInt16LE(off + 28)
    const name = buf.slice(off + 30, off + 30 + nameLen).toString('utf8')
    entries.push({ name, compressedSize, uncompressedSize })
    // Advance past header + name + extra + (streamed) compressed payload.
    // streamFiles mode writes sizes into the local header AFTER the data;
    // when the local header carries zero sizes, the actual sizes are
    // recoverable via a data descriptor (PK\x07\x08) immediately after the
    // compressed payload. For this spec, we only need names + counts, so
    // we bail out of the local-header walk once we hit an entry with
    // zero-length local-header sizes and a missing payload boundary —
    // jszip in non-streaming-data mode emits real sizes, which is the
    // common path with our small fixtures.
    if (compressedSize === 0 && uncompressedSize === 0) {
      // streamFiles wrote sizes deferred → find the next local file header
      // by scanning forward for the next PK\x03\x04 signature.
      let next = off + 30 + nameLen + extraLen
      while (next + 4 <= buf.length) {
        if (buf.readUInt32LE(next) === SIG) break
        next++
      }
      off = next
    } else {
      off += 30 + nameLen + extraLen + compressedSize
    }
  }
  return entries
}

test.describe('EXP-02 — Batch ZIP', () => {
  test('Test 1 (happy path): 5 done entries → valid ZIP with 5 swapped-extension names (D-05)', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'one.png', target: 'webp' },
      { id: 'b', name: 'two.png', target: 'webp' },
      { id: 'c', name: 'three.png', target: 'webp' },
      { id: 'd', name: 'four.png', target: 'webp' },
      { id: 'e', name: 'five.png', target: 'webp' },
    ])

    await page.getByRole('button', { name: 'Export' }).first().click()

    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 10_000 },
    )

    const saved = await readSavedZipBytes(page)
    expect(saved).not.toBeNull()
    // PK\x03\x04 local-file-header signature on first 4 bytes.
    expect(saved!.bytes.readUInt32LE(0)).toBe(0x04034b50)

    const entries = parseZipEntries(saved!.bytes)
    expect(entries).toHaveLength(5)
    // D-05: every entry's extension is swapped to .webp
    for (const e of entries) {
      expect(e.name.endsWith('.webp')).toBe(true)
    }
    // The five base names appear (order may vary; jszip preserves insertion).
    const names = entries.map((e) => e.name).sort()
    expect(names).toEqual(['five.webp', 'four.webp', 'one.webp', 'three.webp', 'two.webp'])
  })

  test('Test 2 (D-10 filename pattern): saved name matches oimg-export-YYYY-MM-DD-HHMM.zip', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [{ id: 'a', name: 'lonely.png', target: 'webp' }])

    await page.getByRole('button', { name: 'Export' }).first().click()
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 10_000 },
    )

    const saved = await readSavedZipBytes(page)
    expect(saved!.name).toMatch(/^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/)
  })

  test('Test 3 (D-10 collision suffix): 3 dup.png → dup.webp + dup (1).webp + dup (2).webp', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'dup.png', target: 'webp' },
      { id: 'b', name: 'dup.png', target: 'webp' },
      { id: 'c', name: 'dup.png', target: 'webp' },
    ])

    await page.getByRole('button', { name: 'Export' }).first().click()
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 10_000 },
    )

    const saved = await readSavedZipBytes(page)
    const entries = parseZipEntries(saved!.bytes)
    expect(entries).toHaveLength(3)
    const names = entries.map((e) => e.name).sort()
    expect(names).toEqual(['dup (1).webp', 'dup (2).webp', 'dup.webp'])
  })

  test('Test 4 (D-08 optimized only): ZIP entry count equals done count', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'a.png', target: 'webp' },
      { id: 'b', name: 'b.png', target: 'webp' },
      { id: 'c', name: 'c.png', target: 'webp' },
    ])

    await page.getByRole('button', { name: 'Export' }).first().click()
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 10_000 },
    )

    const saved = await readSavedZipBytes(page)
    const entries = parseZipEntries(saved!.bytes)
    // 3 done → 3 ZIP entries. No "originals" bonus copy (D-08).
    expect(entries).toHaveLength(3)
  })

  test('Test 5 (D-09 flat layout): no entry name contains "/"', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'flat-one.png', target: 'webp' },
      { id: 'b', name: 'flat-two.png', target: 'webp' },
    ])

    await page.getByRole('button', { name: 'Export' }).first().click()
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 10_000 },
    )

    const saved = await readSavedZipBytes(page)
    const entries = parseZipEntries(saved!.bytes)
    for (const e of entries) {
      expect(e.name.includes('/')).toBe(false)
      expect(e.name.includes('\\')).toBe(false)
    }
  })

  test('Test 6 (D-12 skipped count): 4 done + 1 error → toast surfaces "4 files exported, 1 skipped"', async ({ page }) => {
    await installSaveFileMocks(page, { mode: 'accept' })
    await page.goto('/')
    await injectEntries(page, [
      { id: 'a', name: 'ok-1.png', target: 'webp' },
      { id: 'b', name: 'ok-2.png', target: 'webp' },
      { id: 'c', name: 'ok-3.png', target: 'webp' },
      { id: 'd', name: 'ok-4.png', target: 'webp' },
      { id: 'e', name: 'broken.png', target: 'webp', status: 'error', error: 'simulated codec failure' },
    ])

    await page.getByRole('button', { name: 'Export' }).first().click()
    await page.waitForFunction(
      () => (window as unknown as { __savedFiles?: Array<unknown> }).__savedFiles?.length === 1,
      undefined,
      { timeout: 10_000 },
    )

    const saved = await readSavedZipBytes(page)
    const entries = parseZipEntries(saved!.bytes)
    // D-08 + D-12: 4 ok entries → 4 ZIP entries; broken.png skipped.
    expect(entries).toHaveLength(4)

    // D-12: toast surfaces skipped count. sonner renders toasts in the DOM
    // with data-sonner-toast on each item.
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /4 files exported, 1 skipped/,
    })
    await expect(toast).toBeVisible({ timeout: 5_000 })
  })
})
