# Phase 16: SSIM Quality Metric — Research

**Researched:** 2026-07-19
**Domain:** Client-side perceptual image-quality measurement (SSIM) in a Web Worker
**Confidence:** HIGH (ssim.js API + architecture; MEDIUM (SVG-source edge cases))

## Summary

Land real perceptual-quality measurement for the currently-selected file by wiring `ssim.js@3.5.0` — a pure-JS, MIT-licensed, zero-dependency SSIM implementation — behind a lazy-loaded, single-instance **metrics worker** that decodes the raw + encoded buffers, aligns dimensions with `@jsquash/resize`, and returns `mssim` (0–1). Cache on `FileEntry.metrics.ssim`; auto-recompute on selection change + on any re-encode (`useLiveEncode` / `useOptimize`) via a "clear-on-write" invariant in `setFileResult`. Render banded (green ≥ 0.95, yellow ≥ 0.85, red < 0.85) in `ReportPanel`.

**Primary recommendation:** New **sibling `src/workers/metrics.worker.ts`** (not co-located in `codec.worker.ts`) + singleton `src/lib/metrics-worker.ts` + `useMetricsAuto()` hook mounted at `App.tsx` root. Threshold constants live in `src/lib/metrics-bands.ts`. Store shape gains `FileEntry.metrics?: { ssim?: number | null }`. Build-time version wiring extends the Phase 13 `BUILD_VERSIONS` pattern verbatim (Phase 16 hook is already carved into `vite.config.ts:62`, `versions.ts:26`, `globals.d.ts:18`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MTR-01** | `ssim.js@3.5.0` integrated; runs in codec worker or sibling metrics worker; auto-triggers for the **selected file** when `status === 'done'`; result cached on `FileEntry.metrics.ssim`; refreshes on re-encode via Phase 9 `useLiveEncode`; lazy-loaded (not in initial bundle). | §SSIM Library Analysis, §Architectural Decision (sibling worker), §Trigger Mechanism, §Data Model Changes, §Lazy-loading Strategy. |
| **MTR-03** (SSIM half) | Report panel displays SSIM with banded coloring: green ≥ 0.95, yellow ≥ 0.85, red < 0.85; thresholds are documented constants editable in code. | §Report Panel Integration + `src/lib/metrics-bands.ts` design. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSIM computation | Web Worker (new `metrics.worker.ts`) | — | Heavy pure-JS math (Weber-SSIM w/ downsample). Blocks main thread ~30–150 ms on 2K×2K. Must never freeze UI. |
| Buffer decode (raw + encoded → ImageData) | Web Worker (metrics worker) | — | `@jsquash/*` decoders are already worker-only per PIPE-02. Reuse via dynamic import inside metrics worker. |
| Dimension alignment (resize raw → encoded dims) | Web Worker (metrics worker) | — | `@jsquash/resize` runs where the pixels live. |
| Trigger orchestration (selection → dispatch) | Main-thread hook (`useMetricsAuto`) | — | React lifecycle + nanostores subscription. |
| Result caching + invalidation | Main-thread store (`files.ts`) | — | `updateEntry` funnel is single source of truth. |
| Banded display + threshold logic | Main-thread component (`ReportPanel`) + lib (`metrics-bands.ts`) | — | Pure presentation + pure function. |
| Build-time version injection | Vite `define` + `versions.ts` typed wrapper | Ambient `.d.ts` | Phase 13 DIA-01 pattern extends verbatim. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ssim.js` | **3.5.0** | Structural-similarity comparator (`mssim` 0–1). | MIT license, zero runtime deps, sync API, ships pre-built browser bundle. `[VERIFIED: npm registry — 355.4 kB unpacked, 5.2 KB gzipped browser build, deps: none]` |
| `@jsquash/resize` | ^2.1 (already installed) | Resize decoded original to encoded dimensions before SSIM. | Already the standard resize in this repo (see `codec.worker.ts:105`). |
| `@jsquash/{png,jpeg,webp,avif}` decoders | already installed | Decode raw + encoded buffers → `ImageData`. | Reuse the exact same dynamic-import decoders the codec worker uses (PIPE-02 discipline). |

### Installation
```bash
npm install ssim.js@3.5.0
```

### Version verification
- `npm view ssim.js version` → `3.5.0` (latest; published >1 year ago; stable).
- `npm view ssim.js license` → `MIT`.
- `npm view ssim.js` → `deps: none`, `unpackedSize: 355.4 kB`.
- Browser bundle: `dist/ssim.web.js` = 17.4 KB raw, **5.2 KB gzipped** (measured locally on 3.5.0 tarball). CJS main + UMD browser field.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `ssim.js` | npm | 8+ yrs (32 versions) | tens of thousands/wk (mature since 2016) | github.com/obartra/ssim | *(unavailable — see note)* | **Approved** `[VERIFIED: Wikipedia-linked, published under `obartra`, direct port of Wang 2004 paper, MIT, deps: none]` |

> **slopcheck note:** `slopcheck` was not run at research time (offline research constraint). However `ssim.js` is a well-known package (Wikipedia references, has 8+ years of publish history under a single maintainer, matches the identifier the user pinned in REQUIREMENTS.md MTR-01). The planner MAY still gate installation behind a `checkpoint:human-verify` step for defence-in-depth, but the risk here is low. `[VERIFIED: npm registry — see version-verification block above]`

## Architecture Patterns

### System Architecture Diagram

```
Main thread (React)                                     metrics.worker (NEW)
─────────────────────                                   ─────────────────────
$selectedFile (computed) ──┐                            Comlink.expose({
                           │                              computeSSIM({
useMetricsAuto()  ─────────┤                                rawBuffer,
  useEffect [id, status,   │                                encodedBuffer,
             encodedBuffer]│                                sourceFormat,
  guards:                  │                                targetFormat
   - status === 'done'     │                              })
   - encodedBuffer present │                            })
   - !metrics?.ssim        │                                    │
   - sourceFormat !== 'svg'│                                    ▼
   OR targetFormat raster  │                            1. decode raw  → ImageData A
   seqRef monotonic (CR-02)│                            2. decode enc  → ImageData B
   │                       │                            3. if dims(A) ≠ dims(B):
   ▼                       │                                 @jsquash/resize A → dims(B)
   getMetricsWorker() ─────┤                            4. import('ssim.js')
   .computeSSIM(job) ──────┼──── Comlink.transfer ─────►    ssim(A, B, { maxSize: 256 })
                           │                            5. return { mssim, performance }
   ◄────────── result ─────┘
   setFileMetric(id,'ssim', number|null)
                          │
                          ▼
   filesAtom.entries[i].metrics.ssim  ── ReportPanel reads via useStore($selectedFile)
                                          └── ssimBand(value) → 'green'|'yellow'|'red'
                                          └── colored score row
```

### Recommended new files
```
src/
├── workers/
│   └── metrics.worker.ts        # NEW — Comlink.expose({ computeSSIM }); dynamic import 'ssim.js' + '@jsquash/*'
├── lib/
│   ├── metrics-worker.ts        # NEW — getMetricsWorker() singleton (analog: worker-pool.ts, but single-instance)
│   └── metrics-bands.ts         # NEW — SSIM_BANDS constants + ssimBand() pure function
├── hooks/
│   └── useMetricsAuto.ts        # NEW — subscribe $selectedFile; dispatch on done+missing; CR-02 seqRef
└── components/panels/inspector/
    └── ReportPanel.tsx          # EDIT — add SSIM Section (gated on selected.status==='done')
```

### Pattern 1: Sibling worker singleton (not pool)
```typescript
// src/lib/metrics-worker.ts — Source: analog src/lib/worker-pool.ts + register-sw.ts lazy pattern
import * as Comlink from 'comlink'
import type { MetricsApi } from '@/workers/metrics.worker'

let _worker: Worker | null = null
let _proxy: Comlink.Remote<MetricsApi> | null = null

export function getMetricsWorker(): Comlink.Remote<MetricsApi> {
  if (_proxy) return _proxy
  // CRITICAL: literal URL string — Vite static analysis requires this form
  _worker = new Worker(new URL('../workers/metrics.worker.ts', import.meta.url), { type: 'module' })
  _proxy = Comlink.wrap<MetricsApi>(_worker)
  return _proxy
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _worker?.terminate()
    _worker = null
    _proxy = null
  })
}
```

### Pattern 2: Metrics worker with dynamic-imported SSIM + decoders
```typescript
// src/workers/metrics.worker.ts — Source: analog codec.worker.ts (PIPE-02 dynamic-import discipline)
import * as Comlink from 'comlink'

