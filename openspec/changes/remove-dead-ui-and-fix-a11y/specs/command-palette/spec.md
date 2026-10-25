## MODIFIED Requirements

### Requirement: Flat, searchable command list
The system SHALL render the command list from a flat computed atom (`$cmdFlat`) built off the app's registered commands, with a substring filter and keyboard navigation. Every listed command SHALL perform its labeled action; commands for features that are not built MUST NOT be registered. A command SHALL show a shortcut hint only when that shortcut is actually bound.

#### Scenario: User types "opt"
- **WHEN** the user types "opt" into the palette's search input
- **THEN** commands whose label matches (e.g. "Optimize all") filter to the top of the list

#### Scenario: No dead commands or fake shortcuts
- **WHEN** the palette opens with an empty query
- **THEN** it lists no "Add files", "Batch view", "Compare view", or "Report view" command, and no command shows a shortcut hint other than ⌘K

## ADDED Requirements

### Requirement: Commands unavailable on an empty queue
The system SHALL show queue-dependent commands ("Optimize all") as unavailable when the queue is empty: visibly dimmed, marked disabled for assistive technology, and inert on Enter or click. An unavailable command MUST NOT change worker status.

#### Scenario: Optimize all with no files
- **WHEN** the queue is empty and the user highlights "Optimize all" and presses Enter
- **THEN** nothing is dispatched, the StatusBar stays "Idle", and the option is reported as disabled

#### Scenario: Optimize all runs and finishes
- **WHEN** two files are queued and the user runs "Optimize all" from the palette
- **THEN** both files reach `done` and the StatusBar returns to "Idle" when they finish
