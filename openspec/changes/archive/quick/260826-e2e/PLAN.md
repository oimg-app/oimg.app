# Quick 260826-e2e — Full e2e coverage plan for oimg.app

**Date:** 2026-08-26
**Author:** Nikolay Kostyurin (via GSD-quick agent)
**Scope:** Design (not implement) a black-box Playwright e2e test suite that exercises every interactive element in the app via `data-testid` selectors only — no CSS class / visible-text / DOM-structure coupling.

---

## Executive summary

The suite has ~48 test files today (~28 Playwright `*.spec.ts` + ~20 Node `*.test.ts`) but coverage is uneven: strong on ingest, clipboard, snippets, PWA, and metrics; weak or absent on the Inspector CodecPanel controls, SvgoPanel plugins, TitleBar menus, CommandPalette navigation, CenterHeader (swatches + zoom), FileRow context menu, Settings popover Diagnostics tab, and Toolbar view-segmented control. The app also has only ~27 `data-testid`s — mostly on containers — leaving the majority of buttons/sliders/switches unaddressable without brittle role/text queries. This plan (a) enumerates every interactive element, (b) proposes a stable testid naming convention with a per-file task list to add ~120 new testids, (c) lays out 14 new spec files (plus edits to 4 existing) grouped by feature area, (d) specifies shared helpers/fixtures, and (e) fixes execution order (smoke → ingest → codec → export → PWA).

**Dev server verified:** `npm run dev -- --port 5174` returns 200 in ~300 ms locally (COOP/COEP headers from `vite.config.ts`). Playwright's `webServer` block already starts it automatically.

---

## Section 1 — Existing coverage inventory

Every current spec/test file in `src/tests/`, with a one-liner. `.spec.ts` = Playwright (chromium), `.test.ts` = Node unit via `--experimental-strip-types`.

### Playwright specs (~28)

| File | Verifies |
|---|---|
| `foundation.spec.ts` | Dark theme applied, 3-pane shell renders (`files/center/inspector-pane` testids), viewport fills. |
| `ingest.spec.ts` | Empty-start invariant + real PNG dropped via `file-input` → entry appears, is selected, has bytes. |
| `paste-ingest.spec.ts` | System paste dispatcher: PNG / SVG / plain URL / mixed clipboard payloads. |
| `url-ingest.spec.ts` | Paste of an HTTP URL → fetch + ingest path. |
| `clipboard-ingest.test.ts` | Node coverage of `pickFromClipboard` branches; oversized types, HEIC pass-through. |
| `toolbar-paste.spec.ts` | Toolbar `From URL or paste` menu item end-to-end. |
| `watch-folder.spec.ts` | Watch-folder handle via `showDirectoryPicker` mock, add + change detection. |
| `filespane-clear.spec.ts` | `Clear all files` X button in the FilesPane header (disabled state, toast-confirm when running jobs). |
| `toolbar-clear.spec.ts` | Settings popover → General tab → `Clear all` menu item mirror of the FilesPane action. |
| `codec-encoders.spec.ts` | End-to-end encode for each codec (PNG/WebP/JPEG/AVIF) using fixture buffers. |
| `worker-pipeline.spec.ts` | Worker pool concurrency + dispatch smoke. |
| `backpressure.spec.ts` | Backpressure indicator visibility during large batches (uses `backpressure-indicator` testid). |
| `batch-progress.spec.ts` | `agg-counter` string transitions during a batch run. |
| `inspector-tabs.spec.ts` | Tab switching (codec/output/report) — clicks a button by visible role/name (needs testids). |
| `output-panel.spec.ts` | Presence of the three snippet sections + copy buttons (aria-label based). |
| `output-panel-live.spec.ts` | Live re-encode triggers rebuild of Base64 / URL / picture snippet text. |
| `file-row-menu.spec.ts` | FileRow context menu (Re-optimize / Save as / Remove / Apply-to-all). |
| `file-row-snippets.spec.ts` | Per-row copy `<picture>` + data-URI menu items. |
| `toolbar-snippets.spec.ts` | Toolbar Export split-menu → Copy `<picture>` HTML / Copy data URIs / Manifest JSON. |
| `export-single.spec.ts` | Toolbar `Export` primary button (selected file → save picker). |
| `export-zip.spec.ts` | Export → `All as ZIP` → jszip payload assertions. |
| `export-disabled.spec.ts` | `!hasDone` gates Export button + all menu items disabled + tooltip. |
| `per-file-settings.spec.ts` | Per-file `settings` overrides global; live-encode reruns after mutating. |
| `ssim-metric.spec.ts` | `ssim-score` renders with correct band (`data-band`), N/A branch for SVG. |
| `butteraugli-metric.spec.ts` | `butteraugli-score` band + Computing → done latch. |
| `status-bar.spec.ts` | `status-filecount` + `status-totals` + `worker-pip` visibility. |
| `statusbar-versions.spec.ts` | Rendered version strings match `runtimeAtom.versions`. |
| `pwa.spec.ts` | SW register + offline second-visit; `install-button` gated on `canInstall`. |
| `settings-diagnostics.spec.ts` | Settings popover Diagnostics `<dl>` renders versions/caps values + Copy diagnostics button. |
| `navigation.spec.ts` | Basic navigation smoke (URL, keyboard, some menu clicks by text). |

