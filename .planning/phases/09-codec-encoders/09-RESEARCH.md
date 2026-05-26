# Phase 9: Codec Encoders — Research

**Researched:** 2026-05-26
**Domain:** jSquash WASM encode/decode APIs, svgo v4 browser ESM, per-file nanostores state, Comlink transfer, live re-encode debounce
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Per-file settings — each file owns codec, q, method, lossless, resize, metadata, svgo plugins. Global `settingsAtom` refactored to default + "Apply to all" model.
- **D-02:** Global settings panel = defaults for new files + explicit "Apply to all" bulk action. No longer single source of truth.
- **D-03:** Inspector edits the selected file's own settings only.
- **D-04:** Format selection is real conversion: source decoded via jSquash, then re-encoded to chosen target.
- **D-05:** Editing inspected file's settings debounce-re-encodes that file only; live before/after delta via CompareStage/DeltaStrip.
- **D-06:** Changing global/default panel does NOT live-re-encode the batch; batch re-encodes on explicit "Apply to all" only.
- **D-07:** Per-file live re-encode debounced ~250–350ms.
- **D-08:** svgo v4 runs INSIDE the codec worker, lazy-imported like raster codecs.
- **D-09:** svgo config = `preset-default` + `overrides`; SvgoPanel curated toggles drive overrides.
- **D-10:** Single-image resize via `@jsquash/resize` applied BEFORE encode.
- **D-11:** 1×/2×/3× density variants deferred.
- **D-12:** strip-metadata default ON; keepIcc is opt-in. Per-codec EXIF/ICC mapping is research to nail.
- **D-13:** Encode failure → per-file error state + sonner toast + keep original bytes as fallback.

### Claude's Discretion
- Where per-file settings physically live (extend `filesAtom` per-file vs separate keyed map).
- Debounce interval for live re-encode (D-07, ~250–350ms).
- Decode-once caching strategy for live re-encode perf.
- Exact mapping of each inspector control to each jSquash encoder option.

### Deferred Ideas (OUT OF SCOPE)
- 1×/2×/3× density variants.
- Batch ZIP export (jszip).
- Output panel snippets wired to real encoded bytes (SNIP-01).
- Fully-live batch re-encode on every global setting change.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENC-01 | PNG via OxiPNG (decode @jsquash/png → re-encode) produces real reduced-size output | `optimise(imageData, {level})` confirmed; level 0–6, default 2; accepts ImageData or ArrayBuffer |
| ENC-02 | WebP encode/convert with quality and lossless controls | `encode(imageData, {quality, lossless})` verified from meta.js; quality 0–100, lossless 0/1 |
| ENC-03 | JPEG (MozJPEG) encode/convert with quality and progressive controls | `encode(imageData, {quality, progressive})` verified; progressive: true by default |
| ENC-04 | AVIF (lazy-loaded) encode/convert with quality control | `encode(imageData, {quality, lossless})` verified; lazy-import critical (~8MB WASM) |
| ENC-05 | SVG via svgo v4 with inspector plugin toggles applied | `optimize(svgString, {plugins:[{name:'preset-default',params:{overrides}}]})` from svgo README |
| ENC-06 | Inspector settings (quality, effort, lossless, resize, strip-metadata) drive real encode output per codec | All option mappings verified against meta.js; resize via `@jsquash/resize` before encode |
</phase_requirements>

---

## Summary

Phase 9 replaces the Phase 8 stubs with real encoding logic across the full jSquash + svgo surface. The core engineering challenge is threefold: (1) wiring every inspector control to the correct jSquash encoder option inside the codec worker, (2) refactoring the global `settingsAtom` into per-file settings that follow the Squoosh per-image model, and (3) establishing a decode-once + live-re-encode path for the inspected file.

All required packages are already installed in node_modules (`@jsquash/png`, `@jsquash/oxipng`, `@jsquash/jpeg`, `@jsquash/webp`, `@jsquash/avif`, `@jsquash/resize`, `svgo@4.0.1`). No new packages are needed. The Phase 8 `WorkerPool` / `codec.worker.ts` / `useOptimize.ts` pipeline contract is the integration seam — every adapter lands in the existing `switch(job.codec)`.

The Phase 8 code review (08-REVIEW.md) identified three issues that Phase 9 MUST fold in during the real-bytes wiring: CR-01 (`setJobCounts` read-modify-write race — fix to `setKey`), WR-03 (missing `Comlink.transfer` on input and result buffers), and WR-02 (the 0-byte guard in the worker). These are low-effort fixes that land naturally when the real encode path is added.

