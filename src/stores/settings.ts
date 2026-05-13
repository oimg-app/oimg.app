// Phase 2 — Settings store (codec configs + global settings + preset stub).
// Source: 02-CONTEXT.md D-07; 02-PATTERNS.md lines 206-242.
// Persistent in spirit (Phase 7 wires IndexedDB).
// Migrated from zustand to nanostores.

import { map } from 'nanostores'
import { toast } from 'sonner'
import type {
  CodecSettingsSvg,
  CodecSettingsPng,
  CodecSettingsJpeg,
  CodecSettingsWebp,
  CodecSettingsAvif,
  GlobalSettings,
  ResizeAlg,
  CodecLabel,
} from '@/types'
import {
  DEFAULT_CODEC_SVG,
  DEFAULT_CODEC_PNG,
  DEFAULT_CODEC_JPEG,
  DEFAULT_CODEC_WEBP,
  DEFAULT_CODEC_AVIF,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_RESIZE_SETTINGS,
} from '@/data/defaults'

export type View = 'Batch' | 'Compare' | 'Report'

// Phase 10 plan 10-01 — store-local codec slice.
interface CodecSlice {
  label: CodecLabel
  quality: number
  method: number
  lossless: boolean
}

export interface SettingsData {
  commandPaletteOpen: boolean
  views: View[]
  view: View
  svg: CodecSettingsSvg
  png: CodecSettingsPng
  jpeg: CodecSettingsJpeg
  webp: CodecSettingsWebp
  avif: CodecSettingsAvif
  global: GlobalSettings
  snippetTogglesByFileId: Record<string, Record<string, boolean>>
  resize: { alg: ResizeAlg }
  codec: CodecSlice
  perFile: Record<string, Partial<CodecSettingsPng | CodecSettingsJpeg | CodecSettingsWebp | CodecSettingsAvif>>
}

export const settingsStore = map<SettingsData>({
  commandPaletteOpen: false,
  views: ['Batch', 'Compare', 'Report'] as View[],
  view: 'Batch',
  svg: DEFAULT_CODEC_SVG,
  png: DEFAULT_CODEC_PNG,
  jpeg: DEFAULT_CODEC_JPEG,
  webp: DEFAULT_CODEC_WEBP,
  avif: DEFAULT_CODEC_AVIF,
  global: DEFAULT_GLOBAL_SETTINGS,
  snippetTogglesByFileId: {},
  resize: DEFAULT_RESIZE_SETTINGS,
  codec: { label: 'WebP', quality: 82, method: 4, lossless: false },
  perFile: {},
})

// ─── Actions ─────────────────────────────────────────────────────────────────

export function setView(view: View) {
  settingsStore.setKey('view', view)
}

export function setCommandPaletteOpen(open: boolean) {
  settingsStore.setKey('commandPaletteOpen', open)
}

export function setSvg(next: Partial<CodecSettingsSvg>) {
  settingsStore.setKey('svg', { ...settingsStore.get().svg, ...next })
}

export function setPng(next: Partial<CodecSettingsPng>) {
  settingsStore.setKey('png', { ...settingsStore.get().png, ...next })
}

export function setJpeg(next: Partial<CodecSettingsJpeg>) {
  settingsStore.setKey('jpeg', { ...settingsStore.get().jpeg, ...next })
}

export function setWebp(next: Partial<CodecSettingsWebp>) {
  settingsStore.setKey('webp', { ...settingsStore.get().webp, ...next })
}

export function setAvif(next: Partial<CodecSettingsAvif>) {
  settingsStore.setKey('avif', { ...settingsStore.get().avif, ...next })
}

export function setGlobal(next: Partial<GlobalSettings>) {
  settingsStore.setKey('global', { ...settingsStore.get().global, ...next })
}

export function setSnippetToggle(fileId: string, snippetId: string, value: boolean) {
  const s = settingsStore.get()
  settingsStore.setKey('snippetTogglesByFileId', {
    ...s.snippetTogglesByFileId,
    [fileId]: {
      ...s.snippetTogglesByFileId[fileId],
      [snippetId]: value,
    },
  })
}

export function setResize(next: Partial<{ alg: ResizeAlg }>) {
  settingsStore.setKey('resize', { ...settingsStore.get().resize, ...next })
}

export function setCodec(patch: Partial<CodecSlice>) {
  toast.info(`Output set to ${patch.label}`)
  settingsStore.setKey('codec', { ...settingsStore.get().codec, ...patch })
}

export function setPerFileCodec(
  fileId: string,
  patch: Partial<CodecSettingsPng | CodecSettingsJpeg | CodecSettingsWebp | CodecSettingsAvif>,
) {
  const s = settingsStore.get()
  settingsStore.setKey('perFile', {
    ...s.perFile,
    [fileId]: { ...s.perFile[fileId], ...patch },
  })
}

export function clearPerFile(fileId: string) {
  const s = settingsStore.get()
  const next = { ...s.perFile }
  delete next[fileId]
  settingsStore.setKey('perFile', next)
}
