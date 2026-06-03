# Phase 12: Real Snippets - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The Output panel's three paste-ready snippets (Base64 data-URI, URL-encoded data-URI, `<picture>`), the Toolbar's three bulk copy actions (`Copy <picture> HTML`, `Copy as data URIs`, `Manifest JSON`), and **two new FileRow context-menu items** (`Copy <picture>`, `Copy data-URI`) all reflect the **actual encoded bytes** of the relevant done files — completing the drop → adjust → copy-paste promise. Requirement: **SNIP-01** (Output panel snippets reflect real encoded bytes, not stub placeholders).

Phase 6 (Inspector — Output + Report) shipped the Output panel layout + three section stubs and the Toolbar's three menu items pointing at empty stubs in `src/stores/files.ts`. Phase 9 wired real codec encodes; Phase 10 made `setFileResult` write the real `encodedBuffer`. Phase 11 wired single-file download, batch ZIP, FileRow ContextMenu (the D-04 menu pattern), `$hasDone` computed atom + disable-then-explain (D-13), and the global `<Toaster />` mount. Phase 12's job is the **last mile**: turn the existing snippet scaffolding into correct, paste-ready output, fill the three Toolbar stubs, add two per-row clipboard items, and pick a clipboard write strategy that survives Safari quirks.

</domain>

<decisions>
## Implementation Decisions

### URL-encoded data-URI dispatch (SNIP-01 SC-1, SC-2)
- **D-01:** The URL-encoded section **always emits a snippet** — never hidden, never disabled. **Dispatch by source kind**:
  - **SVG target** → true URL-encoded data URI: `background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg...");` — text is decoded as UTF-8 then run through `encodeURIComponent`, then the spec-required minimal unescaping (`'(' )' '!' '~' '*' "'" `) is restored for readability + 1990s url() quirks. Sanitise control chars first to keep the snippet valid CSS.
  - **Raster target (PNG/WebP/JPEG/AVIF)** → base64 fallback wrapped in `url()`: `background-image: url("data:image/webp;base64,UklGR...");`. Raster bytes URL-encoded would be larger than base64; falling back keeps the snippet useful. The section label stays `Data URI · URL-encoded`; the body just happens to be base64 for raster.
- **D-02:** Today's `src/lib/snippets.ts` `buildUrlEncodedSnippet` calls `FileReader.readAsDataURL` (base64 only) — it must be replaced with a kind-aware builder. Use a TextDecoder('utf-8') path for SVG and the existing FileReader path (or `btoa(String.fromCharCode(...new Uint8Array(buffer)))` chunked over 64KB blocks to avoid call-stack blowup on large AVIF) for raster.

### `<picture>` snippet shape (SNIP-01 SC-1, SC-2)
- **D-03:** The per-file `<picture>` snippet shape — **no `loading`/`decoding` attrs** (those are page-level perf choices, not snippet defaults):
  - Raster target ≠ source format: `<picture>\n  <source srcset="hero.webp" type="image/webp">\n  <img src="hero.png" alt="hero.png" width="2400" height="1600">\n</picture>` (whitespace as shown — 2-space indent, one newline per line).
  - Raster target === source format (e.g. user keeps PNG as PNG): bare `<img src="hero.png" alt="hero.png" width="2400" height="1600">` — no `<picture>` wrapper, no `<source>` (the `<source>` would be redundant).
  - **SVG target** → bare `<img src="hero.svg" alt="hero.svg" width="2400" height="1600">` — no `<picture>` wrapper. SVG doesn't need format negotiation.
