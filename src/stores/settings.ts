// Phase 04 — STORE-02: settingsAtom. Source: 04-01-PLAN.md
// change:deepen-settings-edit — the global defaults ARE a FileSettings (same shape per-file
// entries carry), and every settings edit in the app goes through one action: editSetting().
import { map } from 'nanostores'
import { filesAtom, setFileSettings } from '@/stores/files'
// Use relative path so Node --experimental-strip-types can resolve the value import
import type { FileSettings } from '../lib/settings'
import { defaultFileSettings, initFileSettings } from '../lib/settings'
import { extForCodec } from '../lib/formats'

// Re-export via @/ alias for Vite/TypeScript builds (STORE-08: components import from stores)
export type { Codec, SvgoPlugin, FileSettings } from '../lib/settings'
export { CODECS, RESIZE_ALGS, FIT_MODES } from '../lib/constants'

/** Global defaults — seeded onto every new entry and pushed onto all entries by applyToAll(). */
export const settingsAtom = map<FileSettings>(defaultFileSettings('webp', 82))

/**
 * The one settings writer. With a fileId: edit that entry's own settings and schedule a
 * debounced live re-encode. Without: edit the global defaults.
 */
export function editSetting<K extends keyof FileSettings>(
  fileId: string | null,
  key: K,
  value: FileSettings[K],
): void {
  if (fileId === null) {
    settingsAtom.setKey(key, value)
    return
  }
  setFileSettings(fileId, key, value)
  // Lazy import keeps the worker pool / rasterizer out of this store's module graph (and out of
  // the Node unit runner).
  void import('@/lib/live-encode').then((m) => m.triggerLiveEncode(fileId))
}

// Phase 09 — Plan 01: D-02 "Apply to all" — push global defaults onto every FileEntry.settings.
// Each entry gets its own deep copy (initFileSettings) so plugin toggles never alias across
// entries, and `target` follows the new codec like a per-file codec edit would.
export async function applyToAll(): Promise<void> {
  const defaults = settingsAtom.get()
  filesAtom.setKey('entries', filesAtom.get().entries.map((e) => ({
    ...e,
    settings: initFileSettings(defaults),
    target: extForCodec(defaults.codec),
  })))
}
