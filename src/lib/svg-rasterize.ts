// Rasterize an SVG string to a PNG ArrayBuffer on the main thread.
// The worker cannot do this reliably: createImageBitmap() on an SVG blob returns 0x0 in Safari/Firefox
// when the SVG lacks explicit width/height. Only <img>+canvas.drawImage() parses viewBox correctly
// across browsers, and <img> requires a document (main-thread only).
// Adapted from inspired/svg-to-png.js.

const MAX_CANVAS_PIXELS = 16_777_216

const isValidPositive = (n: number): boolean => Number.isFinite(n) && n > 0

const parseSvgLength = (value: string | null): number => {
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

function resolveSvgDimensions(svgText: string, width?: number, height?: number): { width: number; height: number } {
  if (width !== undefined && height !== undefined && isValidPositive(width) && isValidPositive(height)) {
    return { width, height }
  }
  const parsed = parseSvgDimensions(svgText)
  if (parsed) return parsed
  return { width: 300, height: 150 } // browser default replaced-element size
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

function canvasToPngBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('toBlob null'))
            return
          }
          blob.arrayBuffer().then(resolve, reject)
        },
        'image/png',
      )
    } catch {
      reject(new Error('tainted canvas'))
    }
  })
}

/**
 * Rasterize an SVG ArrayBuffer to a PNG ArrayBuffer.
 * If targetWidth is provided (from settings.w when resizeOn), rasterizes at that width for crisp output.
 * Otherwise uses the SVG's intrinsic dimensions.
 */
export async function rasterizeSvgToPng(
  svgBuffer: ArrayBuffer,
  opts: { targetWidth?: number; targetHeight?: number } = {},
): Promise<ArrayBuffer> {
  const svgText = new TextDecoder('utf-8').decode(svgBuffer)
  const { width: naturalW, height: naturalH } = resolveSvgDimensions(svgText)

  let w = naturalW
  let h = naturalH
  if (opts.targetWidth !== undefined && isValidPositive(opts.targetWidth)) {
    const aspect = naturalH / naturalW
    w = Math.round(opts.targetWidth)
    h = opts.targetHeight !== undefined && isValidPositive(opts.targetHeight)
      ? Math.round(opts.targetHeight)
      : Math.round(w * aspect)
  }

  if (!isValidPositive(w) || !isValidPositive(h)) {
    throw new Error('Could not determine SVG dimensions')
  }
  if (w * h > MAX_CANVAS_PIXELS) {
    throw new Error('SVG too large to rasterize (exceeds canvas pixel limit)')
  }

  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(img, 0, 0, w, h)
    return await canvasToPngBuffer(canvas)
  } catch (err) {
    throw new Error('SVG rasterize failed: ' + String(err))
  } finally {
    URL.revokeObjectURL(url)
  }
}
