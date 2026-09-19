# Resize Spec

## Purpose
Let the user resize raster images before encoding so the exported asset ships at the target dimensions. Resize runs inside the codec worker via `@jsquash/resize` before the encode step, so the final byte size reflects the smaller pixel count.

## Requirements

### Requirement: Resize toggle per file
The system SHALL expose a "Resize on export" toggle in the inspector's Codec panel. When off, the encoded output matches the source dimensions.

#### Scenario: Toggle is off (default)
- **WHEN** the user encodes a 4000×3000 JPEG with resize off
- **THEN** the encoded output is 4000×3000

### Requirement: Target dimensions
The system SHALL accept target width and height inputs when resize is on. Width and height are read/written through the settings store (`FileSettings.w` / `.h`).

### Requirement: Fit modes
The system SHALL offer at least the fit modes surfaced by `@jsquash/resize`: `stretch` (independent axes, may distort) and `contain` (preserve aspect ratio, fit inside the box).

#### Scenario: User picks `contain` with a non-matching aspect box
- **WHEN** the user sets 800×800 with `contain` on a 4000×3000 source
- **THEN** the output preserves aspect (e.g. 800×600) rather than being stretched to a square

### Requirement: Algorithm choice
The system SHALL expose the resize algorithms `@jsquash/resize` provides — `lanczos3`, `mitchell`, `catrom`, `triangle` — as an inspector selector, with `lanczos3` a reasonable default.

#### Scenario: User switches algorithm
- **WHEN** the user changes the algorithm from `lanczos3` to `triangle`
- **THEN** the re-encoded output reflects the new resampler (byte-different bytes)

### Requirement: Resize runs before encode inside the worker
The system SHALL execute resize inside the codec worker in the same job as the encode step, so the encoder sees the already-resized pixels and never the source resolution.

### Requirement: Resize applies to raster inputs only
The system SHALL hide the resize UI when the selected entry is an SVG (SVG sizing is driven by `viewBox`/`width`/`height` on the SVG root, not by a raster resampler).

## Non-goals

- Native `cover` fit (only `stretch` and `contain` are surfaced; `cover` is not a jSquash-supported fit method).
- 1×/2×/3× density variant emission from a single run (VAR-01/VAR-02 deferred to v1.3).
- SVG canvas rasterization uses a different code path (main-thread `<canvas>`, see `optimize-svg`) and is not part of this capability.
- Percentage-based or long-edge-first resize inputs (only explicit width/height).
