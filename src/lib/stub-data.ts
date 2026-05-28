// STORE-08: this module must NOT be imported by components. Only stores (Phase 2+) and tests may import it.
// Phase 01, Plan 04 — STORE-05 + ICON-01

// --- Type exports ---

export type FileStatus = 'done' | 'processing' | 'queued' | 'error'
export type Codec = 'SVG' | 'PNG' | 'WebP' | 'JPEG' | 'AVIF'
export type SortKey = 'queue order' | 'file size' | 'savings %' | 'name' | 'format'

export interface FileEntry {
  id: string
  name: string
  type: string
  orig: number
  opt: number
  status: FileStatus
  target: string
  dim: string
  q: number | null
  prog?: number
  settings?: FileSettings      // per-file settings (D-01) — optional until initialized
  rawBuffer?: ArrayBuffer      // original file bytes; cache for live re-encode (D-05)
  encodedBuffer?: ArrayBuffer  // result of last encode
  error?: string               // per-file error message (D-13)
}

export interface SvgoPlugin {
  id: string
  on: boolean
  saves: string
}

// SVGO plugin defaults — declared here (before defaultFileSettings/STUB_FILES) so module-eval-time
// seeding of per-file settings can reference it without hitting the const temporal-dead-zone (CR-01).
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

// Phase 09, Plan 01 — D-01/D-03: per-file settings shape (mirrors SettingsState in settings.ts)
export interface FileSettings {
  codec: Codec
  q: number
  method: number
  lossless: boolean
  resizeOn: boolean
  w: string
  h: string
  alg: string
  fit: string
  stripMeta: boolean
  keepIcc: boolean
  aggressive: boolean
  plugins: SvgoPlugin[]
  progressive?: boolean  // JPEG only — default true (Pitfall 6)
}

// D-01: shallow-copy helper — call when adding entries to assign per-file defaults without aliasing.
// `plugins` is deep-copied (map + spread) so per-file plugin toggles never alias the shared
// SVGO_PLUGINS array or another entry's plugin objects (CR-01 fold-in).
export function initFileSettings(defaults: FileSettings): FileSettings {
  return { ...defaults, plugins: defaults.plugins.map((p) => ({ ...p })) }
}

// Map a raw FileEntry.type (lowercase, e.g. 'png'/'jpg'/'svg') to its natural output Codec.
// Used to seed per-file defaults so a freshly-seeded entry encodes to a sane target before
// the user touches the inspector (CR-01).
function codecForType(type: string): Codec {
  switch (type.toLowerCase()) {
    case 'svg':
      return 'SVG'
    case 'png':
      return 'PNG'
    case 'jpg':
    case 'jpeg':
      return 'JPEG'
    case 'webp':
      return 'WebP'
    case 'avif':
      return 'AVIF'
    default:
      return 'WebP'
  }
}

// CR-01: build a complete, self-contained FileSettings for a seeded/uploaded entry. Without this,
// entries had no `settings` field and the first inspector edit spread `undefined` — collapsing the
// whole settings object down to the single edited key (data loss + broken encodes). codec derives
// from the entry's own type; q from the entry's own q (falling back to the WebP-ish default 82).
export function defaultFileSettings(type: string, q: number | null): FileSettings {
  return {
    codec: codecForType(type),
    q: q ?? 82,
    method: 4,
    lossless: false,
    resizeOn: false,
    w: '1600',
    h: 'auto',
    alg: 'lanczos3',
    fit: 'contain',
    stripMeta: true,
    keepIcc: false,
    aggressive: false,
    plugins: SVGO_PLUGINS.map((p) => ({ ...p })),
    progressive: true,
  }
}

// --- Sample bytes (tiny valid 1×1 images) so the seeded demo files actually optimize ---
// Phase 09 regression fix: the real-bytes useOptimize (Plan 03) refuses 0-byte buffers
// (WR-02 / T-9-V5), so byte-less seed entries made "Optimize all" a no-op. Each is a valid
// 1×1 image verified to decode through its jSquash codec (atob-safe at module load — the
// JPEG differs from the test fixture, whose JPEG base64 is intentionally atob-incompatible).
// Source types in STUB_FILES are png/jpg/svg/webp only (no avif source).
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const TINY_JPEG_B64 =
  '/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
const TINY_WEBP_B64 = 'UklGRiYAAABXRUJQVlA4IBoAAADQAQCdASoBAAEAAUAmJbACdAEO/g3OAAAA'
const TINY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>'

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

