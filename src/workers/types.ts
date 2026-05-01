// Phase 2 — Shared worker types: adapter contract, error taxonomy, job shape.
// Source: 02-CONTEXT.md D-04, D-05, D-06; 02-RESEARCH.md §Pattern 1 + Open Question 2.
// Phase 3+ extends AdapterFormat union; Phase 5 may subclass AdapterError for retry logic.

export type AdapterFormat = 'stub' | 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'

export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
  // Phase 3 — populated by the SVG path only; produced on the main thread by
  // src/lib/sanitize-svg.ts after the worker returns SVGO-optimized bytes.
  // 0 = clean (no removals); undefined = non-svg adapter run.
  sanitizedCount?: number
}

export interface AdapterRunResult {
  output: ArrayBuffer
  meta: AdapterMeta
}

export type AdapterRun<TSettings = unknown> = (
  input: ArrayBuffer,
  settings: TSettings
) => Promise<AdapterRunResult>

/** Comlink proxy surface exposed by each worker. */
export interface WorkerProxyApi {
  runJob: (
    input: ArrayBuffer,
    settings: unknown,
    format: AdapterFormat
  ) => Promise<AdapterRunResult>
}

/** A pool job — internal to WorkerPool. */
export interface PoolJob {
  id: string
  fileId: string
  format: AdapterFormat
  settings: unknown
  blob: Blob
}

/** Phase 2 starts with one error class; Phase 5 subclasses for retry logic. */
export class AdapterError extends Error {
  constructor(
    public format: string,
    public phase: 'decode' | 'process' | 'encode',
    message: string
  ) {
    super(`[${format}:${phase}] ${message}`)
    this.name = 'AdapterError'
  }
}
