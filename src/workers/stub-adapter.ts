// Phase 2 acceptance gate — round-trips bytes unchanged via input.slice(0).
// Source: 02-RESEARCH.md §Code Examples lines 588-605 (verbatim).
// Phase 3+ replaces with svg-adapter.ts, png-adapter.ts, etc.
//
// CRITICAL: copy bytes via slice(0). Do NOT return the same ArrayBuffer —
// Comlink.transfer on the way back would detach the input we just received
// (Pitfall 2). slice(0) allocates a fresh buffer.
//
// Phase 2 plan 02-04 (B11): supports an optional `slowMs` settings field used by
// VR-03 (cancel correctness) tests to inject artificial delay so the cancel
// path can race with in-flight work. Production adapters (Phase 3+) MUST NOT
// implement slowMs — it is a stub-only test affordance.

import type { AdapterMeta } from './types'

export async function run(
  input: ArrayBuffer,
  settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const slowMs = (settings as { slowMs?: number } | null)?.slowMs ?? 0
  if (slowMs > 0) await new Promise((r) => setTimeout(r, slowMs))
  const output = input.slice(0)
  return { output, meta: { unchanged: true } }
}