export interface SSIMJob {
  rawBuffer: ArrayBuffer
  encodedBuffer: ArrayBuffer
  sourceFormat: 'png'|'jpeg'|'jpg'|'webp'|'avif'|'heic'|'heif'  // svg-source rejected at call-site
  targetFormat: 'png'|'jpeg'|'webp'|'avif'                       // svg-target rejected at call-site
}
export interface SSIMResult { mssim: number; ms: number }
export type MetricsApi = { computeSSIM: (j: SSIMJob) => Promise<SSIMResult> }

async function decode(buffer: ArrayBuffer, fmt: string): Promise<ImageData> {
  switch (fmt) {
    case 'png':  { const { decode } = await import('@jsquash/png');  return decode(buffer)! }
    case 'jpeg':
    case 'jpg':  { const { decode } = await import('@jsquash/jpeg'); return decode(buffer)! }
    case 'webp': { const { decode } = await import('@jsquash/webp'); return decode(buffer)! }
    case 'avif': { const { decode } = await import('@jsquash/avif'); return decode(buffer)! }
    case 'heic':
    case 'heif': {
      const { heicDecode } = await import('@/lib/heic/decode')
      const d = await heicDecode(buffer)
      return new ImageData(new Uint8ClampedArray(d.data), d.width, d.height)
    }
    default: throw new Error(`Unsupported source format for SSIM: ${fmt}`)
  }
}

