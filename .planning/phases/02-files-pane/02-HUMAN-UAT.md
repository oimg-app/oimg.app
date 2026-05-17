---
status: partial
phase: 02-files-pane
source: [02-VERIFICATION.md]
started: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual smoke test — all 6 ROADMAP success criteria
expected: Header shows "Queue · 12 files"; 12 rows render with badge/meta/dot; row click highlights; right-click and ctxbtn both open ContextMenu; Remove from queue removes the row and decrements count and totals; Totals bar shows 4 non-zero stat cells; Dropzone is always visible above file list
result: [pending]

### 2. CR-01 — ghost selection after removing selected file
expected: Removing the currently-selected file clears the detail panel (selectedId reverts to null or advances to next file)
result: [pending]

### 3. CR-02 — rowMenu phantom highlight after removal
expected: After removal the accent-dim highlight disappears from all rows (rowMenu properly cleared)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
