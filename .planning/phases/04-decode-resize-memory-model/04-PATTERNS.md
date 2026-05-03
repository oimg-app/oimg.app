# Phase 4: Decode + Resize + Memory Model — Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 14 new + 6 modified = 20
**Analogs found (worth pattern excerpts):** 17 / 20
**Files with no analog (NEW):** 3 / 20

---

## File Classification

### New files (Phase 4 ships them)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/workers/png-adapter.ts` | adapter (worker-side) | bytes → ImageData → bytes (transform) | `src/workers/svg-adapter.ts` | exact (adapter contract) |
| `src/workers/png-config.ts` | config builder (pure) | settings → adapter-input record | `src/workers/svg-config.ts` | exact |
| `src/lib/sniff.ts` | utility (main thread) | Blob slice → `{w,h}` (transform) | `src/lib/format.ts` | partial (pure helper, no analog for binary parse) |
| `src/lib/filename.ts` | utility (main thread) | string → string (transform) | `src/lib/format.ts` | partial (pure string helpers) |
| `src/lib/memory-budget.ts` | utility (env probe + math) | navigator → number (request-response, sync) | `src/stores/runtime.ts` `POOL_SIZE` block (lines 23-26) | partial (same env-probe-with-fallback shape) |
| `src/components/panels/TweaksPanel.tsx` *(or extend `CodecPanel.tsx`)* | component (panel) | settings store ↔ UI (CRUD) | `src/components/panels/CodecPanel.tsx` + `src/components/panels/SvgoPanel.tsx` | exact |
| `src/components/panels/FilePanel.tsx` *(extract from `App.tsx` lines 710-808)* | component (list) | files store ↔ UI (CRUD) | `App.tsx` filelist JSX (lines 710-808) | exact (extraction target) |
| `src/components/file-row/SourceDensityControl.tsx` | component (popover trigger) | file store mutation | `src/components/panels/SvgoPanel.tsx` (Toggle pattern + foot-gun hint) | role-match |
| `src/components/file-row/TargetDensityCheckboxes.tsx` | component (checkbox group) | file store mutation | `src/components/panels/SvgoPanel.tsx` plugin-row block (lines 102-122) | role-match (clickable group + a11y) |
| `src/components/shell/BackpressureIndicator.tsx` | component (status pill) | runtime store → DOM | `src/components/shell/StatusBar.tsx` worker-pip span (lines 25-28) | role-match |
| `src/tests/raster.spec.ts` | test (E2E Playwright) | drop → optimize → assert | `src/tests/svg-pipeline.spec.ts` | exact |
| `src/tests/filename.test.ts` | test (unit, --strip-types) | input → expected | `src/tests/svg-adapter.unit.ts` | exact |
| `src/tests/icc.test.ts` | test (unit, --strip-types) | bytes → chunk-presence assertion | `src/tests/svg-adapter.unit.ts` | role-match (different assertion shape) |
| `src/tests/instrument-heap.ts` | test helper (CDP probe) | CDP session → heap stats | `src/tests/fixtures/instrument-blob-urls.js` | role-match (different API: CDP vs monkey-patch) |

### Modified files

| Modified File | Role | Phase 4 change | Pattern source for the new code |
|---------------|------|----------------|----------------------------------|
| `src/types/index.ts` | types | add `resizeOverride?`, `preserveIcc?` to `FileEntry`; extend `CodecSettings*` if needed | existing `FileEntry` shape (lines 56-69) — additive, mirrors Phase 3 `sanitizedCount?` pattern |
| `src/stores/files.ts` | store | `addFile` fan-out → N FileEntries (1 per target density); add `removeFamily(sourceId)` | existing `addFile` (lines 47-51) and `removeFile` (lines 53-72) |
| `src/stores/runtime.ts` | store | add `inflightBytes`, `throttleActive`, `throttleToastFiredThisBatch`, `renameCountThisBatch`; reset all in `startBatch` and `cancelBatch` | existing `previewJobId` slot (line 41, 87, 222-223) — same pattern |
| `src/stores/settings.ts` | store | add `resize: { alg: ResizeAlg }` slice; existing `global.preserveIccProfile` already there (line 78-81 of `defaults.ts`) | existing `setSvg` partial-merge (line 60) |
| `src/workers/types.ts` | types | extend `AdapterFormat` union with `'png-resize'` (or repurpose `'png'`); extend `AdapterMeta` with `density?: '1x'\|'2x'\|'3x'` if planner picks the meta route | existing `AdapterFormat` union (line 5), `AdapterMeta` (lines 7-14) |
| `src/workers/worker.ts` | worker entry | replace `png` throw (line 26-28) with real `() => import('./png-adapter')` | existing `svg: () => import('./svg-adapter')` (line 25) |
| `src/workers/pool.ts` | pool orchestrator | extend `PoolJob` with optional `byteEstimate?: number`; add `inflightBytes` field + admission gate in `tryDispatch`; expose `onThrottle?` callback | existing `tryDispatch` (lines 192-201) — gate insertion point; existing `PoolCallbacks` (lines 36-43) — callback addition |
| `src/components/shell/StatusBar.tsx` | component | accept new `throttleActive` prop; render `<BackpressureIndicator />` between worker-pip and SVGO version item | existing prop list (lines 12-19), worker-pip span (lines 25-28) |
| `src/App.tsx` | composition root | thread settings → adapter; remove the `Phase 5 may introduce 1:N` comment at line 518; bind `onThrottle` pool callback to runtime store + Sonner toast | existing `pool` `useMemo` block (lines 256-270), `startOptimize` (lines 511-600) |
| `src/data/defaults.ts` | constants | add `DEFAULT_RESIZE_SETTINGS = { alg: 'lanczos3' }`; default `preserveIccProfile` already `false` (line 80) | existing `DEFAULT_GLOBAL_SETTINGS` (lines 78-81) |

