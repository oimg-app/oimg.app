// AppShell — outermost layout component.
// Owns the role="application" landmark and renders the 4-row CSS grid.
// Plan 01-04: titleBar/toolbar/statusBar slots already render their own
// <header>/<div role="toolbar">/<footer>, so AppShell does not double-wrap.
// Quick task 260505-0hr — Task 3: grid rule moved from legacy.css into
// co-located appShell.module.css; consumed via `s.app`.

import type { ReactNode } from 'react'
import s from './appShell.module.css'

interface AppShellProps {
  titleBar: ReactNode
  toolbar: ReactNode
  workArea: ReactNode // the entire <main className="work">…</main>
  statusBar: ReactNode
  overlays?: ReactNode // toasts + command palette mount here, outside the grid
}

export function AppShell({ titleBar, toolbar, workArea, statusBar, overlays }: AppShellProps) {
  return (
    <div role="application" aria-label="OIMG Image Optimizer" className={s.app}>
      {titleBar}
      {toolbar}
      {workArea}
      {statusBar}
      {overlays}
    </div>
  )
}
