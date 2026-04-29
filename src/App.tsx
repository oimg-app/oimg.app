// Main OIMG application shell — TypeScript port of example-ui/app.jsx.
// All visual state is local (no codec pipeline yet). Stores will replace
// these useState hooks when the pipeline lands in Phase 2+.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { Popover } from '@/components/ui/Popover';
import { Tooltip } from '@/components/ui/Tooltip';
import { CodecPanel } from '@/components/panels/CodecPanel';
import { SvgoPanel } from '@/components/panels/SvgoPanel';
import { OutputPanel } from '@/components/panels/OutputPanel';
import { ReportPanel } from '@/components/panels/ReportPanel';
import { useTheme } from '@/hooks/useTheme';
import { fmtBytes, fmtPct } from '@/lib/format';
import {
  MOCK_FILES,
  SVGO_PLUGINS,
  CODECS,
  type CodecLabel,
  type ResizeAlg,
  type FitMode,
  type SvgoPlugin,
  type MockFile,
} from '@/data/mock';

type Tab = 'codec' | 'svgo' | 'output' | 'report';
type View = 'Batch' | 'Compare' | 'Report';

interface Toast {
  id: number;
  msg: string;
  meta?: string;
}

interface CmdItem {
  ic: ReactNode;
  label: string;
  meta?: string;
  do?: () => void;
}

interface CmdGroup {
  group: string;
  items: CmdItem[];
}

