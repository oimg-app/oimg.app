## MODIFIED Requirements

### Requirement: DeltaStrip metric cards
The system SHALL render a DeltaStrip under the stage with cards for Original bytes, Optimized bytes, Saved bytes, SSIM, Butteraugli, and Decode time. Values SHALL be read from `$selectedFile` (bytes, decode time, metrics — see `metrics`) and `settingsAtom`. Metric cards SHALL show a neutral placeholder ("—") before the metric computes and when no file is selected, "N/A" when the metric does not apply to the file, and otherwise the computed value with its quality band. The Decode card SHALL show "—" when the selected file has no encoded result. No card MAY display a value that was not computed for the selected file.

#### Scenario: Metrics arrive after encode
- **WHEN** an entry finishes encoding but SSIM / Butteraugli have not computed yet
- **THEN** the byte cards show real values while the metric cards show a placeholder
- **AND** the metric cards update once the metrics compute

#### Scenario: No file selected
- **WHEN** the queue is empty
- **THEN** the SSIM, Butteraugli, and Decode cards all show "—"

#### Scenario: Different files show different metrics
- **WHEN** two encoded files with different computed SSIM values are selected in turn
- **THEN** the SSIM card shows each file's own value and band label

#### Scenario: Metric does not apply
- **WHEN** the selected file is an SVG encoded to SVG
- **THEN** the SSIM and Butteraugli cards show "N/A"
