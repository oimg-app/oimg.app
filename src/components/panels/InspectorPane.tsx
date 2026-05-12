// Phase 5 plan 05-04 — InspectorPane restructured to Codec | Snippets tabs.
// D-01: Codec tab is format-aware (png/jpeg/webp/avif/svg → correct panel).
// D-02: All panel onChange handlers write ONLY to perFile slice via setPerFileCodec.
// D-03: Exactly two tabs — Codec and Snippets.
// D-04: Every codec setting change triggers enqueueRasterPreview with 200ms debounce.

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { SvgoPanel, PLUGIN_FOOTGUNS } from '@/components/panels/SvgoPanel'
import { SnippetPanel } from '@/components/panels/SnippetPanel'
import { TweaksResizeSection, TweaksPrivacySection } from '@/components/panels/TweaksPanel'
import { PngPanel } from '@/components/panels/PngPanel'
import { JpegPanel } from '@/components/panels/JpegPanel'
import { WebpPanel } from '@/components/panels/WebpPanel'
import { AvifPanel } from '@/components/panels/AvifPanel'
import { useShallow } from 'zustand/react/shallow'
import { useFilesStore, useSettingsStore } from '@/stores'
import { enqueueRasterPreview } from '@/hooks/useBatchOrchestrate'
import type { CodecSettingsPng, CodecSettingsJpeg, CodecSettingsWebp, CodecSettingsAvif } from '@/types'

// D-03: Exactly two tabs.
type Tab = 'codec' | 'snippets'

interface InspectorPaneProps {
  open: string | null
  setOpen: (v: string | null) => void
  onToast: (msg: string, meta?: string) => void
}

