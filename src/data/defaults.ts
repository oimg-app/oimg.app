// Production codec defaults consumed by the Phase 2+ pipeline.
// Single source of truth for "what should this codec do by default."
// Phase 2 plan 02-05 (cleanup wave) deleted src/data/mock.ts; the visual-shell
// constants that lived there (CODECS, RESIZE_ALG, FIT_MODES, SVGO_PLUGINS) are
// now consolidated here as the canonical list for UI controls.

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
  SvgoPlugin,
} from '@/types'

export const DEFAULT_FORMATS: FormatDefinition[] = [
  { id: 'svg', label: 'SVG', mime: 'image/svg+xml', ext: 'svg' },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp' },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', ext: 'avif' },
]

export const DEFAULT_CODEC_SVG: CodecSettingsSvg = {
  preset: 'default',
  plugins: {
    removeComments: true,
    removeMetadata: true,
    removeViewBox: false, // D-07 note: removeViewBox off by default — preserves responsive scaling
    cleanupIds: true,
    convertPathData: true,
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

// Codec / resize / fit value sets — moved from src/data/mock.ts in plan 02-05.
// Used by the Toolbar codec menu (TitleBar) and CodecPanel segmented controls.
export const CODECS: CodecLabel[] = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF']
export const RESIZE_ALG: ResizeAlg[] = ['lanczos3', 'mitchell', 'catrom', 'triangle']
export const FIT_MODES: FitMode[] = ['cover', 'contain', 'fill']

// Default SVGO plugin list — moved from src/data/mock.ts in plan 02-05.
// SvgoPanel renders these as togglable rows; Phase 3 will reconcile this list
// with the live svgo v4 plugin registry.
export const SVGO_PLUGINS: SvgoPlugin[] = [
  { id: 'removeDoctype', on: true, saves: '0.4%' },
  { id: 'removeXMLProcInst', on: true, saves: '0.3%' },
  { id: 'removeComments', on: true, saves: '1.2%' },
  { id: 'removeMetadata', on: true, saves: '0.8%' },
  { id: 'removeEditorsNSData', on: true, saves: '2.1%' },
  { id: 'cleanupAttrs', on: true, saves: '0.6%' },
  { id: 'mergeStyles', on: true, saves: '4.8%' },
  { id: 'inlineStyles', on: true, saves: '6.2%' },
  { id: 'minifyStyles', on: true, saves: '3.4%' },
  { id: 'convertStyleToAttrs', on: false, saves: '1.8%' },
  { id: 'cleanupIds', on: true, saves: '5.6%' },
  { id: 'removeRasterImages', on: false, saves: '—' },
  { id: 'removeUselessDefs', on: true, saves: '2.4%' },
  { id: 'cleanupNumericValues', on: true, saves: '8.1%' },
  { id: 'convertColors', on: true, saves: '1.4%' },
  { id: 'removeEmptyAttrs', on: true, saves: '0.5%' },
  { id: 'removeEmptyContainers', on: true, saves: '0.7%' },
  { id: 'removeUnusedNS', on: true, saves: '0.3%' },
  { id: 'sortAttrs', on: true, saves: '—' },
  { id: 'removeDimensions', on: false, saves: '0.4%' },
  { id: 'convertPathData', on: true, saves: '14.3%' },
  { id: 'mergePaths', on: true, saves: '7.2%' },
]
