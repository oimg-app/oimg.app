import { useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { FilesPane } from '@/components/panels/FilesPane'
import { CenterPane } from '@/components/panels/CenterPane'
import { InspectorPane } from '@/components/panels/InspectorPane'
import { AppShell } from '@/components/shell/AppShell/AppShell'
import { TitleBar } from '@/components/shell/TitleBar/TitleBar'
import { Toolbar, ToolbarChange } from '@/components/shell/Toolbar/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar/StatusBar'
import { CommandPalette } from '@/components/shell/CommandPalette/CommandPalette'
import { useBatchOrchestrate } from '@/hooks/useBatchOrchestrate'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useTotals } from '@/hooks/useTotals'
import { setLiveRegion } from '@/lib/live-region'
import { useFilesStore, useSettingsStore, useRuntimeStore } from '@/stores'

export default function App() {
  // const { theme } = useTheme()
  const filesSelectedId = useFilesStore((s) => s.selectedId)
  const selectedId = filesSelectedId ?? ''
  const setSelectedId = (id: string) => useFilesStore.getState().setSelected(id)

  // const [view, setView] = useState<View>('Batch')
  // const [open, setOpen] = useState<string | null>(null)

  const { startOptimize, cancelBatch, running } = useBatchOrchestrate()

  // const codecLabel = useSettingsStore((s) => s.codec.label)
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

  const onToolbarChange = (_v: ToolbarChange) => pushToast('Use the + button in the file queue or drop files')

  const { cmdkOpen, setCmdkOpen, cmdGroups } = useCommandPalette({
    startOptimize, cancelBatch, running,
  })

  useKeyboardShortcuts({ startOptimize, cancelBatch, cmdkOpen, setCmdkOpen })

  return (
    <AppShell
      titleBar={<TitleBar />}
      toolbar={<Toolbar onChange={onToolbarChange} />}
      workArea={
        <main className="work">
          <FilesPane selectedId={selectedId || null} onSelect={setSelectedId} onOptimize={startOptimize} onCancel={cancelBatch} />
          <CenterPane />
          <InspectorPane />
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
