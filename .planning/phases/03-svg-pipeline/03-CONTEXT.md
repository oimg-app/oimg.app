# Phase 3: SVG Pipeline - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the first real codec — SVGO v4 (browser ESM) — behind the Phase 2 worker/adapter contract, with DOMPurify (USE_PROFILES.svg + svgFilters) running post-SVGO so XSS-laden SVGs are neutralized before anything reaches preview, snippets, or ZIP. Refactor `OutputPanel` into a generic `SnippetPanel` with per-snippet enable/disable checkboxes; the SVG generators (inline `<svg>`, URL-encoded data URI in yoksel's minimal-escape style) emit real bytes. SVGO settings are global in v1; toggling a plugin auto re-optimizes the inspected file via the existing worker pool with cancel-and-restart debounce; the rest of the batch waits for an explicit Optimize click. Phase 3 is text-in/text-out — no WASM lands here.

Codec WASM (PNG/WebP/JPEG/AVIF) is Phase 5. Per-file overrides, raster snippet generators, and inline-SVG ID-collision handling are Phase 5/6.

</domain>

<decisions>
## Implementation Decisions

### Sanitization Layering & Policy
- **D-01: Post-SVGO only.** DOMPurify runs as the final stage of the SVG adapter, after SVGO. Pipeline shape: `ArrayBuffer → TextDecoder → SVGO → DOMPurify → TextEncoder → ArrayBuffer`. SVGO's preset-default does NOT remove scripts; sanitization at the end is the actual security guarantee. Documented in adapter file header.
- **D-02: DOMPurify config = `USE_PROFILES: { svg: true, svgFilters: true }`.** Built-in SVG profile + svgFilters profile. Allows full SVG element/attribute set including filters/gradients/animations; blocks scripting & event handlers. No FORBID_TAGS overrides, no custom allow-list — battle-tested defaults.
- **D-03: When sanitization removes content → per-file badge in the file list, no toast.** When DOMPurify reports `removed.length > 0` (via the `uponSanitizeElement`/`uponSanitizeAttribute` hooks or post-call `DOMPurify.removed`), the FileEntry gets a `sanitized: true` (and ideally a `sanitizedCount: number`) flag. The file row renders a small "sanitized" indicator. No global toast — keeps batch UX quiet.
- **D-04: Single sanitized blob is the source of truth + 'unsafe export' as a global setting.** Default behavior: adapter returns sanitized bytes; file size, preview thumbnail, inline-SVG snippet, URL-encoded data URI, and ZIP all derive from one sanitized blob. A single global toggle in TweaksPanel ("Disable SVG sanitization on export") flips the adapter to skip the DOMPurify pass — clearly labeled as advanced. Default = sanitize. The toggle lives in `useSettingsStore.global` (or a new `globalDangerous` slice — Claude's discretion).

### Plugin UI Surface
- **D-05: Curated subset of ~10–12 high-impact plugins.** Reconcile the existing `defaults.ts` 22-plugin mock list (`SVGO_PLUGINS`) and 5-plugin record (`DEFAULT_CODEC_SVG.plugins`) into a single curated list of ~10–12 plugins. Suggested set (planner refines): `removeComments`, `removeMetadata`, `removeUselessDefs`, `cleanupIds`, `cleanupNumericValues`, `convertColors`, `convertPathData`, `mergePaths`, `minifyStyles`, `removeUnusedNS`, `removeViewBox`, `removeDimensions`. Source of truth: `useSettingsStore.svg.plugins` (a `Record<string, boolean>` keyed by plugin id). The existing visual-shell `SVGO_PLUGINS` array becomes obsolete — remove it.
- **D-06: Replace the mock '% saves' column with live per-plugin savings, computed for all files after each Optimize run.** On every Optimize batch completion, run `(N+1)` SVGO passes per file (one all-on baseline, one with each plugin disabled) and store per-plugin byte deltas. Display the plugin's batch-aggregate savings in `SvgoPanel`. Cost is acknowledged: ~12 plugins × 30 files = ~390 extra SVGO runs per Optimize. SVGO is fast and main work runs in the worker pool — flag for empirical perf check during planning, but ship it. (This is the user's explicit choice over cheaper alternatives.)
- **D-07: Default plugin state mirrors SVGO preset-default exactly, with contextual warnings on foot-gun plugins.** Don't override SVGO's defaults — what you toggle is what SVGO does. But surface a hint near `removeViewBox`, `removeDimensions`, and `cleanupIds` (and any other plugin a planner identifies as commonly mis-applied) explaining the impact (e.g. "Disabling viewBox can break responsive sizing in HTML embeds"). Hint UI: `<small>` text below the plugin row, or a tooltip — Claude's discretion. Note: `DEFAULT_CODEC_SVG.plugins.removeViewBox = false` in the existing defaults must be reconciled — either flip to SVGO default `true` per this decision, or document why we still keep our deviation. Planner decides after reading SVGO v4 preset-default.

