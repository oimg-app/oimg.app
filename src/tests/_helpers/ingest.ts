// change:add-black-box-e2e-suite — get files into the queue.
//
// Two routes, deliberately distinct:
//   ingestPng/ingestSvg/ingestFiles  → the REAL pipeline (setInputFiles → useIngest → encode).
//                                      Slower; use when the ingest path itself is under test.
//   injectEntries                    → store injection, no encode. Fast; use when a test needs
//                                      rows to exist so it can exercise something downstream.
import type { Page } from '@playwright/test'
import { PNG_1x1, SVG_SIMPLE, b64ToBuffer } from './fixtures'
import { FILES_MOD, SETTINGS_LIB_MOD } from './page-modules'

type FilesModule = typeof import('../../stores/files')
type SettingsLibModule = typeof import('../../lib/settings')

export interface IngestFile {
  name: string
  mimeType: string
  buffer: Buffer
}

const FILE_INPUT = '[data-testid="file-input"]'

/** Waits until every named file is present in filesAtom. */
async function waitForNames(page: Page, names: string[], timeout: number): Promise<void> {
  await page.waitForFunction(
    async ({ mod, expected }: { mod: string; expected: string[] }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const have = new Set(filesAtom.get().entries.map((e) => e.name))
      return expected.every((n) => have.has(n))
    },
    { mod: FILES_MOD, expected: names },
    { timeout },
  )
}

/**
 * Pushes files through the hidden file input — the same path a real drop or picker takes.
 * Resolves once every file is in the store; it does NOT wait for encoding (see encode.ts).
 */
export async function ingestFiles(page: Page, files: IngestFile[], timeout = 10_000): Promise<void> {
  await page.setInputFiles(
    FILE_INPUT,
    files.map((f) => ({ name: f.name, mimeType: f.mimeType, buffer: f.buffer })),
  )
  await waitForNames(page, files.map((f) => f.name), timeout)
}

/** Ingests `count` real PNGs named `<prefix>-0.png`, `<prefix>-1.png`, … */
export async function ingestPng(
  page: Page,
  { count = 1, prefix = 'png', b64 = PNG_1x1 }: { count?: number; prefix?: string; b64?: string } = {},
): Promise<string[]> {
  const names = Array.from({ length: count }, (_, i) => `${prefix}-${i}.png`)
  await ingestFiles(
    page,
    names.map((name) => ({ name, mimeType: 'image/png', buffer: b64ToBuffer(b64) })),
  )
  return names
}

/** Ingests one real SVG. SVG arrives as markup, not base64 — hence the separate path. */
export async function ingestSvg(
  page: Page,
  { name = 'fixture.svg', markup = SVG_SIMPLE }: { name?: string; markup?: string } = {},
): Promise<string> {
  await ingestFiles(page, [{ name, mimeType: 'image/svg+xml', buffer: Buffer.from(markup, 'utf8') }])
  return name
}

/**
 * Injects done-state PNG entries straight into filesAtom, skipping decode/encode entirely.
 *
 * Mirrors src/tests/fixtures/ingest-helper.ts. Entries get deterministic ids (`fixture-<i>`)
 * and monotonic createdAt so queue-order sorting is stable. Prefer this when the test is
 * about something other than ingest — it removes seconds of worker warmup per test.
 */
export async function injectEntries(
  page: Page,
  count = 1,
  { status = 'done' }: { status?: 'done' | 'queued' | 'processing' | 'error' } = {},
): Promise<string[]> {
  return page.evaluate(
    async ({
      filesMod,
      settingsMod,
      n,
      status,
    }: {
      filesMod: string
      settingsMod: string
      n: number
      status: 'done' | 'queued' | 'processing' | 'error'
    }) => {
      const { filesAtom, setFileRawBuffer } = (await import(filesMod)) as FilesModule
      const { defaultFileSettings, codecForType } = (await import(settingsMod)) as SettingsLibModule

      const TINY_PNG_B64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      function toBuffer(b64: string): ArrayBuffer {
        const bin = atob(b64)
        const buf = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
        return buf.buffer as ArrayBuffer
      }

      const entries = Array.from({ length: n }, (_, i) => {
        const rawBuffer = toBuffer(TINY_PNG_B64)
        return {
          id: `fixture-${i}`,
          name: `fixture-${i}.png`,
          type: 'png',
          orig: rawBuffer.byteLength,
          opt: rawBuffer.byteLength,
          status,
          target: 'png',
          dim: '1×1',
          q: 82,
          createdAt: Date.now() + i,
          settings: defaultFileSettings('png', 82),
          rawBuffer,
          // A genuinely done entry always carries encoded bytes plus the codec that
          // produced them. Omitting these (as the older fixture helper does) yields an
          // entry that claims 'done' while every consumer gated on encodedBuffer — the
          // OutputPanel copy buttons, CompareStage's encoded layer — still reads as
          // pending. Same bytes as the source is fine: nothing here asserts compression.
          // Only 'done' gets them: a queued entry with encoded bytes is equally incoherent.
          ...(status === 'done'
            ? { encodedBuffer: toBuffer(TINY_PNG_B64), encodedCodec: codecForType('png') }
            : {}),
        }
      })

      filesAtom.setKey('entries', entries)
      filesAtom.setKey('selectedId', entries[0]?.id ?? null)
      for (const e of entries) {
        if (e.rawBuffer) setFileRawBuffer(e.id, e.rawBuffer)
      }
      return entries.map((e) => e.id)
    },
    { filesMod: FILES_MOD, settingsMod: SETTINGS_LIB_MOD, n: count, status },
  )
}

/** Drops files onto the FilesPane dropzone via a synthetic DataTransfer. */
export async function dropOnPane(page: Page, files: IngestFile[], timeout = 10_000): Promise<void> {
  const payload = files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    b64: f.buffer.toString('base64'),
  }))

  await page.evaluate((items: Array<{ name: string; mimeType: string; b64: string }>) => {
    const dt = new DataTransfer()
    for (const item of items) {
      const bin = atob(item.b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      dt.items.add(new File([bytes], item.name, { type: item.mimeType }))
    }
    const pane = document.querySelector('[data-testid="files-pane"]')
    if (pane === null) throw new Error('files-pane not found')
    pane.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, payload)

  await waitForNames(page, files.map((f) => f.name), timeout)
}
