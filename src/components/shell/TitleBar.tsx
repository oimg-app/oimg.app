// TitleBar — top 36px chrome bar.
// Extracted from src/App.tsx (lines 216–333) in plan 01-04.
// Owns: brand mark, primary nav menus (Codec / View / Help), right pill
// cluster (privacy/offline pills, version, ⌘K Search button).
// Visual contract: classNames and ARIA roles must NOT change (src/index.css
// is the styling contract; src/tests/shell.spec.ts asserts role="banner").

import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ThemeMode } from '@/types'
import { CODECS, type CodecLabel } from '@/data/mock'

type View = 'Batch' | 'Compare' | 'Report'

interface TitleBarProps {
  // Theme
  theme: ThemeMode
  onToggleTheme: () => void
  // Menu open keying — App owns so multiple menus close together
  openKey: string | null
  onOpenKey: (key: string | null) => void
  // Codec menu
  codec: CodecLabel
  onSelectCodec: (c: CodecLabel) => void
  // View menu
  view: View
  onSetView: (v: View) => void
  // Toast pump
  onToast: (msg: string, meta?: string) => void
  // Command palette opener
  onOpenCommandPalette: () => void
}

export function TitleBar(props: TitleBarProps) {
  const { theme, onToggleTheme, openKey, onOpenKey, codec, onSelectCodec, view, onSetView, onToast, onOpenCommandPalette } = props
  const isPopOpen = (key: string) => openKey === key
  const togglePop = (key: string) => onOpenKey(openKey === key ? null : key)

  return (
    <header role="banner" className="titlebar">
      <div className="brand">
        <span className="mark"></span>
        OIMG <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· image optimizer</span>
      </div>

      <nav className="menu" aria-label="Primary">
        <button
          className={isPopOpen('menu-codec') ? 'on' : ''}
          onClick={() => togglePop('menu-codec')}
          aria-haspopup="menu"
          aria-expanded={isPopOpen('menu-codec')}
        >
          Codec
          <Popover open={isPopOpen('menu-codec')} onClose={() => onOpenKey(null)} style={{ minWidth: 220 }}>
            <div className="lbl">Output format</div>
            {CODECS.map((c) => (
              <div
                key={c}
                className={'pi check' + (codec === c ? ' on' : '')}
                onClick={() => onSelectCodec(c)}
              >
                <span className="mono">{c}</span>
                <span className="kbd">{c[0]}</span>
              </div>
            ))}
            <div className="div" />
            <div
              className="pi"
              onClick={() => {
                onOpenKey(null)
                onToast('Auto-optimizing…', 'butteraugli ≤ 1.4')
              }}
            >
              <Icons.Zap size={13} />
              <span>Auto (Butteraugli)</span>
              <span className="kbd">⌘B</span>
            </div>
          </Popover>
        </button>

        <button
          className={isPopOpen('menu-view') ? 'on' : ''}
          onClick={() => togglePop('menu-view')}
          aria-haspopup="menu"
          aria-expanded={isPopOpen('menu-view')}
        >
          View
          <Popover open={isPopOpen('menu-view')} onClose={() => onOpenKey(null)}>
            {(['Batch', 'Compare', 'Report'] as View[]).map((v, i) => (
              <div
                key={v}
                className={'pi check' + (view === v ? ' on' : '')}
                onClick={() => {
                  onSetView(v)
                  onOpenKey(null)
                }}
              >
                {v === 'Batch' && <Icons.Grid size={13} />}
                {v === 'Compare' && <Icons.Layers size={13} />}
                {v === 'Report' && <Icons.BarChart size={13} />}
                <span>{v}</span>
                <span className="kbd">⌘{i + 1}</span>
              </div>
            ))}
            <div className="div" />
            <div
              className="pi"
              onClick={() => {
                onToggleTheme()
                onOpenKey(null)
              }}
            >
              {theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />}
              <span>Toggle theme</span>
              <span className="kbd">⌘⇧L</span>
            </div>
          </Popover>
        </button>

        <button
          className={isPopOpen('menu-help') ? 'on' : ''}
          onClick={() => togglePop('menu-help')}
          aria-haspopup="menu"
          aria-expanded={isPopOpen('menu-help')}
        >
          Help
          <Popover open={isPopOpen('menu-help')} onClose={() => onOpenKey(null)}>
            <div className="pi"><Icons.File size={13} /><span>Documentation</span></div>
            <div className="pi"><Icons.Code size={13} /><span>Keyboard shortcuts</span><span className="kbd">?</span></div>
            <div className="div" />
            <div className="pi"><Icons.Eye size={13} /><span>What's new in v0.4.2</span></div>
          </Popover>
        </button>
      </nav>

      <div className="right">
        <Tooltip label="All processing happens locally · no upload">
          <span className="pill"><Icons.Lock size={10} /> 100% local</span>
        </Tooltip>
        <Tooltip label="PWA installed · works offline">
          <span className="pill">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Offline-ready
          </span>
        </Tooltip>
        <span style={{ color: 'var(--fg-3)' }}>v0.4.2</span>
        <button
          className="tbtn ghost"
          style={{ height: 22, padding: '0 8px', fontSize: 11 }}
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
        >
          <Icons.Search size={11} /> <span style={{ color: 'var(--fg-2)' }}>Search</span>
          <span className="kbd" style={{ marginLeft: 6 }}>⌘K</span>
        </button>
      </div>
    </header>
  )
}
