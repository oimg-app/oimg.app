// Fast 260610 — SVG → raster export. jSquash/the codec worker cannot decode SVG (no SVG
// case in codec.worker.ts decodeSource), so when an SVG file's selected output codec is a
// raster format we rasterize on the MAIN THREAD (Image → <canvas> → toBlob) at export time.
// Generalized from a canvas svgToPng reference to any canvas-encodable codec.
import type { FileEntry } from '@/stores/files'
import { mimeFor } from '@/lib/filename'

// 16,777,216 = 4096×4096 — guard against a runaway canvas allocation from a malicious/huge viewBox.
const MAX_CANVAS_PIXELS = 16_777_216

export class SvgRasterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SvgRasterError'
  }
}

const isValidPositive = (n: number): boolean => Number.isFinite(n) && n > 0

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

/** width/height attrs → viewBox → 300×150 default (matches the SVG spec's replaced-element default). */
export function resolveSvgDimensions(
  svgText: string,
  width?: number,
  height?: number,
): { width: number; height: number; usedFallback: boolean } {
  const w = Number(width)
  const h = Number(height)
  if (isValidPositive(w) && isValidPositive(h)) return { width: w, height: h, usedFallback: false }

  const parsed = parseSvgDimensions(svgText)
  if (parsed) return { ...parsed, usedFallback: false }

  return { width: 300, height: 150, usedFallback: true }
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
          // toBlob returns null when the requested type is unsupported (e.g. image/avif in
          // most browsers). Surface a clear error rather than silently saving a PNG.
          if (!blob) {
            reject(new SvgRasterError(`Browser cannot encode SVG to ${mime}.`))
            return
          }
          resolve(blob)
        },
        mime,
        quality,
      )
    } catch {
      reject(new SvgRasterError('tainted canvas — SVG references resources the browser blocks'))
    }
  })
}

interface RasterizeOptions {
  width?: number
  height?: number
  scale?: number
  quality?: number
}

/** Rasterize SVG text to a Blob in `mime` via a main-thread canvas. */
export async function rasterizeSvg(svgText: string, mime: string, opts: RasterizeOptions = {}): Promise<Blob> {
  const { scale = 1, quality } = opts
  const resolved = resolveSvgDimensions(svgText, opts.width, opts.height)
  const w = Math.round(resolved.width * scale)
  const h = Math.round(resolved.height * scale)

  if (!isValidPositive(w) || !isValidPositive(h)) {
    throw new SvgRasterError('Could not determine SVG size for export.')
  }
  if (w * h > MAX_CANVAS_PIXELS) {
    throw new SvgRasterError('SVG too large to rasterize for export.')
  }

  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new SvgRasterError('Canvas 2D context unavailable.')
    ctx.drawImage(img, 0, 0, w, h)
    return await canvasToBlob(canvas, mime, quality)
  } catch (error) {
    if (error instanceof SvgRasterError) throw error
    throw new SvgRasterError('SVG export failed — it may reference external resources browsers block.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Codec (FileSettings.codec) → output extension. SVG omitted — that path never rasterizes.
const CODEC_TO_EXT: Record<string, string> = {
  PNG: 'png',
  WebP: 'webp',
  JPEG: 'jpeg',
  AVIF: 'avif',
}

/** True when this entry is an SVG whose selected output codec is a raster format. */
export function isSvgToRaster(entry: FileEntry): boolean {
  return entry.type === 'svg' && !!entry.settings && entry.settings.codec !== 'SVG'
}

/**
 * Rasterize an SVG entry to its selected raster codec. Caller must gate with isSvgToRaster().
 * Reads the optimized SVG bytes (encodedBuffer) when present so SVGO output carries through,
 * falling back to the original bytes. Throws SvgRasterError on failure.
 */
export async function svgRasterExport(
  entry: FileEntry,
): Promise<{ blob: Blob; ext: string; mime: string }> {
  const codec = entry.settings?.codec ?? 'PNG'
  const ext = CODEC_TO_EXT[codec] ?? 'png'
  const mime = mimeFor(ext)
  const buf = entry.encodedBuffer ?? entry.rawBuffer
  if (!buf) throw new SvgRasterError('No SVG bytes available to export.')

  const svgText = new TextDecoder('utf-8').decode(buf)
  // Lossy codecs honor the per-file quality slider; png/avif ignore the quality arg.
  const quality = ext === 'jpeg' || ext === 'webp' ? (entry.settings?.q ?? 90) / 100 : undefined
  const blob = await rasterizeSvg(svgText, mime, { quality })
  return { blob, ext, mime }
}