### Node unit tests (~20)

`build.test.ts`, `caps.test.ts`, `clearfiles.test.ts`, `clipboard.test.ts`, `deps.test.ts`, `filename.test.ts`, `format.test.ts`, `heic.test.ts`, `manifest.test.ts`, `metrics-bands.test.ts`, `runtime-shape.test.ts`, `settings.test.ts`, `snippets.test.ts`, `stores.test.ts`, `stub-data.test.ts`, `url-ingest.test.ts`, `versions.test.ts`, `watch-folder.test.ts`. These stay unchanged — they cover pure logic and don't fit the black-box charter.

---

## Section 2 — Gap analysis

Feature areas grouped by "no coverage" / "partial" / "adequate but text-coupled". Text-coupled = current specs use `getByRole('button', { name: 'output' })` and will break the moment we relabel.

### 2.1 No coverage (must add)
- **TitleBar Codec menu** — WebP / AVIF / JPEG / PNG / SVG / Auto items never clicked.
- **TitleBar View menu** — Batch / Compare / Inspector pane checkbox toggles; Light/Dark theme entries.
- **TitleBar Help menu** — Documentation / Keyboard shortcuts / What's new; version label read-only assertion.
- **CommandPalette** — open (⌘K), query filter, arrow-key up/down, Enter to execute, Esc to close, empty-state row. Every `$cmdFlat` command in `src/lib/commands.ts` invoked once.
- **CenterHeader stage-background swatches** — checker-dark / checker-light / black / white radio semantics + persistence in `uiAtom.stageBg`.
- **CenterHeader zoom dropdown** — 25/50/100/200/Fit selection; wheel-zoom updates label; breadcrumb `type→codec` + `q{n}` + `e{n}` tag re-renders on codec/quality change.
- **CompareStage split handle** — drag left/right, split percent updates ORIGINAL / OPTIMIZED labels; right-click pan; wheel zoom.
- **CodecPanel — every knob per codec**
  - Output format SegControl (5 codecs, SVG hidden for non-SVG sources).
  - Lossless switch (visible when non-SVG).
  - Quality slider (0–100, disabled for PNG).
  - Effort/method slider (0–6).
  - JPEG-only Progressive switch.
  - PNG-only Palette SegControl (currently `disabled`; assert disabled).
  - AVIF Advanced master switch + nested Subsample / Tune SegControls + Match-alpha switch + Alpha-quality slider + Denoise / Sharpness / Tile-rows / Tile-cols sliders + Chroma delta Q switch + Sharp YUV switch.
  - Resize switch → Width / Height inputs, Fit SegControl (stretch/contain), Algorithm SegControl (lanczos3/mitchell/catrom/triangle).
  - Reduce palette switch → Colors slider (1–256), Dithering slider (0–1 step 0.001).
  - Metadata section — Strip EXIF read-only-on-and-disabled + Keep ICC disabled invariants.
  - Apply-to-all button (only when ≥2 files and codec tab) — toast confirmation.
