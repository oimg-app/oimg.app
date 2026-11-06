// change:deepen-encode-entry / deepen-format-registry — Node unit tests for the job-building seam
// and the format table. Run:
//   node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/encode-entry.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) passed++
  else { failed++; console.error(`FAIL: ${name}`) }
}

const { prepareJob } = await import('../lib/encode-entry.ts')
const { defaultFileSettings } = await import('../lib/settings.ts')
const { CODECS } = await import('../lib/constants.ts')
const { sourceFormatOf, codecFor, extForCodec, mimeForFormat, ACCEPTED_EXTS } = await import('../lib/formats.ts')
const { mimeFor } = await import('../lib/filename.ts')
import type { FileEntry } from '../lib/settings.ts'

function entry(type: string, patch: Partial<FileEntry> = {}): FileEntry {
  return {
    id: 'x', name: `x.${type}`, type, orig: 3, opt: 3, status: 'queued', target: type, dim: '1×1', q: 82,
    rawBuffer: new Uint8Array([1, 2, 3]).buffer,
    settings: defaultFileSettings(type, 82),
    ...patch,
  }
}

// ── formats registry ─────────────────────────────────────────────────────────
for (const c of CODECS) {
  const ext = extForCodec(c)
  assert(`extForCodec(${c}) is an accepted ext`, ACCEPTED_EXTS.has(ext))
  assert(`mimeFor(extForCodec(${c})) is image/*`, mimeFor(ext).startsWith('image/'))
}
assert("sourceFormatOf('photo.JPG') === 'jpg'", sourceFormatOf('photo.JPG') === 'jpg')
assert("sourceFormatOf('image/jpeg') === 'jpeg'", sourceFormatOf('image/jpeg') === 'jpeg')
assert("sourceFormatOf('.webp') === 'webp'", sourceFormatOf('.webp') === 'webp')
assert("sourceFormatOf('gif') === null", sourceFormatOf('gif') === null)
assert("codecFor('heic') falls back to JPEG (decode-only)", codecFor('heic') === 'JPEG')
assert("codecFor('bmp') defaults to WebP", codecFor('bmp') === 'WebP')
assert("mimeForFormat('heif') === 'image/heif'", mimeForFormat('heif') === 'image/heif')
assert("mimeFor('zip') still application/zip", mimeFor('zip') === 'application/zip')

// ── prepareJob ───────────────────────────────────────────────────────────────
const noop = (async () => new Blob()) as never
{
  const e = entry('png')
  const job = await prepareJob(e, noop)
  assert('png: job built', job !== null)
  assert('png: codec comes from entry.settings', job?.codec === 'PNG')
  assert('png: sourceFormat is the source type', job?.sourceFormat === 'png')
  assert('png: buffer is a copy, not the cached original', job?.buffer !== e.rawBuffer && job?.buffer.byteLength === 3)
  assert('png: settings passed through by reference', job?.settings === e.settings)
}
{
  const e = entry('png', { settings: { ...defaultFileSettings('png', 82), codec: 'AVIF' } })
  const job = await prepareJob(e, noop)
  assert('settings.codec wins over the source-derived codec', job?.codec === 'AVIF')
}
{
  assert('no rawBuffer → null', (await prepareJob(entry('png', { rawBuffer: undefined }), noop)) === null)
  assert('empty rawBuffer → null', (await prepareJob(entry('png', { rawBuffer: new ArrayBuffer(0) }), noop)) === null)
  let threw = false
  try { await prepareJob(entry('gif'), noop) } catch { threw = true }
  assert('unsupported type throws', threw)
}
{
  // SVG → raster: rasterizer is invoked with the resize width and the job becomes a PNG source.
  const calls: Array<{ width?: number }> = []
  const raster = (async (_text: string, opts: { width?: number }) => {
    calls.push(opts)
    return new Blob([new Uint8Array([9, 9])])
  }) as never
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const e = entry('svg', {
    rawBuffer: new TextEncoder().encode(svgText).buffer as ArrayBuffer,
    settings: { ...defaultFileSettings('svg', 82), codec: 'PNG', resizeOn: true, w: '640' },
  })
  const job = await prepareJob(e, raster)
  assert('svg→PNG: rasterizer called once', calls.length === 1)
  assert('svg→PNG: width from settings.w when resizeOn', calls[0]?.width === 640)
  assert('svg→PNG: dispatched as png source', job?.sourceFormat === 'png')
  assert('svg→PNG: buffer is the rasterized bytes', job?.buffer.byteLength === 2)
  assert('svg→PNG: codec stays PNG', job?.codec === 'PNG')

  const e2 = entry('svg', { rawBuffer: e.rawBuffer, settings: { ...defaultFileSettings('svg', 82), codec: 'PNG', resizeOn: false, w: '640' } })
  await prepareJob(e2, raster)
  assert('svg→PNG: no width when resizeOn is false', calls[1]?.width === undefined)
}
{
  const calls: unknown[] = []
  const raster = (async (...a: unknown[]) => { calls.push(a); return new Blob() }) as never
  const job = await prepareJob(entry('svg'), raster)
  assert('svg→SVG: not rasterized', calls.length === 0)
  assert('svg→SVG: sourceFormat svg', job?.sourceFormat === 'svg' && job?.codec === 'SVG')
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