---

## Pattern Assignments

### `src/workers/png-adapter.ts` (NEW, adapter, transform)

**Analog:** `src/workers/svg-adapter.ts` (Phase 3, exact contract match — same Phase 2 D-04 contract).

**Header / commentary pattern** (svg-adapter.ts lines 1-23) — replicate the docblock with PNG-specific phrasing (decode + resize + re-encode pipeline; cite RESEARCH §1.1 + §1.2 + §1.4):

```typescript
/**
 * PNG Resize Adapter — Phase 4
 * Source: 04-RESEARCH.md §1.1 (decode), §1.2 (resize), §1.4 (init pattern).
 *
 * Pipeline (worker side): ArrayBuffer → @jsquash/png decode → ImageData →
 *   @jsquash/resize (lanczos3 default) → ImageData → @jsquash/png encode →
 *   ArrayBuffer.
 *
 * D-11(a): drop the decoded ImageData reference immediately after resize()
 * resolves. Function-scope GC reclaims it before the encoder allocates its
 * working buffer. No ImageData crosses job boundaries.
 *
 * D-10 (post-research amendment): preserveIcc flag is wired through but the
 * worker IGNORES it — always strips. ICC chunk extract/embed is Phase 5 work.
 */
```

**Imports + adapter-error pattern** (svg-adapter.ts lines 24-35; types.ts AdapterError class lines 45-54) — copy the import shape:

```typescript
import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'
import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { PngResizeSettings } from './png-config'
import { buildPngResizeSettings } from './png-config'
export { buildPngResizeSettings }
```

**Core run() shape** (svg-adapter.ts lines 37-74) — same `run(input, settings)` signature; same try/catch-per-stage with `AdapterError(format, phase, message)`. Pattern from RESEARCH §Code Examples (verbatim, lines 609-662):

```typescript
export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = settings as PngResizeSettings

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError('png', 'decode', err instanceof Error ? err.message : String(err))
  }

  const tgtScale = parseInt(opts.targetDensity) / parseInt(opts.sourceDensity)
  const targetW = Math.max(1, Math.round(decoded.width * tgtScale))
  const targetH = Math.max(1, Math.round(decoded.height * tgtScale))

  let resized: ImageData
  try {
    resized = await resize(decoded, { width: targetW, height: targetH, method: opts.method })
  } catch (err) {
    throw new AdapterError('png', 'process', err instanceof Error ? err.message : String(err))
  }
  // D-11(a): `decoded` is unreferenced after this point — function-scope GC reclaims.

  let encoded: ArrayBuffer
  try {
    encoded = await encode(resized)
  } catch (err) {
    throw new AdapterError('png', 'encode', err instanceof Error ? err.message : String(err))
  }

  return {
    output: encoded,
    meta: {
      codecVersion: 'png@3.1.1+resize@2.1.1',
      density: opts.targetDensity, // Phase 4 extension to AdapterMeta
    },
  }
}
```

**Comlink transfer:** the worker entry (`worker.ts` line 45) already wraps the adapter return in `Comlink.transfer({ output, meta }, [output])` — DO NOT re-wrap inside the adapter.

---

### `src/workers/png-config.ts` (NEW, config builder, pure)

**Analog:** `src/workers/svg-config.ts` (exact role + same "extracted-for-unit-test" rationale).

**Module purpose comment** (svg-config.ts lines 1-17) — adapt the rationale: extracted so unit tests can import without evaluating `@jsquash/*` (those packages only resolve inside the Vite browser bundle).

**Settings shape pattern** (svg-config.ts lines 43-51) — declare the runtime settings shape locally, no SVGO-style overrides since jSquash takes a flat object:

```typescript
import type { ResizeAlg, SourceDensity } from '../types/index.ts'

export interface PngResizeSettings {
  sourceDensity: SourceDensity   // '1x' | '2x' | '3x' from the source FileEntry
  targetDensity: SourceDensity   // '1x' | '2x' | '3x' for THIS variant
  method: ResizeAlg              // 'lanczos3' | 'mitchell' | 'catrom' | 'triangle'
  preserveIcc: boolean           // wired but no-op in P4 (D-10 amended)
}

export function buildPngResizeSettings(args: {
  sourceDensity: SourceDensity
  targetDensity: SourceDensity
  globalAlg: ResizeAlg
  fileOverride?: ResizeAlg
  globalPreserveIcc: boolean
  filePreserveIcc?: boolean
}): PngResizeSettings {
  return {
    sourceDensity: args.sourceDensity,
    targetDensity: args.targetDensity,
    method: args.fileOverride ?? args.globalAlg,
    preserveIcc: args.filePreserveIcc ?? args.globalPreserveIcc,
  }
}
```

---

### `src/workers/worker.ts` (MODIFIED, worker entry, dispatch)

