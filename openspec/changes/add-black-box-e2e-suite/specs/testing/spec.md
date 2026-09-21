## Purpose

Establish the testability substrate for a black-box Playwright discipline: every interactive UI element carries a stable `data-testid` following a fixed naming convention, the vendored shadcn primitives forward that attribute, and a shared helper harness gives specs one place to get fixtures, ingest, selection, and encode waiters. Specs written against this substrate address interactive elements by testid only — no text or role coupling.

## ADDED Requirements

### Requirement: Interactive elements expose stable data-testid attributes
The system SHALL attach a `data-testid` attribute to every interactive element in the shipped UI — every button, link, menu trigger, menu item, checkbox item, radio, switch, slider, tab trigger, input, and stage swatch. Container elements SHALL also carry a testid when a spec needs to root a scoped query.

#### Scenario: Every actionable control is addressable
- **WHEN** a Playwright spec needs to click, focus, type into, drag, or read the state of any user-actionable element
- **THEN** that element is locatable via `page.getByTestId(...)` alone, with no fallback to text or role selectors

#### Scenario: Renaming a UI label does not require a spec change
- **WHEN** a component's visible label changes (e.g. "Optimize all" becomes "Run")
- **THEN** the `toolbar-btn-optimize-all` testid is unchanged and every spec referencing it continues to pass

### Requirement: Testid naming convention
The system SHALL name every `data-testid` in the pattern `{area}-{component}-{element}[-{qualifier}]`, in ASCII kebab-case, English only, with no ephemeral state embedded (no `-open`, no `-active` — use `data-state` / `aria-*` for state). The permitted area prefixes are: `titlebar-`, `toolbar-`, `files-`, `inspector-`, `codec-`, `svgo-`, `output-`, `report-`, `center-`, `compare-`, `cmdk-`, `settings-`, `status-`, `backpressure-`. Testids derived from `FileEntry.id` (a UUID minted in `useIngest`) are permitted for per-row scoping (e.g. `files-row-{id}`).

#### Scenario: Convention audit passes
- **WHEN** a grep of `data-testid=` across `src/` runs against the allowed-prefix regex
- **THEN** every match either uses an allowed area prefix or is one of the pre-existing 25 testids preserved by the next requirement

### Requirement: Existing testids preserved
The system SHALL preserve the 25 testids already shipped as of this change: `agg-counter`, `backpressure-indicator`, `butteraugli-row`, `butteraugli-score`, `center-pane`, `command-palette`, `file-input`, `files-pane`, `format-row`, `inspector-download`, `inspector-pane`, `install-button`, `output-empty`, `output-panel`, `report-bar`, `report-empty`, `report-panel`, `ssim-row`, `ssim-score`, `status-filecount`, `status-totals`, `statusbar`, `titlebar`, `toolbar`, `worker-pip`. New testids SHALL supplement these, never rename them.

#### Scenario: A pre-existing testid stays valid after the change lands
- **WHEN** a spec written before this change addresses an element via one of the 25 pre-existing testids (e.g. `page.getByTestId('backpressure-indicator')`)
- **THEN** that testid still resolves in source after the change, and the 25 existing specs that reference it keep passing untouched

### Requirement: Vendored shadcn primitives forward data-testid
The `SegControl` and `Switch` primitives in `src/components/panels/inspector/` SHALL forward `data-testid` to their root element, and `SegControl` SHALL additionally attach `data-value` to each option button. A call site can then scope queries either at the root (`getByTestId('codec-seg-fit')`) or at an option (`locator('[data-testid="codec-seg-fit"] [data-value="contain"]')`).

#### Scenario: Per-option query on a SegControl
- **WHEN** a spec needs to click the `contain` option of the resize Fit SegControl
- **THEN** `page.locator('[data-testid="codec-seg-fit"] [data-value="contain"]').click()` selects it without any visible-text fallback

### Requirement: No text or role coupling for interactive queries
The four specs migrated by this change (`inspector-tabs.spec.ts`, `output-panel.spec.ts`, `file-row-menu.spec.ts`, `navigation.spec.ts`) and every Playwright spec added after it SHALL NOT use `getByRole(...)` or `getByText(...)` to LOCATE interactive elements. These matchers are allowed only for read-only assertions on landmark roles (e.g. `page.getByRole('status')` for an ARIA-live region) or for verifying the visible label of an already-testid-located element.

