// Phase 01-foundation / Plan 05 — SHELL-01 three-pane resizable layout
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FilesPane } from '@/components/panels/FilesPane'
import { CenterPane } from '@/components/panels/CenterPane'
import { InspectorPane } from '@/components/panels/InspectorPane'
import type { ReactNode } from 'react'

interface AppShellProps {
  children?: ReactNode
}

export function AppShell({ children: _children }: AppShellProps) {
  return (
    <div
      role="application"
      aria-label="OIMG Image Optimizer"
      className="dark h-screen w-screen flex flex-col overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-fg-0)]"
    >
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
          <FilesPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55}>
          <CenterPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
          <InspectorPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
