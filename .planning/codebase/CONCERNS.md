# Codebase Concerns

**Analysis Date:** 2026-05-14

---

## Tech Debt

**Circular ESM import graph (files ↔ runtime ↔ settings):**
- Issue: Three-way circular dependency between `src/stores/files.ts`, `src/stores/runtime.ts`, and `src/stores/settings.ts`. Worked around in `runtime.ts` with runtime `require()` calls inside `enqueuePreview` (lines 199–225), suppressed by `eslint-disable @typescript-eslint/no-require-imports`.
- Files: `src/stores/runtime.ts` (lines 199, 201, 224), `src/stores/files.ts`, `src/stores/settings.ts`
- Impact: `require()` is unavailable in native ESM workers; a comment in `files.ts` (Phase 6 note) states this was fixed for browser context, but it remains a violation of ESM semantics and breaks `node --experimental-strip-types` unit test isolation. Any future unit test importing `runtime.ts` cannot safely call `enqueuePreview`.
- Fix approach: Extract a thin `svg-pipeline-actions.ts` module that imports from all three stores at the leaf level, breaking the cycle. `enqueuePreview` moves there.

**Deprecated `addSourceWithVariants` / `removeFamily` still in active call paths:**
- Issue: Both functions are marked `@deprecated Phase 5 D-11: superseded by single-FileEntry model` in `src/stores/files.ts` (lines 179, 265) but are still called from `src/hooks/useFilePicker.ts` and exposed via `src/stores/index.ts`.
- Files: `src/stores/files.ts`, `src/hooks/useFilePicker.ts`, `src/stores/index.ts`
- Impact: Raster.spec.ts Playwright tests depend on the old model — the deprecation comment explicitly notes "Do NOT remove until Playwright raster.spec.ts tests are updated." Dead code accumulating in the critical store.
- Fix approach: Migrate `raster.spec.ts` to `addFile()`, then delete both deprecated functions and update `useFilePicker.ts` accordingly.

**`MockFile` view-model persists in production components:**
- Issue: `FilesPane.tsx` imports `MockFile` from `@/types` and derives a `SHELL_FILES: MockFile[]` array from the real store via `useMemo`. `ReportPanel.tsx` accepts `files: MockFile[]` as its only prop. `MockFile` was a Phase 1 visual-shell type; Phase 5 introduced real `FileEntry` but the mapping layer was never removed.
- Files: `src/components/panels/FilesPane.tsx` (lines 13, 136, 231–243), `src/components/panels/ReportPanel.tsx`, `src/types/index.ts`
- Impact: Extra mapping on every render; risk of divergence between `MockFile` shape and real data; removes ability to surface new `FileEntry` fields (e.g., `targetDensities`) in the file list without changing the mapping code.
- Fix approach: Replace `MockFile` props with `FileEntryWithBlob` directly and delete the `SHELL_FILES` derivation in `FilesPane`.

**`optimizeAll` and `exportFiles` are permanent stubs:**
- Issue: `src/stores/runtime.ts` exports `optimizeAll()` and `exportFiles()` with `// @TODO` bodies — empty functions that show a toast template string "Settings applied to all {Extension} files" (also `applyToAllFiles` in `files.ts` line 68).
- Files: `src/stores/runtime.ts` (lines 63–70), `src/stores/files.ts` (lines 64–69)
- Impact: "Apply to all" and ZIP export are silently no-ops. The user-facing "Apply to all" button in `InspectorPane` calls `applyToAllFiles` (wired) but the function body is empty.
- Fix approach: Implement `applyToAllFiles` using existing `settingsStore.perFile` infrastructure; implement `exportFiles` with `jszip` (already listed as locked dependency in CLAUDE.md but not yet installed).

**`filterBy` is a permanent stub:**
- Issue: `src/stores/files.ts` exports `filterBy(_value: string)` as an empty function (line 63). The `filterQuery` field exists in the store but is never written.
- Files: `src/stores/files.ts` (line 63), `src/components/panels/FilesPane.tsx`
- Impact: Search/filter in the files pane is non-functional.
- Fix approach: Implement `filterBy` to set `filterQuery`; derive filtered display list in `FilesPane`.

**`setSort` only supports two sort modes, one of which is a no-op:**
- Issue: `setSort('queue order')` in `src/stores/files.ts` calls `filesStore.setKey('order', s.order)` — sets order to itself.
- Files: `src/stores/files.ts` (lines 106–113)
- Impact: Sort-by-queue-order does nothing; sort-by-file-size uses `originalSize` only (no secondary sort key).
- Fix approach: Minor — `queue order` branch should be a no-op by design if it's resetting to original, but the comment should make this clear; consider adding name-based sort and a descending size option.