// Fresh ArrayBuffer per call so per-entry buffers never alias (each entry owns its bytes).
function sampleBytesFor(type: string): ArrayBuffer {
  switch (type.toLowerCase()) {
    case 'png':
      return b64ToArrayBuffer(TINY_PNG_B64)
    case 'jpg':
    case 'jpeg':
      return b64ToArrayBuffer(TINY_JPEG_B64)
    case 'webp':
      return b64ToArrayBuffer(TINY_WEBP_B64)
    case 'svg':
      return new TextEncoder().encode(TINY_SVG).buffer as ArrayBuffer
    default:
      return new ArrayBuffer(0)
  }
}

// --- Data exports (verbatim from example-ui/data.jsx) ---

const STUB_FILES_SEED: FileEntry[] = [
  { id: 'f1', name: 'hero-banner@2x.png', type: 'png', orig: 1842300, opt: 412800, status: 'done', target: 'webp', dim: '2400×1600', q: 82 },
  { id: 'f2', name: 'product-shot-01.jpg', type: 'jpg', orig: 956400, opt: 198200, status: 'done', target: 'avif', dim: '1920×1280', q: 60 },
  { id: 'f3', name: 'icon-set.svg', type: 'svg', orig: 28640, opt: 9120, status: 'done', target: 'svg', dim: '512×512', q: null },
  { id: 'f4', name: 'avatar-grid.png', type: 'png', orig: 524800, opt: 142100, status: 'done', target: 'webp', dim: '800×800', q: 80 },
  { id: 'f5', name: 'screenshot-dashboard.png', type: 'png', orig: 2104500, opt: 487600, status: 'processing', target: 'avif', dim: '2880×1800', q: 55, prog: 0.62 },
  { id: 'f6', name: 'logomark-mono.svg', type: 'svg', orig: 4820, opt: 1240, status: 'done', target: 'svg', dim: '64×64', q: null },
  { id: 'f7', name: 'background-texture.jpg', type: 'jpg', orig: 1456800, opt: 384200, status: 'done', target: 'webp', dim: '3840×2160', q: 75 },
  { id: 'f8', name: 'team-photo.jpg', type: 'jpg', orig: 3204800, opt: 642300, status: 'done', target: 'avif', dim: '4032×3024', q: 65 },
  { id: 'f9', name: 'brand-illustration.svg', type: 'svg', orig: 142800, opt: 38400, status: 'done', target: 'svg', dim: '1200×800', q: null },
  { id: 'f10', name: 'menu-card.webp', type: 'webp', orig: 384200, opt: 142800, status: 'queued', target: 'avif', dim: '1600×1200', q: 70 },
  { id: 'f11', name: 'feature-callout.png', type: 'png', orig: 218400, opt: 84200, status: 'done', target: 'webp', dim: '600×400', q: 80 },
  { id: 'f12', name: 'og-card-twitter.jpg', type: 'jpg', orig: 184600, opt: 62400, status: 'queued', target: 'webp', dim: '1200×630', q: 78 },
]

// Seed each entry with real (tiny, valid) bytes so "Optimize all" dispatches real jobs on
// first load (see sampleBytesFor above). Real uploads supply their own bytes via File handles.
// CR-01: also seed a complete per-file `settings` object so the first inspector edit mutates a
// real object instead of spreading `undefined` (which collapsed settings to a single key).
export const STUB_FILES: FileEntry[] = STUB_FILES_SEED.map((e) => ({
  ...e,
  rawBuffer: sampleBytesFor(e.type),
  settings: defaultFileSettings(e.type, e.q),
}))

// --- Constant exports ---

export const CODECS = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF'] as const
export const RESIZE_ALGS = ['lanczos3', 'mitchell', 'catrom', 'triangle'] as const
export const FIT_MODES = ['cover', 'contain', 'fill'] as const

/**
 * ICON-01: lucide→phosphor name map. Phase 2+ components import phosphor icons by these names
 * directly (no wrapper); this map is the canonical reference. Components must NOT import this
 * module directly (STORE-08) — it lives here so requirement coverage is centralized.
 */
export const ICON_MAP = {
  Play: 'PlayCircle',
  Pause: 'PauseCircle',
  Upload: 'UploadSimple',
  Download: 'DownloadSimple',
  Layers: 'Stack',
  Filter: 'Funnel',
  More: 'DotsThreeVertical',
  Zap: 'Lightning',
  BarChart: 'ChartBar',
  Grid: 'SquaresFour',
  Lock: 'LockSimple',
  Eye: 'Eye',
  File: 'File',
  Image: 'Image',
  Code: 'Code',
  Check: 'Check',
  X: 'X',
  ChevronRight: 'CaretRight',
  ChevronDown: 'CaretDown',
  Trash: 'Trash',
  Search: 'MagnifyingGlass',
  Settings: 'GearSix',
  Copy: 'Copy',
  Sun: 'Sun',
  Moon: 'Moon',
  Plus: 'Plus',
} as const
