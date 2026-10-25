## MODIFIED Requirements

### Requirement: SVG plugin inventory
The system SHALL surface the plugin grid from the shared `SVGO_PLUGINS` constant, showing each plugin's id and an on/off state. The grid MUST NOT show a per-plugin saved percentage unless it was measured for the selected file.

#### Scenario: User opens the SVGO tab for an SVG
- **WHEN** an SVG entry is selected and the SVGO tab is shown
- **THEN** the plugin grid renders one row per `SVGO_PLUGINS` entry with its id and on/off switch, and no static savings figure
