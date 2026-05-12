---
status: partial
phase: 04-decode-resize-memory-model
source: [04-VERIFICATION.md]
started: 2026-05-12T00:42:16Z
updated: 2026-05-12T00:42:16Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC-1 Runtime — Density checkbox creates/removes variant rows
expected: Drop a PNG file. In Inspector "Resize / Variants", click "2x" → a second @2x row appears in the file list. Click "2x" again to uncheck → the @2x row disappears. Locked source density (1x) button is non-interactive.
result: [pending]

### 2. SC-2 Memory Budget — 50-file batch under 800 MB peak
expected: Drop 50 PNG files simultaneously. Peak JS heap (Chrome DevTools → Memory → Performance) stays below 800 MB. Pool admission gate throttles if it would exceed budget.
result: [pending]

### 3. SC-3 Metadata Strip — ICC profile removed from PNG output
expected: Drop the test file with an ICC profile. Download the optimized output. Confirm no `iCCP` bytes in the output file (e.g. `xxd output.png | grep iCCP` returns nothing).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
