// Phase 04 — STORE-02: settingsAtom. Source: 04-01-PLAN.md
// CIRCULAR ESM GUARD: settings.ts MUST NOT import ui.ts, files.ts, or runtime.ts
import { map } from 'nanostores'
// Use relative path so Node --experimental-strip-types can resolve the value import
import type { SvgoPlugin, Codec } from '../lib/stub-data.ts'
import { SVGO_PLUGINS } from '../lib/stub-data.ts'

// Re-export via @/ alias for Vite/TypeScript builds (STORE-08: components import from stores)
export type { Codec, SvgoPlugin } from '../lib/stub-data.ts'
export { CODECS, RESIZE_ALGS, FIT_MODES } from '../lib/stub-data.ts'

interface SettingsState {
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
}

export const settingsAtom = map<SettingsState>({
  codec: 'WebP',
  q: 82,
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
  plugins: SVGO_PLUGINS,
})

export function setCodec(c: Codec): void { settingsAtom.setKey('codec', c) }
export function setQuality(q: number): void { settingsAtom.setKey('q', q) }
export function setMethod(m: number): void { settingsAtom.setKey('method', m) }
export function setLossless(v: boolean): void { settingsAtom.setKey('lossless', v) }
export function setResizeOn(v: boolean): void { settingsAtom.setKey('resizeOn', v) }
export function setResizeDimensions(w: string, h: string): void {
  settingsAtom.set({ ...settingsAtom.get(), w, h })
}
export function setFit(f: string): void { settingsAtom.setKey('fit', f) }
export function setAlg(a: string): void { settingsAtom.setKey('alg', a) }
export function setStripMeta(v: boolean): void { settingsAtom.setKey('stripMeta', v) }
export function setKeepIcc(v: boolean): void { settingsAtom.setKey('keepIcc', v) }
export function setAggressive(v: boolean): void { settingsAtom.setKey('aggressive', v) }
export function togglePlugin(id: string): void {
  settingsAtom.setKey('plugins', settingsAtom.get().plugins.map(p =>
    p.id === id ? { ...p, on: !p.on } : p
  ))
}

// Phase 09 — Plan 01: D-02 "Apply to all" — push global defaults onto every FileEntry.settings.
// Lazy import avoids circular dep: settings.ts → files.ts (CIRCULAR ESM GUARD — see line 2).
// WR-01: returns the promise so callers can await the mutation before toasting (the lazy import is
// async, so a synchronous toast could fire before the store actually changes). The copied settings
// add `progressive: true` (SettingsState has no progressive field, so a JPEG override was being
// dropped) and deep-copy `plugins` via initFileSettings-style mapping so entries never alias the
// shared global plugin objects.
export function applyToAll(): Promise<void> {
  return import('@/stores/files').then(({ filesAtom }) => {
    const defaults = settingsAtom.get()
    filesAtom.setKey('entries', filesAtom.get().entries.map(e => ({
      ...e,
      settings: {
        ...defaults,
        progressive: true,
        plugins: defaults.plugins.map(p => ({ ...p })),
      },
    })))
  })
}