export default function App() {
  const { theme, setTheme } = useTheme();

  const [selectedId, setSelectedId] = useState<string>('f1');
  const [tab, setTab] = useState<Tab>('codec');
  const [split, setSplit] = useState<number>(50);
  const [view, setView] = useState<View>('Batch');

  const [open, setOpen] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false);
  const [cmdkQ, setCmdkQ] = useState<string>('');
  const [cmdkSel, setCmdkSel] = useState<number>(0);
  const [rowMenu, setRowMenu] = useState<string | null>(null);

  // Codec settings
  const [codec, setCodec] = useState<CodecLabel>('WebP');
  const [q, setQ] = useState<number>(82);
  const [method, setMethod] = useState<number>(4);
  const [lossless, setLossless] = useState<boolean>(false);
  const [resizeOn, setResizeOn] = useState<boolean>(true);
  const [w, setW] = useState<string>('1600');
  const [h, setH] = useState<string>('auto');
  const [alg, setAlg] = useState<ResizeAlg>('lanczos3');
  const [fit, setFit] = useState<FitMode>('contain');
  const [stripMeta, setStripMeta] = useState<boolean>(true);
  const [keepIcc, setKeepIcc] = useState<boolean>(false);
  const [aggressive, setAggressive] = useState<boolean>(false);

  const [running, setRunning] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('queue order');

  const [plugins, setPlugins] = useState<SvgoPlugin[]>(SVGO_PLUGINS);
  const togglePlugin = (id: string) =>
    setPlugins((ps) => ps.map((p) => (p.id === id ? { ...p, on: !p.on } : p)));

  const pushToast = (msg: string, meta?: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, msg, meta }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2600);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setCmdkOpen(false);
        setOpen(null);
        setRowMenu(null);
      } else if (e.key === '/' && !cmdkOpen) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          (document.querySelector<HTMLInputElement>('.search input'))?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdkOpen]);

  const file: MockFile = useMemo(
    () => MOCK_FILES.find((f) => f.id === selectedId) ?? MOCK_FILES[0],
    [selectedId]
  );

  const filteredFiles = useMemo(() => {
    const fq = filterQuery.trim().toLowerCase();
    if (!fq) return MOCK_FILES;
    return MOCK_FILES.filter((f) => f.name.toLowerCase().includes(fq));
  }, [filterQuery]);

  // SVG files don't have a Codec tab; auto-flip to SVGO.
  useEffect(() => {
    if (file.type === 'svg' && tab === 'codec') setTab('svgo');
    if (file.type !== 'svg' && tab === 'svgo') setTab('codec');
  }, [file.type, tab]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const onSplitDrag = () => {
    const rect = stageRef.current?.querySelector<HTMLDivElement>('.image-frame')?.getBoundingClientRect();
    if (!rect) return;
    const move = (ev: MouseEvent) => {
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.max(2, Math.min(98, x)));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const totals = useMemo(() => {
    const orig = MOCK_FILES.reduce((s, f) => s + f.orig, 0);
    const opt = MOCK_FILES.reduce((s, f) => s + f.opt, 0);
    return { orig, opt, saved: orig - opt, pct: ((orig - opt) / orig) * 100 };
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const startOptimize = () => {
    setRunning(true);
    pushToast('Optimizing 12 files…', '5 workers');
    setTimeout(() => {
      setRunning(false);
      pushToast('Done · saved 8.4 MB', '76.4%');
    }, 1800);
  };

  const exportZip = () => {
    pushToast('Bundled oimg-export.zip', '2.6 MB');
  };

  const setCodecFromMenu = (c: CodecLabel) => {
    setCodec(c);
    pushToast('Output set to ' + c);
    setOpen(null);
  };

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
  ];

  const cmdFlat: (CmdItem & { group: string })[] = cmdGroups
    .flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))
    .filter((i) => !cmdkQ || i.label.toLowerCase().includes(cmdkQ.toLowerCase()));

  const isPopOpen = (key: string) => open === key;
  const togglePop = (key: string) => setOpen(open === key ? null : key);

  return (
    <div role="application" aria-label="OIMG Image Optimizer" className="app">
      {/* TITLE BAR */}
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
            <Popover open={isPopOpen('menu-codec')} onClose={() => setOpen(null)} style={{ minWidth: 220 }}>
              <div className="lbl">Output format</div>
              {CODECS.map((c) => (
                <div
                  key={c}
                  className={'pi check' + (codec === c ? ' on' : '')}
                  onClick={() => setCodecFromMenu(c)}
                >
                  <span className="mono">{c}</span>
                  <span className="kbd">{c[0]}</span>
                </div>
              ))}
              <div className="div" />
              <div
                className="pi"
                onClick={() => {
                  setOpen(null);
                  pushToast('Auto-optimizing…', 'butteraugli ≤ 1.4');
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
            <Popover open={isPopOpen('menu-view')} onClose={() => setOpen(null)}>
              {(['Batch', 'Compare', 'Report'] as View[]).map((v, i) => (
                <div
                  key={v}
                  className={'pi check' + (view === v ? ' on' : '')}
                  onClick={() => {
                    setView(v);
                    setOpen(null);
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
                  toggleTheme();
                  setOpen(null);
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
            <Popover open={isPopOpen('menu-help')} onClose={() => setOpen(null)}>
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
            onClick={() => setCmdkOpen(true)}
            aria-label="Open command palette"
          >
            <Icons.Search size={11} /> <span style={{ color: 'var(--fg-2)' }}>Search</span>
            <span className="kbd" style={{ marginLeft: 6 }}>⌘K</span>
          </button>
        </div>
      </header>

      {/* TOOLBAR */}
      <div role="toolbar" aria-label="Actions" className="toolbar">
        <button
          className={'tbtn primary' + (isPopOpen('add') ? ' open' : '')}
          onClick={() => togglePop('add')}
          style={{ position: 'relative' }}
        >
          <Icons.Upload size={13} /> Add files
          <Icons.ChevronDown size={9} />
          <Popover open={isPopOpen('add')} onClose={() => setOpen(null)}>
            <div className="pi" onClick={() => { setOpen(null); pushToast('File picker opened'); }}>
              <Icons.File size={13} /><span>From device…</span><span className="kbd">A</span>
            </div>
            <div className="pi" onClick={() => { setOpen(null); pushToast('Folder watcher started', '~/Downloads'); }}>
              <Icons.Layers size={13} /><span>Watch folder…</span>
            </div>
            <div className="pi" onClick={() => { setOpen(null); pushToast('Paste URL or data:image…'); }}>
              <Icons.Code size={13} /><span>From URL or paste</span><span className="kbd">⌘V</span>
            </div>
          </Popover>
        </button>

        <button className="tbtn" onClick={startOptimize} disabled={running}>
          {running ? <><Icons.Pause size={13} /> Optimizing…</> : <><Icons.Play size={13} /> Optimize all</>}
        </button>

        <button
          className={'tbtn' + (isPopOpen('export') ? ' open' : '')}
          onClick={() => togglePop('export')}
          style={{ position: 'relative' }}
        >
          <Icons.Download size={13} /> Export
          <Icons.ChevronDown size={9} />
          <Popover open={isPopOpen('export')} onClose={() => setOpen(null)} style={{ minWidth: 240 }}>
            <div className="pi" onClick={() => { setOpen(null); exportZip(); }}>
              <Icons.Layers size={13} /><span>All as ZIP</span><span className="kbd">⌘E</span>
            </div>
            <div className="pi" onClick={() => { setOpen(null); pushToast('Saved to ~/Downloads', '12 files'); }}>
              <Icons.Download size={13} /><span>Save individually</span>
            </div>
            <div className="div" />
            <div className="lbl">Code</div>
            <div className="pi" onClick={() => { setOpen(null); pushToast('Copied <picture> snippets', '12 files'); }}>
              <Icons.Code size={13} /><span>Copy &lt;picture&gt; HTML</span>
            </div>
            <div className="pi" onClick={() => { setOpen(null); pushToast('Copied as data URIs'); }}>
              <Icons.Code size={13} /><span>Copy as data URIs</span>
            </div>
          </Popover>
        </button>

        <div className="tdiv" />
        <div className="seg">
          {(['Batch', 'Compare', 'Report'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
        <div className="tdiv" />

        <div className="search">
          <Icons.Search size={12} />
          <input
            placeholder="Filter files…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          <span className="kbd" style={{ marginLeft: 4 }}>/</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <Tooltip label={theme === 'dark' ? 'Light theme' : 'Dark theme'} kbd="⌘⇧L">
            <button className="tbtn ghost" onClick={toggleTheme} aria-label="Toggle theme">
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
            <Popover open={isPopOpen('settings')} onClose={() => setOpen(null)} anchor="br" style={{ minWidth: 240 }}>
              <div className="lbl">Workers</div>
              <div className="pi"><span>Pool size</span><span className="kbd mono">5</span></div>
              <div className="pi"><span>WASM threading</span><span className="kbd">on</span></div>
              <div className="div" />
              <div className="lbl">Privacy</div>
              <div className="pi check on"><span>Strip metadata by default</span></div>
              <div className="pi check"><span>Telemetry</span></div>
            </Popover>
          </button>
        </div>
      </div>

      {/* WORK AREA */}
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
                    onClick={() => { setSortBy(s); setOpen(null); }}
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
                    e.preventDefault();
                    setRowMenu(f.id);
                    setSelectedId(f.id);
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
                        e.stopPropagation();
                        setRowMenu(rowMenu === f.id ? null : f.id);
                        setSelectedId(f.id);
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
                      <div className="pi" onClick={() => { setRowMenu(null); pushToast('Re-optimizing ' + f.name); }}>
                        <Icons.Play size={13} /><span>Re-optimize</span>
                      </div>
                      <div className="pi" onClick={() => { setRowMenu(null); pushToast('Saved ' + f.name); }}>
                        <Icons.Download size={13} /><span>Save as…</span>
                      </div>
                      <div className="pi" onClick={() => { setRowMenu(null); pushToast('Copied data URI'); }}>
                        <Icons.Copy size={13} /><span>Copy data URI</span>
                      </div>
                      <div className="pi" onClick={() => { setRowMenu(null); setTab('output'); }}>
                        <Icons.Code size={13} /><span>Copy &lt;picture&gt;</span>
                      </div>
                      <div className="div" />
                      <div className="pi danger" onClick={() => { setRowMenu(null); pushToast('Removed ' + f.name); }}>
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
                    e.preventDefault();
                    onSplitDrag();
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
                <div className="pi" onClick={() => { setOpen(null); pushToast('Settings copied to all files'); }}>
                  <Icons.Layers size={13} /><span>Apply to all files</span>
                </div>
                <div className="pi" onClick={() => { setOpen(null); pushToast('Saved as preset', '"WebP q82 1600w"'); }}>
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

      {/* STATUS BAR */}
      <footer role="contentinfo" className="statusbar">
        <span className="item">
          <span className={'pip' + (running ? '' : ' idle')}></span>
          {running ? '5 workers running' : '5 workers idle'}
        </span>
        <span className="item">SVGO 4.0.1</span>
        <span className="item">@squoosh-kit/core 0.6.0</span>
        <span className="item">WASM ready · 312 KB</span>
        <span className="item">12 files · 11.0 MB → 2.6 MB</span>
        <span className="right">
          avg compression {totals.pct.toFixed(1)}% · saved {fmtBytes(totals.saved)}
        </span>
      </footer>

      {/* TOASTS */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icons.Check size={13} />
            <span>{t.msg}</span>
            {t.meta && <span className="t-meta">{t.meta}</span>}
          </div>
        ))}
      </div>

      {/* COMMAND PALETTE */}
      {cmdkOpen && (
        <div className="cmdk-back" onMouseDown={() => setCmdkOpen(false)}>
          <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cmdk-input">
              <Icons.Search size={14} />
              <input
                autoFocus
                placeholder="Search commands, files, codecs…"
                value={cmdkQ}
                onChange={(e) => {
                  setCmdkQ(e.target.value);
                  setCmdkSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    setCmdkSel((s) => Math.min(cmdFlat.length - 1, s + 1));
                    e.preventDefault();
                  }
                  if (e.key === 'ArrowUp') {
                    setCmdkSel((s) => Math.max(0, s - 1));
                    e.preventDefault();
                  }
                  if (e.key === 'Enter') {
                    cmdFlat[cmdkSel]?.do?.();
                    setCmdkOpen(false);
                  }
                }}
              />
              <span className="kbd">esc</span>
            </div>
            <div className="cmdk-list">
              {cmdFlat.length === 0 && (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                  No results
                </div>
              )}
              {cmdFlat.map((it, i) => (
                <div
                  key={i}
                  className={'cmdk-item' + (i === cmdkSel ? ' sel' : '')}
                  onMouseEnter={() => setCmdkSel(i)}
                  onClick={() => {
                    it.do?.();
                    setCmdkOpen(false);
                  }}
                >
                  <span className="ic">{it.ic}</span>
                  <span>{it.label}</span>
                  <span className="meta">{it.group}{it.meta ? ' · ' + it.meta : ''}</span>
                </div>
              ))}
            </div>
            <div className="cmdk-foot">
              <span><span className="kbd">↑↓</span>navigate</span>
              <span><span className="kbd">↵</span>run</span>
              <span><span className="kbd">esc</span>close</span>
              <span style={{ marginLeft: 'auto' }}>{cmdFlat.length} commands</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