### Real-time Re-optimize on Toggle
- **D-08: Plugin toggle auto re-runs SVGO only on the inspected/selected file. The rest of the batch waits for an explicit Optimize click.** Implements SC-2 ("real time") for the file the user is actively iterating on; keeps batch UX predictable. SVGOMG-style mental model.
- **D-09: SVGO settings are global in v1.** All SVG files share `useSettingsStore.svg`. No per-file overrides in Phase 3. Per-file overrides land in Phase 5 (which already owns UI-04 detail-view per-file overrides for raster) — that pattern can extend cleanly to SVG later.
- **D-10: Toggle data flow = store-subscriber → adapter run on selected file → markDone updates UI.** `useSettingsStore.subscribe` (or `subscribeWithSelector` slice) detects plugin/preset changes; if a SVG file is currently selected, enqueue a "preview" job through the existing `WorkerPool` (single-file path). The existing `useFilesStore.markDone` reactivity path updates the file row size delta and `SnippetPanel` snippet output for free. No synchronous main-thread SVGO calls.
- **D-11: Mass-toggle race = cancel + restart on each toggle, debounced ~200ms.** Each plugin flip within a 200 ms window coalesces; the previous in-flight preview job is cancelled (via Phase 2 D-02 terminate-and-respawn). Last-toggle-wins. No queue pile-up. Implementation can use a tiny scheduler in `useRuntimeStore` (e.g. `previewJobId: string | null` + a debounced `enqueuePreview(fileId)` action).

