// Phase 5 plan 02 — WebP encode config builder.
// Extracted into own module so unit tests import without evaluating @jsquash/webp.
// Phase 4 png-config.ts precedent — use relative ../types/index.ts (no @/ alias).

import type { CodecSettingsWebp } from '../types/index.ts'

export interface WebpEncodeSettings {
  quality: number
  lossless: boolean
  method: number
}

export function buildWebpSettings(args: {
  globalWebp: CodecSettingsWebp
  fileOverride?: Partial<CodecSettingsWebp>
}): WebpEncodeSettings {
  const merged = { ...args.globalWebp, ...args.fileOverride }
  return {
    quality: Math.max(0, Math.min(100, merged.quality)),
    lossless: merged.lossless,
    method: Math.max(0, Math.min(6, merged.method)),
  }
}