- **SvgoPanel** — Aggressive mode switch + each plugin toggle from `SVGO_PLUGINS` (24+ items) with `aria-pressed` and `onCount` label update.
- **Auto split-button** — `Auto` primary click sets target 1.4; menu items `1.4 balanced` / `1.0 high quality` / `2.0 aggressive` set `settingsAtom.autoTarget`.
- **View segmented control (Batch / Compare / Report)** in Toolbar — currently no direct test.
- **Settings popover General tab — Workers: 4 (auto)** button — assert `runtimeAtom.workerConcurrency` change.
- **Theme toggle button** — Sun/Moon click flips `uiAtom.theme` and `html.classList`.
- **FilesPane Sort popover** — each of the 5 SORT_OPTIONS applies + list order changes.
- **FilesPane Add button** and hidden input path (currently only exercised via `file-input` fixture).
- **FileRow — remaining menu items** — Reveal in compare, three-dot ctxbtn open path, keyboard access.
- **CenterPane visibility guardrail** — refuse to hide the last visible pane (from `togglePane` reducer).
- **BackpressureIndicator hover title / running-jobs text** — currently only visibility asserted.

### 2.2 Partial (widen)
- `inspector-tabs.spec.ts` uses `getByRole('button', { name: 'output' })` — swap to a tab testid after adding.
- `output-panel.spec.ts` finds copy buttons by `aria-label` — swap to per-section testids.
- `filespane-clear.spec.ts` — covers Clear-all button but not the `disabled` tooltip title.
- `navigation.spec.ts` — clicks menu items by visible text, brittle; migrate to testids.
- `pwa.spec.ts` — asserts `install-button` visible but does not click it (no way to fake `beforeinstallprompt` cleanly — leave click for a follow-up).

### 2.3 Adequate but text-coupled (migrate to testids)
`export-single`, `export-zip`, `toolbar-snippets`, `file-row-menu`, `file-row-snippets`, `toolbar-paste`, `toolbar-clear` — all target buttons via visible text or aria-label. Add the testids listed in Section 3, then swap selectors as part of the new specs (do not rewrite existing specs in scope of this plan).

---

## Section 3 — `data-testid` audit + naming convention + task list

### 3.1 Existing testids (27) — DO NOT rename

`titlebar`, `toolbar`, `statusbar`, `worker-pip`, `agg-counter`, `install-button`, `status-filecount`, `status-totals`, `backpressure-indicator`, `command-palette`, `files-pane`, `file-input`, `center-pane`, `inspector-pane`, `output-empty`, `output-panel`, `report-empty`, `report-panel`, `inspector-download`, `report-bar`, `ssim-row`, `ssim-score`, `butteraugli-row`, `butteraugli-score`, `format-row`.

### 3.2 Naming convention

`{area}-{component}-{element}[-{qualifier}]`, kebab-case, lowercase, English only. Areas:

- `titlebar-*` — TitleBar (`titlebar-menu-codec`, `titlebar-item-codec-webp`)
- `toolbar-*` — Primary toolbar (`toolbar-btn-add-files`, `toolbar-menu-export`, `toolbar-item-export-zip`)
- `files-*` — FilesPane and rows (`files-btn-clear-all`, `files-row-{id}`, `files-row-menu-item-reoptimize`)
- `inspector-*` — Inspector tabs + panels (`inspector-tab-codec`, `codec-slider-quality`, `svgo-plugin-removeViewBox`)
- `center-*` — Center pane (`center-swatch-black`, `center-zoom-item-200`, `compare-split-handle`)
- `status-*` / `titlebar-*` — StatusBar / TitleBar pills already prefixed
- `settings-*` — Toolbar Settings popover (`settings-tab-general`, `settings-btn-workers`)
- `cmdk-*` — CommandPalette internals (`cmdk-input`, `cmdk-option-{n}`)

