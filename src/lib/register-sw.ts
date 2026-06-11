// Phase 14 — Plan 04 (PWA-05 + ROADMAP SC#5/SC#6 + PIPE-02 budget).
//
// bootstrapSW() registers the service worker via vite-plugin-pwa's
// `virtual:pwa-register` and wires:
//   - onNeedRefresh → sonner toast "New version available — reload?" with a
//     Reload action that invokes updateSW(true). registerType:'prompt' means
//     SW does NOT auto-reload (T-14-RELOAD mitigation — never interrupt an
//     in-progress optimize/queue; user-consented reload only).
//   - onOfflineReady → setCaps({ ...probeCaps(), offlineReady: true }). This
//     replaces the Phase 13 D-04 placeholder (one-shot boot probe via
//     navigator.serviceWorker.controller) with the real precache-complete
//     signal — what finally turns the StatusBar D-09 Offline-ready pill green
//     (SC#6).
//
// Test hooks: in DEV or test mode we expose `window.__simulateSWNeedRefresh`
// and `window.__simulateSWOfflineReady` so Playwright (src/tests/pwa.spec.ts)
// can drive the SW lifecycle callbacks without actually waiting for a real
// SW takeover. Production builds (import.meta.env.PROD) tree-shake the hook
// branch so no surface leaks to end users — zero-telemetry contract.
//
// register-sw is intentionally NOT imported statically from App.tsx — App.tsx
// uses `import('@/lib/register-sw')` inside requestIdleCallback so this module
// stays out of the initial chunk (PIPE-02 / 200KB gzipped budget; Pitfall 2).

import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'
import { setCaps } from '@/stores/runtime'
import { probeCaps } from '@/lib/caps'

export function bootstrapSW(): void {
  // Pitfall 4: guard SW absence (Firefox private mode, older Safari, file://).
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    onNeedRefresh() {
      // Stable id 'sw-update' + duration:Infinity → toast never disappears
      // until the user clicks Reload or dismisses. Protects in-progress
      // optimize/queue from an auto-reload race (T-14-RELOAD).
      toast('New version available — reload?', {
        id: 'sw-update',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: () => {
            void updateSW(true)
          },
        },
      })
    },
    onOfflineReady() {
      // Replace the Phase 13 boot-probe placeholder with the real
      // precache-complete state. StatusBar D-09 reads caps.offlineReady to
      // RENDER the pill (HIDE-when-false rule).
      setCaps({ ...probeCaps(), offlineReady: true })
      toast.success('Ready to work offline', { duration: 3000 })
    },
  })

  // Playwright test hooks (gated to dev/test — production tree-shakes).
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const w = window as unknown as {
      __simulateSWNeedRefresh?: () => void
      __simulateSWOfflineReady?: () => void
    }
    w.__simulateSWNeedRefresh = () => {
      toast('New version available — reload?', {
        id: 'sw-update',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: () => {
            void updateSW(true)
          },
        },
      })
    }
    w.__simulateSWOfflineReady = () => {
      setCaps({ ...probeCaps(), offlineReady: true })
      toast.success('Ready to work offline', { duration: 3000 })
    }
  }
}
