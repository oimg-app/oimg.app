# Phase 4: Decode + Resize + Memory Model - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users declare per-file source density (1x/2x/3x) on raster files (PNG, JPEG, WebP, AVIF). The app decodes the source via `@jsquash/png` (and the corresponding decoders for the other raster formats — full encoder integration is Phase 5), resizes via `@jsquash/resize` to generate the user-selected target densities, and emits one Blob per density variant with `name@Nx.ext` filenames. The pipeline must stay below 800 MB peak heap on a 50-file batch and must not leak object URLs across a 20-file batch. Metadata (EXIF/XMP/IPTC) is stripped by default; ICC profile preservation is opt-in.

**In scope:**
- Per-file source-density UI (file row dropdown) + per-file target-density checkboxes
- Filename suffix templating (`name@1x.ext` / `name@2x.ext` / `name@3x.ext`) — wired into `FileEntry.name` so Phase 5/6 ZIP + snippet templating get the right strings
- One FileEntry per density variant, density encoded in id (e.g., `sourceUuid-1x`)
- `@jsquash/png` decode + `@jsquash/resize` (lanczos3 default) inside a worker adapter
- Global TweaksPanel "Resize/Variants" section with algorithm dropdown
- Global TweaksPanel "Preserve ICC color profiles" toggle (off by default)
- Per-file `resizeOverride` and `preserveIcc` data shape (UI in Phase 5)
- Soft-backpressure queue intake gate keyed off estimated in-flight bytes
- StatusBar backpressure indicator + first-throttle toast per batch
- Worker discards ImageData immediately after all variants encoded

**Out of scope (deferred to later phases):**
- Raster encoder integration for PNG/WebP/JPEG/AVIF — Phase 5 (this phase only ships decode+resize+stub-encode roundtrip; Phase 5 swaps in real encoders per format)
- UI-04 detail-view per-file override pickers for resize algorithm / ICC — Phase 5
- `<picture>` / `<img srcset>` snippet generators — Phase 6
- ZIP filename↔srcset gate — Phase 6/7

</domain>

<decisions>
## Implementation Decisions

### Density UI + Variant Generation