Never encode ephemeral state (e.g. `-open`) — use `data-state`/`aria-*` for that. IDs derived from `file.id` are stable UUIDs from `useIngest`, safe to embed.

### 3.3 Testids to add — grouped by file

**`src/components/shell/TitleBar.tsx`** (12 new)
- `titlebar-menu-codec` (trigger button, line 63)
- `titlebar-menu-view` (trigger button, line 79)
- `titlebar-menu-help` (trigger button, line 117)
- `titlebar-item-codec-webp` … `-avif`, `-jpeg`, `-png`, `-svg`, `-auto` (MenuItem instances 66-72). Pass through `MenuItem` — add optional `testId` prop.
- `titlebar-check-pane-batch`, `-compare`, `-inspector` (DropdownMenuCheckboxItem 84/92/100)
- `titlebar-item-theme-light`, `titlebar-item-theme-dark` (MenuItem 109/110)
- `titlebar-item-help-docs`, `-shortcuts`, `-changelog` (MenuItem 120/121/122)
- `titlebar-version-label` (DropdownMenuLabel 124)
- `titlebar-btn-cmdk` (button 137, currently has `aria-label`)

**`src/components/shell/Toolbar.tsx`** (25 new)
- `toolbar-btn-add-files` (primary 105), `toolbar-btn-add-menu` (chevron 121)
- `toolbar-item-add-device` (131), `-watch-folder` (141), `-clip-url` (151)
- `toolbar-btn-optimize-all` (169)
- `toolbar-btn-export` (180), `toolbar-btn-export-menu` (203)
- `toolbar-item-export-zip` (213), `-individual` (229), `-copy-picture` (245), `-copy-datauris` (261), `-manifest` (277)
- `toolbar-view-batch`, `toolbar-view-compare`, `toolbar-view-report` (segmented control, map from `v` in `.map` at 307)
- `toolbar-btn-auto` (329), `toolbar-btn-auto-menu` (344)
- `toolbar-item-auto-14` (354), `-auto-10` (364), `-auto-20` (374)
- `toolbar-input-filter` (398)
- `toolbar-btn-theme` (410)
- `toolbar-btn-settings` (425)
- `settings-tab-general`, `settings-tab-diagnostics` (TabsTrigger 440/441)
- `settings-btn-workers` (444), `settings-btn-clear-all` (456), `settings-btn-copy-diagnostics` (506)
- `settings-dl-diagnostics` (dl at 476) — optional; component-level rather than per-row

**`src/components/panels/FilesPane.tsx`** (7 new; 2 already exist)
- `files-btn-clear-all` (button 150)
- `files-btn-sort` (button 165), `files-btn-add` (button 186)
- `files-sort-item-{key}` for each of the 5 SORT_OPTIONS (buttons at 174)
- `files-empty` (a wrapper testid on the whole pane when `files.length === 0`)

