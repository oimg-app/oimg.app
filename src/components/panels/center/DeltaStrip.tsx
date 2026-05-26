// Phase 05 — CENTER-04: DeltaStrip 6 metric cards
// Phase 09 — Plan 04: real encodedBuffer size + in-flight shimmer (UI-SPEC §4) + (fallback) on error (D-13)
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { runtimeAtom } from '@/stores/runtime'
import { fmtBytes, fmtPct } from '@/lib/format'

interface DeltaCardProps {
  label: string
  value: React.ReactNode
  sub: string
  accent?: boolean
  shimmer?: boolean
}

function DeltaCard({ label, value, sub, accent, shimmer }: DeltaCardProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-0.5 border-r border-[var(--color-line)] last:border-r-0 px-2 min-w-0">
      <span className="font-mono text-[11px] font-normal text-[var(--color-fg-2)] uppercase tracking-[0.04em]">
        {label}
      </span>
      <span
        className={
          'font-mono text-[13px] font-semibold tabular-nums ' +
          (shimmer
            ? 'text-[var(--color-fg-3)] animate-pulse'
            : accent
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-fg-0)]')
        }
      >
        {value}
      </span>
      <span className="font-mono text-[11px] font-normal text-[var(--color-fg-3)] truncate">
        {sub}
      </span>
    </div>
  )
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

  const savedValue = isEncoding ? '···' : (saved !== null ? `−${fmtBytes(saved)}` : '—')

  return (
    <div className="h-[72px] shrink-0 border-t border-[var(--color-line)] bg-[var(--color-bg-1)] flex">
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
      <DeltaCard
        label="SSIM"
        value="0.987"
        sub="visually identical"
      />
      <DeltaCard
        label="BUTTERAUGLI"
        value="1.24"
        sub="target <= 1.40"
      />
      <DeltaCard
        label="DECODE"
        value="38ms"
        sub="est. on 4G"
      />
    </div>
  )
}