- **D-04:** Width/height come from `file.dim` parsed via the existing `parseDim` helper. If `file.dim` is empty or unparseable, **omit width/height attrs entirely** (do not emit `width=""`). The `alt` defaults to the original `file.name` (same as today's stub). The `<source>` `srcset` value uses the swapped-extension base name from Phase 11's `renameExtension` (e.g. `hero.png` + target `webp` → `hero.webp`). The fallback `<img src=...>` uses the **original** filename (the source format) — that's the user's "drop original here if browser can't render webp" fallback. Note: `<picture>` ONLY references file paths — the actual bytes go in the exported ZIP / single download. Phase 12 does NOT inline `<picture>` as a data URI.

### Refresh + selection triggers
- **D-05:** The Output panel snippet sections re-render on **both** `$selectedFile` change AND `encodedBuffer` change (today's `useEffect` only depends on `file` identity, which misses re-encodes). The fix: depend the effect on `[file?.id, file?.encodedBuffer, file?.target]`. Phase 9's `useLiveEncode` pushes new `encodedBuffer` mid-edit; the Output panel must reflect that live so the developer can copy the result of their latest slider tweak without selecting the file again.
- **D-06:** Per-status presentation in the Output panel:
  - `status === 'done'` + `encodedBuffer != null` → real snippet (D-01/D-03 builders)
  - `status === 'processing'` (mid-encode) → **thin skeleton/loading row** in each section (signals staleness; copy button disabled with tooltip "Encoding in progress")
  - `status === 'queued'` → empty placeholder text "Optimize this file first" (same shape as the existing `output-empty` panel, but per-section so the sections still show their titles)
  - `status === 'error'` → disabled section with the error message (reuses Phase 9 D-13 per-file error state)
- **D-07:** Snippets are derived live in the Output panel component — no `snippetsAtom`, no caching. Snippet build cost is dominated by Base64 string allocation; rebuilding on every encodedBuffer change is acceptable and matches the project pattern (StatusBar derivation in Phase 11 D-01 / Plan 02).

### Toolbar bulk copy actions
- **D-08:** All three Toolbar bulk items operate on the **`$hasDone` set** (matches Phase 11 D-13 disable-then-explain pattern). Disabled with tooltip "Optimize at least one file first" when no file has `status === 'done'`.
- **D-09:** `Copy <picture> HTML` (Toolbar) → clipboard-write a concatenated string of **one `<picture>` block per done file**, using the same per-file `<picture>` builder from D-03 (so the snippet shape is identical to what the Output panel shows). Separator: a single blank line between blocks. Skips errored files. Toast on success: "Copied <picture> for N files".
- **D-10:** `Copy as data URIs` (Toolbar) → clipboard-write a string with **one data URI per line** for each done file. Each line is **ready to paste into `<img src="…">`**: i.e. the URI alone, no `<img>` wrapper, no CSS rule. Per D-01 dispatch — base64 for raster, URL-encoded for SVG. Toast: "Copied data URIs for N files". Note: this differs from the Output panel's URL-encoded section (which emits `background-image: url("…")`) — Toolbar bulk emits just the URI for `<img src>` paste-ability.
- **D-11:** `Manifest JSON` (Toolbar) → clipboard-write a JSON array of objects with fields `{ filename, target, originalSize, optimizedSize, quality }`. `filename` is the **swapped-extension** name per Phase 11 `renameExtension` (matches what lands in the ZIP). `quality` comes from `file.q` if defined, else `null`. JSON is pretty-printed (`JSON.stringify(arr, null, 2)`) so it pastes legibly into build configs. Toast: "Copied manifest for N files".

### FileRow per-row context-menu items
- **D-12:** The FileRow ContextMenu (wired in Phase 11 D-04) gains **two new items** alongside the existing `Save as…`:
  - `Copy <picture>` — calls the per-file `<picture>` builder (D-03) for this row's file and writes to clipboard. Toast: "Copied <picture> for {filename}".
  - `Copy data-URI` — calls the per-file data-URI builder (D-01: base64 for raster, URL-encoded for SVG), returns just the URI (ready for `<img src="">`), writes to clipboard. Toast: "Copied data-URI for {filename}".
- **D-13:** Both items are **disabled when `file.status !== 'done'`** with tooltip "Optimize this file first" — same disable-then-explain pattern as the Phase 11 row-level `Save as…` item. WCAG-AA keyboard support inherits from Radix ContextMenu primitives (no extra work; Phase 11 tests confirmed ESC + ArrowDown semantics).

### Clipboard write strategy
- **D-14:** Implement a `copyToClipboard(text: string, kind: 'snippet' | 'manifest' | 'data-uri', label: string)` helper in `src/lib/clipboard.ts`:
  - Try `navigator.clipboard.writeText(text)` first. Requires `window.isSecureContext` AND `'clipboard' in navigator` — feature-detect both.
  - On rejection / missing API / non-secure context: fall back to **hidden textarea + `document.execCommand('copy')`** — create a positioned-offscreen `<textarea>` with the text, select via `select()`, run `document.execCommand('copy')`, remove the node. Used by file-saver, well-tested across Safari/Firefox/old Edge.
  - **Toast on every call** — success: `${label} copied`; failure (both paths fail): `Copy failed — try again`. Uses the Phase 11 `pushToast` / sonner integration; do NOT throw to caller.
  - Return `{ ok: boolean, method: 'native' | 'execCommand' }` so callers can branch for analytics — but Phase 12 ignores the return value beyond the toast (zero-telemetry constraint).
- **D-15:** The clipboard helper is the **single chokepoint** for every snippet/manifest/data-URI copy in the app — Output panel sections, Toolbar bulk items, and the two new FileRow items all funnel through it. No direct `navigator.clipboard` calls elsewhere.

### Claude's Discretion
- The exact wiring that turns `src/lib/snippets.ts` builders into the D-01 + D-03 + D-04 shapes — extract a shared `buildDataUri(file): Promise<string>` that dispatches by `file.target === 'svg'`, then have `buildBase64Snippet` wrap it in `<img src=...>` and `buildUrlEncodedSnippet` wrap in `background-image: url(...)`. Avoid duplicating the encode loop across builders.
- Where the Toolbar bulk handlers live — a new `src/hooks/useSnippets.ts` or extend the Phase 11 `src/hooks/useExport.ts`. Project rule from CLAUDE.md / Phase 11 D-04 lands the business logic in hooks; recommend new hook to keep `useExport`'s purpose (download/ZIP) clean.
- Whether the URL-encoded SVG path uses Yoksel's compact percent-encoding (the de-facto CSS data URI standard) or strict `encodeURIComponent`. RFC 3986 vs CSS practice diverge — Yoksel's minimal-encoding is what designers expect to paste; strict encoding works but is ~10% bigger. Defer to researcher confirmation.
- Whether the FileRow ContextMenu's two new items live BEFORE or AFTER `Save as…` and whether they collapse under a sub-menu (`Copy ▸ <picture> / data-URI`) or sit as siblings. Recommend siblings for now (flat menu) — if the per-row menu grows past 5 items, a sub-menu refactor lands in a polish phase.
- How OutputPanel skeleton/empty/error per-section states are rendered — three new `<SectionState mode='loading|empty|error'>` components vs inline conditionals. Defer to UI-SPEC (or skip-ui path) and the planner.
- Whether `Copy data-URI` for SVG includes the `data:image/svg+xml;charset=utf-8,` prefix in the clipboard string (recommended — pasted into `<img src="…">` requires the prefix) or strips it (treating it as a CSS-only thing). Lock: include the prefix; it's what `<img src>` consumes.
- aria-live announcement on copy success — already covered by sonner toast; no extra live region needed (matches Phase 11 D-01 / Pitfall 4).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 12 block) — Goal, depends_on Phase 11, 3 Success Criteria (real bytes in snippets, paste-ready, refresh on file/re-optimize).
- `.planning/REQUIREMENTS.md` — `SNIP-01` (Output panel snippets reflect real encoded bytes).

### Project rules + stack
- `.planning/PROJECT.md` — Locked snippet targets (Base64 data-URI, URL-encoded, `<picture>`); active milestone v1.1 lists "Real paste-ready snippets — Output panel wired to actual encoded bytes".
- `./CLAUDE.md` § Technology Stack — React + Vite + TS; nanostores; sonner (toast surface for clipboard feedback); Radix ContextMenu (FileRow row menu); WCAG-AA. No new deps required.

### Carry-forward from prior phases
- `.planning/phases/06-inspector-output-report/` — INSP-07 OutputPanel + 3 stub builders in `src/lib/snippets.ts`. Phase 12 replaces the broken `buildUrlEncodedSnippet` (currently returns base64) and the `<picture>` builder that uses naming-only (D-04 keeps the naming approach but tightens the shape).
- `.planning/phases/11-batch-optimize-export/11-CONTEXT.md` — D-04 (FileRow ContextMenu pattern, WCAG-AA keyboard inherited from Radix), D-13 ($hasDone disable-then-explain). Reuse both verbatim for D-08/D-12/D-13 here.
- `.planning/phases/11-batch-optimize-export/11-05-SUMMARY.md` — `<Toaster />` mount in `src/App.tsx`; sonner emitter alive; D-14 clipboard helper toasts ride this.

### Codebase intelligence
- `src/lib/snippets.ts` — existing 3 builders; replace `buildUrlEncodedSnippet`, tighten `buildPictureSnippet`, keep `buildBase64Snippet` (already uses real bytes).
- `src/components/panels/inspector/OutputPanel.tsx` — Section/Copy button surface; useEffect dependency change (D-05) + per-status states (D-06).
- `src/stores/files.ts` — `exportCopyHtml` / `exportCopyDataUris` / `exportManifestJson` stubs (D-09/D-10/D-11 wire-up), `$hasDone` computed atom (D-08 reuse).
- `src/components/shell/Toolbar.tsx` — three bulk menu items currently calling empty stubs.
- `src/components/panels/files/FileRow.tsx` — Radix ContextMenu surface; Phase 11 wired `Save as…` here (D-12 adds two siblings).
- `src/lib/filename.ts` — Phase 11 `renameExtension` + helpers (D-04 + D-09 + D-11 swapped-extension names).
- `src/lib/stub-data.ts` — `FileEntry` type, `parseDim` consumer (today's `parseDim` lives in `snippets.ts`; consider moving to a shared util when extracting builders).
- `src/tests/snippets.test.ts` — existing Phase 6 unit test; expand for D-01/D-03/D-04 + adversarial inputs (no encodedBuffer, empty dim, SVG with control chars).

</canonical_refs>

<specifics>
## Specific Ideas

- **"Drop → adjust → copy-paste promise" is the phase's success state** — a developer drops a file, tweaks codec quality in the inspector, and the snippet they paste into their site already reflects the latest slider value without re-selecting the file. D-05 makes that work.
- **One chokepoint for clipboard** (D-14/D-15) — five different surfaces (Output panel × 3 sections, Toolbar × 3 items, FileRow × 2 items) all write through one helper. Cuts surface area for Safari bugs and keeps toast UX consistent.
- **Match Phase 11's disable-then-explain idiom** (D-08, D-13) — every bulk and per-row item that needs done files honours the same `$hasDone` + tooltip pattern users already learned in Phase 11.
- **Snippet shape locked at "no `loading`/`decoding`"** (D-03) — those attrs are page-policy decisions, not snippet defaults. Keeps the snippet honest and short.

</specifics>

<deferred>
## Deferred Ideas

- **1×/2×/3× density variants** in `<picture>` srcset (`hero.webp 1x, hero@2x.webp 2x, hero@3x.webp 3x`) — VAR-01 future milestone. Snippet shape can grow to host them when generation lands.
- **Multi-format `<picture>` fallback chain** (`<source type="image/avif"><source type="image/webp"><img src="hero.jpg">`) — requires multiple `target` outputs per file; out of scope this phase (one target per file today).
- **Snippet customization toggles** (alt text override, lazy loading on/off, JSX vs HTML output) — adds value but multiplies UI surface; revisit after dogfooding.
- **CSS-only snippet** (e.g. `.hero { background-image: url("data:..."); }` with class-name input) — the Output panel's URL-encoded section is the closest thing; full CSS-snippet builder is a polish addition.
- **Inline SVG snippet** (paste the entire `<svg>...</svg>` body, not a data URI) — could ship alongside Base64/URL-encoded for SVG sources. Deferred to gauge demand.
- **Manifest JSON in the ZIP** (the file-saved version of the Toolbar's Manifest JSON copy) — Phase 11 D-08 explicitly excluded `manifest.json` from the ZIP; revisit after Phase 12 dogfooding the clipboard-only flavour.
- **Copy-to-disk for `<picture>` HTML** (download an `.html` file instead of clipboard) — niche; clipboard covers the common case.
- **Snippet localization** (alt text in non-Latin scripts, RTL languages) — out of scope; emit alt = original filename.
- **Telemetry on copy success/method** — explicitly excluded by zero-telemetry constraint in CLAUDE.md.
- **Clipboard write of binary blobs** (`navigator.clipboard.write` with `ClipboardItem`) — only the text path is in scope (`writeText`). Binary clipboard for raster image bytes is a separate UX (paste-image-into-Photoshop) and not a snippet use case.

</deferred>

---

*Phase: 12-real-snippets*
*Context gathered: 2026-06-03*
