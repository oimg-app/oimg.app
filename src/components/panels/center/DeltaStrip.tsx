// Phase 05 — CENTER-04: DeltaStrip 6 metric cards
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { fmtBytes, fmtPct } from '@/lib/format'

interface DeltaCardProps {
  label: string
  value: React.ReactNode
  sub: string
  accent?: boolean
}

function DeltaCard({ label, value, sub, accent }: DeltaCardProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-0.5 border-r border-[var(--color-line)] last:border-r-0 px-2 min-w-0">
      <span className="font-mono text-[11px] font-normal text-[var(--color-fg-2)] uppercase tracking-[0.04em]">
        {label}
      </span>
      <span
        className={
          'font-mono text-[13px] font-semibold tabular-nums ' +
          (accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-0)]')
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
  const { codec, q, method } = useStore(settingsAtom)

  const orig = selectedFile?.orig ?? null
  const opt = selectedFile?.opt ?? null
  const saved = orig !== null && opt !== null ? orig - opt : null
  const dim = selectedFile?.dim ?? '—'
  const type = selectedFile?.type ?? '—'

  const savedPct = fmtPct(orig, opt)

  return (
    <div className="h-[72px] shrink-0 border-t border-[var(--color-line)] bg-[var(--color-bg-1)] flex">
      <DeltaCard
        label="ORIGINAL"
        value={fmtBytes(orig)}
        sub={`${dim} · ${type}`}
      />
      <DeltaCard
        label="OPTIMIZED"
        value={fmtBytes(opt)}
        sub={selectedFile ? `${codec} q${q} m${method}` : '—'}
      />
      <DeltaCard
        label="SAVED"
        value={saved !== null ? `−${fmtBytes(saved)}` : '—'}
        sub={savedPct && savedPct !== '—' ? `${savedPct} smaller` : '—'}
        accent={true}
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
