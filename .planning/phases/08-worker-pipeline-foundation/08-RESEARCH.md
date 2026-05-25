# Phase 8: Worker Pipeline Foundation — Research

**Researched:** 2026-05-26
**Domain:** Web Workers, Comlink RPC, jSquash WASM codecs, COOP/COEP isolation, nanostores backpressure
**Confidence:** HIGH

---

## Summary

Phase 8 establishes the off-thread optimization pipeline that all subsequent encoding phases (9-12) depend on. The work has three hard requirements: workers must run real Comlink RPC (not fake stubs), WASM codecs must be dynamically imported inside those workers so the initial route stays under the 200KB gzip budget, and COOP/COEP headers must be live so `crossOriginIsolated === true` in both dev and Cloudflare Pages production.

The good news: most of the infrastructure already exists. Vite `worker.format: 'es'` is already configured. The COOP/COEP headers are already set in `vite.config.ts` (dev) and `public/_headers` (production). `comlink ^4.4.2` is already installed. `runtimeAtom` already has `running`, `startRun`, and `stopRun`. `BackpressureIndicator` is already wired to `runtimeAtom.running`. The key missing pieces are: (1) the actual `src/workers/codec.worker.ts` file, (2) a `WorkerPool` class in `src/lib/worker-pool.ts` that bounds concurrency and queues excess jobs, (3) extension of `runtimeAtom` to expose `running: number` (active jobs) and `queued: number` counts, and (4) wiring `startRun` to dispatch into the pool.

**Primary recommendation:** Create a 3-file addition: `src/workers/codec.worker.ts` (Comlink-exposed optimize function, dynamic codec imports), `src/lib/worker-pool.ts` (bounded pool, round-robin, queue drain), `src/hooks/useOptimize.ts` (bridge from Toolbar's `startRun` click to pool dispatch). Extend runtimeAtom with `running: number` and `queued: number`. Do NOT change BackpressureIndicator's DOM contract — it reads `runtimeAtom` and its testid/class must remain stable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Codec encoding (WASM) | Web Worker | — | CPU-bound; blocks main thread if on main; jSquash WASM runs in any global |
| Job queue / backpressure | Main thread (WorkerPool class) | — | Pool lives on main thread and dispatches to worker; queue is in-memory |
| Store updates (running/queued counts) | Main thread (nanostores) | — | Workers cannot import nanostores atoms; pool callbacks update atoms |
| COOP/COEP headers | Edge / CDN | Vite dev server | Headers must be set by the server, not in app code |
| Dynamic codec import | Web Worker | — | Import inside worker keeps codec WASM out of main bundle |
| UI reactivity (BackpressureIndicator) | Browser (React) | — | Already wired to runtimeAtom via useStore |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | Optimization runs off the main thread via a Comlink-wrapped WorkerPool — UI stays responsive while files encode | Comlink.expose/wrap pattern; worker: {format:'es'} already set |
| PIPE-02 | Codecs dynamically imported inside workers; initial route < 200KB gzipped; AVIF loads only when user selects it | Dynamic import() inside worker; Vite code-splits at dynamic boundary; codec WASM excluded from dep bundle |
| PIPE-03 | COOP/COEP headers configured so crossOriginIsolated === true in dev AND Cloudflare Pages | server.headers already in vite.config.ts; public/_headers already has COOP/COEP but file is truncated — needs closing newline verified |
| PIPE-04 | Backpressure enforced — pool bounds concurrent jobs; BackpressureIndicator reflects real running/queued state | runtimeAtom.running exists; needs `queued` field; pool emits count callbacks; indicator reads atom |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)
| Library | Version (installed) | Purpose | Source |
|---------|---------------------|---------|--------|
| `comlink` | 4.4.2 | Worker RPC — wraps postMessage in Proxy/Promise | [VERIFIED: npm registry + node_modules] |
| `nanostores` | 1.3.0 | Reactive atoms — runtimeAtom owns running/queued counts | [VERIFIED: npm registry + node_modules] |
| `@nanostores/react` | 1.1.0 | useStore hook for BackpressureIndicator | [VERIFIED: npm registry + node_modules] |
| `vite` | 7.3.2 (installed) | Bundler; worker.format:'es' enables code-split dynamic imports | [VERIFIED: node_modules/vite/package.json] |
| All `@jsquash/*` | See below | WASM codecs — dynamically imported inside worker | [VERIFIED: node_modules] |