**Primary recommendation:** Implement in waves: (1) fix Phase 8 bugs (CR-01, WR-02, WR-03) + add per-file settings shape to filesAtom, (2) implement PNG/WebP/JPEG adapters + wiring, (3) AVIF adapter (lazy), (4) svgo adapter in worker, (5) wire inspector controls + debounced live re-encode hook.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Codec decode → encode (WASM) | Web Worker (codec.worker.ts) | — | CPU-bound WASM; same worker switch already established Phase 8 |
| Format conversion (any-to-any) | Web Worker | — | Decode source with matching decoder, encode to target; pure buffer transform |
| svgo v4 optimize | Web Worker (codec.worker.ts) | — | D-08: consistent off-thread model, lazy-import alongside raster codecs |
| Resize (before encode) | Web Worker | — | D-10: `@jsquash/resize` runs inside worker on decoded ImageData before encode |
| Per-file settings state | Main thread (filesAtom) | — | nanostores map; per-file settings keyed by file id extend FileEntry |
| Per-file error state | Main thread (filesAtom) | — | D-13: error flag + message per FileEntry for UI + sonner |
| Debounce + live re-encode trigger | Main thread (useOptimize / useLiveEncode hook) | — | debounce 250–350ms; dispatches single-file job to pool |
| Global defaults / "Apply to all" | Main thread (settingsAtom) | — | D-02: settingsAtom becomes a template, not live config for all files |
| Comlink transfer | Main thread (pool.run) + Worker | — | Transfer ArrayBuffer both directions to avoid structured-clone copy |

---

## Standard Stack

### Core (all already installed — no new packages)
| Library | Installed Version | Purpose | Source |
|---------|------------------|---------|--------|
| `@jsquash/png` | 3.1.1 | Decode PNG → ImageData (feeds OxiPNG, and any PNG→X conversion) | [VERIFIED: node_modules] |
| `@jsquash/oxipng` | 2.3.0 | Re-encode/optimize PNG; accepts ImageData or raw ArrayBuffer; level 0–6 | [VERIFIED: node_modules] |
| `@jsquash/jpeg` | 1.6.0 | MozJPEG encode + decode; quality, progressive, chroma | [VERIFIED: node_modules] |
| `@jsquash/webp` | 1.5.0 | libwebp encode + decode; quality, method, lossless | [VERIFIED: node_modules] |
| `@jsquash/avif` | 2.1.1 | libavif encode + decode; quality, speed, lossless; ~8MB WASM — lazy-load only | [VERIFIED: node_modules] |
| `@jsquash/resize` | 2.1.1 | Resize ImageData; method: lanczos3/mitchell/catrom/triangle; fitMethod: stretch/contain | [VERIFIED: node_modules] |
| `svgo` | 4.0.1 | SVG optimization; browser ESM at `svgo/browser`; `optimize(str, config)` synchronous | [VERIFIED: node_modules] |
| `comlink` | 4.4.2 | Comlink.transfer for zero-copy ArrayBuffer transfer | [VERIFIED: node_modules] |
| `nanostores` | 1.3.0 | Per-file settings in filesAtom via map + setKey | [VERIFIED: node_modules] |
| `sonner` | 2.0.7 | Per-file error toasts (D-13) | [VERIFIED: node_modules] |

**No install required.** All packages present. Stack note: real stack is **nanostores 1.3.0 + Vite 7.3.2** (verified from package.json), not zustand/Vite 8 as CLAUDE.md states. [VERIFIED: package.json]

---

## Package Legitimacy Audit

No new packages are being installed this phase. All dependencies were audited in Phase 8.

| Package | Disposition |
|---------|-------------|
| All `@jsquash/*`, `svgo`, `comlink`, `nanostores`, `sonner` | Pre-approved — already installed |

