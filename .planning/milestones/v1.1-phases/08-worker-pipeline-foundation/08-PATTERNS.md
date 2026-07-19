# Phase 8: Worker Pipeline Foundation — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 5 new/modified files
**Analogs found:** 4 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/workers/codec.worker.ts` | worker | event-driven | none (first worker file) | no-analog |
| `src/lib/worker-pool.ts` | utility | event-driven | `src/lib/format.ts` (pure TS module, named exports) | structure-only |
| `src/hooks/useOptimize.ts` | hook | request-response | none (no hooks dir yet) | structure-only |
| `src/stores/runtime.ts` | store | CRUD | `src/stores/runtime.ts` itself (extend, not replace) | exact |
| `src/tests/worker-pipeline.spec.ts` | test | request-response | `src/tests/backpressure.spec.ts` | exact |

---

## Pattern Assignments

### `src/stores/runtime.ts` (store, CRUD) — MODIFY

**Analog:** `src/stores/runtime.ts` (the file itself — extend, not replace)

**Current shape** (lines 1–47 — read the file before editing):
```typescript
import { map } from 'nanostores'

interface RuntimeState {
  running: boolean
  toasts: Toast[]
  svgoVersion: string
  codecVersion: string
  wasmInfo: string
}

export const runtimeAtom = map<RuntimeState>({
  running: false,
  toasts: [],
  svgoVersion: '4.0.1',
  codecVersion: '0.6.0',
  wasmInfo: 'WASM ready · 312 KB',
})
```

**Existing action pattern** (lines 26–47):
```typescript
export function startRun(): void {
  runtimeAtom.setKey('running', true)
}

export function stopRun(): void {
  runtimeAtom.setKey('running', false)
}
```

**Extension pattern — add to interface + initial state + new action:**
```typescript
// Add to RuntimeState interface (keep running: boolean — BackpressureIndicator reads it):
interface RuntimeState {
  running: boolean       // KEEP — boolean — BackpressureIndicator reads this
  runningJobs: number    // NEW — active worker count
  queuedJobs: number     // NEW — waiting in pool queue
  toasts: Toast[]
  svgoVersion: string
  codecVersion: string
  wasmInfo: string
}

// Add to initial runtimeAtom value:
export const runtimeAtom = map<RuntimeState>({
  running: false,
  runningJobs: 0,
  queuedJobs: 0,
  toasts: [],
  // ... rest unchanged
})

// New action — called by WorkerPool.onCountChange:
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.set({
    ...runtimeAtom.get(),
    runningJobs: running,
    queuedJobs: queued,
    running: running > 0 || queued > 0,  // drives BackpressureIndicator boolean
  })
}
```

**Critical constraint:** `running` MUST remain `boolean`. Renaming or retyping it to `number` breaks `BackpressureIndicator` (line 7: `const { running } = useStore(runtimeAtom)`) and the Playwright test contract in `backpressure.spec.ts` (checks `opacity-0` class based on truthy/falsy `running`).

---

### `src/workers/codec.worker.ts` (worker, event-driven) — CREATE

**Analog:** None — first worker file. Use pattern from RESEARCH.md Code Examples + comlink README.

**Import pattern (copy verbatim):**
```typescript
import * as Comlink from 'comlink'
```

**Type definitions to export (consumers import from this file):**
```typescript
export interface EncodeJob {
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'
  buffer: ArrayBuffer
  settings: Record<string, unknown>
}

export interface EncodeResult {
  buffer: ArrayBuffer
  originalSize: number
  optimizedSize: number
}
```

**Core pattern — Comlink.expose at bottom of file:**
```typescript
async function optimize(job: EncodeJob): Promise<EncodeResult> {
  const { codec, buffer, settings } = job
  switch (codec) {
    case 'PNG': {
      const { decode } = await import('@jsquash/png')
      const { optimise } = await import('@jsquash/oxipng')
      const imageData = await decode(buffer)
      const result = await optimise(imageData, { level: (settings.level as number) ?? 3 })
      return { buffer: result, originalSize: buffer.byteLength, optimizedSize: result.byteLength }
    }
    // other cases are stubs in Phase 8 — throw NotImplementedError
    default:
      throw new Error(`Codec not yet implemented: ${codec}`)
  }
}

