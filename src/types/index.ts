// Core domain types for oimg.app Phase 1
// Phase 2+ will extend these with codec-specific payload types

export type ThemeMode = 'dark' | 'light'

export type FormatId = 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'

export type FileStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

export type SourceDensity = '1x' | '2x' | '3x'

// UI types — moved from src/data/mock.ts in Phase 2 plan 02-05 (cleanup wave).
// `FileType` and `MockFile` describe the visual-shell row shape used by the
// inspector OutputPanel/ReportPanel during the Phase 1→2 transition. Phase 5
// raster encoders will replace MockFile with FileEntry-derived view models.
export type FileType = 'png' | 'jpg' | 'svg' | 'webp' | 'avif'
export type FileStatusMock = 'queued' | 'processing' | 'done' | 'error'

export interface MockFile {
  id: string
  name: string
  type: FileType
  orig: number
  opt: number
  status: FileStatusMock
  target: FileType
  dim: string
  q: number | null
  prog?: number
}

// Codec UI label set + resize/fit enums — moved from src/data/mock.ts in
// Phase 2 plan 02-05. Lives here because the Toolbar codec menu and CodecPanel
// segmented controls are still wired to local-state useState (full migration
// to useSettingsStore deferred to Phase 5 panel work).
export type CodecLabel = 'SVG' | 'PNG' | 'WebP' | 'JPEG' | 'AVIF'
export type ResizeAlg = 'lanczos3' | 'mitchell' | 'catrom' | 'triangle'
export type FitMode = 'cover' | 'contain' | 'fill'

// SVGO plugin row shape (visual-shell list of toggleable plugins).
// Moved from src/data/mock.ts in Phase 2 plan 02-05. Phase 3 SVG pipeline
// replaces this with a real SVGO plugin registry derived from svgo v4 config.
export interface SvgoPlugin {
  id: string
  on: boolean
  saves: string
}

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