### Snippet Scope for Phase 3
- **D-12: Refactor `OutputPanel` into a generic `SnippetPanel` now.** Build a snippet registry where each snippet type has `{ id, label, applicableFormats: FormatId[], generate(file): string }`. Phase 3 implements: (a) `inline-svg` (SVG only), (b) `url-encoded-uri` (SVG only). Phase 5/6 plugs in `picture`, `img-srcset`, `data-uri-base64`, etc. Existing `OutputPanel.tsx` is replaced; the static placeholder strings disappear.
- **D-13: Per-file snippet enable/disable checkboxes ship in Phase 3.** SnippetPanel structure includes per-snippet checkboxes (SNIP-01). For SVG files, only `inline-svg` and `url-encoded-uri` rows are shown (Phase 6 generators for raster types are stubs that hide their rows when `applicableFormats` doesn't match the inspected file's format). Per-file checkbox state lives in `useSettingsStore` (e.g. `snippetTogglesByFileId: Record<string, Record<SnippetId, boolean>>`) — Claude's discretion on exact shape.
- **D-14: ID-collision handling for inline SVG is deferred to Phase 6.** Phase 3 emits the optimized SVG markup verbatim. STATE.md's Phase 6 flag stays open. Documented as a known limitation in the snippet output (no UI warning needed in Phase 3).
- **D-15: URL-encoded data URI mirrors yoksel's url-encoder strategy verbatim.** Encode only the characters that break in CSS contexts: `<` `>` `#`, and replace `"` with `'`. Leave UTF-8 + spaces alone. Smallest output, widely battle-tested, matches the reference repo cited in PROJECT.md (`inspired/url-encoder/`). The planner reads `inspired/url-encoder/` for the canonical implementation.

### Claude's Discretion
- Exact location of the "Disable SVG sanitization on export" toggle in the settings UI (TweaksPanel "Global" section vs a dedicated "Advanced" subsection)
- Whether `sanitizedCount` is just a boolean badge or shows the stripped element count
- The exact 10–12 curated plugin set (planner reads SVGO v4 preset-default and picks)
- The exact UI affordance for foot-gun warnings (inline `<small>` vs hover tooltip vs info icon)
- File layout: `src/adapters/svg/` (with `index.ts`, `sanitize.ts`, `snippets.ts`) vs flat `src/workers/svg-adapter.ts` + `src/lib/svg-snippets.ts`
- Snippet registry shape (functional registry vs class hierarchy)
- Per-snippet, per-file checkbox state shape in the settings store
- Whether `DEFAULT_CODEC_SVG.plugins.removeViewBox = false` flips to `true` or stays as our deviation (D-07 implies flip; planner verifies with SVGO v4 preset-default behavior)
- Error type taxonomy refinements for malformed SVG input (DecodeError vs ProcessError vs sanitizer-rejected vs SVGO crash)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Source of Truth
- `.planning/PROJECT.md` §Constraints + §Tech stack — SVGO v4 ESM browser bundle locked, MIT license, zero-server invariant
- `.planning/REQUIREMENTS.md` §Optimization (OPT-01), §Snippet Generation (SNIP-01, SNIP-03, SNIP-04), §Pipeline (PIPE-01)
- `.planning/ROADMAP.md` §Phase 3 — Goal, success criteria (4 items), depends-on Phase 2
- `.planning/STATE.md` §Blockers/Concerns — Phase 3 entry: "DOMPurify SVG profile config and SVGO plugin overrides (e.g., removeViewBox) need research during Phase 3 planning" (now resolved by D-02 + D-07)

### Phase 1 + 2 Contracts (must read before extending)
- `.planning/phases/01-shell-foundation/01-CONTEXT.md` — Hand-rolled UI primitives accepted (D-06); .dark class theme (D-08); pixel-faithful example-ui port (D-07)
- `.planning/phases/02-worker-harness-state/02-CONTEXT.md` — Adapter contract (D-04 ArrayBuffer in/out), adapter owns decode (D-05), two-state progress (D-06), object-URL discipline (D-10), Blob-only state (D-12), static ADAPTERS map in worker.ts (T-02-03)
- `.planning/phases/02-worker-harness-state/02-RESEARCH.md` — Worker harness research; cancel via terminate-and-respawn; Comlink.transfer semantics (Phase 3 reuses the cancel pattern for D-11 mass-toggle race)

### Adapter & Worker Plumbing (already written)
- `src/workers/types.ts` — `AdapterFormat` union (already includes `'svg'`), `AdapterRunResult`, `AdapterError` taxonomy, `WorkerProxyApi`
- `src/workers/worker.ts:25-27` — Existing `svg: () => throw new Error('not yet implemented (Phase 3)')` slot; Phase 3 replaces with `() => import('./svg-adapter')`
- `src/workers/stub-adapter.ts` — Reference implementation pattern (input.slice(0) + AdapterMeta)
- `src/workers/pool.ts` — `WorkerPool` (lazy spawn, FIFO, terminate-and-respawn cancel) — used by D-10 preview path and D-11 cancel-on-toggle

### State & UI Wiring
- `src/stores/settings.ts` — `useSettingsStore.svg: CodecSettingsSvg` already wired with `DEFAULT_CODEC_SVG`; D-09/D-10 extend setSvg to fire reactivity
- `src/stores/files.ts` — `useFilesStore.markDone(fileId, optimizedBlob, optimizedSize)` is the canonical reactivity path for D-10
- `src/stores/runtime.ts` — `urlCache` lifecycle (D-10 P2), POOL_SIZE export, batch lifecycle actions; D-11 likely adds a `previewJobId` slot
- `src/types/index.ts` — `CodecSettingsSvg` (preset + plugins record), `SvgoPlugin` (visual-shell type — D-05 may obsolete this), `FileEntry` (D-03 may add a `sanitized` flag)
- `src/data/defaults.ts` — `DEFAULT_CODEC_SVG` (5-plugin record) and `SVGO_PLUGINS` (22-plugin mock) — both touched by D-05; `removeViewBox: false` flip per D-07
- `src/components/panels/SvgoPanel.tsx` — Existing visual shell; D-05 + D-06 + D-07 rewrite the body to consume the curated plugin set + live savings + foot-gun warnings
- `src/components/panels/OutputPanel.tsx` — Replaced by new generic `SnippetPanel` per D-12

### External Library Docs (read for API surface, do NOT pin local snippets)
- SVGO v4 README + GitHub (https://github.com/svg/svgo) — `optimize()` API, `preset-default` plugin list, plugin override syntax (v4 dropped `extendDefaultPlugins`), browser ESM entry (`svgo/browser`)
- DOMPurify README (https://github.com/cure53/DOMPurify) — `USE_PROFILES`, `sanitize()` config, `DOMPurify.removed` array, `uponSanitizeElement`/`uponSanitizeAttribute` hooks
- yoksel/url-encoder source (`inspired/url-encoder/`) — Canonical minimal-escape implementation for D-15

### Reference Repos (inspection only, not vendored)
- `inspired/svgomg/` — SVGO plugin toggle UX, accordion settings panel, real-time re-optimize feel — references for D-05, D-06, D-08
- `inspired/url-encoder/` — Authoritative source for D-15 URL-encode strategy

### Privacy & Security
- `public/_headers` — COOP `same-origin` + COEP `require-corp` (Phase 1); SVG worker inherits isolation
- Phase 1 D-03 — `crossOriginIsolated === true` is mandatory; SVG adapter doesn't need SharedArrayBuffer (text path) but the constraint stays in force

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/workers/types.ts`** — `AdapterFormat` already includes `'svg'`; no type union changes needed.
- **`src/workers/worker.ts:22-40`** — Static `ADAPTERS` map already has the `svg:` slot (currently throws). Phase 3 just replaces the throw with `() => import('./svg-adapter')`. T-02-03 mitigation (no dynamic concatenation) preserved.
- **`src/workers/stub-adapter.ts`** — Verbatim template for `svg-adapter.ts`. Same `(input: ArrayBuffer, settings: unknown) => Promise<{ output, meta }>` signature; Phase 3 fills in TextDecoder → SVGO → DOMPurify → TextEncoder.
- **`src/stores/settings.ts:25-49`** — `svg: CodecSettingsSvg` slice already wired; `setSvg` action exists. D-09 reuses; D-10 adds a reactivity subscription path (or relies on existing `subscribeWithSelector`).
- **`src/stores/files.ts.markDone`** — Already revokes old objectURLs and updates byte delta. D-10 preview path lands on this method exactly.
- **`src/stores/runtime.ts.POOL_SIZE`** — Worker pool sizing decision already locked. D-11 cancel-on-toggle uses the existing `WorkerPool` cancel surface.
- **`src/types/index.ts.CodecSettingsSvg`** — `{ preset: 'default', plugins: Record<string, boolean> }` shape already correct for D-05. May need a `sanitize: boolean` (or `unsafeExport: boolean`) flag for D-04.
- **`src/components/panels/SvgoPanel.tsx`** — Existing visual shell with toggleable plugin rows; D-05 rewrites the body but the component shape stays (props update to take the curated set + live savings).
- **`src/components/panels/OutputPanel.tsx`** — D-12 deletes/replaces this with `SnippetPanel`. The clipboard copy pattern (lines 21–33: `navigator.clipboard.writeText` with WR-04 wait-for-resolve guard, sonner error toast) is preserved verbatim in the new SnippetPanel.

