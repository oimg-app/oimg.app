# Metrics Spec

## Purpose
Give the developer a real, perceptual quality readout for the selected encoded file, not just a byte count. Two metrics ship: SSIM (structural similarity, `ssim.js`) and Butteraugli (`@squoosh-kit/visdif`). Both run in a sibling metrics worker, lazy-loaded, and MUST NOT enter the initial JS chunk.

## Requirements

### Requirement: SSIM auto-computes for the selected file
The system SHALL compute SSIM for the selected file automatically once its `status === 'done'`, cache the result on `FileEntry.metrics.ssim`, and invalidate the cache when the entry is re-encoded (via `setFileResult`).

#### Scenario: User selects a done file
- **WHEN** the user selects an entry whose encode has completed
- **THEN** SSIM is dispatched to the metrics worker, and the Report panel's SSIM row updates with the computed value once it lands

#### Scenario: User re-encodes at a different quality
- **WHEN** the user drops WebP quality on the selected file and the re-encode completes
- **THEN** the cached SSIM invalidates and a fresh SSIM run replaces it

### Requirement: Butteraugli via `@squoosh-kit/visdif`
The system SHALL compute Butteraugli via `@squoosh-kit/visdif` (Squoosh's canonical Butteraugli WASM, MIT + Apache-2.0), cache the result on `FileEntry.metrics.butteraugli`, and run it in parallel with SSIM using `Promise.allSettled([SSIM, Butteraugli])` so one metric's failure does not block the other.

#### Scenario: `visdif` returns a non-finite score
- **WHEN** the visdif call returns `NaN` / `Infinity`
- **THEN** the store is not populated with a bogus number (Number.isFinite guard) and the Butteraugli row shows the unavailable placeholder

### Requirement: Banded green / yellow / red display
The system SHALL classify each metric into three bands and render a colored badge next to the score. `src/lib/metrics-bands.ts` holds the pure classifier: `SSIM_BANDS` and `BUTTERAUGLI_BANDS` are exported constants. SSIM uses `>=` (inclusive-at-boundary; green when `v >= 0.95`, yellow when `v >= 0.85`, else red). Butteraugli uses strict `<` (green `< 1.5`, yellow `< 3.0`, else red).

### Requirement: SVG-on-both-sides early return
The system SHALL skip metrics computation when both source and target are SVG. Perceptual pixel metrics on vector-only pipelines are not meaningful; the row shows a "not applicable" placeholder.

### Requirement: Source/target dimension alignment
The system SHALL align source and target dimensions before invoking the metric (e.g. via `@jsquash/resize`) so a resize-on-export entry can still be compared against its original.

### Requirement: CR-02 stale-drop discipline
The system SHALL guard every metric write with a monotonic `seqRef` check. If the user rapidly re-selects between files, only the result of the latest dispatch for the currently-selected file writes to the store; older in-flight results are dropped.

#### Scenario: Selection thrash
- **WHEN** the user clicks through files A → B → C → A within the metric worker's turnaround time
- **THEN** only the final A run's result lands in `metrics.ssim`; the earlier A / B / C results in-flight are dropped without writing

### Requirement: WR-02 single-funnel write
The system SHALL write metrics through the single `setFileMetric(id, key, value)` funnel (backed by `updateEntry(id, patch)`), never with an ad-hoc `filesAtom.setKey` from a metrics callsite.

### Requirement: Lazy WASM stays out of the initial route
The system SHALL dynamic-import `ssim.js` and `@squoosh-kit/visdif` inside the metrics worker's async body only. Neither library's runtime identifiers (`bezkrovny` for SSIM, `VisDiff` for visdif) MUST appear in the initial JS chunk; a build-time grep asserts this.

### Requirement: `client`-mode WASM loading for `visdif`
The system SHALL initialize `@squoosh-kit/visdif` with `createVisDiff('client')`. Default `'worker'` mode spawns a nested worker whose WASM URL breaks under the Vite SPA fallback (shared discipline with imagequant).

### Requirement: Buffers are sliced per RPC
The system SHALL `.slice(0)` each ArrayBuffer independently before dispatching the parallel SSIM + Butteraugli calls, because Comlink's transfer detaches the buffer from the sender.

## Non-goals

- Batch-wide metric aggregation (metrics compute per-file on selection; no "batch avg SSIM" panel is shipped).
- A visual heatmap / difference map (Butteraugli powers a scalar only).
- On-demand recompute button (metrics auto-compute and auto-invalidate; there is no user-facing "recompute now" affordance).
- A hand-built Emscripten libjxl-butteraugli WASM (superseded by `@squoosh-kit/visdif`).
- Metric surfacing during a running batch (metrics run for the currently-selected file, not for every file mid-batch).
- Custom band thresholds (bands are project-fixed constants).