Comlink.expose({ optimize })
```

**Dev guard (add after imports):**
```typescript
if (import.meta.env.DEV && !crossOriginIsolated) {
  console.warn('[codec-worker] crossOriginIsolated is false — OxiPNG MT disabled')
}
```

**Anti-pattern to avoid:** Do NOT use static top-level imports for `@jsquash/*` — all codec imports MUST be `await import(...)` inside the switch branch to preserve code-splitting.

---

### `src/lib/worker-pool.ts` (utility, event-driven) — CREATE

**Analog:** `src/lib/format.ts` — pure TypeScript module, named exports, no framework imports. Copy the module structure: file header comment citing phase/plan, named exports, no default export.

**File header pattern** (from `src/lib/format.ts` line 1):
```typescript
// Phase 08 — PIPE-01: WorkerPool — bounded concurrency + job queue. Source: 08-01-PLAN.md
```

**Import pattern:**
```typescript
import * as Comlink from 'comlink'
import type { EncodeJob, EncodeResult } from '@/workers/codec.worker'
```

**Core class pattern:**
```typescript
type WorkerApi = { optimize: (job: EncodeJob) => Promise<EncodeResult> }

interface PendingJob {
  job: EncodeJob
  resolve: (r: EncodeResult) => void
  reject: (e: unknown) => void
}

export class WorkerPool {
  private workers: Array<Comlink.Remote<WorkerApi>> = []
  private idle: Array<Comlink.Remote<WorkerApi>> = []
  private queue: PendingJob[] = []
  private _active = 0

  get active() { return this._active }
  get queued() { return this.queue.length }

  constructor(
    private readonly size: number,
    private readonly onCountChange: (active: number, queued: number) => void
  ) {
    for (let i = 0; i < size; i++) {
      // CRITICAL: literal URL string — no template literals; Vite static analysis requires this form
      const w = new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })
      const proxy = Comlink.wrap<WorkerApi>(w)
      this.workers.push(proxy)
      this.idle.push(proxy)
    }
  }

  run(job: EncodeJob): Promise<EncodeResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject })
      this.onCountChange(this._active, this.queue.length)
      this._drain()
    })
  }

  private _drain(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!
      const pending = this.queue.shift()!
      this._active++
      this.onCountChange(this._active, this.queue.length)
      worker.optimize(pending.job).then(
        (result) => { pending.resolve(result); this._release(worker) },
        (err) => { pending.reject(err); this._release(worker) }
      )
    }
  }

  private _release(worker: Comlink.Remote<WorkerApi>): void {
    this._active--
    this.idle.push(worker)
    this.onCountChange(this._active, this.queue.length)
    this._drain()
  }
}
```

**Module singleton pattern (add after class):**
```typescript
let _instance: WorkerPool | null = null

export function getPool(): WorkerPool {
  if (!_instance) {
    const size = Math.min(navigator.hardwareConcurrency ?? 4, 4)
    _instance = new WorkerPool(size, (active, queued) => {
      // Lazy import avoids circular dep: worker-pool → stores/runtime
      import('@/stores/runtime').then(({ setJobCounts }) => setJobCounts(active, queued))
    })
  }
  return _instance
}
```

**HMR cleanup (add after singleton, dev only):**
```typescript
if (import.meta.hot) {
  import.meta.hot.dispose(() => { _instance = null })
}
```

---

### `src/hooks/useOptimize.ts` (hook, request-response) — CREATE

**Analog:** No hooks directory exists. Follow the pattern from `src/stores/runtime.ts` for nanostores action functions, and `src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx` for `useStore` usage.

**Import pattern:**
```typescript
import { useStore } from '@nanostores/react'
import { filesAtom } from '@/stores/files'
import { getPool } from '@/lib/worker-pool'
```

**Core hook pattern — bridge filesAtom → pool.run():**
```typescript
export function useOptimize() {
  const { entries } = useStore(filesAtom)

  async function runOptimize() {
    const pool = getPool()
    const jobs = entries.map((entry) => ({
      codec: entry.type.toUpperCase() as EncodeJob['codec'],
      buffer: entry.buffer,          // real buffer in phase 9+; phase 8 uses stub
      settings: {},
    }))
    await Promise.allSettled(jobs.map((job) => pool.run(job)))
  }

  return { runOptimize }
}
```

---

### `src/tests/worker-pipeline.spec.ts` (test, request-response) — CREATE

**Analog:** `src/tests/backpressure.spec.ts` — copy structure verbatim.

**File header + describe block pattern** (from `src/tests/backpressure.spec.ts` lines 1–4):
```typescript
// Phase 08 — PIPE-01/02/03 spec. Source: 08-01-PLAN.md
import { test, expect } from '@playwright/test'

test.describe('Worker Pipeline — PIPE-01/02/03', () => {
```

**PIPE-03 test pattern (crossOriginIsolated check):**
```typescript
  test('crossOriginIsolated is true (PIPE-03)', async ({ page }) => {
    await page.goto('/')
    const isolated = await page.evaluate(() => crossOriginIsolated)
    expect(isolated).toBe(true)
  })
```

**PIPE-01 test pattern (UI responsive during encode):**
```typescript
  test('UI stays interactive while worker encodes (PIPE-01)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Optimize all' }).click()
    // Toolbar should remain clickable — not blocked by main thread
    const toolbar = page.getByRole('toolbar')
    await expect(toolbar).toBeVisible()
  })
```

**Selector conventions from backpressure.spec.ts:**
- `page.getByTestId('backpressure-indicator')` — testid selector (keep stable)
- `page.getByRole('button', { name: 'Optimize all' })` — role+name (matches Toolbar)
- `.toHaveClass(/opacity-0/)` — class-regex match

---

## Shared Patterns

### nanostores atom subscription (useStore)
**Source:** `src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx` lines 1–4
**Apply to:** `useOptimize.ts` (hooks that read store), any new component reading `runtimeAtom`
```typescript
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'

const { running } = useStore(runtimeAtom)  // reactive — re-renders on change
```

### nanostores map + setKey action
**Source:** `src/stores/runtime.ts` lines 26–31
**Apply to:** All new action functions added to `runtime.ts`
```typescript
// Single key update:
export function startRun(): void {
  runtimeAtom.setKey('running', true)
}

// Multi-key update (use runtimeAtom.set with spread):
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.set({ ...runtimeAtom.get(), runningJobs: running, queuedJobs: queued, running: running > 0 || queued > 0 })
}
```

### Path alias
**Source:** `vite.config.ts` line 13; used throughout `src/`
**Apply to:** All new files
```typescript
// '@/' resolves to 'src/' — use everywhere instead of relative ../../
import { runtimeAtom } from '@/stores/runtime'
import { getPool } from '@/lib/worker-pool'
```

### Vite Worker URL (static literal required)
**Source:** `vite.config.ts` line 19 comment
**Apply to:** `src/lib/worker-pool.ts` Worker constructor
```typescript
// MUST be a string literal — template literals break Vite static analysis
new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })
```

### File header comment convention
**Source:** Every file in `src/` (e.g., `src/stores/runtime.ts` line 1, `src/lib/format.ts` line 1)
**Apply to:** All new files
```typescript
// Phase 08 — PIPE-XX: <description>. Source: 08-NN-PLAN.md
```

### jSquash optimizeDeps exclusion (already in vite.config.ts)
**Source:** `vite.config.ts` lines 42–46
**Apply to:** Do NOT add any `@jsquash/*` to `optimizeDeps.include`. The existing exclusion is required and correct.
```typescript
exclude: [
  '@jsquash/png', '@jsquash/jpeg', '@jsquash/webp',
  '@jsquash/avif', '@jsquash/oxipng', '@jsquash/resize',
],
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/workers/codec.worker.ts` | worker | event-driven | No worker files exist in the project yet |
| `src/hooks/useOptimize.ts` | hook | request-response | No hooks directory exists; pattern inferred from store + component analogs |

---

## Metadata

**Analog search scope:** `src/stores/`, `src/lib/`, `src/components/`, `src/tests/`, `vite.config.ts`
**Files scanned:** 8
**Pattern extraction date:** 2026-05-26
