# Phase 17: Butteraugli Quality Metric — Research

**Researched:** 2026-07-20
**Domain:** Client-side perceptual image-quality measurement (Butteraugli) in a Web Worker
**Confidence:** HIGH (package availability + API + architecture; MEDIUM (buildHash strategy — two viable options))

## Summary

A pre-built Butteraugli npm package **exists and is a perfect fit** for this codebase: `@squoosh-kit/visdif@0.2.4` — same publisher (`bnowak008`) as the `@squoosh-kit/imagequant` we already ship, same 0.2.4 version cohort, same `client` bridge mode we already use for imagequant (commit d3d2d2e), and the wasm binary is taken **verbatim** from Squoosh's official builds. `[VERIFIED: npm registry + tarball inspection]` That collapses Phase 17 from "hand-build Emscripten + toolchain script + CI reproducibility" (Option A per ROADMAP) into "install one package, add a second dynamic-import branch to `metrics.worker.ts`, extend `FileEntry.metrics`, add a second banded `<Row>` to ReportPanel" — the exact shape of the Phase 16 SSIM landing.

**Primary recommendation:** **Consume `@squoosh-kit/visdif@0.2.4` via `createVisDiff('client')`** — Option B. Extend the existing `metrics.worker.ts` with a second Comlink method `computeButteraugli(job)`; extend the same singleton wrapper; extend `useMetricsAuto` to dispatch BOTH SSIM + Butteraugli in parallel with a shared seqRef guard; extend `FileEntry.metrics` with a `butteraugli?: number | null` field; add a second banded row + `BUTTERAUGLI_BANDS` constants alongside SSIM in `ReportPanel` / `metrics-bands.ts`. Deviate explicitly from ROADMAP's "hand-built + `public/squoosh-kit/butteraugli/…`" wording — the wasm ships inside `node_modules/@squoosh-kit/visdif/dist/wasm/visdif/visdif.wasm` and is served by the **existing** `serveSquooshKitNodeModuleWasm()` middleware in `vite.config.ts:17`; no `public/` copy is needed. `versionsAtom.butteraugli.buildHash` derives from `readVer('@squoosh-kit/visdif')` (mirrors `readVer('ssim.js')` in Phase 16) — optionally augmented with a build-time sha256-prefix of the wasm file for stronger provenance.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MTR-02** | Butteraugli integrated alongside SSIM; same trigger rules (selected file, post-`done`, refresh on re-encode); cached on `FileEntry.metrics.butteraugli`; lazy-loaded separate chunk. | §Package Discovery, §Build-vs-Vendor-vs-NPM Decision, §Architectural Decision (extend metrics.worker), §Trigger + Caching (extend useMetricsAuto), §Lazy-loading Strategy. |
| **MTR-03** (Butteraugli half) | Report panel shows Butteraugli with banded coloring: green < 1.5, yellow < 3.0, red ≥ 3.0 (lower is better); thresholds documented constants. | §Report Panel Integration + `BUTTERAUGLI_BANDS` design in `metrics-bands.ts`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Butteraugli computation | Web Worker (extend `metrics.worker.ts`) | — | CPU-intensive Emscripten wasm. Must not block the UI. Reuse the existing metrics worker singleton — no need for a second sibling worker (Phase 16 pattern is single-in-flight already; SSIM + Butteraugli can share the same wasm-bootstrap latency and buffer transfer). |
| Buffer decode (raw + encoded → ImageData) | Web Worker (metrics worker) | — | Already implemented in `metrics.worker.ts::decode()` (Phase 16 Plan 03) — reuse verbatim; `computeButteraugli` calls the same helper. |
| Dimensional alignment | Web Worker (metrics worker) | — | Same `@jsquash/resize` block that SSIM uses. Butteraugli also requires identical dims (README: "Both images must have identical dimensions"). |
| Trigger orchestration | Main-thread hook (`useMetricsAuto`) | — | Extend the existing hook to dispatch BOTH metrics; single seqRef gates both results. |
| Result caching + invalidation | Main-thread store (`files.ts`) | — | Extend `setFileMetric(id, key, value)` — already generic; just add `'butteraugli'` to the key union. Existing `setFileResult` invalidation zeroes `metrics: undefined` so a re-encode drops both. |
| Banded display | Main-thread component + lib | — | Add `BUTTERAUGLI_BANDS` + `butteraugliBand()` in `metrics-bands.ts`; second `<div data-testid="butteraugli-row">` in the same "Quality" `<Section>` in ReportPanel. |
| Build-time version + buildHash | Vite `define` + `versions.ts` | Ambient `.d.ts` | Extend the Phase 13/16 hooks verbatim — the slot is **already reserved** in `vite.config.ts:63,149`, `versions.ts:27-28`, `globals.d.ts:19-20`. |

## Package Discovery

Live npm queries (2026-07-20). Not one of the following is a hallucination — each row was retrieved by `npm view <name>` against the live registry.

| Candidate | Status | Notes |
|-----------|--------|-------|
| **`@squoosh-kit/visdif@0.2.4`** | ✅ **RECOMMENDED** — MIT AND Apache-2.0, deps: `@squoosh-kit/runtime@0.2.4` only, 557.5 kB unpacked, wasm 57 KB raw (~20–30 KB gzipped per README), JS ~4–6 KB gzipped, published 2026-03-30 by `bnowak008`. Homepage: http://squoosh-kit.dev · Repo: https://github.com/bnowak008/squoosh-kit `[VERIFIED: npm view + tarball inspected: 28 files, .d.ts + wasm hashes below]` | Same publisher + version cohort as the `@squoosh-kit/imagequant@0.2.4` we already use in `codec.worker.ts:128`. README: "The WebAssembly (`.wasm`) binary is taken directly from the official Squoosh repository builds." — i.e. the exact Squoosh Butteraugli wasm, unmodified, wrapped in a thin JS bridge with typed API. Same `client`/`worker` bridge mode toggle we already use for imagequant. |
| `butteraugli@0.0.2` | ✗ Rejected | Solo maintainer `dominikhlbg`, 0.0.2 with 3 versions, last publish >1 year ago, pure-JS (not wasm) port of Butteraugli by `butteraugli.js`. Unmaintained + non-wasm = slower + drift risk vs. the canonical Google implementation. `[VERIFIED: npm view butteraugli — https://github.com/dominikhlbg/butteraugli.js]` |
| `butteraugli-wasm` | ✗ Does not exist | `npm view butteraugli-wasm` → 404. `[VERIFIED: npm registry — no such package]` |
| `@jsquash/butteraugli` | ✗ Does not exist | `npm view @jsquash/butteraugli` → 404. jSquash publishes only codec encoders/decoders + resize; no metric packages. `[VERIFIED: npm registry — no such package]` |
| `@squoosh-kit/butteraugli` | ✗ Does not exist under that exact name | `npm view @squoosh-kit/butteraugli` → 404. `[VERIFIED]` The Squoosh-Kit publisher's Butteraugli package is named **visdif**, matching Squoosh's own directory name (`codecs/visdif/` in the upstream Squoosh repo). |
| Emscripten build from `libjxl` source | Option A (fallback) | `git@github.com:libjxl/libjxl` + emsdk — canonical, but the toolchain effort dwarfs the wiring effort now that `@squoosh-kit/visdif` is available. `[CITED: https://github.com/libjxl/libjxl]` `[ASSUMED — no build attempted; only kept documented as a fallback if Option B blocks unexpectedly]` |

### `@squoosh-kit/visdif` API (verified from inspected `.d.ts`)

