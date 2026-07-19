# Phase 9: Codec Encoders - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Every codec in the locked jSquash + svgo surface gets a real worker-side adapter (decode → encode), and the inspector's existing controls actually shape the encoded bytes. Covers ENC-01..06: PNG/OxiPNG, WebP, JPEG (MozJPEG), AVIF (lazy), SVG (svgo v4), and settings-driven output.

This phase replaces the Phase 8 stubs (codecs that throw NotImplemented; `useOptimize` passing 0-byte placeholder buffers) with real encoding driven by real file bytes. It does NOT add new capabilities beyond the locked codec surface — batch ZIP export, output snippets, and density variants are other phases/milestones.

</domain>

<decisions>
## Implementation Decisions

### Output format & per-file settings model
- **D-01:** **Per-file settings.** Each file owns its complete settings — target format/codec, quality (`q`), effort (`method`), lossless, resize, metadata flags, and (for SVG) plugin toggles. The current single global `settingsAtom` is refactored so settings are per-file. (Squoosh-per-image model.)
- **D-02:** The global settings panel becomes (a) the **default** applied to newly-added files, and (b) an explicit **"Apply to all"** bulk action that pushes the current global settings onto every file in the batch. It is no longer the single source of truth for all files.
- **D-03:** The inspector edits the **currently-selected file's own** settings. Selecting a different file shows that file's settings.
- **D-04:** Format selection is a real **conversion**: any source decodes (jSquash decode) then re-encodes to the file's chosen target format (PNG→WebP, JPEG→AVIF, etc.) — not optimize-in-place-only.

