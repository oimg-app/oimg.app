// Phase 2 — Settings store (codec configs + global settings + preset stub).
// Source: 02-CONTEXT.md D-07; 02-PATTERNS.md lines 206-242.
// Persistent in spirit (Phase 7 wires IndexedDB).
//
// Phase 3 plan 03-B — added snippetTogglesByFileId (D-13: per-file
// per-snippet enable/disable). The Plan A `setSvg` action already accepts
// partial CodecSettingsSvg so it covers `unsafeExport` + `pluginSavings`
// updates without further changes here.

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
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

// Phase 10 plan 10-01 — store-local codec slice. Phase 5 raster encoders
// read useSettingsStore.getState().codec to avoid prop-drilling.
interface CodecSlice {
  label: CodecLabel   // default: 'WebP'
  quality: number     // default: 82
  method: number      // default: 4
  lossless: boolean   // default: false
}

interface SettingsState {
  svg: CodecSettingsSvg
  png: CodecSettingsPng
  jpeg: CodecSettingsJpeg
  webp: CodecSettingsWebp
  avif: CodecSettingsAvif
  global: GlobalSettings
  // Phase 3 (D-13) — per-file per-snippet enable/disable. Plan C reads this
  // in SnippetPanel; Plan B introduces the slot so the store contract is
  // stable when snippet rendering lands.
  snippetTogglesByFileId: Record<string, Record<string, boolean>>
  // Phase 4 D-05 + D-06 — global resize algorithm (TweaksPanel "Resize /
  // Variants" section). Per-file override lives on FileEntry.resizeOverride
  // (Plan 04-01 added field; UI deferred to Phase 5 detail view per D-07).
  resize: { alg: ResizeAlg }
  // Phase 10 plan 10-01 — active codec + quality/method/lossless. Phase 5
  // raster encoders read this to know which codec to target.
  codec: CodecSlice
  // Phase 5 D-02 — per-file codec overrides keyed by FileEntry.id.
  // CRITICAL: codec panel components MUST call setPerFileCodec(fileId, patch),
  // NOT the global setSvg/setPng/setJpeg/setWebp/setAvif. Writing to global
  // slices triggers full-batch re-optimize for all files (Pitfall 4 — RESEARCH.md).
  // Resolution order: perFile[fileId] ?? globalFormatSlice.
  perFile: Record<string, Partial<CodecSettingsPng | CodecSettingsJpeg | CodecSettingsWebp | CodecSettingsAvif>>
  setPerFileCodec: (fileId: string, patch: Partial<CodecSettingsPng | CodecSettingsJpeg | CodecSettingsWebp | CodecSettingsAvif>) => void
  clearPerFile: (fileId: string) => void

  setSvg: (next: Partial<CodecSettingsSvg>) => void
  setPng: (next: Partial<CodecSettingsPng>) => void
  setJpeg: (next: Partial<CodecSettingsJpeg>) => void
  setWebp: (next: Partial<CodecSettingsWebp>) => void
  setAvif: (next: Partial<CodecSettingsAvif>) => void
  setGlobal: (next: Partial<GlobalSettings>) => void
  setSnippetToggle: (fileId: string, snippetId: string, value: boolean) => void
  setResize: (next: Partial<{ alg: ResizeAlg }>) => void
  setCodec: (patch: Partial<CodecSlice>) => void
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector((set) => ({
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

    setSvg: (next) => set((s) => ({ svg: { ...s.svg, ...next } })),
    setPng: (next) => set((s) => ({ png: { ...s.png, ...next } })),
    setJpeg: (next) => set((s) => ({ jpeg: { ...s.jpeg, ...next } })),
    setWebp: (next) => set((s) => ({ webp: { ...s.webp, ...next } })),
    setAvif: (next) => set((s) => ({ avif: { ...s.avif, ...next } })),
    setGlobal: (next) => set((s) => ({ global: { ...s.global, ...next } })),
    setSnippetToggle: (fileId, snippetId, value) =>
      set((s) => ({
        snippetTogglesByFileId: {
          ...s.snippetTogglesByFileId,
          [fileId]: {
            ...s.snippetTogglesByFileId[fileId],
            [snippetId]: value,
          },
        },
      })),
    setResize: (next) => set((s) => ({ resize: { ...s.resize, ...next } })),
    setCodec: (patch) => set((s) => ({ codec: { ...s.codec, ...patch } })),
    setPerFileCodec: (fileId, patch) =>
      set((s) => ({
        perFile: {
          ...s.perFile,
          [fileId]: { ...s.perFile[fileId], ...patch },
        },
      })),
    clearPerFile: (fileId) =>
      set((s) => {
        const next = { ...s.perFile }
        delete next[fileId]
        return { perFile: next }
      }),
  })),
)
