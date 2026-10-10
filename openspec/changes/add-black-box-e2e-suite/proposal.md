## Why

The Playwright suite has 29 specs carrying ~188 `getByRole` / `getByText` calls, so a label change silently breaks tests. The app ships only 25 distinct `data-testid` attributes — almost all on containers — leaving the majority of buttons, sliders, and switches unaddressable without a brittle role or text query. The three worst-coupled specs alone (`inspector-tabs` 30, `navigation` 25, `settings-diagnostics` 22) account for a fifth of those calls.

This change fixes the addressability gap and nothing else: it installs the testid substrate, the primitive passthrough, and the shared helper harness, then migrates the specs where the coupling hurts most. Writing new coverage for the untested feature areas is deliberately left to a follow-up change, so it can be argued on its own evidence rather than riding along on plumbing.

## What Changes

- Add ~120 stable `data-testid` attributes across TitleBar, Toolbar, FilesPane, FileRow, InspectorPane, CodecPanel, SvgoPanel, OutputPanel, ReportPanel, CenterHeader, CompareStage, CommandPalette, and the Settings popover, per the file-by-file map in the archived plan.
- Forward `data-testid` through the vendored shadcn `SegControl` and `Switch` primitives, plus `data-value` on each `SegControl` option so per-option queries stay stable.
- Introduce a new `src/tests/_helpers/` module set (fixtures, ingest, select, inspector, encode, clipboard, directory, pwa, store) as the shared harness for the black-box suite.
- Migrate 4 existing text-coupled specs (`inspector-tabs`, `output-panel`, `file-row-menu`, `navigation`) to the new testid selectors.
- Codify the naming convention, forbidden query patterns, and helper module contract in a new `testing` capability spec.

### Explicitly not in this change
- **14 new spec files** for the uncovered feature areas — deferred to a follow-up change.
- **A bidirectional coverage-audit build gate** — dropped outright. It enforces a coverage metric rather than a correctness property, and would fail the build whenever someone adds a testid during unrelated UI work.

## Capabilities

### New Capabilities
- `testing`: black-box Playwright test discipline. Every interactive UI element addressable via stable `data-testid` under a fixed naming convention; migrated and future specs use testids exclusively for interactive queries; one shared helper harness. Enforcement is by review convention, not a build gate.

### Modified Capabilities
None. Testability is a cross-cutting concern owned by the new `testing` capability. The existing capability specs (`inspector-ui`, `compare-view`, `optimize-raster`, `optimize-svg`, `resize`, `color-quantize`, `command-palette`, `diagnostics`, `pwa`, `metrics`, `snippets`, `export`, `ingest`, `worker-pool`, `theming`) stay silent on testid mechanics — none of their behavior contracts change.

## Impact

- **Code:** JSX-level additions across ~15 UI component files (~120 lines of `data-testid` attributes); 2-line prop passthrough on `SegControl` and `Switch`. No logic changes.
- **Test infrastructure:** new `src/tests/_helpers/` directory (10 files — the 9 specified plus `page-modules.ts`, see below); 4 spec migrations. No new spec files, no new npm scripts.
- **CI:** `npm test` goes from **74 failed / 54 passed** at the pre-change baseline to **127 passed / 1 skipped / 0 failed**. The e2e suite was already broadly red before this change; repairing it was not in the original scope but became unavoidable once the substrate landed (see Findings).
- **Risk:** low for the app itself. Adding a `data-testid` attribute changes no rendered text, role, or layout. The behavioural surfaces are the `SegControl` prop passthrough and one dev-server middleware widening in `vite.config.ts`.
- **Bundle:** **not** zero, as this proposal originally claimed. The attributes are inert at runtime but they are bytes: initial-route JS gzip goes **202.6 KB → 203.7 KB (+1.1 KB)**. Note the 200 KB budget in `src/tests/build.test.ts` was **already breached at baseline** (202.6 KB), so this change worsens an existing overage rather than causing one. Bringing the route back under budget is separate work.
- **Docs:** `openspec/specs/testing/spec.md` becomes the source of truth for test discipline; the historical rationale doc remains at `openspec/changes/archive/quick/260826-e2e/PLAN.md`.

## Findings

Adding the substrate exposed defects the red suite had been masking. All pre-dated this change; none were regressions from it.

1. **`page.evaluate` import specifiers (≈40 tests).** A dynamic import inside a `page.evaluate` callback resolves against the page URL, not the spec file, so `'../stores/files.ts'` fetched `/stores/files.ts`, got the SPA fallback, and threw. 12 specs plus `fixtures/ingest-helper.ts` were affected — and because that helper is shared, every spec calling `ingestFixtureFiles` failed too. Correct form is `'/src/stores/files.ts'`. Codified in `src/tests/_helpers/page-modules.ts`, which also documents how to satisfy tsc (a non-literal specifier plus a `typeof import(...)` cast) since `_helpers/` is typechecked while `*.spec.ts` is not.

2. **Butteraugli was permanently broken at runtime — a product bug, not a test bug.** `@squoosh-kit/visdif` requests its wasm at `…/visdif/wasm/visdif/visdif.wasm`, dropping the `dist/` segment its own JS was served from, and pnpm nests the real path under `.pnpm/`. The existing `serve-squoosh-kit-node-module-wasm` dev middleware matched neither shape, so the fetch returned `index.html` and `WebAssembly.instantiate` failed with "expected magic word 00 61 73 6d, found 3c 21 64 6f". The metric resolved `null`, so the Report panel rendered "N/A" for every file. The middleware now tries both `<pkg>/<rest>` and `<pkg>/dist/<rest>` and matches the nested path.

3. **`export-zip` asserted against the wrong control.** All six tests clicked the primary Export button (`exportOne`, single file) and then asserted ZIP contents; batch ZIP lives behind the split-button menu. They now use `toolbar-btn-export-menu` → `toolbar-item-export-zip`.

4. **Stale assertions against things that never existed.** `navigation.spec.ts` asserted `@squoosh-kit/core 0.6.0` — not a dependency, never rendered. `backpressure.spec.ts` asserted `animate-pulse` on an element that has never carried that class. Both now assert against live store state.

5. **`filespane-clear` / `toolbar-clear`** imported `defaultFileSettings` from `stub-data`, which imports but does not re-export it, yielding `undefined`.

6. **Fixture coherence.** Injecting an entry as `status: 'done'` without `encodedBuffer` produced a state the app cannot reach; consumers gated on encoded bytes still read as pending. Separately, `useOptimize` skips `status === 'done'`, so done fixtures make Optimize-all a no-op — `injectEntries` now takes a status.

7. **One test is skipped, not fixed.** `pwa.spec.ts`'s SW-registration test cannot pass against the dev server: `vite.config.ts` sets `devOptions.enabled: false` precisely because a dev SW breaks `crossOriginIsolated`, which the codecs need. Exercising it requires a production build behind `vite preview` — deliberately out of scope here.

Also noted and **not** addressed: `src/sw.ts` exists and `injectRegister: false` is set, but no code in `src/` calls `serviceWorker.register`, so the SW may never register in production either. And `src/tests/stub-data.test.ts` fails under the Node runner by importing the type `FileEntry` as a value. Both want their own change.
