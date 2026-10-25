// Phase 05 — CENTER-04: DeltaStrip 6 metric cards
// Phase 09 — Plan 04: real encodedBuffer size + in-flight shimmer (UI-SPEC §4) + (fallback) on error (D-13)
// change:remove-dead-ui-and-fix-a11y — SSIM/Butteraugli read the selected file's computed metrics
//   ("—" pending / no selection, "N/A" not applicable) instead of literals; Decode is "—" without bytes.
//   Below 900 px the six cards wrap into two rows of three (narrow layout).
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { runtimeAtom } from '@/stores/runtime'
import { fmtBytes, fmtPct } from '@/lib/format'
import {estimateDownloadTime} from "@/lib/estimate-download.ts";
import { ssimBand, butteraugliBand, BAND_COLOR, BAND_LABEL, type Band } from '@/lib/metrics-bands'

interface DeltaCardProps {
  label: string
  value: React.ReactNode
  sub: string
  accent?: boolean
  shimmer?: boolean
  /** Band color for a computed quality metric; overrides the neutral value color. */
  color?: string
}

function DeltaCard({ label, value, sub, accent, shimmer, color }: DeltaCardProps) {
  // change:add-black-box-e2e-suite — card testids derive from the label so the set stays
  // in step with the cards themselves; no separate id list to drift.
  const slug = label.toLowerCase()
  return (
    <div
      data-testid={`center-delta-card-${slug}`}
      className="flex flex-col items-center justify-center flex-1 gap-0.5 border-r border-[var(--color-line)] last:border-r-0 px-2 min-w-0 max-[899.98px]:basis-1/3 max-[899.98px]:py-2"
    >
      <span className="font-mono text-xs font-normal text-[var(--color-fg-2)] uppercase tracking-[0.04em]">
        {label}
      </span>
      <span
        data-testid={`center-delta-value-${slug}`}
        className={
          'font-mono text-[13px] font-semibold tabular-nums ' +
          (shimmer
            ? 'text-[var(--color-fg-3)] animate-pulse'
            : accent
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-fg-0)]')
        }
        style={color && !shimmer ? { color } : undefined}
      >
        {value}
      </span>
      <span className="font-mono text-xs font-normal text-[var(--color-fg-3)] truncate">
        {sub}
      </span>
    </div>
  )
}

function msToSec(ms: number, fractionDigits = 2) {
    if (ms < 1000) return `${ms} ms`;

    const seconds = ms / 1000;

    const sec = parseFloat(seconds.toFixed(fractionDigits));

    return `${sec} sec`;
}

// Same three states as the Report tab: undefined = not computed yet (or nothing selected),
// null = the metric failed or does not apply to this file, number = measured.
function metricCard(
  v: number | null | undefined,
  fmt: (v: number) => string,
  band: (v: number) => Band,
): { value: string; sub: string; color?: string } {
  if (v === undefined) return { value: '—', sub: '—' }
  if (v === null) return { value: 'N/A', sub: 'not measured' }
  const b = band(v)
  return { value: fmt(v), sub: BAND_LABEL[b], color: BAND_COLOR[b] }
}

export function DeltaStrip() {
  const selectedFile = useStore($selectedFile)
  const globalSettings = useStore(settingsAtom)
  const { encodingFileId } = useStore(runtimeAtom)

  // D-03: read codec/q/method from the file's own settings, not global settingsAtom
  const { codec, q, method } = selectedFile?.settings ?? globalSettings

  const orig = selectedFile?.orig ?? null

  // D-05: use real encoded bytes when available
  const opt = selectedFile?.encodedBuffer
    ? selectedFile.encodedBuffer.byteLength
    : selectedFile?.opt ?? null

  const saved = orig !== null && opt !== null ? orig - opt : null
  const dim = selectedFile?.dim ?? '—'
  const type = selectedFile?.type ?? '—'
  const savedPct = fmtPct(orig, opt)

  // UI-SPEC §4: shimmer when this file is being encoded
  const isEncoding = !!selectedFile && encodingFileId === selectedFile.id

  // D-13: error fallback — show original size with "(fallback)" suffix
  const hasError = !!selectedFile?.error
  const optimizedValue = isEncoding
    ? '···'
    : hasError
      ? <>{fmtBytes(orig)} <span className="text-[var(--color-fg-3)]">(fallback)</span></>
      : fmtBytes(opt)

  const savedValue = isEncoding ? '···' : (saved !== null ? `−${fmtBytes(saved)}` : '—');

  const encodedBuffer = selectedFile?.encodedBuffer ?? null
  const decodeTime = estimateDownloadTime(encodedBuffer);
  const ssim = metricCard(selectedFile?.metrics?.ssim, (v) => v.toFixed(3), ssimBand)
  const butteraugli = metricCard(selectedFile?.metrics?.butteraugli, (v) => v.toFixed(2), butteraugliBand)

  return (
    <div
      data-testid="center-delta-strip"
      className="h-[72px] shrink-0 border-t border-[var(--color-line)] bg-color-bg-1 flex max-[899.98px]:h-auto max-[899.98px]:flex-wrap"
    >
      <DeltaCard
        label="ORIGINAL"
        value={fmtBytes(orig)}
        sub={`${dim} · ${type}`}
      />
      <DeltaCard
        label="OPTIMIZED"
        value={optimizedValue}
        sub={selectedFile ? `${codec} q${q} m${method}` : '—'}
        shimmer={isEncoding}
      />
      <DeltaCard
        label="SAVED"
        value={savedValue}
        sub={!isEncoding && savedPct && savedPct !== '—' ? `${savedPct} smaller` : '—'}
        accent={!isEncoding}
        shimmer={isEncoding}
      />
      <DeltaCard label="SSIM" {...ssim} />
      <DeltaCard label="BUTTERAUGLI" {...butteraugli} />
      <DeltaCard
        label="DECODE"
        value={encodedBuffer ? msToSec(decodeTime["4G"]) : '—'}
        sub={encodedBuffer ? 'est. on 4G' : '—'}
      />
    </div>
  )
}
