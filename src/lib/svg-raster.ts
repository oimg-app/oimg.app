// change:deepen-svg-raster — the ONE main-thread SVG rasterizer. The codec worker cannot decode
// SVG (createImageBitmap on an SVG blob returns 0×0 in Safari/Firefox when width/height are
// absent); only <img> + canvas.drawImage parses viewBox reliably, and <img> needs a document.
// Both encode paths (optimize-all, live re-encode) pre-rasterize through here and then dispatch
// the PNG bytes to the worker like any other raster source.

// 16,777,216 = 4096×4096 — guard against a runaway canvas allocation from a malicious/huge viewBox.
const MAX_CANVAS_PIXELS = 16_777_216

export class SvgRasterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SvgRasterError'
  }
}

const isValidPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

function parseSvgLength(value: string | null): number {
  if (!value) return Number.NaN
  const match = String(value).trim().match(/^([\d.]+)/)
  return match ? Number.parseFloat(match[1]) : Number.NaN
}

function parseSvgDimensions(svgText: string): { width: number; height: number } | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null

  const width = parseSvgLength(svg.getAttribute('width'))
  const height = parseSvgLength(svg.getAttribute('height'))
  if (isValidPositive(width) && isValidPositive(height)) return { width, height }

  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && isValidPositive(parts[2]) && isValidPositive(parts[3])) {
      return { width: parts[2], height: parts[3] }
    }
  }
  return null
}

/**
 * Output size for an SVG: explicit width+height win; width alone keeps the intrinsic aspect;
 * otherwise width/height attrs → viewBox → 300×150 (the SVG spec's replaced-element default).
 */
export function resolveSvgDimensions(
  svgText: string,
  width?: number,
  height?: number,
): { width: number; height: number } {
  if (isValidPositive(width) && isValidPositive(height)) return { width: Math.round(width), height: Math.round(height) }
  const natural = parseSvgDimensions(svgText) ?? { width: 300, height: 150 }
  if (isValidPositive(width)) {
    return { width: Math.round(width), height: Math.round(width * (natural.height / natural.width)) }
  }
  return natural
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new SvgRasterError('image load failed'))
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          // null when the browser cannot encode `mime` (e.g. image/avif almost everywhere).
          if (!blob) reject(new SvgRasterError(`Browser cannot encode SVG to ${mime}.`))
          else resolve(blob)
        },
        mime,
        quality,
      )
    } catch {
      reject(new SvgRasterError('tainted canvas — SVG references resources the browser blocks'))
    }
  })
}

export interface RasterizeOptions {
  /** Canvas MIME; defaults to image/png. */
  mime?: string
  width?: number
  height?: number
  /** 0..1, lossy canvas encoders only. */
  quality?: number
}

/** Rasterize SVG text to a Blob via a main-thread canvas. Throws SvgRasterError. */
export async function rasterizeSvg(svgText: string, opts: RasterizeOptions = {}): Promise<Blob> {
  const mime = opts.mime ?? 'image/png'
  const { width: w, height: h } = resolveSvgDimensions(svgText, opts.width, opts.height)
  if (!isValidPositive(w) || !isValidPositive(h)) throw new SvgRasterError('Could not determine SVG size.')
  if (w * h > MAX_CANVAS_PIXELS) throw new SvgRasterError('SVG too large to rasterize (exceeds canvas pixel limit).')

  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new SvgRasterError('Canvas 2D context unavailable.')
    ctx.drawImage(img, 0, 0, w, h)
    return await canvasToBlob(canvas, mime, opts.quality)
  } catch (error) {
    if (error instanceof SvgRasterError) throw error
    throw new SvgRasterError('SVG rasterize failed — it may reference external resources browsers block.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