**`src/components/panels/files/FileRow.tsx`** (~7 new per row)
- `files-row-{file.id}` (ContextMenuTrigger 629)
- `files-row-{file.id}-badge`, `-name`, `-size` for read-back
- `files-row-{file.id}-ctxbtn` (button 121)
- `files-row-{file.id}-status` (status dot 128)
- Context menu items: `files-row-menu-reoptimize`, `-saveas`, `-copy-datauri`, `-copy-picture`, `-reveal`, `-apply-to-all`, `-remove` (single testid per item is enough — only one row's menu open at a time)

**`src/components/panels/InspectorPane.tsx`** (5 new)
- `inspector-tab-codec`, `inspector-tab-output`, `inspector-tab-report` (buttons at 50)
- `inspector-empty` (wrapper div at 42)
- `inspector-apply-to-all` (button 94)

**`src/components/panels/inspector/CodecPanel.tsx`** (~30 new)
- `codec-format` (SegControl 199) — SegControl exposes options as `role=radio` children; expose testids via a wrapper attribute + per-option `data-value` (see Section 3.4).
- `codec-switch-lossless` (Switch 209)
- `codec-slider-quality` (Slider2 233)
- `codec-slider-effort` (Slider2 249)
- `codec-switch-progressive` (Switch 265, JPEG only)
- `codec-seg-palette` (SegControl 275, PNG disabled)
- `codec-switch-avif-advanced` (Switch 290)
- `codec-seg-avif-subsample` (296), `codec-seg-avif-tune` (307)
- `codec-switch-avif-match-alpha` (318)
- `codec-slider-avif-alpha`, `-denoise`, `-sharpness`, `-tile-rows`, `-tile-cols` (Slider2 327/344/360/376/392)
- `codec-switch-avif-chroma-delta` (407), `codec-switch-avif-sharp-yuv` (413)
- `codec-switch-resize` (Switch 423)
- `codec-input-width` (Input 429), `codec-input-height` (Input 437)
- `codec-seg-fit` (445), `codec-seg-algorithm` (449)
- `codec-switch-colors` (458)
- `codec-slider-colors` (465), `codec-slider-dithering` (480)
- `codec-switch-strip-exif` (504), `codec-switch-keep-icc` (511) — assert disabled/checked invariants

**`src/components/panels/inspector/SegControl.tsx`** (structural, 2)
- Add `data-testid` root prop passthrough + `data-value` on each option button. Contract: `getByTestId('codec-seg-fit').getByRole('radio', { name: 'contain' })` still works, but tests will prefer `locator('[data-testid="codec-seg-fit"] [data-value="contain"]')`.

**`src/components/panels/inspector/SvgoPanel.tsx`** (2 + N)
- `svgo-switch-aggressive` (Switch 46)
- `svgo-plugin-{p.id}` on each plugin button (60) — plugin ids come from `SVGO_PLUGINS`.

**`src/components/panels/inspector/OutputPanel.tsx`** (3 new)
- `output-section-{id}` (Section wrapper for base64/urlencoded/picture)
- `output-btn-copy-{id}` (Copy button 970) — id = base64 / urlencoded / picture
- `output-pre-{id}` (pre 954) — for snippet text assertion

**`src/components/panels/inspector/ReportPanel.tsx`** (already 8; add 2)
- `report-savings-before`, `-after`, `-saved`, `-files` (spans 103/112/121/133) — one testid each for numeric read-back

**`src/components/panels/center/CenterHeader.tsx`** (~10 new)
- `center-breadcrumb-name`, `-typeCodec`, `-dim`, `-quality`, `-effort` (spans 61/65/69/75/76)
- `center-swatch-checker-dark`, `-checker-light`, `-black`, `-white` (buttons 88, map by `s.id`)
- `center-zoom-trigger` (button 110)
- `center-zoom-item-25`, `-50`, `-100`, `-200`, `-fit` (DropdownMenuItem 121, map by `opt`)

**`src/components/panels/center/CompareStage.tsx`** (5 new)
- `compare-stage` (root stageRef div 283)
- `compare-frame` (frame 295)
- `compare-layer-orig` (img/iframe 305)
- `compare-layer-opt` (img/iframe 335)
- `compare-split-handle` (365) — draggable
- `compare-label-orig` (378), `compare-label-opt` (384)

**`src/components/panels/center/DeltaStrip.tsx`** (open — read + tag)
- `center-delta-strip` + any per-row testids the component uses (out of scope to enumerate here, but the plan owner should mirror the same convention when adding).

**`src/components/shell/CommandPalette.tsx`** (3 new; 1 exists)
- `cmdk-input` (input 24)
- `cmdk-listbox` (ul 1453)
- `cmdk-option-{i}` on each list item (462, use `i`)

**`src/components/shell/StatusBar.tsx`** (all covered; ensure `worker-pip` / `agg-counter` / `install-button` / `status-filecount` / `status-totals` remain — no additions needed)

**`src/components/shell/BackpressureIndicator.tsx`** (already `backpressure-indicator`; add `backpressure-count` on running-jobs numeric child if any — verify when editing)

**Total new testids proposed: ~120** (varies with SVGO plugin count and per-row multiplication). Implementation is a straight series of small edits; no logic changes needed. The `SegControl` and `Switch` primitives should forward `data-testid` to their root element as part of the same change (2-line prop passthrough each).

---

## Section 4 — Proposed new spec file layout

All new files live in `src/tests/`. Each spec MUST:
1. Import fixtures from `src/tests/_helpers/*` (Section 5).
2. Use `page.getByTestId(...)` exclusively — no `getByRole` / `getByText` fallbacks.
3. Latch transient states (e.g. `expect.poll(() => filesAtom.get()...)` when checking async status).
4. Live under the `chromium` project defined in `playwright.config.ts`.

### 4.1 New specs (14)

| # | File | Feature area | Scenarios |
|---|---|---|---|
| 1 | `smoke.spec.ts` | App boot | Loads `/`, all shell testids visible (`titlebar`, `toolbar`, `files-pane`, `center-pane`, `inspector-pane`, `statusbar`, `backpressure-indicator`); empty-state placeholders visible; `agg-counter` empty string. |
| 2 | `titlebar-menus.spec.ts` | TitleBar | Codec menu: open, each item click → assert `settingsAtom.codec` (or `uiAtom` codec-preview state). View menu: each pane checkbox toggles `uiAtom.panes.*`, guardrail refuses to hide last pane. Help menu: openDocs / openShortcuts / openChangelog fire (stub via `window.open` spy). Version label textContent matches semver regex. |
| 3 | `titlebar-cmdk.spec.ts` | CommandPalette | ⌘K opens (mac + non-mac), `cmdk-input` autofocuses, query filters `$cmdFlat`, ArrowDown/ArrowUp changes `cmdkSel`, Enter runs command + closes dialog, Esc closes without executing, empty-state row shows when no match. Also click `titlebar-btn-cmdk` opens it. |
| 4 | `toolbar-controls.spec.ts` | Toolbar wide coverage | Add-files split (primary + menu), Optimize-all primary, view-segmented (Batch/Compare/Report toggles `uiAtom.view`), Auto split (each menu item mutates `settingsAtom.autoTarget`), Filter input types → `filesAtom.filterQuery`, Theme toggle flips `html.classList.dark`, Settings popover opens/closes. |
| 5 | `settings-popover.spec.ts` | Settings popover | Tabs switch (`settings-tab-*`). General tab: `settings-btn-workers` sets `runtimeAtom.workerConcurrency`; Clear all mirrors FilesPane (already partly covered). Diagnostics: `<dl>` values match `runtimeAtom.versions`/`caps`; Copy diagnostics writes JSON to clipboard chokepoint. |
| 6 | `filespane-controls.spec.ts` | FilesPane | Empty-state visible when queue empty (via new `files-empty`), Sort popover: each of 5 keys re-orders `$filteredFiles`, Add-files button triggers hidden `file-input`, drag/drop over pane sets `dragActive` visual, drop ingests. |
| 7 | `file-row-full.spec.ts` | FileRow | For each file: ctxbtn opens menu, every menu item (Re-optimize, Save as, Copy data-URI, Copy `<picture>`, Reveal in compare, Apply-to-all, Remove) dispatches expected action or toast. Row click selects, `filesAtom.selectedId` updates. Status dot testid reflects `queued/processing/done/error`. |
| 8 | `inspector-tabs-testid.spec.ts` | Inspector tabs | Migrates existing `inspector-tabs.spec.ts` scenarios to `inspector-tab-*` testids; adds guard that switching between tabs while an encode is in-flight does not race (empty state → codec → output → report → codec loop). |
| 9 | `codec-panel-per-codec.spec.ts` | CodecPanel | Parametrized `[PNG, WebP, JPEG, AVIF, SVG]`. For each: pick `codec-format`, verify visible controls (quality disabled/enabled, progressive JPEG-only, palette PNG-only, AVIF-advanced AVIF-only, SVGO SVG-only). Slide Quality/Effort → per-file `settings` update + `useLiveEncode` re-runs (assert `encodedBuffer` re-generated). Lossless switch flips both value and encoder branch. Metadata section: Strip EXIF is checked+disabled, Keep ICC is unchecked+disabled. |
| 10 | `codec-panel-avif-advanced.spec.ts` | AVIF Advanced sub-panel | Master switch reveals nested controls, each SegControl option applies, each Slider updates `settings.avif.*`, Match-alpha switch toggles Alpha-quality slider visibility, Chroma-delta and Sharp-YUV switches. |
| 11 | `codec-panel-resize-palette.spec.ts` | Resize + Reduce palette | Resize switch reveals inputs; Width/Height inputs accept numeric string, Fit (`stretch`/`contain`) + Algorithm (`lanczos3`/`mitchell`/`catrom`/`triangle`) SegControls change encoder params. Reduce palette: Colors slider 1↔256, Dithering slider 0↔1 step. Assert re-encode fires each time. |
| 12 | `svgo-panel.spec.ts` | SvgoPanel | Load SVG fixture, select it, ensure SVG codec auto. Aggressive switch toggles `settings.aggressive`. Iterate every plugin id from `SVGO_PLUGINS` — click, assert `aria-pressed` flips, `onCount` label updates, re-encode fires, encoded bytes change. |
| 13 | `center-header.spec.ts` | CenterHeader | Stage-background swatches (radio semantics, `uiAtom.stageBg` mutation, `aria-checked`). Zoom dropdown: each value applies, breadcrumb tags `type→codec` / `dim` / `q{n}` / `e{n}` reflect current settings + resize. |
| 14 | `compare-stage.spec.ts` | CompareStage | Split handle drag: assert `--split` inline style changes; wheel event on stage adjusts zoom; ORIGINAL/OPTIMIZED bytes labels update after re-encode; codec-mismatch gate — set codec=WebP on an SVG source, confirm `compare-layer-opt` is placeholder (not stale iframe). |

### 4.2 Edits to existing specs (4)

- `inspector-tabs.spec.ts` → replace `getByRole('button', { name: 'output' })` with `getByTestId('inspector-tab-output')`. Keep tests, tighten selectors.
- `output-panel.spec.ts` → swap aria-label queries to `output-btn-copy-{id}` + `output-section-{id}`.
- `file-row-menu.spec.ts` → swap visible-text row-menu clicks to `files-row-menu-*`.
- `navigation.spec.ts` → migrate every menu-text click to `titlebar-item-*`.

---

## Section 5 — Shared helpers + fixtures (`src/tests/_helpers/`)

Create a new folder to keep new-suite plumbing separate from existing `fixtures/`.

| File | Exports | Purpose |
|---|---|---|
| `fixtures.ts` | `PNG_1x1`, `PNG_16x16`, `PNG_256x256`, `JPEG_16x16`, `WEBP_16x16`, `AVIF_16x16`, `SVG_SIMPLE`, `SVG_COMPLEX`, `HEIC_STUB` | Base64 buffers; reuse the constants already inline in `codec-encoders.spec.ts` and `ssim-metric.spec.ts` and centralize. |
| `ingest.ts` | `ingestPng(page, {name, count})`, `ingestSvg(page)`, `ingestMixed(page, formats)` | Wraps `page.setInputFiles('[data-testid="file-input"]', …)` + waits for `filesAtom.get().entries.length` via `waitForFunction`. |
| `select.ts` | `selectRow(page, index)`, `selectRowByName(page, name)` | Uses `files-row-{id}` — indexes by name → id lookup through store to avoid text coupling. |
| `inspector.ts` | `openInspectorTab(page, 'codec'\|'output'\|'report')`, `pickCodec(page, codec)`, `setSlider(page, testid, value)` | Slider set via `dispatchEvent('keydown', {key:'ArrowRight'})` loop or by writing `settingsAtom.setKey` directly. |
| `encode.ts` | `waitForEncoded(page, id)`, `waitForMetrics(page, id)`, `waitForBatchDone(page)` | Uses `expect.poll` over `filesAtom.get()` — mirrors existing pattern. |
| `clipboard.ts` | `readClipboard(page)`, `writeClipboard(page, text)` | Wraps `context.grantPermissions(['clipboard-read','clipboard-write'])` + `navigator.clipboard.readText`. |
| `directory.ts` | `mockDirectoryHandle(page, files)` | Reuses shape from existing `watch-folder.spec.ts` for `showDirectoryPicker`. |
| `pwa.ts` | `waitForServiceWorker(page)`, `fakeBeforeInstallPrompt(page)` | Consolidates `pwa.spec.ts` helpers. |
| `store.ts` | `getStore(page, 'files'\|'ui'\|'settings'\|'runtime')` | Thin wrapper over `page.evaluate` importing `../stores/*.ts` — same pattern used across current specs. |

Rule: fixture buffers and helpers must be pure ESM importable from Playwright specs (`.spec.ts`) without touching Vite alias — use relative paths (`../_helpers/fixtures`). Node unit tests keep their existing `_alias-loader.mjs` shim.

---

## Section 6 — Execution order

Testids and helpers land first, then specs are enabled in waves so failures land in a coherent order.

**Wave 1 — plumbing (green immediately)**
1. Add all testids from Section 3 (per-file batch of small edits; no logic change).
2. Add `data-testid` + `data-value` passthrough to `SegControl` and `Switch` primitives.
3. Create `src/tests/_helpers/*` from Section 5.
4. Migrate existing text-coupled specs (Section 4.2) to testids.

**Wave 2 — smoke + shell (fast feedback)**
5. `smoke.spec.ts`, `titlebar-menus.spec.ts`, `titlebar-cmdk.spec.ts`, `toolbar-controls.spec.ts`, `settings-popover.spec.ts`.

**Wave 3 — files + rows**
6. `filespane-controls.spec.ts`, `file-row-full.spec.ts`.

**Wave 4 — inspector**
7. `inspector-tabs-testid.spec.ts`, `codec-panel-per-codec.spec.ts`, `codec-panel-avif-advanced.spec.ts`, `codec-panel-resize-palette.spec.ts`, `svgo-panel.spec.ts`.

**Wave 5 — center + delivery**
8. `center-header.spec.ts`, `compare-stage.spec.ts`.

**Wave 6 — audit + polish**
9. Run `npm test` full sweep, chase any flakes (metrics workers are the usual culprit — extend `waitForMetrics`), and remove the last text-selector fallbacks.

---

## Section 7 — Success criteria

- `npm test` green on chromium in CI (single retry allowed for known metrics-worker warmup only).
- Every testid listed in Section 3 exists in source and is exercised by at least one spec.
- A grep of `src/tests/*.spec.ts` finds **zero** `getByRole(` / `getByText(` calls for interactive elements (allowed only for read-only assertions like `page.getByRole('status')`).
- A coverage table (auto-generated in a follow-up `coverage-audit.test.ts` node script) maps every `data-testid` in `src/` to at least one spec file that references it; the script fails if any testid is orphaned or any spec references a missing testid.
- Manual sanity: run the app locally, use each interactive element, and confirm no console errors or React warnings related to the added `data-testid` attributes (they're inert DOM attrs — should be silent).

---

## Blockers / open questions

- **DeltaStrip** was not fully enumerated in the batch dump. Whoever implements Wave 5 should read `src/components/panels/center/DeltaStrip.tsx` and apply the same testid convention.
- **`beforeinstallprompt` faking** for a real PWA install click is non-trivial; leaving it out of `pwa.spec.ts` for now.
- **Wheel-zoom** in `CompareStage` uses non-passive listener; Playwright's `page.mouse.wheel` should still trigger it, but keep a fallback that mutates `uiAtom.zoom` directly if the browser event proves flaky.
- SegControl / Switch primitives are vendored shadcn — small prop passthrough (`data-testid`, `data-value`) is required; verify it does not break existing Radix behavior.
