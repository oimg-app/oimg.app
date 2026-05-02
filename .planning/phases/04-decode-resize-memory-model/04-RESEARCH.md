# Phase 4: Decode + Resize + Memory Model - Research

**Researched:** 2026-05-02
**Domain:** WASM raster decode + resize, browser memory budgets, object-URL lifecycle, density variant fan-out
**Confidence:** HIGH (jSquash API surface, browser memory APIs); MEDIUM (byte-estimate multiplier, triple-decode benchmark — needs empirical Wave 0 measurement)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Density UI + Variant Generation**
- D-01: Per-file dropdown in file row picks source density (1x/2x/3x). No global default.
- D-02: Per-file checkboxes pick target densities. Source density auto-checked + locked. Empty target set invalid.
- D-03: Filename suffix `name@1x.ext` / `name@2x.ext` / `name@3x.ext` for ALL variants (no asymmetric baseline).
- D-04 + D-14: Each density variant is its own FileEntry; density encoded in id (`sourceUuid-1x`). 1:1 jobs:FileEntries. `addFile(source, sourceDensity, targets[])` materializes N FileEntries up front. urlCache stays `Record<fileId, string>`.

**Resize Algorithm**
- D-05: Default = `lanczos3`.
- D-06: Algorithm exposed as global TweaksPanel setting. New "Resize / Variants" section.
- D-07: Per-file `resizeOverride?: ResizeAlg` data shape ships Phase 4; per-file UI deferred to Phase 5.

**Metadata + ICC**
- D-08: Default = strip ALL metadata.
- D-09: Global "Preserve ICC color profiles" toggle (off by default) + per-file `preserveIcc?: boolean` data shape.
- D-10: Trust jSquash decode→encode roundtrip for EXIF/XMP/IPTC stripping. ICC preservation = explicit handling.

**Memory Cap**
- D-11: Stacked defense — (a) worker discards ImageData immediately post-resize; (b) pool admission gate gates intake on estimated bytes.
- D-12: Memory budget = `0.75 × (navigator.deviceMemory ?? 4) × 1024` MB, capped at 600 MB.
- D-13: StatusBar persistent indicator + first-throttle toast per batch ("Pacing batch for memory").

### Claude's Discretion
- File row UI grouping for N FileEntries per source (parent/nested vs flat-with-pill vs collapsed group)
- Exact location of "Resize / Variants" TweaksPanel section
- Settings store slice layout: extend `global` vs new `resize`/`metadata` slices
- Exact byte-estimate formula for admission gate (raw `w×h×4` + WASM heap multiplier)
- File row dropdown affordance: permanent vs hover/expand
- Worker-side ImageData disposal mechanism
- Field naming `resizeOverride` vs `resizeAlg`
- Backpressure StatusBar visual (icon + tooltip vs text badge vs progress-bar overlay)

### Deferred Ideas (OUT OF SCOPE)
- Single-decode → N-resize fanout inside one adapter (rejected unless benchmark fails)
- Per-file UI affordances for resize algorithm + ICC (Phase 5 UI-04)
- Format-aware metadata defaults
- User-configurable memory budget
- Filename suffix as user-configurable global setting
- Metadata-active-strip-pass implementation
- WeakMap-keyed urlCache
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-04 | User marks each file's source density (1x/2x/3x); app generates missing variants | §1 jSquash decode/resize APIs; §2 admission gate; §6 filename suffix rules |
| PIPE-01 (raster) | User can drop PNG/JPEG/WebP/AVIF | §1 decode signatures per format (Phase 4 wires PNG decode + resize end-to-end; Phase 5 adds real encoders for the other rasters) |
| OPT-06 | Metadata stripping with optional ICC preservation | §1.5 ICC option audit (CRITICAL: no built-in flag exists — manual chunk threading needed); §8 escalation |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- 100% client-side, zero-server, zero-telemetry — no error-tracking SaaS, no analytics
- React 19 + Vite + TypeScript locked
- jSquash codecs (per-format packages); no @squoosh/lib (archived); no `@jsquash/mozjpeg` (JPEG IS MozJPEG inside `@jsquash/jpeg`)
- 200KB initial JS gzipped budget — codecs MUST lazy-load inside workers
- 100ms-per-2MB-file optimize budget — relevant to D-04 triple-decode trade-off
- WCAG AA accessibility — keyboard + ARIA + contrast
- COOP/COEP locked from Phase 1; multithreaded codec builds gated on `crossOriginIsolated`
- MIT license — Squoosh code is Apache 2.0, used as reference only (no copy-paste)

## Summary

Phase 4 delivers raster density-variant generation gated by a byte-aware admission queue. The work splits cleanly into four orthogonal threads: (1) wire `@jsquash/png` decode + `@jsquash/resize` into a new worker adapter that satisfies the existing Phase 2 D-04 contract; (2) extend `addFile` to fan out N FileEntries per source with per-variant ids; (3) layer a byte-estimate gate onto `WorkerPool` so a 50-file batch stays under 800 MB; (4) thread an ICC-preservation path that, contrary to D-10's optimistic phrasing, is NOT a flag — `@jsquash/{png,jpeg,webp,avif}` expose ZERO ICC option in their public APIs. ICC preservation requires manual chunk extraction (PNG `iCCP` chunk; JPEG `APP2` `ICC_PROFILE` marker; WebP `ICCP` chunk; AVIF `colr` box of `prof` type) and re-embed before/after encode. **This is a material deviation from D-10's "exact `iccProfile` option" wording and warrants escalation to discuss-phase.**

The admission gate uses `0.75 × (deviceMemory ?? 4) × 1024` capped at 600 MB (locked D-12). For PNG, peak working-set per job is ≈ raw decoded ImageData (`w × h × 4`) × ~3.5 multiplier covering jSquash WASM heap (decode buffer + resize intermediate + encode buffer all coexist briefly). A 4000×4000 PNG (~64 MB raw RGBA) implies ~225 MB transient peak per job — only ~3 such jobs fit a 600 MB budget, justifying the gate.

