// Phase 02 — FILES-03 + FILES-04: FileRow with ContextMenu (D-02). Source: 02-02-PLAN.md
// change:remove-dead-ui-and-fix-a11y — no-op menu items (Re-optimize, Reveal in compare, Apply
//   same settings to all) removed until they are built.
import { useRef } from 'react'
import { useStore } from '@nanostores/react'
import {
  DotsThreeVertical,
  DownloadSimple,
  Copy,
  Code,
  Trash,
} from '@phosphor-icons/react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { fmtBytes, fmtPct } from '@/lib/format'
import {
  filesAtom,
  uiAtom,
  selectFile,
  removeFile,
  setRowMenu,
} from '@/stores'
import type { FileEntry } from '@/stores/files'
import { useExport } from '@/hooks/useExport'
import { useSnippets } from '@/hooks/useSnippets'

// PITFALL-05: key on 'jpg' not 'jpeg' (type field in FileEntry uses 'jpg')
const BADGE_CLASS: Record<string, string> = {
  svg:  'bg-[repeating-linear-gradient(45deg,var(--bg-2)_0_4px,var(--bg-3)_4px_5px)] text-[var(--primary)]',
  png:  'bg-[linear-gradient(135deg,oklch(0.55_0.12_250)_0%,oklch(0.45_0.10_280)_100%)] text-[oklch(0.95_0_0)]',
  jpg:  'bg-[linear-gradient(135deg,oklch(0.65_0.13_60)_0%,oklch(0.55_0.15_30)_100%)] text-[oklch(0.95_0_0)]',
  webp: 'bg-[linear-gradient(135deg,oklch(0.60_0.14_195)_0%,oklch(0.50_0.12_220)_100%)] text-[oklch(0.95_0_0)]',
  avif: 'bg-[linear-gradient(135deg,oklch(0.60_0.14_320)_0%,oklch(0.45_0.12_290)_100%)] text-[oklch(0.95_0_0)]',
}

