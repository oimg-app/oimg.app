# Phase 10: Single-File Optimize Loop - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire real single-file ingestion (drag-drop + file picker) into the existing Phase 9 optimize pipeline so a dropped/picked asset produces real optimized output with truthful before/after byte sizes in the Report. Covers OPT-01 only.

Phase 9 already built: real codec adapters, per-file settings, real-bytes `useOptimize`, and debounced live re-encode. This phase supplies the **real File → FileEntry** path (the seam Phase 9 left stubbed) and replaces fabricated seed sizes with honest ones. It does NOT add the explicit "Optimize all" batch button with live per-file progress through the worker pool — that is **OPT-02 / Phase 11**.

</domain>

<decisions>
## Implementation Decisions

### Ingestion & entry point (OPT-01)
- **D-01:** Wire BOTH the existing dropzone (FilesPane "Drop images to optimize") AND the file picker (the "Add files" button + Toolbar "From device"). Today `addFromDevice`/`addFromUrl`/`addWatchFolder` in `src/stores/files.ts` are empty stubs and the dropzone has no handlers — this phase makes them real for device/drop ingestion.
- **D-02:** When multiple files are dropped/selected at once, add ALL of them to the file list and auto-select the newest.
- **D-03:** All ingested files **auto-optimize immediately** on ingest using their default per-file settings (Squoosh-style auto-optimize-on-load). The user accepted that auto-optimizing every dropped file pulls some batch-like behavior into Phase 10; the Phase 11 boundary is preserved because Phase 11's distinct deliverable is the **explicit** "Optimize all" action with live per-file progress reporting through the worker pool (OPT-02), not ingestion-triggered optimization.

### Seeded demo files
- **D-04:** **Remove the seeded demo files entirely.** `filesAtom` no longer seeds the 12 `STUB_FILES` demo entries — the app starts empty with the dropzone as the first-run view (Inspector shows "Select a file", Report empty).
- **D-05:** **Test-fixture consequence (must be handled this phase):** several existing Playwright specs rely on the 12 seeded files being present on load — `navigation.spec.ts` (NAV-02 "Optimize all flips worker pip to Running"), `backpressure.spec.ts` (SHELL-02 / PIPE-04), `per-file-settings.spec.ts` (D-01/D-02/D-03), `inspector-tabs.spec.ts`, and `output-panel.spec.ts` (both select a file). With demos removed, these must be updated to **ingest a real file fixture first** (a shared Playwright helper that drops/selects a real file) before asserting. The Phase 9 `sampleBytesFor`/`defaultFileSettings` seeding helpers in `stub-data.ts` either move to a test fixture or feed the ingestion path; they must not leave the production list pre-populated.

### Accepted formats
- **D-06:** Accept only the decodable source set: `png`, `jpg`/`jpeg`, `webp`, `svg`, `avif`. Detect via file extension and/or MIME type.
- **D-07:** Unsupported files are **silently skipped** at ingest (no sonner toast). (Distinct from per-file *encode* failures, which still surface via the Phase 9 D-13 error state + toast + original-bytes fallback.)

