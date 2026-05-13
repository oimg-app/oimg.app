// Phase 4 plan 04-06 — StatusBar throttle pill.
// Source: 04-CONTEXT.md D-13; 04-UI-SPEC.md §Surface 6 + §Copywriting Contract;
// 04-PATTERNS.md lines 591-608 (verbatim pattern).
//
// Renders nothing when runtimeStore.throttleActive === false (zero DOM).

import { useStore } from '@nanostores/react'
import { runtimeStore } from '@/stores/runtime'

export function BackpressureIndicator() {
  const { throttleActive: active } = useStore(runtimeStore)
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
