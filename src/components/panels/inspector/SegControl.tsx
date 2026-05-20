// Phase 04 — shared SegControl for inspector panels. Source: 04-01-PLAN.md
import { cn } from '@/lib/utils'

interface SegControlProps {
  options: readonly string[]
  value: string
  onChange: (v: string) => void
}

export function SegControl({ options, value, onChange }: SegControlProps) {
  return (
    <div
      role="group"
      className="flex h-6 rounded-[4px] border border-[var(--color-line)] overflow-hidden bg-[var(--color-bg-1)]"
    >
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
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
