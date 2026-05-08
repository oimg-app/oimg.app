// Phase 5 plan 02 — WebP encode adapter. OPT-03.
// Lazy-init: webpMod null until first job. Static import path — Vite code-splits.
// D-10 (CONTEXT.md): all four raster adapters use lazy-init for consistency.
// T-5-02-01: decode() wrapped in try/catch; throws AdapterError('webp','decode',msg).

import type { AdapterMeta } from './types.ts'
import { AdapterError } from './types.ts'
import type { CodecSettingsWebp } from '../types/index.ts'
import { buildWebpSettings } from './webp-config.ts'

type WebpModule = typeof import('@jsquash/webp')
let webpMod: WebpModule | null = null
async function getWebp(): Promise<WebpModule> {
  if (!webpMod) webpMod = await import('@jsquash/webp')
  return webpMod
}

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = buildWebpSettings({
    globalWebp: settings as CodecSettingsWebp,
    fileOverride: undefined,
  })
  const { decode, encode } = await getWebp()

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError(
      'webp',
      'decode',
      err instanceof Error ? err.message : String(err),
    )
  }

  let encoded: ArrayBuffer
  try {
    encoded = await encode(decoded, {
      quality: opts.quality,
      lossless: opts.lossless ? 1 : 0,
      method: opts.method,
    })
  } catch (err) {
    throw new AdapterError(
      'webp',
      'encode',
      err instanceof Error ? err.message : String(err),
    )
  }

  return { output: encoded, meta: { codecVersion: 'webp@1.5.0' } }
}
