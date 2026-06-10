// Phase 06, Plan 01 — INSP-07 snippet builders unit test
// Phase 12, Plan 02 — D-01/D-02/D-03/D-04 + T-12-02 attr-injection coverage
// Run: node --experimental-strip-types src/tests/snippets.test.ts

let passed = 0
let failed = 0

function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

import type { FileEntry } from '../lib/settings'

// Polyfill btoa for node (matches the chunked-base64 browser path).
if (typeof (globalThis as { btoa?: unknown }).btoa !== 'function') {
  ;(globalThis as { btoa: (s: string) => string }).btoa = (s: string) =>
    Buffer.from(s, 'binary').toString('base64')
}

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: 't',
    name: 'hero.png',
    type: 'png',
    target: 'png',
    dim: '2400×1600',
    status: 'done',
    orig: 100,
    opt: 50,
    q: 82,
    encodedBuffer: new Uint8Array([0, 0, 0, 0]).buffer,
    ...overrides,
  } as FileEntry
}

const webpFixture: FileEntry = {
  id: 'f1',
  name: 'hero-banner@2x.png',
  type: 'png',
  orig: 1842300,
  opt: 412800,
  status: 'done',
  target: 'webp',
  dim: '2400×1600',
  q: 82,
  encodedBuffer: new Uint8Array([0, 0, 0, 0]).buffer,
}

const svgFixture: FileEntry = {
  id: 'f3',
  name: 'icon-set.svg',
  type: 'svg',
  orig: 28640,
  opt: 9120,
  status: 'done',
  target: 'svg',
  dim: '512×512',
  q: null,
  encodedBuffer: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>').buffer as ArrayBuffer,
}

const jpgFixture: FileEntry = {
  id: 'f2',
  name: 'product-shot-01.jpg',
  type: 'jpg',
  orig: 956400,
  opt: 198200,
  status: 'done',
  target: 'avif',
  dim: '1920×1280',
  q: 60,
  encodedBuffer: new Uint8Array([0, 0, 0, 0]).buffer,
}

