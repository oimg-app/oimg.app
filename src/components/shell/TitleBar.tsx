// Phase 03 — NAV-01: TitleBar with brand mark, Codec/View/Help menus, pills, ⌘K button. Source: 03-02-PLAN.md
// Phase 07-polish — WCAG AA: menus migrated Popover→DropdownMenu for arrow-key navigation.
import { useStore } from '@nanostores/react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { uiAtom, setOpen, setView, setTheme, openCmdk, selectCodec, openDocs, openShortcuts, openChangelog } from '@/stores/ui'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'

const menuItemClass =
  'px-3 py-1.5 text-xs text-[var(--color-fg-0)] rounded cursor-pointer flex items-center justify-between focus:bg-[var(--color-bg-3)] data-[highlighted]:bg-[var(--color-bg-3)]'

function MenuItem({ label, shortcut, onSelect }: { label: string; shortcut?: string; onSelect?: () => void }) {
  return (
    <DropdownMenuItem className={menuItemClass} onSelect={onSelect}>
      {label}
      {shortcut && (
        <Kbd className="ml-2 text-[11px] font-mono font-semibold">{shortcut}</Kbd>
      )}
    </DropdownMenuItem>
  )
}

export function TitleBar() {
  const { open } = useStore(uiAtom)

  const triggerClass =
    'px-2 py-1 rounded text-xs text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)] data-[state=open]:bg-[var(--color-bg-2)] data-[state=open]:text-[var(--color-fg-0)]'

  const menuContentClass =
    'w-auto min-w-0 p-2 bg-[var(--color-bg-2)] text-[var(--color-fg-0)] border border-[var(--color-line)] rounded-[6px] ring-0 shadow-md'

  return (
    <header
      data-testid="titlebar"
      role="banner"
      className="h-9 bg-[var(--color-bg-1)] border-b border-[var(--color-line)] px-3 flex items-center shrink-0"
    >
      {/* Left cluster: brand mark + menus left-aligned together */}
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1.5 mr-2">
          <span
            aria-hidden="true"
            className="w-3 h-3 inline-block bg-[var(--color-accent)]"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 60% 100%, 0 100%)' }}
          />
          <span className="font-mono text-xs font-semibold tracking-[0.04em] text-[var(--color-fg-0)]">
            OIMG · image optimizer
          </span>
        </span>

        {/* Codec menu */}
        <DropdownMenu modal={false} open={open === 'menu-codec'} onOpenChange={(o) => setOpen(o ? 'menu-codec' : null)}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerClass}>Codec</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuContentClass}>
            <MenuItem label="WebP" onSelect={() => selectCodec('webp')} />
            <MenuItem label="AVIF" onSelect={() => selectCodec('avif')} />
            <MenuItem label="JPEG" onSelect={() => selectCodec('jpeg')} />
            <MenuItem label="PNG" onSelect={() => selectCodec('png')} />
            <MenuItem label="SVG" onSelect={() => selectCodec('svg')} />
            <DropdownMenuSeparator className="bg-[var(--color-line)]" />
            <MenuItem label="Auto (Butteraugli target)" onSelect={() => selectCodec('auto')} />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View menu */}
        <DropdownMenu modal={false} open={open === 'menu-view'} onOpenChange={(o) => setOpen(o ? 'menu-view' : null)}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerClass}>View</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuContentClass}>
            <MenuItem label="Batch view" onSelect={() => setView('Batch')} />
            <MenuItem label="Compare view" onSelect={() => setView('Compare')} />
            <MenuItem label="Report view" onSelect={() => setView('Report')} />
            <DropdownMenuSeparator className="bg-[var(--color-line)]" />
            <MenuItem label="Light theme" onSelect={() => setTheme('light')} />
            <MenuItem label="Dark theme" onSelect={() => setTheme('dark')} />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help menu */}
        <DropdownMenu modal={false} open={open === 'menu-help'} onOpenChange={(o) => setOpen(o ? 'menu-help' : null)}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerClass}>Help</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuContentClass}>
            <MenuItem label="Documentation" onSelect={() => openDocs()} />
            <MenuItem label="Keyboard shortcuts" onSelect={() => openShortcuts()} />
            <MenuItem label="What's new" onSelect={() => openChangelog()} />
            <DropdownMenuSeparator className="bg-[var(--color-line)]" />
            <DropdownMenuLabel className="px-3 py-1.5 text-xs font-normal text-[var(--color-fg-2)]">
              v0.1.0 · 2026
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right cluster: pills + ⌘K — ml-auto pushes to right edge */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-[11px] text-[var(--color-fg-2)]">100% local</span>
        <span aria-hidden="true" className="text-[var(--color-fg-2)]">·</span>
        <span className="text-[11px] text-[var(--color-fg-2)]">Offline-ready</span>
        <button
          type="button"
          aria-label="Open command palette"
          onClick={openCmdk}
          className="flex items-center gap-2 px-2 py-1 rounded text-xs text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)]"
        >
          <MagnifyingGlass size={14} />
          <Kbd className="text-[11px] font-mono font-semibold">⌘K</Kbd>
        </button>
      </div>
    </header>
  )
}
