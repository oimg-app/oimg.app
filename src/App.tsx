import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { FilesPane } from '@/components/panels/FilesPane'
import { CenterPane } from '@/components/panels/CenterPane'
import { InspectorPane } from '@/components/panels/InspectorPane'
import { AppShell } from '@/components/shell/AppShell/AppShell'
import { TitleBar } from '@/components/shell/TitleBar/TitleBar'
import { Toolbar, ToolbarChange } from '@/components/shell/Toolbar/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar/StatusBar'
import { CommandPalette } from '@/components/shell/CommandPalette/CommandPalette'
import { useTheme } from '@/hooks/useTheme'
import { useBatchOrchestrate } from '@/hooks/useBatchOrchestrate'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCommandPalette, type View } from '@/hooks/useCommandPalette'
import { useTotals } from '@/hooks/useTotals'
import { setLiveRegion } from '@/lib/live-region'
import type { CodecLabel, MockFile } from '@/types'
import { useFilesStore, useSettingsStore, useRuntimeStore } from '@/stores'

const EMPTY_FILE: MockFile = { id: 'placeholder', name: 'No file selected', type: 'png', orig: 0, opt: 0, status: 'queued', target: 'webp', dim: '— × —', q: null }
const fmtToType = (fmt: string): MockFile['type'] => fmt === 'jpeg' ? 'jpg' : (fmt as MockFile['type'])

export default function App() {
  const { theme, setTheme } = useTheme()
  const filesSelectedId = useFilesStore((s) => s.selectedId)
  const selectedId = filesSelectedId ?? ''
  const setSelectedId = (id: string) => useFilesStore.getState().setSelected(id)

  const [view, setView] = useState<View>('Batch')
  const [open, setOpen] = useState<string | null>(null)

  const { startOptimize, cancelBatch, running } = useBatchOrchestrate()

  const codecLabel = useSettingsStore((s) => s.codec.label)
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

  const totals = useTotals()

  const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)
  const file: MockFile = selectedEntry
    ? { id: selectedEntry.id, name: selectedEntry.name, type: fmtToType(selectedEntry.format), orig: selectedEntry.originalSize, opt: selectedEntry.optimizedSize ?? selectedEntry.originalSize, status: selectedEntry.status === 'idle' ? 'queued' : (selectedEntry.status as MockFile['status']), target: fmtToType(selectedEntry.format), dim: '—', q: null }
    : EMPTY_FILE

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const exportZip = () => toast.success('Bundled oimg-export.zip', { description: '2.6 MB' })
  const setCodecFromMenu = (c: CodecLabel) => { useSettingsStore.getState().setCodec({ label: c }); pushToast('Output set to ' + c); setOpen(null) }
  const onToolbarChange = (_v: ToolbarChange) => pushToast('Use the + button in the file queue or drop files')

  const { cmdkOpen, setCmdkOpen, cmdGroups } = useCommandPalette({
    startOptimize, cancelBatch, running, exportZip, pushToast,
    theme, toggleTheme, setView, setOpen, setCodecFromMenu,
  })

  const [_rowMenu, setRowMenu] = useState<string | null>(null)
  useKeyboardShortcuts({ startOptimize, cancelBatch, cmdkOpen, setCmdkOpen, setOpen, setRowMenu })

  return (
    <AppShell
      titleBar={<TitleBar theme={theme} onToggleTheme={toggleTheme} openKey={open} onOpenKey={setOpen} codec={codecLabel} onSelectCodec={setCodecFromMenu} view={view} onSetView={setView} onToast={pushToast} onOpenCommandPalette={() => setCmdkOpen(true)} />}
      toolbar={<Toolbar running={running} onStartOptimize={startOptimize} onExportZip={exportZip} view={view} onSetView={setView} filterQuery={''} onSetFilterQuery={() => {}} theme={theme} onToggleTheme={toggleTheme} openKey={open} onOpenKey={setOpen} onToast={pushToast} onChange={onToolbarChange} />}
      workArea={
        <main className="work">
          <FilesPane selectedId={selectedId || null} onSelect={setSelectedId} onOptimize={startOptimize} onCancel={cancelBatch} />
          <CenterPane open={open} setOpen={setOpen} />
          <InspectorPane file={file} selectedId={selectedId} open={open} setOpen={setOpen} onToast={pushToast} />
        </main>
      }
      statusBar={<StatusBar running={running} filesCount={totals.filesCount} origTotal={totals.orig} optTotal={totals.opt} compressionPct={totals.pct} savedBytes={totals.saved} />}
      overlays={<>
        <div ref={(el) => setLiveRegion(el)} role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }} />
        <Toaster position="bottom-right" />
        <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} groups={cmdGroups} />
      </>}
    />
  )
}