// change:remove-dead-ui-and-fix-a11y — rows are listbox options with a roving tabindex (design D5):
//   FilesPane owns arrow-key movement; `tabbable` marks the one row in the tab order.
export function FileRow({ file, tabbable }: { file: FileEntry; tabbable: boolean }) {
  const { rowMenu } = useStore(uiAtom)
  const { selectedId } = useStore(filesAtom)
  const { exportOne } = useExport()
  const { copyPictureOne, copyDataUriOne } = useSnippets()
  // PITFALL-01: Attach ref to ContextMenuTrigger directly — it accepts ref.
  // Do NOT use asChild + plain div + forwardRef (ref won't merge).
  const rowRef = useRef<HTMLElement>(null)

  const isSelected = selectedId === file.id
  const hasMenu = rowMenu === file.id

  const savingsPct = file.orig > 0 ? ((file.orig - file.opt) / file.orig) * 100 : 0

  // Radix ContextMenu opens at the event's coordinates. Synthesize them from an element's box,
  // not the pointer — keyboard activation reports clientX/Y = 0,0 (menu at the viewport origin).
  function openMenuAt(anchor: Element) {
    const r = anchor.getBoundingClientRect()
    rowRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: r.left,
        clientY: r.bottom,
      })
    )
  }

  function handleCtxBtn(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    openMenuAt(e.currentTarget)
  }

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      if (rowRef.current) openMenuAt(rowRef.current)
    }
  }

  const STATUS_DOT: Record<string, string> = {
    queued:     'bg-[var(--fg-3)]',
    processing: 'bg-[var(--info)] animate-pulse',
    done:       'bg-[var(--primary)]',
    error:      'bg-[var(--err)]',
  }

  return (
    <ContextMenu onOpenChange={(open) => setRowMenu(open ? file.id : null)}>
      <ContextMenuTrigger
        ref={rowRef}
        role="option"
        aria-selected={isSelected}
        tabIndex={tabbable ? 0 : -1}
        data-row-id={file.id}
        onKeyDown={handleRowKeyDown}
        data-testid={`files-row-${file.id}`}
        data-status={file.status}
        data-selected={isSelected || undefined}
        onClick={() => selectFile(file.id)}
        className={cn(
          'grid grid-cols-[28px_1fr_auto] gap-[10px] items-center px-3 py-[7px] border-b border-[var(--line)] relative cursor-default group outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
          !isSelected && 'hover:bg-[var(--bg-2)] cursor-pointer',
          (isSelected || hasMenu) && 'bg-[var(--accent-dim)] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[var(--primary)]'
        )}
      >
        {/* Format badge */}
        <div
          className={cn(
            'w-7 h-7 grid place-items-center rounded-[3px] border border-[var(--line)] font-mono text-[8.5px] font-semibold',
            BADGE_CLASS[file.type] ?? ''
          )}
          aria-hidden="true"
          data-testid={`files-row-${file.id}-badge`}
        >
          {file.type.toUpperCase()}
        </div>

        {/* File meta */}
        <div className="min-w-0">
          <div
            className="text-[12px] font-semibold text-[var(--fg-0)] truncate"
            data-testid={`files-row-${file.id}-name`}
          >
            {file.name}
          </div>
          <div className="font-mono text-[12px] text-[var(--fg-2)] flex flex-wrap gap-x-[6px] items-center mt-[2px] [&>span]:whitespace-nowrap">
            <span data-testid={`files-row-${file.id}-size`}>{fmtBytes(file.orig)}</span>
            <span aria-hidden="true" className="text-[var(--fg-3)]">→</span>
            <span>{fmtBytes(file.opt)}</span>
            <span className={cn('font-semibold', savingsPct < 30 ? 'text-[var(--warn)]' : 'text-[var(--primary)]')}>
              {fmtPct(file.orig, file.opt)}
            </span>
          </div>
          {file.status === 'processing' && (
            <div className="h-[2px] w-full bg-[var(--bg-3)] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-[var(--info)] transition-[width] duration-150"
                style={{ width: `${(file.prog ?? 0) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Right column: ctxbtn + status dot */}
        <div className="flex items-center gap-[6px]">
          {/* Mouse affordance only: keyboard users open the menu with Shift+F10 / ContextMenu on
              the row, so the option holds no nested tab stop. */}
          <button
            type="button"
            tabIndex={-1}
            className="w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] cursor-pointer hover:text-[var(--fg-0)]"
            aria-label="File options"
            data-testid={`files-row-${file.id}-ctxbtn`}
            onClick={handleCtxBtn}
          >
            <DotsThreeVertical size={12} />
          </button>
          <div
            className={cn('w-2 h-2 rounded-full', STATUS_DOT[file.status] ?? 'bg-[var(--fg-3)]')}
            aria-label={`Status: ${file.status}`}
            data-testid={`files-row-${file.id}-status`}
            data-status={file.status}
          />
        </div>
      </ContextMenuTrigger>

      {/* change:add-black-box-e2e-suite — menu items take bare testids, not per-row ones:
          Radix keeps only the active row's menu mounted, so there is never a second match. */}
      <ContextMenuContent
        data-testid="files-row-menu"
        onCloseAutoFocus={(e) => {
          // Return focus to the row the menu belongs to (keyboard users land back in the list).
          e.preventDefault()
          rowRef.current?.focus()
        }}
      >
        <ContextMenuItem
          data-testid="files-row-menu-saveas"
          disabled={file.status !== 'done'}
          title={file.status !== 'done' ? 'Optimize this file first' : undefined}
          onSelect={() => { void exportOne(file) }}
        >
          <DownloadSimple size={14} />
          Save as…
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="files-row-menu-copy-datauri"
          disabled={file.status !== 'done'}
          title={file.status !== 'done' ? 'Optimize this file first' : undefined}
          onSelect={() => { void copyDataUriOne(file) }}
        >
          <Copy size={14} />
          Copy data-URI
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="files-row-menu-copy-picture"
          disabled={file.status !== 'done'}
          title={file.status !== 'done' ? 'Optimize this file first' : undefined}
          onSelect={() => { void copyPictureOne(file) }}
        >
          <Code size={14} />
          {'Copy <picture>'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          data-testid="files-row-menu-remove"
          variant="destructive"
          onSelect={() => removeFile(file.id)}
        >
          <Trash size={14} />
          Remove from queue
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
