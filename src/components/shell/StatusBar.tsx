// Phase 03 — NAV-03 (full NAV-03: pip + versions + WASM + file count + size summary). Source: 03-02-PLAN.md
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { filesAtom, $totals } from '@/stores/files'
import { fmtBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { running, svgoVersion, codecVersion, wasmInfo } = useStore(runtimeAtom)
  const totals = useStore($totals)
  const { entries } = useStore(filesAtom)

  // Phase 11 Plan 02 (OPT-02 / D-01): aggregate X/Y counter derived live from entries.
  // No new batchProgressAtom — derivation only (per plan constraint).
  // Empty string when queue is empty (avoids `0/0 optimized` clutter).
  const done = entries.filter((e) => e.status === 'done').length
  const total = entries.length
  const counterText = total > 0 ? `${done}/${total} optimized` : ''

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

      {/* Phase 11 Plan 02 — OPT-02 aggregate counter (D-01). Pitfall 4: outer container
          already has aria-live="polite"; aria-atomic="true" here ensures the full string
          is announced as one unit without nesting a second live region. */}
      <span aria-hidden="true">·</span>
      <span
        data-testid="agg-counter"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="font-mono text-[11px]"
      >
        {counterText}
      </span>

      <span aria-hidden="true">·</span>
      <span className="font-mono text-[11px] font-semibold">SVGO {svgoVersion}</span>

      <span aria-hidden="true">·</span>
      <span className="font-mono text-[11px] font-semibold">@squoosh-kit/core {codecVersion}</span>

      <span aria-hidden="true">·</span>
      <span>{wasmInfo}</span>

      <span aria-hidden="true">·</span>
      <span data-testid="status-filecount">{entries.length} files</span>

      <span aria-hidden="true">·</span>
      <span data-testid="status-totals">{fmtBytes(totals.orig)} → {fmtBytes(totals.opt)}</span>
    </div>
  )
}
