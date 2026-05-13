---
status: testing
phase: 04-decode-resize-memory-model
source: [04-VERIFICATION.md]
started: 2026-05-12T00:42:16Z
updated: 2026-05-12T09:00:00Z
---

## Current Test

number: 2
name: SC-2 Memory Budget — 50-file batch under 800 MB peak
expected: |
  Drop 50 PNG files simultaneously. Peak JS heap (Chrome DevTools → Memory → Performance) stays below 800 MB. Pool admission gate throttles if it would exceed budget.
awaiting: user response

## Tests

### 1. SC-1 Runtime — Density checkbox export target behavior
expected: Drop a PNG file. In Inspector "Resize / Variants", click "2x" → checkbox marks the file for 2x export on next Export. No new file rows created. Unchecking removes the export target. Source density locked.
result: FAILED — current implementation calls addSourceWithVariants and creates new file rows in the list. Correct behavior: checkboxes are per-file export-target settings, not file-list generators.

### 2. SC-2 Memory Budget — 50-file batch under 800 MB peak
expected: Drop 50 PNG files simultaneously. Peak JS heap (Chrome DevTools → Memory → Performance) stays below 800 MB. Pool admission gate throttles if it would exceed budget.
result: [pending]

### 3. SC-3 Metadata Strip — ICC profile removed from PNG output
expected: Drop the test file with an ICC profile. Download the optimized output. Confirm no `iCCP` bytes in the output file (e.g. `xxd output.png | grep iCCP` returns nothing).
result: [pending]

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

### Gap 1 — SC-1: Wrong density checkbox semantics
status: failed
description: onToggle calls addSourceWithVariants and creates new file rows. Correct behavior: checkboxes are per-file export-target settings stored in state (no new rows). Export pipeline reads these targets and produces multiple output files.
fix: Rewrite onToggle to write density targets to a per-file settings slice instead of calling addSourceWithVariants/removeFile/removeFamily. Revert addSourceWithVariants fan-out wiring from TargetDensityCheckboxes entirely.
