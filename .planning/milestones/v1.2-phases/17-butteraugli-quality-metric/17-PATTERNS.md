# Phase 17: Butteraugli Quality Metric — Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 14 (12 edits, 1 new spec, 0 new production files)
**Analogs found:** 14 / 14 (100% — every file is a Phase 16 extension in-place)

Phase 17 is a **near-verbatim extension of Phase 16 (SSIM)** — the same file shape, in the same locations, with `butteraugli`/`Butteraugli`/`__BUTTERAUGLI_BUILD__` substituted for the SSIM identifiers. The **one novel pattern** is `createVisDiff('client')`, extracted from the imagequant precedent at `codec.worker.ts:128` (commit d3d2d2e: nested workers under Vite SPA fallback break WASM URL resolution — client mode fixes it).

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `vite.config.ts` | config | build-time | `vite.config.ts:62` (`VERSIONS.ssim`) | exact (in-file) |
| `src/lib/versions.ts` | utility | build-time | `versions.ts:26` (`ssim: readVer('ssim.js')`) | exact (in-file) |
| `src/types/globals.d.ts` | config (ambient) | build-time | `globals.d.ts:18` (`__SSIM_VERSION__`) | exact (in-file) |
| `src/lib/metrics-bands.ts` | utility (pure) | transform | `metrics-bands.ts:7,13` (`SSIM_BANDS`, `ssimBand`) | exact (in-file) |
| `src/workers/metrics.worker.ts` | worker | request-response | `metrics.worker.ts:82` (`computeSSIM`) + `codec.worker.ts:114-131` (`getQuantizer` / `createImagequantQuantizer('client')`) | exact + novel wasm-load |
| `src/lib/metrics-worker.ts` | service (singleton) | request-response | itself — API-agnostic Comlink proxy widens automatically | no change |
| `src/lib/settings.ts` | model (types) | — | `settings.ts:28` (`metrics?: { ssim?: number \| null }`) | exact (in-file) |
| `src/stores/files.ts` | store | CRUD | `files.ts:148` (`setFileMetric<K extends 'ssim'>`) | exact (in-file) |
| `src/hooks/useMetricsAuto.ts` | hook | event-driven | itself (add Butteraugli dispatch in parallel) | exact (in-file) |
| `src/components/panels/inspector/ReportPanel.tsx` | component | render | `ReportPanel.tsx:173-205` (SSIM row + Quality Section) | exact (in-file) |
| `src/tests/versions.test.ts` | test (unit) | assertion | `versions.test.ts:50-67` (SSIM assertions) | exact (in-file) |
| `src/tests/metrics-bands.test.ts` | test (unit) | assertion | `metrics-bands.test.ts:26-51` (SSIM boundary sweep) | exact (in-file) |
| `src/tests/build.test.ts` | test (unit) | assertion | `build.test.ts:112-171` (metrics-worker chunk + `bezkrovny` HOIST_SENTINEL) | exact (in-file) |
| `src/tests/stores.test.ts` | test (unit) | assertion | `stores.test.ts:256-298` (setFileMetric ssim writes + setFileResult invalidation) | exact (in-file) |
| `src/tests/butteraugli-metric.spec.ts` (NEW) | test (e2e) | ingest→display | `src/tests/ssim-metric.spec.ts` (entire file) | exact (whole-file clone) |

---

## Pattern Assignments

### 1. `vite.config.ts` (config, build-time)

**Analog:** `vite.config.ts:52-64` (`VERSIONS.ssim`) + `vite.config.ts:145-150` (`define.__SSIM_VERSION__`)

**Existing SSIM hook** (lines 62-64):
```typescript
const VERSIONS = {
  svgo: readVer('svgo'),
  jsquash: { /* ... */ },
  ssim: readVer('ssim.js'),
  // Phase 17 — append: butteraugli build hash (read from vendored artefact)
}
```

**Existing SSIM define** (lines 145-150):
```typescript
define: {
  __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo),
  __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash),
  __SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),
  // Phase 17 — append: __BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli),
}
```

