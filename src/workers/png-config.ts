// Phase 4 — PNG resize adapter config builder.
// Source: 04-RESEARCH.md §1.2 (resize signature) + §1.4 (init pattern);
// 04-PATTERNS.md (svg-config.ts analog).
//
// Extracted into its own module so unit tests can import the settings shape
// without evaluating the `@jsquash/*` packages — those only resolve inside
// the Vite browser bundle, not under Node's --experimental-strip-types
// runner. Mirrors the Phase 3 svg-config.ts pattern.

import type { ResizeAlg, SourceDensity } from '../types/index.ts'

export interface PngResizeSettings {
  /** '1x' | '2x' | '3x' — the density of the SOURCE FileEntry. */
  sourceDensity: SourceDensity
  /** '1x' | '2x' | '3x' — the density THIS variant produces. */
  targetDensity: SourceDensity
  /** Curated UI subset (matches src/types/index.ts ResizeAlg).
   *  RESEARCH §1.2 confirms full @jsquash/resize enum is wider; UI ships these four. */
  method: ResizeAlg
  /** Wired but no-op in P4 per Post-Research D-10 amendment.
   *  Phase 5 implements byte-level iCCP chunk threading. */
  preserveIcc: boolean
}

export function buildPngResizeSettings(args: {
  sourceDensity: SourceDensity
  targetDensity: SourceDensity
  globalAlg: ResizeAlg
  fileOverride?: ResizeAlg
  globalPreserveIcc: boolean
  filePreserveIcc?: boolean
}): PngResizeSettings {
  return {
    sourceDensity: args.sourceDensity,
    targetDensity: args.targetDensity,
    method: args.fileOverride ?? args.globalAlg,
    preserveIcc: args.filePreserveIcc ?? args.globalPreserveIcc,
  }
}
