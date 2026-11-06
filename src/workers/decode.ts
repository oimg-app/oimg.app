// change:deepen-worker-decode — the one source-format → ImageData switch, shared by the codec
// and metrics workers. PIPE-02 discipline: every codec import stays inside its branch so the
// initial worker-eval cost stays tiny and WASM only downloads when actually reachable.
// Worker-only module (ImageData, WASM) — never import from the main thread.
import type { SourceFormat } from '@/lib/formats'

/** Decode raster bytes to ImageData. Throws on unknown format or decoder failure. */
export async function decodeImage(buffer: ArrayBuffer, sourceFormat: SourceFormat | string): Promise<ImageData> {
  const fmt = sourceFormat.toLowerCase()
  let img: ImageData | null
  switch (fmt) {
    case 'png': {
      const { decode } = await import('@jsquash/png')
      img = await decode(buffer)
      break
    }
    case 'jpeg':
    case 'jpg': {
      const { decode } = await import('@jsquash/jpeg')
      img = await decode(buffer)
      break
    }
    case 'webp': {
      const { decode } = await import('@jsquash/webp')
      img = await decode(buffer)
      break
    }
    case 'avif': {
      const { decode } = await import('@jsquash/avif')
      img = await decode(buffer)
      break
    }
    // Quick 260610-lby: HEIC/HEIF decode-only input via heic-decode (libheif WASM).
    case 'heic':
    case 'heif': {
      try {
        const { heicDecode } = await import('@/lib/heic/decode')
        const d = await heicDecode(buffer)
        img = new ImageData(new Uint8ClampedArray(d.data), d.width, d.height)
      } catch (err) {
        throw new Error('HEIC decode failed (libheif may not be supported in this browser): ' + String(err))
      }
      break
    }
    // SVG never reaches a worker: lib/encode-entry.ts rasterizes it on the main thread
    // (see lib/svg-raster.ts) and dispatches PNG bytes instead.
    default:
      throw new Error('Unknown source format: ' + sourceFormat)
  }
  if (!img) throw new Error('Failed to decode ' + fmt + ' source')
  return img
}
