// Phase 03 — NAV-02 (minimal slice: Optimize all primary button only). Source: 03-01-PLAN.md
import { Lightning } from '@phosphor-icons/react'
import { startRun } from '@/stores/runtime'

export function Toolbar() {
  return (
    <div
      data-testid="toolbar"
      role="toolbar"
      aria-label="Primary toolbar"
      className="h-11 bg-[var(--color-bg-1)] border-b border-[var(--color-line)] px-2 flex items-center gap-2 shrink-0"
    >
      <button
        type="button"
        onClick={startRun}
        className="h-7 px-3 text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent rounded-[5px] hover:brightness-105 flex items-center gap-1"
      >
        <Lightning size={13} />
        Optimize all
      </button>
    </div>
  )
}
