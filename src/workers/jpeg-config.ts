// Phase 5 plan 02 — JPEG encode config builder.
// Extracted into own module so unit tests import without evaluating @jsquash/jpeg.
// Phase 4 png-config.ts precedent — Vite alias @/types unresolvable under
// node --experimental-strip-types; use relative ../types/index.ts.

import type { CodecSettingsJpeg } from '@/types'

export interface JpegEncodeSettings {
  quality: number
  progressive: boolean
  // chroma_subsample: number — confirmed available from @jsquash/jpeg meta.js
  // (D-10: included if chroma_subsample is a top-level encode option)
  // Plan 05-01 SUMMARY confirmed: chroma_subsample (number, default 2) is available.
  // We expose it as an optional passthrough; buildJpegSettings only sets it if
  // the source type includes it. For now CodecSettingsJpeg has quality+progressive —
  // chroma is advanced and not in the Phase 5 minimal UI surface (D-10 minimal-surface rule).
}

export function buildJpegSettings(args: {
  globalJpeg: CodecSettingsJpeg
  fileOverride?: Partial<CodecSettingsJpeg>
}): JpegEncodeSettings {
  const merged = { ...args.globalJpeg, ...args.fileOverride }
  return {
    quality: Math.max(0, Math.min(100, merged.quality)),
    progressive: merged.progressive,
  }
}
