// Phase 2 — Object URL lifecycle helpers (sugar over runtimeStore.urlCache).
// Source: 02-RESEARCH.md §Pattern 5 (lines 437-470), 02-PATTERNS.md lines 246-265.
// Lets non-React call sites (worker pool, tests) interact with the URL cache.

import { getOrCreateObjectURL as _get, revokeObjectURL as _revoke } from '@/stores/runtime'

export function getOrCreateObjectURL(fileId: string, blob: Blob): string {
  return _get(fileId, blob)
}

export function revokeObjectURL(fileId: string): void {
  _revoke(fileId)
}
