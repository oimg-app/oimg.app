// AppShell — outermost layout component.
// Owns the role="application" landmark and renders the 4-row CSS grid by
// virtue of className="app" (the grid template lives in src/index.css).
// Plan 01-04: titleBar/toolbar/statusBar slots already render their own
// <header>/<div role="toolbar">/<footer>, so AppShell does not double-wrap.

import type { ReactNode } from 'react'

interface AppShellProps {
  titleBar: ReactNode
  toolbar: ReactNode
  workArea: ReactNode // the entire <main className="work">…</main>
  statusBar: ReactNode
  overlays?: ReactNode // toasts + command palette mount here, outside the grid
}

export function AppShell({ titleBar, toolbar, workArea, statusBar, overlays }: AppShellProps) {
  return (
    <div role="application" aria-label="OIMG Image Optimizer" className="app">
      {titleBar}
      {toolbar}
      {workArea}
      {statusBar}
      {overlays}
    </div>
  )
}
