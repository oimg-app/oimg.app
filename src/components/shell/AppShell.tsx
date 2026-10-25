// Phase 01-foundation / Plan 05 — SHELL-01 three-pane resizable layout
// Phase 03 — NAV-02/NAV-03: Toolbar + StatusBar mounted. Source: 03-01-PLAN.md
// Phase 03 — SHELL-03: data-theme effect + ⌘K/Escape keydown listener + CommandPalette. Source: 03-03-PLAN.md
// Phase 07-polish — SHELL-02 + data-theme. Source: 07-01-PLAN.md
// change:remove-dead-ui-and-fix-a11y — role="application" dropped (it suppressed screen-reader browse mode);
//   below 900 px the panes render one at a time behind a Files / Preview / Settings tablist (design D8).
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FilesPane, CenterPane, InspectorPane } from '@/components/panels'
import { Toolbar, StatusBar, TitleBar, CommandPalette } from '@/components/shell'
import { uiAtom, openCmdk, closeCmdk, setOpen, setMobilePane, type MobilePane } from '@/stores/ui'
import { useNarrowViewport } from '@/hooks/useNarrowViewport'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { theme, panes, mobilePane } = useStore(uiAtom)
  const narrow = useNarrowViewport()

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
      data-testid="app-shell"
      className={cn(
        theme === 'dark' && 'dark',
        'h-screen w-full flex flex-col overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-fg-0)]',
      )}
    >
      <TitleBar />
      <Toolbar />
      {narrow ? <NarrowPanes active={mobilePane} /> : (<>
      {/* View menu drives per-pane visibility. Handles are only rendered *between*
          two visible panels — hiding a middle pane collapses the two flanking panels
          together with a fresh handle between them (rather than an orphaned divider).
          `key` on the panel group forces react-resizable-panels to reset stored sizes
          when the pane set changes (its layout persistence keys on stable child order). */}
      <ResizablePanelGroup
        key={`${panes.batch}-${panes.compare}-${panes.inspector}`}
        orientation="horizontal"
        className="flex-1 min-h-0"
      >
        {panes.batch && (
          <ResizablePanel defaultSize="20%" minSize="10%">
            <FilesPane />
          </ResizablePanel>
        )}
        {panes.batch && panes.compare && <ResizableHandle withHandle aria-label="Resize files and preview panes" />}
        {panes.compare && (
          <ResizablePanel defaultSize="55%">
            <CenterPane />
          </ResizablePanel>
        )}
        {panes.compare && panes.inspector && <ResizableHandle withHandle aria-label="Resize preview and settings panes" />}
        {/* If Compare is hidden but both Batch and Inspector are on, we need a handle
            directly between them so they stay independently resizable. */}
        {!panes.compare && panes.batch && panes.inspector && <ResizableHandle withHandle aria-label="Resize files and settings panes" />}
        {panes.inspector && (
          <ResizablePanel defaultSize="25%">
            <InspectorPane />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
      </>)}
      <StatusBar />
      <CommandPalette />
    </div>
  )
}

const MOBILE_TABS: Array<{ id: MobilePane; label: string }> = [
  { id: 'files', label: 'Files' },
  { id: 'preview', label: 'Preview' },
  { id: 'settings', label: 'Settings' },
]

// WAI-ARIA tabs: one tab stop, Left/Right/Home/End move between tabs and activate them.
function NarrowPanes({ active }: { active: MobilePane }) {
  const ids = MOBILE_TABS.map((t) => t.id)
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = ids.indexOf(active)
    const next =
      e.key === 'ArrowRight' ? ids[(i + 1) % ids.length]
      : e.key === 'ArrowLeft' ? ids[(i - 1 + ids.length) % ids.length]
      : e.key === 'Home' ? ids[0]
      : e.key === 'End' ? ids[ids.length - 1]
      : null
    if (!next) return
    e.preventDefault()
    setMobilePane(next)
    e.currentTarget.querySelector<HTMLElement>(`#mobile-tab-${next}`)?.focus()
  }
  return (
    <>
      <div
        role="tablist"
        aria-label="Panes"
        data-testid="mobile-pane-tabs"
        onKeyDown={onKeyDown}
        className="flex shrink-0 border-b border-[var(--color-line)] bg-color-bg-1"
      >
        {MOBILE_TABS.map((t) => (
          <button
            key={t.id}
            id={`mobile-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            aria-controls="mobile-pane-panel"
            tabIndex={active === t.id ? 0 : -1}
            data-testid={`mobile-tab-${t.id}`}
            onClick={() => setMobilePane(t.id)}
            className={cn(
              'flex-1 h-10 text-xs font-semibold border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
              active === t.id
                ? 'border-[var(--color-accent)] text-[var(--color-fg-0)]'
                : 'border-transparent text-[var(--color-fg-2)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id="mobile-pane-panel"
        role="tabpanel"
        aria-labelledby={`mobile-tab-${active}`}
        className="flex-1 min-h-0 overflow-auto"
      >
        {active === 'files' && <FilesPane />}
        {active === 'preview' && <CenterPane />}
        {active === 'settings' && <InspectorPane />}
      </div>
    </>
  )
}
