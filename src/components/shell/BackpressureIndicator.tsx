// Phase 07-polish / Plan 01 — SHELL-02: BackpressureIndicator. Source: 07-01-PLAN.md
// Rendered inline in the TitleBar's right cluster, just before "100% local" — a small
// circular spinner that appears only while at least one worker job is in flight.
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { cn } from '@/lib/utils'

export function BackpressureIndicator() {
  const { running } = useStore(runtimeAtom)
  return (
    <span
      data-testid="backpressure-indicator"
      role="status"
      aria-live="polite"
      aria-label={running ? 'Optimization running' : undefined}
      className={cn(
        'inline-flex items-center justify-center w-3.5 h-3.5 transition-opacity',
        running ? 'opacity-100' : 'opacity-0',
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="w-full h-full animate-spin text-[var(--color-accent)]"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