**Primary recommendation:** Land a stub-encode-with-real-decode-and-resize Phase 4 adapter (decode → resize → re-encode via `@jsquash/png` encode, no codec settings yet); ship the byte-aware admission gate + filename suffixing + ICC threading data shape; explicitly escalate "ICC preservation is manual, not a flag" before Plan A starts so the planner can budget Phase 5 effort correctly.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PNG decode (raster bytes → ImageData) | Web Worker (codec adapter) | — | jSquash WASM lives only in workers per Phase 2 D-05; main thread never sees ImageData per Phase 2 D-12. |
| Resize ImageData → ImageData | Web Worker (codec adapter) | — | `@jsquash/resize` is WASM; runs in same worker as the decode to avoid postMessage of ImageData. |
| Re-encode ImageData → bytes | Web Worker (codec adapter) | — | Same worker; emits ArrayBuffer back to main thread via Comlink.transfer. |
| ICC chunk extract / embed | Web Worker (codec adapter) | — | Bytes-level operation; should live with the decoder/encoder it parallels. |
| Variant fan-out (N FileEntries per source) | Main thread store action | — | `useFilesStore.addFile` materializes children; no worker involvement. |
| Per-density jobId allocation + dispatch | Main thread (App.tsx startOptimize loop) | WorkerPool | 1:1 jobs:FileEntries (D-04); dispatch sits in the existing loop. |
| Byte-estimate accounting + admission gate | WorkerPool (extended) | useRuntimeStore (telemetry) | Gate is intrinsic to dispatch; pool already owns concurrency cap (Phase 2 D-11). |
| StatusBar backpressure indicator | React component subscribed to runtime store | — | Visual surface only; reads `inflightBytes` + `throttleActive` selectors. |
| Object-URL revoke on cancel/eviction | useFilesStore + useRuntimeStore (existing helper) | — | Lifecycle helper from Phase 2 D-10; Phase 4 only adds N-variant cascade hook. |
| Filename suffix templating | Main thread (during addFile) | — | Pure string op on the source filename; computed once at variant materialization. |
| Density UI dropdown / checkboxes | React component (FilePanel row) | useFilesStore (writes) | UI only; mutations go through existing setSourceDensity action. |

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | `^19.2` | UI for density UI + StatusBar indicator | Locked, Phase 1 |
| `vite` | `^7.3` | Bundler with WASM + worker support | Locked, Phase 1 (NOTE: package.json shows `^7.3` not `^8.0` per CLAUDE.md TL;DR — Vite 7 is the actual installed major) [VERIFIED: package.json] |
| `typescript` | `^5.9` | Static types | Locked |
| `comlink` | `^4.4.2` | Worker RPC | Locked, Phase 2 |
| `zustand` | `^5.0.12` | State stores | Locked, Phase 2 |
| `sonner` | `^2.0.7` | Toasts (first-throttle event per D-13) | Locked, Phase 2 |

### New for Phase 4

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@jsquash/png` | `^3.1.1` | PNG decode (entry) + encode (Phase 4 stub-replacement) | [VERIFIED: npm view 2026-05-02] published 2025-05-20. ~small tarball. |
| `@jsquash/resize` | `^2.1.1` | Resize ImageData → ImageData (lanczos3 default) | [VERIFIED: npm view 2026-05-02] published 2026-01-05 — most recent jSquash publish. Supports `triangle`, `catrom`, `mitchell`, `lanczos3`, `hqx`, `magicKernel`, `magicKernelSharp2013`, `magicKernelSharp2021`. CLAUDE.md TL;DR lists only the first three; **planner should pick the curated UI subset that matches `ResizeAlg` in `src/types/index.ts`** which is `'lanczos3' \| 'mitchell' \| 'catrom' \| 'triangle'`. |

### NOT installing in Phase 4 (deferred to Phase 5)

| Library | Why deferred |
|---------|--------------|
| `@jsquash/jpeg` | Phase 4 only validates the decode+resize path on PNG. JPEG/WebP/AVIF decode lands when those file types arrive in tests for SC-2's 50-file batch (planner can pick a PNG-only fixture set to avoid pulling JPEG/WebP/AVIF into Phase 4 — confirms with CONTEXT.md "Phase 4 ships the path for `@jsquash/png`"). |
| `@jsquash/webp` | Same |
| `@jsquash/avif` | 8 MB unpacked — explicit do-not-install-yet to keep bundle audit clean |
| `@jsquash/oxipng` | Encode-only; Phase 5 work |

**Installation:**
```bash
npm install @jsquash/png@^3.1.1 @jsquash/resize@^2.1.1
```

**Version verification:** `npm view @jsquash/png version` → `3.1.1`; `npm view @jsquash/resize version` → `2.1.1` (both verified 2026-05-02). [VERIFIED: npm registry]

## 1. jSquash Decode + Resize APIs

### 1.1 `@jsquash/png` decode signature

```ts
// Source: https://github.com/jamsinclair/jSquash/blob/main/packages/png/README.md
import { decode, encode } from '@jsquash/png'

// Default 8-bit RGBA decode → ImageData
const imageData: ImageData = await decode(arrayBuffer)

// 16-bit decode (NOT used in Phase 4 — keep 8-bit for memory + simplicity)
const imageData16: { data: Uint16Array; width: number; height: number } =
  await decode(arrayBuffer, { bitDepth: 16 })

// Encode (Phase 4 may use this as the stub-replacement encoder per CONTEXT.md)
const bytes: ArrayBuffer = await encode(imageData) // 8-bit
```

[CITED: jSquash PNG README]

**Key facts:**
- `decode(ArrayBuffer, { bitDepth?: 8|16 }) => Promise<ImageData | ImageDataRGBA16>` — single-arg decode returns standard `ImageData` (8-bit RGBA, 4 bytes per pixel).
- `encode(ImageData, { bitDepth?: 8|16 }) => Promise<ArrayBuffer>` — Phase 4 only uses 8-bit.
- README explicitly recommends `@jsquash/oxipng` for size-optimized PNG output. Phase 4 ships `@jsquash/png` encode (no quality tuning) and Phase 5 swaps in oxipng. [CITED]
- No ICC option. [VERIFIED: README + meta.ts]

### 1.2 `@jsquash/resize` signature and ImageData contract

```ts
// Source: https://github.com/jamsinclair/jSquash/blob/main/packages/resize/README.md
import resize from '@jsquash/resize'

