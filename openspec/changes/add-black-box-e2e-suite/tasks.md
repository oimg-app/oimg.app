## 1. Wave 1 — Plumbing (green immediately)

- [ ] 1.1 Add ~120 `data-testid` attributes across TitleBar, Toolbar, FilesPane, FileRow, InspectorPane, CodecPanel, SvgoPanel, OutputPanel, ReportPanel, CenterHeader, CompareStage, CommandPalette, and the Settings popover per the file-by-file map in `openspec/changes/archive/quick/260826-e2e/PLAN.md#3-data-testid-audit--naming-convention--task-list`. Verify: `grep -r 'data-testid' src/components | wc -l` returns at least the pre-change baseline plus ~120.
- [ ] 1.2 Add `data-testid` root-prop passthrough to `SegControl` + `Switch` in `src/components/panels/inspector/`, plus `data-value` on each `SegControl` option. Verify: rendering `<SegControl data-testid="t" options=[...] />` puts the attribute on the root and each option button carries its `data-value`.
- [ ] 1.3 Create `src/tests/_helpers/` module set: `fixtures.ts`, `ingest.ts`, `select.ts`, `inspector.ts`, `encode.ts`, `clipboard.ts`, `directory.ts`, `pwa.ts`, `store.ts`. Verify: each file's exports type-check under `node --experimental-strip-types` when imported from a spec.
- [ ] 1.4 Migrate the 4 text-coupled specs (`inspector-tabs.spec.ts`, `output-panel.spec.ts`, `file-row-menu.spec.ts`, `navigation.spec.ts`) to the new testid selectors. Verify: `npm test -- --grep "inspector-tabs|output-panel|file-row-menu|navigation"` passes, and grep of these files for `getByRole(|getByText(` on interactive elements returns zero.

## 2. Wave 2 — Smoke + shell

- [ ] 2.1 Add `src/tests/smoke.spec.ts` — all shell testids visible on boot, empty-state placeholders visible, `agg-counter` empty. Verify: `npm test -- --grep smoke` passes.
- [ ] 2.2 Add `titlebar-menus.spec.ts` — Codec / View / Help menus + version label; last-visible-pane guardrail refuses to hide the third. Verify: green.
- [ ] 2.3 Add `titlebar-cmdk.spec.ts` — ⌘K open, filter, arrow-nav, Enter/Esc, click-open. Verify: green on mac and non-mac keybindings.
- [ ] 2.4 Add `toolbar-controls.spec.ts` — Add-files split, Optimize-all, view-seg, Auto split, filter input, theme toggle, settings open/close. Verify: green.
- [ ] 2.5 Add `settings-popover.spec.ts` — tabs, workers button, Clear-all mirror of FilesPane, Diagnostics `<dl>` values match store, Copy diagnostics writes to the clipboard chokepoint. Verify: green.

## 3. Wave 3 — Files + rows

- [ ] 3.1 Add `filespane-controls.spec.ts` — empty state visible, each of 5 SORT_OPTIONS re-orders, Add-files button triggers hidden input, drag/drop over pane ingests. Verify: green.
- [ ] 3.2 Add `file-row-full.spec.ts` — ctxbtn opens menu, every item (Re-optimize / Save as / Copy data-URI / Copy `<picture>` / Reveal in compare / Apply-to-all / Remove) dispatches, row click selects, status dot reflects `queued`/`processing`/`done`/`error`. Verify: green with ≥3 fixture rows.

## 4. Wave 4 — Inspector

- [ ] 4.1 Add `inspector-tabs-testid.spec.ts` — tab switching + race guard when an encode is in-flight. Verify: green.
- [ ] 4.2 Add `codec-panel-per-codec.spec.ts` parametrized over PNG/WebP/JPEG/AVIF/SVG — per-codec knob visibility matrix, sliders trigger live re-encode. Verify: green; assert `encodedBuffer` re-generated on each slider move.
- [ ] 4.3 Add `codec-panel-avif-advanced.spec.ts` — master switch reveals nested controls, Sub/Tune SegControls apply, every advanced slider updates `settings.avif.*`, Match-alpha toggles alpha-quality visibility, Chroma-delta and Sharp-YUV switches flip. Verify: green.
- [ ] 4.4 Add `codec-panel-resize-palette.spec.ts` — Resize switch reveals inputs, Fit/Algorithm SegControls change params, palette Colors + Dithering sliders re-encode. Verify: green; assert encoded bytes differ between runs.
- [ ] 4.5 Add `svgo-panel.spec.ts` — Aggressive switch + every `SVGO_PLUGINS` plugin toggled with `aria-pressed` flipping and encoded bytes changing. Verify: green over the full plugin list.

## 5. Wave 5 — Center + delivery

- [ ] 5.1 Add `center-header.spec.ts` — 4 stage swatches drive `uiAtom.stageBg`, zoom dropdown 5 values apply, wheel-zoom updates label, breadcrumb `type→codec` / `q{n}` / `e{n}` tags reflect settings. Verify: green.
- [ ] 5.2 Add `compare-stage.spec.ts` — split handle drag updates `--split` CSS var, wheel-zoom scales around cursor, ORIG/OPT labels update after re-encode, codec-mismatch placeholder renders when `encodedCodec !== settings.codec`. Verify: green; if `page.mouse.wheel` proves flaky, fall back to mutating `uiAtom.zoom` via the `store` helper.
- [ ] 5.3 Enumerate `DeltaStrip.tsx` testids per convention (`center-delta-strip` + per-row card testids) and add spec coverage for numeric readouts. Verify: each card locatable; a spec asserts each card's number matches the store-computed value.

## 6. Wave 6 — Audit + polish

- [ ] 6.1 Add `src/tests/coverage-audit.test.ts` node script — bidirectional testid ↔ spec check per the `testing` spec's coverage-audit requirement. Verify: exits 0 on the clean tree; exits non-zero when a testid is temporarily removed or renamed in a scratch experiment.
- [ ] 6.2 Wire the audit script into `npm run test:bundle` (or add `npm run test:coverage-audit` and call both in CI). Verify: the wired command fails on a synthetic testid mismatch and passes on the clean tree.
- [ ] 6.3 Run `npm test` full sweep on chromium. Chase any flakes (metrics-worker warmup — extend `_helpers/encode.ts` `waitForMetrics`). Verify: green with at most one retry per test.
- [ ] 6.4 Grep `src/tests/*.spec.ts` for residual `getByRole(` / `getByText(` on interactive elements. Verify: zero interactive-query matches; every allowed match (landmark `role="status"`, ARIA-live regions) is documented in a spec comment.
