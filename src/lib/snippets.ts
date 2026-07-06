// Phase 06, Plan 01 — INSP-07 snippet builders
// Phase 12, Plan 02 — D-01/D-02/D-03/D-04 + T-12-02 attr-escape + chunked base64 (V8 safety)
// Pure string builders — no DOM, no clipboard, no store reads.
import type { FileEntry } from '@/lib/settings'
import { renameExtension } from '@/lib/filename'
import {bufferToBase64} from "@/lib/base64.ts";

/** Parse width and height from dim string like '2400×1600' (U+00D7 multiply sign) */
function parseDim(dim: string): { w: string; h: string } {
  const parts = dim.split('×')
  return { w: parts[0]?.trim() ?? '', h: parts[1]?.trim() ?? '' }
}

/** Map output target to canonical image/* MIME type. */
function mimeForTarget(target: string): string {
  const t = target.toLowerCase()
  if (t === 'svg') return 'image/svg+xml'
  if (t === 'jpg' || t === 'jpeg') return 'image/jpeg'
  return `image/${t}`
}

/**
 * D-01: Yoksel-style minimal-encoding for SVG data URIs.
 * Reference: https://yoksel.github.io/url-encoder
 * `encodeURIComponent` over-escapes; restore spaces, =, :, / for shorter, paste-friendly URIs.
 * T-12-CTL: strip ASCII control chars (NULL..US, DEL) before encoding — keeps CSS valid.
 */
function buildSvgDataUri(buf: ArrayBuffer): string {
  // Sanitize control chars first (T-12-CTL — keeps the snippet valid CSS).
  const svgText = new TextDecoder('utf-8').decode(buf).replace(/[\x00-\x1F]/g, '')
  const encoded = encodeURIComponent(svgText)
    .replace(/'/g, '%27')   // ' must stay encoded for url("…") quoting safety
    .replace(/"/g, '%22')   // " ditto
    .replace(/%20/g, ' ')   // back-unescape spaces (Yoksel minimal-encoding)
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

/**
 * T-12-02: minimal HTML-attr escape for filenames containing &, ", <, >, '.
 * Order matters — `&` MUST be replaced first or it double-escapes the others.
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

/**
 * D-01 dispatcher: SVG → URL-encoded UTF-8 data URI; raster → chunked-32KB base64 data URI.
 * Throws when the entry has no encoded bytes (not yet optimized).
 */
export async function buildDataUri(file: FileEntry): Promise<string> {
  if (!file.encodedBuffer) {
    throw new Error('buildDataUri: file.encodedBuffer is undefined')
  }
  if (file.target.toLowerCase() === 'svg') {
    return buildSvgDataUri(file.encodedBuffer)
  }
  const b64 = bufferToBase64(file.encodedBuffer)
  return `data:${mimeForTarget(file.target)};base64,${b64}`
}

/**
 * buildBase64Snippet — `<img>` with a data URI src. SVG dispatch is handled by buildDataUri;
 * T-12-02 mitigation escapes filename in `alt`. D-04: width/height omitted when dim is empty.
 */
export async function buildBase64Snippet(file: FileEntry): Promise<string> {
  const { w, h } = parseDim(file.dim)
  const widthAttr = w ? ` width="${w}"` : ''
  const heightAttr = h ? ` height="${h}"` : ''
  const uri = await buildDataUri(file)
  return `<img src="${uri}" alt="${escapeAttr(file.name)}"${widthAttr}${heightAttr}>`
}

/**
 * buildUrlEncodedSnippet — CSS `background-image: url("data:…")`. SVG goes through the
 * Yoksel-style URL-encoded path; raster falls back to chunked base64 (D-01).
 */
export async function buildUrlEncodedSnippet(file: FileEntry): Promise<string> {
  const uri = await buildDataUri(file)
  return `background-image: url("${uri}");`
}

/**
 * D-03/D-04: per-file `<picture>` snippet (synchronous — no buffer access needed).
 * - target === 'svg'                → bare `<img src="renamed.svg" …>`
 * - target === source format        → bare `<img src="original.ext" …>` (no redundant <source>)
 * - else                            → 4-line `<picture>` with `<source srcset>` + fallback `<img>`
 * T-12-02: escapeAttr applied to every attribute interpolation.
 * D-04: width/height omitted when dim is empty/unparseable.
 */
export function buildPictureSnippet(file: FileEntry): string {
  const { w, h } = parseDim(file.dim)
  const widthAttr = w ? ` width="${w}"` : ''
  const heightAttr = h ? ` height="${h}"` : ''
  const alt = escapeAttr(file.name)
  const targetName = renameExtension(file.name, file.target)

  // D-03: SVG → bare <img>; raster target === source → bare <img>; else <picture>.
  if (file.target.toLowerCase() === 'svg') {
    return `<img src="${escapeAttr(targetName)}" alt="${alt}"${widthAttr}${heightAttr}>`
  }
  if (file.target.toLowerCase() === file.type.toLowerCase()) {
    return `<img src="${escapeAttr(file.name)}" alt="${alt}"${widthAttr}${heightAttr}>`
  }
  return [
    '<picture>',
    `  <source srcset="${escapeAttr(targetName)}" type="${mimeForTarget(file.target)}">`,
    `  <img src="${escapeAttr(file.name)}" alt="${alt}"${widthAttr}${heightAttr}>`,
    '</picture>',
  ].join('\n')
}
