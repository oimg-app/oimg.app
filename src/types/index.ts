// Core domain types for oimg.app Phase 1
// Phase 2+ will extend these with codec-specific payload types

export type ThemeMode = 'dark' | 'light'

export type FormatId = 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'

export type FileStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

export type SourceDensity = '1x' | '2x' | '3x'

// Phase 5 D-12 — target density selections for export-time variant generation.
// Stored as a set on each FileEntry; Phase 7 reads these to generate variants at download.
// Different from SourceDensity (which density the source IS) and
// targetDensity (Phase 4 fan-out — which density THIS specific FileEntry represents).
export type TargetDensity = '1x' | '2x' | '3x'

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
  // Phase 3 (D-03) — count of dangerous elements/attributes removed by DOMPurify.
  // undefined = file has not yet been processed; 0 = processed and clean;
  // > 0 = sanitization happened, surface a "sanitized · N" badge in the file row.
  sanitizedCount?: number
  // Phase 4 (D-04 + D-14) — variants are siblings, not children. The source
  // FileEntry id is the prefix; variant ids are `${sourceUuid}-${density}`.
  // sourceFamilyId === source's id; useful for groupBy in FilePanel render.
  sourceFamilyId?: string
  // Density THIS entry produces. Mirrors `sourceDensity` semantics but for
  // the OUTPUT slot. addSourceWithVariants populates this on each variant.
  targetDensity?: SourceDensity
  // Phase 4 (D-07) — per-file resize algorithm override (UI deferred to Phase 5).
  resizeOverride?: ResizeAlg
  // Phase 4 (D-09) — per-file ICC preserve override (data shape only; worker
  // no-op in P4 per Post-Research D-10 amendment).
  preserveIcc?: boolean
  // Phase 5 D-12 — export-scope density selectors. Checkboxes in InspectorPane
  // Codec tab record which variants the user wants in the ZIP output. NO re-optimize
  // is triggered when this changes (D-12: export-scope only, Phase 7 generates variants).
  targetDensities?: TargetDensity[]
}

export interface CodecSettingsSvg {
  preset: 'default'
  plugins: Record<string, boolean> // SVGO plugin enable/disable map
  // Phase 3 (D-04) — global toggle: when true, sanitize-svg.ts skips DOMPurify
  // and returns the SVGO output verbatim. Default = false (sanitize). Plan B
  // wires the SvgoPanel "Disable SVG sanitization on export" Toggle.
  unsafeExport?: boolean
  // Phase 3 (D-06) — live per-plugin savings, populated by Plan B's post-batch
  // N+1-pass benchmark. Keyed by plugin id; bytes = aggregate across the batch.
  pluginSavings?: Record<string, { bytes: number; pct: number }>
}

// Phase 3 (D-12) — snippet registry id union. Plan C ships 'inline-svg' and
// 'url-encoded-uri' generators; the raster ids are stubs in Phase 3 and gain
// real generators in Phase 5/6. Filter via SnippetDef.applicableFormats —
// never switch on file.format inside SnippetPanel render.
export type SnippetId = 'inline-svg' | 'url-encoded-uri' | 'picture' | 'img-srcset' | 'data-uri-base64'

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
