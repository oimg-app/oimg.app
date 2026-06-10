// Phase 02 — FILES-01 + FILES-02 + FILES-05: FilesPane full body. Source: 02-02-PLAN.md
// Phase 10 — Plan 04: dropzone + Add files → useIngest; hidden file-input fallback. Source: 10-04-PLAN.md
import { useState, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { Funnel, Plus, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { $filteredFiles, $totals, setSortBy, $queueEmpty, clearFiles } from '@/stores'
import { runtimeAtom } from '@/stores/runtime'
import type { SortKey } from '@/stores/files'
import { fmtBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileRow } from './files/FileRow'
import { useIngest } from '@/hooks/useIngest'

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Queue order', key: 'queue order' },
  { label: 'File size',   key: 'file size' },
  { label: 'Savings %',  key: 'savings %' },
  { label: 'Name',        key: 'name' },
  { label: 'Format',      key: 'format' },
]

// D-06 accept string: all supported ext + MIME combos
// Quick 260610-lby: added .heic,.heif,image/heic,image/heif (decode-only input)
const ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.avif,.heic,.heif,image/png,image/jpeg,image/webp,image/svg+xml,image/avif,image/heic,image/heif'

export function FilesPane() {
  const files = useStore($filteredFiles)
  const totals = useStore($totals)
  const queueEmpty = useStore($queueEmpty)
  const { ingest, openPicker } = useIngest()
  const inputRef = useRef<HTMLInputElement>(null)
  // STORE-08: dragActive is ephemeral UI state — allowed
  const [dragActive, setDragActive] = useState(false)

  // Phase 13 — CLR-01 / D-15 / T-13-03: mirror Plan 05 Toolbar handler shape for affordance parity.
  // runtimeAtom.get() snapshot read inside handler (NOT useStore) — avoids re-renders on job-count delta.
  function handleClearAll() {
    const { runningJobs } = runtimeAtom.get()
    if (runningJobs > 0) {
      toast.warning(`Cancel ${runningJobs} in-flight jobs?`, {
        action: { label: 'Clear anyway', onClick: () => clearFiles() },
      })
      return
    }
    clearFiles()
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()    // Pitfall 3: required — enables drop
    e.stopPropagation()
    setDragActive(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Pitfall 1: only clear when cursor leaves root (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    ingest(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      data-testid="files-pane"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "h-full flex flex-col border-r border-[var(--line)] bg-[var(--bg-1)]",
        dragActive && "border-[var(--color-accent)] bg-[var(--bg-2)]"
      )}
    >
      {/* FILES-01: Pane Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-[var(--line)] shrink-0">
        <span className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--fg-2)]">
          Queue · {files.length} files
        </span>
        <div className="flex items-center gap-1">
          {/* Phase 13 — CLR-01 / D-15: × icon with disable-then-explain triple + T-13-03 confirmation toast.
              Placed LEFT of the Sort funnel — destructive action visually separated from Add. */}
          <button
            className={cn(
              "w-[22px] h-[22px] grid place-items-center rounded text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]",
              queueEmpty && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Clear all files"
            title={queueEmpty ? 'No files to clear' : 'Clear all files'}
            onClick={() => handleClearAll()}
            disabled={queueEmpty}
            aria-disabled={queueEmpty}
          >
            <XCircle size={13} />
          </button>
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
            onClick={() => openPicker(() => inputRef.current?.click())}
          >
            <Plus size={13} />
          </button>
          {/* Hidden file input — picker fallback target; data-testid used by ingest.spec */}
          <input
            ref={inputRef}
            data-testid="file-input"
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && ingest(Array.from(e.target.files))}
          />
        </div>
      </div>

      {/* FILES-02: Dropzone — always visible. WR-01: "click to browse" is now an operable,
          keyboard-focusable affordance (WCAG-AA) that opens the picker with the input fallback. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop images to optimize, or click to browse"
        onClick={() => openPicker(() => inputRef.current?.click())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker(() => inputRef.current?.click())
          }
        }}
        className="m-3 p-[14px] border border-dashed border-[var(--line-strong)] rounded-[6px] text-center shrink-0 cursor-pointer hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span className="text-[13px] font-semibold text-[var(--fg-0)] block mb-[3px]">Drop images to optimize</span>
        <span className="text-[12px] text-[var(--fg-2)] block">or click to browse · max 200 files</span>
        <div className="font-mono text-[10px] tracking-[0.05em] text-[var(--fg-3)] mt-[6px]">SVG · PNG · JPEG · WEBP · AVIF · HEIC · JXL</div>
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
