export const APP_VERSION = 'v0.4.2'
// Production codec defaults consumed by the Phase 2+ pipeline.
// Single source of truth for "what should this codec do by default."
// Phase 2 plan 02-05 (cleanup wave) deleted src/data/mock.ts; the visual-shell
// constants that lived there (CODECS, RESIZE_ALG, FIT_MODES) are now
// consolidated here as the canonical list for UI controls.
// Phase 3 plan 03-A removed the SVGO_PLUGINS mock array — the curated
// 12-plugin record now lives in DEFAULT_CODEC_SVG.plugins below and is the
// SOLE source of truth for the SvgoPanel toggle list (Plan B rewrites the
// panel to consume the record directly).

import type {
  FormatDefinition,
  CodecSettingsSvg,
  CodecSettingsPng,
  CodecSettingsJpeg,
  CodecSettingsWebp,
  CodecSettingsAvif,
  GlobalSettings,
  CodecLabel,
  ResizeAlg,
  FitMode,
} from '@/types'

export const DEFAULT_FORMATS: FormatDefinition[] = [
  { id: 'svg', label: 'SVG', mime: 'image/svg+xml', ext: 'svg' },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp' },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', ext: 'avif' },
]

// Phase 3 (D-05/D-07) — curated 12-plugin set.
// Mirrors SVGO v4 preset-default exactly: the 10 plugins set to `true` are
// IN preset-default; `removeViewBox` and `removeDimensions` are NOT in
// preset-default and ship as opt-in extras (default `false`). This is the
// correct "mirror preset-default" reading of D-07 — confirmed by reading
// svgo@4.0.1/plugins/preset-default.js (RESEARCH.md §Critical Contradiction).
// The 03-UI-SPEC.md row 11 default `on` for removeViewBox is a documented
// spec error; the false default below is the correct behavior.
export const DEFAULT_CODEC_SVG: CodecSettingsSvg = {
  preset: 'default',
  plugins: {
    removeComments: true,
    removeMetadata: true,
    removeUselessDefs: true,
    removeUnusedNS: true,
    cleanupIds: true,
    cleanupNumericValues: true,
    convertColors: true,
    convertPathData: true,
    mergePaths: true,
    minifyStyles: true,
    removeViewBox: false, // NOT in preset-default — opt-in extra; foot-gun (D-07)
    removeDimensions: false, // NOT in preset-default — opt-in extra; foot-gun (D-07)
  },
}

export const DEFAULT_CODEC_PNG: CodecSettingsPng = {
  level: 3, // OxiPNG level 0–6; 3 is a balanced default
}

export const DEFAULT_CODEC_JPEG: CodecSettingsJpeg = {
  quality: 80,
  progressive: true,
}

export const DEFAULT_CODEC_WEBP: CodecSettingsWebp = {
  quality: 80,
  lossless: false,
  method: 4,
}

export const DEFAULT_CODEC_AVIF: CodecSettingsAvif = {
  quality: 60,
  lossless: false,
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  stripMetadata: true,
  preserveIccProfile: false,
}

// Phase 4 (D-05 + D-06) — default global resize settings. Lanczos3 is the
// photo-grade default; Mitchell/Catrom/Triangle live in RESIZE_ALG for the
// TweaksPanel "Resize / Variants" section dropdown.
export const DEFAULT_RESIZE_SETTINGS: { alg: ResizeAlg } = {
  alg: 'lanczos3',
}

// Codec / resize / fit value sets — moved from src/data/mock.ts in plan 02-05.
// Used by the Toolbar codec menu (TitleBar) and CodecPanel segmented controls.
export const CODECS: CodecLabel[] = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF']
export const RESIZE_ALG: ResizeAlg[] = ['lanczos3', 'mitchell', 'catrom', 'triangle']
export const FIT_MODES: FitMode[] = ['cover', 'contain', 'fill']

// SVGO_PLUGINS mock array removed in Plan 03-A.
// The canonical plugin list is now DEFAULT_CODEC_SVG.plugins above.
// Plan B rewrites SvgoPanel to consume that record directly with live savings.