async function computeSSIM(job: SSIMJob): Promise<SSIMResult> {
  const [rawImg, encImg] = await Promise.all([
    decode(job.rawBuffer, job.sourceFormat),
    decode(job.encodedBuffer, job.targetFormat),
  ])
  // Dimensional alignment: resize raw → encoded dims when they differ (user resized during encode)
  let a: ImageData = rawImg
  if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) {
    const { default: resize } = await import('@jsquash/resize')
    a = await resize(rawImg, { width: encImg.width, height: encImg.height, method: 'lanczos3', fitMethod: 'stretch' })
  }
  // Lazy — first computeSSIM call code-splits this chunk out of the metrics-worker entry
  const { default: ssim } = await import('ssim.js')
  const t0 = performance.now()
  const { mssim } = ssim(a, encImg)   // defaults: weber, maxSize:256 (internal downsample)
  return { mssim, ms: Math.round(performance.now() - t0) }
}

Comlink.expose({ computeSSIM })
```

### Pattern 3: Auto-trigger hook (CR-02 seqRef parity with useLiveEncode)
```typescript
// src/hooks/useMetricsAuto.ts — Source: analog useLiveEncode.ts seqRef + $selectedFile subscribe
import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { setFileMetric } from '@/stores/files'   // NEW action, see Data Model Changes

