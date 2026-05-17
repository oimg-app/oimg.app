// Phase 03 — NAV-01: TitleBar with brand mark, Codec/View/Help menus, pills, ⌘K button. Source: 03-02-PLAN.md
import { useStore } from '@nanostores/react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { uiAtom, setOpen, setTheme, openCmdk } from '@/stores/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Kbd } from '@/components/ui/kbd'

const menuItemClass =
  'w-full px-3 py-1.5 text-left text-xs text-[var(--color-fg-0)] hover:bg-[var(--color-bg-3)] rounded flex items-center justify-between'

function MenuItem({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick?: () => void }) {
  return (
    <button type="button" className={menuItemClass} onClick={onClick}>
      {label}
      {shortcut && (
        <Kbd className="ml-2 text-[11px] font-mono font-semibold">{shortcut}</Kbd>
      )}
    </button>
  )
}

function MenuDivider() {
  return <div aria-hidden="true" className="h-px bg-[var(--color-line)] my-1" />
}

export function TitleBar() {
  const { open } = useStore(uiAtom)

  const triggerClass =
    'px-2 py-1 rounded text-xs text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)] data-[state=open]:bg-[var(--color-bg-2)] data-[state=open]:text-[var(--color-fg-0)]'

  const popoverContentClass =
    'w-auto p-2 bg-[var(--color-bg-2)] border-[var(--color-line)] rounded-[6px]'

  return (
    <header
      data-testid="titlebar"
      role="banner"
      className="h-9 bg-[var(--color-bg-1)] border-b border-[var(--color-line)] px-3 flex items-center justify-between shrink-0"
    >
      {/* Left cluster: brand mark */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="w-3 h-3 inline-block bg-[var(--color-accent)]"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 60% 100%, 0 100%)' }}
          />
          <span className="font-mono text-xs font-semibold tracking-[0.04em] text-[var(--color-fg-0)]">
            OIMG · image optimizer
          </span>
        </span>
      </div>

      {/* Center cluster: three controlled Popover menus */}
      <div className="flex items-center gap-1">
        {/* Codec menu */}
        <Popover
          open={open === 'menu-codec'}
          onOpenChange={(o) => setOpen(o ? 'menu-codec' : null)}
        >
          <PopoverTrigger asChild>
            <button type="button" className={triggerClass}>
              Codec
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <MenuItem label="WebP" onClick={() => setOpen(null)} />
              <MenuItem label="AVIF" onClick={() => setOpen(null)} />
              <MenuItem label="JPEG" onClick={() => setOpen(null)} />
              <MenuItem label="PNG" onClick={() => setOpen(null)} />
              <MenuItem label="SVG" onClick={() => setOpen(null)} />
              <MenuDivider />
              <MenuItem label="Auto (Butteraugli target)" onClick={() => setOpen(null)} />
            </div>
          </PopoverContent>
        </Popover>

        {/* View menu */}
        <Popover
          open={open === 'menu-view'}
          onOpenChange={(o) => setOpen(o ? 'menu-view' : null)}
        >
          <PopoverTrigger asChild>
            <button type="button" className={triggerClass}>
              View
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <MenuItem label="Batch view" onClick={() => setOpen(null)} />
              <MenuItem label="Compare view" onClick={() => setOpen(null)} />
              <MenuItem label="Report view" onClick={() => setOpen(null)} />
              <MenuDivider />
              <MenuItem
                label="Light theme"
                onClick={() => {
                  setTheme('light')
                  setOpen(null)
                }}
              />
              <MenuItem
                label="Dark theme"
                onClick={() => {
                  setTheme('dark')
                  setOpen(null)
                }}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Help menu */}
        <Popover
          open={open === 'menu-help'}
          onOpenChange={(o) => setOpen(o ? 'menu-help' : null)}
        >
          <PopoverTrigger asChild>
            <button type="button" className={triggerClass}>
              Help
            </button>
          </PopoverTrigger>
          <PopoverContent className={popoverContentClass} align="start">
            <div className="flex flex-col">
              <MenuItem label="Documentation" onClick={() => setOpen(null)} />
              <MenuItem label="Keyboard shortcuts" onClick={() => setOpen(null)} />
              <MenuItem label="What's new" onClick={() => setOpen(null)} />
              <MenuDivider />
              <MenuItem label="v0.1.0 · 2026" onClick={() => setOpen(null)} />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right cluster: pills + ⌘K button */}
      <div className="flex items-center gap-2">
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