**Delta:**
- Add `butteraugli: readVer('@squoosh-kit/visdif')` to `VERSIONS` (line 64, replacing the comment stub).
- Add `__BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli)` to `define` (line 149).
- The `serveSquooshKitNodeModuleWasm()` middleware (lines 17-39) needs no change — its regex `/^\/node_modules\/(@squoosh-kit\/[^/]+\/dist\/.+\.(?:wasm|js|mjs))/` already covers visdif.

---

### 2. `src/lib/versions.ts` (utility, build-time)

**Analog:** `versions.ts:22-50` (BuildVersions interface + BUILD_VERSIONS const)

**Existing SSIM promotion** (lines 22-29, 42-49):
```typescript
export interface BuildVersions {
  svgo: string
  jsquash: Record<CodecKey, string>
  /** Phase 16 — MTR-01: perceptual-quality library version. */
  ssim: string
  /** Phase 17 hook — populated when Butteraugli vendored build lands. */
  butteraugli?: { buildHash: string }
}
export const BUILD_VERSIONS: BuildVersions = {
  svgo: typeof __SVGO_VERSION__ === 'string' ? __SVGO_VERSION__ : '0.0.0',
  jsquash: /* ... */,
  ssim: typeof __SSIM_VERSION__ === 'string' ? __SSIM_VERSION__ : '0.0.0',
  // butteraugli intentionally omitted — Phase 17 will populate.
}
```

**Delta:**
- Promote `butteraugli?: { buildHash: string }` → `butteraugli: { buildHash: string }` (drop optional marker, line 28).
- Add to `BUILD_VERSIONS`: `butteraugli: { buildHash: typeof __BUTTERAUGLI_BUILD__ === 'string' ? __BUTTERAUGLI_BUILD__ : '0.0.0' }` (line 49, replacing the comment).
- **buildHash is the semver** (`'0.2.4'`), not a wasm sha256 — per research §Assumption A3. Optional sha256 shim is a 5-line follow-up if provenance is later required.

---

### 3. `src/types/globals.d.ts` (ambient config, build-time)

**Analog:** `globals.d.ts:9-20` (`__SVGO_VERSION__`, `__SSIM_VERSION__`, Phase 17 hook comment)

**Existing hook** (lines 18-20):
```typescript
declare const __SSIM_VERSION__: string
// Phase 17 — append:
// declare const __BUTTERAUGLI_BUILD__: string
```

**Delta:**
- Uncomment line 20: `declare const __BUTTERAUGLI_BUILD__: string`

---

### 4. `src/lib/metrics-bands.ts` (utility, pure transform)

**Analog:** `metrics-bands.ts:6-17` (`SSIM_BANDS` + `ssimBand`)

**Existing SSIM pattern** (lines 6-20):
```typescript
/** SSIM: higher is better (0 = no similarity, 1 = identical). Verbatim per REQUIREMENTS.md MTR-03. */
export const SSIM_BANDS = { green: 0.95, yellow: 0.85 } as const

export function ssimBand(v: number): Band {
  if (v >= SSIM_BANDS.green) return 'green'
  if (v >= SSIM_BANDS.yellow) return 'yellow'
  return 'red'
}

// Phase 17 hook — populated when Butteraugli vendored build lands. Lower is better (distance metric).
// export const BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 } as const
```

**Delta:**
- Add `BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 } as const` (uncomment + promote line 20).
- Add `butteraugliBand(v)` with **INVERTED direction** — SSIM uses `>=` (higher-better inclusive), Butteraugli uses `<` (lower-better strict-exclusive at 1.5/3.0):
  ```typescript
  export function butteraugliBand(v: number): Band {
    if (v < BUTTERAUGLI_BANDS.green)  return 'green'
    if (v < BUTTERAUGLI_BANDS.yellow) return 'yellow'
    return 'red'
  }
  ```

---

### 5. `src/workers/metrics.worker.ts` (worker, request-response)

**Analog A (structural clone):** `metrics.worker.ts:82-132` (`computeSSIM` — full function including V5 validation, decode-parallel, dim-align, dynamic import).

**Analog B (novel wasm-load pattern):** `codec.worker.ts:114-131` (`getQuantizer` + `createImagequantQuantizer('client')`).

