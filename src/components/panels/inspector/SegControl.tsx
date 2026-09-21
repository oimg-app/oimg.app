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
  /**
   * change:add-black-box-e2e-suite — lands on the radiogroup root. Each option
   * button carries `data-value`, so a spec scopes per-option queries as
   * `[data-testid="codec-seg-fit"] [data-value="contain"]` without touching
   * visible text.
   */
  'data-testid'?: string
}

export function SegControl({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  disabled,
  'data-testid': testId,
}: SegControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      className={cn(
        'flex h-6 rounded-[4px] border border-[var(--color-line)] overflow-hidden bg-color-bg-1',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          data-value={o}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn(
            'flex-1 px-2 text-[11px] font-mono transition-colors',
            i > 0 && 'border-l border-[var(--color-line)]',
            o === value
              ? 'bg-color-bg-3 text-[var(--color-fg-0)] font-semibold'
              : 'text-[var(--color-fg-2)] font-normal hover:text-[var(--color-fg-0)]',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
