// Phase 16 — MTR-01: sibling Comlink worker for perceptual-quality metrics.
// PIPE-02 discipline: every codec / resize / ssim.js import is dynamic-inside-branch.
// Only Comlink is allowed at the top of the file — see codec.worker.ts for the pattern.
import * as Comlink from 'comlink'

export interface SSIMJob {
  rawBuffer: ArrayBuffer
  encodedBuffer: ArrayBuffer
  sourceFormat: 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'heic' | 'heif'
  targetFormat: 'png' | 'jpeg' | 'webp' | 'avif'
}

export interface SSIMResult {
  mssim: number
  ms: number
}

export type MetricsApi = {
  computeSSIM: (j: SSIMJob) => Promise<SSIMResult>
}

// V5 Input Validation — enum guards mirroring codec.worker.ts:26 KNOWN_CODECS.
// Any format outside these sets rejects before touching a dynamic import.
const KNOWN_SOURCE_FORMATS = new Set<string>(['png', 'jpeg', 'jpg', 'webp', 'avif', 'heic', 'heif'])
const KNOWN_TARGET_FORMATS = new Set<string>(['png', 'jpeg', 'webp', 'avif'])

// Source-agnostic decode helper. Mirrors codec.worker.ts:decodeSource — every codec import
// lives inside its switch branch so the initial worker-eval cost stays tiny and codec WASM
// only downloads when actually reachable (PIPE-02).
async function decode(buffer: ArrayBuffer, fmt: string): Promise<ImageData> {
  switch (fmt.toLowerCase()) {
    case 'png': {
      const { decode: pngDecode } = await import('@jsquash/png')
      const img = await pngDecode(buffer)
      if (!img) throw new Error('Failed to decode PNG source for SSIM')
      return img
    }
    case 'jpeg':
    case 'jpg': {
      const { decode: jpegDecode } = await import('@jsquash/jpeg')
      const img = await jpegDecode(buffer)
      if (!img) throw new Error('Failed to decode JPEG source for SSIM')
      return img
    }
    case 'webp': {
      const { decode: webpDecode } = await import('@jsquash/webp')
      const img = await webpDecode(buffer)
      if (!img) throw new Error('Failed to decode WebP source for SSIM')
      return img
    }
    case 'avif': {
      const { decode: avifDecode } = await import('@jsquash/avif')
      const img = await avifDecode(buffer)
      if (!img) throw new Error('Failed to decode AVIF source for SSIM')
      return img
    }
    case 'heic':
    case 'heif': {
      // Mirror codec.worker.ts HEIC branch — dynamic import + libheif error normalization.
      try {
        const { heicDecode } = await import('@/lib/heic/decode')
        const decoded = await heicDecode(buffer)
        return new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height)
      } catch (err) {
        throw new Error('HEIC decode failed for SSIM (libheif may not be supported): ' + String(err))
      }
    }
    default:
      throw new Error('Unsupported source format for SSIM: ' + fmt)
  }
}

/**
 * Compute mean SSIM (0..1, higher = closer to source) between raw and encoded buffers.
 * Dimensional alignment uses @jsquash/resize with method='lanczos3', fitMethod='stretch'
 * (Pitfall 1 — stretch preserves pixel-for-pixel comparison even when target dimensions
 * were changed by a resize step; 'contain' would letterbox and bias the score).
 * Returns { mssim, ms } where ms is wall-clock cost of ssim.js execution.
 * Wrapped in try/catch so a per-job failure rejects only this promise — the worker
 * survives (mirrors codec.worker.ts:288-291 reject-only-this-job discipline).
 */
async function computeSSIM(job: SSIMJob): Promise<SSIMResult> {
  try {
    // V5 input validation — guard before any dynamic import (T-16-03-03 mitigation).
    if (!KNOWN_SOURCE_FORMATS.has(String(job.sourceFormat).toLowerCase())) {
      throw new Error('Unsupported sourceFormat for SSIM: ' + String(job.sourceFormat))
    }
    if (!KNOWN_TARGET_FORMATS.has(String(job.targetFormat).toLowerCase())) {
      throw new Error('Unsupported targetFormat for SSIM: ' + String(job.targetFormat))
    }
    // WR-02 pattern from codec.worker.ts:166 — empty-buffer guard (T-16-03-04).
    if (job.rawBuffer.byteLength === 0) throw new Error('Empty rawBuffer')
    if (job.encodedBuffer.byteLength === 0) throw new Error('Empty encodedBuffer')

    // Decode raw + encoded in parallel — jSquash decodes are independent WASM calls.
    const [rawImg, encImg] = await Promise.all([
      decode(job.rawBuffer, job.sourceFormat),
      decode(job.encodedBuffer, job.targetFormat),
    ])

    // Dimensional alignment. If any resize step changed target dimensions, raw and enc
    // won't match — ssim.js requires identical dims. Pitfall 1: use 'stretch' (never
    // 'contain') to preserve full-frame comparison; letterboxing would bias the score.
    let alignedRaw = rawImg
    if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) {
      const { default: resize } = await import('@jsquash/resize')
      alignedRaw = await resize(rawImg, {
        width: encImg.width,
        height: encImg.height,
        method: 'lanczos3',
        fitMethod: 'stretch',
      })
    }

    // Dynamic import of ssim.js — destructured `.default` accessor works whether Vite
    // resolves the UMD/CJS bundle or its ESM shim (Pitfall 5). NEVER hoist to top of file.
    const ssimMod = await import('ssim.js')
    const ssim = (ssimMod as { default?: typeof ssimMod.ssim; ssim: typeof ssimMod.ssim }).default
      ?? ssimMod.ssim

    const start = performance.now()
    // Default options apply weber + maxSize:256 — matches ssim.js recommended settings.
    // NOTE: return { mssim, ms } scalars only — the raw per-pixel matrix from ssim.js
    // is intentionally discarded (~2 MB per file — Anti-Pattern memory blow-up).
    const result = ssim(alignedRaw as unknown as ImageData, encImg as unknown as ImageData)
    const end = performance.now()

    return { mssim: result.mssim, ms: Math.round(end - start) }
  } catch (err) {
    return Promise.reject(err)
  }
}

Comlink.expose({ computeSSIM })