**Excerpt A — SSIM structural template** (lines 82-132, canonical shape):
```typescript
async function computeSSIM(job: SSIMJob): Promise<SSIMResult> {
  try {
    if (!KNOWN_SOURCE_FORMATS.has(String(job.sourceFormat).toLowerCase())) {
      throw new Error('Unsupported sourceFormat for SSIM: ' + String(job.sourceFormat))
    }
    if (!KNOWN_TARGET_FORMATS.has(String(job.targetFormat).toLowerCase())) {
      throw new Error('Unsupported targetFormat for SSIM: ' + String(job.targetFormat))
    }
    if (job.rawBuffer.byteLength === 0) throw new Error('Empty rawBuffer')
    if (job.encodedBuffer.byteLength === 0) throw new Error('Empty encodedBuffer')

    const [rawImg, encImg] = await Promise.all([
      decode(job.rawBuffer, job.sourceFormat),
      decode(job.encodedBuffer, job.targetFormat),
    ])
    let alignedRaw = rawImg
    if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) {
      const { default: resize } = await import('@jsquash/resize')
      alignedRaw = await resize(rawImg, {
        width: encImg.width, height: encImg.height,
        method: 'lanczos3', fitMethod: 'stretch',
      })
    }
    const ssimMod = await import('ssim.js')
    const ssim = (ssimMod as { default?: typeof ssimMod.ssim; ssim: typeof ssimMod.ssim }).default
      ?? ssimMod.ssim
    const start = performance.now()
    const result = ssim(alignedRaw as unknown as ImageData, encImg as unknown as ImageData)
    const end = performance.now()
    return { mssim: result.mssim, ms: Math.round(end - start) }
  } catch (err) {
    return Promise.reject(err)
  }
}
Comlink.expose({ computeSSIM })
```

**Excerpt B — imagequant `client`-mode singleton (CRITICAL wasm-load precedent)** at `codec.worker.ts:114-131`:
```typescript
// imagequant's default `quantize()` spawns a nested Web Worker (imagequant.worker.js) via
// new URL('../../imagequant/dist/…', import.meta.url), which resolves to a non-existent path
// when the package is served from /node_modules and produces the "text/html MIME" error
// (Vite's SPA fallback). We're already in a worker, so run it in-thread with the 'client'
// bridge — WASM loads via loadImagequantModule() using ./wasm/… relative to the served
// index.browser.mjs, which exists in node_modules.
type Quantizer = (
  image: ImageData,
  opts: { numColors: number; dither: number },
) => Promise<{ data: Uint8Array | Uint8ClampedArray; width: number; height: number }>

let _quantizer: Quantizer | null = null
async function getQuantizer(): Promise<Quantizer> {
  if (_quantizer) return _quantizer
  const { createImagequantQuantizer } = await import('@squoosh-kit/imagequant')
  _quantizer = createImagequantQuantizer('client') as unknown as Quantizer
  return _quantizer
}
```

**Delta (Butteraugli-specific):**
- Rename `SSIMJob` → `MetricJob` (shared shape between SSIM + Butteraugli); export both `SSIMJob` (alias for BC) and `MetricJob`. Alternatively add `ButteraugliJob = SSIMJob` alias so useMetricsAuto's existing imports don't break.
- Add `ButteraugliResult = { distance: number; ms: number }` type.
- Widen `MetricsApi` to `{ computeSSIM: ...; computeButteraugli: ... }`.
- Add module-level `let _visdif: ... | null = null` + `getVisDif()` **verbatim copy of the imagequant `_quantizer`/`getQuantizer` shape** — swap `createImagequantQuantizer` → `createVisDiff`, both with `'client'` mode argument.
- Add `computeButteraugli(job)` — structural clone of `computeSSIM` with the ssim.js dynamic import replaced by `await getVisDif()`, and the return shape `{ distance, ms }` instead of `{ mssim, ms }`. Reuse `decode()` and the resize-align block **verbatim** (no duplication — same helper).
- Add `Number.isFinite(distance)` check on the returned distance (visdif returns a number; guard against non-finite defensively).
- Widen final `Comlink.expose({ computeSSIM, computeButteraugli })`.

