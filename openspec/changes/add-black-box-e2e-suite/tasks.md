## 1. Testid substrate

- [x] 1.1 Add ~120 `data-testid` attributes across TitleBar, Toolbar, FilesPane, FileRow, InspectorPane, CodecPanel, SvgoPanel, OutputPanel, ReportPanel, CenterHeader, CompareStage, CommandPalette, and the Settings popover per the file-by-file map in `openspec/changes/archive/quick/260826-e2e/PLAN.md#3-data-testid-audit--naming-convention--task-list`. Every new id follows the `{area}-{component}-{element}[-{qualifier}]` convention; none of the 25 pre-existing ids are renamed. Verify: `grep -rho 'data-testid=["{][^"}]*' src/ | sort -u | wc -l` grows from 25 to ~145, and all 25 originals still appear in that list.
- [x] 1.2 Add `data-testid` root-prop passthrough to `SegControl` + `Switch` in `src/components/panels/inspector/`, plus `data-value` on each `SegControl` option. Verify: rendering `<SegControl data-testid="t" options=[...] />` puts the attribute on the root and each option button carries its `data-value`.

## 2. Helper harness

- [x] 2.1 Create `src/tests/_helpers/` module set: `fixtures.ts`, `ingest.ts`, `select.ts`, `inspector.ts`, `encode.ts`, `clipboard.ts`, `directory.ts`, `pwa.ts`, `store.ts`. Verify: each file's exports type-check under `node --experimental-strip-types` when imported from a spec. Modules with no caller yet are expected — the set is specified as a complete harness so later specs don't grow a second one.

## 3. Spec migration

- [x] 3.1 Migrate the 4 text-coupled specs (`inspector-tabs.spec.ts`, `output-panel.spec.ts`, `file-row-menu.spec.ts`, `navigation.spec.ts`) to testid selectors, sourcing setup from `_helpers/`. Verify: `npm test -- --grep "inspector-tabs|output-panel|file-row-menu|navigation"` passes, and grep of these 4 files for `getByRole(|getByText(` on interactive elements returns zero. Any remaining match is a read-only landmark assertion carrying an explanatory comment.

## 4. Regression gate

- [x] 4.1 Run the full `npm test` sweep on chromium. Verify: all 29 specs green — the 25 unmigrated ones pass untouched — with at most one retry per test, attributable only to metrics-worker warmup (extend `_helpers/encode.ts` waiters if it recurs).
