// Phase 01-foundation / Plan 05 — SHELL-01 three-pane resizable layout
// Phase 03 — NAV-02/NAV-03: Toolbar + StatusBar mounted. Source: 03-01-PLAN.md
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

export function AppShell() {
  return (
    <div
      role="application"
      aria-label="OIMG Image Optimizer"
      className="dark h-screen w-screen flex flex-col overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-fg-0)]"
    >
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
    </div>
  )
}
