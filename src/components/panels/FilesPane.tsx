// Phase 02 — FILES-01 + FILES-02 + FILES-05: FilesPane full body. Source: 02-02-PLAN.md
import { useStore } from '@nanostores/react'
import { Funnel, Plus } from '@phosphor-icons/react'
import { $filteredFiles, $totals, setSortBy } from '@/stores'
import type { SortKey } from '@/stores/files'
import { fmtBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FileRow } from '@/components/file-row/FileRow'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Queue order', key: 'queue order' },
  { label: 'File size',   key: 'file size' },
  { label: 'Savings %',  key: 'savings %' },
  { label: 'Name',        key: 'name' },
  { label: 'Format',      key: 'format' },
]

export function FilesPane() {
  const files = useStore($filteredFiles)
  const totals = useStore($totals)

  return (
    <div
      data-testid="files-pane"
      className="h-full flex flex-col border-r border-[var(--line)] bg-[var(--bg-1)]"
    >
      {/* FILES-01: Pane Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-[var(--line)] shrink-0">
        <span className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--fg-2)]">
          Queue · {files.length} files
        </span>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]"
                aria-label="Sort files"
              >
                <Funnel size={13} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="end">
              <div className="flex flex-col">
                {SORT_OPTIONS.map(({ label, key }) => (
                  <button
                    key={key}
                    className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-2)] text-left w-full"
                    onClick={() => setSortBy(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button
            className="w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]"
            aria-label="Add files"
            onClick={() => { /* @TODO Phase 3 — pushToast('Add files') */ }}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* FILES-02: Dropzone — always visible */}
      <div className="m-3 p-[14px] border border-dashed border-[var(--line-strong)] rounded-[6px] text-center shrink-0">
        <span className="text-[13px] font-semibold text-[var(--fg-0)] block mb-[3px]">Drop images to optimize</span>
        <span className="text-[12px] text-[var(--fg-2)] block">or click to browse · max 200 files</span>
        <div className="font-mono text-[10px] tracking-[0.05em] text-[var(--fg-3)] mt-[6px]">SVG · PNG · JPEG · WEBP · AVIF · JXL</div>
      </div>

      {/* FILES-03: File list */}
      <ul aria-label="File queue" className="flex-1 overflow-y-auto">
        {files.map(f => (
          <li key={f.id}>
            <FileRow file={f} />
          </li>
        ))}
      </ul>

      {/* FILES-05: Totals Bar */}
      <div className="border-t border-[var(--line)] bg-[var(--bg-1)] px-3 py-[10px] grid grid-cols-2 gap-x-[14px] gap-y-1 shrink-0">
        {[
          { label: 'BEFORE',  value: fmtBytes(totals.orig),             valueClass: 'text-[var(--fg-0)]' },
          { label: 'AFTER',   value: fmtBytes(totals.opt),              valueClass: 'text-[var(--fg-0)]' },
          { label: 'SAVED',   value: fmtBytes(totals.saved),            valueClass: 'text-[var(--primary)]' },
          { label: 'SAVED %', value: `${totals.pct.toFixed(1)}%`,       valueClass: 'text-[var(--primary)]' },
        ].map(({ label, value, valueClass }) => (
          <div key={label} className="flex flex-col">
            <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-[var(--fg-2)]">{label}</span>
            <span className={cn('font-mono text-[13px] font-semibold tabular-nums', valueClass)}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