**Analog:** existing `worker.ts` itself (only one line changes).

**Edit pattern** — replace the throw at line 26-28 with the same lazy-import idiom used for SVG (line 25):

```typescript
const ADAPTERS: Record<AdapterFormat, () => Promise<...>> = {
  stub: () => import('./stub-adapter'),
  svg: () => import('./svg-adapter'),
  png: () => import('./png-adapter'),  // <-- Phase 4: was throw
  jpeg: () => { throw new Error('jpeg adapter not yet implemented (Phase 5)') },
  webp: () => { throw new Error('webp adapter not yet implemented (Phase 5)') },
  avif: () => { throw new Error('avif adapter not yet implemented (Phase 5)') },
}
```

**CRITICAL** (existing comment at lines 13-15): the literal-path import — never use template strings. Vite static analysis must see the literal.

---

### `src/workers/pool.ts` (MODIFIED, pool orchestrator, byte-aware admission)

**Analog:** `src/workers/pool.ts` itself — extend the existing `tryDispatch()` (lines 192-201).

**PoolJob extension** (types.ts lines 36-42) — add optional field, no breaking change:

```typescript
export interface PoolJob {
  id: string
  fileId: string
  format: AdapterFormat
  settings: unknown
  blob: Blob
  byteEstimate?: number  // Phase 4 D-11(b): admission gate input
}
```

**PoolCallbacks extension** (pool.ts lines 36-43) — add `onThrottle`:

```typescript
export interface PoolCallbacks {
  onStarted?: (jobId: string) => void
  onDone?: (jobId: string, result: AdapterRunResult) => void
  onError?: (jobId: string, error: unknown) => void
  onThrottle?: () => void  // Phase 4 D-13: fires once per dispatch cycle that holds queue
}
```

**Admission gate in `tryDispatch()`** — pattern from RESEARCH §2.3 (verbatim, lines 319-348). Insert into the existing while-loop body before the `this.idle.shift()` line:

```typescript
private inflightBytes = 0
private memoryBudgetBytes = computeMemoryBudget()  // see src/lib/memory-budget.ts

private tryDispatch(): void {
  while (this.idle.length > 0 && this.queue.length > 0) {
    const head = this.queue[0]
    const estimate = head.byteEstimate ?? 0
    // D-11(b) admission gate. NEVER deadlock: always allow at least one job.
    if (this.inflightBytes > 0 && this.inflightBytes + estimate > this.memoryBudgetBytes) {
      this.callbacks.onThrottle?.()
      return
    }
    const slot = this.idle.shift()!
    const job = this.queue.shift()!
    this.inflightBytes += estimate
    this.inFlight.set(slot, job)
    this.callbacks.onStarted?.(job.id)
    void this.runOnSlot(slot, job)
  }
}
```

**Release-on-settle pattern** (pool.ts `runOnSlot` finally block, lines 250-261) — add the byte release before `tryDispatch()`:

```typescript
} finally {
  if (generation !== this.generation) return
  this.inFlight.delete(slot)
  this.inflightBytes -= job.byteEstimate ?? 0   // <-- Phase 4 add
  if (this.slots[slot]) {
    this.idle.push(slot)
    this.tryDispatch()
  }
}
```

**Cancel/terminate hygiene** — when `cancel()` (lines 121-157) clears `inFlight`/`queue`/`slots`, also reset `this.inflightBytes = 0` so the respawned pool starts clean.

---

### `src/lib/memory-budget.ts` (NEW, utility, env probe)

**Analog:** `src/stores/runtime.ts` POOL_SIZE block (lines 23-26) — same `navigator.X ?? fallback` shape.

**Pattern** — RESEARCH §3 verbatim (lines 379-385); pure function, easily unit-testable:

```typescript
// Phase 4 D-12: dynamic device-aware memory budget.
// Source: 04-RESEARCH.md §3 (cross-browser deviceMemory survey).
// Firefox + Safari return undefined → ?? 4 fallback → caps at 600 MB.

const MAX_BUDGET_BYTES = 600 * 1024 * 1024

export function computeMemoryBudget(): number {
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const rawMb = 0.75 * dm * 1024
  return Math.min(rawMb * 1024 * 1024, MAX_BUDGET_BYTES)
}

// 04-RESEARCH.md §2.2: peak working-set per job.
// 1.75x multiplier on (src + tgt) × 4 bytes covers WASM heap intermediate buffers.
export function estimateJobBytes(srcW: number, srcH: number, tgtW: number, tgtH: number): number {
  const srcPixels = srcW * srcH
  const tgtPixels = tgtW * tgtH
  return Math.ceil((srcPixels + tgtPixels) * 4 * 1.75)
}
```

---

### `src/lib/sniff.ts` (NEW, utility, binary parse)

**Analog:** none in repo (no existing binary-format sniffer). Use RESEARCH §Code Examples (lines 668-685) verbatim.

**Pattern** — pure async function; non-PNG → null fallback documented in RESEARCH §2.2(b):

```typescript
// Phase 4 — Pre-decode PNG dimension sniff (24-byte read).
// Source: 04-RESEARCH.md §Code Examples (lines 668-685); RFC 2083 PNG spec.
// Used by useFilesStore.addFile to seed the byte-estimate for the admission gate
// BEFORE the worker pool dispatches the decode job.

export async function sniffPngDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (blob.size < 24) return null
  const buf = await blob.slice(0, 24).arrayBuffer()
  const view = new DataView(buf)
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null
  // IHDR chunk at offset 8: 4-byte length, 4-byte type "IHDR", width@16, height@20
  if (view.getUint32(12) !== 0x49484452) return null
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
```

