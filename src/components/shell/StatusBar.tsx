// Phase 03 — NAV-03 (full NAV-03: pip + versions + WASM + file count + size summary). Source: 03-02-PLAN.md
// Phase 13 — DIA-01/02/03 (D-07/D-08/D-09): versions/caps read from runtimeAtom (Plan 13-03 reshape).
//   - SVGO + jSquash badges read live versions (D-08).
//   - WASM info is DERIVED from caps.simd/threads (D-07) — no atom field.
//   - Offline-ready pill is HIDDEN when !caps.offlineReady (D-09).
// Phase 14 — Plan 03 (PWA-03): Install button adjacent to the offline pill,
//   gated on useInstallPrompt().canInstall; click invokes the deferred
//   beforeinstallprompt event. Button is absent on Firefox (event never fires)
//   and after appinstalled (atom clears).
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { filesAtom, $totals } from '@/stores/files'
import { fmtBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function StatusBar() {
  const { running, versions, caps } = useStore(runtimeAtom)
  const totals = useStore($totals)
  const { entries } = useStore(filesAtom)
  // Phase 14 — PWA-03: deferred beforeinstallprompt → Install affordance.
  const { canInstall, promptInstall } = useInstallPrompt()

  // Phase 11 Plan 02 (OPT-02 / D-01): aggregate X/Y counter derived live from entries.
  // No new batchProgressAtom — derivation only (per plan constraint).
  // Empty string when queue is empty (avoids `0/0 optimized` clutter).
  const done = entries.filter((e) => e.status === 'done').length
  const total = entries.length
  const counterText = total > 0 ? `${done}/${total} optimized` : ''

  // Phase 13 — D-07: derive WASM-capability badge inline from caps. Four-way
  // ternary matches PATTERNS lines 297-302.
  const wasmStr =
    caps.simd && caps.threads ? 'WASM ready · SIMD · MT'
    : caps.simd               ? 'WASM ready · SIMD'
    : caps.threads            ? 'WASM ready · MT'
    : 'WASM ready'

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
      <span className="font-mono text-[11px] font-semibold">SVGO {versions.svgo}</span>

      <span aria-hidden="true">·</span>
      <span className="font-mono text-[11px] font-semibold">jSquash · webp {versions.jsquash.webp}</span>

      <span aria-hidden="true">·</span>
      <span>{wasmStr}</span>

      {/* Phase 13 — D-09: Offline-ready pill HIDES when SW controller is absent.
          Never render "Online-only" placeholder — silent omission matches the
          zero-telemetry / no-stale-status contract from CONTEXT.md. */}
      {caps.offlineReady && (
        <>
          <span aria-hidden="true">·</span>
          <span>Offline-ready</span>
        </>
      )}

      {/* Phase 14 — PWA-03: Install button. Gated on canInstall so it's absent on
          Firefox (event never fires), when already installed (appinstalled
          cleared the atom), and on Plan 14-04 SW-uncontrolled first visit.
          Accent-coloured underlined text matches existing 11px badge styling
          (Tailwind utilities only, no inline styles per 14-03-PLAN). */}
      {canInstall && (
        <>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            data-testid="install-button"
            onClick={() => void promptInstall()}
            className="text-[11px] text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-sm"
          >
            Install
          </button>
        </>
      )}

      <span aria-hidden="true">·</span>
      <span data-testid="status-filecount">{entries.length} files</span>

      <span aria-hidden="true">·</span>
      <span data-testid="status-totals">{fmtBytes(totals.orig)} → {fmtBytes(totals.opt)}</span>
    </div>
  )
}
