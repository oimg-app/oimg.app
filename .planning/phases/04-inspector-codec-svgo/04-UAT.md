---
status: complete
phase: 04-inspector-codec-svgo
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-05-20T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Inspector tab bar renders with correct style
expected: Tab bar shows CODEC / OUTPUT / REPORT. Active tab has 2px bottom border in accent green. Inactive tabs have no border, dimmer text.
result: pass

### 2. Tab switching works
expected: Clicking OUTPUT tab highlights it with accent bottom border and shows "Output — coming in Phase 6". Clicking REPORT shows "Report — coming in Phase 6". Clicking CODEC returns to codec panel.
result: pass

### 3. Output format button group — non-SVG file
expected: With a PNG/JPG/WebP file selected, the "Output format" section shows a single segmented button group with 4 options: WebP / AVIF / JPEG / PNG. No SVG option visible. Clicking each option highlights it.
result: pass

### 4. Output format button group — SVG file
expected: With an SVG file selected, the "Output format" section shows 5 options: WebP / AVIF / JPEG / PNG / SVG. The SVG option is visible only for this file type.
result: pass

### 5. Quality and Effort sliders
expected: With a non-SVG file and WebP codec selected, the "WebP parameters" section shows Quality (0–100) and Effort (0–6) sliders. Dragging each slider moves the thumb and updates the numeric readout next to it.
result: pass

### 6. Resize toggle
expected: "Resize on export" toggle is off by default. Clicking it reveals Width / Height inputs and Fit / Algorithm controls below. Toggling off hides them again.
result: pass

### 7. SVGO inline when SVG codec selected
expected: With an SVG file selected, clicking the SVG option in the output format group shows SVGO sections inline in the codec tab: "SVGO preset" (with Aggressive mode toggle) and "Plugins · N / 22" list. No separate SVGO tab exists.
result: pass

### 8. SVGO plugin toggle
expected: In the Plugins section (SVG file, SVG codec), clicking a plugin row toggles it: plugin name gets strikethrough + dim color when off, accent checkbox + normal text when on. The "N / 22" count in the section title updates.
result: pass

### 9. SVG → non-SVG auto-codec reset
expected: Select an SVG file, confirm SVG codec is active. Then select a non-SVG file. The codec automatically switches to WebP (SVG option disappears, WebP is highlighted).
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
