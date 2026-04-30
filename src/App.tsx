// Composition root for the OIMG shell — TypeScript port of example-ui/app.jsx.
// Plan 01-04 decomposed the 810-line monolith: TitleBar/Toolbar/StatusBar/
// CommandPalette live in src/components/shell/ now; App.tsx is the state
// owner that wires them together via <AppShell>. Work-area JSX intentionally
// remains here pending Plan 05's panel decomposition.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { CodecPanel } from '@/components/panels/CodecPanel'
import { SvgoPanel } from '@/components/panels/SvgoPanel'
import { OutputPanel } from '@/components/panels/OutputPanel'
import { ReportPanel } from '@/components/panels/ReportPanel'
import { AppShell } from '@/components/shell/AppShell'
import { TitleBar } from '@/components/shell/TitleBar'
import { Toolbar } from '@/components/shell/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar'
import { CommandPalette } from '@/components/shell/CommandPalette'
import type { CmdGroup } from '@/components/shell/CommandPalette'
import { useTheme } from '@/hooks/useTheme'
import { fmtBytes, fmtPct } from '@/lib/format'
import {
  MOCK_FILES,
  SVGO_PLUGINS,
  CODECS,
  type CodecLabel,
  type ResizeAlg,
  type FitMode,
  type SvgoPlugin,
  type MockFile,
} from '@/data/mock'

type Tab = 'codec' | 'svgo' | 'output' | 'report'
type View = 'Batch' | 'Compare' | 'Report'

interface Toast {
  id: number
  msg: string
  meta?: string
}

