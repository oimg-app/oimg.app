// Phase 07-polish / Plan 01 — SHELL-02: BackpressureIndicator. Source: 07-01-PLAN.md
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { cn } from '@/lib/utils'

export function BackpressureIndicator() {
  const { running } = useStore(runtimeAtom)
  return (
    <div
      data-testid="backpressure-indicator"
      role="status"
      aria-live="polite"
      aria-label={running ? 'Optimization running' : undefined}
      className={cn(
        'pointer-events-none absolute top-0 left-0 right-0 h-0.5 z-50 transition-opacity',
        running ? 'bg-[var(--color-accent)] animate-pulse' : 'opacity-0',
      )}
    />
  )
}