### Live re-encode behavior
- **D-05:** Editing the **inspected file's** settings **debounce-re-encodes only that file**, with the live before/after delta shown via the existing `CompareStage` / `DeltaStrip`.
- **D-06:** Changing the **global/default** panel does NOT live-re-encode the batch. The batch re-encodes only on explicit **"Apply to all."** (Rejected: re-encoding the whole batch on every global keystroke.)
- **D-07:** The per-file live re-encode is debounced to avoid thrashing the WorkerPool while a slider is dragged (interval is Claude's discretion, ~250–350ms).

### SVG engine (ENC-05)
- **D-08:** Run **svgo v4 inside the codec worker** (consistent off-thread model, no main-thread jank), lazy-imported into the worker chunk the same way the raster codecs are. (Resolves the Phase 8 deferred question.)
- **D-09:** svgo config = `preset-default` + `overrides`; the **SvgoPanel's existing curated plugin toggles** drive the overrides (curated subset, NOT the full preset-default plugin list).

### Resize & metadata (ENC-06)
- **D-10:** **Wire single-image resize this phase** using the existing `resizeOn` / `w` / `h` / `alg` / `fit` controls via `@jsquash/resize`, applied **before** encode.
- **D-11 [deferred]:** 1×/2×/3× **density variants remain deferred** to a future milestone (per PROJECT.md) — single-image resize only.
- **D-12:** **strip-metadata default stays ON**; `keepIcc` is opt-in. Per-codec EXIF/ICC handling specifics are for research to map.

### Failure / unsupported handling
- **D-13:** On encode failure or unsupported format (e.g., AVIF decode on older Safari), mark the file with a **per-file error state** in the list AND surface a **sonner toast**; keep the **original bytes as fallback output** so the batch (and future ZIP) still completes. Other files continue optimizing.

### Claude's Discretion
- Where per-file settings physically live (extend `filesAtom` per-file vs a separate per-file settings map keyed by file id) — follow the existing nanostores `map`+`setKey` pattern; researcher/planner decide.
- Debounce interval for the live re-encode (D-07).
- **decode-once caching** — decode raw bytes once and re-encode many times on live setting changes (strongly suggested for live-re-encode perf, but an implementation detail).
- Exact mapping of each control to each jSquash encoder option (q→quality, method→effort, lossless, JPEG progressive, AVIF quality, etc.) — research nails this from jSquash APIs. The decisions above lock the UX/state model, not the option plumbing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 9 section (goal + 4 success criteria)
- `.planning/REQUIREMENTS.md` — ENC-01..06
- `./CLAUDE.md` — locked codec surface: `@jsquash/{png,oxipng,webp,jpeg,avif,resize}`, svgo v4 `preset-default` + overrides, JPEG = MozJPEG (no `@jsquash/mozjpeg`), AVIF lazy-load + drops Safari <16.4 decode, <200KB initial-route budget, decode-then-encode for OxiPNG

### Phase 8 pipeline contract (the integration seam this phase builds on)
- `src/workers/codec.worker.ts` — the codec switch; add real adapters here. `EncodeJob` / `EncodeResult` types
- `src/lib/worker-pool.ts` — `getPool()` dispatch target; add `Comlink.transfer` (08-REVIEW WR-03) when real buffers flow
- `src/hooks/useOptimize.ts` — currently passes `ArrayBuffer(0)`; replace with real File→ArrayBuffer bytes
- `src/stores/settings.ts` — current GLOBAL settings atom; refactor to per-file (D-01)
- `src/stores/files.ts` — `filesAtom`; likely home for per-file settings + per-file error state (D-13)
- `src/components/panels/inspector/{CodecPanel,SvgoPanel,OutputPanel}.tsx` — the controls to wire to real encode
- `src/components/panels/center/{CompareStage,DeltaStrip}.tsx` — live before/after delta display (D-05)
- `.planning/phases/08-worker-pipeline-foundation/08-RESEARCH.md` — jSquash init patterns, MT, decode-then-encode, svgo deferral note
- `.planning/phases/08-worker-pipeline-foundation/08-REVIEW.md` — WR-02 (0-byte buffers), WR-03 (missing `Comlink.transfer`), CR-01 (`setJobCounts` setKey) — fold these fixes into the real-bytes wiring

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkerPool` / `getPool()` (Phase 8) — dispatch encode jobs through this; do not rebuild
- `codec.worker.ts` switch + dynamic-import discipline — extend each branch with a real adapter
- `CodecPanel` / `SvgoPanel` / `OutputPanel` (built in Phase 5/7, currently stub-driven) — wire to real settings + bytes
- `CompareStage` / `DeltaStrip` — display the live before/after for the inspected file
- Installed codecs: `@jsquash/{png,oxipng,webp,jpeg,avif,resize}`, `svgo` v4, `dompurify`

### Established Patterns
- nanostores `map<T>()` + `setKey` for state; `running` boolean derived from job counts (keep)
- Dynamic `await import('@jsquash/...')` INSIDE the worker switch (200KB budget); literal `new URL(...)` Worker URL
- File/optimize business logic lives in `src/hooks/*` + `src/stores/*`, never inline in components (project rule)

### Integration Points
- `useOptimize` is the seam: replace `src/lib/stub-data.ts` results + 0-byte buffers with real File→ArrayBuffer→pool→encoded bytes
- Per-file settings + per-file error state land in the files store (D-01, D-13)
- A live-re-encode path for the selected file feeds `CompareStage`/`DeltaStrip` (D-05)

</code_context>

<specifics>
## Specific Ideas

- Squoosh-style per-image editing is the explicit reference model (D-01, D-03, D-05).
- "Apply to all" is the bridge between per-file flexibility and the "drop a folder, set once, walk away" core value (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **1×/2×/3× density variants** (`@jsquash/resize` multi-scale) — future milestone (PROJECT.md). Single-image resize only this phase.
- **Batch ZIP export** (jszip) — separate phase (EXP-*).
- **Output panel snippets wired to real encoded bytes** (Base64 / data-URI / `<picture>` srcset) — separate requirement (SNIP-01); this phase produces the real bytes, snippet wiring is its own work.
- **Fully-live batch re-encode** (re-encoding the entire batch on every global setting change) — explicitly rejected in favor of per-file-live + apply-to-all (D-06).

</deferred>

---

*Phase: 9-Codec Encoders*
*Context gathered: 2026-05-26*
