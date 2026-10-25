import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { registerCommands } from '@/stores/ui'
import { buildCommands } from '@/lib/commands'
import { runOptimize } from '@/hooks/useOptimize'
import { filesAtom } from '@/stores/files'
import { probeCaps } from '@/lib/caps'
import { setCaps } from '@/stores/runtime'

export const isCrossOriginIsolated: boolean = crossOriginIsolated
if (!isCrossOriginIsolated) {
  console.error(
    '[oimg] crossOriginIsolated is false. ' +
    'COOP/COEP headers are missing or a cross-origin resource is blocking COEP. ' +
    'Codec workers will not function in Phase 2+.'
  )
}

// Phase 13 — DIA-02 (D-04): capability probe runs ONCE pre-render. Result goes
// into runtimeAtom.caps so StatusBar/SettingsPanel render the truth on first paint.
// Pattern: same pre-render-side-effect placement as the crossOriginIsolated guard above.
// PATTERNS finding #5 — INSERT after the COI block, do NOT replace it (different purposes:
// COI is the codec-worker COOP/COEP smoke test; this writes to the atom for UI surface).
setCaps(probeCaps())

// Inject the command list into ui.ts before first render so $cmdFlat is populated immediately.
// change:remove-dead-ui-and-fix-a11y — Optimize all dispatches the Toolbar's own runOptimize and is
//   unavailable while the queue is empty (design D2).
registerCommands(
  buildCommands({
    optimizeAll: () => void runOptimize(),
    hasFiles: () => filesAtom.get().entries.length > 0,
  }).flatMap(g => g.items),
)

// Phase 11 Plan 00 — Test-only runtimeAtom→window bridge for SC-4 backpressure peak latch.
// Gated by import.meta.env.MODE === 'test' so this branch (and the dynamic store import)
// is tree-shaken from production builds (CLAUDE.md zero-telemetry constraint).
if (import.meta.env.MODE === 'test') {
  void import('@/stores/runtime').then(({ runtimeAtom }) => {
    runtimeAtom.subscribe((s) => {
      const w = window as { __runningJobs?: number; __peakRunning?: number }
      w.__runningJobs = s.runningJobs
      const prev = w.__peakRunning ?? 0
      if (s.runningJobs > prev) w.__peakRunning = s.runningJobs
    })
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[oimg] #root element not found — check index.html')
}
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
