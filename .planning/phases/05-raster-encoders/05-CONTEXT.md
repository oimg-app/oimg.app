# Phase 5: Raster Encoders - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 wires real raster codecs (PNG/OxiPNG, JPEG/MozJPEG, WebP, AVIF) into the worker pipeline, activates a format-aware InspectorPane with per-file codec settings and debounced live re-optimize, and delivers the Squoosh-style split-slider detail view in CenterPane. The file list stays at **one FileEntry per source file** — Phase 4's N-FileEntries fan-out (`addSourceWithVariants`) is superseded by a single-FileEntry model. Density variant generation moves entirely to Phase 7 (ZIP export).

**In scope:**
- PNG encode via `@jsquash/png` + OxiPNG lossless optimization via `@jsquash/oxipng` (levels 0–6)
- JPEG encode via `@jsquash/jpeg` (MozJPEG: quality, progressive, chroma)
- WebP encode via `@jsquash/webp` (quality, method, lossy/lossless)
- AVIF encode via `@jsquash/avif` (quality, lossless) — lazy-loaded on first AVIF file
- All codecs lazy-init on first call (dynamic import per format on first job)
- Real ICC preservation for PNG (iCCP chunk) — closes Phase 4 D-10 AMENDED no-op; JPEG/WebP/AVIF ICC chains also wired
- Format-aware InspectorPane with Codec | Snippets tabs
- Per-file codec overrides: changing a setting for the selected file re-optimizes that file only
- Debounced live re-optimize on settings change (200 ms + pool cancel-and-restart)
- CenterPane split slider: click file row → activates; vertical drag handle; empty state = slider shell with no images
- Delta strip: Original / Optimized / Saved (real FileEntry data only)
- Density checkboxes (1x/2x/3x) in InspectorPane Codec tab — export-scope selectors only; stored on FileEntry, no re-optimize triggered

**Out of scope:**
- Actual resize / variant generation (Phase 7 reads target densities and generates variants at download time)
- ZIP export (Phase 7)
- Snippet updates for raster variants (Phase 6)
- SSIM / Butteraugli / decode-time metrics in delta strip (Phase 8)
- OxiPNG multi-thread (MT) build (Phase 8 performance pass)
- Phase 4 `addSourceWithVariants` fan-out machinery cleanup (planner assesses how much dead code to remove)

</domain>

<decisions>
## Implementation Decisions

### Codec Settings Panel

- **D-01:** **Format-aware InspectorPane.** Shows controls only for the selected file's format. Click a PNG → OxiPNG level + ICC toggle. Click a JPEG → quality + progressive + chroma. No file selected → Codec tab shows a "Select a file" prompt. Matches Squoosh's per-file approach. SvgoPanel already follows this pattern.
- **D-02:** **Per-file codec overrides active in Phase 5.** Each FileEntry stores a `codecOverride?: PerFormatSettings` field (or equivalent). When the user changes a setting in the Codec tab, it writes to that FileEntry's override and fires a debounced re-optimize for that file only. Global defaults apply when no per-file override is set.
- **D-03:** **InspectorPane has two tabs: Codec | Snippets.** Selecting a file auto-shows the Codec tab. The existing SnippetPanel moves into the Snippets tab. SvgoPanel (SVG) and new raster panels (PNG/JPEG/WebP/AVIF) all render inside the Codec tab, conditionally by format.
- **D-04:** **Debounced live re-optimize on settings change.** 200 ms debounce + pool cancel-and-restart, identical to Phase 3 SVG live re-optimize pattern (`useRuntimeStore.enqueuePreview`). Quality slider drag → new result appears within ~1 second.

### Split Slider / Detail View

