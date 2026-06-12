// Phase 01-foundation / Plan 05 — SHELL-01 root component
// Phase 11 Plan 05 (Rule 2 auto-add): mount sonner Toaster so toast.success/error
// surface to the user — required by D-07 (single-file save errors) and D-12
// (ZIP export skipped-count notification). Was missing app-wide.
// Phase 14 Plan 04 (PWA-05 + PIPE-02): defer SW registration via
// requestIdleCallback + dynamic import so register-sw stays out of the initial
// chunk (Pitfall 2 — preserves 200KB gzipped budget) and never blocks first
// paint. setTimeout(2000) fallback for Safari (no requestIdleCallback support).
import { useEffect } from 'react'
import { AppShell } from '@/components/shell'
import { Toaster } from '@/components/ui/sonner'
import { useClipboardIngest } from '@/hooks/useClipboardIngest'

export default function App() {
  useClipboardIngest() // Phase 15 — ING-02: document-level Cmd/Ctrl+V handler.

  useEffect(() => {
    // Defer SW registration past first paint. Dynamic import keeps
    // src/lib/register-sw.ts (and the virtual:pwa-register runtime) out of the
    // initial chunk — PIPE-02 / 200KB gzipped budget gate (Plan 14-04 Task 3).
    const bootstrap = () => {
      void import('@/lib/register-sw').then((m) => m.bootstrapSW())
    }

    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number
        cancelIdleCallback?: (id: number) => void
      }
    )

    if (typeof ric.requestIdleCallback === 'function') {
      const id = ric.requestIdleCallback(bootstrap)
      return () => {
        ric.cancelIdleCallback?.(id)
      }
    }

    // Safari fallback — schedule past LCP budget without blocking paint.
    const handle = window.setTimeout(bootstrap, 2000)
    return () => {
      window.clearTimeout(handle)
    }
  }, [])

  return (
    <>
      <AppShell />
      <Toaster position="bottom-right" />
    </>
  )
}
