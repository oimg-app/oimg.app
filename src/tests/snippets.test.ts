// Phase 06, Plan 01 — INSP-07 snippet builders unit test
// Run: node --experimental-strip-types src/tests/snippets.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

import type { FileEntry } from '../lib/stub-data.ts'

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
}

try {
  const { buildBase64Snippet, buildUrlEncodedSnippet, buildPictureSnippet } = await import('../lib/snippets.ts')

  // buildBase64Snippet tests
  const base64Webp = buildBase64Snippet(webpFixture)
  assert('base64 webp contains data:image/webp;base64,', base64Webp.includes('data:image/webp;base64,'))
  assert('base64 webp contains alt with filename', base64Webp.includes(`alt="${webpFixture.name}"`))
  assert('base64 webp contains width=2400', base64Webp.includes('width="2400"'))
  assert('base64 webp contains height=1600', base64Webp.includes('height="1600"'))
  assert('base64 webp is an img tag', base64Webp.startsWith('<img '))

  const base64Svg = buildBase64Snippet(svgFixture)
  assert('base64 svg contains image/svg+xml', base64Svg.includes('data:image/svg+xml;base64,'))

  const base64Jpg = buildBase64Snippet(jpgFixture)
  assert('base64 avif target contains image/avif', base64Jpg.includes('data:image/avif;base64,'))

  // buildUrlEncodedSnippet tests
  const urlWebp = buildUrlEncodedSnippet(webpFixture)
  assert('url-encoded contains background-image: url(', urlWebp.includes('background-image: url('))
  assert('url-encoded contains % escape character', urlWebp.includes('%'))
  assert('url-encoded contains webp mime', urlWebp.includes('image/webp'))
  assert('url-encoded is a CSS rule', urlWebp.includes('{') && urlWebp.includes('}'))

  const urlSvg = buildUrlEncodedSnippet(svgFixture)
  assert('url-encoded svg contains svg+xml', urlSvg.includes('image/svg+xml'))

  // buildPictureSnippet tests
  const picWebp = buildPictureSnippet(webpFixture)
  assert('picture contains <source', picWebp.includes('<source'))
  assert('picture contains <img', picWebp.includes('<img'))
  assert('picture contains width=', picWebp.includes('width='))
  assert('picture contains height=', picWebp.includes('height='))
  assert('picture contains <picture>', picWebp.includes('<picture>'))
  assert('picture contains </picture>', picWebp.includes('</picture>'))
  assert('picture source has webp srcset', picWebp.includes('.webp'))
  assert('picture fallback img has original type', picWebp.includes(`.${webpFixture.type}`))

  const picSvg = buildPictureSnippet(svgFixture)
  assert('picture svg source has svg srcset', picSvg.includes('.svg'))

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
