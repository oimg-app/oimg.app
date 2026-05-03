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
  // Phase 4 (D-04) — density tag attribution: png-resize adapter populates
  // this with the variant density it produced ('1x' | '2x' | '3x'). Other
  // adapters omit. Used by App.tsx markDone callback for telemetry only;
  // does not affect output bytes.
  density?: '1x' | '2x' | '3x'
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
  /** Phase 4 D-11(b) — admission-gate input. Estimated peak working-set
   *  bytes for this job. SVG / stub jobs leave undefined → gate no-ops.
   *  PNG variant jobs populate via estimateJobBytes(srcW,srcH,tgtW,tgtH)
   *  from src/lib/memory-budget.ts (Plan 04-05 wires call site). */
  byteEstimate?: number
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
