// Phase 11 — buildZip — async ZIP builder. Source: 11-RESEARCH.md § Pattern 3
// change:deepen-svg-raster — takes ExportItems (already filtered, named, de-duplicated by
// lib/export-items.ts); this module only knows how to pack them.
//
//   - Flat layout — no folder prefix (D-09).
//   - generateAsync uses `streamFiles: true` (Pitfall 6 — required to avoid OOM on large
//     batches per jszip issue #446) and DEFLATE level 1 (codec outputs are already
//     compressed; higher levels waste CPU for no size win).
//   - Empty input throws `Error('NO_EXPORTABLE_FILES')` — never ship a valid 22-byte empty ZIP.
import JSZip from 'jszip'
import type { ExportItem } from '@/lib/export-items'

export async function buildZip(items: ExportItem[]): Promise<Blob> {
  if (items.length === 0) throw new Error('NO_EXPORTABLE_FILES')
  const zip = new JSZip()
  for (const { name, blob } of items) zip.file(name, blob)
  return zip.generateAsync({
    type: 'blob',
    streamFiles: true,
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  })
}
