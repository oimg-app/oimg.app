// Phase 4 plan 04-06 — StatusBar throttle pill.
// Source: 04-CONTEXT.md D-13; 04-UI-SPEC.md §Surface 6 + §Copywriting Contract;
// 04-PATTERNS.md lines 591-608 (verbatim pattern).
//
// Renders nothing when useRuntimeStore.throttleActive === false (zero DOM, not
// visibility:hidden — the StatusBar must not occupy layout space when the
// pool is not throttling).
//
// When active: a `<span class="item">` with a warn pip + the locked text
// "Pacing". The aria-label is the locked verbatim string from UI-SPEC §Surface 6
// (drift = blocker per threat T-04-06-01).

import { useRuntimeStore } from '@/stores/runtime'

export function BackpressureIndicator() {
  const active = useRuntimeStore((s) => s.throttleActive)
  if (!active) return null
  return (
    <span
      className="item"
      role="status"
      aria-live="polite"
      aria-label="Memory pacing active — admission gate is throttling new jobs"
    >
      <span className="pip warn" /> Pacing
    </span>
  )
}
