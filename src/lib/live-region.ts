// Phase 2 — ARIA live-region announcement bus.
// Source: 02-RESEARCH.md §Pattern 6 (lines 472-499), 02-UI-SPEC.md §5 (lines 177-186).
// Cadence: ONLY at batch boundaries (start, every Nth completion where N=Math.max(1, Math.floor(total/4)),
// final, error, cancel). NO per-file announcements (Pitfall 5 — screen reader flooding).

let liveRegionEl: HTMLElement | null = null

/** Set the live region DOM element. Called from App.tsx mount via ref callback. */
export function setLiveRegion(el: HTMLElement | null): void {
  liveRegionEl = el
}

/**
 * Announce a polite message to assistive tech.
 * Clears textContent first, then sets in next frame — some screen readers ignore
 * identical-text updates without the clear-then-set dance.
 */
export function announce(message: string): void {
  if (!liveRegionEl) return
  liveRegionEl.textContent = ''
  requestAnimationFrame(() => {
    if (liveRegionEl) liveRegionEl.textContent = message
  })
}

/**
 * Quartile boundary check — returns true on each Nth completion (N=Math.floor(total/4)).
 * Caller decides what message to announce.
 *
 * WR-03: small batches (totalJobs < 4) yield stride=1 under the old formula,
 * which fires an interior announcement on every single completion — exactly
 * the screen-reader flooding Pitfall 5 forbids. For batches under 4 files we
 * announce only start + final; no interior strides.
 */
export function isQuartileBoundary(doneCount: number, totalJobs: number): boolean {
  if (totalJobs < 4) return false // WR-03: small batches → start + final only
  if (doneCount === 0) return false
  if (doneCount === totalJobs) return false // caller handles "final" separately
  const stride = Math.floor(totalJobs / 4)
  return doneCount % stride === 0
}
