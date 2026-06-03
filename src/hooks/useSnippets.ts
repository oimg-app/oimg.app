// Phase 12 — Plan 04 (D-09/D-10/D-11/D-12): useSnippets — Toolbar bulk + FileRow
// per-row snippet/manifest/data-URI copy orchestrator. Every clipboard write funnels
// through copyToClipboard (D-15 single chokepoint contract).
// Source: 12-CONTEXT.md D-09..D-13; 12-PATTERNS.md "useSnippets.ts (new)".
// Analog: src/hooks/useExport.ts (same shape — useStore(filesAtom) for reactive
// re-render driver, filesAtom.get() read INSIDE each async method body to avoid
// stale-closure capture per useOptimize/useExport discipline).
//
// Bulk methods filter `entries.filter(e => e.status === 'done' && e.encodedBuffer != null)`
// as defense-in-depth (T-12-CONF) — the Toolbar disabled gate (D-08) is the primary
// guard; this filter ensures even a DevTools re-enabled click cannot ship empty bytes.
// `copyManifestJson` does NOT require encodedBuffer (the manifest does not read bytes).
//
// CRITICAL: this hook does NOT import the sonner toast surface, nor the runtime-store
// toast emitter — every success/failure toast is owned by copyToClipboard (D-14,
// D-15). T-12-DOUBLE (do not double-toast on own failure path) is mitigated by simply
// not calling the toast surface here.
import { useStore } from '@nanostores/react'
import { filesAtom } from '@/stores/files'
import type { FileEntry } from '@/stores/files'
import { copyToClipboard } from '@/lib/clipboard'
import { buildPictureSnippet, buildDataUri } from '@/lib/snippets'
import { renameExtension } from '@/lib/filename'

export function useSnippets() {
  // Reactive subscription kept so $hasDone-aware consumers re-render when entries
  // mutate. The async methods below MUST re-read filesAtom.get() inside their
  // bodies (stale-closure trap — useExport.ts:42-44 precedent).
  useStore(filesAtom)

  async function copyPictureBulk(): Promise<void> {
    const { entries } = filesAtom.get()
    const done = entries.filter((e) => e.status === 'done' && e.encodedBuffer != null)
    if (done.length === 0) return // D-08 belt-and-suspenders guard
    const text = done.map((f) => buildPictureSnippet(f)).join('\n\n') // D-09 blank-line separator
    await copyToClipboard(text, 'snippet', `<picture> for ${done.length} files`)
  }

  async function copyDataUrisBulk(): Promise<void> {
    const { entries } = filesAtom.get()
    const done = entries.filter((e) => e.status === 'done' && e.encodedBuffer != null)
    if (done.length === 0) return
    const uris = await Promise.all(done.map((f) => buildDataUri(f)))
    const text = uris.join('\n') // D-10 one URI per line, ready for <img src> paste
    await copyToClipboard(text, 'data-uri', `Data URIs for ${done.length} files`)
  }

  async function copyManifestJson(): Promise<void> {
    const { entries } = filesAtom.get()
    // D-11: manifest does not read encodedBuffer; status==='done' is the only filter.
    const done = entries.filter((e) => e.status === 'done')
    if (done.length === 0) return
    const manifest = done.map((f) => ({
      filename: renameExtension(f.name, f.target), // Phase 11 helper — matches ZIP name
      target: f.target,
      originalSize: f.orig,
      optimizedSize: f.opt,
      quality: f.q ?? null,
    }))
    const text = JSON.stringify(manifest, null, 2) // D-11 pretty-printed
    await copyToClipboard(text, 'manifest', `Manifest for ${done.length} files`)
  }

  // D-12: per-file variants consumed by Plan 05's FileRow ContextMenu siblings.
  // Defense-in-depth guards even though the ContextMenuItem disabled prop gates the click.
  async function copyPictureOne(file: FileEntry): Promise<void> {
    // Read filesAtom.get() to satisfy the stale-closure discipline (the file arg may be
    // a snapshot from a render before the latest encodedBuffer push); prefer the live
    // entry when present, fall back to the argument.
    const { entries } = filesAtom.get()
    const live = entries.find((e) => e.id === file.id) ?? file
    if (live.status !== 'done' || !live.encodedBuffer) return
    const text = buildPictureSnippet(live)
    await copyToClipboard(text, 'snippet', `<picture> for ${live.name}`)
  }

  async function copyDataUriOne(file: FileEntry): Promise<void> {
    const { entries } = filesAtom.get()
    const live = entries.find((e) => e.id === file.id) ?? file
    if (live.status !== 'done' || !live.encodedBuffer) return
    const text = await buildDataUri(live)
    await copyToClipboard(text, 'data-uri', `Data URI for ${live.name}`)
  }

  return { copyPictureBulk, copyDataUrisBulk, copyManifestJson, copyPictureOne, copyDataUriOne }
}