### Truthful sizes
- **D-08:** `orig` = the real `File.size` of the ingested file (replaces fabricated seed `orig`). `opt` = the encoded result byteLength (already written by Phase 9's `setFileResult`). The Report panel and DeltaStrip show real before/after bytes and the resulting savings %. (Success criteria #1, #2.)
- **D-09:** Re-adjusting a setting re-optimizes and updates both the output and the reported sizes (Phase 9's `useLiveEncode` already does this for the selected file). (Success criterion #3.)
- **D-10:** Between ingest and first encode the entry shows real `orig = File.size` with `opt` pending (`—` / shimmer per UI-SPEC). Because D-03 auto-optimizes on drop, this pending window is brief.

### Claude's Discretion
- Exact dropzone event wiring (`dragenter`/`dragover`/`drop`, `preventDefault`, drag-active visual state) and the drop target's bounds (whole FilesPane vs the dedicated zone).
- Where ingestion logic lives — prefer a new `src/hooks/useIngest.ts` (or similar) + thin store actions, per the project rule that file/optimize logic lives in `src/hooks/*` + `src/stores/*`, never inline in components.
- `File → FileEntry` mapping: id generation, `name`, `type` from extension, `dim` (read via `createImageBitmap`/decode), initial `status`, and assigning `settings` via `defaultFileSettings(type, q)`.
- How auto-optimize-on-drop reuses `useOptimize` vs `useLiveEncode` (dispatch path for newly-ingested files).
- Reading image dimensions for the `dim` field.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 10 section (goal + 3 success criteria)
- `.planning/REQUIREMENTS.md` — OPT-01 (and the OPT-02 Phase 11 boundary)
- `./CLAUDE.md` — locked stack, zero-server/zero-telemetry, logic-in-hooks/stores rule, accepted codec surface

### Ingestion seam (the stubs this phase makes real)
- `src/stores/files.ts` — `addFromDevice`/`addFromUrl`/`addWatchFolder` empty stubs; `filesAtom` seed (currently `STUB_FILES` — to be emptied per D-04); `removeFile`; Phase 9 per-file actions (`setFileResult`, `setFileRawBuffer`, `setFileError`, `setFileSettings`)
- `src/lib/stub-data.ts` — `STUB_FILES` seed + `sampleBytesFor`/`defaultFileSettings`/`initFileSettings` (repurpose for ingestion defaults and/or test fixtures per D-04/D-05)
- `src/components/panels/FilesPane.tsx` — existing dropzone markup ("Drop images to optimize") + "Add files" button (both stubbed)
- `src/components/shell/Toolbar.tsx` — "From device" / "Watch folder" / "From URL or paste" menu wired to the stubs

### Optimize pipeline (reuse, built in Phase 9)
- `src/hooks/useOptimize.ts` — real-bytes batch dispatch (reuse for auto-optimize-on-drop)
- `src/hooks/useLiveEncode.ts` — debounced re-encode on settings change (success criterion #3)
- `src/components/panels/inspector/ReportPanel.tsx` — before/after sizes + savings display
- `src/components/panels/center/DeltaStrip.tsx` — size delta / savings strip
- `.planning/phases/09-codec-encoders/09-CONTEXT.md` + `09-SUMMARY` files — the per-file settings + encode contract

### Tests impacted by demo removal (D-05)
- `src/tests/navigation.spec.ts`, `src/tests/backpressure.spec.ts`, `src/tests/per-file-settings.spec.ts`, `src/tests/inspector-tabs.spec.ts`, `src/tests/output-panel.spec.ts` — update to ingest a real file fixture instead of relying on seeded demos

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useOptimize` (Phase 9): real File→ArrayBuffer→pool→encoded dispatch — the auto-optimize-on-drop path reuses this.
- `useLiveEncode` (Phase 9): re-optimizes the selected file on setting change (D-09).
- files store actions: `setFileResult`, `setFileRawBuffer`, `setFileError`, `setFileSettings`, `removeFile`, `selectFile`.
- `defaultFileSettings(type, q)` + `initFileSettings` in `stub-data.ts`: build complete per-file settings for a new real entry.
- FilesPane dropzone + "Add files" markup already exist — only handlers are missing.
- DeltaStrip / ReportPanel already render from `entry.orig`/`entry.opt`/`encodedBuffer` — they show truthful numbers once `orig`/`opt` are real.

### Established Patterns
- nanostores `map` + atomic `setKey`; all entry mutations go through the single `updateEntry` helper added in Phase 9 (WR-02 fix).
- File/optimize business logic lives in `src/hooks/*` + `src/stores/*`, never inline in components (project rule).
- Codecs dynamic-imported inside the worker (200KB budget) — ingestion is main-thread; no codec imports leak.

### Integration Points
- New ingestion hook/handler → `filesAtom` entries (append; clear demos on first/at-init per D-04) → auto-optimize via `useOptimize`/`useLiveEncode` → `setFileResult` → DeltaStrip/ReportPanel show real sizes.
- Dropzone (FilesPane) + picker (`<input type="file">` behind "Add files"/"From device") both funnel into one ingestion entry point.

</code_context>

<specifics>
## Specific Ideas

- Squoosh's auto-optimize-on-load is the explicit reference for D-03 (auto-optimize ingested files immediately).
- The dropzone copy already exists verbatim: "Drop images to optimize."

</specifics>

<deferred>
## Deferred Ideas

- **"From URL or paste" ingestion** (Toolbar "From URL or paste") — clipboard-paste + client-side URL fetch; a separate ingestion mode for a later phase.
- **"Watch folder" ingestion** (Toolbar "Watch folder") — File System Access API directory watching; later phase.
- **Explicit "Optimize all" batch with live per-file progress through the worker pool** — OPT-02 / Phase 11. Phase 10 only auto-optimizes on ingest; Phase 11 owns the deliberate batch-run action and progress UI.

</deferred>

---

*Phase: 10-Single-File Optimize Loop*
*Context gathered: 2026-05-28*