```typescript
import type { ImageInput } from '@squoosh-kit/runtime'   // { data: Uint8Array | Uint8ClampedArray; width: number; height: number }

// Convenience one-shot (uses a global singleton worker):
export function compare(image1: ImageInput, image2: ImageInput, signal?: AbortSignal): Promise<number>

// Reusable factory — REQUIRED for our design because we're inside a Web Worker already
// and the 'worker' mode would spawn a nested Worker (same as imagequant's default) which
// fails under Vite's SPA fallback for the wasm URL. Use 'client' mode — runs in-thread,
// wasm loads via the served node_modules path handled by serveSquooshKitNodeModuleWasm().
export function createVisDiff(mode?: 'worker' | 'client', options?: { assetPath?: string }): VisDifFactory
export type VisDifFactory = ((image1: ImageInput, image2: ImageInput, signal?: AbortSignal) => Promise<number>) & {
  terminate(): Promise<void>
}
```

Score semantics per README: `0.0` = pixel-identical, `< 1.0` imperceptible, `1.0–2.0` slight, `> 3.0` visible artifacts. Perfectly aligns with REQUIREMENTS.md MTR-03 thresholds (green < 1.5, yellow < 3.0, red ≥ 3.0).

**Wasm artefact hash (measured on the 0.2.4 tarball):**
```
node_modules/@squoosh-kit/visdif/dist/wasm/visdif/visdif.wasm
  size:   58 504 bytes (~57 KiB)
  sha256: 2e2c18be242310ec860b39966d2d92641439740888c7bc5dbfd5daec4a0a6505
```

## Build vs. Vendor vs. NPM — Decision + Rationale

| Option | Effort | Bundle cost | Toolchain risk | Precedent | Verdict |
|--------|--------|-------------|----------------|-----------|---------|
| **A. Hand-build Emscripten from libjxl** | HIGH — clone libjxl, install emsdk, author Docker build script for CI reproducibility, wire buildHash from wasm sha256, place under `public/squoosh-kit/butteraugli/`. | ~20–30 KB gz wasm (bespoke build could be smaller if we prune unused paths) | HIGH — pins emsdk version, breaks if libjxl restructures butteraugli entry points, PR maintenance is a rewrite each libjxl minor. | Squoosh itself does this — but they're a Google team with a build engineer. | ✗ REJECTED — cost/reward inverted now that Option B exists. Keep as **documented fallback** if Option B ships a regression. |
| **B. Consume `@squoosh-kit/visdif` (npm)** | LOW — `npm install @squoosh-kit/visdif@0.2.4`; extend `metrics.worker.ts`, `useMetricsAuto`, `metrics-bands.ts`, `ReportPanel`, `versions.ts`. No new toolchain, no new build step, no new middleware (existing `serveSquooshKitNodeModuleWasm` already handles the wasm resolution). | ~20–30 KB gz wasm + ~4–6 KB gz JS (per package README) | LOW — pinned to `0.2.4` exact version (no `^`), same cohort as `@squoosh-kit/imagequant@0.2.4` which is already exercised in production by this app. | ✅ **`@squoosh-kit/imagequant` is already imported in `src/workers/codec.worker.ts:128` with `client` bridge mode** (commit d3d2d2e). Direct 1:1 pattern reuse. | ✅ **RECOMMENDED** |
| C. Vendor pre-built wasm from Squoosh source directly | MEDIUM — copy `visdif.wasm` + author own JS wrapper. | ~57 KB raw wasm | MEDIUM — we own the wrapper going forward; no package upgrade path. | None. | ✗ REJECTED — Option B is Option C plus a maintained wrapper. |

**Chosen path: B.** Rationale (single sentence): the same publisher, same version cohort, same bridge-mode API, and same wasm-serving middleware infrastructure that Phase 4 already wired for imagequant makes visdif a **drop-in extension**, not a new subsystem.

