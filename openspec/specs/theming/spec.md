# Theming Spec

## Purpose
Present a dark-default, light-alternate visual identity built from an oklch token palette. Theme selection is exposed in the View menu and driven by `next-themes`; the CSS variable set drives every component the shell renders.

## Requirements

### Requirement: Dark default, light alternate
The system SHALL boot in dark theme by default and offer light as an explicit alternate.

#### Scenario: First load
- **WHEN** the app boots with no user action
- **THEN** `<html>` has the `dark` class and `data-theme="dark"`

### Requirement: Theme state in `uiAtom`
The system SHALL hold the active theme as `uiAtom.theme: 'dark' | 'light'`, mutated through the `setTheme(t)` action.

#### Scenario: Action updates the atom
- **WHEN** `setTheme('light')` is called
- **THEN** `uiAtom.get().theme` is `'light'`

### Requirement: Sun/Moon toggle in the Toolbar
The system SHALL expose a Sun/Moon icon button in the Toolbar that flips `uiAtom.theme` between `'dark'` and `'light'`.

#### Scenario: User clicks the toggle
- **WHEN** the user clicks the Sun/Moon button
- **THEN** `setTheme` runs and the shell repaints in the new palette

### Requirement: DOM effect writes both class and data-theme
The system SHALL, on every theme change, apply both `document.documentElement.classList.toggle('dark', theme === 'dark')` and `document.documentElement.setAttribute('data-theme', theme)` via an `AppShell` `useEffect`. The `.dark` class drives Tailwind `dark:` variants and third-party palettes (e.g. sonner reads `documentElement.classList.contains('dark')`); the `data-theme` attribute scopes the oklch CSS-variable set.

#### Scenario: Switch to light
- **WHEN** the theme changes from `'dark'` to `'light'`
- **THEN** `<html>` loses the `dark` class and has `data-theme="light"`

### Requirement: oklch design tokens
The system SHALL define the color palette in oklch. The token set (accent green ~145°, surfaces, foregrounds, borders) lives in `src/index.css` / `src/styles/legacy.css` and is locked as the visual identity.

#### Scenario: Component reads a token
- **WHEN** any component consumes a color
- **THEN** it reads a CSS variable from the token set (e.g. `var(--color-fg-2)`), never a hard-coded hex

### Requirement: Typography stack
The system SHALL self-host and use `Inter` (UI), `JetBrains Mono` (code), and `Geist` (`@fontsource-variable/*`).

#### Scenario: Fonts load locally
- **WHEN** the app renders UI text and code snippets
- **THEN** the computed font-family is Inter for UI and JetBrains Mono for code, and the font files are served from the app's own origin (no third-party font requests)

### Requirement: Theme survives across the app
The system SHALL apply the chosen theme uniformly to the shell, panes, popovers, dialogs, tooltips, toasts, and the command palette. Nothing SHALL render in a mismatched palette.

#### Scenario: Overlays follow the theme
- **WHEN** the user switches to light and opens the command palette, a tooltip, and triggers a toast
- **THEN** each overlay renders with the light token set, matching the shell

## Non-goals

- Auto-follow-OS theme mode (only explicit user selection is shipped through the View menu toggle).
- User-editable / custom themes.
- Per-pane theming.
- High-contrast or dyslexia-friendly font swaps (accessibility work is the WCAG-AA contrast baseline of the shipped tokens; further presets are not shipped).
- Theme persistence across devices or reloads (`uiAtom.theme` is in-memory only; no storage layer is wired). Server sync is excluded by the zero-server constraint.
- `next-themes` is listed in `package.json` but not wired — the in-house `uiAtom.theme` + `AppShell` effect above drive theming. Removing the unused dependency is a separate cleanup.
