// Phase 05 — CENTER-02: CenterHeader breadcrumb + zoom popover
// Phase 07-polish — WCAG AA: zoom dropdown migrated Popover→DropdownMenu for arrow-key navigation.
import { useStore } from '@nanostores/react'
import { uiAtom, setZoom } from '@/stores/ui'
import { $selectedFile } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Eye, Check, CaretDown } from '@phosphor-icons/react'

const FILE_TAG =
  'font-mono text-[11px] font-semibold bg-[var(--color-bg-2)] text-[var(--color-fg-1)] px-1.5 py-0.5 rounded-[3px] whitespace-nowrap'

const ZOOM_OPTS = [25, 50, 100, 200, 'fit'] as const

export function CenterHeader() {
  const { zoom } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)
  const { codec, q, resizeOn, w, h } = useStore(settingsAtom)

  return (
    <header className="flex items-center justify-between h-9 px-3 border-b border-[var(--color-line)] bg-[var(--color-bg-1)] shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 min-w-0">
        <span className="text-[13px] text-[var(--color-fg-2)]">Queue</span>
        <span className="text-[13px] text-[var(--color-fg-3)]">/</span>
        {selectedFile && (
          <>
            <span className="text-[13px] font-medium text-[var(--color-fg-0)] truncate max-w-[200px]">
              {selectedFile.name}
            </span>
            {/* type→codec from inspector */}
            <span className={FILE_TAG}>
              {selectedFile.type.toUpperCase()}→{codec.toUpperCase()}
            </span>
            {/* dim — extended with resize target when resizeOn */}
            <span className={FILE_TAG}>
              {resizeOn ? `${selectedFile.dim}→${w}×${h}` : selectedFile.dim}
            </span>
            {/* quality from inspector slider — hidden for SVG */}
            {codec !== 'SVG' && (
              <span className={FILE_TAG}>q{q}</span>
            )}
          </>
        )}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        {selectedFile && (
          <span className="font-mono text-[11px] font-semibold bg-[var(--color-accent-dim)] text-[var(--color-accent)] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={10} />
            {' Optimized'}
          </span>
        )}

        {/* Zoom dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 h-6 px-2 font-mono text-[11px] text-[var(--color-fg-1)] hover:text-[var(--color-fg-0)] hover:bg-[var(--color-bg-2)] rounded transition-colors"
            >
              <Eye size={12} />
              {zoom === 'fit' ? 'Fit' : `${zoom}%`}
              <CaretDown size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-32 min-w-0 p-1 bg-[var(--color-bg-1)] text-[var(--color-fg-1)] border border-[var(--color-line)] ring-0 shadow-md">
            {ZOOM_OPTS.map((opt) => (
              <DropdownMenuItem
                key={opt}
                className="flex items-center justify-between h-7 px-2 font-mono text-[11px] rounded cursor-pointer focus:bg-[var(--color-bg-2)] data-[highlighted]:bg-[var(--color-bg-2)] text-[var(--color-fg-1)]"
                onSelect={() => setZoom(opt)}
              >
                <span>{typeof opt === 'number' ? `${opt}%` : 'Fit'}</span>
                {zoom === opt && <Check size={10} />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