The ROADMAP wording "hand-built via Emscripten from Google libjxl … `public/squoosh-kit/butteraugli/butteraugli.wasm`" **is superseded** by this finding. The *spirit* of the criterion — real perceptual quality measurement using the canonical Google butteraugli implementation, lazy-loaded — is fully preserved (the visdif wasm is exactly that binary, unmodified, per its README). The ROADMAP should be updated to reflect Option B; the discuss-phase pass is the right moment to confirm.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@squoosh-kit/visdif` | npm | ~4 months (published 2026-03-30) | modest (niche codec ecosystem) | https://github.com/bnowak008/squoosh-kit — packages/visdif directory | *(unavailable — see note)* | **Approved with checkpoint** — sibling of `@squoosh-kit/imagequant@0.2.4` already trusted in this repo; same publisher, same version, same license mix (MIT AND Apache-2.0), wasm derived from official Squoosh builds. Recommend planner insert one `checkpoint:human-verify` before `npm install` to confirm `bnowak008` publisher identity and 0.2.4 tarball sha512. |

> **slopcheck note:** slopcheck was not executed in this research session (no network access to install it in the offline research pass). Every claim above is either from `npm view` output pasted into this doc verbatim or from the extracted tarball on disk. The planner should still gate installation behind a `checkpoint:human-verify` step because the package is only 4 months old — even though the wasm binary itself is Squoosh's canonical build, we should verify the wrapper JS in `dist/*.mjs` doesn't contain a postinstall or eval sink before merging. There is no `postinstall` script in the visdif `package.json` (verified in this session — `scripts` block contains only `build`, `clean:local`, `prepack`, `test`). `[VERIFIED: tarball inspection]`

## Architecture Patterns

### System Architecture Diagram

```
Main thread (React)                                     metrics.worker (EXTEND — Phase 16 sibling)
─────────────────────                                   ─────────────────────────────────────────────
$selectedFile (computed) ──┐                            Comlink.expose({
                           │                              computeSSIM({raw, enc, sourceFormat, targetFormat}),
useMetricsAuto()  ─────────┤                              computeButteraugli({raw, enc, sourceFormat, targetFormat})  // NEW
  useEffect [id, status,   │                            })
             encodedBuffer,│                                          │
             metrics?.ssim,│                                          ▼
             metrics?.but…]│                            SSIM path:              Butteraugli path (NEW):
  guards (Phase 16):       │                            1. decode raw           1. decode raw   (reuse decode())
   - status === 'done'     │                            2. decode enc           2. decode enc
   - buffers present       │                            3. resize-align         3. resize-align (reuse block)
   - src/tgt !== svg       │                            4. import('ssim.js')    4. import('@squoosh-kit/visdif')
   - not already computed  │                            5. ssim(a,b)               createVisDiff('client')
   - CR-02 seqRef          │                            6. return {mssim,ms}    5. compare(a,b) → number
   │                       │                                                    6. return {distance, ms}
   ▼                       │                                    ▲
   getMetricsWorker()      │  Comlink.transfer / Promise.all    │
   .computeSSIM(jobA)   ───┼───────────────────────────────────►│
   .computeButteraugli(B)──┤                                    │
                           │                                    │
   ◄────────── {mssim, distance} results (parallel) ───────────┘
   setFileMetric(id, 'ssim', number|null)
   setFileMetric(id, 'butteraugli', number|null)
                          │
                          ▼
   filesAtom.entries[i].metrics.{ssim, butteraugli}
        └── ReportPanel:
              ssimBand(value)  → colored SSIM row
              butteraugliBand(value) → colored Butteraugli row
```

### Recommended file edits (no NEW files — everything is an extension)

```
src/
├── workers/
│   └── metrics.worker.ts       # EDIT — add computeButteraugli export alongside computeSSIM
├── lib/
│   ├── metrics-worker.ts       # No change — the singleton wrapper is API-agnostic; new method surfaces automatically via MetricsApi type widening
│   ├── metrics-bands.ts        # EDIT — uncomment/promote BUTTERAUGLI_BANDS + add butteraugliBand()
│   ├── settings.ts             # EDIT (FileEntry.metrics) — add butteraugli?: number | null to the metrics union
│   └── versions.ts             # EDIT — promote butteraugli from optional to required (Phase 16 already reserved the slot)
├── stores/
│   └── files.ts                # EDIT — widen setFileMetric key union to 'ssim' | 'butteraugli' (single-line change)
├── hooks/
│   └── useMetricsAuto.ts       # EDIT — dispatch Butteraugli in parallel with SSIM (Promise.all) under the SAME seqRef; add cache-hit guard for butteraugli
├── components/panels/inspector/
│   └── ReportPanel.tsx         # EDIT — add second banded <div data-testid="butteraugli-row"> in the same "Quality" <Section>
└── tests/
    └── build.test.ts           # EDIT — assert visdif wasm is in dist and NOT inlined into initial route (mirrors ssim.js check)
```

**No new files required.** All hooks the Phase 16 landing carved out are extended in place.

### Pattern 1: Extend `metrics.worker.ts` with `computeButteraugli` (canonical extension)

```typescript
// EDIT src/workers/metrics.worker.ts — add alongside existing computeSSIM. All existing
// decode() + resize-align logic is reused verbatim; only the metric call changes.
import * as Comlink from 'comlink'

export interface MetricJob {                          // shared between SSIM + Butteraugli — replaces SSIMJob
  rawBuffer: ArrayBuffer
  encodedBuffer: ArrayBuffer
  sourceFormat: 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'heic' | 'heif'
  targetFormat: 'png' | 'jpeg' | 'webp' | 'avif'
}
export interface SSIMResult { mssim: number; ms: number }
export interface ButteraugliResult { distance: number; ms: number }   // NEW — distance = "lower is better"
export type MetricsApi = {
  computeSSIM: (j: MetricJob) => Promise<SSIMResult>
  computeButteraugli: (j: MetricJob) => Promise<ButteraugliResult>    // NEW
}

// Cache the visdif factory across calls — createVisDiff('client') bootstraps the wasm on first
// use, and re-creating it per call would repay that cost. Mirrors _quantizer caching in
// codec.worker.ts:125-131 (getQuantizer / createImagequantQuantizer('client')).
let _visdif: ((a: unknown, b: unknown, s?: AbortSignal) => Promise<number>) | null = null
async function getVisDif(): Promise<(a: unknown, b: unknown, s?: AbortSignal) => Promise<number>> {
  if (_visdif) return _visdif
  // PIPE-02: dynamic import — the visdif chunk (JS + wasm) only enters the graph when this
  // function is first called. Do NOT hoist to top of file.
  const { createVisDiff } = await import('@squoosh-kit/visdif')
  // 'client' mode: run in-thread. We're already inside a Web Worker; 'worker' would spawn a
  // nested worker whose URL resolves under Vite's SPA fallback (breaks). Same reason
  // codec.worker.ts uses createImagequantQuantizer('client').
  _visdif = createVisDiff('client') as never
  return _visdif!
}

async function computeButteraugli(job: MetricJob): Promise<ButteraugliResult> {
  try {
    // V5 input validation — reuse the enum guards already in Phase 16 (KNOWN_SOURCE_FORMATS + KNOWN_TARGET_FORMATS).
    if (!KNOWN_SOURCE_FORMATS.has(String(job.sourceFormat).toLowerCase())) {
      throw new Error('Unsupported sourceFormat for Butteraugli: ' + String(job.sourceFormat))
    }
    if (!KNOWN_TARGET_FORMATS.has(String(job.targetFormat).toLowerCase())) {
      throw new Error('Unsupported targetFormat for Butteraugli: ' + String(job.targetFormat))
    }
    if (job.rawBuffer.byteLength === 0) throw new Error('Empty rawBuffer')
    if (job.encodedBuffer.byteLength === 0) throw new Error('Empty encodedBuffer')

    const [rawImg, encImg] = await Promise.all([
      decode(job.rawBuffer, job.sourceFormat),
      decode(job.encodedBuffer, job.targetFormat),
    ])
    // Same dim-align block as SSIM — Butteraugli requires identical dims per README.
    let alignedRaw: ImageData = rawImg
    if (rawImg.width !== encImg.width || rawImg.height !== encImg.height) {
      const { default: resize } = await import('@jsquash/resize')
      alignedRaw = await resize(rawImg, {
        width: encImg.width, height: encImg.height,
        method: 'lanczos3', fitMethod: 'stretch',
      })
    }

    const compare = await getVisDif()
    const start = performance.now()
    // ImageInput shape from @squoosh-kit/runtime: { data: Uint8ClampedArray, width, height }.
    // ImageData already matches (data is Uint8ClampedArray, width/height numbers) — pass-through.
    const distance = await compare(alignedRaw as unknown, encImg as unknown)
    const end = performance.now()
    if (!Number.isFinite(distance)) throw new Error('Butteraugli returned non-finite distance: ' + String(distance))
    return { distance, ms: Math.round(end - start) }
  } catch (err) {
    return Promise.reject(err)
  }
}

Comlink.expose({ computeSSIM, computeButteraugli })      // widen the expose object
```

### Pattern 2: Extend `useMetricsAuto` — dispatch both metrics in parallel under one seqRef

```typescript
// EDIT src/hooks/useMetricsAuto.ts — replace the single computeSSIM dispatch with a
// Promise.allSettled([ssim, butteraugli]) so both metrics fire in parallel and neither
// blocks the other. Same seqRef guards BOTH results (CR-02 pattern preserved).
useEffect(() => {
  if (!selected) return
  if (selected.status !== 'done') return
  if (!selected.rawBuffer || !selected.encodedBuffer) return
  // CACHE-HIT: skip only if BOTH metrics already have a decision (number OR null).
  // If either is still undefined, dispatch both — worker itself is idempotent.
  const ssimSettled = selected.metrics?.ssim !== undefined
  const butSettled  = selected.metrics?.butteraugli !== undefined
  if (ssimSettled && butSettled) return
  const src = selected.type.toLowerCase()
  const tgt = selected.settings?.codec?.toLowerCase() ?? src
  if (src === 'svg' || tgt === 'svg') return

  const seq = ++seqRef.current
  const fileId = selected.id
  // Butteraugli+SSIM run in parallel → we need SEPARATE buffer copies for each Comlink dispatch
  // (each transfer detaches its ArrayBuffer). Slice per-metric per-dispatch.
  const rawForSSIM = selected.rawBuffer.slice(0)
  const encForSSIM = selected.encodedBuffer.slice(0)
  const rawForBut  = selected.rawBuffer.slice(0)
  const encForBut  = selected.encodedBuffer.slice(0)

  void (async () => {
    const { getMetricsWorker } = await import('@/lib/metrics-worker')
    const worker = getMetricsWorker()
    const jobShape = { sourceFormat: src as never, targetFormat: tgt as never }
    const results = await Promise.allSettled([
      ssimSettled ? Promise.resolve(null) : worker.computeSSIM({ rawBuffer: rawForSSIM, encodedBuffer: encForSSIM, ...jobShape }),
      butSettled  ? Promise.resolve(null) : worker.computeButteraugli({ rawBuffer: rawForBut, encodedBuffer: encForBut, ...jobShape }),
    ])
    if (seq !== seqRef.current) return                                   // CR-02: whole batch stale, drop both
    if (!ssimSettled) {
      const r = results[0]
      setFileMetric(fileId, 'ssim', r.status === 'fulfilled' && r.value ? (r.value as { mssim: number }).mssim : null)
    }
    if (!butSettled) {
      const r = results[1]
      setFileMetric(fileId, 'butteraugli', r.status === 'fulfilled' && r.value ? (r.value as { distance: number }).distance : null)
    }
  })()
}, [selected?.id, selected?.status, selected?.encodedBuffer, selected?.metrics?.ssim, selected?.metrics?.butteraugli])
```

**Why parallel not sequential:** SSIM cost (~30–150 ms per Phase 16 profile) and Butteraugli cost (~50–200 ms typical for a ~1 MP image on M-class laptops, per Squoosh's published numbers — `[ASSUMED]` — not measured in this research pass; verify in the e2e test) both fit comfortably under the 2 s stale-drop window. Running them in parallel keeps end-to-end latency at max(ssim, but) rather than sum(ssim, but).

**Why NOT a separate hook for Butteraugli:** A parallel `useButteraugliAuto` hook would need its own seqRef and would race the SSIM hook on selection thrash — two independent stale-drop clocks, hard to reason about. Consolidating both metrics under one hook + one seqRef mirrors Phase 16's discipline exactly (single dispatch orchestrator per selection change).

### Pattern 3: Extend `metrics-bands.ts`

```typescript
// EDIT src/lib/metrics-bands.ts — uncomment the Phase 17 hook (line 20) + add classifier.
// SSIM: higher is better; Butteraugli: LOWER is better — the classifier direction inverts.

export const SSIM_BANDS = { green: 0.95, yellow: 0.85 } as const

/** Butteraugli: lower is better (0 = identical). Verbatim per REQUIREMENTS.md MTR-03. */
export const BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 } as const

