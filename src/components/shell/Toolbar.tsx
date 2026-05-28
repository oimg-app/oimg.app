// Phase 03 — NAV-02 (full NAV-02: split buttons, segmented control, filter, theme toggle, settings). Source: 03-02-PLAN.md
// Phase 10 — Plan 04: Add files + From device → openPicker via useIngest. Source: 10-04-PLAN.md
import { useStore } from '@nanostores/react'
import { Plus, Export, CaretDown, MagnifyingGlass, Sun, Moon, GearSix, Lightning } from '@phosphor-icons/react'
import { uiAtom, setOpen, setView, setTheme, setAutoTarget } from '@/stores/ui'
import type { View } from '@/stores/ui'
import { filesAtom, setFilter, addWatchFolder, addFromUrl, exportAsZip, exportIndividually, exportCopyHtml, exportCopyDataUris, exportManifestJson } from '@/stores/files'
import { setWorkerCount } from '@/stores/runtime'
import { useOptimize } from '@/hooks/useOptimize'
import { useIngest } from '@/hooks/useIngest'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const tbtnClass =
  'h-7 px-3 text-xs text-[var(--color-fg-0)] bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px] hover:bg-[var(--color-bg-3)] hover:border-[var(--color-line-strong)] flex items-center gap-1'

const menuItemClass =
  'w-full px-3 py-1.5 text-left text-xs text-[var(--color-fg-0)] hover:bg-[var(--color-bg-3)] rounded'

const popoverContentClass =
  'w-auto p-2 bg-[var(--color-bg-2)] border-[var(--color-line)] rounded-[6px]'

function ToolbarDivider() {
  return <div aria-hidden="true" className="w-px h-[18px] bg-[var(--color-line)] mx-1" />
}

export function Toolbar() {
  const { open, view, theme } = useStore(uiAtom)
  const { filterQuery } = useStore(filesAtom)
  const { runOptimize } = useOptimize()
  const { openPicker } = useIngest()

  return (
    <div
      data-testid="toolbar"
      role="toolbar"
      aria-label="Primary toolbar"
      className="h-11 bg-[var(--color-bg-1)] border-b border-[var(--color-line)] px-2 flex items-center gap-2 shrink-0"
    >
      {/* 1. Add files split group */}
      <div className="flex">
        <button
          type="button"
          className={cn(tbtnClass, 'rounded-r-none border-r-0')}
          onClick={() => { openPicker(); setOpen(null) }}
        >
          <Plus size={12} />
          Add files
        </button>
        <Popover
          open={open === 'tb-add'}
          onOpenChange={(o) => setOpen(o ? 'tb-add' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add files options"
              className={cn(tbtnClass, 'rounded-l-none px-1.5')}
            >
              <CaretDown size={11} />
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <button type="button" className={menuItemClass} onClick={() => { openPicker(); setOpen(null) }}>From device</button>
              <button type="button" className={menuItemClass} onClick={() => { addWatchFolder(); setOpen(null) }}>Watch folder</button>
              <button type="button" className={menuItemClass} onClick={() => { addFromUrl(); setOpen(null) }}>From URL or paste</button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 2. Optimize all primary button (UNCHANGED from Plan 01) */}
      <button
        type="button"
        onClick={runOptimize}
        className="h-7 px-3 text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent rounded-[5px] hover:brightness-105 flex items-center gap-1"
      >
        <Lightning size={13} />
        Optimize all
      </button>

      {/* 3. Export split group */}
      <div className="flex">
        <button
          type="button"
          className={cn(tbtnClass, 'rounded-r-none border-r-0')}
          onClick={() => { exportAsZip(); setOpen(null) }}
        >
          <Export size={12} />
          Export
        </button>
        <Popover
          open={open === 'tb-export'}
          onOpenChange={(o) => setOpen(o ? 'tb-export' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Export options"
              className={cn(tbtnClass, 'rounded-l-none px-1.5')}
            >
              <CaretDown size={11} />
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <button type="button" className={menuItemClass} onClick={() => { exportAsZip(); setOpen(null) }}>All as ZIP</button>
              <button type="button" className={menuItemClass} onClick={() => { exportIndividually(); setOpen(null) }}>Save individually</button>
              <button type="button" className={menuItemClass} onClick={() => { exportCopyHtml(); setOpen(null) }}>{'Copy <picture> HTML'}</button>
              <button type="button" className={menuItemClass} onClick={() => { exportCopyDataUris(); setOpen(null) }}>Copy as data URIs</button>
              <button type="button" className={menuItemClass} onClick={() => { exportManifestJson(); setOpen(null) }}>Manifest JSON</button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 4. Toolbar divider */}
      <ToolbarDivider />

      {/* 5. Segmented control: Batch / Compare / Report */}
      <div role="group" aria-label="Switch view" className="flex h-7 bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px]">
        {(['Batch', 'Compare', 'Report'] as View[]).map((v, i) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            onClick={() => setView(v)}
            className={cn(
              'px-3 text-xs rounded-[4px]',
              i > 0 && 'border-l border-[var(--color-line)]',
              view === v
                ? 'bg-[var(--color-bg-3)] text-[var(--color-fg-0)]'
                : 'text-[var(--color-fg-1)]'
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* 6. Auto split group */}
      <div className="flex">
        <button
          type="button"
          className={cn(tbtnClass, 'rounded-r-none border-r-0')}
          onClick={() => { setAutoTarget(1.4); setOpen(null) }}
        >
          Auto
        </button>
        <Popover
          open={open === 'tb-auto'}
          onOpenChange={(o) => setOpen(o ? 'tb-auto' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Auto mode options"
              className={cn(tbtnClass, 'rounded-l-none px-1.5')}
            >
              <CaretDown size={11} />
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <button type="button" className={menuItemClass} onClick={() => { setAutoTarget(1.4); setOpen(null) }}>1.4 balanced</button>
              <button type="button" className={menuItemClass} onClick={() => { setAutoTarget(1.0); setOpen(null) }}>1.0 high quality</button>
              <button type="button" className={menuItemClass} onClick={() => { setAutoTarget(2.0); setOpen(null) }}>2.0 aggressive</button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 7. Toolbar divider */}
      <ToolbarDivider />

      {/* 8. Filter input */}
      <div className="flex items-center h-7 min-w-[220px] bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px] px-2 gap-2 focus-within:border-[var(--color-accent)]">
        <MagnifyingGlass size={12} className="text-[var(--color-fg-2)] shrink-0" />
        <input
          type="search"
          aria-label="Filter files"
          placeholder="Filter files…"
          value={filterQuery}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 bg-transparent text-xs text-[var(--color-fg-0)] placeholder:text-[var(--color-fg-2)] outline-none focus-visible:outline-none"
        />
      </div>

      {/* 9. Spacer + theme toggle */}
      <div className="ml-auto" />
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="h-7 w-7 grid place-items-center rounded-[5px] text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)]"
      >
        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
      </button>

      {/* 10. Settings ghost button + Popover */}
      <Popover
        open={open === 'tb-settings'}
        onOpenChange={(o) => setOpen(o ? 'tb-settings' : null)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open settings"
            className="h-7 w-7 grid place-items-center rounded-[5px] text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)]"
          >
            <GearSix size={13} />
          </button>
        </PopoverTrigger>
        <PopoverContent className={popoverContentClass} align="end">
          <div className="flex flex-col">
            <button type="button" className={menuItemClass} onClick={() => { setWorkerCount(4); setOpen(null) }}>Workers: 4 (auto)</button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
