// Phase 05 — CENTER-01: CenterPane shell. Updated: CENTER-04 (DeltaStrip wired)
import { CenterHeader } from './center/CenterHeader'
import { CompareStage } from './center/CompareStage'
import { DeltaStrip } from './center/DeltaStrip'

export function CenterPane() {
  return (
    <div
      data-testid="center-pane"
      className="flex flex-col h-full min-h-0 bg-[var(--color-bg-0)] overflow-hidden"
    >
      <CenterHeader />
      <CompareStage />
      <DeltaStrip />
    </div>
  )
}
