## Purpose

Establish a black-box Playwright test discipline for the app: every interactive UI element carries a stable `data-testid`, specs address them by testid only (no text or role coupling for interactive queries), and a coverage-audit script keeps the testid map and the spec references in sync in both directions.

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
- **THEN** every match either uses an allowed area prefix or is one of the pre-existing 27 testids preserved by the next requirement

### Requirement: Existing testids preserved
The system SHALL preserve the 27 testids already shipped as of this change: `titlebar`, `toolbar`, `statusbar`, `worker-pip`, `agg-counter`, `install-button`, `status-filecount`, `status-totals`, `backpressure-indicator`, `command-palette`, `files-pane`, `file-input`, `center-pane`, `inspector-pane`, `output-empty`, `output-panel`, `report-empty`, `report-panel`, `inspector-download`, `report-bar`, `ssim-row`, `ssim-score`, `butteraugli-row`, `butteraugli-score`, `format-row`, plus any other testids present in the pre-change tree. New testids SHALL supplement these, never rename them.

#### Scenario: A pre-existing testid stays valid after the change lands
- **WHEN** a spec written before this change addresses an element via one of the 27 pre-existing testids (e.g. `page.getByTestId('backpressure-indicator')`)
- **THEN** that testid still resolves in source after the change; the coverage audit records no rename

### Requirement: Vendored shadcn primitives forward data-testid
The `SegControl` and `Switch` primitives in `src/components/panels/inspector/` SHALL forward `data-testid` to their root element, and `SegControl` SHALL additionally attach `data-value` to each option button. A call site can then scope queries either at the root (`getByTestId('codec-seg-fit')`) or at an option (`locator('[data-testid="codec-seg-fit"] [data-value="contain"]')`).

#### Scenario: Per-option query on a SegControl
- **WHEN** a spec needs to click the `contain` option of the resize Fit SegControl
- **THEN** `page.locator('[data-testid="codec-seg-fit"] [data-value="contain"]').click()` selects it without any visible-text fallback

### Requirement: No text or role coupling for interactive queries
Playwright specs (`src/tests/*.spec.ts`) SHALL NOT use `getByRole(...)` or `getByText(...)` to LOCATE interactive elements. These matchers are allowed only for read-only assertions on landmark roles (e.g. `page.getByRole('status')` for an ARIA-live region) or for verifying the visible label of an already-testid-located element.

#### Scenario: Interactive-query audit passes
- **WHEN** a grep across `src/tests/*.spec.ts` looks for `getByRole(` / `getByText(` used against interactive elements
- **THEN** it returns zero violations; every legitimate use is a read-only landmark assertion documented in a spec comment

### Requirement: Shared test helper module
The system SHALL expose a `src/tests/_helpers/` module set covering: base64 image fixtures, ingest helpers (drop / URL / paste), row selection, inspector navigation, encode-and-metric waiters, clipboard read/write, `showDirectoryPicker` mocking, PWA readiness, and a store-inspection helper. Every new Playwright spec SHALL import from this module rather than re-implement the same primitives inline.

#### Scenario: A new spec depends only on the helpers plus Playwright
- **WHEN** a new spec is added under `src/tests/*.spec.ts`
- **THEN** its imports come from `@playwright/test` and `./_helpers/*` — not from ad-hoc inline fixture buffers or duplicated setup blocks

### Requirement: Bidirectional coverage audit script
The system SHALL ship a coverage-audit script (Node, run via a dedicated npm script) that fails the build in both directions: any `data-testid` present in `src/` (excluding `src/tests/`) that no spec references, AND any testid a spec references that no source file exports.

#### Scenario: Adding an orphan testid fails the build
- **WHEN** a developer adds `data-testid="new-thing"` in a component but no spec references it
- **THEN** the audit script exits non-zero, blocking the merge

#### Scenario: Removing a source testid without updating specs fails the build
- **WHEN** a developer removes `data-testid="codec-slider-quality"` from source but a spec still references it
- **THEN** the audit script exits non-zero, blocking the merge

### Requirement: Suite green on chromium CI
`npm test` SHALL exit 0 on the chromium project in CI after this change lands. At most one automatic retry per test is permitted, and only for the known metrics-worker warmup case (extended waiters in `_helpers/encode.ts`).

#### Scenario: CI run of the full suite passes
- **WHEN** CI runs `npm test` on chromium against `main` after this change is merged
- **THEN** the job exits 0; the report shows no permanent failure and at most one retry per test, always attributable to metrics-worker warmup

## Non-goals

- Node unit tests (`src/tests/*.test.ts`) — untouched; they cover pure logic (`clipboard`, `snippets`, `metrics-bands`, `versions`, `settings`, `stores`, etc.) and don't fit the black-box charter.
- Real `beforeinstallprompt` click faking in `pwa.spec.ts` — the `install-button` presence is asserted but click-through remains deferred (browser user-gesture requirement).
- Full `DeltaStrip.tsx` testid enumeration — the Wave 5 implementer applies the same convention to the DeltaStrip cards; not enumerated up-front here.
- CI infrastructure changes — no new GitHub Actions workflow, no new reporter, no test-sharding.
- Testids intended solely for visual regression / screenshot diffing — a separate concern.
- Per-capability spec deltas that duplicate the testid → element map. The map lives in the archived companion doc at `openspec/changes/archive/quick/260826-e2e/PLAN.md`; the requirement here is "every interactive element carries a testid that follows the convention", not "here is the exhaustive per-element list".
- Firefox / WebKit browser projects in Playwright — chromium-only is the shipped scope.
