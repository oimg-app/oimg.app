---
phase: 01-foundation
plan: "04"
subsystem: data-utilities
tags: [foundation, data, utilities, types, stub-data, formatters]
dependency_graph:
  requires: ["01-01"]
  provides: ["src/lib/format.ts", "src/lib/stub-data.ts"]
  affects: ["Phase 2+ stores", "Phase 2+ components (via stores only)"]
tech_stack:
  added: []
  patterns: ["pure utility functions", "readonly tuple literals as const", "verbatim data port from example-ui"]
key_files:
  created:
    - src/lib/format.ts
    - src/lib/stub-data.ts
  modified: []
decisions:
  - "RESIZE_ALGS named plural (vs data.jsx singular RESIZE_ALG) per REQUIREMENTS.md"
  - "fmtPct zero-savings returns '' not '—' — matches test spec and plan spec (zero-savings guard)"
  - "STORE-08 notice embedded at file top to enforce component import prohibition"
metrics:
  duration: "5min"
  completed: "2026-05-14"
  tasks: 2
  files: 2
---

# Phase 1 Plan 04: Stub Data + Format Utilities Summary

**One-liner:** Typed mock data (12 files, 22 SVGO plugins, codec/algo/fit constants, 26-entry phosphor icon map) and pure byte/percent formatters ported verbatim from example-ui/data.jsx.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/lib/format.ts (STORE-06) | ef04ff2 | src/lib/format.ts |
| 2 | Create src/lib/stub-data.ts (STORE-05 + ICON-01) | f008e1d | src/lib/stub-data.ts |

## Verification Results

- `format.test.ts`: 8 passed, 0 failed
- `stub-data.test.ts`: 6 passed, 0 failed
- STUB_FILES: 12 entries (f1–f12)
- SVGO_PLUGINS: 22 entries
- CODECS: 5 / RESIZE_ALGS: 4 / FIT_MODES: 3
- ICON_MAP: 26 lucide→phosphor entries

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is populated verbatim from example-ui/data.jsx.

## Threat Flags

None — pure data/utility modules with no network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- src/lib/format.ts exists: FOUND
- src/lib/stub-data.ts exists: FOUND
- Commit ef04ff2 exists: FOUND
- Commit f008e1d exists: FOUND
