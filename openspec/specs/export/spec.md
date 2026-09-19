# Export Spec

## Purpose
Let the developer walk away with the results — one file at a time or the whole batch in a single ZIP. Where the browser offers native "save as", use it; otherwise fall back to `file-saver`. Filenames get their extension rewritten to match the output codec and collisions get a suffix.

## Requirements

### Requirement: Save one file
The system SHALL let the user save the currently-selected file's encoded bytes to disk from three surfaces: the Inspector's Download button, the FileRow context menu's "Save as…", and the Toolbar's "Save individually" bulk action (iterates entries).

#### Scenario: User downloads one file
- **WHEN** the user activates Save as… on a `done` entry
- **THEN** a file save prompt opens with the renamed filename and, on save, the file lands on disk with the encoded bytes

### Requirement: `showSaveFilePicker` primary, `file-saver` fallback
The system SHALL prefer `window.showSaveFilePicker` when available, falling back to `file-saver`. The dispatcher lives in one place (`src/lib/save-blob.ts`) so callsites do not branch.

### Requirement: Filename rewrite on save
The system SHALL rewrite the source filename's extension to match the output codec's MIME (e.g. `photo.heic` → `photo.jpg` when JPEG is picked) via `renameExtension`. The base name SHALL be sanitized (`sanitizeBaseName`) before saving.

### Requirement: Collision suffixing
The system SHALL append a numeric collision suffix (`-1`, `-2`, …) when two output entries would otherwise share a filename in the same target scope (individual saves and ZIP entries).

### Requirement: Batch ZIP export
The system SHALL let the user export all `done` entries as a single ZIP via `jszip`. The archive SHALL use a flat layout (no per-entry subdirectories) and its filename SHALL be `oimg-export-YYYY-MM-DD-HHMM.zip` (`timestampedZipName`).

#### Scenario: Twenty files export as ZIP
- **WHEN** the user runs Optimize All on 20 files then exports as ZIP
- **THEN** the ZIP contains 20 files at the root with rewritten extensions and collision suffixes as needed

### Requirement: Optimized-only export
The system SHALL include in ZIP and Save-individually only entries with `status === 'done'`. Queued / processing / error entries SHALL be skipped.

### Requirement: `$hasDone` disable-then-explain gate
The system SHALL keep the Export split-button, Save individually, and Export All ZIP affordances visible but disabled when no entry has `status === 'done'`. A tooltip SHALL explain "Optimize files first" rather than hiding the affordance.

### Requirement: Backpressure survives a large batch
The system SHALL, on Optimize All of a ≥ 20-file batch, keep the worker pool's peak concurrent running count at or below `min(hwConcurrency, 4)` (verified in e2e via a test-only `window.__peakRunning` bridge; see `worker-pool`).

## Non-goals

- Named or user-templated ZIP filenames (only the timestamped default ships).
- Subdirectories or per-format buckets inside the ZIP (flat layout is the shipped choice).
- Manifest JSON emitted as a file inside the ZIP (deferred — clipboard-only for now, see `snippets`).
- Cloud-storage export targets (Drive / iCloud / S3) — excluded by the zero-server constraint.
- Multi-density variant emission during export (VAR-01/VAR-02 deferred to v1.3).
- Native "save all to a directory" via `showDirectoryPicker` write access (the Toolbar's Save individually iterates single-file saves).
