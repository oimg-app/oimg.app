// Phase 12 — D-14/D-15: copyToClipboard chokepoint — navigator.clipboard.writeText →
// hidden-textarea+execCommand fallback → sonner toast on every call.
// Source: 12-CONTEXT.md D-14/D-15.
// Analog: src/lib/save-blob.ts (Phase 11 EXP-01 dispatcher — feature-detect, silent
// fallback, no throw to caller).
//
// Contract:
//   - Feature-detect window.isSecureContext === true AND 'clipboard' in navigator
//     AND typeof navigator.clipboard.writeText === 'function' before invoking native API.
//   - On rejection / missing API / non-secure: fallback to a positioned-offscreen <textarea>
//     + select() + document.execCommand('copy'), then remove the node.
//   - Toast on every call — success: `${label} copied`; failure (both paths fail):
//     'Copy failed — try again'. Uses sonner `toast.success` / `toast.error`.
//   - NEVER throws to caller — returns { ok, method } for the caller to ignore.
//   - T-12-04: try/finally guarantees the textarea is removed even on synchronous throw.
//
// Zero-telemetry: no console.log, no console.error, no analytics.
import { toast } from 'sonner'

export type CopyKind = 'snippet' | 'manifest' | 'data-uri'

export interface CopyResult {
  ok: boolean
  method: 'native' | 'execCommand' | 'failed'
}

export async function copyToClipboard(
  text: string,
  kind: CopyKind,
  label: string,
): Promise<CopyResult> {
  // kind is accepted for the chokepoint signature but unused in v1 (future analytics
  // off-ramp per D-14 last sentence). TypeScript "unused param" is fine on exported
  // function signatures.
  void kind

  const canUseNative =
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    'clipboard' in navigator &&
    typeof navigator.clipboard?.writeText === 'function'

  if (canUseNative) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
      return { ok: true, method: 'native' }
    } catch {
      // Fall through to execCommand path — do NOT toast yet (fallback may still succeed).
    }
  }

  // Fallback: positioned-offscreen <textarea> + execCommand('copy').
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.width = '1px'
  ta.style.height = '1px'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  document.body.appendChild(ta)
  ta.select()

  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    // T-12-04: guaranteed cleanup even if execCommand throws synchronously.
    document.body.removeChild(ta)
  }

  if (ok) {
    toast.success(`${label} copied`)
    return { ok: true, method: 'execCommand' }
  }
  toast.error('Copy failed — try again')
  return { ok: false, method: 'failed' }
}