The remaining pre-existing specs are explicitly out of scope: they keep their role/text queries and migrate opportunistically, whenever a spec is touched for another reason. This requirement is a review convention, not a mechanically enforced gate.

#### Scenario: Interactive-query audit passes on the migrated specs
- **WHEN** a grep across the four migrated specs looks for `getByRole(` / `getByText(` used against interactive elements
- **THEN** it returns zero violations; every legitimate use is a read-only landmark assertion documented in a spec comment

#### Scenario: An untouched legacy spec is not a violation
- **WHEN** a pre-existing spec outside the migrated four still locates a button via `getByRole('button', { name: … })`
- **THEN** it remains conformant; the obligation attaches only once that spec is edited for another purpose

### Requirement: Shared test helper module
The system SHALL expose a `src/tests/_helpers/` module set covering: base64 image fixtures, ingest helpers (drop / URL / paste), row selection, inspector navigation, encode-and-metric waiters, clipboard read/write, `showDirectoryPicker` mocking, PWA readiness, and a store-inspection helper. The four migrated specs and every Playwright spec added after this change SHALL import from this module rather than re-implement the same primitives inline.

#### Scenario: A new spec depends only on the helpers plus Playwright
- **WHEN** a new spec is added under `src/tests/*.spec.ts`
- **THEN** its imports come from `@playwright/test` and `./_helpers/*` — not from ad-hoc inline fixture buffers or duplicated setup blocks

#### Scenario: A helper with no caller yet is still conformant
- **WHEN** a helper module in the set (e.g. `pwa.ts`) has no importing spec at the time this change lands
- **THEN** it still satisfies this requirement; the module set is specified as a complete harness so later specs find one home for these primitives rather than growing a second set

### Requirement: Suite green on chromium CI
`npm test` SHALL exit 0 on the chromium project in CI after this change lands. Because this change adds only inert markup attributes, helper modules, and four spec migrations, no pre-existing spec may regress. At most one automatic retry per test is permitted, and only for the known metrics-worker warmup case (extended waiters in `_helpers/encode.ts`).

#### Scenario: CI run of the full suite passes
- **WHEN** CI runs `npm test` on chromium against `main` after this change is merged
- **THEN** the job exits 0; the report shows no permanent failure and at most one retry per test, always attributable to metrics-worker warmup

#### Scenario: Unmigrated specs are unaffected
- **WHEN** the change lands and the 25 specs outside the migrated four run unchanged
- **THEN** each passes exactly as before, since adding a `data-testid` attribute alters no rendered text, role, or layout

## Non-goals

- **New spec coverage for the uncovered feature areas** (TitleBar menus, CommandPalette navigation, CodecPanel knobs, SvgoPanel plugins, CenterHeader swatches, CompareStage split handle). This change ships the substrate that makes those specs cheap to write; writing them is separate work, to be proposed on its own merits rather than bundled here.
- **A bidirectional testid ↔ spec coverage-audit gate.** Deliberately dropped: it enforces a coverage metric, not a correctness property, and would break the build whenever a developer adds a testid during unrelated UI work. Revisit only if testid drift is observed in practice.
- **Migrating the 25 pre-existing specs** off role/text queries wholesale — they migrate opportunistically when touched.
- Node unit tests (`src/tests/*.test.ts`) — untouched; they cover pure logic (`clipboard`, `snippets`, `metrics-bands`, `versions`, `settings`, `stores`, etc.) and don't fit the black-box charter.
- Real `beforeinstallprompt` click faking in `pwa.spec.ts` — the `install-button` presence is asserted but click-through remains deferred (browser user-gesture requirement).
- Full `DeltaStrip.tsx` testid enumeration — the same convention applies to the DeltaStrip cards whenever they are addressed; not enumerated up-front here.
- CI infrastructure changes — no new GitHub Actions workflow, no new reporter, no test-sharding.
- Testids intended solely for visual regression / screenshot diffing — a separate concern.
- Per-capability spec deltas that duplicate the testid → element map. The map lives in the archived companion doc at `openspec/changes/archive/quick/260826-e2e/PLAN.md`; the requirement here is "every interactive element carries a testid that follows the convention", not "here is the exhaustive per-element list".
- Firefox / WebKit browser projects in Playwright — chromium-only is the shipped scope.