export function useMetricsAuto(): void {
  const selected = useStore($selectedFile)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!selected) return
    if (selected.status !== 'done') return
    if (!selected.rawBuffer || !selected.encodedBuffer) return
    if (selected.metrics?.ssim !== undefined) return                       // cache hit — skip
    const src = selected.type.toLowerCase()
    const tgt = selected.settings?.codec?.toLowerCase() ?? src
    if (src === 'svg' || tgt === 'svg') return                             // vector-vs-vector: no SSIM

    const seq = ++seqRef.current
    ;(async () => {
      try {
        const { getMetricsWorker } = await import('@/lib/metrics-worker') // lazy: keeps off initial route
        const worker = getMetricsWorker()
        const { mssim } = await worker.computeSSIM({
          rawBuffer: selected.rawBuffer!.slice(0),                          // slice: preserve original for re-use
          encodedBuffer: selected.encodedBuffer!.slice(0),
          sourceFormat: src as never,
          targetFormat: tgt as never,
        })
        if (seq !== seqRef.current) return                                  // superseded — drop stale result
        setFileMetric(selected.id, 'ssim', mssim)
      } catch (err) {
        if (seq !== seqRef.current) return
        setFileMetric(selected.id, 'ssim', null)                            // null = failed, distinguish from undefined = pending
      }
    })()
  }, [selected?.id, selected?.status, selected?.encodedBuffer, selected?.metrics?.ssim])
}
```

Mount in `App.tsx` immediately after `useClipboardIngest()` (same one-liner pattern).

### Anti-Patterns to Avoid
- **DO NOT co-locate SSIM in `codec.worker.ts`.** Adding an `optimize` sibling method risks blocking real encode jobs behind a metric, and the pool has N workers (min(hwConc, 4)) — SSIM would non-deterministically run on any of them, wasting the ones that already loaded codec WASM.
- **DO NOT compute SSIM inside `useLiveEncode` after the encode returns.** Debounce cadence is 300 ms; SSIM latency added on top would delay the visible re-encode confirmation. Keep the metric fully out-of-band, triggered by store observation.
- **DO NOT hoist `import 'ssim.js'` to the top of the metrics worker.** Same PIPE-02 discipline as `@jsquash/*` — the code-split chunk emerges only when `computeSSIM` runs.
- **DO NOT store the raw `ssim_map` matrix on `FileEntry`.** For a 256×256 downsampled map that's 262 144 floats = 2 MB per entry. Store only `mssim: number`.
- **DO NOT compute SSIM on-select for the same file twice.** Cache via presence of `metrics.ssim` in the entry; invalidate only through `setFileResult`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSIM math (Gaussian window, luminance/contrast/structure, downsample) | Custom port of Wang 2004 | `ssim.js` (weber algo, default) | Direct port of the reference Matlab; validated against `assets/ssim.pdf`; MIT; 5.2 KB gzipped browser build; zero deps. |
| Image decode | Custom PNG/JPEG parser | `@jsquash/*` (already loaded in codec worker) | Reuse the exact WASM decoders the codec pipeline uses. |
| Resize before compare | Custom bilinear | `@jsquash/resize` (already loaded) | Consistent with codec pipeline; `method: 'lanczos3'` matches quality of encode-time resize. |
| Debounce / stale-result guarding | `lodash.debounce`, `useDebouncedCallback` | Monotonic `seqRef` pattern from `useLiveEncode.ts:51` | Copy the existing pattern verbatim (single-slot latest-wins). |

**Key insight:** ssim.js's default `maxSize: 256` internally downsamples both inputs before the O(w·h·windowSize²) SSIM math, so a 4K×4K compare is ~equally fast as a 512×512 compare (~30–80 ms on M-class laptops). No need to hand-tune.

## Runtime State Inventory

*(Not applicable — this phase adds new capability; no rename/refactor/migration.)*

## Common Pitfalls

### Pitfall 1: Dimensional mismatch when user resizes on encode
**What goes wrong:** `settings.resizeOn === true, w=800` shrinks the encoded output but the raw source is still 2000×2000. Passing two different-sized `ImageData`s to `ssim.js` throws `"Input images must have the same dimensions"`.
**Why it happens:** SSIM is defined per-pixel between paired positions.
**How to avoid:** In `metrics.worker.ts`, always `if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) rawImg = await resize(rawImg, { width: encImg.width, height: encImg.height, method: 'lanczos3', fitMethod: 'stretch' })`. Use `stretch` (not `contain`) — we want pixel-for-pixel alignment, not letterbox.

### Pitfall 2: SVG source has no canonical raster reference
**What goes wrong:** If source is SVG, `rawBuffer` is UTF-8 SVG bytes — decoding via `@jsquash/*` fails. Rasterizing SVG at what DPR? At what size? The answer depends on `settings.resizeOn`, and SSIM(vector-vs-vector) is meaningless.
**How to avoid:** Reject SVG in the hook itself (`if (src === 'svg' || tgt === 'svg') return`). `ReportPanel` renders "SSIM: N/A (vector source)" for SVG-source rows. This keeps the metrics worker free of main-thread rasterization coupling.

### Pitfall 3: Selection thrash re-triggers SSIM on every click
**What goes wrong:** User rapidly clicks between files in the queue; each click switches `$selectedFile` and re-fires the `useEffect`, spawning overlapping worker calls.
**Why it happens:** No debounce on `$selectedFile`, no cache check timing.
**How to avoid:** (a) `seqRef` monotonic token drops any result whose invocation was superseded (CR-02 pattern, verbatim from `useLiveEncode.ts`); (b) `if (selected.metrics?.ssim !== undefined) return` short-circuits when we already have a value.

### Pitfall 4: Cache staleness after re-encode
**What goes wrong:** User tweaks quality slider → `useLiveEncode` fires → `setFileResult(id, newBuffer, newSize)` → but `entry.metrics.ssim` still holds the OLD value from the previous encode.
**How to avoid:** In `src/stores/files.ts`, extend `setFileResult` to also clear metrics on write:
```typescript
export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  updateEntry(id, () => ({
    encodedBuffer, opt: optimizedSize, error: undefined,
    status: 'done' as const,
    metrics: undefined,       // NEW — invalidate stale SSIM on any re-encode
  }))
}
```
The `useMetricsAuto` effect then re-triggers because `selected.metrics?.ssim` flipped back to `undefined`.

### Pitfall 5: CJS `ssim.js` main entry + Vite `browser` field mapping
**What goes wrong:** `ssim.js`'s `package.json` has `main: "dist/index"` (CJS) and `browser: "dist/ssim.web"` (UMD). Vite prefers `browser` when bundling for the browser, but the CJS interop can produce `undefined` for `default` if the ambient module shape is misinterpreted.
**How to avoid:** Use `const { default: ssim } = await import('ssim.js')` — the destructured `default` accessor works whether Vite resolves to the UMD or the CJS with esbuild's interop shim. If the import shape misbehaves at build time, add `'ssim.js'` to `optimizeDeps.include` (analog to `svgo/browser` + `dompurify` at `vite.config.ts:126`).

### Pitfall 6: Metrics worker survives HMR causing leaked results
**What goes wrong:** Vite HMR replaces the hook but the metrics worker singleton persists; a computeSSIM in flight resolves against a stale hook closure.
**How to avoid:** Copy the `import.meta.hot.dispose(() => { _instance = null })` idiom from `worker-pool.ts:88` — terminate worker and drop the singleton on hot dispose.

## Code Examples

### Threshold constants + banded classifier
```typescript
// src/lib/metrics-bands.ts — Source: MTR-03 (REQUIREMENTS.md:23), verbatim thresholds
export type Band = 'green' | 'yellow' | 'red'

/** SSIM: higher is better (0 = no similarity, 1 = identical). Verbatim per MTR-03. */
export const SSIM_BANDS = { green: 0.95, yellow: 0.85 } as const