---

## Known Bugs

**`optimizedMeta.height` copies `width` (typo):**
- Symptoms: Every file entry created by `addSourceWithVariants` has `optimizedMeta.height = dims?.width ?? 0` instead of `dims?.height ?? 0`.
- Files: `src/stores/files.ts` (line 236): `height: dims?.width ?? 0,`
- Trigger: Always present for any PNG drop through the deprecated path. The field is not yet surfaced in UI, so the bug is latent.
- Workaround: None currently needed since `optimizedMeta` is not displayed. Will become visible when InspectorPane surfaces output dimensions.

**Hardcoded `'0 bytes'` saved in batch-complete toast:**
- Symptoms: After every successful batch, the completion toast always shows "0 bytes saved" regardless of actual savings.
- Files: `src/hooks/useBatchOrchestrate.ts` (line 244): `const savedHuman = '0 bytes'`
- Trigger: Every batch completion.
- Workaround: `useTotals` hook correctly computes savings; batch-complete handler needs to call it or recompute from store.

**Hardcoded `'WebP q82'` in `optimizedMeta.format`:**
- Symptoms: Every file entry initialized via `addSourceWithVariants` stores `format: 'WebP q82'` as its `optimizedMeta.format` regardless of actual format. Carries forward into any UI that reads that field.
- Files: `src/stores/files.ts` (line 238)
- Trigger: Any raster file drop through the deprecated path.
- Workaround: None; field is not yet rendered.

---

## Security Considerations

**`unsafeExport` bypasses DOMPurify entirely:**
- Risk: When `settingsStore.svg.unsafeExport === true`, `sanitizeSvg` returns the raw SVGO output with zero sanitization. Malicious SVGs with embedded JS pass through to the optimized blob, preview, and clipboard.
- Files: `src/lib/sanitize-svg.ts` (lines 43–45), `src/components/panels/SvgoPanel.tsx`
- Current mitigation: Toggle is opt-in, default false. SVGO itself removes some attack vectors.
- Recommendations: Add a prominent warning in the UI when this toggle is active (e.g., a red badge or toast on each optimize run). Consider requiring a two-step confirmation to enable it.