---

### `src/lib/filename.ts` (NEW, utility, string transform)

**Analog:** `src/lib/format.ts` (closest pure-string-helper module — same shape, named exports, no side effects).

**Pattern** — RESEARCH §Code Examples (lines 691-710) verbatim; tighten `crypto.randomUUID` fallback path:

```typescript
// Phase 4 D-03 + D-16 — density suffix templating + collision dedup.
// Source: 04-RESEARCH.md §6.1 + §6.2; CONTEXT.md D-16 amendment.
// Pure functions — no React, no zustand. Unit-tested via --experimental-strip-types.

import type { SourceDensity } from '@/types'

export function applyDensitySuffix(originalName: string, density: SourceDensity): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  // Idempotent: strip an existing @1x/@2x/@3x before re-appending.
  const stripped = base.replace(/@[123]x$/, '')
  return `${stripped}@${density}${ext}`
}

// D-16: order-of-operations — apply density suffix FIRST, then dedup against
// the existing FileEntry name set. Insert " (N)" BEFORE the @Nx suffix so the
// extension and density tag stay terminal.
export function deduplicateName(proposed: string, takenSet: ReadonlySet<string>): string {
  if (!takenSet.has(proposed)) return proposed
  // Strip the @Nx suffix so " (N)" inserts before it.
  const m = proposed.match(/^(.*?)(@[123]x)(\.[^.]+)?$/)
  if (!m) return proposed
  const [, head, density, ext = ''] = m
  for (let i = 2; i < 1000; i++) {
    const candidate = `${head} (${i})${density}${ext}`
    if (!takenSet.has(candidate)) return candidate
  }
  return `${head} (${crypto.randomUUID().slice(0, 8)})${density}${ext}`
}
```

---

### `src/types/index.ts` (MODIFIED, types)

**Analog:** `src/types/index.ts` — Phase 3 added `sanitizedCount?` (line 68). Phase 4 follows the same additive pattern.

**Edit at lines 56-69** (`FileEntry`) — add three optional fields, mirroring the existing `sanitizedCount?` shape:

```typescript
export interface FileEntry {
  id: string
  name: string
  format: FormatId
  originalSize: number
  optimizedSize: number | null
  status: FileStatus
  sourceDensity: SourceDensity
  thumbnail: string | null
  sanitizedCount?: number
  // Phase 4 (D-04 + D-14) — variants are siblings, not children. The
  // source FileEntry id is the prefix; variant ids are `${sourceUuid}-${density}`.
  // sourceFamilyId === source's id; useful for groupBy in FilePanel render.
  sourceFamilyId?: string
  targetDensity?: SourceDensity   // density THIS entry produces
  // Phase 4 D-07 — per-file resize algorithm override (UI deferred to Phase 5).
  resizeOverride?: ResizeAlg
  // Phase 4 D-09 — per-file ICC preserve override (data shape only; worker no-op in P4).
  preserveIcc?: boolean
}
```

---

### `src/stores/files.ts` (MODIFIED, store)

**Analog:** existing `addFile` (lines 47-51) and `removeFile` (lines 53-72).

**Fan-out `addFile` pattern** — keep the simple shape; the new `addSourceWithVariants` is the actual fan-out (separate action). The original `addFile(entry)` continues to work for single-entry adds (tests use it heavily — see object-url.spec.ts line 44, svg-pipeline.spec.ts line 38):

```typescript
addSourceWithVariants: (
  source: { sourceBlob: Blob, sourceDensity: SourceDensity, name: string, format: FormatId, targets: SourceDensity[] }
) => {
  const sourceUuid = crypto.randomUUID()
  // 1. Compute final names with density suffix + collision dedup.
  // 2. Materialize one FileEntryWithBlob per target density.
  // 3. Push all atomically (single set() — avoids partial-write Strict-Mode bugs).
  // Cross-store side effects:
  //   - emit collision toast via runtime.markRename(count) — see runtime.ts pattern below
  //   - sniff source dims via sniffPngDimensions() to seed byteEstimate for each variant
}
```

