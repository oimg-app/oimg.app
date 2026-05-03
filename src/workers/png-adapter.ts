/**
 * PNG Resize Adapter — Phase 4
 * Source: 04-RESEARCH.md §1.1 (decode), §1.2 (resize), §1.4 (init pattern),
 * §Code Examples (lines 609-662).
 *
 * Pipeline (worker side):
 *   ArrayBuffer → @jsquash/png decode → ImageData → @jsquash/resize → ImageData
 *   → @jsquash/png encode → ArrayBuffer.
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
 * D-10 (Post-Research amendment): preserveIcc flag is wired through but the
 * worker IGNORES it — always strips. Per RESEARCH §1.5, all five jSquash
 * codecs expose ZERO ICC option; ICC chunk extract/embed (~150-300 LOC per
 * format) is Phase 5 work. UI helper text (UI-SPEC §Surface 9) discloses this.
 */

import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'
import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { PngResizeSettings } from './png-config'
import { buildPngResizeSettings } from './png-config'

// Re-export so callers that historically imported buildPngResizeSettings
// from png-adapter (App.tsx will, mirroring the svg-adapter pattern) keep
// working without churn.
export { buildPngResizeSettings }

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = settings as PngResizeSettings

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

  return {
    output: encoded,
    meta: {
      codecVersion: 'png@3.1.1+resize@2.1.1',
      density: opts.targetDensity,
    },
  }
}