export function InspectorPane({ open, setOpen, onToast }: InspectorPaneProps) {
  const [tab, setTab] = useState<Tab>('codec')

  // Read selectedEntry and format from store — no prop-drilling needed.
  const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)
  const selectedId = useFilesStore((s) => s.selectedId)
  const format = selectedEntry?.format

  // Per-file overrides + global codec slices.
  const perFileOverride = useSettingsStore(
    useShallow((s) => selectedId ? (s.perFile[selectedId] ?? {}) : {})
  )
  const globalPng = useSettingsStore((s) => s.png)
  const globalJpeg = useSettingsStore((s) => s.jpeg)
  const globalWebp = useSettingsStore((s) => s.webp)
  const globalAvif = useSettingsStore((s) => s.avif)
  const setPerFileCodec = useSettingsStore((s) => s.setPerFileCodec)

  // Resolved settings: global merged with perFile override.
  const resolvedPng = useMemo(
    (): CodecSettingsPng => ({ ...globalPng, ...perFileOverride }) as CodecSettingsPng,
    [globalPng, perFileOverride],
  )
  const resolvedJpeg = useMemo(
    (): CodecSettingsJpeg => ({ ...globalJpeg, ...perFileOverride }) as CodecSettingsJpeg,
    [globalJpeg, perFileOverride],
  )
  const resolvedWebp = useMemo(
    (): CodecSettingsWebp => ({ ...globalWebp, ...perFileOverride }) as CodecSettingsWebp,
    [globalWebp, perFileOverride],
  )
  const resolvedAvif = useMemo(
    (): CodecSettingsAvif => ({ ...globalAvif, ...perFileOverride }) as CodecSettingsAvif,
    [globalAvif, perFileOverride],
  )

  // SVG settings (SvgoPanel unchanged from Phase 3).
  const svgSettings = useSettingsStore((s) => s.svg)
  const setSvg = useSettingsStore((s) => s.setSvg)
  const togglePlugin = (id: string) => {
    const cur = useSettingsStore.getState().svg.plugins
    if (!(id in cur)) return
    setSvg({ plugins: { ...cur, [id]: !cur[id] } })
  }
  const setUnsafeExport = (v: boolean) => setSvg({ unsafeExport: v })
  const svgoPluginRows = useMemo(
    () =>
      Object.entries(svgSettings.plugins).map(([id, on]) => ({
        id,
        on,
        savings: svgSettings.pluginSavings?.[id] ?? null,
        footgun: PLUGIN_FOOTGUNS[id],
      })),
    [svgSettings.plugins, svgSettings.pluginSavings],
  )

  // setPreserveIcc from files store — added in 05-04 (Rule 2: missing ICC wiring).
  const setPreserveIcc = useFilesStore((s) => s.setPreserveIcc)

  // D-04: 200ms debounce wrapper for raster re-optimize.
  // Mirrors Phase 3 SVG enqueuePreview debounce (03-B D-08).
  // T-5-04-05 mitigation: rapid slider drag fires only one encode on settle.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedPreview = useCallback((fileId: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      enqueueRasterPreview(fileId)
    }, 200)
  }, [])

  // Auto-switch to Codec tab when a new file is selected (D-01).
  // If user is already on Snippets, keep it there — they may be reviewing output.
  useEffect(() => {
    if (selectedId) setTab('codec')
  }, [selectedId])

  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)

  // CodecTabContent — format discriminant switch inside InspectorPane.
  // T-5-04-02 mitigation: unknown format returns null (no error, no panel).
  function CodecTabContent() {
    if (!format || !selectedId) {
      return (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', padding: '16px 12px' }}>
          Select a file to see codec settings.
        </p>
      )
    }
    if (format === 'svg') {
      return (
        <SvgoPanel
          plugins={svgoPluginRows}
          togglePlugin={togglePlugin}
          unsafeExport={svgSettings.unsafeExport ?? false}
          setUnsafeExport={setUnsafeExport}
        />
      )
    }
    if (format === 'png') {
      return (
        <PngPanel
          settings={resolvedPng}
          preserveIcc={selectedEntry?.preserveIcc ?? false}
          onChange={(patch) => {
            setPerFileCodec(selectedId, patch)
            debouncedPreview(selectedId)
          }}
          onPreserveIccChange={(v) => setPreserveIcc(selectedId, v)}
        />
      )
    }
    if (format === 'jpeg') {
      return (
        <JpegPanel
          settings={resolvedJpeg}
          onChange={(patch) => {
            setPerFileCodec(selectedId, patch)
            debouncedPreview(selectedId)
          }}
        />
      )
    }
    if (format === 'webp') {
      return (
        <WebpPanel
          settings={resolvedWebp}
          onChange={(patch) => {
            setPerFileCodec(selectedId, patch)
            debouncedPreview(selectedId)
          }}
        />
      )
    }
    if (format === 'avif') {
      return (
        <AvifPanel
          settings={resolvedAvif}
          onChange={(patch) => {
            setPerFileCodec(selectedId, patch)
            debouncedPreview(selectedId)
          }}
        />
      )
    }
    // T-5-04-02: unknown format — no panel, no error.
    return null
  }

  return (
    <div className="pane insp">
      <div className="pane-hd">
        <span>Inspector</span>
        <div className="actions" style={{ position: 'relative' }}>
          <button
            className={'iconbtn' + (isPopOpen('insp') ? ' on' : '')}
            onClick={() => togglePop('insp')}
          >
            <Icons.More size={12} />
          </button>
          <Popover open={isPopOpen('insp')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 220 }}>
            <div
              className="pi"
              onClick={() => { setOpen(null); onToast('Settings copied to all files') }}
            >
              <Icons.Layers size={13} /><span>Apply to all files</span>
            </div>
            <div
              className="pi"
              onClick={() => { setOpen(null); onToast('Saved as preset', '"WebP q82 1600w"') }}
            >
              <Icons.Plus size={13} /><span>Save as preset…</span>
            </div>
            <div className="div" /><div className="lbl">Presets</div>
            <div className="pi check on"><span>Web · WebP q82</span></div>
            <div className="pi check"><span>Email · JPEG q70 800w</span></div>
            <div className="pi check"><span>Print · PNG lossless</span></div>
          </Popover>
        </div>
      </div>

      {/* D-03: Exactly two tabs — Codec and Snippets */}
      <div className="tabs" role="tablist" aria-label="Inspector">
        <button
          role="tab"
          aria-selected={tab === 'codec'}
          aria-controls="inspector-panel"
          id="inspector-tab-codec"
          className={tab === 'codec' ? 'on' : ''}
          onClick={() => setTab('codec')}
        >
          Codec
        </button>
        <button
          role="tab"
          aria-selected={tab === 'snippets'}
          aria-controls="inspector-panel"
          id="inspector-tab-snippets"
          className={tab === 'snippets' ? 'on' : ''}
          onClick={() => setTab('snippets')}
        >
          Snippets
        </button>
      </div>

      <div
        className="pane-body"
        role="tabpanel"
        id="inspector-panel"
        aria-labelledby={`inspector-tab-${tab}`}
      >
        {tab === 'codec' && (
          <>
            <CodecTabContent />
            {/* D-12: Density checkboxes (export-scope only — no re-optimize).
                TargetDensityCheckboxes reads selected entry from store.
                setTargetDensities referenced here to satisfy lint but wired
                in TargetDensityCheckboxes internally; Phase 7 handles export. */}
            <TweaksResizeSection />
            <TweaksPrivacySection />
          </>
        )}
        {tab === 'snippets' && <SnippetPanel file={selectedEntry ?? null} />}
      </div>
    </div>
  )
}
