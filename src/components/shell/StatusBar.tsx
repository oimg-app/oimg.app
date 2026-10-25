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

  // change:remove-dead-ui-and-fix-a11y — the X/Y counter is the only live region (design D9);
  //   versions/caps/sizes sit outside it. Items render as a list so a separator only
  //   appears between items that are actually shown (no "Idle · ·" on an empty queue).
  const items: Array<{ key: string; node: React.ReactNode }> = [
    { key: 'svgo', node: (
      <span data-testid="status-version-svgo" className="font-mono font-semibold">
        SVGO {versions.svgo}
      </span>
    ) },
    { key: 'jsquash', node: (
      <span data-testid="status-version-jsquash" className="font-mono font-semibold">
        jSquash · webp {versions.jsquash.webp}
      </span>
    ) },
    { key: 'wasm', node: <span>{wasmStr}</span> },
    // Phase 13 — D-09: Offline-ready pill HIDES when SW controller is absent.
    // Never render "Online-only" placeholder — silent omission matches the
    // zero-telemetry / no-stale-status contract from CONTEXT.md.
    ...(caps.offlineReady ? [{ key: 'offline', node: <span>Offline-ready</span> }] : []),
    // Phase 14 — PWA-03: Install button. Gated on canInstall so it's absent on
    // Firefox (event never fires), when already installed (appinstalled
    // cleared the atom), and on Plan 14-04 SW-uncontrolled first visit.
    ...(canInstall ? [{ key: 'install', node: (
      <button
        type="button"
        data-testid="install-button"
        onClick={() => void promptInstall()}
        className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-sm"
      >
        Install
      </button>
    ) }] : []),
    { key: 'count', node: <span data-testid="status-filecount">{entries.length} files</span> },
    { key: 'totals', node: <span data-testid="status-totals">{fmtBytes(totals.orig)} → {fmtBytes(totals.opt)}</span> },
  ]

  return (
    <div
      data-testid="statusbar"
      className="h-6 bg-color-bg-1 border-t border-[var(--color-line)] px-3 flex items-center gap-3 text-xs text-[var(--color-fg-2)] shrink-0 overflow-x-auto whitespace-nowrap"
    >
      <span
        data-testid="worker-pip"
        aria-label={`Worker status: ${running ? 'Running' : 'Idle'}`}
        className={cn(
          'w-2 h-2 rounded-full inline-block shrink-0',
          running ? 'bg-color-info motion-safe:animate-pulse' : 'bg-color-accent'
        )}
      />
      <span>{running ? 'Running' : 'Idle'}</span>
      {/* Phase 11 Plan 02 — OPT-02 aggregate counter (D-01): the bar's only live region. It stays
          mounted (empty when the queue is) so screen readers keep the region registered. */}
      {counterText && <span aria-hidden="true">·</span>}
      <span
        data-testid="agg-counter"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="font-mono"
      >
        {counterText}
      </span>

      {items.map(({ key, node }) => (
        <span key={key} className="contents">
          <span aria-hidden="true">·</span>
          {node}
        </span>
      ))}
    </div>
  )
}
