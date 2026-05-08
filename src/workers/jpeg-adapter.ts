// Phase 5 plan 02 — JPEG (MozJPEG) encode adapter. OPT-04.
// Lazy-init: jpegMod null until first job. Static import path — Vite code-splits.
// D-10 (CONTEXT.md): all four raster adapters use lazy-init for consistency.
// T-5-02-01: decode() wrapped in try/catch; throws AdapterError('jpeg','decode',msg).

import type { AdapterMeta } from './types.ts'
import { AdapterError } from './types.ts'
import type { CodecSettingsJpeg } from '../types/index.ts'
import { buildJpegSettings } from './jpeg-config.ts'

type JpegModule = typeof import('@jsquash/jpeg')
let jpegMod: JpegModule | null = null
async function getJpeg(): Promise<JpegModule> {
  if (!jpegMod) jpegMod = await import('@jsquash/jpeg')
  return jpegMod
}

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = buildJpegSettings({
    globalJpeg: settings as CodecSettingsJpeg,
    fileOverride: undefined,
  })
  const { decode, encode } = await getJpeg()

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError(
      'jpeg',
      'decode',
      err instanceof Error ? err.message : String(err),
    )
  }

  let encoded: ArrayBuffer
  try {
    encoded = await encode(decoded, { quality: opts.quality, progressive: opts.progressive })
  } catch (err) {
    throw new AdapterError(
      'jpeg',
      'encode',
      err instanceof Error ? err.message : String(err),
    )
  }

  return { output: encoded, meta: { codecVersion: 'jpeg@1.6.0' } }
}
