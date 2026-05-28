// Phase 06, Plan 01 — INSP-07 snippet builders
// Pure string builders — no DOM, no clipboard, no store reads.
import type { FileEntry } from '@/lib/stub-data'

/** Map output target to MIME type suffix */
function extFor(target: string): string {
  const t = target.toLowerCase()
  if (t === 'svg') return 'svg+xml'
  if (t === 'jpg') return 'jpeg'
  return t
}

/** Parse width and height from dim string like '2400×1600' (U+00D7 multiply sign) */
function parseDim(dim: string): { w: string; h: string } {
  const parts = dim.split('×')
  return { w: parts[0]?.trim() ?? '', h: parts[1]?.trim() ?? '' }
}

/** Stub base64 payload — fixed placeholder, no real encoding (zero-server constraint) */
// const BASE64_STUB = 'STUBSTUBSTUBSTUBSTUBSTUBSTUBSTUBSTUBSTUB'

async function getBase64(file: Blob) {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      resolve(base64)
    };

    reader.onerror = (e) => {
      reject(e)
    };

    reader.readAsDataURL(file);
  })
}

/**
 * buildBase64Snippet — returns an <img> tag with a data URI base64 src.
 * The base64 payload is a fixed stub placeholder.
 */
export async function buildBase64Snippet(file: FileEntry): Promise<string> {
  const ext = extFor(file.target)
  const { w, h } = parseDim(file.dim)
  const widthAttr = w ? ` width="${w}"` : ''
  const heightAttr = h ? ` height="${h}"` : ''

  if (!file.encodedBuffer) {
    throw new Error('buildBase64Snippet: file.rawBuffer is undefined')
  }

  const base64 = await getBase64(new File([file.encodedBuffer], file.name, {type: `image/${ext}`}))

  return `<img src="${base64}" alt="${file.name}"${widthAttr}${heightAttr}>`
}

/**
 * buildUrlEncodedSnippet — returns a CSS rule with a url-encoded data URI background-image.
 * The data payload is a URL-encoded stub placeholder.
 */
export async function buildUrlEncodedSnippet(file: FileEntry) {
  const ext = extFor(file.target)

  if (!file.encodedBuffer) {
    throw new Error('buildBase64Snippet: file.rawBuffer is undefined')
  }

  const base64 = await getBase64(new File([file.encodedBuffer], file.name, {type: `image/${ext}`}))

  return `background-image: url("${base64}");`
}

/**
 * buildPictureSnippet — returns a multi-line <picture> element with a <source> for the
 * target format and a fallback <img> in the original format.
 */
export async function buildPictureSnippet(file: FileEntry) {
  const ext = extFor(file.target)
  const { w, h } = parseDim(file.dim)
  const widthAttr = w ? ` width="${w}"` : ''
  const heightAttr = h ? ` height="${h}"` : ''
  const baseName = file.name.replace(/\.[^.]+$/, '')

  return [
    '<picture>',
    `  <source srcset="${baseName}.${file.target}" type="image/${ext}">`,
    `  <img src="${baseName}.${file.type}" alt="${file.name}"${widthAttr}${heightAttr}>`,
    '</picture>',
  ].join('\n')
}