### Established Patterns
- **Hand-rolled UI primitives accepted** (Phase 1 D-06). Phase 3 must NOT introduce shadcn for SvgoPanel or SnippetPanel — the existing `Section`, `Toggle`, custom checkbox/copy-button styles continue.
- **Static ADAPTERS map; no dynamic concatenation** (Phase 2 T-02-03). New adapter entries are explicit, code-reviewed.
- **Plan-per-module commit discipline** — Phase 2 plans shipped as 2–3 atomic commits each; Phase 3 follows the same atomic-task pattern.
- **Playwright over jsdom** — `src/tests/shell.spec.ts` runs in real Chromium; Phase 3 SVG tests follow (XSS-laden SVG fixtures must render in a real browser to validate `<script>` does NOT execute in the preview).
- **No Node-shimmed modules** — SVGO is imported as `svgo/browser` ESM; DOMPurify is imported from `dompurify` (browser-native by default). No polyfills.
- **Object-URL discipline** (Phase 2 D-10) — D-10 preview path must NOT bypass `markDone`'s revoke logic; replacing `optimizedBlob` reuses the existing revoke-old-then-write-new sequence.
- **Two-state progress** (Phase 2 D-06) — Preview re-runs ALSO emit only `started` / `done` / `error`. No percentage callbacks for SVGO mid-run.

### Integration Points
- **Toolbar Optimize button** — Already wired (Phase 2 plan 02-04). Phase 3's batch SVGO runs go through this path; per-plugin live savings (D-06) hook into the post-batch completion lifecycle in `useRuntimeStore`.
- **CodecPanel / TweaksPanel** — Inspector switches between the codec panel (raster settings) and the SVG plugin panel based on file format (`App.tsx:269` already toggles `tab` to `'svgo'` for SVG files). D-12 adds the snippet panel as the third inspector tab content for SVG.
- **`window.__OIMG_STORES__`** dev-only test exposure (Phase 2 plan 02-04) — Phase 3 Playwright specs use this to drive plugin toggles and assert post-sanitize SVG content.
- **sonner Toaster** — Already mounted (Phase 2 plan 02-04). D-03 explicitly says NO toast for sanitization events — but it stays available for clipboard-copy errors per the OutputPanel WR-04 pattern.
- **Phase 4 dependency** — `FileEntry.thumbnail` lifecycle (lazy-create + revoke). Phase 3 SVG previews use `URL.createObjectURL(new Blob([sanitizedSvgString], { type: 'image/svg+xml' }))` for the inspector thumbnail; revoke discipline already enforced by `useRuntimeStore.revokeObjectURL`.

