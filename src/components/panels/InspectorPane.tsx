import { useState, useMemo, useEffect } from 'react'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { CodecPanel } from '@/components/panels/CodecPanel'
import { SvgoPanel, PLUGIN_FOOTGUNS } from '@/components/panels/SvgoPanel'
import { SnippetPanel } from '@/components/panels/SnippetPanel'
import { ReportPanel } from '@/components/panels/ReportPanel'
import { TweaksResizeSection, TweaksPrivacySection } from '@/components/panels/TweaksPanel'
import { useFilesStore, useSettingsStore } from '@/stores'
import type { MockFile, ResizeAlg, FitMode } from '@/types'

type Tab = 'codec' | 'svgo' | 'output' | 'report'

const fmtToType = (fmt: string): MockFile['type'] => fmt === 'jpeg' ? 'jpg' : (fmt as MockFile['type'])

interface InspectorPaneProps {
  file: MockFile
  selectedId: string
  open: string | null
  setOpen: (v: string | null) => void
  onToast: (msg: string, meta?: string) => void
}

export function InspectorPane({ file, selectedId, open, setOpen, onToast }: InspectorPaneProps) {
  const [tab, setTab] = useState<Tab>('codec')
  const [resizeOn, setResizeOn] = useState(true)
  const [w, setW] = useState('1600')
  const [h, setH] = useState('auto')
  const [alg, setAlg] = useState<ResizeAlg>('lanczos3')
  const [fit, setFit] = useState<FitMode>('contain')
  const [stripMeta, setStripMeta] = useState(true)
  const [keepIcc, setKeepIcc] = useState(false)

  const svgSettings = useSettingsStore((s) => s.svg)
  const setSvg = useSettingsStore((s) => s.setSvg)
  const filesById = useFilesStore((s) => s.byId)
  const filesOrder = useFilesStore((s) => s.order)

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

  const allFiles: MockFile[] = useMemo(() =>
    filesOrder.flatMap((id) => {
      const e = filesById[id]
      if (!e) return []
      return [{ id: e.id, name: e.name, type: fmtToType(e.format), orig: e.originalSize, opt: e.optimizedSize ?? e.originalSize, status: e.status === 'idle' ? 'queued' : (e.status as MockFile['status']), target: fmtToType(e.format), dim: '—', q: null }]
    }),
    [filesById, filesOrder],
  )

  // Auto-flip inspector tab based on file type.
  useEffect(() => {
    if (file.type === 'svg' && tab === 'codec') setTab('svgo')
    if (file.type !== 'svg' && tab === 'svgo') setTab('codec')
  }, [file.type, tab])

  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)

  return (
    <div className="pane insp">
      <div className="pane-hd">
        <span>Inspector</span>
        <div className="actions" style={{ position: 'relative' }}>
          <button className={'iconbtn' + (isPopOpen('insp') ? ' on' : '')} onClick={() => togglePop('insp')}><Icons.More size={12} /></button>
          <Popover open={isPopOpen('insp')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 220 }}>
            <div className="pi" onClick={() => { setOpen(null); onToast('Settings copied to all files') }}><Icons.Layers size={13} /><span>Apply to all files</span></div>
            <div className="pi" onClick={() => { setOpen(null); onToast('Saved as preset', '"WebP q82 1600w"') }}><Icons.Plus size={13} /><span>Save as preset…</span></div>
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
  )
}
