// Phase 16 — MTR-01: sibling Comlink worker for perceptual-quality metrics.
// Phase 17 — MTR-02: Butteraugli via @squoosh-kit/visdif.
// change:deepen-worker-decode — one computeMetrics() call decodes + aligns the pair ONCE and
// returns both scores; a failed metric is null, never a rejection for the whole job.
// PIPE-02 discipline: ssim.js / visdif / codec imports are dynamic-inside-branch.
import * as Comlink from 'comlink'
import { ACCEPTED_EXTS, extForCodec, type SourceFormat } from '@/lib/formats'
import { CODECS } from '@/lib/constants'
import { decodeImage } from './decode'

export interface MetricJob {
  rawBuffer: ArrayBuffer
  encodedBuffer: ArrayBuffer
  sourceFormat: Exclude<SourceFormat, 'svg'>
  targetFormat: 'png' | 'jpeg' | 'webp' | 'avif'
}

/** null = that metric failed to compute (ReportPanel renders N/A). */
export interface MetricsResult {
  ssim: number | null
  butteraugli: number | null
}

export type MetricsApi = {
  computeMetrics: (j: MetricJob) => Promise<MetricsResult>
}

// Phase 17 — MTR-02: visdif factory cache. 'client' mode is REQUIRED — nested worker under
// Vite SPA fallback breaks WASM URL resolution (verbatim precedent:
// codec.worker.ts createImagequantQuantizer('client'), commit d3d2d2e).
type VisDifFactory = (a: unknown, b: unknown, signal?: AbortSignal) => Promise<number>
let _visdif: VisDifFactory | null = null
async function getVisDif(): Promise<VisDifFactory> {
  if (_visdif) return _visdif
  // Rule 3 auto-fix (Phase 17-05): @squoosh-kit/visdif@0.2.4 ships a Node-only Emscripten WASM
  // glue (visdif.js) with `ENVIRONMENT_IS_NODE=true` hardcoded — its top-level init reads
  // `__dirname` / `process.argv`, which a Web Worker lacks. The Node branches never *execute*
  // (the wrapper passes `{ wasmBinary }` directly), so bare shims survive module init.
  const g = globalThis as unknown as {
    __dirname?: string
    process?: { argv: string[]; exit: (n: number) => void }
  }
  if (typeof g.__dirname === 'undefined') g.__dirname = '/'
  if (typeof g.process === 'undefined') g.process = { argv: [], exit: () => {} }
  // PIPE-02: dynamic import — the visdif chunk only enters the graph on first use.
  const { createVisDiff } = await import('@squoosh-kit/visdif')
  const rawCompare = createVisDiff('client') as unknown as VisDifFactory
  // Rule 1 auto-fix (Phase 17-05): visdif's first compare() installs `self.onmessage`, which
  // then answers EVERY message to this worker (including Comlink's APPLY) with a malformed
  // reply, silently poisoning later calls. Comlink's addEventListener('message') is a separate
  // surface, so nulling the IDL attribute after each compare is safe and is the earliest
  // point the handler exists.
  const wrappedCompare: VisDifFactory = async (a, b, signal) => {
    try {
      return await rawCompare(a, b, signal)
    } finally {
      ;(self as unknown as { onmessage: unknown }).onmessage = null
    }
  }
  _visdif = wrappedCompare
  return _visdif
}

// V5 Input Validation — enum guards mirroring codec.worker.ts KNOWN_CODECS.
// Any format outside these sets rejects before touching a dynamic import.
const KNOWN_SOURCE_FORMATS = new Set<string>([...ACCEPTED_EXTS].filter((f) => f !== 'svg'))
const KNOWN_TARGET_FORMATS = new Set<string>(CODECS.filter((c) => c !== 'SVG').map(extForCodec))

async function ssimOf(raw: ImageData, enc: ImageData): Promise<number> {
  // Destructured `.default` accessor works whether Vite resolves the UMD/CJS bundle or its ESM
  // shim (Pitfall 5). Default options = weber + maxSize:256 (ssim.js recommended). Only the
  // scalar is kept — the per-pixel matrix is ~2 MB per file.
  const ssimMod = await import('ssim.js')
  const ssim = (ssimMod as { default?: typeof ssimMod.ssim; ssim: typeof ssimMod.ssim }).default ?? ssimMod.ssim
  return ssim(raw as unknown as ImageData, enc as unknown as ImageData).mssim
}

async function butteraugliOf(raw: ImageData, enc: ImageData): Promise<number> {
  // ImageInput shape from @squoosh-kit/runtime is { data, width, height } — ImageData matches.
  const distance = await (await getVisDif())(raw as unknown, enc as unknown)
  // T-17-03-04: reject NaN/Infinity leaks from wasm before they reach FileEntry.metrics.
  if (!Number.isFinite(distance)) throw new Error('Butteraugli returned non-finite distance: ' + String(distance))
  return distance
}

/**
 * SSIM (0..1, higher = closer) and Butteraugli distance (lower = better, 0 = identical) between
 * raw and encoded bytes. Dimensional alignment uses lanczos3 + fitMethod 'stretch' (Pitfall 1 —
 * never 'contain': letterboxing would bias both scores). Validation/decoding failures reject
 * the job; a single metric failing yields null for that metric only.
 */
async function computeMetrics(job: MetricJob): Promise<MetricsResult> {
  if (!KNOWN_SOURCE_FORMATS.has(String(job.sourceFormat).toLowerCase())) {
    throw new Error('Unsupported sourceFormat for metrics: ' + String(job.sourceFormat))
  }
  if (!KNOWN_TARGET_FORMATS.has(String(job.targetFormat).toLowerCase())) {
    throw new Error('Unsupported targetFormat for metrics: ' + String(job.targetFormat))
  }
  if (job.rawBuffer.byteLength === 0) throw new Error('Empty rawBuffer')
  if (job.encodedBuffer.byteLength === 0) throw new Error('Empty encodedBuffer')

  const [rawImg, encImg] = await Promise.all([
    decodeImage(job.rawBuffer, job.sourceFormat),
    decodeImage(job.encodedBuffer, job.targetFormat),
  ])
  let raw = rawImg
  if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) {
    const { default: resize } = await import('@jsquash/resize')
    raw = await resize(rawImg, { width: encImg.width, height: encImg.height, method: 'lanczos3', fitMethod: 'stretch' })
  }

  const [s, b] = await Promise.allSettled([ssimOf(raw, encImg), butteraugliOf(raw, encImg)])
  return {
    ssim: s.status === 'fulfilled' && Number.isFinite(s.value) ? s.value : null,
    butteraugli: b.status === 'fulfilled' ? b.value : null,
  }
}

Comlink.expose({ computeMetrics })
