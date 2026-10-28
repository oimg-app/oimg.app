## Why

The 2026-10-25 design critique (`.impeccable/critique/2026-10-25T13-05-34Z__src-app-tsx.md`, 17/40) found that the shell shows controls that do nothing and numbers that are not measured, and that core flows fail WCAG AA. Verified in code:

- `selectCodec`, `setAutoTarget`, `openDocs`, `openShortcuts`, `openChangelog` (`src/stores/ui.ts`) and `setWorkerCount` (`src/stores/runtime.ts`) are empty stubs, yet they back the TitleBar Codec and Help menus, the Toolbar Auto split-button, and the Settings "Workers: 4 (auto)" button. The Toolbar Batch/Compare/Report segmented control writes `uiAtom.view`, which nothing reads.
- The DeltaStrip shows SSIM `0.987` and Butteraugli `1.24` as string literals (`DeltaStrip.tsx:119-127`) for every file, even with no file selected, while real per-file metrics already exist in `entry.metrics`.
- The palette's "Optimize all" calls `startRun()`, which sets `running = true` and never clears it: nothing is optimized and the StatusBar says "Running" forever. "Add files" in the palette is `() => {}`. The palette advertises shortcuts "A" and "O" that are not bound.
- The SVGO plugin grid shows static `saves` percentages from `SVGO_PLUGINS` as if measured.
- Three row-menu items (Re-optimize, Reveal in compare, Apply same settings to all) are `/* @TODO */` no-ops.
- File rows cannot be reached or selected with the keyboard (click-only `ContextMenuTrigger`). Opening the row menu from its ⋮ button with the keyboard places the menu at the viewport origin. The shell carries `role="application"`, which disables screen-reader browse mode.
- Detector-measured contrast: dark-theme `fg-3` text is 2.1–2.3:1 and `fg-2` is 3.9–4.2:1. In light theme, white on the accent ("Optimize all") is 3.3:1. UI text is 10–11px in more than 40 places.
- At 390px wide the shell keeps a 910px content width and clips 35 elements.

The product sells measured, trustworthy output to developers. Fake numbers and dead buttons undercut that directly, and WCAG AA is a hard project constraint.

## What Changes

- **BREAKING (UI surface)**: remove controls with no behavior until they are built: the TitleBar Codec menu and Help menu; the Toolbar Batch/Compare/Report segmented control and Auto split-button; the row-menu items Re-optimize, Reveal in compare, and Apply same settings to all; the palette's "Add files" and Batch/Compare/Report view commands; the unbound "A"/"O" shortcut hints. Remove the hardcoded "100% local · Offline-ready" text from the TitleBar (the StatusBar already shows the real offline state).
- Replace the Settings "Workers: 4 (auto)" button with read-only text showing the actual pool concurrency.
- The palette's "Optimize all" runs the same optimize path as the Toolbar button. The palette shows it as unavailable, and the Toolbar disables its button, when the queue is empty. The worker status always returns to idle when work ends.
- The DeltaStrip SSIM and Butteraugli cards show the selected file's real metric with its band, "—" while pending or with no selection, and "N/A" when the metric does not apply. The Decode card shows "—" without an encoded result.
- The SVGO plugin grid drops the static saves column.
- The file queue becomes a keyboard-operable single-select list: one tab stop, arrow keys/Home/End move the selection, and the context-menu key or Shift+F10 opens the row menu anchored to the row. The ⋮ button's menu opens anchored to the button.
- Remove `role="application"` from the shell. Give the pane resize handles and the SVGO Aggressive switch accessible names. The StatusBar's live region announces only run state and progress, not version strings. The empty StatusBar drops the stray separator.
- Retune text foreground tokens and the light-theme accent so all text meets 4.5:1 on every surface. Lightness changes only; hue and chroma stay. Raise UI text to a 12px minimum. Stop the segmented control clipping its focus ring.
- Below 900px viewport width, show one pane at a time behind a Files / Preview / Settings tab bar instead of three squeezed columns, and scroll the toolbar horizontally rather than clipping it.
- The dropzone stops advertising JXL, which ingest does not accept.

Non-goals:
- Building any of the removed features (codec menu, Auto/Butteraugli target search, docs/shortcuts/changelog, worker-count setting, re-optimize, apply-to-all). Each needs its own change.
- Fixing the savings sign and warning threshold (critique P2) and the single-file Export button label. These are out of the P0+P1 scope chosen.
- Undo for remove/apply, and a redesign of the Toolbar's information architecture beyond the removals.
- Deferred features in `openspec/project.md` stay deferred.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `inspector-ui`: Toolbar contents shrink (no view segmented control, no Auto); the row context menu loses its no-op items and gains keyboard opening; the file queue becomes keyboard-operable; the StatusBar live region scope narrows; the dropzone format list drops JXL; the shell gets a narrow-viewport layout and a WCAG-AA text floor; the SVGO panel drops the saves column.
- `command-palette`: only working commands are listed; Optimize all is unavailable at zero files; no unbound shortcut hints.
- `compare-view`: DeltaStrip metric cards show real values, "—", or "N/A", never literals.
- `optimize-svg`: plugin inventory no longer claims a saved percentage per plugin.
- `theming`: tokens must meet WCAG AA text contrast, with lightness-only retuning allowed; 12px minimum UI text.
- `diagnostics`: the Settings General tab shows read-only worker concurrency instead of a button that does nothing.

## Impact

- **Code**:
  - Shell and stores: `src/components/shell/{TitleBar,Toolbar,StatusBar,CommandPalette,AppShell}.tsx`; `src/stores/{ui,runtime}.ts`.
  - Commands: `src/lib/commands.ts` and `src/main.tsx` (command registration).
  - Optimize: `src/hooks/useOptimize.ts` (hoist `runOptimize` so it can be called outside React).
  - Panels: `src/components/panels/{FilesPane,files/FileRow,center/DeltaStrip,inspector/SvgoPanel,inspector/SegControl}.tsx`, plus every component carrying 10–11px text.
  - Styles: `src/index.css` (tokens).
  - New hook: `src/hooks/useNarrowViewport.ts`.
- **Tests**: `navigation.spec.ts`, `foundation.spec.ts`, `backpressure.spec.ts` and `stores.test.ts` reference removed controls, `role="application"`, or `startRun`, and must be updated. New e2e specs cover keyboard selection, the palette at zero files, DeltaStrip placeholders, and the narrow layout.
- **Bundle budget**: net reduction (removed menus and popovers); the new hook is tiny, no new dependencies.
- **Zero-network constraint**: none — no network calls added or removed.
- **Visual identity**: token lightness changes in `src/index.css`; hue and chroma stay, so the accent-green identity holds. `example-ui/OIMG.html` will differ in those lightness values.
