## 1. Regression tests first

- [x] 1.1 Add `src/tests/trust-and-a11y.spec.ts` (tag `// change:remove-dead-ui-and-fix-a11y`) with failing cases:
  - TitleBar has no Codec or Help menu; the Toolbar has no `toolbar-view-*` or `toolbar-btn-auto`.
  - At an empty queue, the palette's "Optimize all" is `aria-disabled` and Enter leaves the StatusBar "Idle".
  - With 2 files queued, palette "Optimize all" reaches `done` for both and the StatusBar returns to "Idle".
  - The DeltaStrip SSIM, Butteraugli, and Decode values read "—" with an empty queue.
  - No `[role="application"]` exists.

  Verify the cases fail on current `main`.
- [x] 1.2 Add keyboard cases to the same spec. With 3 files queued:
  - Tab into the list, press ArrowDown twice: the third row has `aria-selected="true"` and focus, and the inspector shows that file's name.
  - Shift+F10 opens `files-row-menu` within 40px of the row; Escape returns focus to the row.

  Verify they fail on `main`.
- [x] 1.3 Add `src/tests/next-selection.test.ts` (Node) for the `nextSelection(ids, currentId, key)` helper (design D5), covering:
  - ArrowDown/ArrowUp at the middle and at both ends (no wrap)
  - Home/End
  - `currentId` null → first id
  - an empty list → null

  Verify it fails until 4.1 lands.

## 2. Remove inert controls (inspector-ui: No inert controls; Toolbar affordances; File row context menu)

- [x] 2.1 In `TitleBar.tsx`, delete the Codec menu, the Help menu, and the "100% local · Offline-ready" spans. In `stores/ui.ts`, delete `selectCodec`, `openDocs`, `openShortcuts`, `openChangelog`, and `setAutoTarget` (design D3). Verify `grep -rn "selectCodec\|openDocs\|openShortcuts\|openChangelog\|setAutoTarget" src` returns nothing.
- [x] 2.2 In `Toolbar.tsx`, delete the Batch/Compare/Report segmented control and the Auto split-group with their dividers. Delete `setView`, `uiAtom.view` and the `View` type from `ui.ts`. Verify that grepping for `setView` and `toolbar-view-` outside `src/tests` returns nothing.
- [x] 2.3 Replace the Settings "Workers: 4 (auto)" button with non-focusable text showing `Math.min(caps.hardwareConcurrency, 4)`, and delete `setWorkerCount` (diagnostics: Settings popover). Verify in the browser that the General tab shows the text and Tab skips it.
- [x] 2.4 In `FileRow.tsx`, delete the Re-optimize, Reveal in compare, and Apply same settings to all items and the now-unused icons and separator. Verify the row menu lists exactly Save as…, Copy data-URI, Copy `<picture>`, and Remove from queue.
- [x] 2.5 Remove "JXL" from the dropzone format line in `FilesPane.tsx` (inspector-ui: Dropzone). Verify every listed format appears in `ACCEPT`.
- [x] 2.6 Remove the `saves` column from `SvgoPanel.tsx` and the `saves` field from `SvgoPlugin`/`SVGO_PLUGINS` in `stub-data.ts`, plus any reader of it (optimize-svg: SVG plugin inventory). Verify `grep -rn "\.saves\|saves:" src` returns nothing and `tsc -b` shows no new errors against baseline.
- [x] 2.7 Update `navigation.spec.ts` to drive the menu keyboard tests through the View menu instead of Codec, and drop assertions about removed controls. Update `foundation.spec.ts` to locate the shell without `role="application"`. Verify both specs pass.

## 3. Trustworthy status and numbers (command-palette; compare-view: DeltaStrip metric cards)

- [x] 3.1 Hoist `runOptimize` to a module-level export in `useOptimize.ts`; `useOptimize()` returns the same function (design D1). Verify the Toolbar Optimize all still works and `optimize.spec`/`batch` e2e specs pass.
- [x] 3.2 Replace `ALL_COMMANDS` with `buildCommands({ optimizeAll, hasFiles })`:
  - Drop "Add files" and the three view commands, and remove the `A`/`O` meta hints.
  - Add `enabled?: () => boolean` to `CommandItem`.
  - Wire it in `main.tsx` (design D2), and delete `startRun` (and `stopRun` once it has no callers).
  - Update `stores.test.ts` and `backpressure.spec.ts` accordingly.

  Verify `stores.test.ts` passes under `node --experimental-strip-types`.
- [x] 3.3 In `CommandPalette.tsx`, render items whose `enabled()` is false with `aria-disabled="true"` and dimmed styling, and skip `do()` on Enter or click. Verify task 1.1's palette cases pass.
- [x] 3.4 Move `BAND_COLOR` from `ReportPanel.tsx` into `@/lib/metrics-bands` and add a `BAND_LABEL` map (`good`/`fair`/`poor`). In `DeltaStrip.tsx`, render SSIM/Butteraugli per design D4, and render Decode as "—" without an encoded buffer. Verify task 1.1's DeltaStrip case passes, and that selecting two encoded PNGs of different content shows different SSIM values.
- [x] 3.5 Add a Disable-then-explain state to the Toolbar's Optimize all at an empty queue (disabled, `aria-disabled`, title "No files to optimize"), matching Export and Clear all. Verify by booting with an empty queue.

## 4. Keyboard and screen-reader access (inspector-ui: Keyboard-operable file queue; Accessible shell semantics; StatusBar)

