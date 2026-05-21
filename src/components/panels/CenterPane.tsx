// Phase 05 — CENTER-01: CenterPane shell composing header / compare stage / delta strip
import { CenterHeader } from './center/CenterHeader'
import { CompareStage } from './center/CompareStage'

export function CenterPane() {
  return (
    <div
      data-testid="center-pane"
      className="flex flex-col h-full min-h-0 bg-[var(--color-bg-0)] overflow-hidden"
    >
      <CenterHeader />
      <CompareStage />
      {/* DeltaStrip placeholder — replaced entirely in Plan 05-02 */}
      <div className="h-[72px] shrink-0 border-t border-[var(--color-line)] bg-[var(--color-bg-1)] flex items-center justify-center">
        <span className="text-[11px] font-mono text-[var(--color-fg-3)]">DeltaStrip — Plan 05-02</span>
      </div>
    </div>
  )
}
