# Inspector UI Spec

## Purpose
Present the three-pane shell — file queue on the left, compare stage in the center, per-file settings on the right — that the developer works in. Pane visibility is user-controllable through the View menu and the whole layout is resizable, with the constraint that at least one pane always stays visible.

## Requirements

### Requirement: Three-pane resizable shell
The system SHALL render `AppShell` as a three-pane resizable layout: `FilesPane` on the left (~240 px default), `CenterPane` in the middle (flex-grow), `InspectorPane` on the right (~260 px default). The layout SHALL fill the viewport height and use `react-resizable-panels`.

#### Scenario: User drags a pane divider
- **WHEN** the user drags the divider between `FilesPane` and `CenterPane`
- **THEN** the two panes resize live and the new widths persist within the session

### Requirement: View menu with checkbox toggles for panes
The system SHALL surface Batch (FilesPane), Compare (CenterPane), and Inspector view (InspectorPane) as checkbox items in the TitleBar's View menu. All three SHALL be checked by default. Unchecking an item hides its pane.

#### Scenario: User hides the Inspector pane
- **WHEN** the user unchecks "Inspector view"
- **THEN** the InspectorPane is hidden and the remaining panes fill the width

### Requirement: Last-visible pane guardrail
The system SHALL refuse to hide the last visible pane. The View menu MUST leave the sole remaining pane's checkbox visually disabled (or otherwise refuse the state change) rather than allow an empty shell.

#### Scenario: User attempts to hide the only visible pane
- **WHEN** two panes are hidden and the user tries to uncheck the third
- **THEN** the state change is refused and at least one pane remains visible

### Requirement: FilesPane header and totals
The system SHALL render a queue header "Queue · N files" (N from `$filteredFiles.length`), a sort/filter icon opening a popover (queue order / file size / savings % / name / format; filter: all formats / errors only), and a totals bar with four cells (Total before / Total after / Saved / Compression %) computed from `$totals`.

### Requirement: File row rendering
The system SHALL render each queue row with a format thumbnail badge, file name, `orig → opt` sizes, savings-% badge (warn color when < 30 %), a progress bar when `status === 'processing'`, a status dot (done / processing / queued / error), and a context menu button.

#### Scenario: Row selection
- **WHEN** the user clicks a row
- **THEN** `filesAtom.selectedId` updates, the row highlights, and CenterPane + InspectorPane reflect the new selection

### Requirement: File row context menu
The system SHALL open a per-row context menu (right-click on the row or click the context button) with: Re-optimize, Save as…, Copy data URI, Copy `<picture>`, Reveal in compare, Apply same settings to all, Remove from queue (danger).

### Requirement: Dropzone always visible above the file list
The system SHALL render a persistent "Drop images to optimize · or click to browse · max 200 files" dropzone above the file list, listing the supported format pills (SVG · PNG · JPEG · WEBP · AVIF).

### Requirement: Inspector tabs
The system SHALL render the InspectorPane as tabs. The primary tab is "Codec" for raster entries or "SVGO" for SVG entries (auto-switches when `$selectedFile.type` changes). "Output" and "Report" tabs SHALL always be visible.

#### Scenario: User selects a raster then an SVG
- **WHEN** the selection changes from a PNG to an SVG
- **THEN** the primary tab flips from "Codec" to "SVGO" without losing the user's position on "Output" or "Report" if that was the active tab

### Requirement: Codec panel sections
The system SHALL render on the Codec tab: Output format selector, Lossless toggle (hidden for SVG), Parameters (quality, effort, PNG palette, AVIF subsample, section badge with engine name), Resize (see `resize`), and Metadata (Strip EXIF/XMP/IPTC, Keep ICC).

### Requirement: SVGO panel
The system SHALL render on the SVGO tab a Settings section with an Aggressive-mode toggle and info text, and a Plugins section with a plugin grid (id, on/off, saves %) driven by the SVGO plugin store.

### Requirement: Report tab
The system SHALL render on the Report tab a "Total savings" stats grid (before / after / saved / compression %), a per-file savings bar chart, and a "Format breakdown" section (per-format row with type label, file count, bytes saved) computed from `filesAtom.entries` and `$totals`. Quality metric rows (SSIM, Butteraugli) appear here — see `metrics`.

### Requirement: Toolbar affordances
The system SHALL render a Toolbar with: Add files split-button (From device / Watch folder / From URL or paste), Optimize all, Export split-button (All as ZIP / Save individually / Copy `<picture>` HTML / Copy as data URIs / Manifest JSON), Batch/Compare/Report view seg, and a settings/overflow menu (Clear all, diagnostics — see `diagnostics`).

### Requirement: StatusBar
The system SHALL render a StatusBar with: worker running/idle pip, live version badges (SVGO version, per-codec jSquash versions — see `diagnostics`), WASM status derived from the capability probe, file count + size summary, avg compression + saved bytes, and an ARIA-live polite region announcing X/Y optimized progress during a batch.

### Requirement: Disable-then-explain empty-state discipline
The system SHALL, for actions that require queue entries (Optimize all, Export, Clear all), keep the affordance visible but disabled when the queue is empty, with a tooltip explaining why. Actions MUST NOT be hidden.

## Non-goals

- Redocking or freely-positioning panes (only show/hide + resize).
- User-defined layouts stored across sessions.
- Setting presets or a saved-preset picker (PERS-01 deferred to v1.3).
- Recent files list (deferred; store surface + Toolbar item both not shipped).
- Butteraugli-target "Auto" split-button (present in the shell but the auto-quality search behind it is not wired).