</code_context>

<specifics>
## Specific Ideas

- **`inspired/url-encoder/` is the canonical reference for D-15.** The planner should read it (not just cite it) and replicate the encode set verbatim. yoksel's algorithm is short — bytes-out savings come from NOT encoding what doesn't need encoding.
- **`inspired/svgomg/` is the UX reference for D-05/D-06/D-08.** The plugin-toggle-and-watch-it-shrink feel is the entire SVGOMG product. Read its plugin panel and re-optimize trigger to validate the "auto on selected file" pattern (D-08).
- **XSS test corpus needed.** Plan an actual XSS-laden SVG fixture for SC-3: `<script>alert(1)</script>`, `<svg onload="...">`, `<a href="javascript:...">`, `<image href="javascript:...">`, `<use href="data:...">` are all real attack vectors. The Phase 3 Playwright spec must drop each through the pipeline and assert (a) DOMPurify removes them, (b) preview thumbnail does not execute them, (c) inline-SVG snippet does not contain them, (d) URL-encoded snippet does not contain them, (e) ZIP-extracted file does not contain them.
- **Sanitization-detection plumbing.** DOMPurify exposes `DOMPurify.removed` after each `sanitize()` call. The adapter should check `removed.length > 0` and surface a `sanitized: true` (and a count) in `AdapterMeta` — extends the existing `AdapterMeta` interface in `src/workers/types.ts` (just add an optional field; backwards-compatible).
- **Pipeline cost budget for D-06.** ~12 plugins × 30 files = ~390 extra SVGO runs per Optimize. Empirically this is fast — SVGO on a 10 KB icon is ~5–15 ms — but the planner should benchmark against a "worst case" of 100 KB illustration SVGs to confirm ceiling. If aggregate exceeds ~5 s on a representative batch, planner can degrade to D-06's "selected file only" alternative behind a feature flag (deferred per the user's choice, but worth a fallback).
- **Snippet registry, not snippet switch.** D-12 explicitly chose the registry design over a switch-on-format. Don't backslide into a `switch (snippetType)` block in the SnippetPanel render — the registry should be the only place new snippet types are introduced.
- **Phase 3 is the contract validator for Phase 5.** Phase 3 is the first non-stub adapter; if D-04 (sanitized blob is the source of truth) and D-13 (per-snippet checkboxes) are clean, Phase 5 raster encoders plug in mechanically. If Phase 3 introduces SVG-special branches in shared code, Phase 5 will inherit the debt.

</specifics>

<deferred>
## Deferred Ideas

- **Per-file SVGO overrides** — Defer to Phase 5/6 (per D-09). Phase 5 owns UI-04 detail-view per-file overrides for raster; the same pattern extends to SVG when added.
- **Inline-SVG ID-collision handling (auto-prefixing IDs)** — Defer to Phase 6 (per D-14). STATE.md flag stays open; Phase 3 emits markup verbatim.
- **Custom DOMPurify allow-list** — Rejected for v1 in favor of `USE_PROFILES.svg + svgFilters` (D-02). Re-open only if a real-world SVG breaks because of a profile gap.
- **Pre-SVGO sanitization (defense in depth)** — Considered and rejected (D-01). Re-open only if SVGO is ever shown to construct exploitable content in the wild.
- **Toast-style sanitization warnings** — Considered and rejected in favor of per-file badges (D-03). Re-open if user testing shows the badge is missed.
- **Aggregate sample savings from a built-in fixture corpus** — Considered as alternative to D-06; rejected in favor of live measurement.
- **'Aggressive mode' butteraugli warning** — The existing `SvgoPanel.tsx` already renders an "Aggressive mode" toggle with a butteraugli copy. SVG doesn't have a butteraugli concept (it's bitmap-perceptual). Phase 3 should either repurpose the toggle for "enable non-default SVGO plugins" or remove it. Defer the decision to the planner; if removed, capture as a Phase 3 cleanup deferred from Phase 1's example-ui port.
- **Deep custom plugin configuration UI** — Deferred. SVGO plugins like `cleanupIds` accept config (e.g. `prefixIds: 'foo-'`). Phase 3 ships boolean on/off only. Per-plugin config UI (sliders, text inputs) is a Phase 6+ concern if users ask.

</deferred>

---

*Phase: 3-SVG Pipeline*
*Context gathered: 2026-05-01*
