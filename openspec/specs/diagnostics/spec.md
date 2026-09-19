# Diagnostics Spec

## Purpose
Surface real build and runtime facts — actual package versions, WASM feature detection, browser capabilities, service-worker state, worker concurrency — in place of the pre-1.2 hard-coded placeholder strings. Also carries the "Clear all" queue-hygiene affordance because it lives on the same settings surface. All values feed the StatusBar and the Settings-popover Diagnostics tab.

## Requirements

### Requirement: Build-time version injection
The system SHALL inline live version literals at build time via Vite `define` (see `vite.config.ts`), exposing them through the typed `BUILD_VERSIONS` constant in `src/lib/versions.ts` (svgo, per-codec jSquash, ssim, butteraugli buildHash). The store surface is `runtimeAtom.versions: typeof BUILD_VERSIONS` — consumers read from `runtimeAtom.versions`. No hard-coded version literal MUST appear in the shipped UI.

#### Scenario: A dependency bumps
- **WHEN** a codec dependency version changes in `package.json`
- **THEN** the next build's StatusBar and Diagnostics tab reflect the new version without any UI source edit

### Requirement: Runtime capability probe
The system SHALL run a capability probe at app boot (`src/lib/caps.ts` / `src/lib/capabilities.ts`), populating `capabilitiesAtom` with at minimum: `crossOriginIsolated`, `OffscreenCanvas`, `showSaveFilePicker`, `showDirectoryPicker`, `FileSystemObserver`, module workers, service worker, `hardwareConcurrency`, WASM SIMD, and WASM threads.

#### Scenario: A browser lacks `FileSystemObserver`
- **WHEN** the app boots in Firefox or Safari
- **THEN** the probe records `fileSystemObserver: false` and the Watch-folder ingest path degrades to snapshot mode (see `ingest`)

### Requirement: StatusBar reads live values
The system SHALL render in the StatusBar: worker running/idle pip, live SVGO version, live per-codec jSquash versions, and a WASM feature summary derived from `capabilitiesAtom` (e.g. "WASM threads on · SIMD"). The StatusBar MUST NOT carry hard-coded version literals.

### Requirement: Settings popover with a Diagnostics tab
The system SHALL render a Toolbar Settings popover with Radix Tabs. A "General" tab holds general controls; a "Diagnostics" tab renders the version + capability dl-list and a "Copy diagnostics" button that copies the whole readout to the clipboard (via the shared clipboard chokepoint — see `snippets`).

#### Scenario: User files a bug report
- **WHEN** the user opens Diagnostics and clicks "Copy diagnostics"
- **THEN** the clipboard receives a plain-text readout containing every version and capability the atoms know about

### Requirement: Offline-ready pill reflects real SW state
The system SHALL derive the shell's "Offline-ready" pill from the real service-worker registration state (from `src/lib/register-sw.ts`), not a hard-coded string.

### Requirement: `clearFiles()` action
The system SHALL expose a `clearFiles()` action on the files store, a `$queueEmpty` computed atom, and two surfaces that call the action: the Toolbar Settings popover's "Clear all" button and the FilesPane header's small × / XCircle icon.

#### Scenario: User clears a busy queue
- **WHEN** the user activates Clear all
- **THEN** every queued/done entry is removed and a warning toast confirms

### Requirement: Disable-then-explain when the queue is empty
The system SHALL, when `$queueEmpty === true`, disable both Clear-all surfaces (Toolbar + FilesPane header) with a tooltip. The affordances MUST NOT be hidden.

## Non-goals

- Persisted user preferences on the Settings popover's "General" tab (PERS-01 setting presets deferred to v1.3).
- Named diagnostics snapshots / share links (Copy-to-clipboard is the only sharing path).
- Telemetry, error reporting, or analytics uploads — excluded by the zero-telemetry constraint.
- Live "worker count" writable input (concurrency is derived from hardware; not user-tunable).
- Historical build-info diffs (each build stamps its own snapshot; there is no in-app changelog).
- Build date + short commit hash surfaced in the UI (`buildInfoAtom` was planned in the v1.2 diagnostics research doc, not shipped). Bug-report copy relies on package versions + capability probe; commit-hash reproducibility is deferred.
