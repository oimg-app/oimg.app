## MODIFIED Requirements

### Requirement: Settings popover with a Diagnostics tab
The system SHALL render a Toolbar Settings popover with Radix Tabs. A "General" tab holds general controls: Clear all, and a read-only line stating the worker pool's actual concurrency (not a button, since the count is derived from hardware and is not user-configurable). A "Diagnostics" tab renders the version + capability dl-list and a "Copy diagnostics" button that copies the whole readout to the clipboard (via the shared clipboard chokepoint — see `snippets`).

#### Scenario: User files a bug report
- **WHEN** the user opens Diagnostics and clicks "Copy diagnostics"
- **THEN** the clipboard receives a plain-text readout containing every version and capability the atoms know about

#### Scenario: Worker concurrency is shown, not offered
- **WHEN** the user opens the General tab on a machine reporting 8 hardware threads
- **THEN** it reads "Workers: 4 (auto)" as plain text that is not focusable or clickable