**CLAUDE.md stack divergence found:**
- CLAUDE.md says **zustand** and **Vite 8**. Actual code uses **nanostores 1.3.0** and **Vite 7.3.2**.
- CLAUDE.md says **idb-keyval** for persistence. Not installed in package.json (deferred per STATE.md).
- CLAUDE.md says `@radix-ui/react-tooltip` etc. Actual code uses **`radix-ui` v1 (unified)** and **`@base-ui/react`**.
- All research below is against the REAL stack (nanostores + Vite 7.3.2).

### jSquash Codec Versions (installed)
| Package | Version | MT support | Notes |
|---------|---------|-----------|-------|
| `@jsquash/png` | 3.1.1 | No (single-thread decode) | Used to decode PNG → ImageData for oxipng |
| `@jsquash/oxipng` | 2.3.0 | YES — auto-detected if crossOriginIsolated | No separate subpath; MT enables automatically inside a worker when `crossOriginIsolated` |
| `@jsquash/jpeg` | 1.6.0 | No | MozJPEG encode+decode; quality/progressive |
| `@jsquash/webp` | 1.5.0 | No | libwebp encode+decode |
| `@jsquash/avif` | 2.1.1 | No explicit MT subpath found | libavif; ~8MB WASM — lazy-load only |
| `@jsquash/resize` | 2.1.1 | No | lanczos3/mitchell/catrom/triangle |

[VERIFIED: node_modules/ and README files]

**OxiPNG MT mechanism (verified from README):** MT activates automatically when the codec runs inside a Web Worker AND `crossOriginIsolated === true`. No separate import subpath — just call `optimise()` normally. Falls back to single-thread if `crossOriginIsolated` is false.

**No install needed** — all packages already in `node_modules`.

---

## Package Legitimacy Audit

All packages in this phase are already installed in the project. No new packages are being added.

| Package | Registry | Age | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|
| `comlink` | npm | ~11 yrs (2015) | n/a — already installed | Approved |
| `nanostores` | npm | ~5 yrs (2021) | n/a — already installed | Approved |
| `@jsquash/*` | npm | 2-5 yrs | n/a — already installed | Approved |
| `vite` | npm | ~6 yrs (2020) | n/a — already installed | Approved |

*slopcheck was unavailable at research time, but no new packages are being added — all are existing dependencies in package.json.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Main Thread                                             │
│                                                         │
│  Toolbar click (startRun)                               │
│       │                                                 │
│       ▼                                                 │
│  useOptimize hook                                       │
│       │  dispatches FileEntry[] from filesAtom          │
│       ▼                                                 │
│  WorkerPool (src/lib/worker-pool.ts)                    │
│  ┌──────────────────────────────────┐                   │
│  │  concurrencyLimit = min(hwConc,4) │                  │
│  │  activeCount: number             │                   │
│  │  queue: PendingJob[]             │                   │
│  │  workers: ComlinkProxy[]         │                   │
│  └──────────────────────────────────┘                   │
│       │                  │                              │
│       │ Comlink.wrap     │ pool.run() returns Promise   │
│       ▼                  │                              │
│  runtimeAtom.setKey()    │ on job start/complete        │
│  { running: N,           │                              │
│    queued: M }           │                              │
│       │                  │                              │
│       ▼                  │                              │
│  BackpressureIndicator   │                              │
│  (reads runtimeAtom)     │                              │
└──────────────────────────┼──────────────────────────────┘
                           │ new Worker(URL, {type:'module'})
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Worker Thread(s) — codec.worker.ts                      │
│                                                         │
│  Comlink.expose({ optimize })                           │
│       │                                                 │
│       ▼                                                 │
│  optimize(job: EncodeJob): Promise<EncodeResult>        │
│       │                                                 │
│       ▼                                                 │
│  switch (job.codec)                                     │
│  ├─ 'PNG'  → await import('@jsquash/png')               │
│  │           await import('@jsquash/oxipng')            │
│  ├─ 'WebP' → await import('@jsquash/webp')              │
│  ├─ 'JPEG' → await import('@jsquash/jpeg')              │
│  ├─ 'AVIF' → await import('@jsquash/avif') [lazy, 8MB] │
│  └─ 'SVG'  → await import('svgo/browser')              │
│                                                         │
│  Each import() is cached by V8 module registry after    │
│  first call — no re-download on subsequent jobs         │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── workers/
│   └── codec.worker.ts      # Comlink.expose({ optimize }); dynamic codec imports
├── lib/
│   └── worker-pool.ts       # WorkerPool class — bounded concurrency + job queue
├── hooks/
│   └── useOptimize.ts       # Bridge: filesAtom → pool.run() → runtimeAtom updates
└── stores/
    └── runtime.ts           # Extend: add `running: number`, `queued: number` fields
