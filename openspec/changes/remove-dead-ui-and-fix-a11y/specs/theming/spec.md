## MODIFIED Requirements

### Requirement: oklch design tokens
The system SHALL define the color palette in oklch. The token set (accent green ~145°, surfaces, foregrounds, borders) lives in `src/index.css` / `src/styles/legacy.css` and is locked as the visual identity. In both themes, every foreground token used for text, and text on the accent fill, SHALL reach at least 4.5:1 contrast against each surface token it is rendered on (`bg-0` to `bg-2`, and the selected-row accent tint). Tokens MAY change lightness to meet this; hue and chroma stay locked.

#### Scenario: Component reads a token
- **WHEN** any component consumes a color
- **THEN** it reads a CSS variable from the token set (e.g. `var(--color-fg-2)`), never a hard-coded hex

#### Scenario: Contrast audit in both themes
- **WHEN** the detector's contrast check runs on the empty, populated, and palette-open states in dark and in light theme
- **THEN** it reports no text below 4.5:1, including the primary "Optimize all" button in light theme

## ADDED Requirements

### Requirement: Minimum UI text size
The system SHALL render all UI text at 12 px or larger. The only exception is the decorative format badge inside a file row's thumbnail, which is hidden from assistive technology.

#### Scenario: Text size audit
- **WHEN** computed font sizes of visible text elements are checked with files loaded
- **THEN** none is below 12 px except the file-row format badge
