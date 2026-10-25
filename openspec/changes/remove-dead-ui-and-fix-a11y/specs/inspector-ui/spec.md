## MODIFIED Requirements

### Requirement: File row context menu
The system SHALL open a per-row context menu with: Save as…, Copy data URI, Copy `<picture>`, and Remove from queue (danger). The menu SHALL open from a right-click on the row, from the row's context button, and from the keyboard (context-menu key or Shift+F10) on the focused row. When opened from the context button or the keyboard, the menu SHALL be anchored to the button or row, never to the viewport origin. The menu MUST NOT contain items that perform no action.

#### Scenario: User removes a file via the context menu
- **WHEN** the user right-clicks a row and chooses "Remove from queue"
- **THEN** the entry is removed from `filesAtom.entries` and the queue count drops by one

#### Scenario: Keyboard user opens the row menu
- **WHEN** a row has keyboard focus and the user presses Shift+F10
- **THEN** the row menu opens next to that row with focus on its first item
- **AND** pressing Escape closes the menu and returns focus to the row

#### Scenario: Context button opened with the keyboard
- **WHEN** the user activates a row's context button with Enter or Space
- **THEN** the menu opens adjacent to that button, not at the top-left of the viewport

### Requirement: Dropzone always visible above the file list
The system SHALL render a persistent "Drop images to optimize · or click to browse · max 200 files" dropzone above the file list, listing the supported format pills. The pills SHALL name exactly the formats ingest accepts (SVG · PNG · JPEG · WEBP · AVIF · HEIC) and MUST NOT advertise a format that ingest rejects.

#### Scenario: Dropzone stays visible with a populated queue
- **WHEN** the queue already contains files
- **THEN** the dropzone is still rendered above the file list with its format pills, and clicking it opens the file picker

#### Scenario: Advertised formats match the picker
- **WHEN** the dropzone renders
- **THEN** every format it lists is accepted by the file picker, and JXL is not listed

### Requirement: SVGO panel
The system SHALL render on the SVGO tab a Settings section with an Aggressive-mode toggle and info text, and a Plugins section with a plugin grid (id, on/off) driven by the SVGO plugin store. The grid MUST NOT display per-plugin savings figures that were not measured for the selected file.

#### Scenario: User toggles a plugin
- **WHEN** the user switches a plugin off in the Plugins grid
- **THEN** the switch reflects the new state and the selected SVG is re-optimized with that plugin disabled

### Requirement: Toolbar affordances
The system SHALL render a Toolbar with: Add files split-button (From device / Watch folder / From URL or paste), Optimize all, Export split-button (All as ZIP / Save individually / Copy `<picture>` HTML / Copy as data URIs / Manifest JSON), a file filter input, a theme toggle, and a settings/overflow menu (Clear all, diagnostics — see `diagnostics`). The Toolbar MUST NOT render a view switcher or an Auto-quality control until those behaviors exist.

#### Scenario: User opens the Export split-button
- **WHEN** the user opens the Export menu after a batch completes
- **THEN** it lists All as ZIP, Save individually, Copy `<picture>` HTML, Copy as data URIs, and Manifest JSON

#### Scenario: Toolbar has no inert controls
- **WHEN** the app loads
- **THEN** the Toolbar contains no Batch/Compare/Report switcher and no Auto button

### Requirement: StatusBar
The system SHALL render a StatusBar with: worker running/idle pip, live version badges (SVGO version, per-codec jSquash versions — see `diagnostics`), WASM status derived from the capability probe, file count + size summary, avg compression + saved bytes, and an ARIA-live polite region announcing X/Y optimized progress during a batch. The live region SHALL contain only the run state and progress text; version badges, capability text, and size summaries MUST sit outside any live region. Separators SHALL render only between items that are shown.

#### Scenario: Batch progress is announced
- **WHEN** a batch of files is optimizing
- **THEN** the StatusBar's polite ARIA-live region updates with "X/Y optimized" progress and the worker pip shows running, returning to idle when the batch ends

#### Scenario: Empty queue status bar
- **WHEN** the queue is empty
- **THEN** the StatusBar shows "Idle" with no empty progress slot or doubled separator, and its live region contains no version strings

## ADDED Requirements

### Requirement: No inert controls
The system SHALL render only controls that perform their labeled action. A control whose action is temporarily unavailable SHALL be disabled with an explanation (see "Disable-then-explain empty-state discipline"). A control whose feature is not built MUST NOT be rendered. This covers TitleBar menus, Toolbar buttons, menu items, and palette commands. The TitleBar SHALL NOT show status text that duplicates or contradicts the StatusBar's real state.

#### Scenario: TitleBar menus
- **WHEN** the app loads
- **THEN** the TitleBar shows the View menu and no Codec or Help menu

#### Scenario: TitleBar status text
- **WHEN** the app loads without a controlling service worker
- **THEN** no element in the app claims "Offline-ready"

### Requirement: Keyboard-operable file queue
The system SHALL expose the file queue as a single-select list with one tab stop. When the list receives focus, focus SHALL land on the selected row, or the first row if none is selected. ArrowUp and ArrowDown SHALL move the selection to the previous or next row and move focus with it. Home and End SHALL select the first and last row. Each row SHALL expose its selected state to assistive technology. Selecting a row by keyboard SHALL have the same effect as clicking it.

#### Scenario: Keyboard user selects a file
- **WHEN** three files are queued, the user tabs into the file list, and presses ArrowDown twice
- **THEN** the third row is selected and focused, and the CenterPane and InspectorPane show that file

#### Scenario: Selected state is announced
- **WHEN** a row is selected
- **THEN** that row reports itself as selected to assistive technology and the other rows report not selected

### Requirement: Accessible shell semantics
The system SHALL NOT apply `role="application"` to the app shell. Every focusable control SHALL have an accessible name, including the pane resize handles (named for the panes they separate) and the SVGO Aggressive-mode switch. Every focusable control SHALL show a visible focus indicator that is not clipped by its container.

#### Scenario: Screen reader browse mode
- **WHEN** a screen-reader user loads the app
- **THEN** no ancestor of the main content has `role="application"`

#### Scenario: Unnamed controls audit
- **WHEN** an automated check lists focusable elements without an accessible name
- **THEN** the list is empty, with files loaded and the SVGO tab open

#### Scenario: Segmented control focus
- **WHEN** a keyboard user focuses an option in the output-format segmented control
- **THEN** the focus ring is fully visible on all four sides

### Requirement: Narrow-viewport layout
The system SHALL, below 900 px viewport width, show one pane at a time with a tab bar to switch between Files, Preview, and Settings. Content MUST NOT be clipped. The Toolbar SHALL scroll horizontally instead of clipping its controls. At 900 px and wider, the three-pane resizable shell and the View menu pane toggles apply unchanged.

#### Scenario: Phone-width viewport
- **WHEN** the app renders at 390 px wide
- **THEN** a Files / Preview / Settings tab bar is shown, exactly one pane is visible, and no element extends beyond the viewport without being reachable by scrolling

#### Scenario: Switching panes on a narrow viewport
- **WHEN** the user selects the Preview tab at 390 px wide
- **THEN** the compare stage for the selected file fills the content area
