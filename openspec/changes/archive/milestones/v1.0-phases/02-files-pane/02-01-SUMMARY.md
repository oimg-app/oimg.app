---
phase: 02-files-pane
plan: 01
subsystem: stores
tags:
  - phase-02
  - stores
  - nanostores
  - files-pane
dependency_graph:
  requires:
    - src/lib/stub-data.ts
    - nanostores
  provides:
    - src/stores/files.ts
    - src/stores/ui.ts
    - src/stores/index.ts
  affects:
    - Plan 02-02 (FileRow + FilesPane consumers)
tech_stack:
  added:
    - nanostores map + computed
  patterns:
    - Computed atoms in stores (D-03)
    - Full STORE-03 shape with Phase 3 stubs (D-04)
    - Circular ESM guard (ui.ts zero imports from sibling stores)
key_files:
  created:
    - src/stores/files.ts
    - src/stores/ui.ts
    - src/stores/index.ts
  modified: []
decisions:
  - D-03 honored: $filteredFiles/$selectedFile/$totals live in the store, not in components
  - D-04 honored: full STORE-03 shape in Phase 2; setRowMenu wired; 10 Phase 3 actions stubbed as no-ops
  - PITFALL-02 guard: $totals derives from s.entries (full list), never from $filteredFiles
  - CIRCULAR ESM guard: ui.ts imports only nanostores; zero imports from files/runtime/settings
metrics:
  duration: 10min
  completed: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 01: Store Foundation (filesAtom + uiAtom) Summary

nanostores map stores seeded from STUB_FILES (12 entries) with computed atoms ($filteredFiles, $selectedFile, $totals), full STORE-03 uiAtom shape, and barrel re-export — ready for Plan 02 component consumers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create filesAtom store (STORE-01) | 8ec53d0 | src/stores/files.ts |
| 2 | Create uiAtom store (STORE-03) | 1248c4a | src/stores/ui.ts |
| 3 | Create barrel index.ts | c8b9bdd | src/stores/index.ts |

## Exports Surfaced Through Barrel (@/stores)

**From files.ts:** `filesAtom`, `$filteredFiles`, `$selectedFile`, `$totals`, `selectFile`, `removeFile`, `setFilter`, `setSortBy`

**From ui.ts:** `View`, `Tab`, `uiAtom`, `setRowMenu`, `setOpen`, `setView`, `setTab`, `setSplit`, `setZoom`, `openCmdk`, `closeCmdk`, `setCmdkQuery`, `setCmdkSel`, `setTheme`

## Decisions Honored

- **D-03**: All computed atoms (`$filteredFiles`, `$selectedFile`, `$totals`) live in the store module, not in components. Components call `useStore($totals)` — zero computation inline.
- **D-04**: Full STORE-03 shape committed in Phase 2. Only `setRowMenu` has a real implementation. All 10 Phase 3 actions are `/* @TODO Phase 3 */` no-op stubs so Plan 02 components can import them without crashing.
- **PITFALL-02 guard**: `$totals` reads `s.entries` (full list), not `$filteredFiles`. Filter state does not affect totals bar display.
- **Circular ESM guard**: `ui.ts` imports only `nanostores`. Verified: `grep -cE "from ['\"]\\./(files|runtime|settings)['\"]" src/stores/ui.ts` returns `0`.

## Verification

- `npm run build` exits 0 (Vite + tsc-b pass cleanly)
- 8 named exports from files.ts confirmed
- 11 functions exported from ui.ts (1 wired + 10 stubs)
- Barrel re-exports 2 wildcard lines; no named re-exports
- Pre-existing tsc errors are all in `@types/node` / tsconfig options (TypeScript version mismatch) — unrelated to this plan's files

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None that block plan goal. The Phase 3 action stubs (`setOpen`, `setView`, `setTab`, `setSplit`, `setZoom`, `openCmdk`, `closeCmdk`, `setCmdkQuery`, `setCmdkSel`, `setTheme`) are intentional no-ops per D-04 — they will be wired in Phase 3.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All surface is 100% client-side in-memory state.

## Self-Check: PASSED

- src/stores/files.ts: FOUND
- src/stores/ui.ts: FOUND
- src/stores/index.ts: FOUND
- Commit 8ec53d0: FOUND
- Commit 1248c4a: FOUND
- Commit c8b9bdd: FOUND
