// Composition root — Phase 10 plan 05 slim.
// All left-pane queue JSX, pool orchestration, keyboard shortcuts, and file-picker
// helpers extracted to FilePanel, useBatchOrchestrate, useKeyboardShortcuts, useFilePicker.
// App.tsx is now the thin composition root per D-13.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { CodecPanel } from '@/components/panels/CodecPanel'
import { SvgoPanel, PLUGIN_FOOTGUNS } from '@/components/panels/SvgoPanel'
import { SnippetPanel } from '@/components/panels/SnippetPanel'
import { ReportPanel } from '@/components/panels/ReportPanel'
import { FilePanel } from '@/components/panels/FilePanel/FilePanel'
import { AppShell } from '@/components/shell/AppShell/AppShell'
import { TitleBar } from '@/components/shell/TitleBar/TitleBar'
import { Toolbar, ToolbarChange } from '@/components/shell/Toolbar/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar/StatusBar'
import { CommandPalette } from '@/components/shell/CommandPalette/CommandPalette'
import type { CmdGroup } from '@/components/shell/CommandPalette/CommandPalette'
import { useTheme } from '@/hooks/useTheme'
import { useBatchOrchestrate } from '@/hooks/useBatchOrchestrate'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { fmtBytes, fmtPct } from '@/lib/format'
import { setLiveRegion } from '@/lib/live-region'
import { CODECS } from '@/data/defaults'
import type { CodecLabel, ResizeAlg, FitMode, MockFile } from '@/types'
import { useFilesStore, useSettingsStore, useRuntimeStore } from '@/stores'
import { TweaksResizeSection, TweaksPrivacySection } from '@/components/panels/TweaksPanel'

type Tab = 'codec' | 'svgo' | 'output' | 'report'
type View = 'Batch' | 'Compare' | 'Report'

const EMPTY_FILE: MockFile = { id: 'placeholder', name: 'No file selected', type: 'png', orig: 0, opt: 0, status: 'queued', target: 'webp', dim: '— × —', q: null }
const fmtToType = (fmt: string): MockFile['type'] => fmt === 'jpeg' ? 'jpg' : (fmt as MockFile['type'])

