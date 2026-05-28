// Phase 03 — NAV-04: CommandPalette modal (Dialog + manual keyboard nav). Source: 03-03-PLAN.md
import { useStore } from '@nanostores/react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { uiAtom, $cmdFlat, closeCmdk, setCmdkQuery, setCmdkSel } from '@/stores/ui'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

export function CommandPalette() {
  const { cmdkOpen, cmdkQ, cmdkSel } = useStore(uiAtom)
  const cmdFlat = useStore($cmdFlat)

  return (
    <Dialog open={cmdkOpen} onOpenChange={(o) => !o && closeCmdk()}>
      <DialogContent
        showCloseButton={false}
        data-testid="command-palette"
        aria-label="Command palette"
        className="w-[560px] max-w-[90vw] max-h-[400px] p-0 bg-[var(--color-bg-1)] border-[var(--color-line)] rounded-[8px] overflow-hidden"
      >
        {/* Search row */}
        <div className="flex items-center border-b border-[var(--color-line)]">
          <MagnifyingGlass size={16} className="text-[var(--color-fg-2)] ml-4 shrink-0" />
          <input
            autoFocus
            role="searchbox"
            aria-label="Search commands"
            placeholder="Search commands…"
            value={cmdkQ}
            className="flex-1 h-12 px-4 text-sm text-[var(--color-fg-0)] bg-transparent outline-none placeholder:text-[var(--color-fg-2)]"
            onChange={(e) => setCmdkQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCmdkSel(Math.min(cmdFlat.length - 1, cmdkSel + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCmdkSel(Math.max(0, cmdkSel - 1))
              } else if (e.key === 'Enter') {
                cmdFlat[cmdkSel]?.do?.()
                closeCmdk()
              } else if (e.key === 'Escape') {
                closeCmdk()
              }
            }}
          />
        </div>

        {/* Listbox */}
        <ul
          role="listbox"
          aria-label="Commands"
          aria-activedescendant={cmdFlat[cmdkSel] ? 'cmd-item-' + cmdkSel : undefined}
          className="max-h-[320px] overflow-y-auto"
        >
          {cmdFlat.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-[var(--color-fg-2)]">No commands match</li>
          ) : (
            cmdFlat.map((item, i) => (
              <li
                key={item.label}
                id={'cmd-item-' + i}
                role="option"
                aria-selected={i === cmdkSel}
                className={cn(
                  'px-4 py-2 text-[13px] text-[var(--color-fg-0)] cursor-default flex justify-between items-center hover:bg-[var(--color-bg-2)]',
                  i === cmdkSel && 'bg-[var(--color-accent-dim)] border-l-2 border-[var(--color-accent)]',
                )}
                onClick={() => {
                  item.do?.()
                  closeCmdk()
                }}
              >
                <span>{item.label}</span>
                {item.meta && (
                  <span className="font-mono text-[11px] font-semibold text-[var(--color-fg-2)]">
                    {item.meta}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>

        {/* Footer */}
        <div className="h-8 px-4 flex items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-bg-0)] text-[11px] text-[var(--color-fg-3)]">
          <Kbd>↑↓</Kbd>navigate
          <Kbd>Enter</Kbd>select
          <Kbd>Esc</Kbd>close
        </div>
      </DialogContent>
    </Dialog>
  )
}
