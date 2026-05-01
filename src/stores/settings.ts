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
} from '@/types'
import {
  DEFAULT_CODEC_SVG,
  DEFAULT_CODEC_PNG,
  DEFAULT_CODEC_JPEG,
  DEFAULT_CODEC_WEBP,
  DEFAULT_CODEC_AVIF,
  DEFAULT_GLOBAL_SETTINGS,
} from '@/data/defaults'

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

  setSvg: (next: Partial<CodecSettingsSvg>) => void
  setPng: (next: Partial<CodecSettingsPng>) => void
  setJpeg: (next: Partial<CodecSettingsJpeg>) => void
  setWebp: (next: Partial<CodecSettingsWebp>) => void
  setAvif: (next: Partial<CodecSettingsAvif>) => void
  setGlobal: (next: Partial<GlobalSettings>) => void
  setSnippetToggle: (fileId: string, snippetId: string, value: boolean) => void
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
  })),
)