**Packages removed due to [SLOP]:** none
**Packages flagged [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Main Thread
│
├─ filesAtom { entries: FileEntry[] }
│    each FileEntry now includes:
│    { ...existing, settings: FileSettings, encodedBuffer?: ArrayBuffer, error?: string }
│
├─ settingsAtom (global defaults only — D-02)
│    → "Apply to all" action copies into each FileEntry.settings
│
├─ Inspector (CodecPanel/SvgoPanel) reads selectedFile.settings
│    → onChange → setFileSettings(id, key, value)
│    → triggers useLiveEncode debounce (250–350ms)
│
├─ useLiveEncode hook (new — D-05/D-07)
│    debounce(250ms) → reads selectedFile raw bytes + settings
│    → pool.run(EncodeJob with Comlink.transfer)
│    → on result: setKey('encodedBuffer') on FileEntry
│    → on error: setKey('error'), pushToast (D-13)
│
└─ WorkerPool (existing Phase 8)
     │
     ▼
   codec.worker.ts — optimize(job: EncodeJob)
     ├─ 'PNG'  → decode(@jsquash/png) → [resize?] → optimise(@jsquash/oxipng, {level})
     ├─ 'WebP' → decode(source-codec) → [resize?] → encode(@jsquash/webp, {quality, method, lossless})
     ├─ 'JPEG' → decode(source-codec) → [resize?] → encode(@jsquash/jpeg, {quality, progressive})
     ├─ 'AVIF' → decode(source-codec) → [resize?] → encode(@jsquash/avif, {quality, speed, lossless}) [lazy 8MB]
     └─ 'SVG'  → import('svgo/browser') → optimize(svgString, {plugins:[preset-default+overrides]})
                  (SVG: no decode/resize — text in, text out)

EncodeResult returns Comlink.transfer({ buffer, originalSize, optimizedSize }, [buffer])
```

### Recommended Project Structure
```
src/
├── workers/
│   └── codec.worker.ts       # Add real adapters to existing switch
├── lib/
│   ├── worker-pool.ts        # Add Comlink.transfer (WR-03 fix)
│   └── codec-adapters.ts     # Optional: extract adapter helpers (decode-then-encode, resize gate)
├── hooks/
│   ├── useOptimize.ts        # Fix BL-01 (startRun sync) + wire real File→ArrayBuffer bytes
│   └── useLiveEncode.ts      # NEW: debounced single-file re-encode for inspector (D-05/D-07)
└── stores/
    ├── files.ts              # Extend FileEntry with FileSettings + error; add setFileSettings action
    ├── settings.ts           # Becomes global defaults only; add applyToAll action (D-02)
    └── runtime.ts            # Fix CR-01 (setJobCounts → setKey)
```

### Pattern 1: Decode-Then-Encode (universal conversion matrix)
**What:** Every raster encode follows decode(sourceBuffer) → [resize] → encode(imageData, options).
The source decoder is chosen by the SOURCE file type, not the target codec.

**Source → Decoder mapping:**
| Source format | Decoder |
|---------------|---------|
| PNG | `@jsquash/png` decode |
| JPEG / JPG | `@jsquash/jpeg` decode |
| WebP | `@jsquash/webp` decode |
| AVIF | `@jsquash/avif` decode (note: Safari <16.4 drops AVIF decode — wrap in try/catch → D-13) |

**When to use:** Always for raster codecs. SVG is text-only — no decode needed.

```typescript
// Source: verified against @jsquash/* READMEs in node_modules
// Generic adapter pattern (inside codec.worker.ts switch branch)
async function encodeRaster(
  buffer: ArrayBuffer,
  sourceFormat: 'png' | 'jpeg' | 'webp' | 'avif',
  settings: FileSettings
): Promise<ArrayBuffer> {
  // Step 1: decode source to ImageData
  let imageData: ImageData
  switch (sourceFormat) {
    case 'png':  { const { decode } = await import('@jsquash/png');  imageData = await decode(buffer); break }
    case 'jpeg': { const { decode } = await import('@jsquash/jpeg'); imageData = await decode(buffer); break }
    case 'webp': { const { decode } = await import('@jsquash/webp'); imageData = await decode(buffer); break }
    case 'avif': { const { decode } = await import('@jsquash/avif'); imageData = await decode(buffer); break }
  }

  // Step 2: resize if requested (D-10) — before encode
  if (settings.resizeOn && settings.w && settings.h) {
    const { default: resize } = await import('@jsquash/resize')
    imageData = await resize(imageData, {
      width: Number(settings.w),
      height: settings.h === 'auto'
        ? Math.round(imageData.height * (Number(settings.w) / imageData.width))
        : Number(settings.h),
      method: settings.alg as ResizeMethod,
      fitMethod: settings.fit as 'stretch' | 'contain',
    })
  }

  return imageData
}
```

### Pattern 2: Verified Encoder Option Mappings
**Source:** Verified against node_modules/@jsquash/*/meta.js [VERIFIED: node_modules]

**Inspector control → jSquash encoder option:**

| Inspector Control | WebP option | JPEG option | AVIF option | OxiPNG option |
|-------------------|-------------|-------------|-------------|----------------|
| `q` (quality 0–100) | `quality` (0–100) | `quality` (0–100) | `quality` (0–100) | N/A |
| `method` (effort 0–6) | `method` (0–6; encoding effort) | N/A | `speed` (0–10; 6=default; INVERT: lower=slower/better) | `level` (0–6; use `method` directly) |
| `lossless` (bool) | `lossless` (0=lossy, 1=lossless) | N/A | `lossless` (boolean) | N/A |
| `progressive` (JPEG only) | N/A | `progressive` (boolean; true=default) | N/A | `interlace` (bool) |
| `stripMeta` / `keepIcc` | libwebp strips EXIF by default | MozJPEG strips EXIF by default | libavif strips EXIF by default | OxiPNG: N/A |

**AVIF speed note:** `speed` is NOT the same as WebP `method`. AVIF `speed` 0 = slowest/best, 10 = fastest/worst. Default is 6. Map inspector `method` slider (0–6) to AVIF `speed` by inverting: `avifSpeed = 6 - method` clamped 0–6. [ASSUMED — planner should confirm UX intent with user]

**strip-metadata note (D-12):** jSquash encoders do not expose explicit EXIF-strip flags — MozJPEG, libwebp, and libavif all strip EXIF metadata from ImageData by design (EXIF lives in the file container, not in raw pixel data). Passing `keepIcc: true` has no direct jSquash API — ICC profile preservation is not currently exposed by any jSquash codec. This means `stripMeta=true` is automatically honored for all raster codecs (EXIF stripped at decode boundary). `keepIcc` has no effect with the current jSquash surface — record as a known limitation. [VERIFIED: jSquash README; no ICC option found]

### Pattern 3: svgo v4 Browser ESM in Worker
**Source:** Verified against node_modules/svgo/package.json exports and README [VERIFIED: node_modules]

```typescript
// Import path for browser (inside codec.worker.ts SVG branch):
// svgo/browser → dist/svgo.browser.js (verified from exports field)
const { optimize } = await import('svgo/browser')

// Config shape — preset-default + overrides driven by SvgoPanel plugin toggles
// plugins array: one entry per DISABLED plugin (override to false), plus any param overrides
function buildSvgoConfig(pluginStates: Array<{id: string; on: boolean}>): object {
  const overrides: Record<string, false | object> = {}
  for (const p of pluginStates) {
    if (!p.on) overrides[p.id] = false   // disabled plugin → override to false
    // enabled plugins: no override needed (preset-default enables them)
  }
  return {
    plugins: [{
      name: 'preset-default',
      params: { overrides }
    }]
  }
}

// Usage:
const result = optimize(svgString, buildSvgoConfig(settings.plugins))
// result.data is the optimized SVG string
// result.error is truthy on failure (does not throw)
```

**svgo v4 gotchas (verified from node_modules):**
- `optimize()` is SYNCHRONOUS — no await needed. Returns `{ data: string, error?: Error }`.
- Input must be a string (UTF-8 SVG text), not an ArrayBuffer. Worker receives raw bytes → decode via `TextDecoder` before svgo.
- Browser build is `svgo/browser` (import subpath), not `svgo`. In Vite, Vite resolves the `exports.browser` field automatically — `import('svgo/browser')` works inside a worker.
- `extendDefaultPlugins` removed in v4 — use `preset-default` + `overrides` shape above.
- `convertPathData` in v4 has `floatPrecision: 3` default — visible precision loss on complex paths; leave at default unless user reports visual regressions.

### Pattern 4: Comlink.transfer Fixes (WR-03 + CR-01)
**Source:** Phase 08-REVIEW.md WR-03 + CR-01 [VERIFIED: codebase]

```typescript
// worker-pool.ts — transfer input buffer (neuters job.buffer on caller side — intended)
worker.optimize(Comlink.transfer(pending.job, [pending.job.buffer]))

// codec.worker.ts — transfer result buffer (zero-copy return)
return Comlink.transfer({ buffer: result, originalSize, optimizedSize }, [result])

// runtime.ts — CR-01 fix: atomic setKey instead of full-object spread
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.setKey('runningJobs', running)
  runtimeAtom.setKey('queuedJobs', queued)
  runtimeAtom.setKey('running', running > 0 || queued > 0)
}
```

### Pattern 5: Per-File Settings State Shape
**Recommendation:** Extend `FileEntry` in `src/lib/stub-data.ts` with optional settings + error fields. Do NOT create a separate keyed map — the existing `filesAtom.entries` array already has `setKey('entries', ...)` patterns and `$selectedFile` computed atom. A separate map would require synchronizing two atoms.

```typescript
// Extend FileEntry in stub-data.ts (or a new types file)
export interface FileSettings {
  codec: Codec       // target output format
  q: number          // quality 0–100
  method: number     // effort 0–6
  lossless: boolean
  resizeOn: boolean
  w: string
  h: string
  alg: string
  fit: string
  stripMeta: boolean
  keepIcc: boolean
  aggressive: boolean
  plugins: SvgoPlugin[]
}