;(async () => {

  try {
    const { buildBase64Snippet, buildUrlEncodedSnippet, buildPictureSnippet, buildDataUri } = await import('../lib/snippets.ts')

    // ── Pre-Phase-12 baseline: buildBase64Snippet ─────────────────────────
    const base64Webp = await buildBase64Snippet(webpFixture)
    assert('base64 webp contains data:image/webp;base64,', base64Webp.includes('data:image/webp;base64,'))
    assert('base64 webp contains alt with filename', base64Webp.includes(`alt="${webpFixture.name}"`))
    assert('base64 webp contains width=2400', base64Webp.includes('width="2400"'))
    assert('base64 webp contains height=1600', base64Webp.includes('height="1600"'))
    assert('base64 webp is an img tag', base64Webp.startsWith('<img '))

    // ── D-01: SVG dispatch through buildBase64Snippet now produces URL-encoded URI ──
    const base64Svg = await buildBase64Snippet(svgFixture)
    assert('base64 svg dispatches to url-encoded path (D-01)', base64Svg.includes('data:image/svg+xml;charset=utf-8,'))
    assert('base64 svg does NOT use base64 path for svg (T-12-01)', !base64Svg.includes('image/svg+xml;base64,'))

    const base64Jpg = await buildBase64Snippet(jpgFixture)
    assert('base64 avif target contains image/avif', base64Jpg.includes('data:image/avif;base64,'))

    // ── D-01 dispatcher direct ─────────────────────────────────────────────
    const uriRaster = await buildDataUri(webpFixture)
    assert('buildDataUri raster returns image/webp;base64', uriRaster.startsWith('data:image/webp;base64,'))
    const uriSvg = await buildDataUri(svgFixture)
    assert('buildDataUri svg returns url-encoded prefix', uriSvg.startsWith('data:image/svg+xml;charset=utf-8,'))
    assert('buildDataUri svg does not contain raw < (URL-encoded)', !uriSvg.includes('<svg'))

    // ── D-01: SVG URL-encoded snippet ──────────────────────────────────────
    const urlSvg = await buildUrlEncodedSnippet(svgFixture)
    assert('url-encoded svg starts with background-image: url("data:image/svg+xml;charset=utf-8,', urlSvg.startsWith('background-image: url("data:image/svg+xml;charset=utf-8,'))
    assert('url-encoded svg has no raw <svg (URL-encoded)', !urlSvg.includes('<svg'))
    assert('url-encoded svg ends with ");', urlSvg.endsWith('");'))

    // ── D-01: raster goes through base64 even in url-encoded path ─────────
    const urlWebp = await buildUrlEncodedSnippet(webpFixture)
    assert('url-encoded raster starts with background-image: url("data:image/webp;base64,', urlWebp.startsWith('background-image: url("data:image/webp;base64,'))

    // ── T-12-BIG: chunked base64 does not blow on a >125KB buffer ──────────
    const bigBuf = new Uint8Array(200 * 1024)        // 200KB > 125KB call-stack threshold
    for (let i = 0; i < bigBuf.length; i++) bigBuf[i] = i & 0xff
    const bigFile = makeFile({ target: 'png', type: 'png', encodedBuffer: bigBuf.buffer })
    let bigOk = false
    try {
      const bigUri = await buildDataUri(bigFile)
      bigOk = bigUri.startsWith('data:image/png;base64,') && bigUri.length > 200_000
    } catch {
      bigOk = false
    }
    assert('chunked base64 handles 200KB buffer without crash (D-02 / T-12-BIG)', bigOk)

    // ── Missing encodedBuffer rejection ─────────────────────────────────────
    const orphan = makeFile({ encodedBuffer: undefined })
    let threw = false
    try {
      await buildDataUri(orphan)
    } catch (e) {
      threw = e instanceof Error && e.message.includes('encodedBuffer')
    }
    assert('buildDataUri throws when encodedBuffer missing', threw)

    // ── D-03 / D-04: buildPictureSnippet (now sync) ─────────────────────────

    // Test: D-03 SVG target → bare <img> (no <picture>, no <source>)
    const picSvg = buildPictureSnippet(svgFixture)
    assert('picture svg is bare <img> (D-03)', picSvg.startsWith('<img src="icon-set.svg"'))
    assert('picture svg does NOT contain <picture>', !picSvg.includes('<picture>'))
    assert('picture svg does NOT contain <source', !picSvg.includes('<source'))

    // Test: D-03 raster target === source → bare <img>
    const sameFmt = makeFile({ target: 'png', type: 'png', name: 'hero.png', dim: '800×600' })
    const picSame = buildPictureSnippet(sameFmt)
    assert('picture same-format raster is bare <img> (D-03)', picSame.startsWith('<img src="hero.png"'))
    assert('picture same-format does NOT contain <picture>', !picSame.includes('<picture>'))
    assert('picture same-format does NOT contain <source', !picSame.includes('<source'))
    assert('picture same-format contains alt="hero.png"', picSame.includes('alt="hero.png"'))

    // Test: D-03 raster target ≠ source → full <picture>
    const picWebp = buildPictureSnippet(webpFixture)
    assert('picture target≠source contains <picture>', picWebp.includes('<picture>'))
    assert('picture target≠source contains </picture>', picWebp.includes('</picture>'))
    assert('picture target≠source contains <source srcset="hero-banner@2x.webp"', picWebp.includes('<source srcset="hero-banner@2x.webp"'))
    assert('picture target≠source type is image/webp', picWebp.includes('type="image/webp"'))
    assert('picture target≠source fallback <img src has original name', picWebp.includes('<img src="hero-banner@2x.png"'))
    assert('picture target≠source contains width="2400"', picWebp.includes('width="2400"'))
    assert('picture target≠source contains height="1600"', picWebp.includes('height="1600"'))

    // Test: D-04 dim empty → no width="" or height=""
    const noDim = makeFile({ target: 'webp', type: 'png', name: 'x.png', dim: '' })
    const picNoDim = buildPictureSnippet(noDim)
    assert('picture empty dim omits width="" (D-04)', !picNoDim.includes('width=""'))
    assert('picture empty dim omits height="" (D-04)', !picNoDim.includes('height=""'))
    const b64NoDim = await buildBase64Snippet(noDim)
    assert('base64 empty dim omits width="" (D-04)', !b64NoDim.includes('width=""'))

    // ── T-12-02: HTML attr-injection via filename ───────────────────────────

    const adversarial = '"><script>alert(1)</script>'
    const advFile = makeFile({ name: adversarial, target: 'webp', type: 'png', dim: '100×100' })
    const advPic = buildPictureSnippet(advFile)
    assert('picture adversarial: no literal <script>', !advPic.includes('<script>'))
    assert('picture adversarial: contains &quot;', advPic.includes('&quot;'))
    assert('picture adversarial: contains &lt;', advPic.includes('&lt;'))
    assert('picture adversarial: contains &gt;', advPic.includes('&gt;'))

    const adv2 = '"><img onerror=x>'
    const advBase = await buildBase64Snippet(makeFile({ name: adv2, target: 'png', type: 'png' }))
    // split-parse the alt value: literal `"` must not appear inside it
    const altValue = advBase.split('alt="')[1]?.split('"')[0] ?? ''
    assert('base64 adversarial: alt value does not contain literal "', !altValue.includes('"'))
    // direct check: no raw `"><img onerror` substring leaks through
    assert('base64 adversarial: no literal "><img onerror substring', !advBase.includes('"><img onerror'))
    assert('base64 adversarial: contains &lt; or &gt;', advBase.includes('&lt;') || advBase.includes('&gt;'))

    // Ampersand-first ordering check
    const ampFile = makeFile({ name: '&amp;.png', target: 'webp', type: 'png' })
    const picAmp = buildPictureSnippet(ampFile)
    // Original `&amp;` should become `&amp;amp;` (& gets escaped first then literal "amp;" stays)
    assert('picture &amp; escapes & first → &amp;amp;', picAmp.includes('&amp;amp;'))

  } catch (err) {
    if (err instanceof Error && (err.message.includes('snippets.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
      failed++
      console.error('ERR: src/lib/snippets.ts not found — must be implemented before tests pass')
    } else {
      failed++
      console.error('Unexpected error:', err)
    }
  }

  console.log(`${passed} passed, ${failed} failed`)

  process.exit(failed > 0 ? 1 : 0)
})()
