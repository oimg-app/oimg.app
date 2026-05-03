// Phase 2 — Worker entry. Comlink.expose({ runJob }).
// Source: 02-RESEARCH.md §Pattern 1 (lines 191-217), §Pitfall 1 (lines 540-547).
// PERF-02: lazy-import adapter module on first use INSIDE the worker.
// Phase 2 only resolves 'stub'. Phase 3+ extends ADAPTERS map.
//
// SECURITY (T-02-03): static map keyed by AdapterFormat union — no dynamic
// string concatenation, no user-controlled module path. New adapters require
// an explicit entry here, gated by code review.

import * as Comlink from 'comlink'
import type { AdapterFormat, AdapterRunResult, WorkerProxyApi } from './types'

// CRITICAL: Static map of literal-path import functions.
// DO NOT use template literals (`./${format}-adapter.ts`) — Vite cannot
// statically resolve and the worker will 404 in production builds (Pitfall 1).
const ADAPTERS: Record<
  AdapterFormat,
  () => Promise<{
    run: (input: ArrayBuffer, settings: unknown) => Promise<AdapterRunResult>
  }>
> = {
  stub: () => import('./stub-adapter'),
  // Phase 3 plan 03-A — SVGO-only adapter (DOMPurify runs on main thread per D-01).
  // Phase 5+ adds: png/jpeg/webp/avif
  svg: () => import('./svg-adapter'),
  // Phase 4 plan 04-03 — PNG decode + resize + re-encode adapter (D-04 + D-14).
  // Each density variant is its own pool job; adapter sees 1:1 input → output.
  png: () => import('./png-adapter'),
  jpeg: () => {
    throw new Error('jpeg adapter not yet implemented (Phase 5)')
  },
  webp: () => {
    throw new Error('webp adapter not yet implemented (Phase 5)')
  },
  avif: () => {
    throw new Error('avif adapter not yet implemented (Phase 5)')
  },
}

const api: WorkerProxyApi = {
  async runJob(input, settings, format) {
    const mod = await ADAPTERS[format]()
    const { output, meta } = await mod.run(input, settings)
    // Zero-copy hand-back to main thread (Pitfall 2 — output is now detached here).
    return Comlink.transfer({ output, meta }, [output])
  },
}

Comlink.expose(api)
