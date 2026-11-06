// change:deepen-format-registry — the one table for every ext ↔ MIME ↔ Codec ↔ source-format
// fact. Every other module (ingest gate, picker accept map, filename MIME, snippets, URL paste,
// both workers' input guards) derives from here; adding a format is one row.
import type { Codec } from '@/lib/settings'

/** Every extension the decoders accept (lowercase, no dot). `jpg` is an alias of `jpeg`. */
export type SourceFormat = 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'svg' | 'heic' | 'heif'

interface FormatSpec {
  exts: readonly SourceFormat[]
  mime: string
  /** Natural output codec. For decode-only inputs (HEIC/HEIF) this is the fallback output. */
  codec: Codec
  decodeOnly?: true
}

export const FORMATS = {
  png:  { exts: ['png'],         mime: 'image/png',     codec: 'PNG' },
  jpeg: { exts: ['jpeg', 'jpg'], mime: 'image/jpeg',    codec: 'JPEG' },
  webp: { exts: ['webp'],        mime: 'image/webp',    codec: 'WebP' },
  avif: { exts: ['avif'],        mime: 'image/avif',    codec: 'AVIF' },
  svg:  { exts: ['svg'],         mime: 'image/svg+xml', codec: 'SVG' },
  // HEIC/HEIF are input-only — never add them to the Codec union (no inspector tab).
  heic: { exts: ['heic'],        mime: 'image/heic',    codec: 'JPEG', decodeOnly: true },
  heif: { exts: ['heif'],        mime: 'image/heif',    codec: 'JPEG', decodeOnly: true },
} as const satisfies Record<string, FormatSpec>

const SPECS: readonly FormatSpec[] = Object.values(FORMATS)

export const ACCEPTED_EXTS: ReadonlySet<string> = new Set(SPECS.flatMap((s) => s.exts))
export const ACCEPTED_MIMES: ReadonlySet<string> = new Set(SPECS.map((s) => s.mime))
/** `accept=""` value for file inputs. */
export const ACCEPT_ATTR = [...[...ACCEPTED_EXTS].map((e) => `.${e}`), ...ACCEPTED_MIMES].join(',')
/** `showOpenFilePicker` accept map: MIME → [".ext", …]. */
export const PICKER_ACCEPT: Record<string, string[]> = Object.fromEntries(
  SPECS.map((s) => [s.mime, s.exts.map((e) => `.${e}`)]),
)

/** Normalize a filename, extension, or MIME to a SourceFormat; null when unsupported. */
export function sourceFormatOf(nameExtOrMime: string): SourceFormat | null {
  const v = nameExtOrMime.toLowerCase()
  if (v.includes('/')) return SPECS.find((s) => s.mime === v)?.exts[0] ?? null
  const ext = (v.includes('.') ? v.split('.').pop()! : v).replace(/^\./, '')
  return ACCEPTED_EXTS.has(ext) ? (ext as SourceFormat) : null
}

function specFor(fmt: SourceFormat): FormatSpec {
  return SPECS.find((s) => (s.exts as readonly string[]).includes(fmt))!
}

/** MIME for an accepted extension/format; null when unknown. */
export function mimeForFormat(ext: string): string | null {
  const fmt = sourceFormatOf(ext)
  return fmt ? specFor(fmt).mime : null
}

/** Natural output Codec for a source type. Unknown inputs default to WebP. */
export function codecFor(type: string): Codec {
  const fmt = sourceFormatOf(type)
  return fmt ? specFor(fmt).codec : 'WebP'
}

/** Canonical output extension for a Codec (`JPEG` → `jpeg`, `WebP` → `webp`). */
export function extForCodec(codec: Codec): string {
  return (Object.entries(FORMATS) as [string, FormatSpec][])
    .find(([, s]) => s.codec === codec && !s.decodeOnly)![0]
}