---

### 6. `src/lib/metrics-worker.ts` (service, singleton) — NO CHANGE

**Analog:** itself. The `Comlink.wrap<MetricsApi>` proxy is API-agnostic — the new `computeButteraugli` method surfaces automatically once the worker widens `MetricsApi`. Verified: `metrics-worker.ts:16-23` wraps the type, doesn't hardcode methods.

**Delta:** none. No file edit required.

---

### 7. `src/lib/settings.ts` (model, type)

**Analog:** `settings.ts:28` (`metrics?: { ssim?: number | null }`)

**Existing pattern:**
```typescript
metrics?: { ssim?: number | null }; // Phase 16 — MTR-01: perceptual-quality cache; undefined=pending, null=failed, number=computed
```

**Delta:**
- Widen to `metrics?: { ssim?: number | null; butteraugli?: number | null }`.
- Keep the trailing comment (invariant: `undefined=pending, null=failed, number=computed` applies to both keys).

---

### 8. `src/stores/files.ts` (store, CRUD)

**Analog:** `files.ts:148-150` (`setFileMetric<K extends 'ssim'>`) + `files.ts:155-163` (`setFileResult` — the invalidation funnel).

**Existing pattern:**
```typescript
export function setFileMetric<K extends 'ssim'>(id: string, key: K, value: number | null): void {
  updateEntry(id, (e) => ({ metrics: { ...(e.metrics ?? {}), [key]: value } }))
}

export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  updateEntry(id, () => ({
    encodedBuffer,
    opt: optimizedSize,
    error: undefined,
    status: 'done' as const,
    metrics: undefined, // Phase 16 — MTR-01: invalidate stale SSIM on re-encode (Pitfall 4)
  }))
}
```

**Delta:**
- Widen key union: `<K extends 'ssim' | 'butteraugli'>` — one-token change on line 148.
- **`setFileResult` needs NO change** — `metrics: undefined` already wipes both keys atomically (Phase 16 Pitfall 4 pattern extends transparently to Butteraugli).

---

### 9. `src/hooks/useMetricsAuto.ts` (hook, event-driven)

**Analog:** itself — `useMetricsAuto.ts:23-83` (whole hook body).

**Existing SSIM dispatch pattern** (lines 30-82):
```typescript
useEffect(() => {
  if (!selected) return
  if (selected.status !== 'done') return
  if (!selected.rawBuffer || !selected.encodedBuffer) return
  if (selected.metrics?.ssim !== undefined) return
  const src = selected.type.toLowerCase()
  const tgt = selected.settings?.codec?.toLowerCase() ?? src
  if (src === 'svg') return
  if (tgt === 'svg') return

  const seq = ++seqRef.current
  const fileId = selected.id
  const rawBuffer = selected.rawBuffer.slice(0)
  const encodedBuffer = selected.encodedBuffer.slice(0)

  void (async () => {
    try {
      const { getMetricsWorker } = await import('@/lib/metrics-worker')
      const worker = getMetricsWorker()
      const job: SSIMJob = { rawBuffer, encodedBuffer, sourceFormat: src as ..., targetFormat: tgt as ... }
      const { mssim } = await worker.computeSSIM(job)
      if (seq !== seqRef.current) return
      setFileMetric(fileId, 'ssim', mssim)
    } catch {
      if (seq !== seqRef.current) return
      setFileMetric(fileId, 'ssim', null)
    }
  })()
}, [selected?.id, selected?.status, selected?.encodedBuffer, selected?.metrics?.ssim])
```