- [x] 4.1 Add a pure `nextSelection` helper in `src/lib/` (design D5). Verify task 1.3 passes.
- [x] 4.2 Make the file list a listbox: in `FilesPane.tsx`, `role="listbox"` plus a keydown handler using `nextSelection`; in `FileRow.tsx`, `role="option"`, `aria-selected`, and roving `tabIndex`, with focus moved via refs. Set the ⋮ button to `tabIndex={-1}`. Verify task 1.2's selection case passes.
- [x] 4.3 Anchor the row menu: synthesize `contextmenu` at the button's rect (click) or the row's rect (Shift+F10 / ContextMenu key on the row). Verify task 1.2's menu case passes.
- [x] 4.4 Remove `role="application"` from `AppShell.tsx`. Add `aria-label` to each `ResizableHandle` naming the panes it separates. Add an accessible name to the SVGO Aggressive switch. Verify an in-page check of focusable elements without a name returns 0, with files loaded and the SVGO tab open.
- [x] 4.5 Narrow the StatusBar live region and fix separators (design D9). Verify the empty-queue StatusBar text is "Idle" with no "· ·", and that the only `[aria-live]` inside `statusbar` contains no "SVGO" text.
- [x] 4.6 In `SegControl.tsx`, replace container `overflow-hidden` with per-item rounding and an inset focus ring. Verify with a screenshot of keyboard focus on the AVIF option that all four sides of the ring are visible.

## 5. Contrast and type (theming: oklch design tokens; Minimum UI text size)

- [x] 5.1 Apply the D6 token values in `src/index.css` with a comment citing this change and the measured ratios. Make the decorative "→" in `FileRow` `aria-hidden`. Verify the impeccable detector on the empty, populated, and palette-open states in both themes reports no `low-contrast` findings, or only ones documented as false positives.
- [x] 5.2 Sweep `text-[10px]`/`text-[11px]` to `text-xs` across `src/components/{shell,panels}` and any smaller size in `src/components/ui/kbd.tsx`. Grow the StatusBar height to fit (design D7). Verify `grep -rnE "text-\[(8|9|10|11)(\.5)?px\]" src/components` matches only the file-row badge, and that the detector reports no `undersized-ui-text`/`tiny-text` findings.
- [x] 5.3 Check at 1280×800 in both themes that the file-row sizes line does not wrap and that the Toolbar fits; add `whitespace-nowrap` where needed. Verify with screenshots.

## 6. Narrow-viewport layout (inspector-ui: Narrow-viewport layout)

- [x] 6.1 Add `src/hooks/useNarrowViewport.ts` (design D8) and a `mobilePane` key plus setter in `ui.ts`. Verify `stores.test.ts` still passes.
- [x] 6.2 In `AppShell.tsx`, render the Files / Preview / Settings tablist with one pane when narrow, and replace `w-screen` with `w-full`. Make the Toolbar scroll horizontally, and let the filter shrink. Verify at 390×844 that `document.documentElement.scrollWidth <= innerWidth`, that exactly one pane is visible, and that switching tabs shows each pane.
- [x] 6.3 Add the 390px cases to `trust-and-a11y.spec.ts`: tab bar present, Preview tab shows the compare stage, no clipped elements. Verify they pass.

## 7. Specs housekeeping and full verification

- [x] 7.1 In `openspec/specs/inspector-ui/spec.md`, remove the Non-goals bullet about the "Auto" split-button being present in the shell (it no longer is). Verify `openspec validate --all` passes.
- [ ] 7.2 Run `npm test`, the Node tests (`stores.test.ts`, `next-selection.test.ts`, and the existing `*.test.ts`), `npm run build`, and `npm run test:bundle`. Compare `tsc -b` errors against the pre-change baseline. Verify there are no new failures and the bundle stays under budget.
- [x] 7.3 Re-run `/impeccable critique` on the main app and record the new score in this change. Verify that no P0 from the 2026-10-25 critique reappears.

## Notes

- **7.3 result (2026-10-25):** 17/40 → **25/40** (Acceptable). None of the earlier P0s reappeared. The detector finds 0 issues in the source and 0–1 in the browser across empty, populated, palette and light states (was 12/~25/18); the remaining hit is the intentional striped SVG badge. The re-run caught two misses against this change's own specs, both fixed in this change and covered by tests:
  - light-theme `--color-warn` text was 3.4:1 and is now 0.50 L (≥4.6:1); `--color-error` moved to 0.52 L
  - 19 inspector controls (Codec switches, sliders and resize inputs) had no accessible name
- **7.2 left open:** the e2e suite passes (149 passed, 1 skipped), `tsc -b` shows 0 errors, and the build succeeds. Two checks still fail, and both already failed on `main`:
  - `npm run test:bundle`: initial JS is 203.0 KB gzipped against a 200 KB budget. `main` measures 203.8 KB, so this change reduced it.
  - `stub-data.test.ts`: a module-import error under strip-types.

  Fixing the budget is a separate change.
- New issues from the re-run, outside this change's P0+P1 scope; candidates for follow-up changes:
  - SVG files show raster q/e chips (`CenterHeader.tsx:76` reads the global codec).
  - The Saved sign is inconsistent between views.
  - Desktop inspector tabs lack tab roles.
  - The "Data URI · Base64" section shows URL-encoded text.
  - The command palette has few commands.