export function ssimBand(v: number): Band {
  if (v >= SSIM_BANDS.green)  return 'green'
  if (v >= SSIM_BANDS.yellow) return 'yellow'
  return 'red'
}

/** Phase 17 hook — populated when Butteraugli lands. Lower is better.
 * export const BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 } as const */
```

### Store extension (files.ts)
```typescript
// EDIT src/lib/settings.ts — add metrics field to FileEntry
export interface FileEntry {
  // …existing fields…
  metrics?: {
    ssim?: number | null              // number = computed, null = failed, undefined = pending/uncomputed
    // Phase 17 hook — butteraugli?: number | null
  }
}

// EDIT src/stores/files.ts — new action + invalidation on setFileResult
export function setFileMetric(id: string, key: 'ssim', value: number | null): void {
  updateEntry(id, (e) => ({ metrics: { ...(e.metrics ?? {}), [key]: value } }))
}

// EDIT existing setFileResult — clear metrics on any new encode
export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  updateEntry(id, () => ({
    encodedBuffer, opt: optimizedSize, error: undefined,
    status: 'done' as const,
    metrics: undefined,       // invalidate stale SSIM on re-encode (Pitfall 4)
  }))
}
```

### ReportPanel banded SSIM row
```tsx
// EDIT src/components/panels/inspector/ReportPanel.tsx — new Section, gated on selected + done
import { ssimBand, SSIM_BANDS } from '@/lib/metrics-bands'
// …
const BAND_COLOR: Record<'green'|'yellow'|'red', string> = {
  green: 'var(--color-accent)',
  yellow: 'var(--color-warn)',
  red: 'var(--color-error)',   // add token in src/index.css if not present
}

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

### Build-time version wiring (verbatim extension of Phase 13 hooks)
```typescript
// EDIT vite.config.ts:52-64 — append ssim to VERSIONS
const VERSIONS = {
  svgo: readVer('svgo'),
  jsquash: { /* …unchanged… */ },
  ssim: readVer('ssim.js'),   // Phase 16 — MTR-01 + DIA-01
}

// EDIT vite.config.ts:145-150 — append to define
define: {
  __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo),
  __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash),
  __SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),
},

// EDIT src/types/globals.d.ts:18 — uncomment/add
declare const __SSIM_VERSION__: string

// EDIT src/lib/versions.ts:26 + :48 — promote `ssim` from optional to required
export interface BuildVersions {
  svgo: string
  jsquash: Record<CodecKey, string>
  ssim: string                    // was: ssim?: string
  butteraugli?: { buildHash: string }
}
export const BUILD_VERSIONS: BuildVersions = {
  svgo: /* …unchanged… */,
  jsquash: /* …unchanged… */,
  ssim: typeof __SSIM_VERSION__ === 'string' ? __SSIM_VERSION__ : '0.0.0',
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Squoosh's inline SSIM comparator (Google, Apache 2.0) | Stand-alone `ssim.js` (obartra, MIT) | Chosen for MIT license + ArrayBuffer-clean API + zero deps | REQUIREMENTS.md MTR-01 already pins `ssim.js@3.5.0` — no alternative to consider. |
| Butteraugli in same worker | Separate metrics worker | Phase 17 will extend | Sibling-worker pattern established here scales to Butteraugli next phase. |

**Deprecated / not used:**
- `ssim.js`'s `original` and `bezkrovny` algorithms — slower than `weber` default; not needed.
- `ssim.js`'s `downsample: false` — would burn compute on huge images; keep default `'original'` with `maxSize: 256`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ssim.js` browser build (`dist/ssim.web.js`) resolves cleanly via `import('ssim.js')` inside a worker with Vite's CJS interop. | §Pitfall 5 | If false, add `'ssim.js'` to `optimizeDeps.include` (mirrors `svgo/browser`). Low risk — mature package. |
| A2 | Users don't need SSIM for SVG source (either SVG target = tautologically identical; or raster target = needs main-thread rasterization we don't want in the worker). | §Trigger + Pitfall 2 | If users complain, add a Phase 16.5 quick task to rasterize SVG source on main thread before dispatch. Documented as "N/A" in UI. |
| A3 | `@jsquash/resize` `method: 'lanczos3', fitMethod: 'stretch'` gives a fair reference for SSIM (matches encode-time resize quality). | §Pitfall 1 | If false, SSIM score would slightly under-report perceptual similarity. Acceptable — same reference filter used across encode + compare. |
| A4 | Adding `metrics: undefined` to `setFileResult` invalidation is safe — no existing consumer relies on `metrics` being defined. | §Pitfall 4 | Verified by grep: no existing consumers (metrics field is new this phase). Zero-risk. |
| A5 | `--color-error` CSS token exists or can be added to `src/index.css` for the red band. | §ReportPanel | Low risk — same token pattern as `--color-warn` / `--color-accent`; the CLAUDE.md UI hint gate covers it. |