export default function App() {
  const { theme, setTheme } = useTheme()

  const [selectedId, setSelectedId] = useState<string>('f1')
  const [tab, setTab] = useState<Tab>('codec')
  const [split, setSplit] = useState<number>(50)
  const [view, setView] = useState<View>('Batch')

  const [open, setOpen] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)
  const [rowMenu, setRowMenu] = useState<string | null>(null)

  // Codec settings
  const [codec, setCodec] = useState<CodecLabel>('WebP')
  const [q, setQ] = useState<number>(82)
  const [method, setMethod] = useState<number>(4)
  const [lossless, setLossless] = useState<boolean>(false)
  const [resizeOn, setResizeOn] = useState<boolean>(true)
  const [w, setW] = useState<string>('1600')
  const [h, setH] = useState<string>('auto')
  const [alg, setAlg] = useState<ResizeAlg>('lanczos3')
  const [fit, setFit] = useState<FitMode>('contain')
  const [stripMeta, setStripMeta] = useState<boolean>(true)
  const [keepIcc, setKeepIcc] = useState<boolean>(false)
  const [aggressive, setAggressive] = useState<boolean>(false)

  const [running, setRunning] = useState<boolean>(false)
  const [filterQuery, setFilterQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('queue order')

  const [plugins, setPlugins] = useState<SvgoPlugin[]>(SVGO_PLUGINS)
  const togglePlugin = (id: string) =>
    setPlugins((ps) => ps.map((p) => (p.id === id ? { ...p, on: !p.on } : p)))

  const pushToast = (msg: string, meta?: string) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { id, msg, meta }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2600)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setCmdkOpen(false)
        setOpen(null)
        setRowMenu(null)
      } else if (e.key === '/' && !cmdkOpen) {
        const tag = document.activeElement?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          ;(document.querySelector<HTMLInputElement>('.search input'))?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cmdkOpen])

  const file: MockFile = useMemo(
    () => MOCK_FILES.find((f) => f.id === selectedId) ?? MOCK_FILES[0],
    [selectedId]
  )

  const filteredFiles = useMemo(() => {
    const fq = filterQuery.trim().toLowerCase()
    if (!fq) return MOCK_FILES
    return MOCK_FILES.filter((f) => f.name.toLowerCase().includes(fq))
  }, [filterQuery])

  // SVG files don't have a Codec tab; auto-flip to SVGO.
  useEffect(() => {
    if (file.type === 'svg' && tab === 'codec') setTab('svgo')
    if (file.type !== 'svg' && tab === 'svgo') setTab('codec')
  }, [file.type, tab])

  const stageRef = useRef<HTMLDivElement | null>(null)
  const onSplitDrag = () => {
    const rect = stageRef.current?.querySelector<HTMLDivElement>('.image-frame')?.getBoundingClientRect()
    if (!rect) return
    const move = (ev: MouseEvent) => {
      const x = ((ev.clientX - rect.left) / rect.width) * 100
      setSplit(Math.max(2, Math.min(98, x)))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const totals = useMemo(() => {
    const orig = MOCK_FILES.reduce((s, f) => s + f.orig, 0)
    const opt = MOCK_FILES.reduce((s, f) => s + f.opt, 0)
    return { orig, opt, saved: orig - opt, pct: ((orig - opt) / orig) * 100 }
  }, [])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const startOptimize = () => {
    setRunning(true)
    pushToast('Optimizing 12 files…', '5 workers')
    setTimeout(() => {
      setRunning(false)
      pushToast('Done · saved 8.4 MB', '76.4%')
    }, 1800)
  }

  const exportZip = () => {
    pushToast('Bundled oimg-export.zip', '2.6 MB')
  }

  const setCodecFromMenu = (c: CodecLabel) => {
    setCodec(c)
    pushToast('Output set to ' + c)
    setOpen(null)
  }

  // Command palette items
  const cmdGroups: CmdGroup[] = [
    {
      group: 'Actions',
      items: [
        { ic: <Icons.Upload size={13} />, label: 'Add files…', meta: 'A', do: () => pushToast('File picker opened') },
        { ic: <Icons.Play size={13} />, label: 'Optimize all', meta: 'O', do: startOptimize },
        { ic: <Icons.Download size={13} />, label: 'Export ZIP', meta: 'E', do: exportZip },
        { ic: <Icons.Zap size={13} />, label: 'Auto (Butteraugli 1.4)', meta: 'B', do: () => pushToast('Auto-optimizing…', 'butteraugli ≤ 1.4') },
      ],
    },
    {
      group: 'View',
      items: [
        { ic: <Icons.Grid size={13} />, label: 'Switch to Batch', do: () => setView('Batch') },
        { ic: <Icons.Layers size={13} />, label: 'Switch to Compare', do: () => setView('Compare') },
        { ic: <Icons.BarChart size={13} />, label: 'Switch to Report', do: () => setView('Report') },
        {
          ic: theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />,
          label: 'Toggle ' + (theme === 'dark' ? 'light' : 'dark') + ' theme',
          do: toggleTheme,
        },
      ],
    },
    {
      group: 'Codec',
      items: CODECS.filter((c) => c !== 'SVG').map((c) => ({
        ic: <Icons.Image size={13} />,
        label: 'Set output → ' + c + (c === 'JPEG' ? ' (mozjpeg)' : c === 'PNG' ? ' (oxipng)' : ''),
        do: () => setCodecFromMenu(c),
      })),
    },
  ]

  const isPopOpen = (key: string) => open === key
  const togglePop = (key: string) => setOpen(open === key ? null : key)

  const workArea = (
    <main className="work">
      {/* LEFT: Queue */}
      <div className="pane">
        <div className="pane-hd">
          <span>Queue · {filteredFiles.length} files</span>
          <div className="actions" style={{ position: 'relative' }}>
            <button
              className={'iconbtn' + (isPopOpen('sort') ? ' on' : '')}
              onClick={() => togglePop('sort')}
              title="Sort"
            >
              <Icons.Filter size={12} />
            </button>
            <Popover open={isPopOpen('sort')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 200 }}>
              <div className="lbl">Sort by</div>
              {['queue order', 'file size', 'savings %', 'name', 'format'].map((s) => (
                <div
                  key={s}
                  className={'pi check' + (sortBy === s ? ' on' : '')}
                  onClick={() => { setSortBy(s); setOpen(null) }}
                >
                  <span>{s}</span>
                </div>
              ))}
            </Popover>
            <button className="iconbtn" title="Add" onClick={() => pushToast('File picker opened')}>
              <Icons.Plus size={12} />
            </button>
          </div>
        </div>

        <div className="dropzone">
          <span className="big">Drop images to optimize</span>
          <span>or click to browse · max 200 files</span>
          <div className="formats">SVG · PNG · JPEG · WEBP · AVIF · JXL</div>
        </div>

        <div className="pane-body" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="filelist">
            {filteredFiles.map((f) => (
              <div
                key={f.id}
                className={
                  'file-row' +
                  (selectedId === f.id ? ' selected' : '') +
                  (rowMenu === f.id ? ' has-menu' : '')
                }
                onClick={() => setSelectedId(f.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setRowMenu(f.id)
                  setSelectedId(f.id)
                }}
                style={{ position: 'relative' }}
              >
                <div className={'thumb ' + f.type}>{f.type.toUpperCase().slice(0, 3)}</div>
                <div className="file-meta">
                  <div className="file-name">{f.name}</div>
                  <div className="file-stat">
                    <span>{fmtBytes(f.orig)}</span>
                    <span className="arrow">→</span>
                    <span>{fmtBytes(f.opt)}</span>
                    <span className={'save' + (((f.orig - f.opt) / f.orig) < 0.3 ? ' warn' : '')}>
                      {fmtPct(f.orig, f.opt)}
                    </span>
                  </div>
                  {f.status === 'processing' && <div className="progbar"><div /></div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="ctxbtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRowMenu(rowMenu === f.id ? null : f.id)
                      setSelectedId(f.id)
                    }}
                  >
                    <Icons.More size={12} />
                  </button>
                  <div className={'file-status ' + f.status} title={f.status} />
                </div>
                {rowMenu === f.id && (
                  <Popover
                    open
                    onClose={() => setRowMenu(null)}
                    anchor="br"
                    style={{ minWidth: 200, top: 28, right: 8, left: 'auto' }}
                  >
                    <div className="pi" onClick={() => { setRowMenu(null); pushToast('Re-optimizing ' + f.name) }}>
                      <Icons.Play size={13} /><span>Re-optimize</span>
                    </div>
                    <div className="pi" onClick={() => { setRowMenu(null); pushToast('Saved ' + f.name) }}>
                      <Icons.Download size={13} /><span>Save as…</span>
                    </div>
                    <div className="pi" onClick={() => { setRowMenu(null); pushToast('Copied data URI') }}>
                      <Icons.Copy size={13} /><span>Copy data URI</span>
                    </div>
                    <div className="pi" onClick={() => { setRowMenu(null); setTab('output') }}>
                      <Icons.Code size={13} /><span>Copy &lt;picture&gt;</span>
                    </div>
                    <div className="div" />
                    <div className="pi danger" onClick={() => { setRowMenu(null); pushToast('Removed ' + f.name) }}>
                      <Icons.Trash size={13} /><span>Remove from queue</span>
                    </div>
                  </Popover>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="totals">
          <div>
            <div className="lbl">Total before</div>
            <div className="v num">{fmtBytes(totals.orig)}</div>
          </div>
          <div>
            <div className="lbl">Total after</div>
            <div className="v num acc">{fmtBytes(totals.opt)}</div>
          </div>
          <div>
            <div className="lbl">Saved</div>
            <div className="v num acc">−{fmtBytes(totals.saved)}</div>
          </div>
          <div>
            <div className="lbl">Compression</div>
            <div className="v num">{totals.pct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* CENTER: Compare */}
      <div className="pane center">
        <div className="center-head">
          <div className="crumbs">
            <span>Queue</span>
            <span className="sep">/</span>
            <span className="cur">{file.name}</span>
            <span className="file-tag">{file.type.toUpperCase()} → {file.target.toUpperCase()}</span>
            <span className="file-tag">{file.dim}</span>
            {file.q != null && <span className="file-tag">q{file.q}</span>}
          </div>
          <div className="right">
            <span className="pill acc"><Icons.Check size={10} /> Optimized</span>
            <button
              className={'tbtn ghost' + (isPopOpen('zoom') ? ' open' : '')}
              style={{ height: 24, padding: '0 8px', position: 'relative' }}
              onClick={() => togglePop('zoom')}
            >
              <Icons.Eye size={12} /> 100%
              <Icons.ChevronDown size={9} />
              <Popover open={isPopOpen('zoom')} onClose={() => setOpen(null)} anchor="br">
                {['25%', '50%', '100%', '200%', 'Fit'].map((z) => (
                  <div key={z} className={'pi check' + (z === '100%' ? ' on' : '')} onClick={() => setOpen(null)}>
                    <span>{z}</span>
                  </div>
                ))}
              </Popover>
            </button>
          </div>
        </div>

        <div className="compare" ref={stageRef}>
          <div className="compare-stage">
            <div
              className="image-frame"
              style={{ ['--split' as string]: split + '%' } as React.CSSProperties}
            >
              <div className="image-layer layer-orig"></div>
              <div className="image-layer layer-opt"></div>
              <div className="split-tag l">
                <span className="dot"></span>
                ORIGINAL · {fmtBytes(file.orig)}
              </div>
              <div className="split-tag r">
                <span className="dot"></span>
                {file.target.toUpperCase()} · {fmtBytes(file.opt)}
              </div>
              <div
                className="split-handle"
                style={{ left: split + '%' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSplitDrag()
                }}
              />
            </div>
          </div>

          <div className="delta-strip">
            <div className="delta">
              <span className="l">Original</span>
              <span className="v">{fmtBytes(file.orig)}</span>
              <span className="sub">{file.dim} · {file.type}</span>
            </div>
            <div className="delta">
              <span className="l">Optimized</span>
              <span className="v">{fmtBytes(file.opt)}</span>
              <span className="sub">{codec.toLowerCase()} · q{q} · m{method}</span>
            </div>
            <div className="delta savings">
              <span className="l">Saved</span>
              <span className="v">−{fmtBytes(file.orig - file.opt)}</span>
              <span className="sub">{fmtPct(file.orig, file.opt)} smaller</span>
            </div>
            <div className="delta">
              <span className="l">SSIM</span>
              <span className="v">0.987</span>
              <span className="sub">visually identical</span>
            </div>
            <div className="delta">
              <span className="l">Butteraugli</span>
              <span className="v">1.24</span>
              <span className="sub">target ≤ 1.40</span>
            </div>
            <div className="delta">
              <span className="l">Decode</span>
              <span className="v">38ms</span>
              <span className="sub">est. on 4G</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Inspector */}
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
              <div className="pi" onClick={() => { setOpen(null); pushToast('Settings copied to all files') }}>
                <Icons.Layers size={13} /><span>Apply to all files</span>
              </div>
              <div className="pi" onClick={() => { setOpen(null); pushToast('Saved as preset', '"WebP q82 1600w"') }}>
                <Icons.Plus size={13} /><span>Save as preset…</span>
              </div>
              <div className="div" />
              <div className="lbl">Presets</div>
              <div className="pi check on"><span>Web · WebP q82</span></div>
              <div className="pi check"><span>Email · JPEG q70 800w</span></div>
              <div className="pi check"><span>Print · PNG lossless</span></div>
            </Popover>
          </div>
        </div>
        <div className="tabs">
          {file.type === 'svg' ? (
            <button className={tab === 'svgo' ? 'on' : ''} onClick={() => setTab('svgo')}>SVGO</button>
          ) : (
            <button className={tab === 'codec' ? 'on' : ''} onClick={() => setTab('codec')}>Codec</button>
          )}
          <button className={tab === 'output' ? 'on' : ''} onClick={() => setTab('output')}>Output</button>
          <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>Report</button>
        </div>
        <div className="pane-body">
          {tab === 'codec' && (
            <CodecPanel
              codec={codec} setCodec={setCodec}
              q={q} setQ={setQ}
              method={method} setMethod={setMethod}
              lossless={lossless} setLossless={setLossless}
              resizeOn={resizeOn} setResizeOn={setResizeOn}
              w={w} setW={setW} h={h} setH={setH}
              alg={alg} setAlg={setAlg} fit={fit} setFit={setFit}
              stripMeta={stripMeta} setStripMeta={setStripMeta}
              keepIcc={keepIcc} setKeepIcc={setKeepIcc}
            />
          )}
          {tab === 'svgo' && (
            <SvgoPanel
              plugins={plugins}
              togglePlugin={togglePlugin}
              aggressive={aggressive}
              setAggressive={setAggressive}
            />
          )}
          {tab === 'output' && <OutputPanel file={file} />}
          {tab === 'report' && <ReportPanel files={MOCK_FILES} />}
        </div>
      </div>
    </main>
  )

  const overlays = (
    <>
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icons.Check size={13} />
            <span>{t.msg}</span>
            {t.meta && <span className="t-meta">{t.meta}</span>}
          </div>
        ))}
      </div>
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} groups={cmdGroups} />
    </>
  )

  return (
    <AppShell
      titleBar={
        <TitleBar
          theme={theme}
          onToggleTheme={toggleTheme}
          openKey={open}
          onOpenKey={setOpen}
          codec={codec}
          onSelectCodec={setCodecFromMenu}
          view={view}
          onSetView={setView}
          onToast={pushToast}
          onOpenCommandPalette={() => setCmdkOpen(true)}
        />
      }
      toolbar={
        <Toolbar
          running={running}
          onStartOptimize={startOptimize}
          onExportZip={exportZip}
          view={view}
          onSetView={setView}
          filterQuery={filterQuery}
          onSetFilterQuery={setFilterQuery}
          theme={theme}
          onToggleTheme={toggleTheme}
          openKey={open}
          onOpenKey={setOpen}
          onToast={pushToast}
        />
      }
      workArea={workArea}
      statusBar={
        <StatusBar
          running={running}
          filesCount={MOCK_FILES.length}
          origTotal={totals.orig}
          optTotal={totals.opt}
          compressionPct={totals.pct}
          savedBytes={totals.saved}
        />
      }
      overlays={overlays}
    />
  )
}
