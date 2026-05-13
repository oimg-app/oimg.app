// Toolbar — 44px action bar.
// Extracted from src/App.tsx (lines 336–430) in plan 01-04.
// Owns: Add files / Optimize / Export buttons, view segmented control,
// search input, theme toggle, settings popover.
// Quick task 260505-0hr — Task 5: classes migrated to toolbar.module.css.
// Shared `.tbtn` / `.seg` flow through composes from primitives.module.css;
// `.toolbar`, `.tdiv`, `.search` live private. Popover-internal classes
// (.pi / .lbl / .div / .check / .kbd / .mono) remain global until Popover's
// own module migration. role="toolbar" still asserted by shell.spec.ts.
//
// Phase 2 (plan 02-04): Toolbar subscribes directly to useRuntimeStore
// (D-09 narrow selectors) so the Workers pill + Optimize button reflect
// the live worker pool state. App.tsx still owns batch orchestration —
// onStartOptimize stays as a callback prop.

import clsx from 'clsx'
import { Icons } from '@/components/icons'
import { Popover } from '@/components/ui/Popover'
import { Tooltip } from '@/components/ui/Tooltip'
import { useStore } from '@nanostores/react'
import { runtimeStore, optimizeAll, exportFiles } from '@/stores/runtime'
import { filesStore } from '@/stores/files'
import { settingsStore, setView } from '@/stores/settings'
import s from './toolbar.module.css'
import {useState} from "react";
import type { ExportType } from "@/stores/runtime.ts";
import {useTheme} from "@/hooks/useTheme.ts";

export type ToolbarChange = 'from-device' | 'from-url' | 'from-clipboard' | 'file-watcher'

type AddFilesButtonProps = {
  onChange: (v: ToolbarChange) => void
}

const AddFilesButton = (props: AddFilesButtonProps) => {
  const {onChange} = props
  const [openKey, setOpen] = useState<string | null>(null)
  const [showUrlModal, setShowUrlModal] = useState(false)

  const isPopOpen = (key: string) => openKey === key
  const togglePop = (key: string) => setOpen(openKey === key ? null : key)

  const urlModal = (
      <Popover open={showUrlModal} onClose={() => setShowUrlModal(false)} anchor="br" style={{minWidth: 240}}>
        <div className="lbl">Code</div>
        <div className="pi" onClick={() => {
          setShowUrlModal(false);
          // @T
        }}>
          <Icons.Code size={13}/><span>Copy &lt;picture&gt; HTML</span>
        </div>
        <div className="pi" onClick={() => {
          setShowUrlModal(false);
          // @T
        }}>
          <Icons.Code size={13}/><span>Copy as data URIs</span>
        </div>
      </Popover>
  )

  return (
      <>
        <button
            className={clsx(s.tbtn, s.tbtnPrimary, isPopOpen('add') && s.tbtnPrimaryOpen)}
            onClick={() => togglePop('add')}
            style={{position: 'relative'}}
        >
          <Icons.Upload size={13}/> Add files
          <Icons.ChevronDown size={9}/>
          <Popover open={isPopOpen('add')} onClose={() => setOpen(null)}>
            <div className="pi" onClick={() => {
              onChange('from-device');
              setOpen(null);
            }}>
              <Icons.File size={13}/><span>From device…</span><span className="kbd">A</span>
            </div>
            <div className="pi" onClick={() => {
              setOpen(null);
              onChange('file-watcher');
            }}>
              <Icons.Layers size={13}/><span>Watch folder…</span>
            </div>
            <div className="pi" onClick={() => {
              setOpen(null);
              // @T
            }}>
              <Icons.Code size={13}/><span>From URL or paste</span><span className="kbd">⌘V</span>
            </div>
          </Popover>
        </button>
        {urlModal}
      </>
  )
}