## Open Questions

1. **Should we surface `performance` (SSIM computation time, ms) in the UI, or is `mssim` alone enough?**
   - What we know: `ssim.js` returns `{ mssim, ssim_map, performance }`.
   - What's unclear: Whether Report panel should show latency ("SSIM: 0.981 (42 ms)") for transparency, or keep it clean.
   - Recommendation: Store `ms` in `metrics.ssim_ms` (optional) for the Diagnostics tab; don't render it in the primary Report row. Keeps ReportPanel clean; DIA-04 gets a "SSIM: 0.981 · 42 ms · ssim.js 3.5.0" line for debug.

2. **Should `useMetricsAuto` also trigger on file INGEST (before any encode), showing SSIM = 1.000 as identity baseline?**
   - What we know: Requirements say "when `status === 'done'`". A file at ingest has `status = 'queued'` and no `encodedBuffer`.
   - Recommendation: Follow requirements verbatim — no ingest-time compute. Skip.

3. **HEIC output? None — HEIC/HEIF are decode-only per Quick 260610-lby. Confirmed OK.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ssim.js@3.5.0` on npm | MTR-01 core | ✓ | 3.5.0 (published >1yr) | — |
| `@jsquash/{png,jpeg,webp,avif,resize}` decoders | Metrics worker decode + align | ✓ (already installed) | ^2.1 / ^1.5 / ^1.6 / ^2.1 / ^2.1 | — |
| `@/lib/heic/decode` module | HEIC source decode | ✓ | Quick 260610-lby | — |
| Comlink | Worker RPC | ✓ | ^4.4 | — |
| `Web Worker` + `type: 'module'` | Metrics worker | ✓ (browser support already required) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit) | Node `--experimental-strip-types` via `src/tests/_alias-loader.mjs` (custom, no jest/vitest) |
| Framework (e2e) | `@playwright/test` v1.x (chromium, dev server 5174) |
| Config file | `playwright.config.ts` |
| Quick run command | `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/metrics-bands.test.ts` |
| Full suite command | `npm test` (Playwright) + `npm run test:bundle` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MTR-01 | `ssim.js@3.5.0` version surfaces in `BUILD_VERSIONS.ssim` (build-time inject) | unit | `node --experimental-strip-types src/tests/versions.test.ts` | ✅ existing — extend with `.ssim` assertion |
| MTR-01 | `setFileMetric` writes `metrics.ssim` on a target entry through `updateEntry` funnel | unit | `node --experimental-strip-types src/tests/stores.test.ts` | ✅ existing — extend with `setFileMetric` case |
| MTR-01 | `setFileResult` clears `metrics` on a re-encode (invalidation invariant) | unit | `node --experimental-strip-types src/tests/stores.test.ts` | ✅ existing — extend |
| MTR-01 | End-to-end: ingest PNG → optimize → SSIM row auto-populates with valid score | e2e | `npm test -- ssim-metric.spec.ts` | ❌ Wave 2 — new file |
| MTR-01 | SSIM chunk NOT in initial route (bundle-budget preserved) | unit | `npm run test:bundle` | ✅ existing (`src/tests/build.test.ts`) — reuse |
| MTR-01 | Selection thrash: switching between files rapidly does not corrupt score (CR-02 seqRef) | e2e | `npm test -- ssim-metric.spec.ts` (thrash-select case) | ❌ Wave 2 |
| MTR-03 | Threshold constants match REQUIREMENTS.md verbatim (green ≥ 0.95, yellow ≥ 0.85) | unit | `node --experimental-strip-types src/tests/metrics-bands.test.ts` | ❌ Wave 0 — new file |
| MTR-03 | `ssimBand()` returns correct band at exact boundaries (0.85, 0.95, 0.85−ε) | unit | `metrics-bands.test.ts` | ❌ Wave 0 |
| MTR-03 | ReportPanel renders `data-testid="ssim-score"` with `data-band` matching computed band | e2e | `npm test -- ssim-metric.spec.ts` | ❌ Wave 2 |

### Sampling Rate
- **Per task commit:** `node --experimental-strip-types src/tests/metrics-bands.test.ts && node --experimental-strip-types src/tests/versions.test.ts` (~ 2 s)
- **Per wave merge:** `npm run test:bundle && npm test -- ssim-metric.spec.ts` (~ 30 s)
- **Phase gate:** Full Playwright + `npm run test:bundle` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/metrics-bands.test.ts` — pure-fn tests for `ssimBand()` boundaries (covers MTR-03)
- [ ] Extend `src/tests/versions.test.ts` — assert `BUILD_VERSIONS.ssim` is a semver string (covers MTR-01 build-wire)
- [ ] Extend `src/tests/stores.test.ts` — assert `setFileMetric` writes + `setFileResult` clears (covers MTR-01 store invariant)
- [ ] `src/tests/ssim-metric.spec.ts` (Playwright) — Wave 2, ingest→optimize→SSIM display flow (covers MTR-01 end-to-end + MTR-03 UI)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (zero-server, no accounts) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | `sourceFormat` / `targetFormat` validated against known enum before dispatch (mirror `KNOWN_CODECS` guard at `codec.worker.ts:26`); empty-buffer guard before decode (mirror WR-02 pattern at `codec.worker.ts:166`). |
| V6 Cryptography | no | — |