- **D-05:** **Click file row → CenterPane activates.** Clicking any file in the FilesPane populates CenterPane with the split slider for that file. Clicking elsewhere (or pressing Escape) deselects. `useFilesStore.selectedId` is already wired to CenterPane.
- **D-06:** **Vertical drag handle, left = original, right = optimized.** `CenterPane.tsx` already has this implementation (drag + keyboard ArrowLeft/Right/Home/End). Phase 5 replaces `MockFile` prop with real `FileEntry` data; the split mechanism is unchanged.
- **D-07:** **Empty state = slider shell with no images.** When `selectedId` is null or the file has no blobs yet, CenterPane renders the image-frame with no background images (current behavior). No additional empty-state UI needed.
- **D-08:** **Delta strip: keep Original / Optimized / Saved (real data); remove mocks.** Remove the SSIM, Butteraugli, and Decode estimate rows — they are hardcoded mock values with no real computation. Original / Optimized / Saved are derived directly from `FileEntry.sourceBlob.size` and `FileEntry.optimizedBlob.size`.

### AVIF + Codec Lazy Loading

- **D-09:** **AVIF included in Phase 5** (SC-5 compliance). Lazy-loaded on first AVIF file processed — only then does the ~2 MB gzipped WASM bundle fetch.
- **D-10:** **All codecs lazy-init on first call.** Every adapter (PNG, JPEG, WebP, AVIF) uses a lazy-init pattern: the first job for a given format triggers `await import('@jsquash/{codec}')` inside the worker. The static ADAPTERS map remains as a routing table (no template-literal dynamic paths), but the WASM module init moves from module-load time to first-use time. This is consistent across all four formats and naturally satisfies SC-5 for AVIF.

### Density Model (Architectural Revision from Phase 4)

- **D-11:** **Single FileEntry per source file.** Phase 4's N-FileEntries fan-out (`addSourceWithVariants`, `sourceUuid-Nx` id convention, `removeFamily`) is superseded. One dropped file = one FileEntry = one optimize result in the file list. Planner should assess which Phase 4 fan-out code to remove vs leave as dead code.
- **D-12:** **Density checkboxes = export-scope selectors only.** The 1x/2x/3x checkboxes in the InspectorPane Codec tab record which density variants the user wants in the output (stored as `targetDensities: TargetDensity[]` on the FileEntry or in a per-file export-settings slice). They do NOT trigger re-optimization or variant generation during the optimize workflow.
- **D-13:** **Resize + variant generation deferred to Phase 7.** When the user downloads, Phase 7 reads each FileEntry's `targetDensities` and runs `@jsquash/resize` to generate the requested variants at that point.

### ICC Preservation

- **D-14:** **Phase 5 implements real ICC preservation for all four raster formats.** Phase 4 D-10 AMENDED wired the toggle as a no-op. Phase 5 closes the gap: PNG (iCCP chunk extract/embed), JPEG (APP2 ICC_PROFILE), WebP (ICCP metadata), AVIF (colr box of prof type). Planner should verify exact byte-level APIs across `@jsquash/{png,jpeg,webp,avif}` — they expose zero ICC options, so this requires manual chunk handling (~150–300 LOC per format). Phase 4 D-10 AMENDED estimates this; verify in research.

