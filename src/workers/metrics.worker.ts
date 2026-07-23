// Phase 16 — MTR-01: sibling Comlink worker for perceptual-quality metrics.
// Phase 17 — MTR-02: extended with computeButteraugli (@squoosh-kit/visdif).
// PIPE-02 discipline: every codec / resize / ssim.js / visdif import is dynamic-inside-branch.
// Only Comlink is allowed at the top of the file — see codec.worker.ts for the pattern.
import * as Comlink from 'comlink'

export interface MetricJob {
  rawBuffer: ArrayBuffer
  encodedBuffer: ArrayBuffer
  sourceFormat: 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'heic' | 'heif'
  targetFormat: 'png' | 'jpeg' | 'webp' | 'avif'
}

// Phase 17 — MTR-02: back-compat alias so 16-04's existing `SSIMJob` imports still resolve.
export type SSIMJob = MetricJob

export interface SSIMResult {
  mssim: number
  ms: number
}

// Phase 17 — MTR-02: distance = lower is better (0 = identical). See @squoosh-kit/visdif README.
export interface ButteraugliResult {
  distance: number
  ms: number
}

export type MetricsApi = {
  computeSSIM: (j: MetricJob) => Promise<SSIMResult>
  computeButteraugli: (j: MetricJob) => Promise<ButteraugliResult>
}

