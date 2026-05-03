// Phase 4 — Pre-decode PNG dimension sniff (24-byte read).
// Source: 04-RESEARCH.md §Code Examples (lines 668-685); RFC 2083 PNG spec.
// Used by useFilesStore.addSourceWithVariants (Plan 04-05) to seed the
// byte-estimate for the admission gate BEFORE the worker pool dispatches
// the decode job. Pure async function — no React, no jSquash, no DOM.

export async function sniffPngDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  if (blob.size < 24) return null
  const buf = await blob.slice(0, 24).arrayBuffer()
  const view = new DataView(buf)
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null
  // IHDR chunk at offset 8: 4-byte length, 4-byte type "IHDR" (0x49484452),
  // width@16, height@20.
  if (view.getUint32(12) !== 0x49484452) return null
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