**`removeFamily` pattern** (CONTEXT.md Claude's discretion) — RESEARCH §5.2 explicitly says: loop and call existing `removeFile`. DO NOT bypass the per-id revoke:

```typescript
removeFamily: (sourceFamilyId) => {
  const ids = Object.values(useFilesStore.getState().byId)
    .filter((f) => f.sourceFamilyId === sourceFamilyId)
    .map((f) => f.id)
  for (const id of ids) useFilesStore.getState().removeFile(id)  // existing path revokes URL
},
```

**Cross-store revoke pattern** (files.ts lines 54-55, 75-77) — already correct for N FileEntries. RESEARCH §5.2 confirms no changes needed: each variant has its own `fileId`, its own `urlCache` slot.

---

### `src/stores/runtime.ts` (MODIFIED, store)

**Analog:** `src/stores/runtime.ts` itself — extend the existing batch state, mirroring the Phase 3 `previewJobId` slot pattern (lines 41, 87, 222-223 — single-field add + reset in batch lifecycle).

**Field additions** (lines 28-43 interface) — D-11(b) byte counter; D-13 throttle flags; D-16 rename count:

```typescript
interface RuntimeState {
  // ... existing fields ...
  // Phase 4 D-11(b): aggregate of in-flight job byteEstimates. Pool reads + writes;
  // surfaced here for StatusBar selectors and tests.
  inflightBytes: number
  // Phase 4 D-13: first-throttle toast latch — flips true on first onThrottle event
  // per batch; resets in startBatch + cancelBatch.
  throttleToastFiredThisBatch: boolean
  // Phase 4 D-13: persistent indicator — true when pool reports inflightBytes > 0
  // AND queue has waiters. StatusBar subscribes.
  throttleActive: boolean
  // Phase 4 D-16: per-batch collision counter. Reset in startBatch.
  renameCountThisBatch: number

  markThrottle: () => void                 // pool calls on each gate-trigger
  setThrottleActive: (v: boolean) => void  // pool toggles when queue empties / refills
  markRename: (count: number) => void      // addFile fan-out increments per collision
}
```

**Reset in `startBatch`** (line 89-97) — same shape, additive:

```typescript
startBatch: (jobIds) =>
  set({
    running: jobIds.length > 0,
    queue: [...jobIds],
    inFlight: new Set(),
    totalJobs: jobIds.length,
    doneCount: 0,
    errorCount: 0,
    // Phase 4: reset per-batch flags
    throttleToastFiredThisBatch: false,
    throttleActive: false,
    renameCountThisBatch: 0,
    // inflightBytes intentionally NOT reset here — it's pool-driven.
  }),
```

**Toast wiring** — fire in `App.tsx`'s pool-callback `useMemo` (lines 256-270), mirroring the existing `onError` discrimination pattern. Use Sonner `toast.info(...)` (matches Phase 3 sanitization-toast convention):

```typescript
onThrottle: () => {
  const r = useRuntimeStore.getState()
  if (r.throttleToastFiredThisBatch) return
  useRuntimeStore.setState({ throttleToastFiredThisBatch: true, throttleActive: true })
  toast.info('Pacing batch for memory', {
    description: 'Some files are queued briefly to keep the tab responsive.',
  })  // copy locked in 04-UI-SPEC.md §Copywriting Contract
},
```

---

### `src/stores/settings.ts` (MODIFIED, store)

**Analog:** existing `setSvg` partial-merge (line 60). RESEARCH Open Question 5 (line 765) recommends: extend `global` for ICC (already there), add a new top-level `resize` slice for the algorithm.

**Pattern** — additive top-level slice:

```typescript
// Add to SettingsState interface:
resize: { alg: ResizeAlg }
setResize: (next: Partial<{ alg: ResizeAlg }>) => void

// Add to create() body:
resize: DEFAULT_RESIZE_SETTINGS,
setResize: (next) => set((s) => ({ resize: { ...s.resize, ...next } })),
```

**`global.preserveIccProfile`** is already declared (defaults.ts line 80, types/index.ts line 118) — no schema change. Wire `setGlobal({ preserveIccProfile: v })` from the new TweaksPanel toggle.

---

### `src/components/panels/TweaksPanel.tsx` (or extend `CodecPanel.tsx`)

**Analog:** `src/components/panels/CodecPanel.tsx` (existing "Resize" + "Metadata" sections at lines 81-117 — visually closest match). `src/components/panels/SvgoPanel.tsx` (foot-gun hint pattern + Section + Toggle composition).

**Section + Toggle pattern** (SvgoPanel.tsx lines 153-174, CodecPanel.tsx lines 108-117) — locked verbatim per UI-SPEC:

```typescript
import { Section } from '@/components/ui/Section'
import { Toggle } from '@/components/ui/Toggle'
import { Seg } from '@/components/ui/Seg'
import { useSettingsStore } from '@/stores/settings'
import { RESIZE_ALG } from '@/data/defaults'

export function TweaksResizeSection() {
  const alg = useSettingsStore((s) => s.resize.alg)
  const setAlg = (next: ResizeAlg) => useSettingsStore.getState().setResize({ alg: next })
  return (
    <Section title="Resize / Variants">
      <div className="row">
        <label>Algorithm</label>
        <Seg options={RESIZE_ALG} value={alg} onChange={setAlg} ariaLabel="Resize algorithm" />
      </div>
    </Section>
  )
}

export function TweaksPrivacySection() {
  const preserveIcc = useSettingsStore((s) => s.global.preserveIccProfile)
  const setPreserveIcc = (v: boolean) =>
    useSettingsStore.getState().setGlobal({ preserveIccProfile: v })
  return (
    <Section title="Privacy / Metadata">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
        <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>
          Preserve ICC color profiles
        </span>
        <Toggle value={preserveIcc} onChange={setPreserveIcc} />
      </div>
      <p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>
        {/* Locked copy from 04-UI-SPEC.md §Copywriting Contract */}
        Wired but inactive in this version. Color profiles are stripped along with all
        metadata. ICC preservation ships in v1.1 once raster encoders integrate.
      </p>
    </Section>
  )
}
```

The helper-text style mirrors `SvgoPanel.tsx` `footgunStyle` (lines 68-73) — same visual contract.

---

### `src/components/file-row/SourceDensityControl.tsx` (NEW)

**Analog:** `src/components/panels/SvgoPanel.tsx` plugin-row (lines 102-122) for the click+keyboard interaction; `src/components/ui/Popover.tsx` for the popover; `src/components/ui/Seg.tsx` for the 3-button segmented control inside the popover.

**Composition pattern** — Popover anchored bottom-right + `<Seg options={['1x','2x','3x']}>` inside (UI-SPEC §Surface 1, lines 137-150). Tab-order + aria-label copy is locked in UI-SPEC §Copywriting Contract.

---

### `src/components/file-row/TargetDensityCheckboxes.tsx` (NEW)

**Analog:** `src/components/panels/SvgoPanel.tsx` plugin-row block (lines 102-122) — same `role="button" aria-pressed tabIndex onKeyDown` shape but for checkboxes the role becomes `role="checkbox"` + `aria-checked`. Source-density checkbox is `aria-checked + aria-disabled` (locked from spec).

**A11y pattern** — copy SvgoPanel keyboard handler (lines 110-115):

```typescript
onKeyDown={(e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    toggle()
  }
}}
```

---

### `src/components/shell/BackpressureIndicator.tsx` (NEW)

**Analog:** `src/components/shell/StatusBar.tsx` worker-pip span (lines 25-28) — same `<span class="item">` shape, same `.pip + (running ? '' : ' idle')` className convention.

**Pattern** — render conditionally based on runtime selector; copy locked in UI-SPEC §Copywriting (label `Pacing`, aria-label full sentence):

```typescript
import { useRuntimeStore } from '@/stores/runtime'

export function BackpressureIndicator() {
  const active = useRuntimeStore((s) => s.throttleActive)
  if (!active) return null
  return (
    <span
      className="item"
      role="status"
      aria-live="polite"
      aria-label="Memory pacing active — admission gate is throttling new jobs"
    >
      <span className="pip warn" /> Pacing
    </span>
  )
}
```

---

### `src/components/shell/StatusBar.tsx` (MODIFIED)

**Analog:** itself. Insert `<BackpressureIndicator />` between the worker-pip span (lines 25-28) and the SVGO version item (line 29). UI-SPEC §Color says: warn-pip + "Pacing" label, sits BETWEEN worker-pip and SVGO version.

---

### `src/App.tsx` (MODIFIED, composition root)

**Analog:** itself. Three changes:

1. **Remove or update the line 518 comment** (`Phase 5 may introduce 1:N`) — D-04+D-14 resolves this.
2. **Thread settings into the PNG adapter** in `startOptimize` (lines 511-600). Pattern from line 540-542 (`isSvg ? useSettingsStore.getState().svg : ...`):
   ```typescript
   const adapterFormat: AdapterFormat = f.format === 'svg' ? 'svg' : f.format === 'png' ? 'png' : 'stub'
   const settings = adapterFormat === 'svg'
     ? useSettingsStore.getState().svg
     : adapterFormat === 'png'
     ? buildPngResizeSettings({
         sourceDensity: f.sourceDensity,
         targetDensity: f.targetDensity ?? f.sourceDensity,
         globalAlg: useSettingsStore.getState().resize.alg,
         fileOverride: f.resizeOverride,
         globalPreserveIcc: useSettingsStore.getState().global.preserveIccProfile,
         filePreserveIcc: f.preserveIcc,
       })
     : (slowMs > 0 ? { slowMs } : {})
   ```
3. **Bind `onThrottle` callback** in the pool `useMemo` (lines 256-270). Reuse the existing isAuxiliaryJob pattern is unrelated — `onThrottle` is unconditional. Toast copy verbatim from UI-SPEC.

---

### `src/tests/raster.spec.ts` (NEW, E2E)

**Analog:** `src/tests/svg-pipeline.spec.ts` (exact match — same store-via-window contract).

**Test scaffold pattern** (svg-pipeline.spec.ts lines 29-78) — copy verbatim, swap `Blob([svgContent], {type:'image/svg+xml'})` for `Blob([pngBytes], {type:'image/png'})`:

```typescript
async function addPngFile(page, id, pngBytes, sourceDensity = '2x', targets = ['1x','2x','3x']) {
  await page.evaluate(
    ({ id, pngBytes, sourceDensity, targets }) => {
      const blob = new Blob([new Uint8Array(pngBytes)], { type: 'image/png' })
      const stores = (window as any).__OIMG_STORES__
      stores.files.getState().addSourceWithVariants({
        sourceBlob: blob, sourceDensity, name: `${id}.png`, format: 'png', targets,
      })
      stores.files.getState().setSelected(id + '-1x')
    },
    { id, pngBytes, sourceDensity, targets },
  )
}
```

**SC-1 density variants test pattern** — assert `byId` has three entries with names `${id}@1x.png` / `@2x.png` / `@3x.png`; mirrors svg-pipeline.spec.ts lines 81-94.

**SC-2 memory budget test** — pair with `instrument-heap.ts` CDP probe (new helper).

**SC-4 no-leak test** — reuse Phase 2 `instrument-blob-urls.js` exactly as `object-url.spec.ts` does (lines 23-29 + 92-105).

---

### `src/tests/filename.test.ts` (NEW, unit)

**Analog:** `src/tests/svg-adapter.unit.ts` (exact — same `--experimental-strip-types` runner, same assert+assertDeep helpers, same `passed/failed` counter pattern).

**Pattern** (svg-adapter.unit.ts lines 18-40) — copy the test harness verbatim. Tests cover idempotence (`logo@2x.png` + `1x` → `logo@1x.png`), suffix application, and `(2)` collision dedup ordering.

---

### `src/tests/icc.test.ts` (NEW, unit)

**Analog:** `src/tests/svg-adapter.unit.ts` (test runner shape) + RESEARCH §1.5 (PNG `iCCP` chunk byte layout).

**Pattern** — read a fixture PNG with embedded `iCCP`, route through the adapter `run()` (or via Playwright if WASM init is unavailable in Node), then assert the output bytes do NOT contain the byte sequence `iCCP`. Use `Buffer.indexOf(Buffer.from('iCCP'))` for the chunk-search.

---

### `src/tests/instrument-heap.ts` (NEW, test helper)

**Analog:** `src/tests/fixtures/instrument-blob-urls.js` (Phase 2 helper, monkey-patch pattern). For CDP, the analog is structurally different — Playwright `BrowserContext.newCDPSession()` API. RESEARCH §Risk 5 has the recipe.

**Pattern** — exported async helper that wraps the Playwright page in a CDP session, samples `Memory.getDOMCounters` + `Memory.startSampling` periodically during a batch, returns max-heap-bytes:

```typescript
import type { Page } from '@playwright/test'

export async function probeHeapDuringBatch(page: Page, runBatch: () => Promise<void>): Promise<number> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Memory.startSampling')
  let peak = 0
  const interval = setInterval(async () => {
    const profile = await cdp.send('Memory.getSamplingProfile')
    const total = profile.profile.samples.reduce((a, s) => a + s.size, 0)
    if (total > peak) peak = total
  }, 50)
  try {
    await runBatch()
  } finally {
    clearInterval(interval)
    await cdp.send('Memory.stopSampling')
    await cdp.detach()
  }
  return peak
}
```

---

## Shared Patterns

### Adapter contract (Phase 2 D-04)

**Source:** `src/workers/types.ts` lines 21-24 (`AdapterRun<TSettings>`); RESEARCH §Architectural Responsibility Map.
**Apply to:** `src/workers/png-adapter.ts`.

```typescript
export type AdapterRun<TSettings = unknown> = (
  input: ArrayBuffer,
  settings: TSettings
) => Promise<AdapterRunResult>
```

PNG adapter's `run` MUST conform without modification — same `(input, settings) => Promise<{output, meta}>` signature as svg-adapter, stub-adapter. The worker (`worker.ts` line 45) wraps with `Comlink.transfer({ output, meta }, [output])` — adapter does NOT call Comlink itself.

### Worker-side error taxonomy

**Source:** `src/workers/types.ts` lines 45-54 (`AdapterError`); `src/workers/svg-adapter.ts` lines 50-52 (usage).
**Apply to:** every try-block in `png-adapter.ts` — three phases (`'decode' | 'process' | 'encode'`) each rethrow as `AdapterError`.

```typescript
throw new AdapterError('png', 'process', err instanceof Error ? err.message : String(err))
```

### Object-URL revoke before write (Phase 2 D-10 / Pitfall 3)

**Source:** `src/stores/files.ts` lines 75-77 (`markDone`), 54-55 (`removeFile`).
**Apply to:** all new file-removing code — the existing `removeFile`/`markDone`/`clear` paths already revoke. `removeFamily` MUST loop and call `removeFile` per RESEARCH §5.2; do NOT write a custom batch-removal that bypasses revoke.

### Cross-store side effects via getState() (Phase 2-3 idiom)

**Source:** `src/stores/files.ts` lines 54-55 (`useRuntimeStore.getState().revokeObjectURL`); `src/stores/runtime.ts` lines 224-228 (`useFilesStore.getState().byId[fileId]`).
**Apply to:** `addSourceWithVariants` (collision check reads existing `byId`); `onThrottle` callback in App.tsx (`useRuntimeStore.setState` + Sonner toast).

### Store-driven E2E test scaffold

**Source:** `src/tests/svg-pipeline.spec.ts` lines 29-78; `src/tests/object-url.spec.ts` lines 36-58; `src/tests/worker-pool.spec.ts` lines 23-66.
**Apply to:** `src/tests/raster.spec.ts` — same `window.__OIMG_STORES__` access, same `addFile`-then-click-Optimize-then-`waitForFunction(status === 'done')` flow.

Pattern:
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() =>
    typeof (window as any).__OIMG_STORES__ === 'object'
  )
})
```

### Auxiliary-job prefix discrimination

**Source:** `src/App.tsx` lines 254-255 (`isAuxiliaryJob`); CONTEXT.md `<code_context>` "Established Patterns" — Phase 4 variant jobs are PRIMARY work, NOT auxiliary, so do NOT prefix them. Use bare `${sourceUuid}-${density}` ids (matches D-04+D-14 contract).

### Per-row badge + first-event-only toast (Phase 3 D-13 mirror)

**Source:** `src/App.tsx` lines 751-765 (sanitized badge in file-row stat line — per-row, no toast); Phase 3 sanitization toast deliberately absent.
**Apply to:** Phase 4 collision rename (D-16) and throttle event (D-13). Both use `toast.info` once per batch, latched by a `*ThisBatch` flag in `useRuntimeStore`. Per-row affordance for collisions = the renamed FileEntry.name itself; per-row affordance for throttle = the StatusBar pill.

### Settings-global with deferred per-file UI (Phase 3 D-09 mirror)

**Source:** `src/types/index.ts` line 78-81 (`unsafeExport?` Phase-3 example).
**Apply to:** `FileEntry.resizeOverride?` and `FileEntry.preserveIcc?` — data shape ships now, UI lands Phase 5 detail view (per CONTEXT.md D-07 + D-09).

---

## No Analog Found

| File | Role | Data Flow | Why no analog |
|------|------|-----------|---------------|
| `src/lib/sniff.ts` | utility (binary parse) | Blob slice → struct | No prior binary-format sniffer in repo. RESEARCH §Code Examples (lines 668-685) is the literal source. |
| `src/lib/memory-budget.ts` | utility (env probe + bytes math) | navigator → number | Closest is `runtime.ts` POOL_SIZE block (env probe) but the math layer is novel. RESEARCH §3 (lines 379-385) is the source. |
| `src/tests/instrument-heap.ts` | test helper (CDP) | CDP session → samples | `instrument-blob-urls.js` is the closest pattern (test-time runtime probe) but uses a totally different API surface (URL monkey-patch vs CDP). RESEARCH §Risk 5 + Playwright CDP API are the sources. |

---

## Metadata

**Analog search scope:**
- `src/workers/` (4 files)
- `src/stores/` (4 files)
- `src/components/panels/` (4 files)
- `src/components/shell/` (5 files)
- `src/components/ui/` (Toggle, Section, Seg, Popover)
- `src/lib/` (sanitize-svg, format, object-url)
- `src/tests/` (svg-pipeline, svg-adapter.unit, object-url, worker-pool, fixtures)
- `src/types/index.ts`
- `src/data/defaults.ts`
- `src/App.tsx` (filelist JSX block)

**Files scanned:** 27 production source files + 6 test files.

**Pattern extraction date:** 2026-05-03

**Reading list for the planner (referenced patterns by line range):**

| File | Lines | What |
|------|-------|------|
| `src/workers/svg-adapter.ts` | 1-23, 24-35, 37-74 | docblock, imports, run() shape |
| `src/workers/svg-config.ts` | 1-17, 18-22, 43-73 | extract rationale, settings shape, builder fn |
| `src/workers/types.ts` | 5, 7-14, 21-24, 36-42, 45-54 | AdapterFormat union, AdapterMeta, AdapterRun, PoolJob, AdapterError |
| `src/workers/worker.ts` | 13-15, 16-38, 40-49 | static-map pattern, ADAPTERS map, Comlink expose |
| `src/workers/pool.ts` | 36-43, 192-201, 203-262 | PoolCallbacks, tryDispatch, runOnSlot finally |
| `src/workers/stub-adapter.ts` | 14-24 | minimal adapter skeleton |
| `src/stores/files.ts` | 41-55, 47-51, 53-72, 74-96, 114-124 | store create, addFile, removeFile (revoke), markDone (revoke + write), clear |
| `src/stores/runtime.ts` | 23-26, 28-43, 87, 89-97, 165-182, 222-223 | POOL_SIZE probe, state shape, previewJobId slot, startBatch reset, urlCache helpers |
| `src/stores/settings.ts` | 29-48, 50-77 | state shape, partial-merge setters |
| `src/components/panels/SvgoPanel.tsx` | 22-26, 31-44, 62-176, 68-73, 102-122, 153-174 | foot-gun copy const, plugin meta, panel root, helper-text style, plugin row a11y, sanitization Section pattern |
| `src/components/panels/CodecPanel.tsx` | 81-117 | Resize + Metadata sections (visual analog) |
| `src/components/shell/StatusBar.tsx` | 21-40 | footer + items + worker-pip pattern |
| `src/components/ui/Section.tsx` | 9-19 | Section component shape |
| `src/components/ui/Toggle.tsx` | 6-22 | accessible toggle |
| `src/components/ui/Seg.tsx` | 13-58 | radio-group segmented control |
| `src/lib/object-url.ts` | 7-13 | helper sugar over store |
| `src/lib/sanitize-svg.ts` | 27-58 | main-thread post-worker pass (architectural analog for ICC threading in P5) |
| `src/tests/svg-pipeline.spec.ts` | 29-78, 80-111 | E2E scaffold, drop-and-assert pattern |
| `src/tests/svg-adapter.unit.ts` | 1-40, 42-58, 62-75 | --strip-types runner, test harness, parametric assertions |
| `src/tests/object-url.spec.ts` | 23-29, 92-105 | instrument-blob-urls integration, leak-count assertion |
| `src/tests/worker-pool.spec.ts` | 16-66 | beforeEach store-availability wait, single-blob round-trip |
| `src/tests/fixtures/instrument-blob-urls.js` | 19-35 | page-init monkey-patch IIFE |
| `src/App.tsx` | 254-270, 511-600, 710-808 | pool-callback bindings, startOptimize loop, file-row JSX (extraction target for FilePanel) |
| `src/data/defaults.ts` | 78-81, 86 | DEFAULT_GLOBAL_SETTINGS, RESIZE_ALG enum |

PATTERN MAPPING COMPLETE