```

### Pattern 1: Comlink Worker Expose
**What:** Worker exposes a typed API; main thread wraps it as a Proxy.
**When to use:** All cross-thread function calls.

```typescript
// src/workers/codec.worker.ts
// Source: comlink README (node_modules/comlink/README.md)
import * as Comlink from 'comlink'

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

async function optimize(job: EncodeJob): Promise<EncodeResult> {
  const { codec, buffer, settings } = job
  switch (codec) {
    case 'PNG': {
      const { decode } = await import('@jsquash/png')
      const { optimise } = await import('@jsquash/oxipng')
      const imageData = await decode(buffer)
      const result = await optimise(imageData, { level: settings.level as number ?? 3 })
      return { buffer: result, originalSize: buffer.byteLength, optimizedSize: result.byteLength }
    }
    case 'WebP': {
      const { decode } = await import('@jsquash/png') // or jpeg depending on source
      const { encode } = await import('@jsquash/webp')
      const imageData = await decode(buffer)
      const result = await encode(imageData, { quality: settings.q as number ?? 82 })
      return { buffer: result, originalSize: buffer.byteLength, optimizedSize: result.byteLength }
    }
    case 'AVIF': {
      // Heavy: ~8MB WASM — only fetched when this branch executes
      const { decode } = await import('@jsquash/png')
      const { encode } = await import('@jsquash/avif')
      const imageData = await decode(buffer)
      const result = await encode(imageData, { quality: settings.q as number ?? 60 })
      return { buffer: result, originalSize: buffer.byteLength, optimizedSize: result.byteLength }
    }
    default:
      throw new Error(`Unsupported codec: ${codec}`)
  }
}

Comlink.expose({ optimize })
```

```typescript
// src/lib/worker-pool.ts — main thread
// Source: comlink README + Squoosh pool pattern [ASSUMED pattern, verified Comlink API]
import * as Comlink from 'comlink'
import type { EncodeJob, EncodeResult } from '@/workers/codec.worker'

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

### Pattern 2: Pool Sizing Heuristic
```typescript
// Source: [ASSUMED] — standard heuristic, no authoritative spec source
const POOL_SIZE = Math.min(navigator.hardwareConcurrency ?? 4, 4)
```
Cap at 4: encoding is memory-heavy (WASM heap per worker); more than 4 workers on a 4-core machine does not help and risks OOM.

### Pattern 3: Comlink.transfer for ArrayBuffer (zero-copy)
```typescript
// Source: comlink README
// Transfer ArrayBuffer to worker without copying (structured clone is the default, which copies)
const result = await worker.optimize(Comlink.transfer(job, [job.buffer]))
```
Note: `ImageData.data` (`Uint8ClampedArray`) is NOT directly transferable — only `ArrayBuffer` is. Pass `buffer.buffer` when transferring typed arrays.

### Pattern 4: Runtime Store Extension (nanostores pattern)
```typescript
// src/stores/runtime.ts — extend existing map
// Add to RuntimeState interface:
interface RuntimeState {
  running: boolean      // KEEP for BackpressureIndicator backward compat
  runningJobs: number   // new — actual count for pool
  queuedJobs: number    // new — jobs waiting for a free slot
  toasts: Toast[]
  svgoVersion: string
  codecVersion: string
  wasmInfo: string
}

// New actions called by WorkerPool.onCountChange:
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.set({
    ...runtimeAtom.get(),
    runningJobs: running,
    queuedJobs: queued,
    running: running > 0 || queued > 0,  // drives BackpressureIndicator
  })
}
```