export interface FileEntry {
  // ... existing fields ...
  settings: FileSettings         // per-file settings (D-01)
  rawBuffer?: ArrayBuffer        // original file bytes (decoded once; cache for live re-encode)
  encodedBuffer?: ArrayBuffer    // result of last encode
  error?: string                 // per-file error message (D-13)
}
```

**New actions in files.ts:**
```typescript
export function setFileSettings<K extends keyof FileSettings>(
  id: string, key: K, value: FileSettings[K]
): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, settings: { ...e.settings, [key]: value } } : e
  ))
}

export function setFileError(id: string, error: string | undefined): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, error } : e
  ))
}

export function setFileResult(id: string, encodedBuffer: ArrayBuffer): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, encodedBuffer, error: undefined } : e
  ))
}
```

**settingsAtom** keeps its current shape as global defaults. Add:
```typescript
export function applyToAll(): void {
  const defaults = settingsAtom.get()
  filesAtom.setKey('entries', filesAtom.get().entries.map(e => ({
    ...e,
    settings: { ...defaults }
  })))
}
```

### Pattern 6: decode-once Caching for Live Re-Encode
**Recommendation:** Store `rawBuffer: ArrayBuffer` on FileEntry when the file is first added (real file bytes from `File.arrayBuffer()`). On each live re-encode triggered by an inspector change, decode rawBuffer → ImageData, apply resize if needed, then encode. This is cheap for small images; WASM init is cached by V8 module registry after first call.

For the selected file's live preview, the worker can optionally cache the decoded ImageData across re-encodes by keeping a module-level Map in the worker (`Map<jobId, ImageData>`). This is an optional optimization — the planner should decide whether to include it in Phase 9 or defer.

### Anti-Patterns to Avoid
- **Re-encoding the entire batch on global setting change:** D-06 explicitly forbids this.
- **Importing svgo at the top of codec.worker.ts:** Must be `await import('svgo/browser')` inside the SVG branch — keeps svgo out of the initial worker bundle.
- **Passing SVG bytes as ArrayBuffer without TextDecoder:** svgo.optimize() takes a string. `new TextDecoder().decode(buffer)` before calling optimize.
- **Using settingsAtom as per-file settings:** settingsAtom becomes global defaults only (D-01/D-02). Inspector must read from `selectedFile.settings`, not `settingsAtom`.
- **Spreading runtimeAtom in setJobCounts:** Use setKey atomically (CR-01 fix) to avoid race with pushToast.
- **Ignoring AVIF decode failure on older Safari:** Wrap AVIF decode in try/catch; catch → D-13 error state + sonner toast + return original bytes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG optimization | Custom zlib/deflate optimizer | `@jsquash/oxipng` (OxiPNG/Rust WASM) | OxiPNG handles filter strategies, DEFLATE tuning, palette reduction |
| WebP encoding | libwebp bindings | `@jsquash/webp` (already installed) | Complex bitstream format; WASM build tested |
| JPEG encoding | MozJPEG bindings | `@jsquash/jpeg` (already installed) | Progressive scan layout, Huffman optimization, chroma subsampling |
| AVIF encoding | libavif bindings | `@jsquash/avif` (already installed) | AV1 codec is extremely complex; libavif is reference impl |
| Image resize | Canvas drawImage + getImageData | `@jsquash/resize` (already installed) | lanczos3/mitchell for quality; canvas lacks quality resize algos |
| SVG optimization | Regex-based SVG processing | `svgo` v4 browser ESM | 20+ plugins covering path data, styles, transforms, etc. |
| Debounce | Custom setTimeout wrapper | Standard `setTimeout` + `clearTimeout` | Simple 2-liner; no library needed for this use case |
| Worker RPC | Raw postMessage + MessageChannel | `comlink` (already installed) | Transfer semantics, promise API, error propagation |

---

## Common Pitfalls

### Pitfall 1: SVG adapter receives ArrayBuffer, svgo expects string
**What goes wrong:** Worker's `job.buffer` is always an ArrayBuffer. `svgo.optimize(buffer)` does not throw — it silently treats the binary data as a malformed string and returns an error in `result.error`.
**Why it happens:** All raster codecs take ArrayBuffer natively; SVG does too in the job schema.
**How to avoid:** Decode SVG bytes to string FIRST: `const svgString = new TextDecoder('utf-8').decode(job.buffer)`. Check `result.error` after optimize; if truthy, D-13 error path.
**Warning signs:** optimizedSize equals originalSize, or svgo result.data is empty.

### Pitfall 2: AVIF encode/decode breaks on Safari < 16.4
**What goes wrong:** `@jsquash/avif` 2.x uses BigInt operations in its WASM glue. Safari < 16.4 does not support BigInt in WASM — calling decode or encode throws a runtime error.
**Why it happens:** libavif upgraded to use 64-bit types in the AVIF 2.x bump.
**How to avoid:** Wrap entire AVIF branch in try/catch. On catch: set D-13 error state ("AVIF not supported in this browser"), toast, return original buffer.
**Warning signs:** TypeError in worker on Safari; no output produced.

### Pitfall 3: Comlink.transfer neuters the source buffer
**What goes wrong:** After `pool.run(Comlink.transfer(job, [job.buffer]))`, `job.buffer.byteLength === 0`. If the caller tries to reuse `job.buffer` (e.g., for caching rawBuffer), it will be empty.
**Why it happens:** Transfer moves the underlying ArrayBuffer ownership to the worker.
**How to avoid:** Cache `rawBuffer` on the FileEntry BEFORE dispatching. Pass a detached copy if the worker needs it and the caller still needs the original. Or pass `buffer.slice(0)` to transfer (creates a copy — only do for the original cache, not for every live re-encode job).
**Warning signs:** `rawBuffer.byteLength === 0` after dispatch.

### Pitfall 4: OxiPNG level vs. quality slider mismatch
**What goes wrong:** Inspector shows "Effort" slider 0–6 labeled for all codecs. For OxiPNG, the `method` control maps to `level` (0–6) — this is correct. But `q` (quality) has no meaning for PNG; passing quality to OxiPNG has no effect. UI must hide quality for PNG or map correctly.
**Why it happens:** The inspector uses a shared quality slider. OxiPNG has no quality — it's lossless; only compression level matters.
**How to avoid:** In the PNG adapter: use `job.settings.method` as `level`; ignore `job.settings.q`. In the UI: disable/hide the quality slider when codec is PNG.
**Warning signs:** Quality slider changes have no effect on PNG output.

### Pitfall 5: Per-file settings not initialized for stub/real files
**What goes wrong:** Existing FileEntry stubs in `STUB_FILES` have no `settings` field. Any code that reads `entry.settings.codec` before initialization will throw.
**Why it happens:** Stub data predates per-file settings. Real files added via drag-drop also need default settings assigned at add time.
**How to avoid:** Add `initFileSettings(defaults: FileSettings): FileSettings` helper. Call it when entries are created/added, copying from `settingsAtom.get()` as the initial default. Also patch STUB_FILES or migrate them in the store initializer.
**Warning signs:** TypeError: Cannot read properties of undefined reading 'codec'.

### Pitfall 6: JPEG progressive field naming
**What goes wrong:** The inspector currently shows no "Progressive" toggle for JPEG. Adding one requires knowing the field name: `progressive` (boolean) in `@jsquash/jpeg` meta.
**Why it happens:** The UI was built before real API mapping was done.
**How to avoid:** Use `progressive: settings.progressive ?? true` (default ON per jSquash meta).
**Warning signs:** JPEG output is always baseline even when progressive is toggled.

---

## Code Examples

### PNG (OxiPNG) Adapter
```typescript
// Source: @jsquash/oxipng README (node_modules) — verified [VERIFIED: node_modules]
// @jsquash/oxipng optimise accepts ArrayBuffer OR ImageData directly
case 'PNG': {
  if (job.buffer.byteLength === 0) throw new Error('Empty buffer')  // WR-02 fix
  const { optimise } = await import('@jsquash/oxipng')
  // optimise accepts ArrayBuffer directly — no decode step needed for PNG→PNG
  // For PNG→other formats, use @jsquash/png decode first
  const level = (job.settings.method as number) ?? 2  // map effort→level
  const result = await optimise(job.buffer, { level, interlace: false, optimiseAlpha: true })
  return Comlink.transfer({ buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength }, [result])
}
```

### WebP Adapter (with source-agnostic decode)
```typescript
// Source: @jsquash/webp README (node_modules) [VERIFIED: node_modules]
case 'WebP': {
  if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
  const imageData = await decodeSource(job.buffer, job.sourceFormat)  // decode-then-encode
  const { encode } = await import('@jsquash/webp')
  const result = await encode(imageData, {
    quality: (job.settings.q as number) ?? 82,
    method: (job.settings.method as number) ?? 4,
    lossless: job.settings.lossless ? 1 : 0,
  })
  return Comlink.transfer({ buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength }, [result])
}
```

### JPEG Adapter
```typescript
// Source: @jsquash/jpeg README + meta.js (node_modules) [VERIFIED: node_modules]
case 'JPEG': {
  if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
  const imageData = await decodeSource(job.buffer, job.sourceFormat)
  const { encode } = await import('@jsquash/jpeg')
  const result = await encode(imageData, {
    quality: (job.settings.q as number) ?? 75,
    progressive: (job.settings.progressive as boolean) ?? true,
    // auto_subsample: true (default — respects chroma settings automatically)
  })
  return Comlink.transfer({ buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength }, [result])
}
```

### AVIF Adapter (lazy + Safari guard)
```typescript
// Source: @jsquash/avif README (node_modules) [VERIFIED: node_modules]
case 'AVIF': {
  if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
  try {
    const imageData = await decodeSource(job.buffer, job.sourceFormat)
    const { encode } = await import('@jsquash/avif')  // ~8MB — only fetched here
    const result = await encode(imageData, {
      quality: (job.settings.q as number) ?? 50,
      speed: Math.max(0, 6 - ((job.settings.method as number) ?? 4)),  // invert effort→speed
      lossless: (job.settings.lossless as boolean) ?? false,
    })
    return Comlink.transfer({ buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength }, [result])
  } catch (err) {
    // D-13: AVIF decode failure on Safari <16.4; surface error, keep original bytes
    throw new Error('AVIF not supported in this browser: ' + String(err))
  }
}
```

### SVG Adapter
```typescript
// Source: svgo README + package.json exports (node_modules) [VERIFIED: node_modules]
case 'SVG': {
  if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
  const { optimize } = await import('svgo/browser')
  const svgString = new TextDecoder('utf-8').decode(job.buffer)
  const plugins = (job.settings.plugins as Array<{id: string; on: boolean}>) ?? []
  const overrides: Record<string, false | Record<string, unknown>> = {}
  for (const p of plugins) {
    if (!p.on) overrides[p.id] = false
  }
  const result = optimize(svgString, {
    plugins: [{ name: 'preset-default', params: { overrides } }]
  })
  if (result.error) throw new Error('svgo error: ' + String(result.error))
  const encoder = new TextEncoder()
  const buffer = encoder.encode(result.data).buffer
  return Comlink.transfer({ buffer, originalSize: job.buffer.byteLength, optimizedSize: buffer.byteLength }, [buffer])
}
```

### useLiveEncode Hook (new — D-05/D-07)
```typescript
// Debounced single-file re-encode for inspector live preview
export function useLiveEncode() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback((fileId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const entry = filesAtom.get().entries.find(e => e.id === fileId)
      if (!entry?.rawBuffer || !entry.settings) return
      const pool = getPool()
      try {
        const result = await pool.run(Comlink.transfer(
          { codec: entry.settings.codec, buffer: entry.rawBuffer.slice(0), settings: entry.settings, sourceFormat: entry.type },
          [entry.rawBuffer.slice(0)]  // slice(0) = copy so rawBuffer remains intact
        ))
        setFileResult(fileId, result.buffer)
      } catch (err) {
        setFileError(fileId, String(err))
        toast.error('Encode failed: ' + String(err))  // sonner
      }
    }, 300)  // 300ms — within D-07 range of 250–350ms
  }, [])

  return { trigger }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global settingsAtom for all files | Per-file settings in FileEntry (D-01) | Phase 9 | Inspector now shows selected file's own settings |