**Delta (per research §Pattern 2):**
- Cache-hit guard becomes two-part: `ssimSettled = metrics?.ssim !== undefined`, `butSettled = metrics?.butteraugli !== undefined`. Early-return only if **BOTH** are settled.
- **FOUR slices required** (Pitfall 5): `rawForSSIM`, `encForSSIM`, `rawForBut`, `encForBut` — Comlink transfers detach the ArrayBuffer per dispatch, and parallel dispatches would race the same buffer.
- Wrap both dispatches in `Promise.allSettled([...])` under the same `seq` token — CR-02 stale-drop applies to the whole batch (one seqRef guards both metrics).
- Write both metrics conditionally: `if (!ssimSettled) setFileMetric(fileId, 'ssim', ...)` and `if (!butSettled) setFileMetric(fileId, 'butteraugli', ...)`.
- Extend deps array: add `selected?.metrics?.butteraugli` to trigger re-eval on cache landing.

---

### 10. `src/components/panels/inspector/ReportPanel.tsx` (component, render)

**Analog:** `ReportPanel.tsx:172-205` (Quality Section + SSIM row).

**Existing SSIM row** (lines 173-205):
```tsx
{selected?.status === 'done' && selected.type.toLowerCase() !== 'svg' && (
  <Section title="Quality">
    <div data-testid="ssim-row" className="flex items-baseline justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">SSIM</span>
      {selected.metrics?.ssim === undefined ? (
        <span className="text-[12px] font-mono text-[var(--color-fg-2)]">Computing…</span>
      ) : selected.metrics.ssim === null ? (
        <span className="text-[12px] font-mono text-[var(--color-fg-2)]">N/A</span>
      ) : (
        <span
          data-testid="ssim-score"
          data-band={ssimBand(selected.metrics.ssim)}
          className="text-[14px] font-semibold font-mono"
          style={{ color: BAND_COLOR[ssimBand(selected.metrics.ssim)] }}
        >
          {selected.metrics.ssim.toFixed(3)}
        </span>
      )}
    </div>
    <p className="text-[10px] text-[var(--color-fg-2)] mt-1">
      Green ≥ {SSIM_BANDS.green} · Yellow ≥ {SSIM_BANDS.yellow} · Red below.
    </p>
  </Section>
)}
```

