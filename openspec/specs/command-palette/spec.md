# Command Palette Spec

## Purpose
Give the developer keyboard-first access to the app's discoverable actions. A `cmdk`-based modal opens on `Cmd/Ctrl+K`, presents a searchable flat list of commands, and dispatches the selection through the same store actions the visible UI does.

## Requirements

### Requirement: Keyboard shortcut opens the palette
The system SHALL open the command palette on `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux). The palette state is stored in `uiAtom.cmdkOpen`.

#### Scenario: Cross-platform keyboard binding
- **WHEN** the user presses the platform-appropriate shortcut anywhere in the app
- **THEN** the palette opens as a modal overlay with the search input focused

### Requirement: Toolbar / TitleBar search button opens the palette
The system SHALL surface a Search / ⌘K button in the TitleBar that opens the same palette state.

### Requirement: Flat, searchable command list
The system SHALL render the command list from a flat computed atom (`$cmdFlat`) built off the app's registered commands, using `cmdk` for the fuzzy filter and keyboard navigation.

#### Scenario: User types "opt"
- **WHEN** the user types "opt" into the palette's search input
- **THEN** commands whose label matches (e.g. "Optimize all") filter to the top of the list

### Requirement: Keyboard navigation
The system SHALL move the highlighted selection with `↑` / `↓` (writing `uiAtom.cmdkSel`), execute the highlighted command on `Enter`, and close the palette on `Escape`.

### Requirement: Command dispatch through store actions
The system SHALL execute each command by calling the same store actions the visible affordances call. A palette invocation of Optimize All MUST NOT go through a parallel dispatch path.

### Requirement: Footer key hints
The system SHALL render a footer inside the palette showing the current bindings for navigate / select / close so the shortcuts are discoverable in-place.

## Non-goals

- Command groups / sections in the list (the shipped surface is a flat list).
- User-editable command bindings.
- Command history / recently-used weighting.
- Palette-only commands (every command is reachable from a visible affordance too).
- Async command status inside the palette (commands close the palette on execute; long-running actions surface state through the shell — toasts, backpressure).
