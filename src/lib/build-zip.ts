// Phase 11 — buildZip — async ZIP builder. Source: 11-RESEARCH.md § Pattern 3
//
// Contract (11-05-PLAN.md):
//   - Inputs: a list of FileEntry. Only `status === 'done' && encodedBuffer != null`
//     entries are written to the ZIP (D-08 optimized only + D-12 skip errors).
//   - Each entry name passes through `sanitizeBaseName(renameExtension(...))`
//     BEFORE JSZip.file(name, …) — T-11-01 zip-slip mitigation contract.
//   - Collisions resolved via `collisionSuffix` against a running Set (D-10).
//   - Flat layout — no folder prefix (D-09).
//   - generateAsync uses `streamFiles: true` (Pitfall 6 — required to avoid OOM
//     on large batches per jszip issue #446) and DEFLATE level 1 (codec outputs
//     are already compressed; higher levels waste CPU for no size win).
//   - Empty filtered input throws `Error('NO_EXPORTABLE_FILES')` — defense-in-depth
//     vs Toolbar D-13 disable (Plan 07). The caller (useExport.exportZip) catches
//     and surfaces the user-facing toast; never ship a valid 22-byte empty ZIP.
import JSZip from 'jszip'
import type { FileEntry } from '@/stores/files'
import { collisionSuffix, renameExtension, sanitizeBaseName } from '@/lib/filename'

export async function buildZip(entries: FileEntry[]): Promise<Blob> {
  const exportable = entries.filter(
    (e) => e.status === 'done' && e.encodedBuffer != null,
  )
  if (exportable.length === 0) {
    throw new Error('NO_EXPORTABLE_FILES')
  }

  const zip = new JSZip()
  const used = new Set<string>()

  for (const e of exportable) {
    // T-11-01: sanitize AFTER extension swap (D-05) and BEFORE JSZip.file —
    // any `../`, `/`, `\`, or NUL in `e.name` gets neutralized to `_`.
    const candidate = sanitizeBaseName(renameExtension(e.name, e.target))
    // D-10: collisionSuffix is PURE — caller must add the final name to `used`.
    const final = collisionSuffix(candidate, used)
    used.add(final)
    // D-09: flat layout — `final` carries no folder prefix.
    zip.file(final, e.encodedBuffer!)
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    streamFiles: true,
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  })
  return blob
}