**Delta:**
- Import `butteraugliBand, BUTTERAUGLI_BANDS` from `@/lib/metrics-bands` (line 19 extension).
- Add a **sibling** `<div data-testid="butteraugli-row">` **inside the same `<Section title="Quality">` block** — do NOT create a second Section. Same three-branch conditional shape (Computing… / N/A / banded score).
- `data-testid` values: `butteraugli-row` and `butteraugli-score` (mirror SSIM naming).
- Score format is `.toFixed(2)` (Butteraugli distances are 0–5 range, one decimal is convention; SSIM uses `.toFixed(3)` because it's 0–1). Research §Anti-Patterns explicit.
- Extend the caption `<p>` to a two-line block:
  ```
  SSIM: higher is better · Butteraugli: lower is better
  Butteraugli: Green < {BUTTERAUGLI_BANDS.green} · Yellow < {BUTTERAUGLI_BANDS.yellow} · Red above.
  ```
  Reuse `BAND_COLOR` verbatim — no new color tokens.

---

### 11. `src/tests/versions.test.ts` (test, unit)

**Analog:** `versions.test.ts:47-67` (SSIM shape + safe-fallback assertions + Phase 17 hook check).

**Existing SSIM assertions** (lines 50-67):
```typescript
assert('BUILD_VERSIONS.ssim is a string',
  typeof v.ssim === 'string')
assert('BUILD_VERSIONS.ssim matches semver shape',
  /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v.ssim))
if (typeof __SSIM_VERSION__ === 'undefined') {
  assert('BUILD_VERSIONS.ssim safe-fallback === "0.0.0" outside Vite',
    v.ssim === '0.0.0')
} else {
  assert('BUILD_VERSIONS.ssim !== "0.0.0" when __SSIM_VERSION__ is defined',
    v.ssim !== '0.0.0')
}

assert('butteraugli hook is undefined in Phase 13',
  v.butteraugli === undefined)
```

**Delta:**
- **DELETE** the `'butteraugli hook is undefined in Phase 13'` assertion (line 66-67). It flips from correct to failing when Phase 17 lands.
- **REPLACE** with the SSIM shape (mirroring the existing SSIM stanza): `typeof v.butteraugli === 'object'`, `typeof v.butteraugli?.buildHash === 'string'`, semver regex on `buildHash`, safe-fallback `=== '0.0.0'` outside Vite, `!== '0.0.0'` inside Vite (guard on `typeof __BUTTERAUGLI_BUILD__ === 'undefined'`).

---

### 12. `src/tests/metrics-bands.test.ts` (test, unit)

**Analog:** `metrics-bands.test.ts:26-51` (SSIM boundary sweep).

**Existing SSIM boundary sweep** (lines 26-51):
```typescript
assert('SSIM_BANDS.green === 0.95 (MTR-03 verbatim)',
  SSIM_BANDS.green === 0.95)
assert('SSIM_BANDS.yellow === 0.85 (MTR-03 verbatim)',
  SSIM_BANDS.yellow === 0.85)

assert('ssimBand(1.0) returns "green"',      ssimBand(1.0) === 'green')
assert('ssimBand(0.95) returns "green" (>= inclusive boundary)',
  ssimBand(0.95) === 'green')
assert('ssimBand(0.9499) returns "yellow" (just below green)',
  ssimBand(0.9499) === 'yellow')
assert('ssimBand(0.90) returns "yellow" (mid-band)', ssimBand(0.90) === 'yellow')
assert('ssimBand(0.85) returns "yellow" (>= inclusive boundary)',
  ssimBand(0.85) === 'yellow')
assert('ssimBand(0.8499) returns "red" (just below yellow)',
  ssimBand(0.8499) === 'red')
assert('ssimBand(0) returns "red" (lower floor)', ssimBand(0) === 'red')
```

**Delta:**
- Import `BUTTERAUGLI_BANDS, butteraugliBand` from `@/lib/metrics-bands`.
- Constant assertions: `BUTTERAUGLI_BANDS.green === 1.5`, `BUTTERAUGLI_BANDS.yellow === 3.0`.
- **INVERT the boundary semantics** — Butteraugli uses strict `<` (see delta #4):
  - `butteraugliBand(0.0) === 'green'` (identical)
  - `butteraugliBand(1.499) === 'green'` (just under green boundary)
  - `butteraugliBand(1.5) === 'yellow'` (STRICT `<` — boundary flips to yellow)
  - `butteraugliBand(2.999) === 'yellow'`
  - `butteraugliBand(3.0) === 'red'` (STRICT `<` — boundary flips to red)
  - `butteraugliBand(10) === 'red'` (upper floor)

---

### 13. `src/tests/build.test.ts` (test, unit)

**Analog:** `build.test.ts:112-171` (metrics-worker chunk check + `bezkrovny` HOIST_SENTINEL + ssim chunk-name positive check).

**Existing SSIM chunk assertions** (lines 116-169):
```typescript
const metricsWorkerChunk = assetsList.find((n) => /metrics\.?worker-.*\.js$/.test(n))
if (!metricsWorkerChunk) { /* fail */ }

const HOIST_SENTINEL = 'bezkrovny'
for (const file of jsFiles) {
  const source = readFileSync(filePath, 'utf-8')
  if (source.includes(HOIST_SENTINEL)) { /* fail */ }
}

const hasSsimChunk = assetsList.some((n) => /ssim/i.test(n))
if (!hasSsimChunk) { /* fail */ }
```

**Delta (per research §Pitfall 6):**
- The `metricsWorkerChunk` check is **already sufficient for Butteraugli** — same worker. No new chunk-existence check for the worker.
- Add a `VISDIF_HOIST_SENTINEL = 'VisDiff'` (or `'visdif'` — pick after inspecting the actual minified bundle) parallel to `HOIST_SENTINEL = 'bezkrovny'`. **DO NOT reuse `computeButteraugli` string** — the identifier legitimately appears in the initial route as the Comlink method-call reference (identical false-positive class to the `computeSSIM` audit trail note at build.test.ts:127-143).
- Add a positive-check: `hasVisdifChunk = assetsList.some((n) => /visdif/i.test(n))` — mirror the `hasSsimChunk` check.

---

### 14. `src/tests/stores.test.ts` (test, unit)

**Analog:** `stores.test.ts:232-298` (Phase 16 setFileMetric writer + invalidation stanza).

**Existing SSIM assertions** (lines 256-298 — 6 assertions):
```typescript
// (a) setFileMetric(id, 'ssim', number) writes only to target entry
setFileMetric('a', 'ssim', 0.981)
assert('setFileMetric(a, ssim, 0.981) → entries[a].metrics.ssim === 0.981', eA?.metrics?.ssim === 0.981)
assert('setFileMetric(a, ...) does NOT touch sibling b.metrics', eB?.metrics === undefined)

// (b) setFileMetric(id, 'ssim', null) writes null (failed-compute)
setFileMetric('a', 'ssim', null)
assert('setFileMetric(a, ssim, null) → entries[a].metrics.ssim === null', afterNull?.metrics?.ssim === null)

// (c) setFileResult invalidates prior metrics
filesAtom.set({ ... entries: entries.map(e => e.id === 'a' ? { ...e, metrics: { ssim: 0.981 } } : e) ... })
setFileResult('a', buf, 128)
assert('setFileResult clears prior metrics (metrics: undefined)', afterResult?.metrics === undefined)
```

**Delta:**
- Add parallel assertions for `setFileMetric('a', 'butteraugli', 1.2)` and `setFileMetric('a', 'butteraugli', null)` — identical shape, different key.
- Add a **combined-write assertion**: after `setFileMetric('a', 'ssim', 0.981)` followed by `setFileMetric('a', 'butteraugli', 1.2)`, both keys should coexist in `entries[a].metrics` (proves the `{ ...(e.metrics ?? {}), [key]: value }` merge in `setFileMetric` handles multi-key state — the spread already supports this but the test proves it).
- Extend the invalidation-precondition seed to `{ ssim: 0.981, butteraugli: 1.2 }` — verify `setFileResult` wipes **both** keys atomically (already true from Pitfall 4 pattern; the test just proves it).

---

### 15. `src/tests/butteraugli-metric.spec.ts` (NEW — test, e2e)

**Analog:** `src/tests/ssim-metric.spec.ts` (entire file — clone as template).

**Existing SSIM spec structure** (`ssim-metric.spec.ts:96-197`):
```typescript
test.describe('SSIM metric — MTR-01/MTR-03 end-to-end display', () => {
  test.setTimeout(45_000)
  test('happy path: PNG with buffers → SSIM row shows banded score', ...)
  test('selection thrash: final band lands on last-selected file (CR-02)', ...)
  test('SVG source: Quality Section is not rendered (N/A path)', ...)
})
```

Uses:
- `BLUE_PNG_B64` fixture — 16×16 solid PNG, embedded inline (no checked-in binaries).
- `injectEntries(page, specs)` helper — writes entries directly into `filesAtom` via `page.evaluate` on `/src/stores/files.ts`.
- `openReportTab`, `selectFileById` helpers.
- `page.waitForFunction(() => filesAtom.get().entries.find(e => e.id === 'happy').metrics?.ssim !== undefined)` — cache-arrival gate.
- `page.locator('[data-testid="ssim-score"]')` + `toHaveAttribute('data-band', /^(green|yellow|red)$/)` — attribute-only assertion, no text on the score itself.

**Delta:**
- Duplicate the whole file. Swap identifiers globally: `ssim` → `butteraugli`, `SSIM` → `Butteraugli`, `mssim` → `distance`, `ssim-row` → `butteraugli-row`, `ssim-score` → `butteraugli-score`.
- Numeric-range cross-check: SSIM is `[0, 1]`; Butteraugli is `[0, +∞)` (typical 0–5). Assert `>= 0` and `<= 20` as a sanity ceiling (defensive; visdif on identical bytes returns near-0).
- **Optional**: extend the happy-path test to assert **both** rows are present (SSIM + Butteraugli simultaneously) — proves parallel dispatch. This can live in either spec; picking this new file avoids bloating `ssim-metric.spec.ts`.

---

## Shared Patterns

### Shared 1: `client`-mode WASM bootstrap for nested-worker packages
**Source:** `src/workers/codec.worker.ts:114-131`
**Apply to:** `src/workers/metrics.worker.ts` (new `getVisDif` helper)
**Why (verbatim from codec.worker.ts:114-119 comment):** "imagequant's default `quantize()` spawns a nested Web Worker... which resolves to a non-existent path when the package is served from /node_modules and produces the 'text/html MIME' error (Vite's SPA fallback). We're already in a worker, so run it in-thread with the 'client' bridge."
**Rule:** Every `@squoosh-kit/*` package instantiated **inside another worker** must use the `'client'` mode of its factory. `createVisDiff('client')` mirrors `createImagequantQuantizer('client')`. No exceptions in this app.

### Shared 2: PIPE-02 dynamic-import-inside-branch discipline
**Source:** `codec.worker.ts` (every codec branch) + `metrics.worker.ts:117` (`await import('ssim.js')`)
**Apply to:** `metrics.worker.ts` — `await import('@squoosh-kit/visdif')` inside `getVisDif()`; do NOT hoist to the top of the file.
**Enforced by:** `src/tests/build.test.ts` — `HOIST_SENTINEL = 'bezkrovny'` catches ssim.js hoisting today; add `VISDIF_HOIST_SENTINEL = 'VisDiff'` for the same check on visdif.

### Shared 3: `updateEntry` funnel + generic `metrics` object
**Source:** `src/stores/files.ts:148-150` (`setFileMetric`) + `setFileResult` invalidation (line 161: `metrics: undefined`)
**Apply to:** Any future metric added to `FileEntry.metrics`. The pattern is one-token wide: `<K extends 'ssim' | 'butteraugli' | 'nextMetric'>`.
**Rule:** Metrics writes ALWAYS go through `setFileMetric` (no ad-hoc `updateEntry(id, () => ({ metrics: ... }))` calls anywhere in the codebase).

### Shared 4: CR-02 seqRef stale-drop guard
**Source:** `src/hooks/useMetricsAuto.ts:25-79` (seqRef ratchet + try/catch dual check)
**Apply to:** Same file — one seqRef guards **both** metrics in parallel (Promise.allSettled batch). Do NOT introduce a second seqRef.
**Verified by:** `ssim-metric.spec.ts:138-183` selection-thrash test — same test shape verifies Butteraugli.

### Shared 5: FOUR-slice discipline for parallel Comlink dispatches
**Source:** research §Pitfall 5 (new insight introduced in Phase 17)
**Apply to:** `useMetricsAuto.ts` — `raw.slice(0)` and `enc.slice(0)` per metric per dispatch (four total: rawForSSIM, encForSSIM, rawForBut, encForBut).
**Rule:** Comlink transfers detach the ArrayBuffer; parallel calls sharing a buffer see zero-length on the second call. **DO NOT share buffers across Promise.allSettled branches.**

### Shared 6: Verbatim SSIM naming/testid convention
**Source:** `ReportPanel.tsx` (`ssim-row`, `ssim-score` testids) + `ssim-metric.spec.ts` (locator patterns)
**Apply to:** New Butteraugli DOM nodes — use `butteraugli-row`, `butteraugli-score` (kebab-case, hyphen-separated). Attribute-only assertions on the score (`data-band`), never text matching.

---

## No Analog Found

None. Every Phase 17 file edit has a direct Phase 16 analog **in the same file**. The only genuinely new pattern (visdif WASM bootstrap) has a **Phase 4 precedent** (imagequant `client` mode) that survives commit d3d2d2e verbatim — the same publisher, the same `dist/*.mjs` structure, the same middleware serves both.

---

## Metadata

**Analog search scope:** `src/workers/`, `src/lib/`, `src/stores/`, `src/hooks/`, `src/components/panels/inspector/`, `src/tests/`, `src/types/`, `vite.config.ts`
**Files scanned:** 14 (all direct analogs; no broader search needed — Phase 16 lattice is complete)
**Pattern extraction date:** 2026-07-20
**Novel pattern count:** 1 (`createVisDiff('client')` — but structurally identical to `codec.worker.ts:128`'s `createImagequantQuantizer('client')`)
**Verbatim-extension pattern count:** 13