- **D-01:** **Per-file dropdown in file row picks source density (1x/2x/3x).** No global default. User sets density file-by-file. Matches the explicit-control bias of the file row (already hosts the format pill, sanitized badge, etc.).
- **D-02:** **Per-file checkboxes pick target densities (1x / 2x / 3x).** Source density auto-checked + locked (you can't NOT emit your source). User toggles the other two. Empty target set is invalid (UI prevents).
- **D-03:** **Filename suffix convention: `name@1x.ext` / `name@2x.ext` / `name@3x.ext`.** All variants suffixed (no asymmetric "baseline = no suffix" form). Matches Phase 6 SNIP-02 ROADMAP examples (`logo@1x.webp 1x, logo@2x.webp 2x`). Apple-Retina + srcset standard.
- **D-04 + D-14 (reconciled):** **Each density variant is its own FileEntry, density encoded in id** (e.g., `sourceUuid-1x`, `sourceUuid-2x`, `sourceUuid-3x`). Pool jobs stay 1:1 with FileEntries — preserves Phase 2 D-04 contract. `addFile(source, sourceDensity, targets[])` materializes `targets.length` FileEntries up front; each is its own pool job. urlCache keying remains the Phase 2 shape (`Record<fileId, string>`).
  - Trade-off: triples decode cost per source (3 jobs each call `@jsquash/png` decode independently) vs. simpler accounting + cancel/concurrency reuse from Phase 2. User chose simplicity. Planner should benchmark whether the extra decode cost violates the 100ms-per-2MB-file budget; if so, escalate as a deviation.
  - File row UI: visual grouping (parent source row + nested variants vs. flat-with-density-pill) is **Claude's discretion** — pick whichever reads cleanest in the existing FilePanel.
  - Comment at `src/App.tsx:519` (which assumed 1:N within one job) should be updated or removed during Plan A.

### Resize Algorithm

- **D-05:** **Default resize algorithm = `lanczos3`.** Photo-grade quality, slowest of the three. Squoosh's default. Acceptable cost in a worker pool with 4-way concurrency.
- **D-06:** **Algorithm exposed as a global TweaksPanel setting.** New "Resize / Variants" section in TweaksPanel hosts the algorithm dropdown (lanczos3 / triangle / hqx). Setting lives in `useSettingsStore.global` (or a new `useSettingsStore.resize` slice — Claude's discretion).
- **D-07:** **Per-file override data shape ships in Phase 4; per-file UI deferred to Phase 5.** `FileEntry.resizeOverride?: ResizeAlg` field is added now and threaded through to the adapter. Phase 5's UI-04 detail view delivers the picker. In Phase 4 every file inherits the global setting.

### Metadata Stripping + ICC Profile

- **D-08:** **Default = strip ALL metadata (EXIF/XMP/IPTC + ICC).** Privacy-first. Smallest output. Aligns with PROJECT.md zero-telemetry / zero-leak stance.
- **D-09:** **Global "Preserve ICC color profiles" toggle (off by default) + per-file override data shape.** Toggle lives in TweaksPanel "Privacy" or "Metadata" subsection (sibling to the SVG sanitization toggle). `FileEntry.preserveIcc?: boolean` field added now; per-file UI deferred to Phase 5 detail view. Same scope-split pattern as D-07.
- **D-10:** **Trust the jSquash decode→encode roundtrip for EXIF/XMP/IPTC stripping.** No active strip-pass code. ImageData is metadata-free by construction; encode emits clean output. ICC preservation (when D-09 toggle = on) is the only case requiring explicit handling — read ICC chunk on decode, thread through to encode. Planner research item: **verify the exact `iccProfile` (or equivalent) options across `@jsquash/png`, `@jsquash/jpeg`, `@jsquash/webp`, `@jsquash/avif`**; signatures may differ. Phase 4 ships the path for `@jsquash/png` (PNG is the only encoder running this phase via the existing stub-replacement pattern); Phase 5 extends to other formats.

### Memory Cap Mechanism

- **D-11:** **Stacked defense — discard ImageData immediately post-resize + soft backpressure.**
  - **(a) Worker discipline:** the resize adapter holds ImageData for the minimum time. Resize → Blob → ImageData = null in the worker scope before the worker reports `done`. No ImageData lives across job boundaries.
  - **(b) Pool admission gate:** before pulling the next job from the FIFO queue, the pool checks an estimated-bytes counter; if pulling would push the estimate above the budget, the pool waits until a worker frees up. Phase 2 D-11 already gates on worker count; this layers byte-awareness on top.
- **D-12:** **Memory budget = `0.75 × (navigator.deviceMemory ?? 4) × 1024` MB, capped at 600 MB.** Dynamic, device-aware. Safari/Firefox return `undefined` for `deviceMemory` → fallback assumes 4 GB → caps at 600 MB. Phones (deviceMemory = 2) → ~1.5 GB raw → 600 MB cap (still capped, but the formula scales down on cheap Chromebooks where deviceMemory may be 1 → 768 MB, also capped at 600). The 600 MB cap leaves 200 MB headroom under SC-2's 800 MB ceiling for non-pipeline browser overhead.
- **D-13:** **Backpressure visibility = StatusBar persistent indicator + first-throttle toast per batch.** When the admission gate first pauses queue intake during a batch, fire one Sonner info toast: "Pacing batch for memory". For the rest of that batch, a small badge / icon in StatusBar indicates active throttling. After batch completes, both clear. Mirrors the Phase 3 sanitized-badge pattern (per-row badge + no toast spam) but adapted to a global state.

### Claude's Discretion
- File row UI grouping for the N-FileEntries-per-source layout (parent/nested rows vs. flat-with-density-pill vs. collapsed-by-default group) — pick whichever reads cleanest in the existing FilePanel
- Exact location of the "Resize / Variants" TweaksPanel section (top-level vs nested under "Performance")
- Whether `useSettingsStore.global` gains the resize algorithm + ICC toggle, or whether a new `resize` / `metadata` slice is cleaner
- Exact byte-estimate formula for the admission gate (raw decode = `width × height × 4` typically; planner should add a safety multiplier for WASM heap overhead — research item)
- Whether the per-file source-density dropdown is in the file row directly or in a hover/expand affordance (file row is dense; a permanent dropdown crowds it)
- Worker-side ImageData disposal mechanism (explicit `imageData = null` + GC hint vs. function-scope GC vs. ArrayBuffer detach) — planner picks based on `@jsquash/resize` signature
- Naming: `resizeOverride` vs `resizeAlg` field on FileEntry (override implies "override the global"; alg is just a value)
- Backpressure StatusBar indicator visual (icon + tooltip vs. text badge vs. progress-bar pause-overlay)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codec / Resize Library Docs
- `node_modules/@jsquash/png/README.md` — decode + encode signatures, ICC option discovery
- `node_modules/@jsquash/resize/README.md` — algorithm enum (`hqx | triangle | lanczos3`), ImageData → ImageData contract
- `node_modules/@jsquash/jpeg/README.md` — for ICC-option contrast (Phase 5 will need this; flag during Phase 4 research to surface drift early)
- `node_modules/@jsquash/webp/README.md` — same rationale
- `node_modules/@jsquash/avif/README.md` — same rationale

### Project-Level Constraints
- `.planning/PROJECT.md` — zero-server / zero-telemetry stance (informs D-08 privacy-first), 200 KB initial JS gzipped budget (lazy-load codecs), 100 ms-per-2MB-file optimize budget (relevant to D-04 triple-decode trade-off)
- `.planning/REQUIREMENTS.md` — PIPE-04 (density variants), PIPE-01 (raster format support), OPT-06 (metadata + ICC)
- `.planning/ROADMAP.md` Phase 4 row — full success-criteria text (4 SCs)

### Prior Phase CONTEXT.md (carried-forward decisions)
- `.planning/phases/02-worker-harness-state/02-CONTEXT.md` — D-04 (adapter contract bytes-in/bytes-out, extends to N FileEntries per source), D-05 (adapter owns decoding), D-10 (lazy URL create + revoke on eviction/supersession), D-11 (streaming concurrency cap = worker count), D-12 (Blob-only state, no ImageData in stores)
- `.planning/phases/03-svg-pipeline/03-CONTEXT.md` — D-09 (settings global in v1 with per-file override deferred to Phase 5) — referenced as the reuse pattern for D-06/D-07/D-09

### Reference Implementations (READ ONLY — do NOT copy code; Squoosh is Apache 2.0 vs our MIT)
- `inspired/squoosh/` — reference patterns for resize quality vs perf trade-offs and memory disposal (read for ideas; cite in commits if a pattern is structurally borrowed)

### Privacy / Threat Surface
- `.planning/phases/03-svg-pipeline/03-CONTEXT.md` D-04 — sanitization toggle pattern (informs D-09 ICC toggle UI placement and copy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/workers/pool.ts`** — WorkerPool class with terminate-and-respawn cancellation + FIFO queue + AbortController-aware enqueue. Phase 4 extends with byte-aware admission gate; the Pool API additions stay minimal.
- **`src/workers/svg-adapter.ts`** + **`src/workers/svg-config.ts`** — adapter pattern model. Phase 4 raster adapter follows the same shape: pure config module + worker-facing adapter. New adapters: `src/workers/png-adapter.ts` + `src/workers/png-config.ts` (planner discretion on naming).
- **`src/workers/types.ts`** — `AdapterMeta` extends to include `density: '1x' | '2x' | '3x'`. AdapterFormat union grows: `'svg' | 'stub' | 'png-resize'` or similar (planner picks final shape).
- **`src/types/index.ts`** — `FileEntry` already has `sourceDensity: SourceDensity`. Phase 4 adds `resizeOverride?: ResizeAlg`, `preserveIcc?: boolean`, and the per-variant id convention. `SourceDensity` type already exists.
- **`src/stores/files.ts`** — `addFile` will materialize N FileEntries (one per target density). Add a `removeFamily(sourceId)` action so removing one variant can cascade if desired (Claude's discretion).
- **`src/stores/runtime.ts`** — `previewJobId` + `enqueuePreview` from Phase 3 are auxiliary-job patterns; Phase 4 admission gate adds a sibling field (e.g., `inflightBytes: number`).
- **`src/stores/settings.ts`** — global slice; add `resize: { alg: ResizeAlg }` and `metadata: { preserveIcc: boolean }` (or fold into existing `global`).
- **`src/components/shell/StatusBar.tsx`** — Phase 1 wired this; Phase 4 adds the backpressure indicator slot.
- **Sonner (`Toaster`)** — already wired in App.tsx. First-throttle toast just calls `toast.info(...)`.
- **`@jsquash/png`** — already in package.json. Decode is the entry point; encode comes in Phase 5 (Phase 4 may use a stub re-encode path or the real `@jsquash/png` encode if convenient — planner picks based on whether stub adapter satisfies SC-1's "non-zero byte reduction" check).

### Established Patterns
- **Adapter contract** (Phase 2 D-04): `(input: ArrayBuffer, settings: TSettings) => Promise<{output: ArrayBuffer, meta: AdapterMeta}>`. Phase 4 holds this shape exactly per FileEntry — N FileEntries means N adapter calls; the contract doesn't grow.
- **Auxiliary-job prefix discriminator** (Phase 3 D-06 + Phase 3 03-D-SUMMARY): jobIds prefixed with `preview-` / `savings-` skip runtime-store batch bookkeeping. Phase 4 does NOT use this prefix for variant jobs — variant jobs ARE primary work.
- **Per-row badge + no toast** for routine signals (Phase 3 sanitized badge); reserve toasts for one-time educational events (Phase 4 D-13 first-throttle). Don't overload either channel.
- **Settings-global with per-file override data shape (UI deferred)** (Phase 3 D-09): D-06/D-07/D-09 all reuse this; planner shouldn't reinvent.
- **Sanitized blob = single source of truth** (Phase 3 D-04): Phase 4 analog is "encoded variant blob = single source of truth for that density". Snippet generators (Phase 6) will derive from it.

### Integration Points
- **`src/App.tsx` startOptimize** — already iterates `filesState.order`. With N FileEntries per source, this iterates N× more entries; the existing loop works without change. The comment at `src/App.tsx:519` ("Phase 5 may introduce 1:N") gets resolved by D-04+D-14 → remove or update.
- **`src/components/panels/FilePanel.tsx` (TBD path)** — file row needs a density-source dropdown; a target-density checkbox group; visual grouping for variant rows. (FilePanel doesn't currently exist as a separate file — work area JSX is in `App.tsx` per the Phase 1 plan 05 comment. Planner verifies whether to extract or keep inline.)
- **TweaksPanel** — adds "Resize / Variants" + "Privacy" / "Metadata" sections. Existing accordion pattern (UI-05) accommodates.
- **StatusBar** — adds backpressure slot.

</code_context>

<specifics>
## Specific Ideas

- **Apple-Retina filename suffix `@2x` is canonical** — explicit user choice over hyphen / underscore variants. Downstream Phase 6 srcset templating bakes this in.
- **Privacy-first ICC default** — user accepted the color-shift trade-off rather than the color-fidelity trade-off. Reflects PROJECT.md's privacy-as-selling-point thesis.
- **User accepted triple-decode cost** for D-04+D-14 simplicity. If planner discovers this violates the 100ms/2MB budget by >2×, escalate as a deviation and propose the single-job-with-output-array alternative.

</specifics>

<deferred>
## Deferred Ideas

- **Single decode → N resize fanout inside one adapter job (output[] return shape)** — explicitly rejected for Phase 4 in favor of N parallel jobs. Revisit only if the triple-decode cost violates the per-file optimize budget (planner benchmarks during research).
- **Per-file UI affordances for resize algorithm + ICC override** — data shape ships Phase 4; UI lands Phase 5 detail view (UI-04).
- **Format-aware metadata defaults** (e.g., preserve ICC for JPEG/AVIF, strip for PNG/WebP) — rejected for Phase 4 as more opinionated than user wants. Could revisit in v2 if user feedback shows confusion.
- **User-configurable memory budget** — rejected for Phase 4. Dynamic deviceMemory-based formula handles common cases; expose a setting only if real users request it.
- **Filename suffix as user-configurable global setting** — rejected for Phase 4. Standardizing on `@Nx` keeps the entire ZIP+snippet pipeline simpler. Revisit if a build-tool integration in v2 demands a different convention.
- **Metadata-active-strip-pass implementation** — rejected for Phase 4. Trust the jSquash roundtrip; add a regression test if a future jSquash version changes behavior.
- **WeakMap-keyed urlCache** — explored in Phase 2 D-10, rejected (Blobs aren't weakly referenceable as keys directly). Phase 4 sticks with `Record<fileId, string>` per D-14.

</deferred>

---

*Phase: 04-decode-resize-memory-model*
*Context gathered: 2026-05-02*
