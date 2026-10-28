## RENAMED Requirements

- FROM: `### Requirement: `client`-mode WASM loading`
- TO: `### Requirement: In-thread quantizer loading`

## MODIFIED Requirements

### Requirement: `numColors` and `dither` parameters
The system SHALL forward `numColors` (palette size) and `dither` (dithering strength) to the quantizer when quantization is enabled. Before forwarding, the system SHALL coerce `numColors` to an integer in the range 2–256 and `dither` to a number in the range 0–1, so that no value reachable from the UI or from stored settings can make the quantizer reject the job. The inspector SHALL NOT offer a `numColors` value outside 2–256. Changing the dithering strength SHALL NOT change the stored palette size.

#### Scenario: User lowers `numColors`
- **WHEN** the user drops `numColors` from 256 to 32
- **THEN** the re-encoded PNG is measurably smaller and the visible palette is coarser

#### Scenario: Colors control at its minimum
- **WHEN** the user drags the Colors control to its lowest position with Reduce palette on
- **THEN** the control reads 2 and the file encodes successfully

#### Scenario: Out-of-range stored value
- **WHEN** a job arrives with Reduce palette on and a palette size of 1, 0, 300, 12.5, or a non-numeric value
- **THEN** the job is quantized with a palette size inside 2–256 and completes without a range error

#### Scenario: Dithering changed with no file selected
- **WHEN** the user changes the default dithering strength
- **THEN** the default palette size keeps its previous value

### Requirement: In-thread quantizer loading
The system SHALL load and run the libimagequant WASM module inside the codec worker's own thread, without spawning a nested worker. The module and its WASM binary SHALL be fetched lazily, on the first job that enables quantization, from a same-origin location that resolves in both the dev server and the production build. Loading or running the quantizer MUST NOT install, replace, or otherwise interfere with the codec worker's message handling.

#### Scenario: Production build quantizes
- **WHEN** the production build is served and a file is encoded with Reduce palette on
- **THEN** the quantizer assets load with HTTP 200 from the app's own origin and the file encodes successfully

#### Scenario: Quantizer assets are not fetched until needed
- **WHEN** the app loads and files are encoded with Reduce palette off
- **THEN** no quantizer script or WASM request is made

#### Scenario: Worker stays usable after quantizing
- **WHEN** a worker has completed a job with Reduce palette on and then receives a job with Reduce palette off
- **THEN** the second job returns a normal encoded result

#### Scenario: Quantize loads its WASM in production
- **WHEN** the production build is served and the user encodes a PNG-8
- **THEN** imagequant initializes without spawning a nested worker and the encode succeeds without a WASM fetch error

## ADDED Requirements

### Requirement: Quantize failure is isolated to its job
The system SHALL treat a failure to load or run the quantizer as a failure of that job only. The job SHALL reject with a message that names color reduction as the failing step, and the worker SHALL continue to serve later jobs normally.

#### Scenario: Quantizer fails, next job succeeds
- **WHEN** the quantizer cannot be loaded for a job with Reduce palette on, and the user then turns Reduce palette off for the same file
- **THEN** the first job surfaces a per-file "reduce colors" error and the re-encode with Reduce palette off succeeds

#### Scenario: SVG source converted to raster with palette on
- **WHEN** the user imports an SVG, picks PNG, JPEG, or AVIF as the output codec, and turns Reduce palette on
- **THEN** the file encodes to the chosen codec, and switching between those codecs afterwards keeps producing encoded results
