// change:deepen-preview-source — one derivation of "what URL renders these bytes" for the
// compare stage. SVG → sandboxed-iframe data URI; HEIC → decode → canvas → object URL;
// anything else → object URL. Callers always get a revoke() to run on cleanup.
import type { Codec } from '@/lib/settings'

export interface PreviewSource {
  src: string
  /** Rendered in a sandboxed <iframe> (SVG) rather than an <img>. */
  isFrame: boolean
  revoke(): void
}

// SVG layers render inside a sandboxed <iframe> (sandbox="allow-scripts", no allow-same-origin)
// so script-bearing/untrusted SVG is isolated from the app origin. The iframe src must be a
// real document — a blob: URL is unreliable here (a sandboxed opaque-origin frame is blocked
// from fetching the parent's blob URL), so encode inline as a data URI. The body wraps the SVG
// in an <img> with object-fit: contain so oversize SVGs fit the stage viewport.
function svgDataUri(buf: ArrayBuffer): string {
  const text = new TextDecoder('utf-8').decode(buf)
  const svgSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}' +
    'img{display:block;width:100%;height:100%;object-fit:contain}' +
    '</style></head><body><img src="' + svgSrc + '"></body></html>'
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

async function heicToPngBlob(buf: ArrayBuffer): Promise<Blob> {
  // PIPE-02: libheif WASM stays out of the initial route until a HEIC file is previewed.
  const { heicDecode } = await import('@/lib/heic/decode')
  const d = await heicDecode(buf)
  const canvas = document.createElement('canvas')
  canvas.width = d.width
  canvas.height = d.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.putImageData(new ImageData(new Uint8ClampedArray(d.data), d.width, d.height), 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png'),
  )
}

/**
 * Build a renderable source for `buffer`. `kind` is the format the bytes are in: a source
 * extension (`FileEntry.type`) or the Codec that produced them (`encodedCodec`).
 */
export async function previewSource(buffer: ArrayBuffer, kind: string | Codec): Promise<PreviewSource> {
  const k = kind.toLowerCase()
  if (k === 'svg') return { src: svgDataUri(buffer), isFrame: true, revoke() {} }
  const blob = k === 'heic' || k === 'heif' ? await heicToPngBlob(buffer) : new Blob([buffer])
  const src = URL.createObjectURL(blob)
  return { src, isFrame: false, revoke: () => URL.revokeObjectURL(src) }
}
