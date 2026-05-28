// Phase 08 — PIPE-01/02: Comlink codec worker — dynamic codec imports. Source: 08-02-PLAN.md
// Phase 09 — Plan 02: Real jSquash + svgo adapters (ENC-01..05). WR-02/WR-03 fold-in.
import * as Comlink from 'comlink'
import type { FileSettings } from '@/lib/stub-data'
import { SVGO_PLUGINS } from '@/lib/stub-data'

// Dev guard: warn if crossOriginIsolated is false (OxiPNG MT will be disabled)
if (import.meta.env.DEV && !crossOriginIsolated) {
  console.warn('[codec-worker] crossOriginIsolated is false — OxiPNG MT disabled')
}

export interface EncodeJob {
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'
  sourceFormat: 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'svg'  // NEW — drives decoder selection
  buffer: ArrayBuffer
  settings: FileSettings  // typed per-file settings (replaces Record<string, unknown>)
}

export interface EncodeResult {
  buffer: ArrayBuffer
  originalSize: number
  optimizedSize: number
}

// Known codec values for input validation (T-08-03: ASVS V5 Input Validation)
const KNOWN_CODECS = new Set<string>(['PNG', 'WebP', 'JPEG', 'AVIF', 'SVG'])

// Source-agnostic decode helper — ALL imports inside switch branches (PIPE-02 dynamic-import discipline)
// Throws on unknown sourceFormat (T-9-SRC mitigation)
async function decodeSource(buffer: ArrayBuffer, sourceFormat: string): Promise<ImageData> {
  switch (sourceFormat.toLowerCase()) {
    case 'png': {
      const { decode } = await import('@jsquash/png')
      return decode(buffer)
    }
    case 'jpeg':
    case 'jpg': {
      const { decode } = await import('@jsquash/jpeg')
      return decode(buffer)
    }
    case 'webp': {
      const { decode } = await import('@jsquash/webp')
      return decode(buffer)
    }
    case 'avif': {
      const { decode } = await import('@jsquash/avif')
      return decode(buffer)
    }
    default:
      throw new Error('Unknown source format: ' + sourceFormat)
  }
}

// Map the inspector Fit mode to jSquash's fitMethod. WR-04: jSquash resize only offers
// 'stretch' | 'contain' (no native 'cover'); its 'contain' crops to fill the target box, which is
// the closest available behavior to 'cover'. 'fill' distorts → 'stretch'. 'cover' and 'contain'
// both map to jSquash 'contain' (documented limitation: true letterbox-contain vs cover-crop are
// not separately expressible with the current @jsquash/resize surface).
function toFitMethod(fit: string): 'stretch' | 'contain' {
  switch (fit) {
    case 'fill':
      return 'stretch'
    case 'cover':
    case 'contain':
    default:
      return 'contain'
  }
}

// Resize-before-encode helper (D-10) — returns imageData unchanged if resizeOn is falsy
async function maybeResize(imageData: ImageData, settings: FileSettings): Promise<ImageData> {
  if (!settings.resizeOn || !settings.w) return imageData
  // WR-04: width comes from a free-text input — Number('') / Number('abc') is NaN, which would make
  // resize() throw or produce garbage. Bail out (no resize) on non-finite or non-positive width.
  const width = Number(settings.w)
  if (!Number.isFinite(width) || width <= 0) return imageData
  const height =
    settings.h === 'auto' || !settings.h
      ? Math.round(imageData.height * (width / imageData.width))
      : Number(settings.h)
  // WR-04: same numeric guard for an explicit height
  if (!Number.isFinite(height) || height <= 0) return imageData
  const { default: resize } = await import('@jsquash/resize')
  return resize(imageData, {
    width,
    height,
    method: settings.alg as 'lanczos3' | 'mitchell' | 'catrom' | 'triangle',
    fitMethod: toFitMethod(settings.fit),
  })
}

