# Phase 5: Raster Encoders - Research

**Researched:** 2026-05-07
**Domain:** jSquash WASM codecs (PNG/OxiPNG, JPEG/MozJPEG, WebP, AVIF), Zustand per-file overrides, React 19 split-slider UI, debounced re-optimize
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Format-aware InspectorPane — controls keyed to selected file's format. No file selected → "Select a file" prompt.
- **D-02:** Per-file codec overrides active in Phase 5. `FileEntry.codecOverride?: PerFormatSettings` (or equivalent). Settings change → debounced re-optimize for that file only.
- **D-03:** InspectorPane has two tabs: Codec | Snippets. Existing SnippetPanel moves to Snippets tab. SvgoPanel + new raster panels render inside Codec tab, conditionally by format.
- **D-04:** Debounced live re-optimize on settings change. 200 ms debounce + pool cancel-and-restart, identical to Phase 3 SVG live re-optimize pattern (`useRuntimeStore.enqueuePreview`).
- **D-05:** Click file row → CenterPane activates. `useFilesStore.selectedId` already wired.
- **D-06:** Vertical drag handle, left = original, right = optimized. CenterPane.tsx drag/keyboard mechanics unchanged; replace `MockFile` prop with real `FileEntry` data.
- **D-07:** Empty state = slider shell with no images. Current behavior preserved.
- **D-08:** Delta strip: keep Original / Optimized / Saved (real data). Remove SSIM, Butteraugli, Decode estimate rows (all hardcoded mocks).
- **D-09:** AVIF included in Phase 5 (SC-5 compliance). Lazy-loaded on first AVIF file processed.
- **D-10:** All codecs lazy-init on first call. Static ADAPTERS map stays as routing table; WASM module init moves from module-load to first-use. Dynamic `import('@jsquash/{codec}')` inside worker.
- **D-11:** Single FileEntry per source file. Phase 4 `addSourceWithVariants`, `removeFamily`, `sourceUuid-Nx` id convention become dead code. Planner decides removal scope.
- **D-12:** Density checkboxes = export-scope selectors only. Store as `targetDensities: TargetDensity[]` on FileEntry. Do NOT trigger re-optimize or variant generation.
- **D-13:** Resize + variant generation deferred to Phase 7.
- **D-14:** Real ICC preservation for all four raster formats. No jSquash ICC API — requires manual byte-level chunk handling (~150–300 LOC per format). Research confirms: PNG (iCCP chunk), JPEG (APP2), WebP (ICCP metadata), AVIF (colr box). Planner may scope to PNG + JPEG only and defer WebP/AVIF ICC to Phase 8 if >300 LOC per format.

