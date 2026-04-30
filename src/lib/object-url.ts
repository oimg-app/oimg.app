// Phase 2 — Object URL lifecycle helpers (sugar over useRuntimeStore.urlCache).
// Source: 02-RESEARCH.md §Pattern 5 (lines 437-470), 02-PATTERNS.md lines 246-265.
// Lets non-React call sites (worker pool, tests) interact with the URL cache.

import { useRuntimeStore } from '@/stores'

export function getOrCreateObjectURL(fileId: string, blob: Blob): string {
  return useRuntimeStore.getState().getOrCreateObjectURL(fileId, blob)
}

export function revokeObjectURL(fileId: string): void {
  useRuntimeStore.getState().revokeObjectURL(fileId)
}
