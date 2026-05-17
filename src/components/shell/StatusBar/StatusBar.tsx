// Phase 03 — NAV-03 (minimal slice: worker pip + Idle/Running label). Source: 03-01-PLAN.md
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { running } = useStore(runtimeAtom)
  return (
    <div
      data-testid="statusbar"
      role="status"
      aria-live="polite"
      className="h-[22px] bg-[var(--color-bg-1)] border-t border-[var(--color-line)] px-3 flex items-center gap-3 text-[11px] text-[var(--color-fg-2)] shrink-0"
    >
      <span
        data-testid="worker-pip"
        aria-label={`Worker status: ${running ? 'Running' : 'Idle'}`}
        className={cn(
          'w-2 h-2 rounded-full inline-block',
          running ? 'bg-[var(--color-info)] motion-safe:animate-pulse' : 'bg-[var(--color-accent)]'
        )}
      />
      <span>{running ? 'Running' : 'Idle'}</span>
    </div>
  )
}
