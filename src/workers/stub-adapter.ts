// Phase 2 acceptance gate — round-trips bytes unchanged via input.slice(0).
// Source: 02-RESEARCH.md §Code Examples lines 588-605 (verbatim).
// Phase 3+ replaces with svg-adapter.ts, png-adapter.ts, etc.
//
// CRITICAL: copy bytes via slice(0). Do NOT return the same ArrayBuffer —
// Comlink.transfer on the way back would detach the input we just received
// (Pitfall 2). slice(0) allocates a fresh buffer.

import type { AdapterMeta } from './types'

export async function run(
  input: ArrayBuffer,
  _settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const output = input.slice(0)
  return { output, meta: { unchanged: true } }
}
