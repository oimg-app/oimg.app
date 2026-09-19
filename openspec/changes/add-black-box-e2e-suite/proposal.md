## Why

The Playwright suite has ~28 specs but coverage is uneven and selector-brittle: many specs query interactive elements via `getByRole` / `getByText`, so a label change silently breaks tests, and whole feature areas (TitleBar menus, CommandPalette navigation, CodecPanel knobs, SvgoPanel plugins, CenterHeader swatches, CompareStage split handle) have no coverage at all. The app carries only ~27 `data-testid` attributes — mostly on containers — leaving the majority of buttons/sliders/switches unaddressable without brittle role or text queries.

## What Changes

- Add ~120 stable `data-testid` attributes across TitleBar, Toolbar, FilesPane, FileRow, InspectorPane, CodecPanel, SvgoPanel, OutputPanel, ReportPanel, CenterHeader, CompareStage, CommandPalette, and the Settings popover, per the file-by-file map in the archived plan.
- Forward `data-testid` through the vendored shadcn `SegControl` and `Switch` primitives, plus `data-value` on each `SegControl` option so per-option queries stay stable.
- Introduce a new `src/tests/_helpers/` module set (fixtures, ingest, select, inspector, encode, clipboard, directory, pwa, store) as the shared harness for the black-box suite.
- Add 14 new Playwright spec files targeting the uncovered feature areas; migrate 4 existing text-coupled specs (`inspector-tabs`, `output-panel`, `file-row-menu`, `navigation`) to the new testid selectors.
- Add a `coverage-audit` node script that fails the build when any `data-testid` in `src/` is not referenced by a spec, or any spec references a testid that no longer exists in source.
- Codify the naming convention, forbidden query patterns, helper module contract, and audit-script guarantee in a new `testing` capability spec.

## Capabilities

### New Capabilities
- `testing`: black-box Playwright test discipline. Every interactive UI element addressable via stable `data-testid`; specs use testids exclusively for interactive queries; shared helper harness; bidirectional testid ↔ spec coverage audit.

### Modified Capabilities
None. Testability is a cross-cutting concern owned by the new `testing` capability. The existing capability specs (`inspector-ui`, `compare-view`, `optimize-raster`, `optimize-svg`, `resize`, `color-quantize`, `command-palette`, `diagnostics`, `pwa`, `metrics`, `snippets`, `export`, `ingest`, `worker-pool`, `theming`) stay silent on testid mechanics — none of their behavior contracts change.

## Impact

- **Code:** JSX-level additions across ~15 UI component files (~120 lines of `data-testid` attributes); 2-line prop passthrough on `SegControl` and `Switch`. No logic changes.
- **Test infrastructure:** new `src/tests/_helpers/` directory (9 files); 14 new spec files; 4 spec migrations; 1 coverage-audit unit test.
- **CI:** existing `npm test` command covers the new specs unchanged; `npm run test:bundle` gains (or a new sibling script wires) the coverage-audit assertion.
- **Bundle:** zero runtime impact — `data-testid` attributes are inert; no production JS change beyond markup attributes.
- **Docs:** `openspec/specs/testing/spec.md` becomes the source of truth for test discipline; the historical rationale doc remains at `openspec/changes/archive/quick/260826-e2e/PLAN.md`.
