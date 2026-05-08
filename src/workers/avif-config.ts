// Phase 5 plan 02 — AVIF encode config builder.
// Extracted into own module so unit tests import without evaluating @jsquash/avif.
// Phase 4 png-config.ts precedent — use relative ../types/index.ts (no @/ alias).

import type { CodecSettingsAvif } from '../types/index.ts'

export interface AvifEncodeSettings {
  quality: number
  lossless: boolean
}

export function buildAvifSettings(args: {
  globalAvif: CodecSettingsAvif
  fileOverride?: Partial<CodecSettingsAvif>
}): AvifEncodeSettings {
  const merged = { ...args.globalAvif, ...args.fileOverride }
  return {
    quality: Math.max(0, Math.min(100, merged.quality)),
    lossless: merged.lossless,
  }
}