### Claude's Discretion
- Exact per-format codec controls UI layout (slider vs. number input for quality; OxiPNG level as slider 0–6 vs. dropdown)
- Whether per-file codec settings live in `FileEntry.codecOverride?: PerFormatSettings` or a separate `useSettingsStore.perFile` slice keyed by fileId
- Visual design of the Codec tab format indicator (pill showing format name, auto-detected from FileEntry.format)
- Source density selector placement in InspectorPane (above vs. below target density checkboxes)
- Which Phase 4 fan-out code to remove vs. leave as dead code (planner's call based on what would break tests)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codec Libraries
- `node_modules/@jsquash/png/README.md` — encode signatures, ICC iCCP chunk handling
- `node_modules/@jsquash/jpeg/README.md` — MozJPEG encode options (quality 0–100, progressive, chroma subsampling)
- `node_modules/@jsquash/webp/README.md` — WebP encode options (quality 0–100, method 0–6, lossy/lossless)
- `node_modules/@jsquash/avif/README.md` — AVIF encode options (quality, lossless); note: drops Safari < 16.4 support for decode (BigInt operations)
- `node_modules/@jsquash/oxipng/README.md` — OxiPNG levels 0–6; **encode-only** — must decode to ImageData first via `@jsquash/png`, then pass raw bytes to oxipng
- `node_modules/@jsquash/resize/README.md` — already used in png-adapter.ts; Phase 7 will call it for density variants

### Project-Level Constraints
- `.planning/REQUIREMENTS.md` — OPT-02 (PNG), OPT-03 (WebP), OPT-04 (JPEG), OPT-05 (AVIF), PIPE-02, PIPE-03, UI-03, UI-04, UI-05
- `.planning/ROADMAP.md` Phase 5 row — 5 success criteria (SC-1 through SC-5); SC-5 is the lazy-load gate
- `.planning/PROJECT.md` — 200 KB initial JS gzipped budget (all codecs must lazy-load); raster per-file budget: p50 ≤ 500 ms / 2 MB (Phase 4 D-15)

### Prior Phase Context (carried-forward decisions)
- `.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md` — D-10 AMENDED (ICC no-op in P4, Phase 5 owns real implementation), D-01/D-02 SCOPED (density editing was drop-time-only; Phase 5 supersedes with single-FileEntry model), D-15 NEW (raster budget p50 ≤ 500 ms / 2 MB)
- `.planning/phases/03-svg-pipeline/03-CONTEXT.md` — D-09 (live re-optimize debounce pattern); D-04 (sanitized blob = single source of truth → Phase 5 analog: encoded variant blob = single source of truth)
- `.planning/phases/02-worker-harness-state/02-CONTEXT.md` — D-04 (adapter contract bytes-in/bytes-out), D-12 (Blob-only state in stores, no ImageData)

### Existing Code to Read Before Planning
- `src/components/panels/CenterPane.tsx` — fully implemented split slider; Phase 5 replaces `MockFile` prop with real `FileEntry`; keep drag/keyboard mechanics as-is
- `src/workers/worker.ts` — static ADAPTERS map; JPEG/WebP/AVIF are `throw` stubs to replace with lazy-init adapters
- `src/workers/png-adapter.ts` — decode+resize pattern; Phase 5 adds real encode (OxiPNG pipeline)
- `src/stores/settings.ts` — codec slice structure; Phase 5 populates JPEG/WebP/AVIF entries
- `src/stores/files.ts` — `addSourceWithVariants` + `removeFamily` (Phase 4 fan-out, to be removed or marked dead code per D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/panels/CenterPane.tsx`** — complete split slider with blob URL lifecycle, drag handle, keyboard a11y. Phase 5 wires it to `useFilesStore.selectedId` and removes mock `file: MockFile` prop.
- **`src/workers/png-adapter.ts`** — decode + resize adapter pattern; Phase 5 adds oxipng encode step: decode → ImageData → resize (if needed) → raw bytes → oxipng → Blob
- **`src/workers/svg-adapter.ts`** — live re-optimize pattern: settings change → pool cancel-and-restart → new result. Raster adapters follow same contract.
- **`src/components/panels/SvgoPanel.tsx`** — per-format codec panel model; Phase 5 adds sibling panels: `PngPanel`, `JpegPanel`, `WebpPanel`, `AvifPanel`
- **`useRuntimeStore.enqueuePreview`** — debounced re-optimize entry point (Phase 3). Phase 5 reuses this for raster settings changes.
- **`src/stores/settings.ts`** — codec slice already exists; JPEG/WebP/AVIF entries need defaults populated

### Established Patterns
- **Adapter contract** (Phase 2 D-04): `(input: ArrayBuffer, settings: TSettings) => Promise<{output: ArrayBuffer, meta: AdapterMeta}>`. Phase 5 new adapters hold this shape exactly.
- **Lazy-init on first use** (D-10): adapter module-level `let module: SomeType | null = null`; first call checks `if (!module) module = await import('@jsquash/…')`. AVIF gets this; for consistency, all four raster adapters use it.
- **Settings-global with per-file override** (Phase 3 D-09 / Phase 4 D-06): global default in settings store; `FileEntry.codecOverride` overrides for that file. Same pattern as `resizeOverride` from Phase 4.
- **Auxiliary-job prefix discriminator** (Phase 3): preview- / savings- prefixes skip runtime-store batch bookkeeping. Phase 5 codec re-optimize jobs for a single file should use the `preview-` prefix so they don't skew batch progress.

### Integration Points
- **`src/components/panels/InspectorPane.tsx`** — Phase 5 adds Codec | Snippets tab structure; format-aware codec panel renders inside Codec tab
- **`src/workers/worker.ts` ADAPTERS map** — JPEG/WebP/AVIF stubs replaced with real lazy-init adapters; PNG stub-encode replaced with real OxiPNG pipeline
- **`src/stores/files.ts`** — `FileEntry` gains `targetDensities: TargetDensity[]` field and `codecOverride?: PerFormatSettings`; `addSourceWithVariants` + `removeFamily` become dead code (D-11)
- **`src/components/panels/FilesPane.tsx`** — file row click sets `useFilesStore.selectedId`; CenterPane reacts

</code_context>

<specifics>
## Specific Ideas

- **OxiPNG pipeline is 3-step:** decode raw PNG bytes → `@jsquash/png` decode to ImageData → (skip resize, 1:1) → raw bytes via `@jsquash/png` encode → pass to `@jsquash/oxipng` optimize. The oxipng output is the final Blob. Planner should benchmark this chain vs. direct `@jsquash/png` encode (oxipng adds ~50–200 ms per file at level 4).
- **Single FileEntry model is a clean break from Phase 4.** The `addSourceWithVariants` fan-out and `sourceUuid-Nx` id convention were the right call for Phase 4's scope, but the user confirmed the export-time variant generation model in Phase 5 discussion. This is not a regression — it's a deliberate architectural simplification.
- **ICC preservation is byte-level surgery.** No jSquash API for ICC. Planner must verify: for PNG, whether `@jsquash/png` decode exposes the raw iCCP chunk bytes; if not, need a separate PNG parser (pngjs or manual chunk walk). Estimated 150–300 LOC per format. May want to scope to PNG + JPEG only in Phase 5 and defer WebP/AVIF ICC to Phase 8.

</specifics>

<deferred>
## Deferred Ideas

- **OxiPNG MT (multi-thread) build** — `@jsquash/oxipng/mt` subpath requires SharedArrayBuffer; single-thread only in Phase 5. Phase 8 performance pass can enable MT if oxipng becomes a bottleneck.
- **SSIM / Butteraugli quality metrics in delta strip** — removed from Phase 5 CenterPane. If added later, they belong in a Phase 8 quality pass.
- **Decode-time estimate in delta strip** — was a hardcoded mock; removed. Phase 8 can compute estimated 4G decode time from file size.
- **Format-aware ICC defaults** (e.g., preserve ICC for JPEG/AVIF, strip for PNG/WebP as a smarter default) — rejected for Phase 5, too opinionated. Revisit in v2 if user feedback shows confusion.
- **ICC for WebP / AVIF** — if Phase 5 research shows the byte-level ICC work is >300 LOC per format, planner may scope to PNG + JPEG only and defer WebP/AVIF ICC to Phase 8.
- **Phase 4 fan-out machinery cleanup** — `addSourceWithVariants`, `removeFamily`, `sourceUuid-Nx` ids, `@Nx` filename suffix convention become dead code under D-11. Planner decides scope of removal (full removal if tests still pass; else leave with TODO).

</deferred>

---

*Phase: 05-raster-encoders*
*Context gathered: 2026-05-07*
