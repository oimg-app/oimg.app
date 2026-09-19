# Optimize (SVG) Spec

## Purpose
Shrink SVG source markup with SVGO's browser build, expose each SVGO plugin as a per-file toggle in the inspector, and sanitize the output through DOMPurify so the result is safe to render inline and to copy to the clipboard.

## Requirements

### Requirement: SVGO optimization in the browser
The system SHALL optimize SVG sources using `svgo` v4 imported as `svgo/browser`. `optimize()` runs synchronously in the browser build; no Node shims are required.

#### Scenario: User drops a hand-authored SVG
- **WHEN** a `.svg` entry is optimized
- **THEN** the encoded buffer is UTF-8 SVG markup smaller than the input for typical unoptimized inputs

### Requirement: Preset-default with per-plugin overrides
The system SHALL enable SVGO's `preset-default` and let the user toggle individual plugins on/off. Each toggle SHALL apply as a `preset-default` override in the SVGO config (not by removing the preset).

#### Scenario: User disables `removeViewBox`
- **WHEN** the user turns off the `removeViewBox` plugin in the inspector's SVGO panel
- **THEN** the re-optimized SVG retains its `viewBox` attribute

### Requirement: SVG plugin inventory
The system SHALL surface the plugin grid from the shared `SVGO_PLUGINS` constant, showing each plugin's id, an on/off state, and its measured saved-percentage for the selected file.

### Requirement: DOMPurify sanitization
The system SHALL sanitize SVG markup through `dompurify` before rendering it inline anywhere in the app or exposing it as a snippet, so untrusted source content cannot execute scripts.

#### Scenario: Source SVG contains a `<script>` element
- **WHEN** the input SVG has a `<script>` tag inline
- **THEN** the rendered/exposed markup has the script stripped

### Requirement: SVG rendering in the compare view uses an isolation boundary
The system SHALL render SVG layers in the CompareStage inside a sandboxed iframe so styles and scripts in a source SVG cannot leak into the host document.

### Requirement: SVG can export to a raster codec
The system SHALL allow the user to rasterize an SVG source to a raster codec (PNG/JPEG/WebP/AVIF) using a main-thread canvas step before handing the pixels to the raster codec worker.

#### Scenario: User exports an SVG as PNG
- **WHEN** the user picks PNG output for an SVG entry
- **THEN** the SVG is rasterized on a main-thread canvas at the target size, and the resulting pixels are encoded via the raster PNG path

### Requirement: SVG-only settings are hidden for raster inputs and vice versa
The system SHALL show the "SVGO" inspector tab only when the selected entry is an SVG. It SHALL show the "Codec" inspector tab only when the selected entry is a raster source.

### Requirement: Aggressive mode toggle
The system SHALL expose an "Aggressive mode" switch that enables lossy SVGO transforms (e.g. path merging, precision cuts) with a short info line explaining that visual differences may occur.

## Non-goals

- SVG → SVG lossless-only guarantee (aggressive mode is user-opt-in and may change rendered output).
- Editing SVG source in-app (view + optimize + copy only).
- Multi-format `<picture>` fallback that mixes SVG and raster in one snippet (deferred to v1.3 snippet follow-ups).
- Inline `<svg>` snippet output — only data-URI SVG snippets are shipped (deferred to v1.3 snippet follow-ups).
