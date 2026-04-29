import type {
  FormatDefinition,
  CodecSettingsSvg,
  CodecSettingsPng,
  CodecSettingsJpeg,
  CodecSettingsWebp,
  CodecSettingsAvif,
  GlobalSettings,
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
