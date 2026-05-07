import { useMemo } from 'react'
import { useFilesStore } from '@/stores'

export function useTotals() {
  const filesById = useFilesStore((s) => s.byId)
  const filesOrder = useFilesStore((s) => s.order)

  const totals = useMemo(() => {
    const entries = filesOrder.map((id) => filesById[id]).filter(Boolean)
    const orig = entries.reduce((s, f) => s + (f?.originalSize ?? 0), 0)
    const opt = entries.reduce((s, f) => s + (f?.optimizedSize ?? f?.originalSize ?? 0), 0)
    const pct = orig === 0 ? 0 : ((orig - opt) / orig) * 100
    return { orig, opt, saved: orig - opt, pct }
  }, [filesById, filesOrder])

  return { ...totals, filesCount: filesOrder.length }
}