| `new ArrayBuffer(0)` stubs | Real `File.arrayBuffer()` bytes | Phase 9 | Real encode output, accurate size reporting |
| `throw new Error('not implemented')` in worker | Real jSquash encode adapters | Phase 9 | All 5 codec branches functional |
| `setJobCounts` full-object spread | `setKey` atomic updates (CR-01) | Phase 9 (fold-in fix) | No concurrent state clobber |
| Structured-clone buffer transfer | `Comlink.transfer` (WR-03) | Phase 9 (fold-in fix) | Zero-copy buffer passing |

**Deprecated/outdated patterns from Phase 8:**
- `buffer: new ArrayBuffer(0)` in useOptimize — replace with `entry.rawBuffer` from FileEntry
- `settings: {}` in EncodeJob — replace with typed `FileSettings`

---

## EncodeJob Schema Extension

Phase 8 defines `EncodeJob.settings: Record<string, unknown>`. Phase 9 needs to add `sourceFormat` to support decode-then-encode:

```typescript
export interface EncodeJob {
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'
  sourceFormat: 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'svg'  // NEW — drives decoder selection
  buffer: ArrayBuffer
  settings: FileSettings  // replace Record<string, unknown>
}
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AVIF `speed` field maps inversely to inspector `method` slider — `avifSpeed = 6 - method` | Code Examples | Wrong mapping = AVIF quality not as expected; planner should expose as named param |
| A2 | ICC profile preservation is not exposed by any jSquash codec (strip-metadata always ON for ICC) | Pitfalls | If jSquash adds ICC API in a newer minor version, keepIcc control would be wirable |
| A3 | svgo `result.error` is the correct way to detect failures in browser build (does not throw) | Code Examples | If it throws instead of returning error, the try/catch in D-13 path still catches it |

---

## Open Questions (RESOLVED)

1. **JPEG progressive toggle in UI** — RESOLVED
   - What we know: `@jsquash/jpeg` has `progressive: boolean` (default true per meta.js). The CodecPanel has no progressive toggle visible.
   - Recommendation: Add a boolean `progressive` field to `FileSettings`; default to `true`; add a small toggle in CodecPanel under JPEG parameters. Low effort.
   - **Resolution:** Adopted. Planned in 09-04 (Progressive `<Switch>` for JPEG) + `progressive` field in `FileSettings` (09-01).

2. **AVIF speed/quality UX: separate slider or unified effort slider?** — RESOLVED
   - What we know: AVIF `speed` (0=slowest/best, 10=fastest) is NOT the same scale as WebP `method`. AVIF default speed=6. Inverting gives confusing semantics.
   - Recommendation: Share the generic Effort slider (0–6) and document the inversion internally.
   - **Resolution:** Adopted. 09-02 maps the shared Effort slider to AVIF speed via internal inversion (`Math.max(0, 6 - method)`).

3. **decode-once ImageData caching in worker** — RESOLVED (deferred)
   - What we know: Every live re-encode re-decodes rawBuffer → ImageData (same source pixels). For a 4K image, PNG decode can take 50–150ms.
   - Recommendation: Defer to Phase 10/performance tuning. Phase 9 correctness first; caching is a separate optimization.
   - **Resolution:** Deferred to a future performance phase. Not planned in Phase 9.

---

## Environment Availability

All tools required are pre-installed. No external services or CLI tools needed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@jsquash/*` | ENC-01..04 | Yes | See Standard Stack | — |
| `svgo` | ENC-05 | Yes | 4.0.1 | — |
| `comlink` | WR-03 fix | Yes | 4.4.2 | — |
| `sonner` | D-13 toasts | Yes | 2.0.7 | — |
| Playwright | Test suite | Yes (devDep) | ^1.59.1 | — |

