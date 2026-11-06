// change:deepen-svg-raster — one derivation of "what gets saved" for single, bulk and ZIP export.
// The extension comes from the codec that actually produced the bytes (encodedCodec), so an
// SVG re-encoded to PNG ships as .png with the worker's bytes — no second rasterize at export.
import type { FileEntry } from '@/lib/settings'
import { extForCodec } from '@/lib/formats'
import { collisionSuffix, mimeFor, renameExtension, sanitizeBaseName } from '@/lib/filename'

export interface ExportItem {
  name: string
  blob: Blob
  ext: string
  mime: string
}

/** Only successfully encoded entries are exportable (D-08 optimized only + D-12 skip errors). */
export function exportable(entries: FileEntry[]): FileEntry[] {
  return entries.filter((e) => e.status === 'done' && e.encodedBuffer != null)
}

/**
 * Exportable entries → named blobs. Names are sanitized after the extension swap
 * (T-11-01 zip-slip) and de-duplicated with `(n)` suffixes (D-10).
 */
export function exportItems(entries: FileEntry[]): ExportItem[] {
  const used = new Set<string>()
  return exportable(entries).map((e) => {
    const ext = e.encodedCodec ? extForCodec(e.encodedCodec) : e.target
    const mime = mimeFor(ext)
    const name = collisionSuffix(sanitizeBaseName(renameExtension(e.name, ext)), used)
    used.add(name)
    return { name, blob: new Blob([e.encodedBuffer!], { type: mime }), ext, mime }
  })
}
