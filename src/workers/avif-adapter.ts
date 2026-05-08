// Phase 5 plan 02 — AVIF encode adapter. OPT-05.
// Lazy-init: avifMod null until first job. Static import path — Vite code-splits
// avif-adapter into its own chunk (~2 MB gzipped bundle deferred until needed).
// D-09 + D-10 (CONTEXT.md): AVIF is the heaviest codec; lazy-loading mandatory.
// T-5-02-01: decode() wrapped in try/catch; throws AdapterError('avif','decode',msg).
//
// Note: @jsquash/avif 2.x uses BigInt for decode — drops Safari < 16.4 for worker-side
// decode. Browser-native <img> display is unaffected (CenterPane uses sourceBlob).

import type { AdapterMeta } from './types.ts'
import { AdapterError } from './types.ts'
import type { CodecSettingsAvif } from '../types/index.ts'
import { buildAvifSettings } from './avif-config.ts'

type AvifModule = typeof import('@jsquash/avif')
let avifMod: AvifModule | null = null
async function getAvif(): Promise<AvifModule> {
  if (!avifMod) avifMod = await import('@jsquash/avif')
  return avifMod
}

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = buildAvifSettings({
    globalAvif: settings as CodecSettingsAvif,
    fileOverride: undefined,
  })
  const { decode, encode } = await getAvif()

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError(
      'avif',
      'decode',
      err instanceof Error ? err.message : String(err),
    )
  }

  let encoded: ArrayBuffer
  try {
    encoded = await encode(decoded, { quality: opts.quality, lossless: opts.lossless ? 1 : 0 })
  } catch (err) {
    throw new AdapterError(
      'avif',
      'encode',
      err instanceof Error ? err.message : String(err),
    )
  }

  return { output: encoded, meta: { codecVersion: 'avif@2.1.1' } }
}