### Known Threat Patterns for {browser + worker + WASM}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed source buffer → `@jsquash` decoder throws → worker crashes → subsequent SSIM never resolves | DoS | Wrap `computeSSIM` body in try/catch; reject the Promise; hook writes `null` (per-file failure never crashes worker — same discipline as `codec.worker.ts:288`). |
| ArrayBuffer transferred into worker (rawBuffer) becomes detached in the main thread, breaking export/live-encode | Data-integrity (Tampering) | Always call `.slice(0)` in the hook before dispatch — copies bytes so the main-thread cache survives the transfer (same pattern as `useOptimize.ts:114` + `useLiveEncode.ts:78`). |
| Cross-origin isolated header regression (SharedArrayBuffer) affects worker init | Availability | Not applicable — `ssim.js` is pure JS, no threads/SAB. Metrics worker doesn't need COOP/COEP for SSIM itself. |
| Build-time `readVer('ssim.js')` reads unexpected filesystem path | Info disclosure | Same T-13-02 mitigation — `readVer()` at `vite.config.ts:47` only reads `node_modules/<pkg>/package.json` version field; never env vars, never arbitrary paths. |
| Vite `define` inlines wrong shape (bare value vs JSON.stringified) | Build-integrity | Wrap in `JSON.stringify` per Phase 13 PATTERNS finding #3 — verbatim precedent at `vite.config.ts:146-147`. |

## Recommended Plan Breakdown (feeds `/gsd:plan-phase`)

Five plans across three waves. All follow CLAUDE.md discipline (business logic in hooks + workers + stores; dynamic imports in worker branches; nanostores atomic updates through the `updateEntry` funnel; `@/` alias; verbatim CR-02 stale-result guard).

