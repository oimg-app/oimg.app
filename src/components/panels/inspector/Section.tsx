// Phase 04 — shared Section wrapper for inspector panels. Source: 04-01-PLAN.md
import { cn } from '@/lib/utils'

interface SectionProps {
  title: string
  badge?: { text: string; acc?: boolean }
  children: React.ReactNode
}

export function Section({ title, badge, children }: SectionProps) {
  return (
    <div className="border-b border-[var(--color-line)] px-3.5 pt-2.5 pb-3.5">
      <h3 className="flex items-center justify-between font-mono text-[11px] font-semibold text-[var(--color-fg-2)] uppercase tracking-wider mb-2.5">
        <span>{title}</span>
        {badge && (
          <span
            className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
              badge.acc
                ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                : 'bg-[var(--color-bg-2)] text-[var(--color-fg-1)]',
            )}
          >
            {badge.text}
          </span>
        )}
      </h3>
      {children}
    </div>
  )
}