**Critical:** `BackpressureIndicator` reads `runtimeAtom.running` (boolean). The `running` field must remain boolean. The pool drives it by setting it to `runningJobs > 0 || queuedJobs > 0`. This preserves the existing Playwright test contract.

### Pattern 5: Dynamic Import Inside Worker (Vite code-splitting)
Vite splits worker dynamic imports into separate chunks because `worker.format: 'es'` is set. The AVIF branch's `import('@jsquash/avif')` will only be fetched when a job with `codec: 'AVIF'` runs. This is already correctly configured in vite.config.ts (`optimizeDeps.exclude` lists all `@jsquash/*`).

### Anti-Patterns to Avoid
- **Importing codecs at worker top-level:** `import { encode } from '@jsquash/avif'` at the module top produces a static import — WASM fetched for every worker on creation, destroying the < 200KB budget. Use `await import(...)` inside the switch branch.
- **Copying ArrayBuffers with structured clone when you can transfer:** Structured clone of a 3MB PNG adds 3MB copy time per job. Wrap with `Comlink.transfer(job, [job.buffer])`.
- **Importing `nanostores` from inside a worker:** Workers cannot access DOM APIs or the main thread's module scope. nanostores atoms are main-thread only; the pool notifies via the `onCountChange` callback.
- **Using template literals in the Worker URL constructor:** Vite can only statically analyze `new URL('./path.ts', import.meta.url)` — template literals break the URL rewrite. [VERIFIED: vite.config.ts comment already notes this]
- **Recreating workers per job:** Worker creation is expensive (WASM init, module parse). Pool workers must persist across jobs.
- **Setting `runtimeAtom.running` false before the queue is drained:** The pool must set `running: false` only when `activeJobs === 0 && queue.length === 0`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker RPC boilerplate | Custom postMessage protocol | `comlink` (already installed) | Type-safe, handles transfers, cancellation, proxy lifetime |
| WASM initialization | Custom WASM fetch + instantiate | jSquash auto-init (Vite handles URL resolution) | jSquash README: "no need to manually initialise in most situations" |
| PNG→ImageData conversion | Canvas-based decode | `@jsquash/png decode()` | OxiPNG needs raw pixel data; canvas decode loses precision for 16-bit |
| SVG optimization in worker | Manual DOM-based pass | `svgo/browser` dynamic import | svgo ships browser ESM; already in optimizeDeps.include for preloading |

**Key insight:** The worker pool pattern (bounded concurrency + queue drain) is ~60 lines and should be hand-rolled because no installable library matches the Comlink-proxy pool semantics exactly without adding a dependency of questionable maintenance (e.g., `comlink-worker-pool` is not a real package). Roll it explicitly.

---

## Common Pitfalls

### Pitfall 1: COOP/COEP Headers Not Propagating
**What goes wrong:** `crossOriginIsolated === false` in the worker; OxiPNG MT silent fallback; harder to debug than an error.
**Why it happens:** `public/_headers` is truncated in the repo (missing closing newline/format). `vite.config.ts` has headers but only for the dev server; Cloudflare Pages uses `public/_headers`.
**How to avoid:** Verify `public/_headers` is valid (both lines present), add a startup `console.assert(crossOriginIsolated)` in the worker for dev, or log `navigator.hardwareConcurrency` and `crossOriginIsolated` on app boot.
**Warning signs:** `SharedArrayBuffer is not defined` in the console, or MT never activates.

**Current `public/_headers` status (verified):** File exists with correct COOP/COEP headers but appears truncated (the `cat` output ended at line 3 without closing). Must verify file completeness before marking PIPE-03 done.

### Pitfall 2: jSquash WASM URL Resolution Breaking in Workers
**What goes wrong:** Worker throws "expected magic word 00 61 73 6d, found 3c 21 64 6f" (HTML served instead of WASM).
**Why it happens:** esbuild dep-bundling inlines the WASM URL inside a transformed chunk where Vite can no longer proxy it. Already mitigated in vite.config.ts with `optimizeDeps.exclude` for all `@jsquash/*`.
**How to avoid:** Do NOT add jSquash packages back to `optimizeDeps.include`. The existing exclusion is correct.
**Warning signs:** That exact hex error in the worker console.

