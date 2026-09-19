# Color Quantize Spec

## Purpose
Reduce a raster image's palette to a small number of indexed colors before PNG encoding, producing PNG-8-shaped output that is dramatically smaller for UI graphics and screenshots. Backed by `@squoosh-kit/imagequant` (libimagequant), the only squoosh-kit surface the pipeline actually uses.

## Requirements

### Requirement: PNG palette control
The system SHALL expose a PNG palette selector in the inspector when the output codec is PNG. It SHALL offer at least three modes: off (24/32-bit PNG), auto, and PNG-8 (indexed palette).

#### Scenario: User picks PNG-8 on a UI screenshot
- **WHEN** the user selects PNG output with the palette in PNG-8 mode
- **THEN** the encoded buffer is a valid PNG with an indexed palette and its byte size is substantially smaller than the same source encoded without quantization

### Requirement: `numColors` and `dither` parameters
The system SHALL forward `numColors` (palette size) and `dither` (dithering strength) to `@squoosh-kit/imagequant` when quantization is enabled.

#### Scenario: User lowers `numColors`
- **WHEN** the user drops `numColors` from 256 to 32
- **THEN** the re-encoded PNG is measurably smaller and the visible palette is coarser

### Requirement: Quantize runs inside the codec worker
The system SHALL run quantization inside the codec worker on the raw pixels, before handing the (now indexed) pixels to the PNG encoder. Quantize output MUST be transferred to the encode step without a main-thread round trip.

### Requirement: `client`-mode WASM loading
The system SHALL initialize `@squoosh-kit/imagequant` in `client` mode, not the default `worker` mode. The default `worker` mode spawns a nested worker whose WASM URL breaks under Vite's SPA fallback; the `client`-mode discipline is a required project convention shared with `@squoosh-kit/visdif` (see `metrics`).

### Requirement: Quantize is skipped for non-PNG output
The system SHALL bypass quantization when the output codec is anything other than PNG. Palette reduction is a PNG-specific transform in this pipeline.

## Non-goals

- Palette export as a separate `.act` / `.gpl` file.
- Custom user-defined palettes (only `numColors` and `dither` are exposed).
- Quantization for AVIF/WebP/JPEG (those codecs handle their own color reduction internally through quality controls).
- Second encode pass through `@squoosh-kit/png` — jSquash's PNG path is the only encode surface used (`@squoosh-kit/{png,mozjpeg,webp,avif}` remain installed but not wired into the encode pipeline).