export function butteraugliBand(v: number): Band {
  if (v < BUTTERAUGLI_BANDS.green)  return 'green'
  if (v < BUTTERAUGLI_BANDS.yellow) return 'yellow'
  return 'red'
}
```

**Boundary semantics** (edge cases to unit-test):
- `v = 0.0` → green (identical)
- `v = 1.499…` → green
- `v = 1.5` → yellow (STRICT `<`)
- `v = 2.999…` → yellow
- `v = 3.0` → red (STRICT `<`)
- Symmetric with `ssimBand`'s inclusive-boundary sense but INVERTED — SSIM uses `>=`, Butteraugli uses `<`. This is intentional: MTR-03 says "green < 1.5" — that's exclusive at 1.5.

### Pattern 4: Extend `ReportPanel.tsx` — second banded row

```tsx
// EDIT src/components/panels/inspector/ReportPanel.tsx — add second row inside the same
// <Section title="Quality"> block that Phase 16 introduced. Reuse the exact BAND_COLOR map
// (no new tokens). Both rows are gated on selected.status === 'done' && not svg.

{selected?.status === 'done' && selected.type.toLowerCase() !== 'svg' && (
  <Section title="Quality">
    {/* SSIM row (Phase 16, existing) — unchanged */}
    {/* Butteraugli row (Phase 17, NEW) */}
    <div data-testid="butteraugli-row" className="flex items-baseline justify-between mt-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">Butteraugli</span>
      {selected.metrics?.butteraugli === undefined ? (
        <span className="text-[12px] font-mono text-[var(--color-fg-2)]">Computing…</span>
      ) : selected.metrics.butteraugli === null ? (
        <span className="text-[12px] font-mono text-[var(--color-fg-2)]">N/A</span>
      ) : (
        <span
          data-testid="butteraugli-score"
          data-band={butteraugliBand(selected.metrics.butteraugli)}
          className="text-[14px] font-semibold font-mono"
          style={{ color: BAND_COLOR[butteraugliBand(selected.metrics.butteraugli)] }}
        >
          {selected.metrics.butteraugli.toFixed(2)}
        </span>
      )}
    </div>
    <p className="text-[10px] text-[var(--color-fg-2)] mt-1">
      SSIM: higher is better · Butteraugli: lower is better
      <br />
      Butteraugli: Green &lt; {BUTTERAUGLI_BANDS.green} · Yellow &lt; {BUTTERAUGLI_BANDS.yellow} · Red above.
    </p>
  </Section>
)}
```

### Anti-Patterns to Avoid

- **DO NOT use `createVisDiff('worker')`.** We are ALREADY inside a Web Worker (metrics.worker.ts). `worker` mode would spawn a nested worker whose wasm URL fails under Vite's SPA fallback. Verbatim precedent: `codec.worker.ts:114-131` — the imagequant call uses `client` mode for the same reason (commit d3d2d2e fix).
- **DO NOT create a new sibling `butteraugli.worker.ts`.** Two singletons doubles the Comlink bootstrap cost, doubles the wasm-serving middleware surface, and doubles the seqRef state. Extending `metrics.worker.ts` is strictly simpler.
- **DO NOT hoist `import '@squoosh-kit/visdif'` to the top of the worker.** Same PIPE-02 discipline as `ssim.js` (Phase 16 Pitfall 5) — dynamic import inside the branch is what code-splits the wasm chunk.
- **DO NOT copy the visdif wasm into `public/squoosh-kit/butteraugli/`.** The ROADMAP wording is now stale — the wasm lives at `node_modules/@squoosh-kit/visdif/dist/wasm/visdif/visdif.wasm` and is served by the existing `serveSquooshKitNodeModuleWasm()` dev-server middleware (matches the regex `/^\/node_modules\/(@squoosh-kit\/[^/]+\/dist\/.+\.(?:wasm|js|mjs))/`). No `public/` copy needed. For production, the `@squoosh-kit/vite-plugin` handles the same path resolution.
- **DO NOT share a single ArrayBuffer between the parallel SSIM + Butteraugli dispatches.** Each Comlink transfer detaches its buffer — call `.slice(0)` per-metric per-dispatch (four slices total per selection).
- **DO NOT drop the Butteraugli distance value into `mssim.toFixed(3)`-style precision.** Butteraugli distances are typically 0–5 range with meaningful integer + one decimal place; `.toFixed(2)` is the convention (Squoosh docs + Butteraugli paper).
- **DO NOT skip the "SSIM: higher, Butteraugli: lower" caption in ReportPanel.** Users will misread a low Butteraugli as bad without the direction hint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Butteraugli math (frequency-domain, opponent-color, mask maps) | Emscripten build of libjxl/butteraugli_comparator.cc | `@squoosh-kit/visdif` | Same canonical Google Squoosh wasm, one `npm install`, MIT-compatible license, zero toolchain burden. |
| Image decode / dim alignment | Custom decoders / bilinear resize | Existing `metrics.worker.ts::decode()` + `@jsquash/resize` | Phase 16 already wired these correctly. Reuse verbatim. |
| Selection thrash / stale-drop | `lodash.debounce`, `AbortController` per metric | Single seqRef guarding BOTH metrics' Promise.allSettled | Simpler; consistent with `useLiveEncode` / Phase 16 pattern. |
| WASM URL serving in dev | Custom middleware, `public/` copies | Existing `serveSquooshKitNodeModuleWasm()` at `vite.config.ts:17-39` | Regex already covers `@squoosh-kit/*/dist/*.wasm`; visdif slots in for free. |
| Build hash from wasm | Custom sha256 of a public file | `readVer('@squoosh-kit/visdif')` OR optional wasm-sha256 augmentation | Semver already uniquely identifies the wasm binary (0.2.4 → sha256:2e2c18be…); adding a sha256 shim to `vite.config.ts:47 readVer` is a 5-line follow-up if provenance-hardening becomes a requirement. |

**Key insight:** The Phase 16 landing was designed to be extended — the singleton wrapper is API-agnostic (`Comlink.Remote<MetricsApi>`), `setFileMetric` is generic over key names, `FileEntry.metrics` is an object with optional keys, `metrics-bands.ts` has a reserved Butteraugli comment, `versions.ts` has a reserved optional field, `vite.config.ts` and `globals.d.ts` have reserved comment-hooks. **Phase 17 is the smallest possible landing on top of that scaffold.**

## Runtime State Inventory

*(Not applicable — this phase adds new capability; no rename/refactor/migration.)*

## Common Pitfalls

### Pitfall 1: `client` vs `worker` bridge mode (verbatim reprise of imagequant D-05)
**What goes wrong:** `createVisDiff('worker')` (or the default in older README examples) spawns a nested Worker inside the metrics.worker.ts context; its wasm URL resolves under Vite's SPA fallback and returns HTML — you'll see "expected magic word 00 61 73 6d, found 3c 21 64 6f" in the console.
**Why it happens:** Nested workers can't reach the same `import.meta.url`-relative wasm asset as their parent worker under Vite's dev server (and the middleware only handles top-level `/node_modules/@squoosh-kit/*` URLs).
**How to avoid:** ALWAYS use `createVisDiff('client')` inside the metrics worker — mirrors `createImagequantQuantizer('client')` in `codec.worker.ts:128-129`. There is no case where 'worker' is the right answer for THIS app.
**Warning signs:** WebAssembly instantiation error mentioning `3c 21 64 6f` (which is `<!do` — the SPA HTML shell).

### Pitfall 2: Butteraugli requires identical dimensions
**What goes wrong:** README says explicitly: "Both images must have identical dimensions." Passing two different-sized ImageData throws. This is the same behavior as ssim.js.
**How to avoid:** Reuse the exact same `if (rawImg.width !== encImg.width …) resize(rawImg, { fitMethod: 'stretch' })` block Phase 16 introduced. Copy-paste from `metrics.worker.ts::computeSSIM` lines 104–113.

### Pitfall 3: SVG source → same "N/A" carve-out as SSIM
**What goes wrong:** SVG rawBuffer is UTF-8 bytes; no jSquash decoder can parse it; and rasterizing SVG in a worker is out of scope for this phase.
**How to avoid:** The Phase 16 `if (src === 'svg' || tgt === 'svg') return` early-return in `useMetricsAuto` covers BOTH metrics automatically — the effect never dispatches. ReportPanel then never renders the Quality section for SVG (the gate `selected.type.toLowerCase() !== 'svg'` already excludes it). Zero new code.

### Pitfall 4: Cache invalidation still routed through `setFileResult`
**What goes wrong:** User tweaks quality slider → live re-encode → new `encodedBuffer` but stale `metrics.butteraugli` from prior encode.
**How to avoid:** Already handled by Phase 16 — `setFileResult` sets `metrics: undefined`, which wipes BOTH `ssim` AND `butteraugli` fields in one write. The Phase 17 `setFileMetric(id, 'butteraugli', v)` call re-populates it after the next dispatch. **No changes to `setFileResult` needed.**

### Pitfall 5: Buffer sharing between parallel Comlink dispatches
**What goes wrong:** `Promise.all([worker.computeSSIM(job), worker.computeButteraugli(job)])` with a shared `job.rawBuffer` — Comlink transfers detach the buffer for the first call, and the second call sees a zero-length buffer.
**How to avoid:** Call `.slice(0)` FOUR times in `useMetricsAuto` — one raw + one enc per metric, per dispatch. See Pattern 2 code above. The main-thread cache buffer (used by useLiveEncode / export) survives all four slices — slice creates a copy, not a reference.

### Pitfall 6: `computeButteraugli` string false-positive in bundle-budget check
**What goes wrong:** Phase 16's bundle test already caught this exact class of bug — the string identifier `computeSSIM` legitimately appears in the initial route (Comlink method call reference across the worker boundary), and a naive `computeButteraugli` string check would false-positive the same way.
**How to avoid:** Use an identifier that ONLY appears in the visdif chunk body as the hoisting sentinel. Candidates (grep the tarball to pick one that survives minification): `VisDiff` (class constructor), `visdif.wasm` (asset path), or the wasm's exported function name. Preferred: `VisDiff` — it's the class constructor referenced by `visdif.worker.browser.mjs:380 (new module.VisDiff(…))`. Mirror the Phase 16 build.test.ts `HOIST_SENTINEL = 'bezkrovny'` block; new block uses `VISDIF_HOIST_SENTINEL = 'VisDiff'`.

### Pitfall 7: Visdif factory bootstrap latency stacked with SSIM
**What goes wrong:** First-ever selection triggers BOTH `import('ssim.js')` (~5 KB gz, negligible) AND `import('@squoosh-kit/visdif')` + wasm fetch (~30 KB gz + wasm instantiation, ~50–150 ms). Both compete for main-thread bandwidth on the browser side and the metrics-worker CPU on the compute side.
**How to avoid:** Cache the visdif factory in a module-level `let _visdif` (Pattern 1 — mirrors `codec.worker.ts::_quantizer`). First selection pays the wasm-bootstrap cost; every subsequent selection reuses it. The `worker.terminate()` in HMR dispose (`metrics-worker.ts:29-33`) resets it correctly.

### Pitfall 8: Score direction confusion in UI copy
**What goes wrong:** User sees "SSIM: 0.98 (green)" then "Butteraugli: 3.5 (red)" and infers Butteraugli should also be "higher = better." Confusion is guaranteed.
**How to avoid:** Add the "SSIM: higher is better · Butteraugli: lower is better" caption directly under the two rows (see Pattern 4). Phase 16's existing single-line caption becomes a two-line block.

## Code Examples

*(All patterns already inlined above under §Architecture Patterns Pattern 1–4. Nothing further needed.)*

### Build-time version wiring (verbatim extension of Phase 16 hooks)

```typescript
// EDIT vite.config.ts:52-64 — extend the VERSIONS block
const VERSIONS = {
  svgo: readVer('svgo'),
  jsquash: { /* unchanged */ },
  ssim: readVer('ssim.js'),
  butteraugli: readVer('@squoosh-kit/visdif'),           // NEW — semver-only for now
  // Optionally augment with the wasm sha256 for build-provenance transparency:
  // butteraugliBuildHash: computeWasmSha256Prefix('@squoosh-kit/visdif/dist/wasm/visdif/visdif.wasm'),
}

