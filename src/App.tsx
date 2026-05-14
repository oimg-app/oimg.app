import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { listenKeys } from 'nanostores'
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
import {
  filesStore,
  setSelected,
  addFile,
  addSourceWithVariants,
  removeFamily,
  setStatus,
  markDone as filesMarkDone,
  clear as filesclear,
} from '@/stores/files'
import { settingsStore, setPerFileCodec } from '@/stores/settings'
import { runtimeStore, enqueuePreview, getOrCreateObjectURL } from '@/stores/runtime'

export default function App() {
  const { selectedId: filesSelectedId } = useStore(filesStore)
  const selectedId = filesSelectedId ?? ''
  const setSelectedId = (id: string) => setSelected(id)

  const { startOptimize, cancelBatch, running } = useBatchOrchestrate()

  const pushToast = (msg: string, meta?: string) => meta ? toast(msg, { description: meta }) : toast(msg)

  // Dev-only store exposure for Playwright.
  // Exposes nanostores maps AND compatibility shims so test files written
  // against the old zustand getState() API continue to work.
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Action bundles — exposed as getState() return value for test compatibility.
      // Getters forward to live store values so tests reading store state see current data.
      const filesActions = {
        get: () => filesStore.get(),
        addFile,
        addSourceWithVariants,
        removeFamily,
        clear: filesclear,
        setSelected,
        setStatus,
        markDone: filesMarkDone,
        get selectedId() { return filesStore.get().selectedId },
        get byId() { return filesStore.get().byId },
        get order() { return filesStore.get().order },
        get filterQuery() { return filesStore.get().filterQuery },
      }
      const runtimeActions = {
        get: () => runtimeStore.get(),
        get running() { return runtimeStore.get().running },
        get urlCache() { return runtimeStore.get().urlCache },
        get renameCountThisBatch() { return runtimeStore.get().renameCountThisBatch },
        get doneCount() { return runtimeStore.get().doneCount },
        get totalJobs() { return runtimeStore.get().totalJobs },
        get errorCount() { return runtimeStore.get().errorCount },
        getOrCreateObjectURL,
        setState: (patch: Record<string, unknown>) => runtimeStore.set({ ...runtimeStore.get(), ...patch } as ReturnType<typeof runtimeStore.get>),
      }
      const settingsActions = {
        get: () => settingsStore.get(),
        get resize() { return settingsStore.get().resize },
        get global() { return settingsStore.get().global },
        get svg() { return settingsStore.get().svg },
        get jpeg() { return settingsStore.get().jpeg },
        get webp() { return settingsStore.get().webp },
        get avif() { return settingsStore.get().avif },
        get png() { return settingsStore.get().png },
        get perFile() { return settingsStore.get().perFile },
        setResize: (patch: Partial<{ alg: string }>) => {
          const cur = settingsStore.get()
          settingsStore.setKey('resize', { ...cur.resize, ...patch } as { alg: import('@/types').ResizeAlg })
        },
        setPerFileCodec,
      }
      const filesProxy = Object.assign(Object.create(filesStore as object), {
        getState: () => filesActions,
        get: () => filesStore.get(),
      })
      const settingsProxy = Object.assign(Object.create(settingsStore as object), {
        getState: () => settingsActions,
        get: () => settingsStore.get(),
      })
      const runtimeProxy = Object.assign(Object.create(runtimeStore as object), {
        getState: () => runtimeActions,
        get: () => runtimeStore.get(),
        setState: (patch: Record<string, unknown>) => runtimeStore.set({ ...runtimeStore.get(), ...patch } as ReturnType<typeof runtimeStore.get>),
      })
      ;(window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ = {
        files: filesProxy,
        settings: settingsProxy,
        runtime: runtimeProxy,
      }
    }
  }, [])

  // Plugin-change subscriber — fires live preview for selected SVG file.
  useEffect(() => {
    return listenKeys(settingsStore, ['svg'], () => {
      const fs = filesStore.get()
      const id = fs.selectedId
      if (!id) return
      if (fs.byId[id]?.format !== 'svg') return
      enqueuePreview(id)
    })
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
      toolbar={<Toolbar onChange={onToolbarChange} onOptimize={startOptimize} />}
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
