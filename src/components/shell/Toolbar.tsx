// Toolbar — 44px action bar.
// Extracted from src/App.tsx (lines 336–430) in plan 01-04.
// Owns: Add files / Optimize / Export buttons, view segmented control,
// search input, theme toggle, settings popover.
// Visual contract: classNames and ARIA roles must NOT change. The outer
// container's role="toolbar" aria-label="Actions" is asserted by
// src/tests/shell.spec.ts.
//
// Phase 2 (plan 02-04): Toolbar subscribes directly to useRuntimeStore
// (D-09 narrow selectors) so the Workers pill + Optimize button reflect
// the live worker pool state. App.tsx still owns batch orchestration —
// onStartOptimize stays as a callback prop.

import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ThemeMode } from '@/types'
import { useRuntimeStore, useFilesStore } from '@/stores'

type View = 'Batch' | 'Compare' | 'Report'

interface ToolbarProps {
  /** @deprecated Phase 2 plan 02-04 — Toolbar reads `running` from useRuntimeStore directly.
   *  Prop retained transitionally so App.tsx can still pass it during the staged migration;
   *  the value is ignored. Will be removed once App.tsx drops the local `running` useState. */
  running?: boolean
  // Optimize trigger — App.tsx owns the worker pool reference.
  onStartOptimize: () => void
  onExportZip: () => void
  // View segmented control
  view: View
  onSetView: (v: View) => void
  // Search input
  filterQuery: string
  onSetFilterQuery: (q: string) => void
  // Theme
  theme: ThemeMode
  onToggleTheme: () => void
  // Popover open keying — App owns
  openKey: string | null
  onOpenKey: (k: string | null) => void
  // Toast pump
  onToast: (msg: string, meta?: string) => void
}