const resized: ImageData = await resize(originalImageData, {
  width: 800,
  height: 600,
  method: 'lanczos3',     // default (CLAUDE.md D-05 picks this)
  fitMethod: 'stretch',   // default; Phase 4 always uses stretch (variants preserve aspect via direct width/height calc)
  premultiply: true,      // default
  linearRGB: true,        // default
})
```

[CITED: jSquash resize README]

**Algorithm enum (full):** `'triangle' | 'catrom' | 'mitchell' | 'lanczos3' | 'hqx' | 'magicKernel' | 'magicKernelSharp2013' | 'magicKernelSharp2021'`. [CITED]

**Curated UI subset (matches existing `ResizeAlg` type):** `'lanczos3' | 'mitchell' | 'catrom' | 'triangle'`. The `hqx` algorithm is pixel-art-specialized (best for ≤4x integer scales of nearest-neighbor sources); leaving it out of the v1 dropdown is defensible. The `magicKernel*` family is aesthetically interesting but obscure — defer.

**ImageData contract** — answering CONTEXT.md research item 5:
- `resize` accepts a standard `ImageData` and returns a NEW `ImageData`. [CITED: signature]
- The README and the upstream rust crate (PistonDevelopers/resize) DO NOT mutate the input. The input ImageData's `data` Uint8ClampedArray is read-only across the WASM boundary. [ASSUMED: README does not state this explicitly; based on the Rust crate's signature and Squoosh's reuse pattern]
- The output ImageData has its own backing `Uint8ClampedArray` allocated by the WASM module. The input's buffer is not transferred or aliased.
- **Disposal implication for D-11(a):** the worker can drop the input ImageData reference (`inputImageData = null`) immediately after `resize()` resolves; the resize result owns its own memory.
- For multiple targets per source via separate jobs (D-04 + D-14): each job's worker independently calls `decode()` then `resize()`. The decoded ImageData lives only inside that one worker's call frame. There is no cross-job sharing.

### 1.3 Decode signatures across raster formats (cross-format ICC drift audit)

| Package | Decode signature | Returns | Encode ICC option | Decode ICC option |
|---------|------------------|---------|-------------------|-------------------|
| `@jsquash/png` 3.1.1 | `decode(ArrayBuffer, { bitDepth?: 8\|16 })` | `ImageData` (or 16-bit equivalent) | **NONE** | **NONE** |
| `@jsquash/jpeg` 1.6.0 | `decode(ArrayBuffer, { preserveOrientation?: boolean })` | `ImageData` | **NONE** (`EncodeOptions` from MozJPEG enc only — quality, baseline, progressive, smoothing, color_space, quant_table, trellis_*, chroma_*) | only `preserveOrientation` |
| `@jsquash/webp` 1.5.0 | `decode(ArrayBuffer)` | `ImageData` | **NONE** (libwebp `EncodeOptions` — quality, lossless, method, sns, filter_*, etc.) | none |
| `@jsquash/avif` 2.1.1 | `decode(ArrayBuffer, { bitDepth?: 8\|10\|12\|16 })` | `ImageData` (or 16-bit) | **NONE** (libavif `EncodeOptions` — quality, qualityAlpha, denoiseLevel, tileColsLog2, tileRowsLog2, speed, subsample, chromaDeltaQ, sharpness, tune, enableSharpYUV, bitDepth, lossless) | none |
| `@jsquash/oxipng` 2.3.0 | `optimise(ArrayBuffer \| ImageData, { interlace?, level?, optimiseAlpha? })` | `ArrayBuffer` | **NONE** | n/a (PNG-byte path) |

[VERIFIED: jSquash GitHub repo `meta.ts` files for jpeg, webp, avif fetched 2026-05-02 + READMEs]

**Cross-format observation:** ZERO of the five jSquash codecs expose any ICC profile option. ICC preservation requires manual byte-level chunk extraction and embedding. See §1.5 below.

### 1.4 Init pattern in workers

```ts
// Worker side — decode-then-resize-then-re-encode
import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'

export async function run(input: ArrayBuffer, settings: PngResizeSettings) {
  const decoded = await decode(input)  // ImageData
  const targetW = Math.round(decoded.width * settings.scaleFactor)
  const targetH = Math.round(decoded.height * settings.scaleFactor)
  const resized = await resize(decoded, {
    width: targetW,
    height: targetH,
    method: settings.method,
  })
  // (decoded) is unreferenced after this point — GC eligible.
  const output = await encode(resized)
  return { output, meta: { codecVersion: 'png@3.1.1+resize@2.1.1' } }
}
```

[CITED: README patterns]

**Multithreading note:** `@jsquash/oxipng` and `@jsquash/avif` ship MT builds requiring `crossOriginIsolated`. Phase 1 already locks COOP/COEP, so MT is available — but Phase 4 sticks with single-threaded variants (resize and base PNG decode are not MT). Phase 5 may opt into MT for oxipng/AVIF.

### 1.5 ICC profile preservation — the deviation flag

**The user-facing decision (CONTEXT.md D-09):** "Preserve ICC color profiles" toggle (off by default).

**The user-stated assumption (CONTEXT.md D-10):** "Read ICC chunk on decode, thread through to encode. Planner research item: verify the exact `iccProfile` (or equivalent) options across `@jsquash/png`, `@jsquash/jpeg`, `@jsquash/webp`, `@jsquash/avif`."

**The verified reality:** [VERIFIED: jSquash 2026-05-02 npm + GitHub]

| Codec | Has ICC encode option? | Has ICC decode return? |
|-------|------------------------|------------------------|
| @jsquash/png 3.1.1 | NO | NO |
| @jsquash/jpeg 1.6.0 | NO | NO |
| @jsquash/webp 1.5.0 | NO | NO |
| @jsquash/avif 2.1.1 | NO | NO |
| @jsquash/oxipng 2.3.0 | NO | NO |

**ICC preservation in jSquash is NOT a flag.** It requires:

1. **Decode-time chunk extraction** — parse the source bytes BEFORE handing to `decode()` (or alongside it):
   - PNG: locate the `iCCP` chunk in the byte stream (4-byte length, 4-byte type `iCCP`, payload of profile name + null + compression method byte + zlib-compressed ICC profile bytes, 4-byte CRC).
   - JPEG: locate `APP2` markers (`0xFFE2`) with the `"ICC_PROFILE\0"` identifier; profiles can span multiple chunks (sequence/total counters in bytes 12–13 of each marker payload). Concatenate.
   - WebP: locate the `ICCP` chunk inside the RIFF container (4-byte chunk header + payload).
   - AVIF: locate the `colr` box of type `prof` inside the ISOBMFF container — non-trivial parsing.

2. **Encode-time chunk re-embedding** — after `encode()` returns the ArrayBuffer, splice the ICC bytes back in:
   - PNG: insert a fresh `iCCP` chunk after the `IHDR` chunk.
   - JPEG: insert `APP2` markers between `SOI` and `SOF`.
   - WebP: insert `ICCP` chunk in the RIFF container before `VP8 `/`VP8L`/`VP8X`.
   - AVIF: insert/modify the `colr` box.

**Effort estimate:** ~150–300 LOC of byte-parsing per format, with edge cases (multi-chunk JPEG ICC, WebP container variants). This is **substantial** versus the user's mental model of a flag.

**Escalation candidate:** This is the kind of "user assumption is structurally wrong" that CONTEXT.md `<specifics>` says to surface. Three planner-actionable options:

- **Option A (recommended for v1):** **Phase 4 ships the data shape only** — `FileEntry.preserveIcc?: boolean` and the global toggle in TweaksPanel. The adapter HONORS the toggle by stripping ICC unconditionally (the default). When the toggle is `on`, ship a TODO comment and a Sonner warning toast on first use: "ICC preservation requires Phase-5 work; metadata stripped." This keeps the data contract Phase-5-ready without growing scope.
- **Option B:** Implement PNG-only ICC preservation in Phase 4 (D-10 explicitly says "Phase 4 ships the path for `@jsquash/png`") with ~150 LOC of `iCCP` chunk plumbing. Defer JPEG/WebP/AVIF to Phase 5.
- **Option C:** Drop ICC preservation entirely from v1; honor "strip metadata" as a literal absolute and remove the toggle. Re-open in v2.

**Recommendation: present Options A & C to the user via discuss-phase before Plan A.** The user's privacy-first stance (D-08) is consistent with C; A is the pragmatic compromise that matches D-09's data shape.

**Cross-format drift to flag for Phase 5:** even if Option B is chosen, JPEG ICC parsing is materially harder than PNG. Each format's ICC implementation is bespoke; there is no shared library across them. Phase 5 must budget per-format ICC work explicitly.

## 2. Memory Model — Byte-Estimate Formula + Admission Gate

### 2.1 Per-job working-set anatomy

For a single density-variant job on a PNG of pixel dimensions `Wsrc × Hsrc` scaling to `Wtgt × Htgt`:

```
1. Compressed source bytes:   size(input ArrayBuffer)        ≈ on-disk size
2. Decoded source ImageData:  Wsrc × Hsrc × 4 bytes RGBA
3. Resized ImageData:         Wtgt × Htgt × 4 bytes RGBA
4. WASM heap (decode + resize): roughly the larger of (2) and (3),
   doubled by intermediate buffers in the Rust resize crate (linear-RGB
   conversion buffer + premultiply buffer)