**No missing dependencies.**

---

## Validation Architecture

> nyquist_validation: true in .planning/config.json — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test src/tests/worker-pipeline.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENC-01 | PNG via OxiPNG produces smaller output | integration (worker) | `npx playwright test src/tests/codec-encoders.spec.ts -g "PNG"` | ❌ Wave 0 |
| ENC-02 | WebP encode with quality/lossless controls | integration (worker) | `npx playwright test src/tests/codec-encoders.spec.ts -g "WebP"` | ❌ Wave 0 |
| ENC-03 | JPEG encode with quality/progressive | integration (worker) | `npx playwright test src/tests/codec-encoders.spec.ts -g "JPEG"` | ❌ Wave 0 |
| ENC-04 | AVIF lazy-load + encode | integration (worker) | `npx playwright test src/tests/codec-encoders.spec.ts -g "AVIF"` | ❌ Wave 0 |
| ENC-05 | SVG via svgo with plugin toggles | integration (worker) | `npx playwright test src/tests/codec-encoders.spec.ts -g "SVG"` | ❌ Wave 0 |
| ENC-06 | Inspector settings drive real output | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "settings"` | ❌ Wave 0 |
| D-13 | Encode failure → error state + fallback | unit | `npx playwright test src/tests/codec-encoders.spec.ts -g "error"` | ❌ Wave 0 |

**Testing approach:** Playwright browser tests that navigate to `/`, inject real (small) image buffers into the worker pool, and assert on `EncodeResult.buffer.byteLength > 0` and `optimizedSize < originalSize` for lossless-only codecs. SVG test asserts result string is valid XML and shorter than input.

### Sampling Rate
- **Per task commit:** `npx playwright test src/tests/codec-encoders.spec.ts --project=chromium`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/codec-encoders.spec.ts` — covers ENC-01..06, D-13
- [ ] `src/tests/per-file-settings.spec.ts` — covers D-01/D-02/D-03 store behavior

