# Optimize (Raster) Spec

## Purpose
Take a raster source (PNG / JPEG / WebP / AVIF / HEIC-decoded) and produce a smaller encoded buffer of a chosen output codec, driven by per-file settings the inspector exposes. Encoding runs in the codec Web Worker; every codec WASM is dynamic-imported lazily so the initial route stays small.

## Requirements

### Requirement: PNG optimization via OxiPNG
The system SHALL decode PNG inputs with `@jsquash/png` and re-encode them via `@jsquash/oxipng` producing a smaller PNG.

#### Scenario: User selects a PNG and picks PNG output
- **WHEN** a PNG entry has `settings.codec = 'PNG'` and `status` transitions through the pipeline
- **THEN** the encoded buffer is a valid PNG whose byte size is less than or equal to the input (for typical unoptimized inputs it is strictly smaller)

#### Scenario: User adjusts OxiPNG effort
- **WHEN** the user changes the effort/method knob (0–6)
- **THEN** the re-run produces a byte-different result reflecting the new effort level

### Requirement: WebP encode
The system SHALL encode raster inputs to WebP via `@jsquash/webp`, honoring the inspector's `quality` (0–100), `method` (0–6), and `lossless` toggle.

#### Scenario: Quality slider drives byte size
- **WHEN** the user moves the WebP quality slider from 80 to 40
- **THEN** the re-encoded WebP is measurably smaller and the change is reflected in the FilesPane savings badge

### Requirement: JPEG (MozJPEG) encode
The system SHALL encode raster inputs to JPEG via `@jsquash/jpeg` (MozJPEG), honoring `quality` and `progressive` from the inspector.

#### Scenario: Progressive toggle takes effect
- **WHEN** the user toggles Progressive on a JPEG target
- **THEN** the encoded buffer is a different (progressive-mode) JPEG

### Requirement: AVIF encode with lazy WASM
The system SHALL encode raster inputs to AVIF via `@jsquash/avif`. The ~3.4 MB AVIF WASM binary MUST NOT be fetched during initial page load; it MUST be fetched only on the first AVIF encode.

#### Scenario: Initial route AVIF-clean
- **WHEN** the app boots without the user selecting AVIF
- **THEN** the AVIF WASM binary is not requested (PIPE-02 discipline: codec imports live inside the worker's `switch` branch, verified by bundle-budget grep sentinels)

#### Scenario: First AVIF encode
- **WHEN** the user picks AVIF as the output codec for the first time in the session
- **THEN** the AVIF WASM is fetched and cached (subsequent AVIF encodes reuse it)

### Requirement: AVIF advanced knobs behind an opt-in switch
The system SHALL expose the full `@jsquash/avif` `EncodeOptions` surface (subsample, tune, sharpness, tile rows/cols, denoise, chroma delta-Q, and other advanced fields) as an inspector "Advanced (AVIF)" section gated by an opt-in switch. When the switch is off, the worker MUST send only the baseline `{quality, speed, lossless}` triple, producing output byte-for-byte identical to pre-advanced behavior.

#### Scenario: Advanced switch off (default)
- **WHEN** a user encodes AVIF with the Advanced switch off
- **THEN** the worker call carries only `{quality, speed, lossless}` and the resulting bytes match the historic baseline

#### Scenario: Advanced switch on
- **WHEN** the user opts in and changes an advanced knob (e.g. tune, subsample)
- **THEN** the worker clamps each knob to its jSquash-valid range and the re-encoded bytes reflect the setting

### Requirement: Per-file settings, applied one at a time
The system SHALL store settings per queue entry (`FileEntry.settings`) so different files may be optimized differently in a single batch. A global default (`settingsAtom`) SHALL seed each new entry.

#### Scenario: User changes settings on file A only
- **WHEN** the user selects file A and drops WebP quality to 30 while file B keeps quality 80
- **THEN** running Optimize All produces file A at q=30 and file B at q=80 in the same batch

### Requirement: Apply-to-all
The system SHALL provide an "Apply to all files" action that pushes the current global default settings onto every queue entry's per-file settings.

#### Scenario: User batches a folder then unifies settings
- **WHEN** the user drops 12 files, tweaks the global codec/quality, then triggers Apply to all
- **THEN** every entry's `settings` mirrors the global default in a single synchronous store update

### Requirement: Metadata handling
The system SHALL expose "Strip EXIF / XMP / IPTC" and "Keep ICC profile" toggles per file and honor them at encode time for codecs that carry metadata.

### Requirement: Live preview re-encode
The system SHALL debounce inspector setting changes into a background "live encode" of the selected file so the compare view reflects the new bytes without a full batch run.

#### Scenario: User drags a slider
- **WHEN** the user drags WebP quality through several values
- **THEN** intermediate encodes are debounced/coalesced; the compare view updates with the final settled value's real encoded bytes

### Requirement: Output codec is tagged on the buffer
The system SHALL tag each encoded buffer with the codec that produced it (`FileEntry.encodedCodec`) so downstream views (compare, snippets, export) know how to interpret the bytes.

#### Scenario: Codec mismatch in compare stage
- **WHEN** the selected file's `encodedCodec` differs from `settings.codec` (e.g. the user just switched codec but no re-encode has landed yet)
- **THEN** the compare stage's encoded layer renders a placeholder rather than a stale image of the previous codec

### Requirement: Per-file error isolation
The system SHALL surface encode failures on the offending entry only (`setFileError`) and MUST NOT abort the batch on a single failure.

#### Scenario: One file in a batch of 20 fails to decode
- **WHEN** file 7's decode throws in the worker
- **THEN** file 7's status becomes `error` with a message; the other 19 continue to `done`

### Requirement: Codec WASM stays out of the initial route
The system SHALL enforce PIPE-02: every codec/metric WASM import lives inside its worker `switch` branch, never hoisted to the file top. A build-time grep asserts on hoist sentinels (e.g. `bezkrovny` for SSIM, `VisDiff` for visdif) to fail the build if the initial JS chunk grows past the 200 KB gzipped budget.

## Non-goals

- HEIC encode (only decode is shipped; export a HEIC source to JPEG/WebP/AVIF/PNG).
- JPEG XL, WebP2, JPEG 2000, and any codec outside the jSquash + squoosh-kit set (locked).
- 1×/2×/3× density variants of the same source in one run (VAR-01/VAR-02 deferred to v1.3).
- 10/12-bit AVIF (`bitDepth` was dropped — jSquash 10/12-bit needs `ImageData16bit`; the pipeline is 8-bit).
- Server-side encoding fallbacks (excluded by the zero-server constraint).
