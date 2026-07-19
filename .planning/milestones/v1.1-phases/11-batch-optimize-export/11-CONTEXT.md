# Phase 11: Batch Optimize + Export - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The optimize loop scales from a single file to a folder of files. The user clicks an explicit "Optimize all", sees live per-file progress through the bounded worker pool while backpressure holds, downloads any individual optimized file to disk, and exports the entire optimized batch as a single ZIP. Requirements: **OPT-02** (batch + live per-file progress), **EXP-01** (single-file download), **EXP-02** (batch ZIP via jszip).

Phase 10 wired the explicit *single-file* loop (drop → encode → real Report numbers) and chose to auto-optimize on ingest. Phase 11's distinct deliverable is the **explicit "Optimize all" action with live batch progress** and **disk-bound output** (individual + ZIP). Snippet exports (copy `<picture>`/data-URI/manifest) remain Phase 12.

</domain>

<decisions>
## Implementation Decisions

### Live batch progress (OPT-02 SC-1, SC-4)
- **D-01:** Progress surfaces in **two places simultaneously**: each `FileRow` flips `queued → encoding → done` live as the batch advances, AND the `StatusBar` shows an aggregate `X/Y optimized` counter + an overall progress bar. Reuses the existing `FileRow` status-dot/progress-bar scaffold and the existing `StatusBar` worker-pip + `BackpressureIndicator`.
- **D-02:** The per-file "encoding" indicator is **indeterminate** — the existing `animate-pulse` dot / spinner pattern. Codec encodes are atomic (the worker returns one result per file; there's no honest intra-file percentage), so the determinate `FileRow` progress bar is NOT animated with a synthetic fill. It either stays empty during encoding or is hidden during encoding and only used for genuinely progress-emitting work in a later phase.
- **D-03:** `runOptimize` must write each result back **as the worker returns it**, not after `Promise.allSettled` resolves the whole batch (current code in `src/hooks/useOptimize.ts` calls `setFileResult` only after `allSettled`, which is why the queue currently never updates live during a batch). The planner / researcher chooses the exact mechanism (per-job `.then` callbacks, an iterating async loop with bounded concurrency, etc.), but the contract is: status transitions and the aggregate counter are observable while the batch is still running.

### Single-file download (EXP-01)
- **D-04:** The per-file download affordance lives in the **existing per-row "File options" context menu** (the `ctxbtn` on each `FileRow`) AND in a **"Download" button in the inspector** for the currently-selected file. No new standalone hover/row icon — keeps queue rows clean.
- **D-05:** Saved filename: **keep the base name, swap to the output extension** (e.g. `hero.png` ingested → re-encoded to WebP → downloads as `hero.webp`). No `.min` / `@1x` suffix. If `target === source`, the extension is unchanged.
- **D-06:** The Toolbar's existing "Save individually" menu item is wired as **sequential auto-downloads** to the browser's default Downloads folder (no save dialog per file). This delivers many optimized files at once without per-file prompt spam.
- **D-07:** The **single-file** download uses native `showSaveFilePicker` where available with a `file-saver` fallback (CLAUDE.md-locked stack). The bulk "Save individually" path uses the fallback delivery (file-saver / anchor click) for all files, since the picker per file is rejected by D-06.

### Batch ZIP export (EXP-02)
- **D-08:** ZIP contains **optimized files only** — one per source file. Originals are NOT included. A `manifest.json` is NOT included (the Toolbar's "Manifest JSON" stub is Phase 12 Snippets scope, not Phase 11).
- **D-09:** **Flat layout** — every optimized file at the ZIP root. Drag-drop and the file picker don't reliably preserve folder paths anyway; preserving paths is deferred.
- **D-10:** ZIP filename is **timestamped**: `oimg-export-YYYY-MM-DD-HHMM.zip`. Successive exports don't clobber each other. Same-name collisions **inside** the ZIP get a `(1)`, `(2)`, … suffix on the base name (`hero.webp`, `hero (1).webp`).

### Failed and unoptimized files
- **D-11:** "Optimize all" runs on files with **status ≠ `'done'`** (i.e. `queued` + `error`). Already-optimized files are skipped; their per-file re-encode on settings change is still owned by Phase 9's `useLiveEncode`. Cheapest re-run policy, matches the "drop a folder and walk away" framing.
- **D-12:** Files with errors (Phase 9 D-13 per-file error state) are **skipped from exports** — they are NOT in the ZIP and NOT included by "Save individually". The export feedback surfaces the skipped count (e.g. toast: "12 files exported, 2 skipped — fix and re-export"). Their original bytes are NOT used as a fallback.
- **D-13:** Export controls (single-file download, "Save individually", "All as ZIP") are **disabled (with explanatory tooltip) until ≥1 file in the queue has `status === 'done'`**. Prevents shipping a "batch" that's actually empty or originals-only, and removes the need for a separate "optimize first?" prompt.

### Claude's Discretion
- The exact wiring that turns `runOptimize` into a streaming-result loop (D-03): per-promise `.then(setFileResult)` callbacks vs an `async`/`for await` loop that awaits each `pool.run` individually vs a queue-of-promises with `Promise.race`. Bounded concurrency must continue to flow through the existing `WorkerPool` (no second pool, no second cap).
- The aggregate counter's derivation: from `runtimeAtom.runningJobs` + `queuedJobs` + the filesAtom `done` count, or via a new `batchProgressAtom`, or computed live in the StatusBar component. Prefer reusing `runtimeAtom` fields already plumbed by Phase 9 (`setJobCounts`).
- How the "File options" context menu is realized — `DropdownMenu` (shadcn) vs `ContextMenu` vs a custom popover off the existing `ctxbtn`. Use whichever matches the project's a11y bar (WCAG-AA — keyboard openable + ESC to close + arrow-key navigation).
- Whether "Save individually" is delivered via repeated `file-saver` calls, sequential anchor-clicks with `download` attribute, or a `for-await` over `pool.run` of a tiny "save" job. Performance vs throttling tradeoff — pick what doesn't trip browser anti-multidownload heuristics.
- ZIP generation strategy: in-memory `JSZip.generateAsync({ type: 'blob' })` vs streaming generation, and whether large batches need yielding to keep the UI responsive (the WCAG-AA responsiveness constraint applies during ZIP build too).
- Backpressure preservation under load: validating that adding the streaming-progress callbacks and the ZIP build don't break the existing `WorkerPool` concurrency cap (≤ min(hwConc, 4)). The post-merge gate should include a Playwright test that asserts the pool stays bounded during a ≥20-file batch (per SC-4).
- aria-live announcements during the batch (e.g. "5 of 12 files optimized"). Default: a single polite live region in StatusBar that updates as the aggregate counter advances. The researcher confirms whether this is needed for WCAG-AA on a non-modal progress region or if the existing pip `aria-label` is sufficient.
- Adding `jszip` and `file-saver` to `package.json` (currently MISSING from `dependencies`) — versions per CLAUDE.md "Companion Libraries" pins (`jszip ^3.10` confirmed 3.10.1; `file-saver ^2.0` confirmed 2.0.5). Add typed `@types/file-saver` too.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 11 block) — Goal, depends_on Phase 10, 4 Success Criteria (batch + progress, single-file download, batch ZIP, backpressure holds).
- `.planning/REQUIREMENTS.md` — `OPT-02` (batch + live per-file progress), `EXP-01` (single download with native + file-saver fallback), `EXP-02` (batch ZIP via jszip).

### Project rules + stack
- `.planning/PROJECT.md` — Locks `jszip` + `file-saver`; "Locked Decisions" section. Active item "Batch ZIP export via jszip" + "Output panel snippets" (snippets explicitly Phase 12).
- `./CLAUDE.md` § Technology Stack § "Companion Libraries" — `jszip ^3.10` (verified 3.10.1, 2025-03-14, locked in PROJECT.md); `file-saver ^2.0` (verified 2.0.5) for native + fallback. § Constraints — WCAG-AA, last-2-stable Chrome/Firefox/Safari/Edge, zero-server / zero-telemetry.

### Carry-forward from prior phase
- `.planning/phases/10-single-file-optimize-loop/10-CONTEXT.md` § "Implementation Decisions" — Phase 10 D-03 explicitly notes that the Phase 11 boundary is the **explicit** "Optimize all" + live per-file progress through the worker pool. § "Deferred Ideas" — same item is the third deferred bullet, owned by Phase 11.
- `.planning/phases/10-single-file-optimize-loop/10-VERIFICATION.md` (status: passed) — WR-01 status transition fix in `setFileResult` lands `'done'` per file; Phase 11 progress relies on that transition being live during the batch.

### Codebase intelligence
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md` — patterns to align with.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useOptimize.ts` — `runOptimize()` already iterates `filesAtom.get().entries`, builds jobs, runs `Promise.allSettled(pairs.map(([,,job]) => pool.run(job)))`. Phase 11 changes the **write-back timing** (per-job, not after `allSettled`) and adds a status-flip on dispatch so the queue updates live. Do NOT introduce a second dispatch loop.
- `src/workers/WorkerPool` (`getPool()`) — bounded Comlink pool, cap `min(hwConc, 4)`. Phase 11 reuses it as-is for backpressure; SC-4 verifies the cap holds during a ≥ N-file batch.
- `src/stores/runtime.ts` — `runtimeAtom` has `running`, `runningJobs`, `queuedJobs`, `encodingFileId`. `setJobCounts(running, queued)` is already called by `WorkerPool.onCountChange` (Phase 8 PIPE-04). The aggregate `X/Y optimized` counter can derive from these + the `done` count on `filesAtom`.
- `src/stores/files.ts`:
    - `setFileResult` already writes `status: 'done'` (Phase 10 WR-01 fix) — keeps live per-file transitions correct.
    - **Empty stubs** to implement: `exportAsZip()`, `exportIndividually()`. `exportCopyHtml()`, `exportCopyDataUris()`, `exportManifestJson()` stay deferred (Phase 12 Snippets).
- `src/components/panels/files/FileRow.tsx` — already renders a status dot (`STATUS_DOT[file.status]`) + a per-row progress bar (`width: prog * 100%`) when `status === 'processing'`. Phase 11 wires status transitions live; under D-02 the determinate bar stays empty during encoding (no synthetic fill).
- `src/components/shell/StatusBar.tsx`, `src/components/shell/BackpressureIndicator.tsx` — the aggregate progress surface. `worker-pip`'s `aria-label` ("Worker status: Running / Idle") already projects `runtimeAtom.running`.
- `src/components/shell/Toolbar.tsx` — "Optimize all" already calls `runOptimize`; the Export split group already exposes "All as ZIP" and "Save individually" menu items (currently calling the empty stubs).
- shadcn `DropdownMenu` / `Popover` (in `src/components/ui/`) — candidates for the per-row "File options" context menu (D-04).

### Established Patterns
- File business logic lives in `src/hooks/*` and `src/stores/*`, never inline in components (project rule from CLAUDE.md, confirmed Phase 10 D-03 / WR-01). Phase 11's batch-write-back, download, and ZIP logic land in hooks/stores. Components only wire events.
- "Component-rendered hidden input + caller-provided fallbackTrigger" pattern (Phase 10 WR-05) — the same pattern works for the inspector's "Download" button via `showSaveFilePicker` + `file-saver` fallback.
- Latch transient state via store subscribe + `waitForFunction` (Phase 10 NAV-02 de-flake) — Phase 11 e2e tests for SC-4 (backpressure holds) should use the same latch pattern on `runtimeAtom.runningJobs` peak vs the cap.

### Integration Points
- `Toolbar` "All as ZIP" / "Save individually" / "Optimize all" — entry points to the new export hooks.
- `FileRow` `ctxbtn` — entry point to the per-row File-options context menu (Download item).
- `Inspector` selected-file area — new "Download" button when `status === 'done'`.
- `StatusBar` — new aggregate `X/Y optimized` counter + bar, derived from `runtimeAtom` + filesAtom done count.
- `useOptimize.runOptimize` — change write-back timing to per-promise (D-03), filter input by `status !== 'done'` (D-11), and update `runtimeAtom` job counts via the existing `setJobCounts` pathway.
- `package.json` — add `jszip ^3.10`, `file-saver ^2.0`, `@types/file-saver`.

</code_context>

<specifics>
## Specific Ideas

- "Walk away with your results" — ROADMAP framing. The phase's success state is: a developer drops a folder, hits Optimize all, watches it run with per-row + aggregate progress, and ends up with a timestamped ZIP they can grab. Optimize-for-success-of-that-flow over edge-case configurability.
- Disable-then-explain (D-13) — exports being disabled with a tooltip is preferable to a "Optimize first?" interstitial dialog.
- Re-use existing visual scaffolds wherever possible (D-01, D-02) — the per-file dot/bar + StatusBar pip + BackpressureIndicator already exist from Phases 3/8/9. Phase 11 mostly *wires* them rather than introducing new chrome.

</specifics>

<deferred>
## Deferred Ideas

- **Per-format subfolder layout** in the ZIP (`webp/`, `avif/`, `png/`) — useful if the user ships per-format sets; revisit after Phase 12 / on user demand.
- **Preserve folder paths** (`webkitRelativePath`) in the ZIP — needs ingest to capture and propagate the path; useful for "drop a whole folder" use cases; deferred.
- **Manifest JSON** in the ZIP (per-file before/after sizes + settings used) — Phase 12 (Real Snippets) scope; the Toolbar's "Manifest JSON" menu item stays a deferred stub.
- **Copy `<picture>` HTML / Copy data URIs** — Phase 12 Snippets.
- **Save-to-folder via `FileSystemDirectoryHandle`** (showDirectoryPicker) — would let bulk save write directly to a chosen folder instead of the Downloads folder; not in scope for this phase, may revisit.
- **"Cancel batch" and resumability** — a Cancel button during a long batch and per-file retry. Real value but a separate UX scope; defer.
- **Include-originals option** in the export menu — explicitly rejected by D-08 / D-12; revisit only if user demand surfaces.
- **`showSaveFilePicker` per-file for "Save individually"** — explicitly rejected by D-06.
- **Optimize-all "re-run everything" mode** — explicitly rejected by D-11.

</deferred>

---

*Phase: 11-Batch Optimize + Export*
*Context gathered: 2026-06-01*