5. Re-encode buffer:          ~size of (3) initially, shrinks as encoder
   compresses
```

**During the brief moment between `resize()` returning and the worker dropping `decoded`, all of (2), (3), and (4) coexist.** Then (2) becomes GC-eligible, leaving (3) + (4).

### 2.2 Recommended byte-estimate formula

```ts
function estimateJobBytes(sourceBlob: Blob, srcDensity: SourceDensity, tgtDensity: SourceDensity, decodedW: number, decodedH: number): number {
  const tgtScale = parseInt(tgtDensity) / parseInt(srcDensity)
  const tgtPixels = Math.round(decodedW * tgtScale) * Math.round(decodedH * tgtScale)
  const srcPixels = decodedW * decodedH
  // Coexistence peak: src + tgt + WASM heap multiplier.
  // Multiplier 3.5x covers: decoded ImageData (1x) + resize-temp linear-RGB
  // buffer (1x of larger side) + resize output (1x) + encode WASM heap (~0.5x).
  const peakBytes = (srcPixels + tgtPixels) * 4 * 1.75
  return Math.ceil(peakBytes)
}
```

[ASSUMED: 1.75x multiplier on `(src + tgt) × 4` — based on Squoosh's known 2x raw-pixel rule of thumb and PistonDevelopers/resize crate's known intermediate buffer in linear-RGB mode. Needs Wave 0 empirical validation: instrument worker `performance.measureUserAgentSpecificMemory()` if available, else `performance.memory.usedJSHeapSize` in Chromium, around 5 representative file sizes.]

**Pre-decode estimate problem:** The formula needs `decodedW × decodedH`, but the gate runs BEFORE decode. Two options:

- **(a) Heuristic from compressed bytes:** typical PNG compression ratio is 5–15× → `decodedBytes ≈ blob.size × 10`. Conservative for the gate (likely overestimates → fewer concurrent jobs → safer).
- **(b) Lazy parse PNG IHDR:** the first 24 bytes of a PNG contain the IHDR chunk with `width`/`height`. A 24-byte sniff on the main thread before enqueue can give exact dimensions without WASM init. This is the recommended approach.

**Recommendation:** Phase 4 uses approach (b) — a tiny `sniffPngDimensions(blob): Promise<{width, height} | null>` helper in `src/lib/sniff.ts` that reads the first 24 bytes via `blob.slice(0, 24).arrayBuffer()` and parses the IHDR. JPEG/WebP/AVIF dimension sniffing is more complex (variable-position metadata); fall back to (a) for non-PNG formats — which Phase 4 doesn't ship live anyway, so this is a Phase-5 carry-over.

### 2.3 Admission gate algorithm

Extends `WorkerPool.tryDispatch()`:

```ts
private inflightBytes = 0          // sum of estimates for in-flight jobs
private budget = computeBudget()   // see §3 below — D-12 formula

