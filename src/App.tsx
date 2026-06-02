// Phase 01-foundation / Plan 05 — SHELL-01 root component
// Phase 11 Plan 05 (Rule 2 auto-add): mount sonner Toaster so toast.success/error
// surface to the user — required by D-07 (single-file save errors) and D-12
// (ZIP export skipped-count notification). Was missing app-wide.
import { AppShell } from '@/components/shell'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <>
      <AppShell />
      <Toaster position="bottom-right" />
    </>
  )
}