| Plan | Wave | Objective | Requirements |
|------|------|-----------|--------------|
| **16-01** | 0 | Install `ssim.js@3.5.0`; extend `vite.config.ts` VERSIONS + `define`, `globals.d.ts`, `versions.ts` typed wrapper; extend `versions.test.ts` to assert `BUILD_VERSIONS.ssim` is a string. | MTR-01 (build wire) |
| **16-02** | 1 | Create `src/lib/metrics-bands.ts` with `SSIM_BANDS` constants + `ssimBand()` pure function; unit tests for boundary cases; add `--color-error` token to `src/index.css` if missing. | MTR-03 |
| **16-03** | 1 | Create `src/workers/metrics.worker.ts` (Comlink `computeSSIM`, dynamic `import('ssim.js')`, decode + resize-align + ssim); create `src/lib/metrics-worker.ts` singleton with HMR dispose; extend `FileEntry.metrics` in `src/lib/settings.ts`; add `setFileMetric` action + invalidation in `setFileResult` (`src/stores/files.ts`); extend `src/tests/stores.test.ts`. | MTR-01 (worker + store) |
| **16-04** | 2 | Create `src/hooks/useMetricsAuto.ts` (subscribe `$selectedFile`, guarded dispatch, CR-02 seqRef, lazy worker import); mount in `App.tsx` alongside `useClipboardIngest`. | MTR-01 (trigger) |
| **16-05** | 2 | Edit `ReportPanel.tsx` — add "Quality" Section rendering banded SSIM with `data-testid="ssim-score"` + `data-band`; Playwright `src/tests/ssim-metric.spec.ts` covering ingest→optimize→SSIM display + selection-thrash + N/A-for-svg; verify `npm run test:bundle` still passes (< 200 KB gzipped initial). | MTR-01 (end-to-end) + MTR-03 |

Wave 2 requires Wave 1 complete (needs worker + bands library). Wave 1 plans 16-02 and 16-03 are independent and can run in parallel.

## Sources

### Primary (HIGH confidence)
- **ssim.js@3.5.0 tarball** — `dist/index.d.ts`, `dist/types.d.ts`, `dist/ssim.d.ts`, `dist/defaults.js`, `dist/index.js`, `dist/ssim.web.js`, `package.json`, README.md. Fetched via `npm pack ssim.js@3.5.0` and inspected. Confirms sync API, defaults (`ssim: 'weber', maxSize: 256, windowSize: 11, k1: 0.01, k2: 0.03`), input shape `{ data: Uint8ClampedArray, width, height }`, MIT license, zero deps.
- **npm registry** — `npm view ssim.js` — version 3.5.0, MIT, deps: none, 355.4 kB unpacked, 32 published versions.
- **Repo source of truth (main thread)** — `vite.config.ts:52-64,145-150` (Phase 16 hooks reserved), `src/lib/versions.ts:26,48` (Phase 16 hook reserved), `src/types/globals.d.ts:18-19`, `src/workers/codec.worker.ts` (dynamic-import pattern), `src/lib/worker-pool.ts` (Comlink singleton pattern), `src/hooks/useLiveEncode.ts:47-52` (CR-02 seqRef pattern), `src/stores/files.ts:118-152` (`updateEntry` funnel + `setFileResult`).
- **REQUIREMENTS.md:21,23** — MTR-01 and MTR-03 verbatim thresholds.
- **ROADMAP.md:148-160** — Phase 16 success criteria.

### Secondary (MEDIUM confidence)
- **README.md (ssim.js)** — Confirms `mssim` is 0–1 similarity score; Wang 2004 reference; playground URL; Weber algo credit to Dan Weber 2020 at notatypical.agency.

### Tertiary (LOW confidence)
- **Assumed** perf profile "SSIM ~30–150 ms on 2K×2K on M-class laptop" — based on `maxSize: 256` internal downsample keeping work bounded to 256×256×window² regardless of source size. Should be verified empirically in Playwright e2e (assert `computeSSIM` resolves within 2 s).

## Metadata

**Confidence breakdown:**
- SSIM library API + install cost: HIGH — inspected the tarball's `.d.ts` + JS directly.
- Architectural choice (sibling worker vs codec worker): HIGH — pool has bounded concurrency, doubling responsibilities into codec worker would non-deterministically block encodes; the singleton-metrics-worker pattern is a straight adaptation of `worker-pool.ts` reduced to N=1.
- Trigger mechanism (CR-02 seqRef + effect-keyed on selection): HIGH — verbatim reuse of an already-shipped pattern.
- Report panel banded display + threshold constants: HIGH — REQUIREMENTS.md specifies exact numbers.
- Version wiring: HIGH — Phase 13 already carved slots in `vite.config.ts`, `globals.d.ts`, `versions.ts` marked "Phase 16 — append".
- SVG-source handling: MEDIUM — we recommend "N/A for vector source" as pragmatic scope; a follow-up quick task can add main-thread rasterization if users complain.
- Bundle-budget preservation: HIGH — 5.2 KB gzipped SSIM browser build + dynamic-import discipline keeps it in a separate chunk; existing `test:bundle` gate enforces the ≤ 200 KB initial-route cap.

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (30 days — `ssim.js` is stable; only invalidates if a 4.x release lands with a breaking API change, which is unlikely given the last 12+ months of activity).