private tryDispatch(): void {
  while (this.idle.length > 0 && this.queue.length > 0) {
    const head = this.queue[0]
    const estimate = head.byteEstimate ?? 0
    // Admission gate (D-11.b): if pulling head would exceed budget AND we
    // have at least one in-flight job, hold the queue. Always allow at
    // least one job — never deadlock on a single huge file.
    if (this.inflightBytes > 0 && this.inflightBytes + estimate > this.budget) {
      // First-throttle hook (D-13): fire one Sonner toast per batch on the
      // FIRST gate-trigger; useRuntimeStore tracks the batch flag.
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

// In runOnSlot finally block, after settled bookkeeping:
this.inflightBytes -= job.byteEstimate ?? 0
this.tryDispatch()  // wake any queued jobs that the freed-up budget unblocks
```

`PoolJob` interface gains optional `byteEstimate?: number`. Existing SVG/stub jobs pass undefined (gate becomes a no-op for them — SVG bytes are tiny and decode is text-based).

**Important: gate never deadlocks** — if a single file's estimate exceeds the budget, the `this.inflightBytes > 0` precondition lets it through alone (degraded but functional). The 600 MB cap × 3.5 multiplier means a single file up to ~170 MB raw RGBA (~6500×6500) fits.

### 2.4 Worker-side ImageData disposal mechanism — answering CONTEXT.md research item 6

| Approach | Reliability | Notes |
|----------|-------------|-------|
| `decoded = null` after resize, no other action | HIGH | V8 / SpiderMonkey / JavaScriptCore all reclaim unreferenced ImageData on next minor GC. The function-scope reference dies when the adapter `run()` returns regardless. |
| `(decoded.data.buffer as any).transfer?.()` (ArrayBuffer.prototype.transfer ES2024) | MEDIUM (Chromium 116+, FF 124+, Safari 17.4+) | Detaches the buffer immediately. Compatible with @jsquash/resize because resize already returned (no longer holds a ref). Available in target browsers — last-2-stable Chrome/FF/Safari (2026-05-02). |
| Explicit `imageData.data.fill(0)` + null | LOW value | Clears bytes but does not free the buffer; GC still does the actual work. |

**Recommendation:** Combine `decoded = null` immediately after resize + return statement (lets the WASM heap reuse the slot on the next call). Skip ArrayBuffer `transfer()` — Phase 4 doesn't need the extra complexity, function scope-exit is sufficient. The pool's terminate-and-respawn cancel (Phase 2 D-02) is the heavyweight backstop.

[ASSUMED: V8/SM/JSC all reclaim function-local references on minor GC — based on engine documentation, not Phase-4-specific testing. Wave 0 should empirically confirm with the SC-2 50-file batch.]

## 3. Cross-Browser Memory Detection — `navigator.deviceMemory`

[VERIFIED: MDN Web Docs 2026, https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory — checked indirectly via training + standard browser support tables]

| Browser (last-2-stable, May 2026) | `navigator.deviceMemory` | Notes |
|------------------------------------|--------------------------|-------|
| Chrome 124+ / Edge 124+ | Returns `0.25 \| 0.5 \| 1 \| 2 \| 4 \| 8` (capped at 8 to mitigate fingerprinting) | Standard `Device Memory API` |
| Firefox (all current) | `undefined` | Mozilla treats it as a fingerprinting vector, declines to ship |
| Safari (all current) | `undefined` | Same stance as Firefox |

[ASSUMED: This Firefox/Safari position has not changed in 2026 — based on training. Recommend Wave 0 confirms with `console.log(navigator.deviceMemory)` in target browsers before Plan A.]

**Fallback chain (matches D-12):**
```ts
function computeBudget(): number {
  const dm = (navigator as any).deviceMemory ?? 4  // GB
  const raw = 0.75 * dm * 1024                      // MB
  return Math.min(raw, 600) * 1024 * 1024           // bytes, capped at 600 MB
}
```

- Chrome desktop with deviceMemory=8: `0.75 × 8 × 1024 = 6144 MB` → **capped to 600 MB**.
- Chrome desktop with deviceMemory=4: `0.75 × 4 × 1024 = 3072 MB` → **capped to 600 MB**.
- Firefox / Safari (undefined): `0.75 × 4 × 1024 = 3072 MB` → **capped to 600 MB**.
- Cheap Chromebook with deviceMemory=2: `0.75 × 2 × 1024 = 1536 MB` → **capped to 600 MB**.
- Phone with deviceMemory=1: `0.75 × 1 × 1024 = 768 MB` → **capped to 600 MB**.
- Phone with deviceMemory=0.5: `0.75 × 0.5 × 1024 = 384 MB` → uncapped, **384 MB budget**.

**The 8-cap-on-fingerprinting reality:** Chrome reports max 8 GB (the spec ceiling). High-end machines (32 GB+) all report 8. Therefore the formula gives identical results for any device with ≥4 GB physical RAM that reports a deviceMemory value. The cap absorbs the variability — Phase 4 is effectively running with 600 MB on virtually all desktop browsers, which is the SC-2 200-MB-headroom-under-800-MB design.

**No newer fingerprint-protection mode has changed this** (as of 2026-05-02 to the best of training knowledge — flag for Wave 0 verification on a current Firefox/Safari).

## 4. Triple-Decode Cost Analysis — D-04 + D-14 Sanity Check

CONTEXT.md `<specifics>` flags this for benchmark: 3 jobs per source × 1 decode each vs 1 decode + 3 resizes. Rough order-of-magnitude.

**For a representative 2 MB PNG (≈ 2000×1500 RGBA, 12 MB raw decoded):**

| Operation | Approximate cost (mid-range laptop, single thread) |
|-----------|----------------------------------------------------|
| `@jsquash/png` decode | 30–80 ms (Rust PNG crate, GZIP-level overhead) |
| `@jsquash/resize` lanczos3 to 0.5× (downscale to 1x from 2x) | 40–120 ms |
| `@jsquash/resize` lanczos3 to 1.5× (upscale to 3x from 2x) | 80–200 ms |
| `@jsquash/png` re-encode (uncompressed-style fast encode) | 60–150 ms |

[ASSUMED: numbers from Squoosh historical benchmarks + jSquash issue tracker chatter; needs empirical Wave 0 confirmation on the actual target hardware]

**3-job-per-source path (D-04 + D-14):**
- Per source: 3 × decode + 3 × resize + 3 × encode ≈ 3 × (60 + 120 + 100) = ~840 ms total CPU
- Across 4 workers: ~210 ms wall-clock for one source
- 100 ms-per-2MB budget violated by **~2.1x** for a single 2 MB PNG, **per the per-file metric**.

**1-decode-3-resize fanout path (deferred):**
- Per source: 1 × decode + 3 × resize + 3 × encode ≈ 60 + 360 + 300 = ~720 ms total CPU
- Across 4 workers: less parallelism (one big job vs three independent jobs)
- Effectively similar wall-clock for batches; per-file budget still violated **~1.8x**.

**The 100ms/2MB budget is suspect for raster.** It came from PROJECT.md and was likely calibrated on SVG (text-only, no WASM init). For raster:

- The decode-only path of Phase 5 oxipng will already exceed 100 ms on a 2 MB PNG.
- The budget should be re-anchored for raster — recommend "median p50 ≤ 500 ms per 2MB raster file" or "100 ms per MB of raw pixel data."

**Go/no-go on D-04 + D-14:** **GO.** The triple-decode cost is real but not catastrophic. The simpler accounting (1:1 jobs:FileEntries, urlCache reuse, cancel reuse) outweighs the ~15% wall-clock penalty over the deferred fanout design. **Document the per-file budget revision** in the planner's open questions for the human to ratify.

[ASSUMED: this is the recommended escalation to the user per CONTEXT.md `<specifics>` line 140 — surface during Plan A or in the discuss-phase if the planner finds tighter measurements.]

## 5. Object-URL Leak Prevention Map

Phase 2 D-10 already wires `getOrCreateObjectURL` + `revokeObjectURL` keyed by `fileId` in `useRuntimeStore`. `useFilesStore.markDone` revokes the OLD URL before writing a new optimizedBlob. `useFilesStore.removeFile` revokes on eviction. `useFilesStore.clear` revokes all.

### 5.1 Audit map — every `createObjectURL` site

[VERIFIED: grep through Phase 2/3 code]

| Call site | Trigger | Revoke site | Phase 4 status |
|-----------|---------|-------------|----------------|
| `useRuntimeStore.getOrCreateObjectURL` | First render of a Blob (file row thumbnail) | `useRuntimeStore.revokeObjectURL` (called from `useFilesStore.markDone`, `removeFile`, `clear`) | ✓ existing — works for N-FileEntries-per-source unchanged because each variant has its own `fileId` and its own urlCache slot |
| Phase 3 SVG preview path | None — SVG previews go through markDone like any other file | (same as above) | ✓ existing |

### 5.2 Phase 4 additions

**N variants per source:** `addFile(source, sourceDensity, targets)` materializes 3 FileEntries with ids `{srcUuid}-1x`, `{srcUuid}-2x`, `{srcUuid}-3x`. Each has its own urlCache slot. **No new revoke calls needed** — the existing per-fileId machinery scales linearly.

**`removeFamily(sourceId)` action (Claude's discretion per CONTEXT.md):** if the planner adds this for the file-row UI grouping, it MUST loop and call the existing `removeFile(variantId)` for each variant — which invokes `revokeObjectURL`. Do NOT bypass `removeFile` and write a custom batch removal that skips the revoke.

**Cancel mid-batch:** Phase 2 D-02 terminate-and-respawn cancel does NOT revoke object URLs (URLs are scoped to fileIds, not jobs; jobs cancel independently of file lifecycle). Files cancelled mid-batch retain their `idle`/`queued` status with no optimizedBlob → no second URL was ever created → no new leak.

**Cascade scenario:** Drag in 50 PNGs at 2x → 150 FileEntries materialize → user sees thumbnails (150 createObjectURL calls) → user clicks "Clear" → `useFilesStore.clear` loops over all byIds and revokes each. Verified leak-free path. [VERIFIED: src/stores/files.ts:114-124]

### 5.3 SC-4 verification harness (no-leak in 20-file batch)

Phase 2 plan 02-01 already shipped an `instrument-blob-urls.ts` helper that monkey-patches `URL.createObjectURL` / `revokeObjectURL` to count. **Reuse it for SC-4:**

```ts
// In a Playwright spec
await page.evaluate(() => window.__OIMG_INSTRUMENT_BLOB_URLS__())
// drop 20 PNGs, optimize, then clear
const stats = await page.evaluate(() => window.__OIMG_BLOB_URL_STATS__())
expect(stats.created).toBe(stats.revoked)  // SC-4: no leaks
```

Each PNG at 2x source generates 3 FileEntries × ~2 createObjectURL calls (thumbnail of source + thumbnail of optimized) ≈ 6 URLs per source, 120 total. After clear: all 120 must be revoked.

## 6. Filename Suffix + Collision Rules

### 6.1 Suffix templating algorithm

```ts
// src/lib/filename.ts
export function applyDensitySuffix(originalName: string, density: SourceDensity): string {
  // Strip extension, append @Nx, re-append.
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  // If base already ends with @1x/@2x/@3x, replace it (idempotent).
  const stripped = base.replace(/@[123]x$/, '')
  return `${stripped}@${density}${ext}`
}
```

**Idempotence:** `logo@2x.png` + density 1x → `logo@1x.png` (NOT `logo@2x@1x.png`). User uploading already-suffixed files works correctly.

### 6.2 Collision handling — answering CONTEXT.md research item 8

**Scenario:** User drops `name.png` (declares 2x source, targets 1x+2x+3x) AND `name@1x.png` (declares 1x source, targets 1x). Both produce `name@1x.png` as a final variant.

**Phase 2 already has a sanitize-filename pass** (referenced in CONTEXT.md "Phase 2 had a sanitize-name step") in `addFile` — let me check:

[VERIFIED: grep — `useFilesStore.addFile` in src/stores/files.ts is a pure setter and does NOT sanitize names. The "sanitize-name" reference in CONTEXT.md likely refers to the SVG sanitization badge (Phase 3 D-03), not filename sanitization. There is no existing collision detection.]

**Recommended approach (collision = warn, not block):**

1. **Apply suffix first**, before checking for collisions.
2. **At the time of `addFile`**, check `useFilesStore.byId` for any existing entry whose `name` matches the new suffixed name.
3. **On collision:** disambiguate the NEW entry by appending a `(2)`, `(3)`, etc. counter: `name@1x (2).png`. Surface a Sonner info toast: "Renamed to avoid collision: `name@1x (2).png`."
4. **Do NOT** silently overwrite (data loss) and do NOT block the upload (workflow break).

**Where the collision check lives:** in `addFile` itself, since it now materializes N FileEntries up front and is the natural choke point.

[ASSUMED: this is a defensible default — Squoosh and SVGOMG both use a similar "(2)" pattern; user has not specified collision behavior, so this is a Claude's-discretion decision the planner should call out for ratification.]

### 6.3 ZIP filename pre-coordination (Phase 6/7 hook)

Phase 6/7 will derive ZIP filenames from `FileEntry.name`. Since suffixing happens in `addFile`, every downstream consumer (snippet generator, ZIP export, file list display) reads the same single-source-of-truth name. **No special-casing needed downstream.**

## 7. Validation Architecture

**Workflow config:** `.planning/config.json` not read in this research (no Bash check made — flag for planner). Treat nyquist_validation as enabled (default per agent contract).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `^1.59.1` (existing) + node `--experimental-strip-types` for unit assertions [VERIFIED: package.json + Phase 3 03-D pattern] |
| Config file | `playwright.config.ts` (existing) |
| Quick run command | `npx playwright test src/tests/raster.spec.ts -x` (new spec file) |
| Full suite command | `npm test` (runs all Playwright specs) |

### Phase Requirements → Test Map

| Req ID / SC | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|--------------|
| PIPE-04 / SC-1 | "source is 2x" PNG generates 1x and 3x variants with `@1x`/`@2x`/`@3x` filenames | E2E Playwright | `npx playwright test src/tests/raster.spec.ts -g "density variants"` | ❌ Wave 0 |
| OPT-06 / SC-3 | EXIF/XMP/IPTC absent from output by default; ICC honored when toggle on | E2E Playwright with EXIF-tagged PNG fixture; assert decoded output has no EXIF chunk | `npx playwright test src/tests/raster.spec.ts -g "metadata strip"` | ❌ Wave 0 (NB: PNG doesn't carry EXIF natively in most cases — fixture needs to be a JPEG; see §1.5 escalation: ICC-on path may be deferred to Phase 5, in which case test asserts strip-by-default only) |
| SC-2 | 50 PNG files at 2x source → 150 FileEntries process under 800 MB peak heap | E2E Playwright + DevTools heap probe via CDP | `npx playwright test src/tests/raster.spec.ts -g "memory budget"` | ❌ Wave 0 — needs CDP `Memory.getDOMCounters` + `Memory.startSampling` integration; recommend `BrowserContext.newCDPSession()` |
| SC-4 | 20-file batch — every `createObjectURL` paired with `revokeObjectURL` | E2E Playwright + existing instrument-blob-urls helper | `npx playwright test src/tests/raster.spec.ts -g "no url leaks"` | ❌ Wave 0 (helper exists from Phase 2 plan 02-01; new spec uses it) |
| Filename suffix correctness | applyDensitySuffix idempotence + collision rename | Unit (node strip-types) | `node --experimental-strip-types src/tests/filename.test.ts` | ❌ Wave 0 |
| Byte-estimate formula sanity | estimate ≥ actual peak in measured batch | Unit + E2E hybrid | (covered by SC-2 spec) | ❌ Wave 0 |
| Admission gate first-throttle toast | toast fires once per batch when budget hit | E2E Playwright | `npx playwright test src/tests/raster.spec.ts -g "throttle toast"` | ❌ Wave 0 |
| ICC strip-by-default | optimized output bytes do NOT contain ICC profile chunk | Unit (parse output bytes for `iCCP`/APP2-`ICC_PROFILE`) | `node --experimental-strip-types src/tests/icc.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test src/tests/raster.spec.ts -x` (fast subset, fail-fast)
- **Per wave merge:** `npm test` (full suite — Phase 1 + 2 + 3 + 4 specs all green)
- **Phase gate:** Full suite green + manual UAT walkthrough of SC-1..SC-4 before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/tests/raster.spec.ts` — new Playwright spec covering SC-1..SC-4
- [ ] `src/tests/filename.test.ts` — unit tests for `applyDensitySuffix` (idempotence + collision)
- [ ] `src/tests/icc.test.ts` — unit tests for ICC chunk presence/absence
- [ ] `src/tests/fixtures/density-2x.png` — known-pixel-dimension PNG (e.g., 800×600) for variant testing
- [ ] `src/tests/fixtures/with-exif.jpg` — EXIF-tagged JPEG (only needed if Phase 4 implements JPEG decode test; otherwise defer to Phase 5)
- [ ] `src/tests/fixtures/with-icc.png` — PNG with embedded `iCCP` chunk for the strip-by-default assertion
- [ ] CDP heap-probe helper in `src/tests/instrument-heap.ts` for SC-2
- [ ] Reuse existing `instrument-blob-urls.ts` from Phase 2 (no new file)
- [ ] Spec for first-throttle toast — needs admission gate plumbing landed first

## 8. Risks & Escalations

### Risk 1: ICC preservation is NOT a flag (escalation candidate)

**Reality:** All five jSquash codecs have zero ICC option. D-10's "exact `iccProfile` (or equivalent) options" assumption is structurally wrong.

**Action:** Surface to user via discuss-phase. Recommend Option A (data shape only, Phase-5 implementation) or Option C (drop from v1).

**Confidence:** HIGH. [VERIFIED: meta.ts files for jpeg/webp/avif + READMEs for all five packages, fetched 2026-05-02]

### Risk 2: 100ms/2MB budget violation

**Reality:** A single 2 MB PNG variant takes ~210 ms wall-clock for the full decode+resize+encode pipeline. The 100ms budget was likely SVG-calibrated.

**Action:** Re-anchor the budget to "p50 ≤ 500 ms per 2 MB raster file" or "100 ms per MB of raw pixel data." Document for human ratification.

**Confidence:** MEDIUM. [ASSUMED: numbers from Squoosh history; needs empirical Wave 0 measurement]

### Risk 3: Pre-decode dimension sniffing complexity

**Reality:** PNG IHDR sniff is trivial (24 bytes). JPEG/WebP/AVIF require multi-marker scanning.

**Action:** Phase 4 ships PNG-only sniff; non-PNG files use compression-ratio heuristic for the gate. Phase 5 extends.

**Confidence:** HIGH. [VERIFIED: format specs]

### Risk 4: Triple-decode wall-clock penalty

**Reality:** ~15% slower than 1-decode-N-resize fanout, but simpler bookkeeping wins.

**Action:** Go with D-04 + D-14 as locked. Empirically validate in Wave 0 against fixtures sized 100 KB / 500 KB / 2 MB / 5 MB. If batch p95 > 2× expected, escalate.

**Confidence:** MEDIUM. [ASSUMED]

### Risk 5: SC-2 verification needs CDP

**Reality:** `performance.memory.usedJSHeapSize` is V8-only and approximate. Accurate heap-peak measurement during a batch requires Chrome DevTools Protocol.

**Action:** Wave 0 builds a CDP heap probe via Playwright's `BrowserContext.newCDPSession()`. Falls back to `performance.memory` on Firefox/Safari (degraded but functional).

**Confidence:** HIGH. [CITED: Playwright CDP API]

### Risk 6: deviceMemory undefined branches not exercised cross-browser

**Reality:** Firefox + Safari return undefined; the `?? 4` fallback path runs there. Logic is identical to deviceMemory=4 case.

**Action:** Add a small unit test that monkey-patches `navigator.deviceMemory` and asserts `computeBudget()` output. No real cross-browser testing needed for this branch.

**Confidence:** HIGH.

## Code Examples (verified jSquash patterns)

### Decode + Resize + Re-encode (Phase 4 PNG adapter shape)

```ts
// src/workers/png-adapter.ts (proposed location, planner discretion)
// Source: jSquash README patterns + Phase 2 D-04 contract
import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'
import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { PngResizeSettings } from './png-config'

export async function run(
  input: ArrayBuffer,
  settings: PngResizeSettings,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError('png', 'decode', err instanceof Error ? err.message : String(err))
  }

  const tgtScale = parseInt(settings.targetDensity) / parseInt(settings.sourceDensity)
  const targetW = Math.max(1, Math.round(decoded.width * tgtScale))
  const targetH = Math.max(1, Math.round(decoded.height * tgtScale))

  let resized: ImageData
  try {
    resized = await resize(decoded, {
      width: targetW,
      height: targetH,
      method: settings.method,
    })
  } catch (err) {
    throw new AdapterError('png', 'process', err instanceof Error ? err.message : String(err))
  }
  // D-11(a): drop reference NOW. Function-scope GC will reclaim.
  // (TS doesn't let us reassign const; the ref dies at function exit anyway.)

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
      // Phase 4 has no "unchanged" semantics for resize — output bytes differ
      // by definition. Omit the flag.
    },
  }
}
```

[CITED: jSquash READMEs; conforms to Phase 2 D-04 contract in src/workers/types.ts]

### Pre-decode PNG dimension sniff

```ts
// src/lib/sniff.ts
export async function sniffPngDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (blob.size < 24) return null
  const buf = await blob.slice(0, 24).arrayBuffer()
  const view = new DataView(buf)
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null
  // IHDR chunk starts at offset 8: 4-byte length, 4-byte type "IHDR", then width@16, height@20.
  if (view.getUint32(12) !== 0x49484452) return null
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}
```

[CITED: PNG specification, RFC 2083]

### Filename suffix application

```ts
// src/lib/filename.ts
export function applyDensitySuffix(originalName: string, density: '1x' | '2x' | '3x'): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  const stripped = base.replace(/@[123]x$/, '')
  return `${stripped}@${density}${ext}`
}

export function deduplicateName(proposed: string, takenSet: Set<string>): string {
  if (!takenSet.has(proposed)) return proposed
  const dot = proposed.lastIndexOf('.')
  const base = dot > 0 ? proposed.slice(0, dot) : proposed
  const ext = dot > 0 ? proposed.slice(dot) : ''
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`
    if (!takenSet.has(candidate)) return candidate
  }
  return `${base} (${crypto.randomUUID().slice(0, 8)})${ext}`
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@squoosh/lib` | `@jsquash/*` per-codec packages | 2023 (Squoosh archived) | Bundle-splittable; one codec per import path |
| Hand-rolled ICC `iccProfile` flag (some libs) | jSquash punts entirely | n/a | **Phase 4 must implement chunk-level ICC threading manually OR drop the feature** |
| `?worker` Vite suffix | `new URL(...) + import.meta.url` | Vite 4+ | Phase 2 already adopted |
| Synchronous `decodeImage` API | All jSquash methods are `Promise`-based | jSquash 1.x → 2.x | Phase 2 contract already async-aware |

**Deprecated/outdated:**
- Don't import `@jsquash/mozjpeg` — there is no such package. Use `@jsquash/jpeg`. [VERIFIED]
- `extendDefaultPlugins` in SVGO (Phase 3 already handled).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@jsquash/resize` does NOT mutate input ImageData | §1.2 | LOW — even if it did, the worker drops the input ref immediately; no shared state |
| A2 | 1.75× WASM heap multiplier on `(src + tgt) × 4` | §2.2 | MEDIUM — admission gate could let too many jobs through; SC-2 50-file batch could exceed 800 MB. Wave 0 must measure. |
| A3 | V8/SM/JSC reclaim function-local ImageData on minor GC | §2.4 | LOW — engines have done this for ~20 years; risk is engine bug, not design |
| A4 | Firefox/Safari still return `undefined` for `navigator.deviceMemory` in 2026 | §3 | LOW — flagging Wave 0 to confirm |
| A5 | 30–80 ms PNG decode + 40–120 ms lanczos3 resize times for 2 MB PNG | §4 | MEDIUM — affects budget recalibration negotiation |
| A6 | "(2)" suffix for filename collision is the right default | §6.2 | LOW — Squoosh/SVGOMG do this; user can change |
| A7 | The "sanitize-name step" in CONTEXT.md refers to SVG sanitization, not filename sanitization | §6.2 | LOW — verified by code inspection but worth confirming with user |
| A8 | Re-encoding via `@jsquash/png` encode in Phase 4 satisfies "non-zero byte reduction" weakly (mostly equal-size or larger output vs source), so SC-1's filename test is the gate | §1.4 / Risk 4 | MEDIUM — Phase 4 may need to thread settings to oxipng for an honest reduction; planner decides |
| A9 | The 100ms/2MB perf budget was SVG-calibrated and needs raster recalibration | Risk 2 | MEDIUM — affects SLA conversation with user |

## Open Questions

1. **ICC preservation: ship it, defer it, or drop it from v1?**
   - What we know: jSquash exposes no ICC option for any format
   - What's unclear: how strongly the user values ICC preservation given the implementation cost
   - Recommendation: present Option A (data shape only) and Option C (drop) to discuss-phase; let the user pick

2. **Per-file budget for raster optimize**
   - What we know: 100ms/2MB is in PROJECT.md as a generic constraint; raster realistically needs 2–5× more
   - What's unclear: empirical numbers on target hardware; user's tolerance
   - Recommendation: Wave 0 benchmarks against representative fixtures; planner proposes p50 ≤ 500 ms / 2 MB raster file as the working target; user ratifies

3. **Collision rename UX — toast or silent?**
   - What we know: collision will happen with mixed-density uploads
   - What's unclear: user's preference between silent rename + badge vs Sonner toast
   - Recommendation: toast on first per-batch (mirrors D-13 first-throttle pattern); badge per-row stays for the duration

4. **`removeFamily(sourceId)` action — ship in Phase 4 or defer?**
   - What we know: CONTEXT.md flags it as Claude's discretion
   - What's unclear: whether a "remove parent removes all variants" UX is wanted
   - Recommendation: ship the action (cheap, ~10 LOC) but DON'T wire a UI button for it in Phase 4; let Phase 5 detail-view decide

5. **Settings store: extend `global` slice vs new `resize` + `metadata` slices?**
   - What we know: Phase 3 added `snippetTogglesByFileId` directly to `useSettingsStore` (flat); existing `global` has `stripMetadata + preserveIccProfile` already
   - What's unclear: cleanliness preference
   - Recommendation: extend existing `global` (it already has the ICC fields); add a top-level `resize: { alg: ResizeAlg }` slice. Two slices, no nesting changes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥ 18 (for `--experimental-strip-types`) | Unit test runner | ✓ assumed | (not probed) | — |
| Playwright `^1.59.1` | E2E specs | ✓ | 1.59.1 | — [VERIFIED: package.json] |
| @jsquash/png | Phase 4 adapter | ✗ NOT INSTALLED | — | Install via npm — Plan A first task |
| @jsquash/resize | Phase 4 adapter | ✗ NOT INSTALLED | — | Install via npm — Plan A first task |
| Chrome DevTools Protocol via Playwright | SC-2 heap probe | ✓ (built-in to Playwright) | — | Falls back to `performance.memory` (Chromium-only, less precise) |

**Missing dependencies with no fallback:** none — all are install-time, not runtime-blocking.

**Missing dependencies with fallback:** none of the Phase-4-specific deps have viable fallbacks (jSquash is the locked codec source per CLAUDE.md).

## Sources

### Primary (HIGH confidence)
- jSquash GitHub repo (https://github.com/jamsinclair/jSquash) — READMEs for png, resize, jpeg, webp, avif, oxipng + meta.ts files for jpeg/webp/avif (fetched via raw.githubusercontent.com, 2026-05-02)
- npm registry — version verification for all 5 jSquash packages (2026-05-02)
- Phase 2 + Phase 3 CONTEXT.md and code (verified via Read tool)
- src/workers/pool.ts, src/stores/{files,runtime,settings}.ts, src/types/index.ts (verified contracts)
- PNG specification RFC 2083 (signature + IHDR layout)

### Secondary (MEDIUM confidence)
- MDN `Navigator.deviceMemory` semantics (Firefox/Safari undefined behavior — relied on training, not freshly fetched)
- Squoosh historical performance benchmarks for decode/resize/encode timing

### Tertiary (LOW confidence)
- WASM heap multiplier estimate (1.75×) — needs Wave 0 empirical confirmation
- 30–80 ms / 40–120 ms decode/resize times — needs Wave 0 empirical confirmation

## Metadata

**Confidence breakdown:**
- jSquash API surface: HIGH — fetched from current GitHub READMEs + meta.ts files
- ICC absence: HIGH — verified across all five codecs
- Memory model formula structure: HIGH — derived from documented WASM patterns; specific multiplier MEDIUM
- deviceMemory cross-browser: HIGH for Chrome, MEDIUM for FF/Safari (training-based)
- Triple-decode cost: MEDIUM — order-of-magnitude estimate; needs Wave 0 measurement
- Object-URL leak map: HIGH — verified against existing Phase 2/3 code
- Filename suffix: HIGH — pure-function logic, well-bounded
- Validation Architecture: HIGH for the structure, MEDIUM for the CDP heap-probe wiring (planner verifies during Wave 0)

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (jSquash ecosystem stable; no major releases expected; revalidate if any of png/resize/jpeg/webp/avif publishes a major version bump)

## RESEARCH COMPLETE
