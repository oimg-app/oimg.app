/**
 * PNG Resize Adapter — Phase 4 + Phase 5
 * Source: 04-RESEARCH.md §1.1 (decode), §1.2 (resize), §1.4 (init pattern),
 * §Code Examples (lines 609-662).
 *
 * Pipeline (worker side):
 *   ArrayBuffer → @jsquash/png decode → ImageData → @jsquash/resize → ImageData
 *   → @jsquash/png encode → OxiPNG optimise → ArrayBuffer.
 *
 * D-04 + D-14: each density variant is its own FileEntry, its own pool job,
 * its own adapter call. The adapter NEVER sees more than one density per
 * invocation — output array shape is single, matching the Phase 2 D-04
 * contract verbatim.
 *
 * D-11(a): drop the decoded ImageData reference immediately after resize()
 * resolves. Function-scope GC reclaims it before the encoder allocates its
 * working buffer. No ImageData crosses job boundaries.
 *
 * D-10 (Phase 5): preserveIcc flag is now live — when true, extracts iCCP from
 * the input PNG before decode and re-embeds it after OxiPNG optimisation.
 * When false (default), ICC is stripped per Phase 4 D-10 amendment.
 *
 * D-10 (Phase 5): OxiPNG lazy-init — consistent with jpeg/webp/avif adapters.
 */

import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'
import type { AdapterMeta } from './types.ts'
import { AdapterError } from './types.ts'
import type { PngResizeSettings } from './png-config.ts'
import { buildPngResizeSettings } from './png-config.ts'
import { extractPngIcc, embedPngIcc } from '../lib/icc.ts'

// Lazy-init OxiPNG (Phase 5 D-10 — consistent lazy pattern across all adapters).
// OxiPNG is encode-only: receives PNG bytes (ArrayBuffer), NOT ImageData.
// CRITICAL: do NOT pass `resized` (ImageData) to oxipng — pass `encoded` (PNG bytes).
type OxipngModule = typeof import('@jsquash/oxipng')
let oxipngMod: OxipngModule | null = null
async function getOxipng(): Promise<OxipngModule> {
  if (!oxipngMod) oxipngMod = await import('@jsquash/oxipng')
  return oxipngMod
}

// Re-export so callers that historically imported buildPngResizeSettings
// from png-adapter (App.tsx will, mirroring the svg-adapter pattern) keep
// working without churn.
export { buildPngResizeSettings }

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = settings as PngResizeSettings

  // Phase 5 D-14: extract ICC before decode (before any transformation alters the buffer).
  // Only extract if preserveIcc is true — skip entirely when false (strip by default).
  const iccData = opts.preserveIcc ? extractPngIcc(input) : null

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError(
      'png',
      'decode',
      err instanceof Error ? err.message : String(err),
    )
  }

  const tgtScale = parseInt(opts.targetDensity) / parseInt(opts.sourceDensity)
  const targetW = Math.max(1, Math.round(decoded.width * tgtScale))
  const targetH = Math.max(1, Math.round(decoded.height * tgtScale))

  let resized: ImageData
  try {
    resized = await resize(decoded, {
      width: targetW,
      height: targetH,
      method: opts.method,
    })
  } catch (err) {
    throw new AdapterError(
      'png',
      'process',
      err instanceof Error ? err.message : String(err),
    )
  }
  // D-11(a): `decoded` is unreferenced after this point. Function-scope GC
  // reclaims it before the encoder allocates its working buffer. We do NOT
  // explicitly null it — the const ref dies at function exit and engine
  // minor GC handles the slot reuse (RESEARCH §2.4 verdict).

  let encoded: ArrayBuffer
  try {
    encoded = await encode(resized)
  } catch (err) {
    throw new AdapterError(
      'png',
      'encode',
      err instanceof Error ? err.message : String(err),
    )
  }

  // Phase 5 D-10: OxiPNG optimization step — lossless, level 0–6.
  // OxiPNG is encode-only: receives PNG bytes (ArrayBuffer), NOT ImageData.
  // CRITICAL: pass `encoded` (PNG bytes) — not `resized` (ImageData).
  const { optimise } = await getOxipng()
  let optimized: ArrayBuffer
  try {
    optimized = await optimise(encoded, { level: opts.level })
  } catch (err) {
    throw new AdapterError(
      'png',
      'process',
      err instanceof Error ? err.message : String(err),
    )
  }

  // Phase 5 D-14: re-embed ICC after OxiPNG if we extracted it above.
  // extractPngIcc returns null on malformed chunk — check before embedding.
  const output =
    opts.preserveIcc && iccData !== null ? embedPngIcc(optimized, iccData) : optimized

  return {
    output,
    meta: {
      codecVersion: 'png@3.1.1+resize@2.1.1+oxipng@2.3.0',
      density: opts.targetDensity,
    },
  }
}