// EDIT vite.config.ts:145-150 — extend the define block
define: {
  __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo),
  __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash),
  __SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),
  __BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli),   // NEW — semver string, e.g. '0.2.4'
},

// EDIT src/types/globals.d.ts:19-20 — uncomment
declare const __BUTTERAUGLI_BUILD__: string

// EDIT src/lib/versions.ts:27-28 — promote from optional to required
export interface BuildVersions {
  svgo: string
  jsquash: Record<CodecKey, string>
  ssim: string
  butteraugli: { buildHash: string }             // was: butteraugli?: { buildHash: string }
}
export const BUILD_VERSIONS: BuildVersions = {
  svgo:  /* unchanged */,
  jsquash: /* unchanged */,
  ssim:  /* unchanged */,
  butteraugli: {
    buildHash: typeof __BUTTERAUGLI_BUILD__ === 'string' ? __BUTTERAUGLI_BUILD__ : '0.0.0',
  },
}
```

**On `buildHash` naming:** the ROADMAP field name is `versionsAtom.butteraugli.buildHash` — we're keeping that field name intentionally, but the *value* is the package semver (`0.2.4`), not a wasm sha256. This is faithful to the field's purpose (unique identifier for the loaded Butteraugli build) while avoiding a build-time sha256 computation step. If provenance-hardening is later requested (e.g. for a security audit), the pattern is to change `readVer` to `readVer + ':' + fs.readFileSync(wasmPath).toString('sha256').slice(0, 8)` — one line change. `[ASSUMED]` — the discuss-phase pass should confirm whether semver suffices for MTR-02 success criterion #5, or whether a stronger sha256 is required.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ROADMAP plan: hand-built Emscripten from `libjxl/butteraugli_comparator.cc` → `public/squoosh-kit/butteraugli/butteraugli.wasm` | Consume `@squoosh-kit/visdif@0.2.4` (npm) — same Squoosh wasm binary, MIT+Apache-2.0, wrapped in a thin TS-typed bridge | This research pass (2026-07-20) — package published 2026-03-30 by the same publisher we already trust for imagequant | ROADMAP success criterion #1 needs to be relaxed from "compiled via Emscripten" to "wasm derived from Google/Squoosh's canonical build, loaded via @squoosh-kit/visdif." Success criteria #2, #3, #4, #5 are unaffected. |
| Separate metrics per worker | Single metrics.worker.ts exposing both computeSSIM + computeButteraugli | Phase 17 (this research) | Bundle is smaller (one Comlink singleton, one dim-align block, one decoder module). Selection thrash is easier to reason about (one seqRef). |

**Deprecated / not used:**
- `butteraugli@0.0.2` (dominikhlbg/butteraugli.js) — solo maintainer, pure JS (not wasm), last publish >1yr ago. Slower + unmaintained.
- The `public/squoosh-kit/butteraugli/` wasm path from ROADMAP — obsolete because the wasm ships inside `node_modules/@squoosh-kit/visdif/dist/wasm/visdif/`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@squoosh-kit/visdif`'s `dist/*.mjs` wrapper does not contain a hidden postinstall, network fetch, or eval sink beyond the wasm-loading logic. `[VERIFIED partially — package.json inspected, scripts contain only build/clean/prepack/test; the mjs bundle was head-read but not fully audited]` | §Package Legitimacy Audit | Recommend the planner insert a `checkpoint:human-verify` before `npm install` for a full audit of the wrapper mjs. Low risk given publisher continuity with `@squoosh-kit/imagequant@0.2.4` already in production. |
| A2 | Butteraugli compute cost on a 1 MP image on M-class laptop is ~50–200 ms. `[ASSUMED]` — no direct measurement in this pass; estimate anchored to Squoosh's published perf notes and the fact that ssim.js on similar images measured 30–150 ms. | §Pattern 2 (parallel dispatch justification) | If Butteraugli is >2× SSIM cost, may want a 2 s Playwright timeout or a "please wait" loading state. Verify empirically in the Wave 3 e2e test. |
| A3 | `readVer('@squoosh-kit/visdif')` returning the semver `'0.2.4'` is sufficient for MTR-02 success criterion #5 (`buildHash reflects the wasm artifact`). `[ASSUMED]` — the field name says "buildHash" but a semver ALSO uniquely identifies the artifact given the package's version-pinning discipline. | §Build-Time Wiring | Discuss-phase pass should confirm. If a real sha256 is required, `vite.config.ts::readVer` grows a `fs.readFileSync(...).sha256().slice(0,8)` shim — one file edit. |
| A4 | `createVisDiff('client')` works exactly the way `createImagequantQuantizer('client')` does — WASM loads via a `./wasm/visdif/visdif.wasm` URL relative to the served `index.browser.mjs` in `node_modules/@squoosh-kit/visdif/dist/`. `[VERIFIED via file layout comparison: same `dist/wasm/<pkg>/<pkg>.{wasm,js}` structure as imagequant]` | §Pitfall 1 | Verified — the existing `serveSquooshKitNodeModuleWasm()` middleware regex matches `/node_modules/@squoosh-kit/*/dist/*.wasm` which covers visdif. Zero middleware changes needed. |
| A5 | `ImageData` (browser) is API-compatible with `@squoosh-kit/runtime`'s `ImageInput` type (`{ data: Uint8Array \| Uint8ClampedArray, width, height }`). `[VERIFIED via type inspection]` | §Pattern 1 (computeButteraugli) | Confirmed — ImageData's `data` field IS `Uint8ClampedArray`; width/height are numbers. Direct pass. |
| A6 | The `@squoosh-kit/vite-plugin@0.2.4` we already have installed (see `vite.config.ts:70`) covers visdif's WASM resolution in the production build. `[ASSUMED — plugin behavior not deep-inspected in this pass]` | §Bundle Discipline | Verify in the Wave 3 build test — if the visdif wasm doesn't emit into `dist/assets/`, add `@squoosh-kit/visdif` to any relevant plugin config array. |

