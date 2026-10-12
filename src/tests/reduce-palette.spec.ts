// change:fix-reduce-palette-pipeline — Reduce palette must encode, and must not leave the
// codec worker unable to serve later jobs (color-quantize: In-thread quantizer loading,
// Quantize failure is isolated to its job, `numColors` and `dither` parameters).
import { test, expect, type Page } from '@playwright/test'
import { ENCODE_TIMEOUT, waitForEncoded } from './_helpers/encode'
import { ingestSvg } from './_helpers/ingest'
import { pickCodec, setSliderToEnd, sliderValue, toggleSwitch } from './_helpers/inspector'
import { FILES_MOD, RUNTIME_MOD, SETTINGS_STORE_MOD } from './_helpers/page-modules'
import { selectRowByName } from './_helpers/select'

type FilesModule = typeof import('../stores/files')
type RuntimeModule = typeof import('../stores/runtime')
type SettingsModule = typeof import('../stores/settings')
type Codec = 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'

// A gradient, so the rasterized source has far more than 2 colors to reduce.
const SVG_GRADIENT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#e76f51"/><stop offset="1" stop-color="#2a9d8f"/>' +
  '</linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>'

/**
 * Runs `action`, lets the live-encode it triggers finish, and asserts it landed as `codec`.
 *
 * Requires the pool to be idle as well as a fresh buffer: the entry is already `done` from
 * the previous encode, and an earlier in-flight job can deliver a fresh buffer before the job
 * under test has been dispatched — which would hide a failure of that job.
 */
async function encodeAfter(page: Page, id: string, codec: Codec, action: () => Promise<void>): Promise<void> {
  await page.evaluate(
    async ({ mod, fileId }: { mod: string; fileId: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      ;(window as unknown as { __prevEncoded?: ArrayBuffer }).__prevEncoded = entry?.encodedBuffer
    },
    { mod: FILES_MOD, fileId: id },
  )
  await action()
  // useLiveEncode debounces 300 ms before dispatching; wait past it, then for the pool to drain.
  await page.waitForTimeout(450)
  await page.waitForFunction(
    async ({ files, runtime, fileId, wanted }: { files: string; runtime: string; fileId: string; wanted: string }) => {
      const { runtimeAtom } = (await import(runtime)) as RuntimeModule
      const r = runtimeAtom.get()
      if (r.running || r.encodingFileId != null) return false
      const { filesAtom } = (await import(files)) as FilesModule
      const entry = filesAtom.get().entries.find((e) => e.id === fileId)
      if (entry === undefined) return false
      if (entry.error != null) throw new Error(`encode failed: ${entry.error}`)
      const prev = (window as unknown as { __prevEncoded?: ArrayBuffer }).__prevEncoded
      return entry.status === 'done' && entry.encodedBuffer != null
        && entry.encodedBuffer !== prev && entry.encodedCodec === wanted
    },
    { files: FILES_MOD, runtime: RUNTIME_MOD, fileId: id, wanted: codec },
    { timeout: ENCODE_TIMEOUT },
  )
}

/** Final guard: once everything has drained, the entry must not have ended up errored. */
async function expectSettled(page: Page, id: string): Promise<void> {
  await page.waitForTimeout(600)
  const error = await page.evaluate(
    async ({ mod, fileId }: { mod: string; fileId: string }) => {
      const { filesAtom } = (await import(mod)) as FilesModule
      return filesAtom.get().entries.find((e) => e.id === fileId)?.error ?? null
    },
    { mod: FILES_MOD, fileId: id },
  )
  expect(error).toBeNull()
}

async function ingestAndSelect(page: Page): Promise<string> {
  await page.goto('/')
  const name = await ingestSvg(page, { name: 'gradient.svg', markup: SVG_GRADIENT })
  const id = await selectRowByName(page, name)
  await waitForEncoded(page, id)
  return id
}

test.describe('reduce palette', () => {
  test('SVG → PNG encodes with palette on, and again after turning it off', async ({ page }) => {
    const id = await ingestAndSelect(page)
    await encodeAfter(page, id, 'PNG', () => pickCodec(page, 'PNG'))
    await encodeAfter(page, id, 'PNG', () => toggleSwitch(page, 'codec-switch-colors', true))
    // The regression: the quantizer used to leave the worker answering every later job
    // with a malformed reply ("Cannot read properties of undefined (reading 'buffer')").
    await encodeAfter(page, id, 'PNG', () => toggleSwitch(page, 'codec-switch-colors', false))
    await expectSettled(page, id)
  })

  test('SVG → JPEG and AVIF keep encoding with palette on', async ({ page }) => {
    const id = await ingestAndSelect(page)
    await encodeAfter(page, id, 'PNG', () => pickCodec(page, 'PNG'))
    await encodeAfter(page, id, 'PNG', () => toggleSwitch(page, 'codec-switch-colors', true))
    await encodeAfter(page, id, 'JPEG', () => pickCodec(page, 'JPEG'))
    await encodeAfter(page, id, 'AVIF', () => pickCodec(page, 'AVIF'))
    await expectSettled(page, id)
  })

  test('Colors control bottoms out at 2 and still encodes', async ({ page }) => {
    const id = await ingestAndSelect(page)
    await encodeAfter(page, id, 'PNG', () => pickCodec(page, 'PNG'))
    await encodeAfter(page, id, 'PNG', () => toggleSwitch(page, 'codec-switch-colors', true))
    await encodeAfter(page, id, 'PNG', () => setSliderToEnd(page, 'codec-slider-colors', 'min'))
    expect(await sliderValue(page, 'codec-slider-colors')).toBe(2)
    await expectSettled(page, id)
  })

  test('quantizer assets are not fetched while palette is off', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (r) => { if (/imagequant/i.test(r.url())) requests.push(r.url()) })
    const id = await ingestAndSelect(page)
    await encodeAfter(page, id, 'PNG', () => pickCodec(page, 'PNG'))
    expect(requests).toHaveLength(0)
    await encodeAfter(page, id, 'PNG', () => toggleSwitch(page, 'codec-switch-colors', true))
    expect(requests.some((u) => u.endsWith('.wasm'))).toBe(true)
  })

  test('changing default dithering leaves the default palette size alone', async ({ page }) => {
    await page.goto('/')
    const after = await page.evaluate(async (mod: string) => {
      const { settingsAtom, setDithering } = (await import(mod)) as SettingsModule
      setDithering(0.5)
      const { colors, dithering } = settingsAtom.get()
      return { colors, dithering }
    }, SETTINGS_STORE_MOD)
    expect(after).toEqual({ colors: 256, dithering: 0.5 })
  })

  test('a worker reply without a buffer rejects that job and frees the worker', async ({ page }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const { WorkerPool } = await import('/src/lib/worker-pool.ts')
      const counts: Array<[number, number]> = []
      const pool = new WorkerPool(1, (active: number, queued: number) => { counts.push([active, queued]) })
      // Swap the real worker proxy for one that resolves with nothing — the shape a hijacked
      // message channel used to produce.
      const stub = { optimize: () => Promise.resolve(undefined) }
      const internals = pool as unknown as { workers: unknown[]; idle: unknown[] }
      internals.workers = [stub]
      internals.idle = [stub]
      const job = { codec: 'PNG' as const, sourceFormat: 'png' as const, buffer: new ArrayBuffer(8), settings: {} as never }
      const message = await pool.run(job).then(() => 'resolved', (e: unknown) => String(e))
      return { message, active: pool.active, queued: pool.queued }
    })
    expect(result).toEqual({ message: 'Error: Invalid worker result', active: 0, queued: 0 })
  })
})
