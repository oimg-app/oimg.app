// Phase 04 — shared SegControl for inspector panels. Source: 04-01-PLAN.md
import { cn } from '@/lib/utils'

interface SegControlProps {
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  /** Accessible name for the radiogroup — required by ARIA spec */
  'aria-label'?: string
  /** When true, renders as visually disabled (pointer-events-none + opacity) */
  disabled?: boolean
}

export function SegControl({ options, value, onChange, 'aria-label': ariaLabel, disabled }: SegControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        'flex h-6 rounded-[4px] border border-[var(--color-line)] overflow-hidden bg-[var(--color-bg-1)]',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn(
            'flex-1 px-2 text-[11px] font-mono transition-colors',
            i > 0 && 'border-l border-[var(--color-line)]',
            o === value
              ? 'bg-[var(--color-bg-3)] text-[var(--color-fg-0)] font-semibold'
              : 'text-[var(--color-fg-2)] font-normal hover:text-[var(--color-fg-0)]',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