### Claude's Discretion
- Exact per-format codec controls UI layout (slider vs. number input for quality; OxiPNG level as slider 0–6 vs. dropdown)
- Whether per-file codec settings live in `FileEntry.codecOverride?: PerFormatSettings` or a separate `useSettingsStore.perFile` slice keyed by fileId
- Visual design of the Codec tab format indicator (pill showing format name, auto-detected from FileEntry.format)
- Source density selector placement in InspectorPane (above vs. below target density checkboxes)
- Which Phase 4 fan-out code to remove vs. leave as dead code (planner's call based on what would break tests)

### Deferred Ideas (OUT OF SCOPE)
- OxiPNG MT (multi-thread) build — Phase 8
- SSIM / Butteraugli quality metrics in delta strip — Phase 8
- Decode-time estimate in delta strip — Phase 8
- Format-aware ICC defaults — v2
- ICC for WebP / AVIF — may defer to Phase 8 if byte-level surgery exceeds LOC budget
- Phase 4 fan-out machinery cleanup — planner decides scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPT-02 | PNG optimization via jSquash OxiPNG (lossless levels 0–6) | OxiPNG pipeline: decode via `@jsquash/png` → ImageData → `@jsquash/oxipng` optimize. png-adapter.ts already decodes; add oxipng encode step. |
| OPT-03 | WebP optimization via jSquash WebP (lossy/lossless, quality, method) | New webp-adapter.ts: lazy-init `@jsquash/webp`, decode input, encode with quality/method/lossless settings. |
| OPT-04 | JPEG optimization via jSquash `@jsquash/jpeg` (MozJPEG-based; quality, progressive) | New jpeg-adapter.ts: lazy-init `@jsquash/jpeg`, decode input, encode with quality/progressive/chroma settings. |
| OPT-05 | AVIF optimization via jSquash AVIF (quality, lossless) | New avif-adapter.ts: lazy-init `@jsquash/avif` (MUST be dynamic import — 8.4 MB unpacked); decode + encode. |
| PIPE-02 | User can configure per-format codec settings via accordion settings panel | Format-aware InspectorPane Codec tab with PngPanel, JpegPanel, WebpPanel, AvifPanel components. Per-file override writes to FileEntry.codecOverride. |
| PIPE-03 | User can set global settings that apply across all uploaded files | Global defaults already in useSettingsStore (png/jpeg/webp/avif slices with DEFAULT_CODEC_*). Per-file override takes precedence when set. |
| UI-03 | File list view with thumbnail before/after, size delta (bytes + %) | FilesPane file row must show optimizedSize after encode. Delta = originalSize - optimizedSize. fmtBytes + fmtPct already exist in src/lib/format.ts. |
| UI-04 | Click a file to open detail view with Squoosh-style split slider and per-file overrides | CenterPane.tsx already implements split slider. Phase 5 replaces MockFile prop with FileEntryWithBlob. Delta strip wired to real blob sizes. |
| UI-05 | Accordion-style settings panel (per format, plus Global, Resize/Variants, Snippet output) | InspectorPane restructure: Codec tab | Snippets tab. Codec tab = format-aware panel (PngPanel/JpegPanel/WebpPanel/AvifPanel). |
</phase_requirements>

---

## Summary

Phase 5 wires real raster WASM codecs into the existing worker pipeline. The architectural patterns from Phase 3 (SVG) and Phase 4 (PNG decode/resize) are directly reusable. The three new adapters (jpeg, webp, avif) follow the same contract as svg-adapter.ts and png-adapter.ts: `(input: ArrayBuffer, settings: TSettings) => Promise<{output: ArrayBuffer, meta: AdapterMeta}>`. The critical new element is lazy-init per codec — all four formats must dynamically import their `@jsquash/{codec}` module on first use, not at worker load time.

The biggest unknowns are (1) ICC preservation, which has no jSquash API and requires manual PNG chunk parsing and JPEG APP2 segment handling — likely 150–300 LOC per format, and (2) whether `@jsquash/jpeg`, `@jsquash/webp`, and `@jsquash/avif` are installed (they are NOT in `package.json` as of the current codebase — Wave 0 must install them). The UI work is lower-risk: CenterPane split slider is nearly done and just needs the MockFile prop replaced; InspectorPane needs the Codec|Snippets tab split; four codec panels follow the SvgoPanel component pattern.

**Primary recommendation:** Wave 0 installs missing jSquash packages + writes failing test scaffolds. Wave 1 implements the three new adapters (jpeg/webp/avif) and upgrades png-adapter to add OxiPNG. Wave 2 wires InspectorPane (Codec tab restructure, four codec panels, per-file override plumbing). Wave 3 wires CenterPane to real FileEntry data and implements ICC preservation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PNG/OxiPNG encode | Worker | — | CPU-bound WASM; must not block UI thread |
| JPEG/MozJPEG encode | Worker | — | CPU-bound WASM |
| WebP encode | Worker | — | CPU-bound WASM; lazy-load ~1 MB gzipped |
| AVIF encode | Worker | — | CPU-bound WASM; lazy-load ~2 MB gzipped |
| ICC chunk extraction (PNG/JPEG) | Worker | — | Byte-level parsing on the encoded ArrayBuffer inside the adapter |
| Codec settings state | Frontend (Zustand) | — | Global defaults in useSettingsStore; per-file overrides on FileEntry |
| Debounced re-optimize on settings change | Frontend (useRuntimeStore.enqueuePreview) | Worker | Debounce on main thread; actual encode in worker |
| Format detection per file | Frontend (FilesStore) | — | FileEntry.format is the discriminant; set at drop time |
| Split-slider detail view | Browser / Client (CenterPane.tsx) | — | Blob URL lifecycle, drag, keyboard A11y — all client-side DOM |
| Delta strip (Original/Optimized/Saved) | Browser / Client (CenterPane.tsx) | — | Derived from FileEntry.sourceBlob.size + FileEntry.optimizedBlob.size |
| Per-file codec override persistence | Frontend (FileEntry on FilesStore) | — | Zustand; Phase 7 wires IndexedDB |

---

## Standard Stack

### Core (all already installed except jSquash raster codecs)

| Library | Version in package.json | Purpose | Status |
|---------|------------------------|---------|--------|
| `@jsquash/png` | `^3.1.1` | PNG decode + encode; OxiPNG pipeline decode step | Installed [VERIFIED: package.json] |
| `@jsquash/resize` | `^2.1.1` | Resize (Phase 7); already used in png-adapter.ts | Installed [VERIFIED: package.json] |
| `@jsquash/jpeg` | NOT INSTALLED | JPEG (MozJPEG) encode+decode | Must install in Wave 0 [VERIFIED: package.json] |
| `@jsquash/webp` | NOT INSTALLED | WebP encode+decode | Must install in Wave 0 [VERIFIED: package.json] |
| `@jsquash/avif` | NOT INSTALLED | AVIF encode+decode (8.4 MB unpacked) | Must install in Wave 0; LAZY-LOAD ONLY [VERIFIED: package.json] |
| `@jsquash/oxipng` | NOT INSTALLED | OxiPNG PNG lossless optimize (encode-only) | Must install in Wave 0 [VERIFIED: package.json] |
| `zustand` | `^5.0.12` | Per-file override state; codec settings | Installed |
| `comlink` | `^4.4.2` | Worker proxy; zero-copy ArrayBuffer transfer | Installed |

**Wave 0 install command:**
```bash
npm install @jsquash/jpeg @jsquash/webp @jsquash/avif @jsquash/oxipng
```

### Type Definitions Already in Codebase

| Type | Location | Status |
|------|----------|--------|
| `CodecSettingsPng` | `src/types/index.ts` line 101 | `{ level: number }` — matches OxiPNG levels 0–6 |
| `CodecSettingsJpeg` | `src/types/index.ts` line 105 | `{ quality: number; progressive: boolean }` |
| `CodecSettingsWebp` | `src/types/index.ts` line 110 | `{ quality: number; lossless: boolean; method: number }` |
| `CodecSettingsAvif` | `src/types/index.ts` line 116 | `{ quality: number; lossless: boolean }` |
| `DEFAULT_CODEC_PNG` | `src/data/defaults.ts` line 58 | `{ level: 3 }` |
| `DEFAULT_CODEC_JPEG` | `src/data/defaults.ts` line 62 | `{ quality: 80, progressive: true }` |
| `DEFAULT_CODEC_WEBP` | `src/data/defaults.ts` line 67 | `{ quality: 80, lossless: false, method: 4 }` |
| `DEFAULT_CODEC_AVIF` | `src/data/defaults.ts` line 73 | `{ quality: 60, lossless: false }` |

All four codec setting types and their defaults are already defined and in useSettingsStore. [VERIFIED: src/types/index.ts, src/data/defaults.ts, src/stores/settings.ts]

---

## Architecture Patterns

### System Architecture Diagram

```
User selects file in FilesPane
         │
         ▼
useFilesStore.setSelected(fileId)
         │
         ├──▶ CenterPane reacts to selectedId
         │         shows split slider (orig | opt blobs)
         │
         └──▶ InspectorPane reacts to selectedId
                   shows Codec tab (format-aware panel)
                         │
                         ▼
               User changes setting (quality slider, etc.)
                         │
                         ▼
               FileEntry.codecOverride updated (or useSettingsStore slice)
                         │
                         ▼
               useRuntimeStore.enqueuePreview(fileId)
               [200 ms debounce; cancel-and-restart pool]
                         │
                         ▼
               WorkerPool.enqueue(job) with prefix "preview-"
                         │
                         ▼
               Worker: ADAPTERS[format]() — lazy import @jsquash/codec
                         │
                ┌────────┴────────┐
                │ PNG             │ JPEG/WebP/AVIF
                ▼                 ▼
         decode → ImageData    decode → ImageData
         → oxipng optimize     → encode(ImageData, settings)
         → ArrayBuffer         → ArrayBuffer
                └────────┬────────┘
                         │
                         ▼
               Comlink.transfer(output) → main thread
                         │
                         ▼
               useFilesStore.markDone(fileId, optimizedBlob, optimizedSize)
                         │
                         ├──▶ CenterPane layer-opt updates (new blob URL)
                         └──▶ FilesPane delta strip updates (Saved %)
```

### Recommended Project Structure (new files only)

```
src/
├── workers/
│   ├── jpeg-adapter.ts        # MozJPEG encode pipeline
│   ├── jpeg-config.ts         # buildJpegSettings() pure fn (unit-testable)
│   ├── webp-adapter.ts        # libwebp encode pipeline
│   ├── webp-config.ts         # buildWebpSettings() pure fn
│   ├── avif-adapter.ts        # libavif encode pipeline (lazy import)
│   ├── avif-config.ts         # buildAvifSettings() pure fn
│   └── png-adapter.ts         # UPGRADED: add OxiPNG optimize step
├── components/panels/
│   ├── PngPanel.tsx            # OxiPNG level slider + ICC toggle
│   ├── JpegPanel.tsx           # Quality slider + Progressive toggle + Chroma
│   ├── WebpPanel.tsx           # Quality slider + Method slider + Lossless toggle
│   └── AvifPanel.tsx           # Quality slider + Lossless toggle
└── lib/
    └── icc.ts                  # ICC chunk extract/embed utilities (PNG iCCP, JPEG APP2)
```

### Pattern 1: Lazy-Init Adapter (all four raster formats)

```typescript
// Source: CONTEXT.md D-10; mirrors png-adapter.ts pattern
// File: src/workers/jpeg-adapter.ts

import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { CodecSettingsJpeg } from '../types/index'

// Lazy-init module-level slot. `null` until first job for this format.
// Static import path (not template literal) — Vite can statically bundle.
type JpegModule = typeof import('@jsquash/jpeg')
let jpegMod: JpegModule | null = null

async function getJpeg(): Promise<JpegModule> {
  if (!jpegMod) jpegMod = await import('@jsquash/jpeg')
  return jpegMod
}

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = settings as CodecSettingsJpeg
  const { decode, encode } = await getJpeg()

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError('jpeg', 'decode', err instanceof Error ? err.message : String(err))
  }

  let encoded: ArrayBuffer
  try {
    encoded = await encode(decoded, {
      quality: opts.quality,
      progressive: opts.progressive,
    })
  } catch (err) {
    throw new AdapterError('jpeg', 'encode', err instanceof Error ? err.message : String(err))
  }

  return {
    output: encoded,
    meta: { codecVersion: 'jpeg@1.6.0' },
  }
}
```

### Pattern 2: OxiPNG Pipeline (upgrade to png-adapter.ts)

The existing `png-adapter.ts` does: decode → resize → encode (via `@jsquash/png`).
Phase 5 adds OxiPNG optimization as the final step:

```typescript
// After @jsquash/png encode → pass raw PNG bytes into oxipng
// oxipng receives ArrayBuffer (the PNG bytes), not ImageData

import { decode, encode } from '@jsquash/png'
import { optimise as oxipngOptimise } from '@jsquash/oxipng'  // verify export name

// OxiPNG step replaces/follows the @jsquash/png encode:
const pngBytes = await encode(resized)          // @jsquash/png → PNG ArrayBuffer
const optimized = await oxipngOptimise(pngBytes, { level: opts.level })  // OxiPNG optimize
```

**Critical:** OxiPNG is encode-only — it receives PNG bytes and returns optimized PNG bytes.
Do NOT pass ImageData to oxipng. [VERIFIED: node_modules/@jsquash/png/README.md line 49]

### Pattern 3: Per-File Override — Recommended Storage Location

Recommendation (Claude's Discretion area D-02): Store per-file codec overrides in a separate `useSettingsStore.perFile` slice keyed by fileId, rather than on `FileEntry.codecOverride`. Rationale: FileEntry lives in filesStore; mixing UI-specific codec overrides there couples concerns. The `enqueuePreview` pattern in runtime.ts already reads `useSettingsStore.getState()` — a perFile slice fits naturally there.

```typescript
// In useSettingsStore (additions to settings.ts):
interface SettingsState {
  // ... existing fields
  perFile: Record<string, Partial<CodecSettings>>   // keyed by FileEntry.id
  setPerFileCodec: (fileId: string, patch: Partial<CodecSettings>) => void
  clearPerFile: (fileId: string) => void
}
```

Resolution order: `perFile[fileId] ?? globalFormatSlice`. The adapter receives the merged result.

### Pattern 4: InspectorPane Tab Restructure

Current: tab type = `'codec' | 'svgo' | 'output' | 'report'`
Phase 5 collapses to: `'codec' | 'snippets'`

```typescript
// InspectorPane.tsx — format-aware codec panel routing
const format = selectedEntry?.format   // 'png' | 'jpeg' | 'webp' | 'avif' | 'svg'

function CodecTabContent({ format }: { format: FormatId | undefined }) {
  if (!format) return <p>Select a file to see codec settings.</p>
  if (format === 'svg') return <SvgoPanel />
  if (format === 'png') return <PngPanel />
  if (format === 'jpeg') return <JpegPanel />
  if (format === 'webp') return <WebpPanel />
  if (format === 'avif') return <AvifPanel />
  return null
}
```

### Pattern 5: CenterPane — Replace MockFile with FileEntryWithBlob

CenterPane currently takes `file: MockFile`. Phase 5 changes the prop to accept a `FileEntryWithBlob | null`. The delta strip derives from real blob sizes:

```typescript
// Delta strip — no more hardcoded mocks
const origSize = entry.sourceBlob.size          // always defined
const optSize = entry.optimizedBlob?.size ?? entry.originalSize

// Remove: SSIM row, Butteraugli row, Decode row (D-08)
// Keep: Original / Optimized / Saved
```

The blob URL lifecycle in CenterPane.tsx (lines 23–30) is already correct — it creates URLs from `selectedEntry.sourceBlob` and `selectedEntry.optimizedBlob` via `useEffect`. No change needed there.

### Pattern 6: AVIF Lazy-Load in ADAPTERS map

```typescript
// worker.ts — replace the avif throw stub with real lazy adapter
const ADAPTERS = {
  // ... existing
  avif: () => import('./avif-adapter'),  // dynamic — Vite bundles as separate chunk
}
```

Vite will automatically code-split `avif-adapter.ts` (and transitively `@jsquash/avif` WASM) into a separate chunk because it's behind a dynamic `import()`. This satisfies SC-5. [ASSUMED — standard Vite dynamic import behavior; verified pattern from Phase 3 svg-adapter and Phase 4 png-adapter]

### Anti-Patterns to Avoid

- **Template-literal dynamic import paths:** `import(\`./\${format}-adapter\`)` — Vite cannot statically analyze; will 404 in prod. Use the static ADAPTERS map with literal strings. [VERIFIED: worker.ts lines 14-16]
- **Passing Response to jSquash init:** `init(fetch('...'))` — the old API. Current API: `import('@jsquash/jpeg')` auto-inits; no manual `init()` call needed in Vite. [VERIFIED: @jsquash/png README]
- **Passing ImageData to OxiPNG:** OxiPNG receives PNG bytes (ArrayBuffer), not ImageData. Must encode via `@jsquash/png` first, then pass the encoded bytes to OxiPNG. [VERIFIED: @jsquash/png README line 49]
- **Per-format codec panels reading global store only:** Without per-file override layer, all files would be re-optimized when one file's quality changes. Merge logic is required (D-02).
- **Batch cancel while preview enqueue is pending:** `enqueuePreview` uses `preview-` prefix discriminator. The isAuxiliaryJob short-circuit in App.tsx must apply to `preview-` prefixed raster jobs too, not only SVG. [VERIFIED: useBatchOrchestrate.ts pattern, STATE.md]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG encode/decode | Custom PNG parser | `@jsquash/png` | WASM, handles 8/16-bit, edge cases |
| PNG lossless optimization | Custom OxiPNG wrapper | `@jsquash/oxipng` | Rust OxiPNG, levels 0–6, faster than hand-rolled |
| JPEG encode | Custom MozJPEG wrapper | `@jsquash/jpeg` | MozJPEG WASM; quality, progressive, chroma handled |
| WebP encode | Custom libwebp wrapper | `@jsquash/webp` | libwebp WASM; lossy/lossless, method 0–6 |
| AVIF encode | Custom libavif wrapper | `@jsquash/avif` | libavif WASM; only viable browser AVIF encoder |
| Debounce for re-optimize | Custom debounce hook | `useRuntimeStore.enqueuePreview` | Already implemented in runtime.ts; Phase 3 validated |
| Zero-copy ArrayBuffer transfer | Manual postMessage | `Comlink.transfer()` | Already used in worker.ts; prevents buffer copy |

**Key insight:** All encoder edge cases (chroma subsampling, ICC, progressive scan, OxiPNG compression tree) are already handled by the jSquash codecs. The adapter layer is thin glue, not business logic.

---

## ICC Preservation — Critical Research Finding

**Status:** No jSquash API for ICC. All four codecs expose zero ICC options. [VERIFIED: png-adapter.ts comment line 21, CONTEXT.md D-14]

### What's needed per format:

| Format | ICC Location | Extraction Method | Embed Method |
|--------|-------------|-------------------|--------------|
| PNG | `iCCP` chunk | Walk PNG chunk stream; find chunk type `iCCP`; extract data bytes | Re-insert `iCCP` chunk before `IDAT` in output PNG bytes |
| JPEG | `APP2` segment with `ICC_PROFILE\0` marker | Scan JPEG segments; find `0xFFE2` markers; reassemble multi-segment ICC | Prepend APP2 segment(s) to JPEG output bytes |
| WebP | `ICCP` metadata chunk in RIFF container | Parse RIFF chunk list; find `ICCP` chunk | Insert `ICCP` chunk in VP8X extended WebP |
| AVIF | `colr` box with `prof` type | Parse ISOBMFF box tree; find `colr` box | Insert/replace `colr` box |

**Scope recommendation (Claude's Discretion):** Implement PNG + JPEG ICC in Phase 5. Defer WebP + AVIF ICC to Phase 8. Rationale: PNG iCCP and JPEG APP2 are byte-stream level (no external parser needed, ~100–200 LOC each). WebP RIFF and AVIF ISOBMFF require understanding container structure (~200–300 LOC each). Total Phase 5 ICC LOC: ~300–400 for PNG+JPEG. This is within the Phase 5 LOC budget.

**PNG ICC approach (no extra dependency):**
```typescript
// src/lib/icc.ts
function extractPngIcc(pngBytes: ArrayBuffer): Uint8Array | null {
  // Walk 8-byte PNG signature + chunk stream
  // Chunk structure: [4-byte length][4-byte type][data][4-byte CRC]
  // Find chunk type === 'iCCP'; return the data bytes (skip compression info prefix)
}

function embedPngIcc(pngBytes: ArrayBuffer, iccData: Uint8Array): ArrayBuffer {
  // Inject iCCP chunk after IHDR chunk, before IDAT
  // Recompute CRC for the new chunk
}
```

**JPEG ICC approach (no extra dependency):**
```typescript
// JPEG ICC spans APP2 segments (each max 65533 bytes)
// Marker: 0xFF 0xE2; identifier: "ICC_PROFILE\0" (12 bytes)
// Reassemble multi-segment ICC by reading sequence number / total count
function extractJpegIcc(jpegBytes: ArrayBuffer): Uint8Array | null { ... }
function embedJpegIcc(jpegBytes: ArrayBuffer, iccData: Uint8Array): ArrayBuffer { ... }
```

[ASSUMED — byte-level structure details from training data; must verify against actual test images during implementation]

---

## Common Pitfalls

### Pitfall 1: OxiPNG receives PNG bytes, not ImageData
**What goes wrong:** Calling `oxipng(imageData)` throws or produces garbage.
**Why it happens:** OxiPNG is encode-only; it optimizes existing PNG byte streams.
**How to avoid:** Pipeline is: decode (→ImageData) → encode via @jsquash/png (→ArrayBuffer PNG bytes) → oxipng optimize (→ArrayBuffer). Two separate steps.
**Warning signs:** TypeScript error or runtime error in the oxipng call.

### Pitfall 2: AVIF WASM fetched at worker load time
**What goes wrong:** The ~2 MB gzipped AVIF bundle loads for every user even if they never process AVIF.
**Why it happens:** Static `import '@jsquash/avif'` at the top of worker.ts or avif-adapter.ts.
**How to avoid:** avif-adapter.ts must use the lazy-init pattern (module-level `let avifMod = null`; first call triggers `await import('@jsquash/avif')`). The ADAPTERS entry in worker.ts must be `() => import('./avif-adapter')` — a function, not a resolved module.
**Warning signs:** Network tab shows `avif_enc.wasm` on first page load before any AVIF file is dropped.

### Pitfall 3: isAuxiliaryJob short-circuit missing for raster preview jobs
**What goes wrong:** Re-optimize preview jobs (prefix `preview-`) pollute the batch progress counter, causing "Batch complete" toast to fire early or at wrong count.
**Why it happens:** Phase 3 wired the `preview-`/`savings-` discriminator for SVG only. Raster codec re-optimize jobs must use the same `preview-` prefix.
**How to avoid:** In `useBatchOrchestrate.ts` or App.tsx pool `onDone` callback, ensure `isAuxiliaryJob` check covers raster preview job IDs (they share the `preview-` prefix already).
**Warning signs:** Batch toast fires after fewer files than expected, or doneCount mismatch.

### Pitfall 4: Per-file override write triggers full batch re-optimize
**What goes wrong:** Changing quality for one file re-optimizes all files.
**Why it happens:** The global settings store slice (e.g., `useSettingsStore.jpeg.quality`) is subscribed by the batch orchestrator; changing it fires `startOptimize` for all files.
**How to avoid:** Per-file override must write to a `perFile[fileId]` slice, NOT to the global `jpeg`/`webp`/`avif`/`png` slices. The Codec tab panel components must call `setPerFileCodec(fileId, patch)`, not `setJpeg(patch)`.
**Warning signs:** Multiple files re-optimizing when only one file's setting was changed.

### Pitfall 5: CenterPane blob URLs double-created
**What goes wrong:** Memory leak — old object URLs not revoked when selectedId changes.
**Why it happens:** Creating blob URLs outside the useEffect cleanup.
**How to avoid:** CenterPane.tsx already handles this correctly (lines 23–30): `useEffect` with cleanup that calls `URL.revokeObjectURL(origUrl)`. Do not add additional blob URL creation outside this effect.
**Warning signs:** DevTools Memory tab shows growing detached blob: entries.

### Pitfall 6: Phase 4 addSourceWithVariants still called after D-11 single-FileEntry model
**What goes wrong:** Drop → N FileEntries created → encode runs N times → all show in file list as variants.
**Why it happens:** Phase 4's `addSourceWithVariants` fan-out is still wired in the drop handler.
**How to avoid:** Replace `addSourceWithVariants` call site with a single `addFile()` call. `removeFamily` also becomes dead code. Keep both functions in the store but mark as deprecated; do not remove if tests reference them.
**Warning signs:** Dropping one file creates multiple rows in FilesPane.

### Pitfall 7: @jsquash/avif drops Safari < 16.4 for decode
**What goes wrong:** AVIF decode (for the split-slider original preview) fails on Safari < 16.4.
**Why it happens:** `@jsquash/avif` 2.x uses BigInt operations that require Safari 16.4+.
**How to avoid:** CenterPane split slider shows original via `file.sourceBlob` (the raw dropped file — browser's native image renderer handles AVIF decode in the img tag/CSS background). The `@jsquash/avif` decode is NOT needed for preview; only the encoded output needs jSquash. Only encode path through the worker.
**Warning signs:** AVIF original preview fails to load on Safari < 16.4.

---

## Runtime State Inventory

Step 2.5: NOT APPLICABLE. This is a greenfield feature addition (new adapters, new UI panels). No rename, refactor, or migration is involved. Phase 4 fan-out dead code is additive (marking dead, not migrating data).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@jsquash/jpeg` | OPT-04 | Not installed | — | None — must install |
| `@jsquash/webp` | OPT-03 | Not installed | — | None — must install |
| `@jsquash/avif` | OPT-05 | Not installed | — | None — must install |
| `@jsquash/oxipng` | OPT-02 | Not installed | — | None — must install |
| `@jsquash/png` | OPT-02 (decode step) | Installed 3.1.1 | 3.1.1 | Already present |
| `@jsquash/resize` | Phase 7 (not Phase 5) | Installed 2.1.1 | 2.1.1 | N/A |
| Node.js | Build | Available | (system) | — |
| Vite | Build | 7.3 (downgraded from 8) | 7.3 | — |

**Missing dependencies with no fallback:**
- `@jsquash/jpeg`, `@jsquash/webp`, `@jsquash/avif`, `@jsquash/oxipng` — Wave 0 must install all four before any adapter work begins.

[VERIFIED: package.json and node_modules/@jsquash/ directory listing]

---

## Code Examples

### Verified: Lazy-Init Pattern (from Phase 3 svg-adapter.ts and png-adapter.ts)

```typescript
// Source: VERIFIED in src/workers/png-adapter.ts (Phase 4 pattern)
// Phase 5 adapters use same lazy-init but for dynamic module import:
let jpegMod: typeof import('@jsquash/jpeg') | null = null
async function getJpeg() {
  if (!jpegMod) jpegMod = await import('@jsquash/jpeg')
  return jpegMod
}
```

### Verified: enqueuePreview debounce pattern (from src/stores/runtime.ts)

```typescript
// Source: VERIFIED in src/stores/runtime.ts lines 258+
// Already handles 200ms debounce + pool cancel-and-restart
// Phase 5 codec panels call this same function for raster re-optimize:
useRuntimeStore.getState().enqueuePreview(selectedFileId)
```

### Verified: Comlink.transfer zero-copy (from src/workers/worker.ts)

```typescript
// Source: VERIFIED in src/workers/worker.ts line 45
return Comlink.transfer({ output, meta }, [output])
// output ArrayBuffer is transferred (not copied) back to main thread
```

### Verified: ADAPTERS map static literal paths (from src/workers/worker.ts)

```typescript
// Source: VERIFIED in src/workers/worker.ts lines 16-38
// Phase 5 replaces throw stubs:
jpeg: () => import('./jpeg-adapter'),   // static path — Vite can analyze
webp: () => import('./webp-adapter'),
avif: () => import('./avif-adapter'),   // separate chunk — lazy-load SC-5
```

### Verified: OxiPNG is encode-only (from @jsquash/png README)

```
// Source: VERIFIED node_modules/@jsquash/png/README.md line 49
// "You may want to use the @jsquash/oxipng package instead.
//  It can both optimise and encode to PNG directly from raw image data
//  (8-bit images only)."
// → oxipng accepts PNG bytes (ArrayBuffer from @jsquash/png encode), not ImageData
```

---

## Codebase Integration Points (Verified)

### Files that need changes in Phase 5

| File | Change | Scope |
|------|--------|-------|
| `src/workers/worker.ts` | Replace jpeg/webp/avif throw stubs with `() => import('./X-adapter')` | 3 lines |
| `src/workers/png-adapter.ts` | Add OxiPNG step after @jsquash/png encode; add lazy-init for oxipng | ~20 LOC |
| `src/stores/settings.ts` | Add `perFile` slice for per-file codec overrides; `setPerFileCodec`/`clearPerFile` actions | ~20 LOC |
| `src/stores/files.ts` | Add `targetDensities: TargetDensity[]` to FileEntryWithBlob; add `setTargetDensities` action; mark `addSourceWithVariants`/`removeFamily` as deprecated | ~30 LOC |
| `src/types/index.ts` | Add `TargetDensity` type; add `codecOverride?` field to FileEntry (optional: may use perFile store instead) | ~10 LOC |
| `src/components/panels/InspectorPane.tsx` | Restructure to Codec|Snippets tab split; add format-aware routing in Codec tab | ~80 LOC |
| `src/components/panels/CenterPane.tsx` | Replace `MockFile` prop with `FileEntryWithBlob | null`; wire delta strip to real sizes; remove SSIM/Butteraugli/Decode rows | ~30 LOC |
| `src/hooks/useBatchOrchestrate.ts` | Ensure raster format branch wires per-file override into job settings | ~20 LOC |

### New files to create

| File | LOC estimate |
|------|-------------|
| `src/workers/jpeg-adapter.ts` | ~50 |
| `src/workers/jpeg-config.ts` | ~20 |
| `src/workers/webp-adapter.ts` | ~50 |
| `src/workers/webp-config.ts` | ~20 |
| `src/workers/avif-adapter.ts` | ~50 |
| `src/workers/avif-config.ts` | ~20 |
| `src/lib/icc.ts` | ~200 (PNG+JPEG ICC only) |
| `src/components/panels/PngPanel.tsx` | ~60 |
| `src/components/panels/JpegPanel.tsx` | ~70 |
| `src/components/panels/WebpPanel.tsx` | ~70 |
| `src/components/panels/AvifPanel.tsx` | ~50 |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@squoosh/lib` | `@jsquash/{codec}` | jSquash forked ~2022, Squoosh archived 2023 | jSquash is the maintained successor; same WASM codecs |
| Monolithic codec bundle | Per-codec lazy-load | Phase 2 design decision | AVIF WASM not fetched until needed |
| Phase 4 N-FileEntries fan-out | Single FileEntry per source (D-11) | Phase 5 architectural decision | Export-time variant generation (Phase 7) |
| `addSourceWithVariants` drop handler | `addFile()` single entry | Phase 5 | Simpler state; less memory |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite 7.3 automatic code-splits `avif-adapter.ts` into separate chunk via dynamic `import()` | Architecture Patterns Pattern 6 | AVIF WASM would not be lazy-loaded; fails SC-5. Mitigation: verify with `npm run build` and inspect chunk manifest. |
| A2 | `@jsquash/oxipng` export name is `optimise` (British spelling, as used in jSquash source) | OxiPNG Pipeline Pattern 2 | Compile error. Mitigation: check `@jsquash/oxipng` README after install. |
| A3 | JPEG ICC is stored in APP2 segments with multi-segment reassembly logic needed for large ICC profiles | ICC section | ICC extraction may be incomplete for large profiles. Mitigation: test with images that have ICC profiles > 65521 bytes. |
| A4 | `@jsquash/jpeg` encode accepts `{ quality, progressive }` (not `mozjpeg`-specific options) | Standard Stack | Wrong option names → encode ignores settings. Mitigation: check README after install. |
| A5 | CenterPane's existing `useEffect` blob URL lifecycle (lines 23–30) is correct and requires no changes | CenterPane Pattern 5 | Could cause blob URL leaks. Mitigation: verify with DevTools Memory tab after Phase 5. |

---

## Open Questions

1. **OxiPNG import name**
   - What we know: Package is `@jsquash/oxipng`; not yet installed.
   - What's unclear: Export function name (`optimise`? `optimize`? default export?).
   - Recommendation: Wave 0 — after `npm install @jsquash/oxipng`, read the README before writing png-adapter.ts changes.

2. **@jsquash/jpeg chroma subsampling option**
   - What we know: `CodecSettingsJpeg` has `quality` and `progressive` but not `chroma`. CONTEXT.md mentions "chroma" as a MozJPEG option.
   - What's unclear: Whether `@jsquash/jpeg` exposes chroma subsampling as an option.
   - Recommendation: Check `@jsquash/jpeg` README after install. If chroma option exists, add to `CodecSettingsJpeg`. If not, the JpegPanel only shows quality + progressive.

3. **enqueuePreview for raster formats — format branch**
   - What we know: `enqueuePreview` in runtime.ts is hardcoded for SVG format (reads SVG settings, uses `svg-adapter` format string). [VERIFIED: runtime.ts lines 258+]
   - What's unclear: Does the current `enqueuePreview` need to be format-aware, or should Phase 5 add a separate `enqueueRasterPreview(fileId, format)` action?
   - Recommendation: Make `enqueuePreview` format-aware by reading `FileEntry.format` and merging the correct settings slice with the per-file override.

4. **Phase 4 fan-out dead code — safe to remove?**
   - What we know: `addSourceWithVariants` and `removeFamily` are marked for dead-code review (D-11). Playwright tests exist.
   - What's unclear: Whether any existing Playwright test directly calls `addSourceWithVariants` (would break on removal).
   - Recommendation: Planner should grep Playwright spec files for `addSourceWithVariants` before deciding to remove vs. mark deprecated.

5. **Drop handler location — where does `addFile` single-entry call live?**
   - What we know: Phase 4 drop handler calls `addSourceWithVariants`. Phase 5 supersedes with single-FileEntry model.
   - What's unclear: Which file owns the drop handler (App.tsx? useBatchOrchestrate? useFilePicker?).
   - Recommendation: Read `src/hooks/useFilePicker.ts` before planning the drop handler change.

---

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** React 19 + Vite 7 + TypeScript 5.9 — no framework changes.
- **jSquash only:** `@jsquash/jpeg` IS MozJPEG. No `@jsquash/mozjpeg` package exists.
- **init() API:** Accepts `ArrayBuffer | null` + Emscripten Module opts. NOT a `Response` directly. The Vite dynamic import pattern auto-inits — no manual `init()` call needed.
- **Bundle budget:** Initial route < 200 KB JS gzipped. All codecs must be dynamically imported inside workers. No top-level static imports of codec WASM.
- **AVIF must be lazy:** Only fetched on first AVIF file. ~2 MB gzipped; would blow the 200 KB budget if eagerly loaded.
- **State pattern:** Zustand stores only; no Redux, no Context for codec state.
- **Worker pattern:** Comlink; no raw postMessage.
- **Privacy:** Zero telemetry; no outbound requests after WASM load.
- **A11y:** WCAG AA required; all codec panels must be keyboard-navigable with ARIA labels.
- **Vite 7 (not 8):** Downgraded from 8 to 7 for Apple Silicon rollup binding issue. [VERIFIED: STATE.md + package.json]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 (E2E) + `node --experimental-strip-types` (unit) |
| Config file | `playwright.config.ts` (exists from Phase 3/4) |
| Quick run command | `npx playwright test --grep "raster"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-02 | PNG + OxiPNG optimize reduces file size vs. original | E2E | `npx playwright test --grep "OPT-02"` | No — Wave 0 |
| OPT-03 | WebP encode produces valid WebP output at quality 80 | E2E | `npx playwright test --grep "OPT-03"` | No — Wave 0 |
| OPT-04 | JPEG encode produces valid JPEG at quality 80 progressive | E2E | `npx playwright test --grep "OPT-04"` | No — Wave 0 |
| OPT-05 | AVIF encode produces valid AVIF; WASM chunk not in initial load | E2E | `npx playwright test --grep "OPT-05"` | No — Wave 0 |
| PIPE-02 | Settings change for one file re-optimizes only that file | E2E | `npx playwright test --grep "PIPE-02"` | No — Wave 0 |
| PIPE-03 | Global quality setting applies to new files; per-file override takes precedence | unit | `node --experimental-strip-types src/tests/settings.unit.ts` | No — Wave 0 |
| UI-03 | File list shows non-zero byte reduction after optimize | E2E | `npx playwright test --grep "UI-03"` | No — Wave 0 |
| UI-04 | Split slider shows original (left) vs optimized (right) for selected file | E2E | `npx playwright test --grep "UI-04"` | No — Wave 0 |
| UI-05 | Codec tab shows format-specific controls; Snippets tab shows SnippetPanel | E2E | `npx playwright test --grep "UI-05"` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --grep "raster"` (fast subset)
- **Per wave merge:** `npm test` (full suite including Phase 3/4 regression)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/tests/raster.spec.ts` — E2E covering OPT-02 through UI-05
- [ ] `src/tests/settings.unit.ts` — per-file override merge logic (PIPE-03)
- [ ] Install: `npm install @jsquash/jpeg @jsquash/webp @jsquash/avif @jsquash/oxipng`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — client-side tool |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | WASM codecs throw `AdapterError` on malformed input; caught in adapter try/catch |
| V6 Cryptography | No | No crypto in codec pipeline |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed AVIF/JPEG causes WASM trap | Tampering | `try/catch` around decode + encode; throw `AdapterError('avif', 'decode', ...)` |
| Large file exhausts WASM heap | Denial of Service | Memory budget gate from Phase 4 (pool admission control); `byteEstimate` field |
| User-supplied ICC data embedded without validation | Tampering | ICC bytes are extracted from the SOURCE file (user-supplied) and re-embedded — no injection vector; user is optimizing their own assets |

---

## Sources

### Primary (HIGH confidence)
- `src/workers/worker.ts` — ADAPTERS map, stub pattern, Comlink.transfer usage [VERIFIED in session]
- `src/workers/png-adapter.ts` — decode/encode/resize pipeline contract [VERIFIED in session]
- `src/workers/svg-adapter.ts` — adapter run() contract shape [VERIFIED in session]
- `src/stores/runtime.ts` — enqueuePreview debounce pattern, 200ms, pool cancel-and-restart [VERIFIED in session]
- `src/stores/settings.ts` — codec slices, defaults, setSvg/setPng/setJpeg/setWebp/setAvif actions [VERIFIED in session]
- `src/stores/files.ts` — FileEntryWithBlob shape, addSourceWithVariants, removeFamily [VERIFIED in session]
- `src/types/index.ts` — CodecSettingsPng/Jpeg/Webp/Avif, FileEntry, MockFile [VERIFIED in session]
- `src/data/defaults.ts` — DEFAULT_CODEC_* values [VERIFIED in session]
- `src/components/panels/CenterPane.tsx` — split slider implementation, blob URL lifecycle [VERIFIED in session]
- `node_modules/@jsquash/png/README.md` — oxipng note ("encode only"), decode/encode API [VERIFIED in session]
- `package.json` — installed packages; confirmed jpeg/webp/avif/oxipng NOT installed [VERIFIED in session]

### Secondary (MEDIUM confidence)
- CONTEXT.md D-09/D-10/D-14 — ICC no-op in Phase 4, Phase 5 owns implementation; oxipng LOC estimate 150–300 per format
- STATE.md — Vite downgraded to 7.3 for Apple Silicon rollup binding issue

### Tertiary (LOW confidence — ASSUMED)
- Vite 7 dynamic import code-splitting behavior for avif-adapter (A1)
- `@jsquash/oxipng` export name `optimise` (A2)
- JPEG multi-segment ICC reassembly details (A3)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json and node_modules verified; codec APIs checked via README
- Architecture: HIGH — based on verified codebase patterns from Phase 3/4
- Pitfalls: HIGH — derived from verified code (static ADAPTERS map comment, pool cancel-race, OxiPNG README)
- ICC preservation: MEDIUM — byte-level structure from training data (A3), no jSquash API confirmed via codebase comment

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (jSquash packages stable; low churn)
