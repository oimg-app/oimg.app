// Core domain types for oimg.app Phase 1
// Phase 2+ will extend these with codec-specific payload types

export type ThemeMode = 'dark' | 'light'

export type FormatId = 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'

export type FileStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

export type SourceDensity = '1x' | '2x' | '3x'

export interface FormatDefinition {
  id: FormatId
  label: string
  mime: string
  ext: string
}

export interface FileEntry {
  id: string
  name: string
  format: FormatId
  originalSize: number
  optimizedSize: number | null
  status: FileStatus
  sourceDensity: SourceDensity
  thumbnail: string | null // Object URL — must be revoked when no longer needed (see threat T-03-02)
}

export interface CodecSettingsSvg {
  preset: 'default'
  plugins: Record<string, boolean> // SVGO plugin enable/disable map
}

export interface CodecSettingsPng {
  level: number // OxiPNG: 0–6
}

export interface CodecSettingsJpeg {
  quality: number // 0–100
  progressive: boolean
}

export interface CodecSettingsWebp {
  quality: number // 0–100
  lossless: boolean
  method: number // 0–6
}

export interface CodecSettingsAvif {
  quality: number // 0–100
  lossless: boolean
}

export type CodecSettings =
  | CodecSettingsSvg
  | CodecSettingsPng
  | CodecSettingsJpeg
  | CodecSettingsWebp
  | CodecSettingsAvif

export interface GlobalSettings {
  stripMetadata: boolean
  preserveIccProfile: boolean
}