export function Toolbar(props: ToolbarProps) {
  const {
    onStartOptimize,
    onExportZip,
    view,
    onSetView,
    filterQuery,
    onSetFilterQuery,
    theme,
    onToggleTheme,
    openKey,
    onOpenKey,
    onToast,
  } = props

  // Phase 2 plan 02-04: narrow selectors from runtime store (D-09 convention).
  const running = useRuntimeStore((s) => s.running)
  const busy = useRuntimeStore((s) => s.inFlight.size)
  const poolSize = useRuntimeStore((s) => s.poolSize)
  const errorCount = useRuntimeStore((s) => s.errorCount)
  // Optimize button is enabled when there is at least one file in the FILES
  // store (the source of truth for "is there work to do") — NOT the runtime
  // queue, which only has entries WHILE a batch is dispatching.
  const fileCount = useFilesStore((s) => s.order.length)
  const hasNoFiles = fileCount === 0

  const isPopOpen = (key: string) => openKey === key
  const togglePop = (key: string) => onOpenKey(openKey === key ? null : key)

  // Workers pill copy + ARIA label, per UI-SPEC §1 (lines 109-114).
  const pillCopy = !running && busy === 0 && poolSize > 0
    ? (errorCount > 0 ? `${poolSize} idle · errors` : `${poolSize} idle`)
    : running
      ? `${busy}/${poolSize} busy`
      : 'Workers idle'
  const pillAria = !running && busy === 0
    ? (errorCount > 0 ? `${poolSize} workers idle, last batch had errors` : `${poolSize} workers idle`)
    : running
      ? `${busy} of ${poolSize} workers busy`
      : 'Worker pool idle'
  const pillClass = (!running && busy === 0 && errorCount === 0 && poolSize > 0) ? 'pill acc' : 'pill'

  return (
    <div role="toolbar" aria-label="Actions" className="toolbar">
      <button
        className={'tbtn primary' + (isPopOpen('add') ? ' open' : '')}
        onClick={() => togglePop('add')}
        style={{ position: 'relative' }}
      >
        <Icons.Upload size={13} /> Add files
        <Icons.ChevronDown size={9} />
        <Popover open={isPopOpen('add')} onClose={() => onOpenKey(null)}>
          <div className="pi" onClick={() => { onOpenKey(null); onToast('File picker opened') }}>
            <Icons.File size={13} /><span>From device…</span><span className="kbd">A</span>
          </div>
          <div className="pi" onClick={() => { onOpenKey(null); onToast('Folder watcher started', '~/Downloads') }}>
            <Icons.Layers size={13} /><span>Watch folder…</span>
          </div>
          <div className="pi" onClick={() => { onOpenKey(null); onToast('Paste URL or data:image…') }}>
            <Icons.Code size={13} /><span>From URL or paste</span><span className="kbd">⌘V</span>
          </div>
        </Popover>
      </button>

      <button className="tbtn" onClick={onStartOptimize} disabled={running || hasNoFiles}>
        {running ? <><Icons.Pause size={13} /> Optimizing…</> : <><Icons.Play size={13} /> Optimize all</>}
      </button>

      <button
        className={'tbtn' + (isPopOpen('export') ? ' open' : '')}
        onClick={() => togglePop('export')}
        style={{ position: 'relative' }}
      >
        <Icons.Download size={13} /> Export
        <Icons.ChevronDown size={9} />
        <Popover open={isPopOpen('export')} onClose={() => onOpenKey(null)} style={{ minWidth: 240 }}>
          <div className="pi" onClick={() => { onOpenKey(null); onExportZip() }}>
            <Icons.Layers size={13} /><span>All as ZIP</span><span className="kbd">⌘E</span>
          </div>
          <div className="pi" onClick={() => { onOpenKey(null); onToast('Saved to ~/Downloads', '12 files') }}>
            <Icons.Download size={13} /><span>Save individually</span>
          </div>
          <div className="div" />
          <div className="lbl">Code</div>
          <div className="pi" onClick={() => { onOpenKey(null); onToast('Copied <picture> snippets', '12 files') }}>
            <Icons.Code size={13} /><span>Copy &lt;picture&gt; HTML</span>
          </div>
          <div className="pi" onClick={() => { onOpenKey(null); onToast('Copied as data URIs') }}>
            <Icons.Code size={13} /><span>Copy as data URIs</span>
          </div>
        </Popover>
      </button>

      <div className="tdiv" />
      <div className="seg">
        {(['Batch', 'Compare', 'Report'] as View[]).map((v) => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => onSetView(v)}>
            {v}
          </button>
        ))}
      </div>
      <div className="tdiv" />

      {/* Workers pill — UI-SPEC §1. aria-live="off" because the dedicated live region in
          App.tsx owns announcements; the pill is a passive informational status surface. */}
      <div className={pillClass} aria-label={pillAria} role="status" aria-live="off">
        <span style={{ fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>{pillCopy}</span>
      </div>

      <div className="search">
        <Icons.Search size={12} />
        <input
          placeholder="Filter files…"
          value={filterQuery}
          onChange={(e) => onSetFilterQuery(e.target.value)}
        />
        <span className="kbd" style={{ marginLeft: 4 }}>/</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Tooltip label={theme === 'dark' ? 'Light theme' : 'Dark theme'} kbd="⌘⇧L">
          <button className="tbtn ghost" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />}
          </button>
        </Tooltip>
        <button
          className={'tbtn ghost' + (isPopOpen('settings') ? ' open' : '')}
          onClick={() => togglePop('settings')}
          style={{ position: 'relative' }}
          aria-label="Settings"
        >
          <Icons.Settings size={13} />
          <Popover open={isPopOpen('settings')} onClose={() => onOpenKey(null)} anchor="br" style={{ minWidth: 240 }}>
            <div className="lbl">Workers</div>
            <div className="pi"><span>Pool size</span><span className="kbd mono">{poolSize}</span></div>
            <div className="pi"><span>WASM threading</span><span className="kbd">on</span></div>
            <div className="div" />
            <div className="lbl">Privacy</div>
            <div className="pi check on"><span>Strip metadata by default</span></div>
            <div className="pi check"><span>Telemetry</span></div>
          </Popover>
        </button>
      </div>
    </div>
  )
}