### Pitfall 3: Stale `running: boolean` in runtimeAtom
**What goes wrong:** BackpressureIndicator stays green (or stays dark) incorrectly because `running` isn't updated symmetrically.
**Why it happens:** Race between `startRun()` (sets `running: true`) and pool completion callbacks (sets `running: false`). If `startRun` is still called manually (it is — Toolbar calls it directly), pool must call `stopRun()` when queue empties.
**How to avoid:** Remove `startRun()` call from Toolbar (or keep it only as initial signal) and let the pool own the `running` lifecycle via `setJobCounts`. The pool sets `running: active > 0 || queued > 0`.

### Pitfall 4: Comlink Proxy Not Released
**What goes wrong:** Memory leak — worker proxies accumulate GC pressure.
**Why it happens:** `Comlink.wrap()` attaches a `FinalizationRegistry` to auto-release, but if WeakRef is not supported, the proxy is never cleaned.
**How to avoid:** Pool is created once at app start and lives forever (module singleton). Workers are never torn down. This is fine for a single-page app.

### Pitfall 5: BackpressureIndicator Test Breaking
**What goes wrong:** Existing Playwright test `backpressure.spec.ts` checks `runtimeAtom.running` → CSS class. If the field rename breaks, the test fails.
**Why it happens:** Renaming `running: boolean` to `running: number` would break the boolean check.
**How to avoid:** Keep `running: boolean` exactly as-is. Add `runningJobs: number` and `queuedJobs: number` as NEW fields. The existing `running` field is derived from them.

### Pitfall 6: Worker File at Phase 8 is a Smoke-Test Stub
**What goes wrong:** Phase 8 delivers the pool infrastructure but Phase 9 delivers the real codecs. If the worker's `optimize()` function is empty, PIPE-01's success criterion ("runs in a Web Worker, UI interactive") can't be verified.
**How to avoid:** Phase 8's worker should implement at least ONE codec fully (PNG is simplest — decode via `@jsquash/png`, re-encode via `@jsquash/oxipng`). This lets the Playwright test actually prove off-thread execution. Other codecs are stubs that throw `NotImplementedError`.

---

## Code Examples

### Worker Pool — Full Implementation Sketch
```typescript
// src/lib/worker-pool.ts
// Source: comlink README pattern [CITED: node_modules/comlink/README.md]
import * as Comlink from 'comlink'

// Pool is a module singleton — created once on first import
let _instance: WorkerPool | null = null

export function getPool(): WorkerPool {
  if (!_instance) {
    const size = Math.min(navigator.hardwareConcurrency ?? 4, 4)
    _instance = new WorkerPool(size, (active, queued) => {
      // Import runtime store lazily to avoid circular dep
      import('@/stores/runtime').then(({ setJobCounts }) => setJobCounts(active, queued))
    })
  }
  return _instance
}
```