async function optimize(job: EncodeJob): Promise<EncodeResult> {
  // Validate codec against known enum before dispatch — never index with raw value (T-9-ENUM)
  if (!KNOWN_CODECS.has(String(job.codec))) {
    throw new Error('Invalid codec: ' + String(job.codec))
  }

  // CR-03 / D-12 metadata limitation (KNOWN, by design — see 09-RESEARCH "strip-metadata note"):
  // The raster path is decode → ImageData → encode. EXIF/XMP/IPTC/ICC all live in the file
  // *container*, NOT in raw pixel data, so they are unconditionally dropped at the decode boundary
  // for ALL raster codecs (MozJPEG, libwebp, libavif). Consequences:
  //   • settings.stripMeta is effectively ALWAYS honored — there is no jSquash flag to *retain*
  //     EXIF, so we cannot do less than strip it. No per-codec wiring is possible or needed.
  //   • settings.keepIcc CANNOT be honored — no jSquash codec exposes an ICC-preservation option.
  //     The UI disables that switch (CodecPanel) so we never claim control we don't have.
  // Do not fabricate fake metadata wiring here; if jSquash adds an ICC API, wire keepIcc then.

  // Wrap in try/catch so malformed buffers reject the job Promise but never crash the worker (T-08-01)
  try {
    switch (job.codec) {
      case 'PNG': {
        // WR-02: empty-buffer guard before any await import (T-9-V5)
        if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
        // OxiPNG optimise accepts ArrayBuffer directly for PNG→PNG; no decode needed
        const { optimise } = await import('@jsquash/oxipng')
        const level = (job.settings.method as number) ?? 2  // map effort→level (Pitfall 4)
        const result = await optimise(job.buffer, { level, interlace: false, optimiseAlpha: true })
        // WR-03: zero-copy return via Comlink.transfer
        return Comlink.transfer(
          { buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength },
          [result],
        )
      }

      case 'WebP': {
        // WR-02: empty-buffer guard (T-9-V5)
        if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
        let imageData = await decodeSource(job.buffer, job.sourceFormat)
        imageData = await maybeResize(imageData, job.settings)
        const { encode } = await import('@jsquash/webp')
        const result = await encode(imageData, {
          quality: job.settings.q ?? 82,
          method: job.settings.method ?? 4,
          lossless: job.settings.lossless ? 1 : 0,
        })
        return Comlink.transfer(
          { buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength },
          [result],
        )
      }

      case 'JPEG': {
        // WR-02: empty-buffer guard (T-9-V5)
        if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
        let imageData = await decodeSource(job.buffer, job.sourceFormat)
        imageData = await maybeResize(imageData, job.settings)
        const { encode } = await import('@jsquash/jpeg')
        const result = await encode(imageData, {
          quality: job.settings.q ?? 75,
          progressive: job.settings.progressive ?? true,
        })
        return Comlink.transfer(
          { buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength },
          [result],
        )
      }

      case 'AVIF': {
        // WR-02: empty-buffer guard (T-9-V5)
        if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
        // Entire branch in try/catch — Safari <16.4 BigInt failure (Pitfall 2 / T-9-AVIF / D-13)
        try {
          let imageData = await decodeSource(job.buffer, job.sourceFormat)
          imageData = await maybeResize(imageData, job.settings)
          // AVIF WASM (~8MB) lazy-loaded ONLY here — protects <200KB initial-route budget (PIPE-02)
          const { encode } = await import('@jsquash/avif')
          const result = await encode(imageData, {
            quality: job.settings.q ?? 50,
            speed: Math.max(0, 6 - (job.settings.method ?? 4)),  // invert effort→speed (A1)
            lossless: job.settings.lossless ?? false,
          })
          return Comlink.transfer(
            { buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength },
            [result],
          )
        } catch (err) {
          // D-13: rethrow descriptive error; Plan 03 hook converts to per-file fallback + toast
          throw new Error('AVIF not supported in this browser: ' + String(err))
        }
      }

      case 'SVG': {
        // WR-02: empty-buffer guard (T-9-V5)
        if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
        // svgo/browser — lazy-imported inside SVG case only (PIPE-02 / D-08)
        const { optimize: svgoOptimize } = await import('svgo/browser')
        // Pitfall 1: ArrayBuffer → UTF-8 string before svgo (svgo.optimize takes a string)
        const svgString = new TextDecoder('utf-8').decode(job.buffer)
        // D-09: curated plugin toggles drive overrides; disabled plugins get overrides[id]=false.
        // CR-03: fall back to SVGO_PLUGINS defaults (not an empty array) when settings.plugins is
        // missing. An empty array produced zero overrides → every disabled plugin silently
        // re-enabled. Using the curated defaults preserves the intended on/off baseline instead.
        const plugins = job.settings.plugins ?? SVGO_PLUGINS
        const overrides: Record<string, false | Record<string, unknown>> = {}
        for (const p of plugins) {
          if (!p.on) overrides[p.id] = false
        }
        // svgo v4: preset-default + overrides; optimize() is synchronous (no await)
        const svgResult = svgoOptimize(svgString, {
          plugins: [{ name: 'preset-default', params: { overrides } }],
        })
        // A3: result.error may be truthy on failure (does not throw in browser build)
        if (svgResult.error) throw new Error('svgo error: ' + String(svgResult.error))
        // Text-in/text-out: encode result string back to ArrayBuffer
        const buffer = new TextEncoder().encode(svgResult.data).buffer as ArrayBuffer
        return Comlink.transfer(
          { buffer, originalSize: job.buffer.byteLength, optimizedSize: buffer.byteLength },
          [buffer],
        )
      }

      default:
        throw new Error('Invalid codec: ' + String(job.codec))
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

Comlink.expose({ optimize })