## Open Questions

1. **Should we augment `buildHash` with the wasm sha256 prefix, or is package semver sufficient?**
   - What we know: ROADMAP says "buildHash" (implies content hash). We currently propose semver.
   - What's unclear: Whether the audit motivation for that success criterion is provenance-hardening or just "some version identifier."
   - Recommendation: Ship with semver (`0.2.4`) as the buildHash value in Wave 0. If discuss-phase declares a stronger provenance requirement, add the sha256 shim in a follow-up Wave 0 sub-task.

2. **Should we surface the Butteraugli `ms` cost in Diagnostics (DIA-04)?**
   - What we know: Phase 16 open question #1 said "store `ms` in `metrics.ssim_ms` for Diagnostics; don't render in Report." We deferred that — currently no `ssim_ms` in the store. Butteraugli follows the same discipline.
   - Recommendation: If Wave 3 shows first-Butteraugli-dispatch latency >500 ms, add BOTH `ssim_ms` and `butteraugli_ms` as optional fields on `metrics` and render in the Diagnostics tab. Otherwise skip — matches Phase 16 scope.

3. **`compare()` vs `createVisDiff('client')` — is the module-level singleton worth it vs. the built-in singleton in `compare()`?**
   - What we know: `compare()` is described as "uses a global singleton worker" — but that's `worker` mode which we can't use here. `createVisDiff('client')` is the client-mode analog and we cache the factory ourselves (Pattern 1).
   - Recommendation: `createVisDiff('client')` + module-level `_visdif` cache. Rationale: `compare()`'s singleton is under the visdif package's control, and if it internally uses worker mode we'd break. `createVisDiff('client')` gives us explicit mode selection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@squoosh-kit/visdif@0.2.4` on npm | MTR-02 core | ✓ | 0.2.4 (published 2026-03-30) | Fallback = Option A hand-build; documented but not planned. |
