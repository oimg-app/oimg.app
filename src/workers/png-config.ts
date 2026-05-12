// Phase 4 — PNG resize adapter config builder.
// Source: 04-RESEARCH.md §1.2 (resize signature) + §1.4 (init pattern);
// 04-PATTERNS.md (svg-config.ts analog).
//
// Extracted into its own module so unit tests can import the settings shape
// without evaluating the `@jsquash/*` packages — those only resolve inside
// the Vite browser bundle, not under Node's --experimental-strip-types
// runner. Mirrors the Phase 3 svg-config.ts pattern.

import type { ResizeAlg, Density, CodecSettingsPng } from '@/types'

export interface PngResizeSettings {
  /** '1x' | '2x' | '3x' — the density of the SOURCE FileEntry. */
  sourceDensity: Density
  /** '1x' | '2x' | '3x' — the density THIS variant produces. */
  targetDensity: Density
  /** Curated UI subset (matches src/types/index.ts ResizeAlg).
   *  RESEARCH §1.2 confirms full @jsquash/resize enum is wider; UI ships these four. */
  method: ResizeAlg
  /** Phase 5 — OxiPNG optimization level (0–6). 0 = fastest, 6 = max compression. */
  level: number
  /** Phase 5 — when true, iCCP chunk is extracted pre-decode and re-embedded post-OxiPNG.
   *  Phase 4 no-op amended: Phase 5 implements byte-level iCCP chunk threading. */
  preserveIcc: boolean
}

export function buildPngResizeSettings(args: {
  sourceDensity: Density
  targetDensity: Density
  globalAlg: ResizeAlg
  fileOverride?: ResizeAlg
  globalPreserveIcc: boolean
  filePreserveIcc?: boolean
  globalPng: CodecSettingsPng
}): PngResizeSettings {
  return {
    sourceDensity: args.sourceDensity,
    targetDensity: args.targetDensity,
    method: args.fileOverride ?? args.globalAlg,
    level: Math.max(0, Math.min(6, args.globalPng.level)),
    preserveIcc: args.filePreserveIcc ?? args.globalPreserveIcc,
  }
}