// Phase 17 — MTR-02: visdif factory cache. 'client' mode is REQUIRED — nested worker under
// Vite SPA fallback breaks WASM URL resolution (verbatim precedent:
// codec.worker.ts:114-131 createImagequantQuantizer('client'), commit d3d2d2e).
type VisDifFactory = (a: unknown, b: unknown, signal?: AbortSignal) => Promise<number>
let _visdif: VisDifFactory | null = null
async function getVisDif(): Promise<VisDifFactory> {
  if (_visdif) return _visdif
  // Rule 3 auto-fix (Phase 17-05): @squoosh-kit/visdif@0.2.4 ships a Node-only
  // Emscripten WASM glue (visdif.js) with `ENVIRONMENT_IS_NODE=true` hardcoded — its
  // top-level init reads `__dirname` and the browser Web Worker context has none, so
  // the dynamic `import(jsPath)` throws before any of our code runs. The Node-only
  // fs/path branches are never *executed* at call time because the wrapper passes the
  // wasm binary directly via `{ wasmBinary }`, so a bare `__dirname` shim is enough
  // to survive module init. Same-publisher `@squoosh-kit/imagequant@0.2.4` builds with
  // `ENVIRONMENT_IS_WORKER=true` and doesn't need this — this is a visdif-only bug.
  const g = globalThis as unknown as {
    __dirname?: string
    process?: { argv: string[]; exit: (n: number) => void }
  }
  if (typeof g.__dirname === 'undefined') g.__dirname = '/'
  // visdif.js also reads `process.argv` / `process.exit` inside its Node branch.
  // Provide a no-op shim so the top-level init survives.
  if (typeof g.process === 'undefined') {
    g.process = { argv: [], exit: () => {} }
  }
  // PIPE-02: dynamic import — the visdif chunk (JS + wasm) only enters the graph when this
  // function is first called. Do NOT hoist to top of file.
  const { createVisDiff } = await import('@squoosh-kit/visdif')
  const rawCompare = createVisDiff('client') as unknown as VisDifFactory
  // Rule 1 auto-fix (Phase 17-05): @squoosh-kit/visdif@0.2.4's `VisDifClientBridge.compare`
  // wraps `await Promise.resolve().then(() => (init_visdif_worker(), exports_visdif_worker))`,
  // deferring `init_visdif_worker()` to the FIRST `compare()` call (not module init).
  // `init_visdif_worker()` installs `self.onmessage = handler` in the worker's global
  // scope. That handler catches EVERY message posted to the worker — including
  // Comlink's APPLY messages — and synchronously posts back
  // `{id, ok:false, error:"Unknown message type: APPLY"}` (no `type` field). On the
  // main thread Comlink's `pendingListeners` map resolves-and-deletes on the first
  // matching id; the malformed response wins and `fromWireValue` returns `undefined`,
  // silently poisoning every subsequent `worker.compute*()` call.
  //
  // Fix: wrap `compare` to null `self.onmessage` after every call. Comlink's
  // `addEventListener('message', ...)` listener is unaffected by the IDL-attribute
  // reset (they're independent event surfaces). Client-mode compare() doesn't rely on
  // postMessage-loopback — `visdifCompareClient(...)` calls the wasm inline — so no
  // functionality is lost.
  //
  // Cannot fix by null-ing before import or immediately after `createVisDiff`: the
  // handler doesn't exist yet (it's installed deep inside the first compare's
  // microtask). Nulling immediately after each compare — before the NEXT worker
  // message arrives — is the earliest safe point.
  const disarm = (): void => {
    const sw = self as unknown as { onmessage: unknown }
    sw.onmessage = null
  }
  const wrappedCompare: VisDifFactory = async (a, b, signal) => {
    try {
      return await rawCompare(a, b, signal)
    } finally {
      disarm()
    }
  }
  _visdif = wrappedCompare
  return _visdif
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
async function computeSSIM(job: MetricJob): Promise<SSIMResult> {
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

/**
 * Phase 17 — MTR-02: Compute Butteraugli perceptual distance between raw and encoded buffers.
 * Distance is "lower is better" (0 = pixel-identical, <1 imperceptible, >3 visible artifacts).
 * Same dim-align + V5-validation discipline as computeSSIM — Butteraugli also requires
 * identical dims per @squoosh-kit/visdif README.
 * Returns { distance, ms } where ms is wall-clock cost of the visdif comparison.
 * Wrapped in try/catch so a per-job failure rejects only this promise — the worker
 * survives (mirrors codec.worker.ts:288-291 reject-only-this-job discipline).
 */
async function computeButteraugli(job: MetricJob): Promise<ButteraugliResult> {
  try {
    // V5 input validation — guard before any dynamic import (T-17-03-02 mitigation).
    if (!KNOWN_SOURCE_FORMATS.has(String(job.sourceFormat).toLowerCase())) {
      throw new Error('Unsupported sourceFormat for Butteraugli: ' + String(job.sourceFormat))
    }
    if (!KNOWN_TARGET_FORMATS.has(String(job.targetFormat).toLowerCase())) {
      throw new Error('Unsupported targetFormat for Butteraugli: ' + String(job.targetFormat))
    }
    // WR-02 pattern from codec.worker.ts:166 — empty-buffer guard (T-17-03-03).
    if (job.rawBuffer.byteLength === 0) throw new Error('Empty rawBuffer')
    if (job.encodedBuffer.byteLength === 0) throw new Error('Empty encodedBuffer')

    // Decode raw + encoded in parallel — jSquash decodes are independent WASM calls.
    const [rawImg, encImg] = await Promise.all([
      decode(job.rawBuffer, job.sourceFormat),
      decode(job.encodedBuffer, job.targetFormat),
    ])

    // Dimensional alignment — Butteraugli requires identical dims per visdif README (Pitfall 2).
    // Reuse the same lanczos3 + stretch block as computeSSIM (Pitfall 1 — stretch preserves
    // pixel-for-pixel comparison; contain would letterbox and bias the distance).
    let alignedRaw: ImageData = rawImg
    if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) {
      const { default: resize } = await import('@jsquash/resize')
      alignedRaw = await resize(rawImg, {
        width: encImg.width,
        height: encImg.height,
        method: 'lanczos3',
        fitMethod: 'stretch',
      })
    }

    const compare = await getVisDif()
    const start = performance.now()
    // ImageInput shape from @squoosh-kit/runtime: { data: Uint8ClampedArray, width, height }.
    // ImageData already matches — direct pass-through, no adapter needed (RESEARCH §A5).
    const distance = await compare(alignedRaw as unknown, encImg as unknown)
    const end = performance.now()

    // T-17-03-04 mitigation: reject NaN/Infinity leaks from wasm. Prevents bad values from
    // landing in FileEntry.metrics.butteraugli and misclassifying via butteraugliBand().
    if (!Number.isFinite(distance)) {
      throw new Error('Butteraugli returned non-finite distance: ' + String(distance))
    }

    return { distance, ms: Math.round(end - start) }
  } catch (err) {
    return Promise.reject(err)
  }
}

Comlink.expose({ computeSSIM, computeButteraugli })