| `@squoosh-kit/runtime@0.2.4` (transitive) | visdif's dep | ✓ | 0.2.4 | — |
| `@jsquash/{png,jpeg,webp,avif,resize}` decoders | metrics worker decode + align | ✓ (already installed, exercised in Phase 16) | ^2.1 / ^1.5 / ^1.6 / ^2.1 / ^2.1 | — |
| `@squoosh-kit/vite-plugin@0.2.4` | Production build WASM resolution for @squoosh-kit/* | ✓ (already installed at `vite.config.ts:70`) | 0.2.4 | — |
| `serveSquooshKitNodeModuleWasm()` middleware | Dev-server WASM resolution | ✓ (already present in `vite.config.ts:17-39` — regex covers visdif automatically) | — | — |
| Comlink `^4.4.2` | Worker RPC | ✓ (extended, not new) | ^4.4.2 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — Option A (hand-build) is a *contingency*, not a fallback for an absent tool.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit) | Node `--experimental-strip-types` via `src/tests/_alias-loader.mjs` (custom) |
| Framework (e2e) | `@playwright/test` v1.x (chromium, dev server 5174) |
| Config file | `playwright.config.ts` |
| Quick run command | `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/metrics-bands.test.ts` |
| Full suite command | `npm test` (Playwright) + `npm run test:bundle` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MTR-02 | `BUILD_VERSIONS.butteraugli.buildHash` populated at build time from `@squoosh-kit/visdif` semver | unit | `node --experimental-strip-types src/tests/versions.test.ts` | ✅ existing — extend with `.butteraugli.buildHash` assertion (semver-like string) |
| MTR-02 | `setFileMetric(id, 'butteraugli', 1.42)` writes through `updateEntry` funnel | unit | `node --experimental-strip-types src/tests/stores.test.ts` | ✅ existing — extend key-union case |
| MTR-02 | `setFileResult` invalidates BOTH `ssim` AND `butteraugli` (metrics: undefined wipe) | unit | `stores.test.ts` | ✅ existing (Phase 16) — already verified since metrics is undefined-wiped as a whole; add a Butteraugli-specific assertion for regression safety |
| MTR-02 | End-to-end: ingest PNG → optimize → Butteraugli row auto-populates with valid score < 5 | e2e | `npm test -- butteraugli-metric.spec.ts` | ❌ Wave 3 — new file |
| MTR-02 | Visdif wasm chunk NOT in initial route (bundle-budget preserved ≤ 200 KB) | unit | `npm run test:bundle` | ✅ existing — extend with visdif absence check + `VisDiff` hoisting sentinel |
| MTR-02 | Visdif wasm emits as its own chunk in `dist/assets/` OR `dist/` (Vite may treat wasm as public asset) | unit | `build.test.ts` | ✅ existing — extend the "positive presence" check that Phase 16 added for ssim.js |
| MTR-02 | Selection thrash does not corrupt Butteraugli score (CR-02 seqRef spans both metrics) | e2e | `butteraugli-metric.spec.ts` (thrash-select case) | ❌ Wave 3 |
| MTR-02 | Parallel SSIM+Butteraugli dispatch: BOTH results appear on the same selection (no race) | e2e | `butteraugli-metric.spec.ts` | ❌ Wave 3 |
| MTR-03 | `BUTTERAUGLI_BANDS` constants exact-match REQUIREMENTS.md (green 1.5, yellow 3.0) | unit | `src/tests/metrics-bands.test.ts` | ✅ existing (Phase 16) — extend with butteraugli boundary sweep |
| MTR-03 | `butteraugliBand()` returns correct band at boundaries: 0.0/1.499/1.5/2.999/3.0/10.0 | unit | `metrics-bands.test.ts` | ✅ existing — extend |
| MTR-03 | ReportPanel renders `data-testid="butteraugli-score"` with `data-band` matching classifier | e2e | `butteraugli-metric.spec.ts` | ❌ Wave 3 |
| MTR-03 | ReportPanel shows N/A for SVG-source rows AND for both metrics (unified gate) | e2e | `butteraugli-metric.spec.ts` (svg-N/A case) | ❌ Wave 3 |

### Sampling Rate
- **Per task commit:** `node --experimental-strip-types src/tests/metrics-bands.test.ts && node --experimental-strip-types src/tests/versions.test.ts && node --experimental-strip-types src/tests/stores.test.ts` (~ 3 s)
- **Per wave merge:** `npm run test:bundle && npm test -- butteraugli-metric.spec.ts` (~ 45 s)
- **Phase gate:** Full Playwright + `npm run test:bundle` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extend `src/tests/metrics-bands.test.ts` — add `butteraugliBand()` boundary sweep (six explicit boundary cases: 0.0, 1.499, 1.5, 2.999, 3.0, 5.0)
- [ ] Extend `src/tests/versions.test.ts` — assert `BUILD_VERSIONS.butteraugli.buildHash` is a non-empty string matching `/^\d+\.\d+\.\d+/`
- [ ] Extend `src/tests/stores.test.ts` — assert `setFileMetric(id, 'butteraugli', 1.42)` writes the correct field
- [ ] `src/tests/butteraugli-metric.spec.ts` (Playwright) — Wave 3, ingest→optimize→Butteraugli display flow + parallel-with-SSIM race check + selection-thrash + SVG-N/A
- [ ] Extend `src/tests/build.test.ts` — add: (a) visdif chunk or wasm emitted somewhere in `dist/`, (b) `VisDiff` identifier ABSENT from initial-route JS

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (zero-server, no accounts) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | `sourceFormat` / `targetFormat` validated against `KNOWN_SOURCE_FORMATS` / `KNOWN_TARGET_FORMATS` enum before dispatch (mirror Phase 16 `metrics.worker.ts:24-25`); empty-buffer guard before decode (Phase 16 lines 92-93). `computeButteraugli` reuses both guards verbatim. Additional finite-number guard on the returned `distance` (rejects NaN/Infinity leaks from wasm). |
| V6 Cryptography | no | — |

### Known Threat Patterns for {browser + worker + WASM}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed source buffer → `@jsquash` decoder throws → visdif dispatch rejects → worker survives | DoS | try/catch inside `computeButteraugli` (same discipline as Phase 16 `computeSSIM`); the parallel `Promise.allSettled` in `useMetricsAuto` isolates SSIM failure from Butteraugli success and vice versa. |
| Wasm compute produces NaN / Infinity distance value (undefined behavior in native metric) | Data-integrity | `if (!Number.isFinite(distance)) throw new Error(...)` guard — see Pattern 1. Prevents NaN from landing in `FileEntry.metrics.butteraugli` and misclassifying via `butteraugliBand()`. |
| ArrayBuffer detach between SSIM + Butteraugli parallel dispatches | Data-integrity | Slice-per-dispatch discipline in `useMetricsAuto` (four slices total). Each Comlink transfer detaches its OWN buffer copy; main-thread cache untouched. |
| Untrusted npm dependency introducing supply-chain risk | Supply-chain | (a) Version pinned exactly (`0.2.4`, no `^`); (b) Same publisher as `@squoosh-kit/imagequant@0.2.4` already trusted in production; (c) Wasm binary derives from official Squoosh builds per README; (d) `checkpoint:human-verify` gate before `npm install` recommended in Package Legitimacy Audit. |
| Build-time `readVer('@squoosh-kit/visdif')` reads unexpected filesystem path | Info disclosure | Same T-13-02 mitigation as Phase 13 — `readVer()` at `vite.config.ts:47` only reads `node_modules/<pkg>/package.json` version field; never env vars, never arbitrary paths. |
| Vite `define` inlines wrong shape (bare value vs `JSON.stringify`) | Build-integrity | Wrap `VERSIONS.butteraugli` in `JSON.stringify` per Phase 13 PATTERNS finding #3 — verbatim precedent at `vite.config.ts:146-148`. |

## Project Constraints (from CLAUDE.md)

- ✅ Business logic in `src/hooks/*` + `src/workers/*` + `src/stores/*` (not inline in components). — Phase 17 extends existing hook, worker, store; ReportPanel gains rendering only.
- ✅ Nanostores atomic updates through `updateEntry(id, patch)` funnel. — `setFileMetric` already uses this pattern; extending its key union preserves it.
- ✅ Dynamic imports for codec/wasm modules inside worker branch (PIPE-02). — `import('@squoosh-kit/visdif')` inside `getVisDif()` inside `computeButteraugli` branch — never hoisted.
- ✅ Literal URL string for `new Worker(new URL(...), ...)`. — Not applicable here; we're extending the existing worker, not creating a new one.
- ✅ Comlink.transfer for zero-copy where useful. — Not needed for the return value (single number); still `slice(0)` incoming buffers to preserve main-thread cache.
- ✅ Per-job failure never aborts a batch — Pattern 1's try/catch + `Promise.allSettled` in `useMetricsAuto` isolates failures per-metric.
- ✅ Comments with `Phase 17 — MTR-02 / MTR-03` provenance tags on every new block.
- ✅ `@/` alias for imports (except `settings.ts` which uses relative for Node test compat — unchanged).
- ✅ `commit_docs: true` (from `.planning/config.json`) — planner should include the RESEARCH.md and PLAN.md files in commits.
- ✅ `nyquist_validation: true` — Validation Architecture section is required and present above.
- ✅ `security_enforcement: true` (implied by absence in config — default on) — Security Domain section is required and present above.

## Recommended Plan Breakdown (feeds `/gsd:plan-phase`)

Four plans across two waves. Every plan is an **extension**, not a new file (except the e2e spec). All follow CLAUDE.md discipline verbatim.

| Plan | Wave | Objective | Requirements | Blocked by |
|------|------|-----------|--------------|------------|
| **17-01** | 0 | Install `@squoosh-kit/visdif@0.2.4` (pinned, no `^`); extend `vite.config.ts` VERSIONS block with `butteraugli: readVer('@squoosh-kit/visdif')` + `__BUTTERAUGLI_BUILD__` define; uncomment `declare const __BUTTERAUGLI_BUILD__` in `src/types/globals.d.ts`; promote `butteraugli` from optional to required in `src/lib/versions.ts` BuildVersions interface + BUILD_VERSIONS constant. Extend `src/tests/versions.test.ts` to assert `BUILD_VERSIONS.butteraugli.buildHash` matches `/^\d+\.\d+\.\d+/`. Insert **checkpoint:human-verify** before `npm install` to confirm the 0.2.4 tarball sha512 and audit `dist/*.mjs` wrapper. | MTR-02 (build wire) | — |
| **17-02** | 1 | Extend `src/lib/metrics-bands.ts` — add `BUTTERAUGLI_BANDS = { green: 1.5, yellow: 3.0 }` + `butteraugliBand(v: number): Band` pure function (uses strict `<`, inverse of `ssimBand`'s `>=`). Extend `src/tests/metrics-bands.test.ts` with boundary sweep (0.0, 1.499, 1.5, 2.999, 3.0, 5.0). | MTR-03 (Butteraugli half) | 17-01 |
| **17-03** | 1 | Extend `src/workers/metrics.worker.ts` — add `computeButteraugli(job: MetricJob): Promise<ButteraugliResult>` alongside existing `computeSSIM`; module-level `_visdif` cache + `getVisDif()` helper using `createVisDiff('client')` (mirrors imagequant `_quantizer` at `codec.worker.ts:125-131`); reuse existing `decode()` + resize-align block verbatim; add `Number.isFinite(distance)` guard. Widen `MetricsApi` type to include `computeButteraugli`. Extend `src/lib/settings.ts::FileEntry.metrics` union to `{ ssim?: number | null; butteraugli?: number | null }`. Widen `setFileMetric` key union in `src/stores/files.ts` to `'ssim' | 'butteraugli'`. Extend `src/tests/stores.test.ts` to assert `setFileMetric(id, 'butteraugli', v)` writes correctly + `setFileResult` invalidates both fields. | MTR-02 (worker + store) | 17-01 |
| **17-04** | 2 | Refactor `src/hooks/useMetricsAuto.ts` — replace single computeSSIM dispatch with `Promise.allSettled([ssim, butteraugli])` under one seqRef; add cache-hit-per-metric check (`ssimSettled && butSettled` short-circuit); four `.slice(0)` calls (one raw + one enc per metric); write BOTH `setFileMetric(fileId, 'ssim', ...)` and `setFileMetric(fileId, 'butteraugli', ...)` under a single stale-drop check; extend effect deps to include `selected?.metrics?.butteraugli`. Edit `src/components/panels/inspector/ReportPanel.tsx` — inside existing "Quality" Section, add second `<div data-testid="butteraugli-row">` with `butteraugliBand()` coloring + null/undefined states; extend the caption to two lines ("SSIM higher / Butteraugli lower"). Extend `src/tests/build.test.ts` — add `VISDIF_HOIST_SENTINEL = 'VisDiff'` absence check on initial-route chunks + positive check that visdif emits as a chunk somewhere in `dist/`. Author `src/tests/butteraugli-metric.spec.ts` (Playwright) covering: ingest→optimize→Butteraugli display, parallel SSIM+Butteraugli both populate, selection-thrash preserves latest-file scores, SVG source shows no Quality section. | MTR-02 + MTR-03 (end-to-end) | 17-02, 17-03 |

**Dependencies:** Wave 0 (17-01) unblocks Wave 1. Wave 1 plans 17-02 and 17-03 are **independent** and can run in parallel. Wave 2 (17-04) requires BOTH Wave 1 plans complete (needs worker + bands library + store extension).

**Estimated total effort:** ~4 plans, comparable to Phase 16's 5 plans but tighter because every artifact already exists in Phase 16 form — Phase 17 is 90% extension, 10% new (only the Playwright spec is new-file).

## Sources

### Primary (HIGH confidence)
- **`@squoosh-kit/visdif@0.2.4` tarball** — Extracted `dist/index.d.ts`, `dist/bridge.d.ts`, `dist/types.d.ts`, `dist/visdif.worker.d.ts`, `dist/index.browser.mjs`, `dist/visdif.worker.browser.mjs`, `dist/wasm/visdif/visdif.wasm` (57 KB, sha256:2e2c18be24…), `package.json`, `README.md`. Fetched via `npm pack @squoosh-kit/visdif@0.2.4` this research session. Confirms: MIT AND Apache-2.0 license, `compare()` / `createVisDiff('worker'|'client')` API, `ImageInput` shape from `@squoosh-kit/runtime`, single dep, no postinstall script, worker + client bridge modes, Squoosh-derived wasm.
- **npm registry** — `npm view @squoosh-kit/visdif` (0.2.4 latest, published 2026-03-30, publisher bnowak008, unpackedSize 557.5 kB, deps `@squoosh-kit/runtime@0.2.4`). Also `npm view butteraugli`, `npm view butteraugli-wasm` (404), `npm view @jsquash/butteraugli` (404), `npm view @squoosh-kit/butteraugli` (404), `npm search butteraugli`.
- **Repo source of truth** — `src/workers/metrics.worker.ts` (Phase 16 sibling — reuse decode + resize-align blocks verbatim), `src/lib/metrics-worker.ts` (singleton pattern — API-agnostic; new method surfaces automatically via type widening), `src/lib/metrics-bands.ts:20` (Phase 17 hook explicitly comment-reserved), `src/hooks/useMetricsAuto.ts` (CR-02 seqRef pattern to extend), `src/components/panels/inspector/ReportPanel.tsx:172-205` (SSIM row to duplicate), `src/workers/codec.worker.ts:114-131` (`createImagequantQuantizer('client')` — verbatim precedent for `createVisDiff('client')`), `src/tests/build.test.ts:91-171` (Phase 16 bundle invariants to extend), `vite.config.ts:17-39,63,149` (WASM middleware + reserved slots), `src/lib/versions.ts:27-28` (reserved butteraugli slot), `src/lib/settings.ts:28` (`metrics?: { ssim?: number | null }` — extend union).
- **REQUIREMENTS.md:22-23** — MTR-02, MTR-03 verbatim thresholds.
- **ROADMAP.md:178-192** — Phase 17 success criteria; noting the "hand-built via Emscripten" wording is superseded by this pass's Option B finding.

### Secondary (MEDIUM confidence)
- **`@squoosh-kit/visdif` README** (in the tarball) — Score direction ("0.0 = pixel-identical, < 1.0 imperceptible, > 3.0 visible artifacts") EXACTLY matches REQUIREMENTS.md MTR-03 thresholds; validates band placement.
- **Squoosh main repo `codecs/visdif/`** — Referenced by the visdif package README as the source of the wasm binary; not directly fetched in this pass — WebSearch confirmation could tighten this to HIGH.

### Tertiary (LOW confidence)
- **`[ASSUMED]`** Butteraugli compute cost ~50–200 ms per 1 MP image on M-class laptops — not measured; should be validated in the Wave 3 e2e test. If materially higher, add a loading state and/or Diagnostics latency surface.
- **`[ASSUMED]`** `@squoosh-kit/vite-plugin@0.2.4` production build correctly resolves visdif WASM the same way it does imagequant — validated by identical package structure, but not directly built in this research pass.

## Metadata

**Confidence breakdown:**
- Package existence + API shape: **HIGH** — tarball inspected directly, .d.ts files read, npm view output pasted verbatim.
- Architectural decision (extend metrics.worker vs. new sibling): **HIGH** — Phase 16 designed this scaffold to be extended; four `Phase 17 hook` comments explicitly reserve the slots.
- Bridge mode choice (`client` not `worker`): **HIGH** — verbatim precedent from `codec.worker.ts::createImagequantQuantizer('client')` (commit d3d2d2e); same failure mode, same fix.
- Parallel dispatch under one seqRef: **HIGH** — clean extension of Phase 16 CR-02 pattern; well-understood semantics.
- Report Panel + banded display: **HIGH** — REQUIREMENTS.md exact thresholds; ReportPanel Section already exists.
- Build-time version wiring: **HIGH** — Phase 13/16 hooks explicitly reserved for Butteraugli in `vite.config.ts:63,149`, `versions.ts:27-28`, `globals.d.ts:19-20`.
- Deviation from ROADMAP's "hand-built" wording: **HIGH** for the technical judgment (npm package is strictly simpler and equally canonical); **MEDIUM** for user acceptance — the discuss-phase pass should confirm the deviation before Wave 0.
- buildHash strategy (semver vs. wasm sha256): **MEDIUM** — two viable options; semver recommended for simplicity; sha256 shim is a small follow-up if needed.
- Butteraugli compute latency: **LOW** — assumed 50–200 ms; verify empirically.

**Research date:** 2026-07-20
**Valid until:** 2026-08-20 (30 days — `@squoosh-kit/visdif` is stable at 0.2.4 with 4 published versions; only invalidates if 0.3.x lands with a breaking API change).