**COOP/COEP headers only configured for dev server:**
- Risk: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` are set in `vite.config.ts` server headers and in `public/_headers` (for Cloudflare Pages). The `public/_headers` file only sets headers for `/*` — if headers are misconfigured in production, `SharedArrayBuffer` for threaded OxiPNG/AVIF will silently fail.
- Files: `vite.config.ts` (lines 46–49), `public/_headers`
- Current mitigation: Cloudflare Pages `_headers` file present and correct.
- Recommendations: Add a startup feature-detection check (`crossOriginIsolated`) that logs a console warning or surfaces a UI notice when the environment is not isolated, rather than silently degrading.

---

## Performance Bottlenecks

**Plugin savings N+1 re-encode on every batch completion:**
- Problem: After each SVG batch, `computePluginSavings` in `src/hooks/useBatchOrchestrate.ts` re-encodes every completed SVG file once per SVGO plugin (12 plugins × N files = 12N worker jobs). For a 30-file batch, this is 360 additional pool enqueues after the user's batch completes.
- Files: `src/hooks/useBatchOrchestrate.ts` (lines 32–93)
- Cause: Per-plugin disable-then-reoptimize approach; there is a 5-second timeout guard but the pool is still occupied during this window.
- Improvement path: Cache plugin savings per source file hash; only recompute if settings changed. Alternatively, run plugin savings computation lazily on-demand when the Report tab is opened rather than after every batch.

**`byteEstimate` heuristic for non-PNG rasters is very rough:**
- Problem: For JPEG/WebP/AVIF files, `addSourceWithVariants` uses `Math.ceil(blob.size * 10 * 4 * 1.75)` as the byte estimate — this can be 70× the actual working set, causing excessive throttling for heavily-compressed sources.
- Files: `src/stores/files.ts` (line 218): `byteEstimate = Math.ceil(args.sourceBlob.size * 10 * 4 * 1.75)`
- Cause: Compressed file size does not correlate well with decoded pixel buffer size without knowing image dimensions.
- Improvement path: Sniff JPEG/WebP dimensions at ingest time (similar to `sniffPngDimensions`) and compute `estimateJobBytes(w, h, targetW, targetH)` correctly.

---

## Fragile Areas

**Worker pool singleton callbacks not updatable:**
- Files: `src/workers/pool.ts` (line 300: `getWorkerPool`), `src/hooks/useBatchOrchestrate.ts` (line 162: `useMemo(() => getWorkerPool({...}), [])`)
- Why fragile: `getWorkerPool(callbacks)` only sets callbacks when creating the singleton; subsequent calls with different callbacks are silently ignored because `_pool` already exists. `useBatchOrchestrate` passes `onThrottle`, `onStarted`, etc. via `useMemo` — these are wired only on first render. If the component unmounts and remounts (e.g., in tests or HMR), `getWorkerPool` returns the existing pool with stale callbacks from the previous mount.
- Safe modification: Always pass callbacks via setter method rather than constructor; or expose a `setCallbacks` method on `WorkerPool` so `useBatchOrchestrate` can update them on remount.
- Test coverage: Worker-pool tests exercise cancel/enqueue but do not test callback updates across remounts.

**`enqueuePreview` for SVG is defined in `runtime.ts`, not in `useBatchOrchestrate.ts`:**
- Files: `src/stores/runtime.ts` (line 187: `enqueuePreview`), `src/hooks/useBatchOrchestrate.ts` (line 97: `enqueueRasterPreview`)
- Why fragile: Two parallel preview paths exist — `enqueuePreview` (SVG, in runtime store, uses `require()`) and `enqueueRasterPreview` (raster, in hook). They share no code and have different error-handling approaches. Adding a third format requires deciding which path to extend.
- Safe modification: Unify into a single `enqueuePreview(fileId)` function in the hook or a dedicated `preview.ts` module that dispatches on format.

**`getWorkerPool` called from both hook and store (`runtime.ts`):**
- Files: `src/workers/pool.ts`, `src/stores/runtime.ts` (line ~185), `src/hooks/useBatchOrchestrate.ts` (line 35)
- Why fragile: `runtime.ts`'s `enqueuePreview` calls `getWorkerPool()` without callbacks — it gets the singleton but does not register `onStarted`/`onDone`/`onError` callbacks, so preview results bypass `markStarted`/`runtimeMarkDone` in the runtime store. Preview completions are currently handled inline (the debounce closure calls `fileMarkDone` directly), but any refactor that moves the pool callbacks into the singleton risks losing preview completion handling.
- Test coverage: No test verifies that SVG preview jobs do not corrupt batch running/doneCount state.

---

## Scaling Limits

**No ZIP download implementation:**
- Current capacity: Zero — `exportFiles` is an empty stub in `src/stores/runtime.ts`.
- Limit: Users cannot download any optimized files as a batch (no ZIP, no individual save). Only clipboard snippets work for SVG.
- Scaling path: Implement using `jszip` (listed in CLAUDE.md as "locked" but not in `package.json`); add `file-saver` for the save-as dialog fallback. Both must be installed first.

**Worker pool capped at 4 regardless of device:**
- Current capacity: `POOL_SIZE_MAX = 4` in `src/workers/pool.ts` (line 13).
- Limit: Modern M-series Macs report `hardwareConcurrency = 10+`; the pool underutilizes available parallelism for large batches.
- Scaling path: Raise cap to 8 and tune memory budget; measure empirically on target device classes.

**`filesStore` has no size limit — all blobs held in RAM:**
- Current capacity: Unlimited file count; all `sourceBlob` and `optimizedBlob` references are kept alive in the store until `clear()`.
- Limit: A 50-file batch of 4K PNGs at ~10 MB each = 500 MB source + 500 MB optimized in memory simultaneously. The memory-budget admission gate throttles the worker pipeline but does not bound the store's blob retention.
- Scaling path: Add an LRU eviction policy for `optimizedBlob` on files not currently selected; persist blobs to `IndexedDB` (planned for Phase 7).

---

## Dependencies at Risk

**`jszip` listed in CLAUDE.md as "locked" but absent from `package.json`:**
- Risk: The project specification treats `jszip` as a required dependency, but it is not installed. Any ZIP export feature requires it.
- Impact: ZIP download cannot be implemented without first installing the package.
- Migration plan: Run `npm install jszip`; confirm version 3.10.x.

**`file-saver` similarly absent:**
- Risk: Same as jszip — referenced in CLAUDE.md as the Safari/Firefox fallback for file saving, not present in `package.json`.
- Impact: Save-as dialog for individual file download cannot be implemented.
- Migration plan: `npm install file-saver @types/file-saver`.

**`lucide-react` and `@phosphor-icons/react` both installed:**
- Risk: Two icon libraries in the dependency tree with overlapping icon sets. `lucide-react` is in `package.json` but `@phosphor-icons/react` is used in `src/components/icons/index.tsx`.
- Files: `src/components/icons/index.tsx`, `package.json`
- Impact: ~doubled icon-bundle weight if both are included in the production build.
- Migration plan: Audit which icons come from which library; consolidate to one (Phosphor appears to be the intended choice based on usage).

**`@base-ui/react` installed but Radix UI also present:**
- Risk: Both `@base-ui/react` and `radix-ui` are in `package.json`. Base UI is the Radix successor but is still in alpha/RC (1.x). Mixing both adds bundle weight and creates two competing primitive libraries.
- Impact: API surface fragmentation — components built on each library have incompatible prop patterns.
- Migration plan: Decide on one; the CLAUDE.md stack spec calls for `@radix-ui/react-*` packages specifically.

---

## Missing Critical Features

**ZIP download / individual file save:**
- Problem: Completed files cannot be downloaded. `exportFiles` is an empty stub.
- Blocks: The core user-facing value proposition ("walk away with a ZIP") is not yet deliverable.

**Raster snippet generators (`<picture>`, `<img srcset>`, base64 CSS):**
- Problem: Three of five `SNIPPET_REGISTRY` entries have `generate: () => null` stubs.
- Files: `src/lib/snippet-registry.ts` (lines 41–58)
- Blocks: Raster-format users see no snippets in the Snippets tab.

**`filterBy` / search in file list:**
- Problem: `filterBy` in `src/stores/files.ts` is an empty function; `filterQuery` is never written.
- Blocks: File list is unsearchable for large batches.

**`applyToAllFiles` (Apply to all):**
- Problem: InspectorPane "Apply to all" calls `applyToAllFiles` which is an empty stub.
- Files: `src/stores/files.ts` (lines 67–70)
- Blocks: Per-format bulk settings application is not functional.

---

## Test Coverage Gaps

**SVG preview does not affect `running`/`doneCount` — no test verifies this:**
- What's not tested: That `enqueuePreview` SVG jobs (`preview-*` prefix) are correctly excluded from runtime batch accounting (`markStarted`/`runtimeMarkDone` guard via `isAuxiliaryJob`).
- Files: `src/hooks/useBatchOrchestrate.ts` (lines 164–173), `src/stores/runtime.ts`
- Risk: A regression that accidentally counts preview jobs as batch jobs would corrupt the progress counter and fire premature batch-complete toasts.
- Priority: Medium

**Worker pool callback not updated on remount:**
- What's not tested: Pool singleton returning stale callbacks after component remount.
- Files: `src/workers/pool.ts` (line 300), `src/hooks/useBatchOrchestrate.ts`
- Risk: In production, stale callbacks silently drop `onDone`/`onError` fan-outs after HMR or route remount.
- Priority: Medium

**ICC extraction/embedding for JPEG is not Playwright-tested:**
- What's not tested: End-to-end `preserveIcc` round-trip for JPEG files (only PNG ICC is exercised in `src/tests/icc.test.ts` and `src/tests/settings-icc.test.ts`).
- Files: `src/lib/icc.ts`, `src/workers/jpeg-adapter.ts`
- Risk: JPEG ICC embed is unimplemented in `jpeg-adapter.ts` (no ICC extraction/embed calls present); silently drops color profiles.
- Priority: High — users with wide-gamut JPEG sources lose ICC data.

**Playwright tests run only on Chromium:**
- What's not tested: Firefox and Safari (WebKit) behavior — particularly `@jsquash/avif` 2.x BigInt decode issue on Safari < 16.4.
- Files: `playwright.config.ts` (projects array has only `chromium`)
- Risk: AVIF decode failures on Safari would be invisible until user reports.
- Priority: Medium

**`computePluginSavings` timeout/abort path has no test:**
- What's not tested: The 5-second timeout guard in `computePluginSavings` (`useBatchOrchestrate.ts` line 52 `SAVINGS_TIMEOUT_MS`).
- Files: `src/hooks/useBatchOrchestrate.ts` (lines 32–93)
- Risk: A hung worker during savings computation could block the Report tab's plugin-savings data indefinitely in a browser that doesn't trigger the timeout (rare but possible if the pool is already saturated).
- Priority: Low

---

*Concerns audit: 2026-05-14*
