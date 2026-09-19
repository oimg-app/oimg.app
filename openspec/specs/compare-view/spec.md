# Compare View Spec

## Purpose
Show the selected file's original next to its encoded output so the developer can eyeball quality/artifact tradeoffs while dialing settings. A split slider, wheel-to-zoom, four stage backgrounds, and a DeltaStrip with byte and quality metrics answer "is it still good?" in one pane.

## Requirements

### Requirement: Center pane layout
The system SHALL render `CenterPane` as three vertical sections: a header with breadcrumb and zoom control, the `CompareStage`, and a `DeltaStrip` under the stage.

### Requirement: Header breadcrumb and zoom
The system SHALL render in the header a breadcrumb of the selected file's name, a `type → target` tag, a dimensions tag, and a quality/settings tag — all read from `$selectedFile`. A zoom dropdown SHALL read and write `uiAtom.zoom`.

### Requirement: Original vs encoded split compare
The system SHALL render two overlaid layers in the CompareStage — the source on the left, the encoded output on the right — separated by a draggable split handle that writes `uiAtom.split`. A CSS `--split` variable drives the reveal on the DOM.

#### Scenario: User drags the split handle
- **WHEN** the user drags the split handle from 50 % to 20 %
- **THEN** the encoded layer covers 80 % of the width and the split label positions follow the handle

### Requirement: Real bytes on both sides
The system SHALL render real, decoded image bytes for both sides once the entry reaches `status === 'done'`. Before that, the encoded side renders a placeholder (queued/processing/error).

#### Scenario: Codec mismatch
- **WHEN** the buffer's `encodedCodec` doesn't match the entry's current `settings.codec` (e.g. mid-switch)
- **THEN** the encoded layer renders a placeholder rather than a stale image of the previous codec

### Requirement: Wheel-to-zoom that keeps the point under the cursor fixed
The system SHALL zoom the compare stage on wheel events, scaling around the cursor position (the pixel under the cursor stays under the cursor as scale changes). Wheel handling MUST be non-passive so the page does not scroll during zoom.

#### Scenario: User wheels while hovering a corner detail
- **WHEN** the user wheel-zooms in on a specific pixel
- **THEN** that pixel stays under the cursor as the image grows; the page does not scroll

### Requirement: Four stage backgrounds
The system SHALL offer four selectable stage backgrounds — `checker-dark` (default), `checker-light`, `black`, `white` — swatched in the CenterHeader and stored in `uiAtom.stageBg`.

#### Scenario: User evaluates a semi-transparent PNG
- **WHEN** the user switches from `checker-dark` to `white`
- **THEN** the stage background updates immediately and the checker size/position is not lost on subsequent theme changes

### Requirement: SVG layers rendered in a sandboxed iframe
The system SHALL render SVG sources and SVG-target outputs in a sandboxed `<iframe>` inside the CompareStage so scripts and styles in the SVG cannot leak into the host document.

#### Scenario: Compare an SVG optimized to itself
- **WHEN** the selected entry is an SVG on both sides
- **THEN** each side is rendered inside its own sandboxed iframe

### Requirement: Encoded layer switches iframe/img on codec change
The system SHALL switch the encoded layer element between `<iframe>` (SVG-target) and `<img>` (raster-target) as the output codec changes, so raster targets don't render inside an iframe and SVG targets get their sandbox.

### Requirement: DeltaStrip metric cards
The system SHALL render a DeltaStrip under the stage with cards for Original bytes, Optimized bytes, Saved bytes, SSIM, Butteraugli, and Decode time. Values SHALL be read from `$selectedFile` (bytes, decode time, metrics — see `metrics`) and `settingsAtom`. Metric cards SHALL show a neutral placeholder before the metric computes.

## Non-goals

- Side-by-side (not overlapping) compare mode (only the split reveal is shipped).
- Difference-map / heatmap overlay (visual perceptual diff visualization is not shipped even though Butteraugli powers a scalar metric).
- Pixel-picker / color-sample tool.
- Zoom controls beyond the header dropdown + wheel (no pinch-zoom on trackpad-only, no keyboard `+/-`).
- Multi-file side-by-side compare (one selected file at a time).
