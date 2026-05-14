// Byte / percentage formatters — ported from example-ui/data.jsx with zero-savings guard (returns '').
// Phase 01, Plan 04 — STORE-06

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}

export function fmtPct(orig: number | null | undefined, opt: number | null | undefined): string {
  if (orig == null || opt == null) return '—'
  if (orig === 0) return '—'
  const saved = ((orig - opt) / orig) * 100
  if (saved === 0) return ''
  // U+2212 MINUS SIGN (not ASCII '-') for savings; ASCII '+' for increases.
  return (saved > 0 ? '−' : '+') + Math.abs(saved).toFixed(1) + '%'
}