export default function App() {
  const { theme, setTheme } = useTheme()
  const filesSelectedId = useFilesStore((s) => s.selectedId)
  const selectedId = filesSelectedId ?? ''
  const setSelectedId = (id: string) => useFilesStore.getState().setSelected(id)

  const [tab, setTab] = useState<Tab>('codec')
  const [split, setSplit] = useState<number>(50)
  const [view, setView] = useState<View>('Batch')
  const [open, setOpen] = useState<string | null>(null)
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)
  const [rowMenu, setRowMenu] = useState<string | null>(null)

  // Codec UI state — local until Phase 5 panel migrations.
  const [resizeOn, setResizeOn] = useState<boolean>(true)
  const [w, setW] = useState<string>('1600')
  const [h, setH] = useState<string>('auto')
  const [alg, setAlg] = useState<ResizeAlg>('lanczos3')
  const [fit, setFit] = useState<FitMode>('contain')
  const [stripMeta, setStripMeta] = useState<boolean>(true)
  const [keepIcc, setKeepIcc] = useState<boolean>(false)

  const { startOptimize, cancelBatch, running } = useBatchOrchestrate()
  useKeyboardShortcuts({ startOptimize, cancelBatch, cmdkOpen, setCmdkOpen, setOpen, setRowMenu })

  const codecLabel = useSettingsStore((s) => s.codec.label)
  const codecQ = useSettingsStore((s) => s.codec.quality)
  const codecMethod = useSettingsStore((s) => s.codec.method)
  const svgSettings = useSettingsStore((s) => s.svg)
  const setSvg = useSettingsStore((s) => s.setSvg)
  const togglePlugin = (id: string) => {
    const cur = useSettingsStore.getState().svg.plugins
    if (!(id in cur)) return
    setSvg({ plugins: { ...cur, [id]: !cur[id] } })
  }
  const setUnsafeExport = (v: boolean) => setSvg({ unsafeExport: v })
  const svgoPluginRows = useMemo(
    () => Object.entries(svgSettings.plugins).map(([id, on]) => ({ id, on, savings: svgSettings.pluginSavings?.[id] ?? null, footgun: PLUGIN_FOOTGUNS[id] })),
    [svgSettings.plugins, svgSettings.pluginSavings],
  )

  const pushToast = (msg: string, meta?: string) => meta ? toast(msg, { description: meta }) : toast(msg)

  // Dev-only store exposure for Playwright.
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ = { files: useFilesStore, settings: useSettingsStore, runtime: useRuntimeStore }
    }
  }, [])

  // Plugin-change subscriber — fires live preview for selected SVG file.
  useEffect(() => {
    return useSettingsStore.subscribe(
      (s) => s.svg.plugins,
      () => {
        const fs = useFilesStore.getState()
        const id = fs.selectedId
        if (!id) return
        if (fs.byId[id]?.format !== 'svg') return
        useRuntimeStore.getState().enqueuePreview(id)
      },
      { equalityFn: Object.is },
    )
  }, [])

  const filesById = useFilesStore((s) => s.byId)
  const filesOrder = useFilesStore((s) => s.order)

  // Single-file view-model for center pane.
  const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)
  const file: MockFile = selectedEntry
    ? { id: selectedEntry.id, name: selectedEntry.name, type: fmtToType(selectedEntry.format), orig: selectedEntry.originalSize, opt: selectedEntry.optimizedSize ?? selectedEntry.originalSize, status: selectedEntry.status === 'idle' ? 'queued' : (selectedEntry.status as MockFile['status']), target: fmtToType(selectedEntry.format), dim: '—', q: null }
    : EMPTY_FILE

  // All-files view-model for ReportPanel.
  const allFiles: MockFile[] = useMemo(() =>
    filesOrder.flatMap((id) => {
      const e = filesById[id]
      if (!e) return []
      return [{ id: e.id, name: e.name, type: fmtToType(e.format), orig: e.originalSize, opt: e.optimizedSize ?? e.originalSize, status: e.status === 'idle' ? 'queued' : (e.status as MockFile['status']), target: fmtToType(e.format), dim: '—', q: null }]
    }),
    [filesById, filesOrder],
  )

  // Auto-flip inspector tab for SVG files.
  useEffect(() => {
    if (file.type === 'svg' && tab === 'codec') setTab('svgo')
    if (file.type !== 'svg' && tab === 'svgo') setTab('codec')
  }, [file.type, tab])

  const stageRef = useRef<HTMLDivElement | null>(null)

  // D-08 — preview blob-URLs for compare stage.
  const [previewUrls, setPreviewUrls] = useState<{ orig: string | null; opt: string | null }>({ orig: null, opt: null })
  useEffect(() => {
    if (!selectedEntry) { setPreviewUrls({ orig: null, opt: null }); return }
    const origUrl = URL.createObjectURL(selectedEntry.sourceBlob)
    const optUrl = selectedEntry.optimizedBlob ? URL.createObjectURL(selectedEntry.optimizedBlob) : null
    setPreviewUrls({ orig: origUrl, opt: optUrl })
    return () => { URL.revokeObjectURL(origUrl); if (optUrl) URL.revokeObjectURL(optUrl) }
  }, [selectedEntry?.id, selectedEntry?.sourceBlob, selectedEntry?.optimizedBlob])

  const onSplitDrag = () => {
    const rect = stageRef.current?.querySelector<HTMLDivElement>('.image-frame')?.getBoundingClientRect()
    if (!rect) return
    const move = (ev: MouseEvent) => setSplit(Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100)))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // D-15 — totals for StatusBar.
  const totals = useMemo(() => {
    const entries = filesOrder.map((id) => filesById[id]).filter(Boolean)
    const orig = entries.reduce((s, f) => s + (f?.originalSize ?? 0), 0)
    const opt = entries.reduce((s, f) => s + (f?.optimizedSize ?? f?.originalSize ?? 0), 0)
    const pct = orig === 0 ? 0 : ((orig - opt) / orig) * 100
    return { orig, opt, saved: orig - opt, pct }
  }, [filesById, filesOrder])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  // D-16 — exportZip stub.
  const exportZip = () => toast.success('Bundled oimg-export.zip', { description: '2.6 MB' })
  const setCodecFromMenu = (c: CodecLabel) => { useSettingsStore.getState().setCodec({ label: c }); pushToast('Output set to ' + c); setOpen(null) }
  // TODO Phase 11: wire toolbar Add button through FilePanel forwarded ref or a shared event bus.
  const onToolbarChange = (_v: ToolbarChange) => pushToast('Use the + button in the file queue or drop files')

  const cmdGroups: CmdGroup[] = [
    { group: 'Actions', items: [
      { ic: <Icons.Upload size={13} />, label: 'Add files…', meta: 'A', do: () => pushToast('File picker opened') },
      { ic: <Icons.Play size={13} />, label: 'Optimize all', meta: 'Run worker pool · ⌘⏎', do: startOptimize },
      ...(running ? [{ ic: <Icons.X size={14} />, label: 'Cancel batch', meta: 'Stops in-flight workers · ⌘.', do: cancelBatch }] : []),
      { ic: <Icons.Download size={13} />, label: 'Export ZIP', meta: 'E', do: exportZip },
      { ic: <Icons.Zap size={13} />, label: 'Auto (Butteraugli 1.4)', meta: 'B', do: () => pushToast('Auto-optimizing…', 'butteraugli ≤ 1.4') },
    ]},
    { group: 'View', items: [
      { ic: <Icons.Grid size={13} />, label: 'Switch to Batch', do: () => setView('Batch') },
      { ic: <Icons.Layers size={13} />, label: 'Switch to Compare', do: () => setView('Compare') },
      { ic: <Icons.BarChart size={13} />, label: 'Switch to Report', do: () => setView('Report') },
      { ic: theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />, label: 'Toggle ' + (theme === 'dark' ? 'light' : 'dark') + ' theme', do: toggleTheme },
    ]},
    { group: 'Codec', items: CODECS.filter((c) => c !== 'SVG').map((c) => ({
      ic: <Icons.Image size={13} />,
      label: 'Set output → ' + c + (c === 'JPEG' ? ' (mozjpeg)' : c === 'PNG' ? ' (oxipng)' : ''),
      do: () => setCodecFromMenu(c),
    }))},
  ]

  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)

  return (
    <AppShell
      titleBar={<TitleBar theme={theme} onToggleTheme={toggleTheme} openKey={open} onOpenKey={setOpen} codec={codecLabel} onSelectCodec={setCodecFromMenu} view={view} onSetView={setView} onToast={pushToast} onOpenCommandPalette={() => setCmdkOpen(true)} />}
      toolbar={<Toolbar running={running} onStartOptimize={startOptimize} onExportZip={exportZip} view={view} onSetView={setView} filterQuery={''} onSetFilterQuery={() => {}} theme={theme} onToggleTheme={toggleTheme} openKey={open} onOpenKey={setOpen} onToast={pushToast} onChange={onToolbarChange} />}
      workArea={
        <main className="work">
          <FilePanel selectedId={selectedId || null} onSelect={setSelectedId} onOptimize={startOptimize} onCancel={cancelBatch} />

          {/* CENTER: Compare */}
          <div className="pane center">
            <div className="center-head">
              <div className="crumbs">
                <span>Queue</span><span className="sep">/</span><span className="cur">{file.name}</span>
                <span className="file-tag">{file.type.toUpperCase()} → {file.target.toUpperCase()}</span>
                <span className="file-tag">{file.dim}</span>
                {file.q != null && <span className="file-tag">q{file.q}</span>}
              </div>
              <div className="right">
                <span className="pill acc"><Icons.Check size={10} /> Optimized</span>
                <button className={'tbtn ghost' + (isPopOpen('zoom') ? ' open' : '')} style={{ height: 24, padding: '0 8px', position: 'relative' }} onClick={() => togglePop('zoom')}>
                  <Icons.Eye size={12} /> 100% <Icons.ChevronDown size={9} />
                  <Popover open={isPopOpen('zoom')} onClose={() => setOpen(null)} anchor="br">
                    {['25%', '50%', '100%', '200%', 'Fit'].map((z) => (
                      <div key={z} className={'pi check' + (z === '100%' ? ' on' : '')} onClick={() => setOpen(null)}><span>{z}</span></div>
                    ))}
                  </Popover>
                </button>
              </div>
            </div>
            <div className="compare" ref={stageRef}>
              <div className="compare-stage">
                <div className="image-frame" style={{ ['--split' as string]: split + '%' } as React.CSSProperties}>
                  <div className="image-layer layer-orig" style={previewUrls.orig ? { background: `transparent url("${previewUrls.orig}") center/contain no-repeat` } : undefined} />
                  <div className="image-layer layer-opt" style={previewUrls.opt || previewUrls.orig ? { background: `transparent url("${previewUrls.opt ?? previewUrls.orig}") center/contain no-repeat` } : undefined} />
                  <div className="split-tag l"><span className="dot" />ORIGINAL · {fmtBytes(file.orig)}</div>
                  <div className="split-tag r"><span className="dot" />{file.target.toUpperCase()} · {fmtBytes(file.opt)}</div>
                  <div className="split-handle" role="slider" aria-label="Compare split position" aria-valuemin={2} aria-valuemax={98} aria-valuenow={Math.round(split)} tabIndex={0} style={{ left: split + '%' }}
                    onMouseDown={(e) => { e.preventDefault(); onSplitDrag() }}
                    onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(2, s - 5)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(98, s + 5)); if (e.key === 'Home') setSplit(2); if (e.key === 'End') setSplit(98) }}
                  />
                </div>
              </div>
              <div className="delta-strip">
                <div className="delta"><span className="l">Original</span><span className="v">{fmtBytes(file.orig)}</span><span className="sub">{file.dim} · {file.type}</span></div>
                <div className="delta"><span className="l">Optimized</span><span className="v">{fmtBytes(file.opt)}</span><span className="sub">{codecLabel.toLowerCase()} · q{codecQ} · m{codecMethod}</span></div>
                <div className="delta savings"><span className="l">Saved</span><span className="v">−{fmtBytes(file.orig - file.opt)}</span><span className="sub">{fmtPct(file.orig, file.opt)} smaller</span></div>
                <div className="delta"><span className="l">SSIM</span><span className="v">0.987</span><span className="sub">visually identical</span></div>
                <div className="delta"><span className="l">Butteraugli</span><span className="v">1.24</span><span className="sub">target ≤ 1.40</span></div>
                <div className="delta"><span className="l">Decode</span><span className="v">38ms</span><span className="sub">est. on 4G</span></div>
              </div>
            </div>
          </div>

          {/* RIGHT: Inspector */}
          <div className="pane insp">
            <div className="pane-hd">
              <span>Inspector</span>
              <div className="actions" style={{ position: 'relative' }}>
                <button className={'iconbtn' + (isPopOpen('insp') ? ' on' : '')} onClick={() => togglePop('insp')}><Icons.More size={12} /></button>
                <Popover open={isPopOpen('insp')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 220 }}>
                  <div className="pi" onClick={() => { setOpen(null); pushToast('Settings copied to all files') }}><Icons.Layers size={13} /><span>Apply to all files</span></div>
                  <div className="pi" onClick={() => { setOpen(null); pushToast('Saved as preset', '"WebP q82 1600w"') }}><Icons.Plus size={13} /><span>Save as preset…</span></div>
                  <div className="div" /><div className="lbl">Presets</div>
                  <div className="pi check on"><span>Web · WebP q82</span></div>
                  <div className="pi check"><span>Email · JPEG q70 800w</span></div>
                  <div className="pi check"><span>Print · PNG lossless</span></div>
                </Popover>
              </div>
            </div>
            <div className="tabs" role="tablist" aria-label="Inspector">
              {file.type === 'svg'
                ? <button role="tab" aria-selected={tab === 'svgo'} aria-controls="inspector-panel" id="inspector-tab-svgo" className={tab === 'svgo' ? 'on' : ''} onClick={() => setTab('svgo')}>SVGO</button>
                : <button role="tab" aria-selected={tab === 'codec'} aria-controls="inspector-panel" id="inspector-tab-codec" className={tab === 'codec' ? 'on' : ''} onClick={() => setTab('codec')}>Codec</button>
              }
              <button role="tab" aria-selected={tab === 'output'} aria-controls="inspector-panel" id="inspector-tab-output" className={tab === 'output' ? 'on' : ''} onClick={() => setTab('output')}>Output</button>
              <button role="tab" aria-selected={tab === 'report'} aria-controls="inspector-panel" id="inspector-tab-report" className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>Report</button>
            </div>
            <div className="pane-body" role="tabpanel" id="inspector-panel" aria-labelledby={`inspector-tab-${tab}`}>
              {tab === 'codec' && <><CodecPanel resizeOn={resizeOn} setResizeOn={setResizeOn} w={w} setW={setW} h={h} setH={setH} alg={alg} setAlg={setAlg} fit={fit} setFit={setFit} stripMeta={stripMeta} setStripMeta={setStripMeta} keepIcc={keepIcc} setKeepIcc={setKeepIcc} /><TweaksResizeSection /><TweaksPrivacySection /></>}
              {tab === 'svgo' && <><SvgoPanel plugins={svgoPluginRows} togglePlugin={togglePlugin} unsafeExport={svgSettings.unsafeExport ?? false} setUnsafeExport={setUnsafeExport} /><TweaksResizeSection /><TweaksPrivacySection /></>}
              {tab === 'output' && <SnippetPanel file={filesById[selectedId] ?? null} />}
              {tab === 'report' && <ReportPanel files={allFiles} />}
            </div>
          </div>
        </main>
      }
      statusBar={<StatusBar running={running} filesCount={filesOrder.length} origTotal={totals.orig} optTotal={totals.opt} compressionPct={totals.pct} savedBytes={totals.saved} />}
      overlays={<>
        <div ref={(el) => setLiveRegion(el)} role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }} />
        <Toaster position="bottom-right" />
        <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} groups={cmdGroups} />
      </>}
    />
  )
}