*(Existing `worker-pipeline.spec.ts` covers PIPE-01..03; extend `backpressure.spec.ts` if BL-01 fix changes observable behavior.)*

---

## Security Domain

> security_enforcement: absent → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — zero-server, all client-side |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Validate codec enum (existing KNOWN_CODECS set); validate buffer not empty before WASM dispatch |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for jSquash WASM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed image buffer → WASM heap overflow | Tampering | jSquash handles internally; worker isolates WASM heap; D-13 catch wraps all encoder calls |
| SVG with embedded script/event handlers | Tampering | DOMPurify already installed; svgo does not execute SVG — text transform only; no eval risk |
| Codec enum injection | Tampering | Existing KNOWN_CODECS.has() guard in codec.worker.ts — maintain this for any new codec values |
| Empty buffer fed to WASM decoder | Denial of Service | WR-02 fix: `if (job.buffer.byteLength === 0) throw` before any dynamic import |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@jsquash/webp/README.md` — encode/decode API signatures [VERIFIED: node_modules]
- `node_modules/@jsquash/jpeg/meta.js` — MozJPEG default options (quality:75, progressive:true) [VERIFIED: node_modules]
- `node_modules/@jsquash/webp/meta.js` — WebP default options (quality:75, method:4, lossless:0) [VERIFIED: node_modules]
- `node_modules/@jsquash/avif/meta.js` — AVIF default options (quality:50, speed:6, lossless:false) [VERIFIED: node_modules]
- `node_modules/@jsquash/oxipng/meta.js` — OxiPNG defaults (level:2, interlace:false, optimiseAlpha:false) [VERIFIED: node_modules]
- `node_modules/@jsquash/resize/meta.js` — resize defaults (lanczos3, stretch) [VERIFIED: node_modules]
- `node_modules/@jsquash/oxipng/README.md` — MT activation (in Worker + COOP/COEP, auto-detected) [VERIFIED: node_modules]
- `node_modules/@jsquash/resize/README.md` — resize API + fitMethod values [VERIFIED: node_modules]
- `node_modules/svgo/package.json` exports — `./browser` → `dist/svgo.browser.js` [VERIFIED: node_modules]
- `node_modules/svgo/README.md` — preset-default + overrides pattern [VERIFIED: node_modules]
- `.planning/phases/08-worker-pipeline-foundation/08-REVIEW.md` — WR-02, WR-03, CR-01, BL-01 fixes [VERIFIED: codebase]
- `src/workers/codec.worker.ts` — existing switch structure; EncodeJob/EncodeResult types [VERIFIED: codebase]
- `src/stores/settings.ts` — SettingsState shape (source of FileSettings fields) [VERIFIED: codebase]
- `package.json` — installed versions, real stack (nanostores + Vite 7) [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- AVIF Safari <16.4 BigInt drop — confirmed in CLAUDE.md (locked) + Anthropic training knowledge; not re-verified from libavif changelog this session [ASSUMED to be stable as of 2.1.1]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from node_modules
- API option mappings: HIGH — confirmed from meta.js files and READMEs
- Architecture: HIGH — extends Phase 8 patterns directly
- Pitfalls: HIGH (VERIFIED) / MEDIUM (AVIF Safari)
- svgo browser usage: HIGH — exports field and README confirmed

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (stable jSquash surface; svgo 4.x stable)
