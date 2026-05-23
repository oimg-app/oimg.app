// Phase 01-foundation / Plan 05 — SHELL-01 three-pane resizable layout
// Phase 03 — NAV-02/NAV-03: Toolbar + StatusBar mounted. Source: 03-01-PLAN.md
// Phase 03 — SHELL-03: data-theme effect + ⌘K/Escape keydown listener + CommandPalette. Source: 03-03-PLAN.md
// Phase 07-polish — SHELL-02 + data-theme. Source: 07-01-PLAN.md
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FilesPane } from '@/components/panels/FilesPane'
import { CenterPane } from '@/components/panels/CenterPane'
import { InspectorPane } from '@/components/panels/InspectorPane'
import { Toolbar } from '@/components/shell/Toolbar/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar/StatusBar'
import { TitleBar } from '@/components/shell/TitleBar/TitleBar'
import { CommandPalette } from '@/components/shell/CommandPalette/CommandPalette'
import { BackpressureIndicator } from '@/components/shell/BackpressureIndicator/BackpressureIndicator'
import { uiAtom, openCmdk, closeCmdk, setOpen } from '@/stores/ui'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { theme } = useStore(uiAtom)

  // SHELL-03: toggle html.dark class to match uiAtom.theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // NAV-04: global ⌘K / Ctrl+K opens palette; Escape closes palette + any open popover
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openCmdk()
        return
      }
      if (e.key === 'Escape') {
        closeCmdk()
        setOpen(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      role="application"
      aria-label="OIMG Image Optimizer"
      className={cn(
        theme === 'dark' && 'dark',
        'h-screen w-screen flex flex-col overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-fg-0)]',
      )}
    >
      <TitleBar />
      <Toolbar />
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize="20%" minSize="10%">
          <FilesPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="55%">
          <CenterPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="25%">
          <InspectorPane />
        </ResizablePanel>
      </ResizablePanelGroup>
      <StatusBar />
      <CommandPalette />
      <BackpressureIndicator />
    </div>
  )
}
