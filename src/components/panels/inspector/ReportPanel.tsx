// Phase 06, Plan 02/03 — INSP-08 ReportPanel
// Total savings stats grid + per-file bar chart + Format breakdown.
// Data flows from filesAtom (nanostores) — zero direct stub-data imports.

import { useStore } from '@nanostores/react'
import { DownloadSimple } from '@phosphor-icons/react'
import { Section } from './Section'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Tooltip2,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip2'
import { filesAtom, $selectedFile } from '@/stores/files'
import { fmtBytes, fmtPct } from '@/lib/format'
import { useExport } from '@/hooks/useExport'
import { ssimBand, SSIM_BANDS, butteraugliBand, BUTTERAUGLI_BANDS, type Band } from '@/lib/metrics-bands'

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

// Phase 16 — MTR-03: banded SSIM color map. CSS custom properties resolve at render;
// keep values in one place so 16-02 threshold moves don't fan out to arbitrary text nodes.
const BAND_COLOR: Record<Band, string> = {
  green: 'var(--color-accent)',
  yellow: 'var(--color-warn)',
  red: 'var(--color-error)',
}

export function ReportPanel() {
  const { entries } = useStore(filesAtom)
  const selected = useStore($selectedFile)
  const { exportOne } = useExport()

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
      {/* Phase 11 Plan 04 — D-04/D-07: Inspector Download button for the selected file.
          Only renders when the selected file has finished optimizing (status === 'done').
          The onClick body is a single statement per CLAUDE.md hooks/components rule. */}
      {selected && selected.status === 'done' && (
        <Button
          data-testid="inspector-download"
          onClick={() => { void exportOne(selected) }}
          aria-label="Download optimized file"
          className="self-start gap-1.5"
          variant="ghost"
          size="sm"
        >
          <DownloadSimple size={14} />
          Download
        </Button>
      )}
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
                <Tooltip2 key={entry.id}>
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
                </Tooltip2>
              )
            })}
          </div>
        </TooltipProvider>
      </Section>

      {/* Phase 16 — MTR-03: banded SSIM display; constants from @/lib/metrics-bands. */}
      {selected?.status === 'done' && selected.type.toLowerCase() !== 'svg' && (
        <Section title="Quality">
          <div
            data-testid="ssim-row"
            className="flex items-baseline justify-between"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
              SSIM
            </span>
            {selected.metrics?.ssim === undefined ? (
              <span className="text-[12px] font-mono text-[var(--color-fg-2)]">
                Computing…
              </span>
            ) : selected.metrics.ssim === null ? (
              <span className="text-[12px] font-mono text-[var(--color-fg-2)]">
                N/A
              </span>
            ) : (
              <span
                data-testid="ssim-score"
                data-band={ssimBand(selected.metrics.ssim)}
                className="text-[14px] font-semibold font-mono"
                style={{ color: BAND_COLOR[ssimBand(selected.metrics.ssim)] }}
              >
                {selected.metrics.ssim.toFixed(3)}
              </span>
            )}
          </div>
          {/* Phase 17 — MTR-02/MTR-03: banded Butteraugli display; constants from @/lib/metrics-bands. Lower is better — strict `<` boundaries. */}
          <div
            data-testid="butteraugli-row"
            className="flex items-baseline justify-between mt-2"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
              Butteraugli
            </span>
            {selected.metrics?.butteraugli === undefined ? (
              <span className="text-[12px] font-mono text-[var(--color-fg-2)]">
                Computing…
              </span>
            ) : selected.metrics.butteraugli === null ? (
              <span className="text-[12px] font-mono text-[var(--color-fg-2)]">
                N/A
              </span>
            ) : (
              <span
                data-testid="butteraugli-score"
                data-band={butteraugliBand(selected.metrics.butteraugli)}
                className="text-[14px] font-semibold font-mono"
                style={{ color: BAND_COLOR[butteraugliBand(selected.metrics.butteraugli)] }}
              >
                {selected.metrics.butteraugli.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-fg-2)] mt-1">
            SSIM: higher is better · Butteraugli: lower is better
            <br />
            SSIM: Green ≥ {SSIM_BANDS.green} · Yellow ≥ {SSIM_BANDS.yellow} · Red below.
            <br />
            Butteraugli: Green &lt; {BUTTERAUGLI_BANDS.green} · Yellow &lt; {BUTTERAUGLI_BANDS.yellow} · Red above.
          </p>
        </Section>
      )}

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