### COOP/COEP Headers — Complete Cloudflare Pages file
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```
(The current `public/_headers` appears to have these two lines. Verify it ends with a newline and no trailing characters.)

### Runtime Isolation Check (Worker)
```typescript
// Inside codec.worker.ts — dev guard
if (import.meta.env.DEV && !crossOriginIsolated) {
  console.warn('[codec-worker] crossOriginIsolated is false — SharedArrayBuffer unavailable; OxiPNG MT disabled')
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@squoosh/lib` (archived 2023) | `@jsquash/*` per-codec packages | Separate dynamic imports; tree-shaking; active maintenance |
| `postMessage` raw protocol | Comlink RPC proxy | Type safety; Promise API; transfer helpers |
| Static codec import at module top | Dynamic `import()` inside worker function | AVIF WASM only fetched when user selects AVIF |
| WASM initialized via Response (old API) | WASM auto-init (Emscripten glue) | Vite resolves WASM URLs correctly with `assetsInclude: ['**/*.wasm']` |

---

## COOP/COEP Deep Dive (PIPE-03)

### What the headers do
- `Cross-Origin-Opener-Policy: same-origin` — prevents cross-origin windows from getting a reference to this window, enabling process isolation.
- `Cross-Origin-Embedder-Policy: require-corp` — blocks loading cross-origin resources unless they opt in with `Cross-Origin-Resource-Policy` or `crossorigin` attribute + CORS.

### Side effects (already mitigated)
- **Google Fonts, CDN resources** — not used (zero-server app; all fonts via `@fontsource-variable/*`).
- **External images** — not used (client-only; user drops files from disk).
- The app has no cross-origin resources to load, so COEP has no side effects here.

### Detection
```typescript
// In app bootstrap (main.tsx) or in worker
console.log('crossOriginIsolated:', crossOriginIsolated)
// Should log: true
```

### Vite dev server (already configured)
```typescript
// vite.config.ts — ALREADY PRESENT [VERIFIED]
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

### Cloudflare Pages (already present, needs verification)
```
// public/_headers — ALREADY PRESENT [VERIFIED from cat output]
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

PIPE-03 is largely done; the task is to verify the `_headers` file is complete and add a runtime `crossOriginIsolated` check.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vite dev server | PIPE-03 COOP/COEP headers | ✓ | 7.3.2 (installed) | — |
| comlink | PIPE-01 worker RPC | ✓ | 4.4.2 (installed) | — |
| `@jsquash/png` | PIPE-01 smoke test (PNG decode) | ✓ | 3.1.1 (installed) | — |
| `@jsquash/oxipng` | PIPE-01 smoke test (PNG optimize) | ✓ | 2.3.0 (installed) | — |
| `@jsquash/avif` | PIPE-02 lazy-load gate | ✓ | 2.1.1 (installed) | — |
| nanostores | PIPE-04 backpressure store | ✓ | 1.3.0 (installed) | — |
| Playwright | Test suite | ✓ | ^1.59.1 (devDep) | — |
| Worker threads (browser) | PIPE-01 | ✓ | Modern Chrome/FF/Safari | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

> nyquist_validation is enabled (no explicit false in config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.x |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test src/tests/backpressure.spec.ts` |
| Full suite command | `npx playwright test` |

Unit tests use `node --experimental-strip-types` (see `test:bundle` script). No vitest/jest detected.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | UI stays interactive while worker encodes | Playwright e2e | `npx playwright test src/tests/worker-pipeline.spec.ts` | ❌ Wave 0 |
| PIPE-02 | AVIF WASM not fetched until AVIF selected | Playwright network | `npx playwright test src/tests/worker-pipeline.spec.ts` | ❌ Wave 0 |
| PIPE-03 | crossOriginIsolated === true | Playwright evaluate | `npx playwright test src/tests/worker-pipeline.spec.ts` | ❌ Wave 0 |
| PIPE-04 | BackpressureIndicator reflects real running/queued | Playwright e2e | `npx playwright test src/tests/backpressure.spec.ts` | ✅ exists (extend) |

### Sampling Rate
- **Per task commit:** `npx playwright test src/tests/backpressure.spec.ts`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/worker-pipeline.spec.ts` — covers PIPE-01, PIPE-02, PIPE-03
- [ ] Extend `src/tests/backpressure.spec.ts` — add test for real `runningJobs` count (not just boolean)

**Key test strategy for PIPE-01:** Playwright's `page.evaluate(() => crossOriginIsolated)` verifies PIPE-03. For PIPE-01, use `page.addInitScript` to stub a slow job (500ms) and verify the page remains interactive (click/scroll responds) during encoding. For PIPE-02, intercept network requests and assert no `avif` WASM fetch occurs unless AVIF is selected.

---

## Open Questions

1. **SVG optimization in worker or main thread?**
   - What we know: svgo v4 ships browser ESM and is in `optimizeDeps.include` for the main thread. Workers can also import ESM.
   - What's unclear: svgo is already pre-bundled for the main thread. Running it in the worker avoids jank but requires duplicating the svgo bundle in the worker chunk.
   - Recommendation: Phase 8 should stub SVG in the worker (throw NotImplemented). Phase 9 (ENC-05) decides. Do NOT pre-bundle svgo for the worker in Phase 8.

2. **Pool singleton lifecycle (HMR)**
   - What we know: Vite HMR replaces modules. A module-level pool singleton will survive HMR by reference if the module isn't fully replaced, but the worker processes persist.
   - What's unclear: Whether HMR of `worker-pool.ts` terminates old workers cleanly.
   - Recommendation: Wrap pool creation in `import.meta.hot?.dispose()` to terminate workers on HMR.

3. **Transfer of ImageData vs ArrayBuffer in pool API**
   - What we know: `Comlink.transfer` can zero-copy transfer `ArrayBuffer`. `ImageData.data` is a `Uint8ClampedArray` backed by an `ArrayBuffer`.
   - What's unclear: Phase 8 takes `ArrayBuffer` input (raw file bytes). The worker decodes internally. Return value is `ArrayBuffer` (encoded bytes). Both are transferable.
   - Recommendation: Worker API accepts `ArrayBuffer` and returns `ArrayBuffer`. Main thread passes `Comlink.transfer(job, [job.buffer])`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pool size cap of 4 is safe for WASM memory | Standard Stack | Too many workers could OOM on low-RAM devices |
| A2 | Comlink.transfer with `[job.buffer]` works correctly across Comlink proxy calls | Code Examples | If wrong, encoding would still work but with 2x memory per job (copy instead of transfer) |
| A3 | Worker dynamic `import()` is cached by V8 after first call (no re-fetch on second job) | Architecture | If wrong, AVIF WASM re-fetched per job — performance but not correctness issue |
| A4 | SVG can be handled in-worker via `svgo/browser` dynamic import (deferred to Phase 9) | Don't Hand-Roll | No risk in Phase 8 since SVG is stubbed |
| A5 | `public/_headers` file is complete and correct for Cloudflare Pages | PIPE-03 | If truncated, production COOP/COEP broken; crossOriginIsolated false in production |

---

## Security Domain

> security_enforcement not explicitly false in config.json — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Worker validates `job.codec` against known enum before dispatch |
| V6 Cryptography | No | — |

### Known Threat Patterns for Worker WASM stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed file buffer crashing WASM | Tampering | jSquash returns rejection; wrap in try/catch per job; never crash the worker process (handle in job Promise) |
| Prototype pollution via job settings | Tampering | Use type narrowing on `settings` object; no `eval`, no `Function()` |
| COEP blocking legitimate CDN resources | Denial of Service | N/A — app is 100% self-hosted, no CDN resources |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/comlink/README.md` — Comlink.expose, wrap, transfer API [VERIFIED: installed package]
- `node_modules/@jsquash/oxipng/README.md` — MT activation via crossOriginIsolated [VERIFIED: installed package]
- `node_modules/@jsquash/avif/README.md` — encode/decode API, no MT subpath [VERIFIED: installed package]
- `node_modules/@jsquash/jpeg/README.md`, `@jsquash/png/README.md` — decode/encode API [VERIFIED: installed package]
- `vite.config.ts` (project) — COOP/COEP already configured, worker.format:'es', jSquash optimizeDeps.exclude [VERIFIED: read file]
- `public/_headers` (project) — COOP/COEP for Cloudflare Pages [VERIFIED: read file]
- `src/stores/runtime.ts` — runtimeAtom structure, startRun/stopRun/setWorkerCount [VERIFIED: read file]
- `src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx` — reads runtimeAtom.running (boolean) [VERIFIED: read file]
- `src/tests/backpressure.spec.ts` — existing Playwright test contract [VERIFIED: read file]
- `package.json` — real stack (nanostores, vite 7.3.2, comlink 4.4.2) [VERIFIED: read file]

### Secondary (MEDIUM confidence)
- CLAUDE.md divergence note — nanostores vs zustand, Vite 7 vs 8 [VERIFIED: package.json cross-check]
- Pool sizing heuristic (min(hardwareConcurrency, 4)) — [ASSUMED] industry standard; no single authoritative spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from node_modules, README files read directly
- Architecture (Comlink pool pattern): HIGH — Comlink API verified from installed README; pool logic is pure TypeScript, well-understood
- COOP/COEP headers: HIGH — headers verified in vite.config.ts and public/_headers
- jSquash MT behavior: HIGH — verified from oxipng README (auto-detect crossOriginIsolated); avif has no MT subpath per package inspection
- Pitfalls: HIGH — most verified from existing vite.config.ts comments and store code

**Research date:** 2026-05-26
**Valid until:** 2026-08-26 (stable ecosystem; jSquash updates infrequently)
