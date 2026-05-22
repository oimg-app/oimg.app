// Phase 06, Plan 02/03 — INSP-08 ReportPanel
// Total savings stats grid + per-file bar chart + Format breakdown.
// Data flows from filesAtom (nanostores) — zero direct stub-data imports.

import { useStore } from '@nanostores/react'
import { Section } from './Section'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { filesAtom } from '@/stores/files'
import { fmtBytes, fmtPct } from '@/lib/format'

// Format label color convention — mirrors FileRow BADGE_CLASS.
// svg=purple, png=blue, jpg/jpeg=orange, webp=cyan, avif=rose
const FORMAT_COLOR: Record<string, string> = {
  svg: 'text-purple-400',
  png: 'text-blue-400',
  jpg: 'text-orange-400',
  jpeg: 'text-orange-400',
  webp: 'text-cyan-400',
  avif: 'text-rose-400',
}

export function ReportPanel() {
  const { entries } = useStore(filesAtom)

  if (entries.length === 0) {
    return (
      <div
        data-testid="report-empty"
        className="flex flex-col items-center justify-center h-full gap-2 px-4 py-8 text-center"
      >
        <p className="text-[12px] font-semibold text-[var(--color-fg-1)]">No files in queue</p>
        <p className="text-[11px] text-[var(--color-fg-2)]">
          Drop images into the queue to see savings data.
        </p>
      </div>
    )
  }

  // Total savings — derived from store entries, no useState for data.
  const origTotal = entries.reduce((s, e) => s + e.orig, 0)
  const optTotal = entries.reduce((s, e) => s + e.opt, 0)
  const savedTotal = origTotal - optTotal

  // Format breakdown — group entries by type.
  const breakdown = Object.entries(
    entries.reduce<Record<string, { count: number; saved: number }>>((acc, e) => {
      const key = e.type
      const saved = e.orig - e.opt
      if (!acc[key]) acc[key] = { count: 0, saved: 0 }
      acc[key].count += 1
      acc[key].saved += saved
      return acc
    }, {}),
  )

  return (
    <div data-testid="report-panel" className="flex flex-col gap-4 overflow-y-auto">
      {/* Total savings section */}
      <Section title="Total savings">
        {/* 2×2 stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Before */}
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
              Before
            </span>
            <span className="text-[14px] font-semibold font-mono">
              {fmtBytes(origTotal)}
            </span>
          </div>
          {/* After */}
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
              After
            </span>
            <span className="text-[14px] font-semibold font-mono">
              {fmtBytes(optTotal)}
            </span>
          </div>
          {/* Saved */}
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
              Saved
            </span>
            <span
              className="text-[14px] font-semibold font-mono"
              style={{ color: 'var(--color-accent)' }}
            >
              {'−' + fmtBytes(savedTotal)}
            </span>
          </div>
          {/* Files */}
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
              Files
            </span>
            <span className="text-[14px] font-semibold font-mono">
              {String(entries.length)}
            </span>
          </div>
        </div>

        {/* Per-file bar chart */}
        <TooltipProvider>
          <div className="flex items-end gap-[3px] h-[52px]">
            {entries.map((entry) => {
              // T-06-05: guard divide-by-zero for orig=0 entries.
              const savingsPct =
                entry.orig > 0
                  ? ((entry.orig - entry.opt) / entry.orig) * 100
                  : 0
              // Dynamic per-bar height — inline style is the documented exception for dynamic px values.
              const heightPx = Math.max(4, Math.round((savingsPct / 100) * 48))
              const barBg =
                savingsPct < 30 ? 'var(--color-warn)' : 'var(--color-accent)'

              return (
                <Tooltip key={entry.id}>
                  <TooltipTrigger asChild>
                    <div
                      data-testid="report-bar"
                      style={{ height: `${heightPx}px`, background: barBg }}
                      className="flex-1 rounded-sm cursor-default"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {entry.name} · {fmtPct(entry.orig, entry.opt)}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </Section>

      {/* Format breakdown section */}
      <Section title="Format breakdown">
        {breakdown.map(([fmt, { count, saved }], idx) => (
          <div key={fmt}>
            <div
              data-testid="format-row"
              className="grid grid-cols-[1fr_auto_auto] gap-2 items-center py-1.5"
            >
              {/* Format label — colored per convention */}
              <span
                className={`text-[11px] font-mono uppercase tracking-wider ${FORMAT_COLOR[fmt] ?? 'text-[var(--color-fg-1)]'}`}
              >
                {fmt}
              </span>
              {/* File count */}
              <span className="text-[11px] font-mono text-[var(--color-fg-2)]">
                {count} {count === 1 ? 'file' : 'files'}
              </span>
              {/* Bytes saved */}
              <span className="text-[11px] font-mono font-semibold">
                {fmtBytes(saved)}
              </span>
            </div>
            {/* Separator between rows, not after the last */}
            {idx < breakdown.length - 1 && <Separator />}
          </div>
        ))}
      </Section>
    </div>
  )
}
