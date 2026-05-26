// Phase 08 — PIPE-01/02: Comlink codec worker — dynamic codec imports. Source: 08-02-PLAN.md
import * as Comlink from 'comlink'

// Dev guard: warn if crossOriginIsolated is false (OxiPNG MT will be disabled)
if (import.meta.env.DEV && !crossOriginIsolated) {
  console.warn('[codec-worker] crossOriginIsolated is false — OxiPNG MT disabled')
}

export interface EncodeJob {
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'
  buffer: ArrayBuffer
  settings: Record<string, unknown>
}

export interface EncodeResult {
  buffer: ArrayBuffer
  originalSize: number
  optimizedSize: number
}

// Known codec values for input validation (T-08-03: ASVS V5 Input Validation)
const KNOWN_CODECS = new Set<string>(['PNG', 'WebP', 'JPEG', 'AVIF', 'SVG'])

async function optimize(job: EncodeJob): Promise<EncodeResult> {
  // Validate codec against known enum before dispatch — never index with raw value
  if (!KNOWN_CODECS.has(String(job.codec))) {
    throw new Error('Invalid codec: ' + String(job.codec))
  }

  // Wrap in try/catch so malformed buffers reject the job Promise but never crash the worker (T-08-01)
  try {
    switch (job.codec) {
      case 'PNG': {
        // Dynamic imports — ALL @jsquash/* imports MUST be await import() inside the branch (PIPE-02)
        const { decode } = await import('@jsquash/png')
        const { optimise } = await import('@jsquash/oxipng')
        const imageData = await decode(job.buffer)
        const result = await optimise(imageData, { level: (job.settings.level as number) ?? 3 })
        return {
          buffer: result,
          originalSize: job.buffer.byteLength,
          optimizedSize: result.byteLength,
        }
      }
      case 'WebP':
      case 'JPEG':
      case 'AVIF':
      case 'SVG':
        // Real encoders land in Phase 9 — SVG must NOT import svgo here (Open Question 1)
        throw new Error('Codec not yet implemented: ' + job.codec)
      default:
        throw new Error('Invalid codec: ' + String(job.codec))
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

Comlink.expose({ optimize })
