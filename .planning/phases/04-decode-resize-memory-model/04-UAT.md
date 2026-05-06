---
status: complete
phase: 04-decode-resize-memory-model
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-04-SUMMARY.md
  - 04-05-SUMMARY.md
  - 04-06-SUMMARY.md
  - 04-07-SUMMARY.md
started: 2026-05-06T00:00:00.000Z
updated: 2026-05-06T01:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev`. App boots with zero console errors. The main UI renders: file queue (empty), toolbar with Add button, status bar at bottom. No red errors in browser console.
result: pass

### 2. Drop PNG → density fan-out
expected: Drag a PNG file onto the drop zone (or click Add button and pick one). The file list shows **3 rows** named `<basename>@1x.png`, `<basename>@2x.png`, `<basename>@3x.png` — one per target density.
result: issue
reported: "Not it's the way it shoud works like this"
severity: major

### 3. Optimize PNG → savings appear
expected: With at least one PNG in the queue, click "Optimize all". Each row transitions through processing and lands with a savings readout (e.g. "−42%"). No console errors. The Optimize button becomes Cancel during the run and reverts when done.
result: pass
note: "Currently-processing file is indicated in the list; savings appear per-row as each completes"

### 4. Compare view — original vs optimized
expected: After optimizing, click one of the file rows. The center pane shows a split or overlay view with the original image on one side and the optimized image on the other. Both images are visible.
result: pass

### 5. Source density control (per-row popover)
expected: Hover over a file row. A small icon button appears (source density control). Click it → a popover opens showing "1x", "2x", "3x" options. The current density is highlighted. Clicking a different option closes the popover and updates the label.
result: issue
reported: "No source density control on file rows — source density and variants both live in Inspector panel (Resize / Variants section) as checkbox buttons only"
severity: major

### 6. Inspector — TweaksPanel Resize/Variants section
expected: Select a file row. In the right Inspector pane, a "Resize / Variants" section is visible with checkboxes or segmented buttons for target densities (1x / 2x / 3x) and a resize algorithm selector below it.
result: pass

### 7. Duplicate filename rename toast
expected: Drop two separate PNG files that share the same base name (e.g. two copies of `logo.png`). A toast notification appears saying something like "N files renamed to avoid collisions". The duplicate rows get `(2)` suffixed names.
result: pass

### 8. Unsupported file → skip toast
expected: Drop a non-image file (e.g. a `.txt` or `.mp4`). The file does NOT appear in the queue. A toast fires saying "N unsupported files skipped" (or similar wording).
result: pass

### 9. Memory backpressure indicator (StatusBar)
expected: When a large batch of PNGs is optimizing and the memory budget is exceeded, the StatusBar shows a "Memory pacing active" pill. (Skip this test if you don't have 50+ large PNG files handy — mark as n/a.)
result: pass

## Summary

total: 9
passed: 7
issues: 2
skipped: 0
pending: 0

## Gaps

- truth: "Drop a PNG → file list shows 3 rows named @1x/@2x/@3x — one per target density"
  status: failed
  reason: "User reported: Not it's the way it shoud works like this"
  severity: major
  test: 2
  artifacts: []
  missing: []
- truth: "Hover a file row → source density icon button appears → popover with 1x/2x/3x options"
  status: failed
  reason: "No per-row source density control. Density+variants both live in Inspector TweaksPanel only"
  severity: major
  test: 5
  artifacts: []
  missing: []
