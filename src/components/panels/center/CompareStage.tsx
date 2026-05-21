// Phase 05 — CENTER-03: CompareStage compare view with CSS --split var
import { useRef } from 'react'
import { useStore } from '@nanostores/react'
import { uiAtom, setSplit } from '@/stores/ui'
import { $selectedFile } from '@/stores/files'
import { fmtBytes } from '@/lib/format'

export function CompareStage() {
  const { split } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function handleMouseDown() {
    if (!frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    dragging.current = true

    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(98, Math.max(2, pct))
      setSplit(clamped)
    }

    function onUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--color-bg-0)]">
      {/* image-frame */}
      <div
        ref={frameRef}
        className="relative w-full h-full overflow-hidden"
        style={{ '--split': split + '%' } as React.CSSProperties}
      >
        {/* layer-orig */}
        <div
          className="absolute inset-0 bg-[var(--color-bg-2)]"
          style={{ clipPath: 'inset(0 calc(100% - var(--split)) 0 0)' }}
        />

        {/* layer-opt */}
        <div
          className="absolute inset-0 bg-[var(--color-bg-3)]"
          style={{ clipPath: 'inset(0 0 0 var(--split))' }}
        />

        {/* split-handle */}
        <div
          className="absolute top-0 bottom-0 w-1 cursor-col-resize bg-[var(--color-accent)]"
          style={{ left: 'var(--split)', transform: 'translateX(-50%)' }}
          onMouseDown={handleMouseDown}
        />

        {/* Split label left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-[4px] font-mono text-[11px] font-semibold text-[var(--color-fg-2)] bg-[var(--color-bg-0)]/70 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[var(--color-fg-3)] shrink-0" />
          ORIGINAL · {fmtBytes(selectedFile?.orig ?? null)}
        </div>

        {/* Split label right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-[4px] font-mono text-[11px] font-semibold text-[var(--color-fg-2)] bg-[var(--color-bg-0)]/70 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
          {selectedFile?.target.toUpperCase() ?? '—'} · {fmtBytes(selectedFile?.opt ?? null)}
        </div>
      </div>
    </div>
  )
}