const ExportButton = () => {
    const [openKey, setOpen] = useState<string | null>(null)
    const isPopOpen = (key: string) => openKey === key
    const togglePop = (key: string) => setOpen(openKey === key ? null : key)

    const onExport = (type: ExportType) => {
        exportFiles(type)
    }

    return (
        <button
            className={clsx(s.tbtn, isPopOpen('export') && s.tbtnOpen)}
            onClick={() => togglePop('export')}
            style={{position: 'relative'}}
        >
            <Icons.Download size={13}/> Export
            <Icons.ChevronDown size={9}/>
            <Popover open={isPopOpen('export')} onClose={() => setOpen(null)} style={{minWidth: 240}}>
                <div className="pi" onClick={() => {
                    setOpen(null);
                    onExport('zip')
                }}>
                    <Icons.Layers size={13}/><span>All as ZIP</span><span className="kbd">⌘E</span>
                </div>
                <div className="pi" onClick={() => {
                    setOpen(null);
                    onExport('individual')
                }}>
                    <Icons.Download size={13}/><span>Save individually</span>
                </div>
                <div className="div"/>
                <div className="lbl">Code</div>
                <div className="pi" onClick={() => {
                    setOpen(null);
                    onExport('snippets')
                }}>
                    <Icons.Code size={13}/><span>Copy &lt;picture&gt; HTML</span>
                </div>
                <div className="pi" onClick={() => {
                    setOpen(null);
                    onExport('data-uris')
                }}>
                    <Icons.Code size={13}/><span>Copy as data URIs</span>
                </div>
            </Popover>
        </button>
    )
}

const ViewSegmentedControl = () => {
    const { views, view } = useStore(settingsStore)

    return (
        <div className={s.seg}>
            {views.map((v) => (
                <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                    {v}
                </button>
            ))}
        </div>
    )
}

const WorkersStatus = () => {
    const { running, inFlight, poolSize, errorCount } = useStore(runtimeStore)
    const busy = inFlight.size

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
        <div className={pillClass} aria-label={pillAria} role="status" aria-live="off">
            <span style={{fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums'}}>{pillCopy}</span>
        </div>
    )
}

const OptimizeButton = () => {
    const { running } = useStore(runtimeStore)
    const { order } = useStore(filesStore)
    const hasNoFiles = order.length === 0

    return (
        <button className={s.tbtn} onClick={optimizeAll} disabled={running || hasNoFiles}>
            {running ? <><Icons.Pause size={13}/> Optimizing…</> : <><Icons.Play size={13}/> Optimize all</>}
        </button>
    )
}

const SearchField = () => {
    const { filterQuery } = useStore(filesStore)

    return (
        <div className={s.search}>
            <Icons.Search size={12}/>
            <input
                placeholder="Filter files…"
                value={filterQuery}
                onChange={(e) => {
                    filesStore.setKey('filterQuery', e.target.value)
                }}
            />
            <span className="kbd" style={{marginLeft: 4}}>/</span>
        </div>
    )
}

const SettingsButton = () => {
    const [openKey, setOpen] = useState<string | null>(null)
    const isPopOpen = (key: string) => openKey === key
    const togglePop = (key: string) => setOpen(openKey === key ? null : key)
    const { poolSize } = useStore(runtimeStore)

    return (
        <button
            className={clsx(s.tbtn, s.tbtnGhost, isPopOpen('settings') && s.tbtnOpen)}
            onClick={() => togglePop('settings')}
            style={{position: 'relative'}}
            aria-label="Settings"
        >
            <Icons.Settings size={13}/>
            <Popover open={isPopOpen('settings')} onClose={() => setOpen(null)} anchor="br" style={{minWidth: 240}}>
                <div className="lbl">Workers</div>
                <div className="pi"><span>Pool size</span><span className="kbd mono">{poolSize}</span></div>
                <div className="pi"><span>WASM threading</span><span className="kbd">on</span></div>
                <div className="div"/>
                <div className="lbl">Privacy</div>
                <div className="pi check on"><span>Strip metadata by default</span></div>
                <div className="pi check"><span>Telemetry</span></div>
            </Popover>
        </button>
    )
}

const ThemeToggleButton = () => {
    const { theme, setTheme } = useTheme()
    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    return (
        <Tooltip label={theme === 'dark' ? 'Light theme' : 'Dark theme'} kbd="⌘⇧L">
            <button className={clsx(s.tbtn, s.tbtnGhost)} onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />}
            </button>
        </Tooltip>
    )
}

const ToolbarDivider = () => {
    return <div className={s.tdiv}/>
}

interface ToolbarProps {
    onChange: (v: ToolbarChange) => void
}

export function Toolbar(props: ToolbarProps) {
    const {
        onChange,
    } = props

  return (
    <div role="toolbar" aria-label="Actions" className={s.toolbar}>
      <AddFilesButton onChange={onChange} />

      <OptimizeButton />

      <ExportButton />

      <ToolbarDivider />
      <ViewSegmentedControl />
      <ToolbarDivider />
      <WorkersStatus />
      <SearchField />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
           <ThemeToggleButton />
          <SettingsButton />
      </div>
    </div>
  )
}
