---
phase: 05-center-pane
plan: 01
subsystem: center-pane
tags: [react, nanostores, css-custom-properties, drag-handle, breadcrumb, zoom-popover]
dependency_graph:
  requires: []
  provides: [CenterPane, CenterHeader, CompareStage]
  affects: [AppShell]
tech_stack:
  added: []
  patterns: [useStore-nanostore, useRef-drag, css-custom-property-split]
key_files:
  created:
    - src/components/panels/center/CenterHeader.tsx
    - src/components/panels/center/CompareStage.tsx
  modified:
    - src/components/panels/CenterPane.tsx
decisions:
  - "Drag state managed via useRef (not useState) per STORE-08 — no re-render on every mousemove"
  - "setZoom cast to (z: number | string) => void to allow 'fit' string value despite typed-as-number store"
  - "DeltaStrip left as placeholder div — wired in Plan 05-02"
metrics:
  duration: ~10min
  completed: 2026-05-21
---

# Phase 05 Plan 01: CenterPane Shell, CenterHeader, CompareStage Summary

**One-liner:** Three-section CenterPane with breadcrumb+zoom popover wired to uiAtom and draggable CSS --split compare stage.

## What Was Built

**Task 1 — CenterHeader** (`src/components/panels/center/CenterHeader.tsx`)
- Breadcrumb: Queue / filename / TYPE->TARGET tag / dim tag / q tag (conditionally rendered when `q !== null`)
- FILE_TAG constant at module level with exact class string including `px-1.5 py-0.5 rounded-[3px]`
- Zoom popover: Eye + label + CaretDown trigger; ZOOM_OPTS = [25, 50, 100, 200, 'fit']; Check on active option; calls setZoom then closes
- Optimized pill shown when selectedFile is non-null
- Single `useState` for popover open (ephemeral, permitted by STORE-08)

**Task 2 — CompareStage** (`src/components/panels/center/CompareStage.tsx`)
- image-frame div carries `style={{ '--split': split + '%' } as React.CSSProperties}`
- layer-orig: `clipPath: 'inset(0 calc(100% - var(--split)) 0 0)'`
- layer-opt: `clipPath: 'inset(0 0 0 var(--split))'`
- Split handle drag: mousedown captures frame rect, adds window mousemove+mouseup listeners, onUp removes both (no leak)
- Drag flag via `useRef<boolean>` — zero useState
- Split labels show fmtBytes for orig/opt sizes

**Task 3 — CenterPane** (`src/components/panels/CenterPane.tsx`)
- Root: `data-testid="center-pane"` + `flex flex-col h-full min-h-0 bg-[var(--color-bg-0)] overflow-hidden`
- Children: CenterHeader, CompareStage, DeltaStrip placeholder (h-[72px] shrink-0)

## Verification Results

- `npx tsc --noEmit` → **0 error TS** lines
- `grep innerHTML src/components/panels/center/` → CLEAN
- `grep useState CompareStage.tsx` → CLEAN (zero results)
- `grep -c useState CenterHeader.tsx` → 2 (import + one call — correct)
- `data-testid="center-pane"` present in CenterPane.tsx
- FILE_TAG constant contains `px-1.5 py-0.5 rounded-[3px]`

## Deviations from Plan

None — plan executed exactly as written.

## Commit

`ea0e3b7` — feat(05-01): CenterPane shell, CenterHeader breadcrumb+zoom, CompareStage split handle

## Self-Check: PASSED

All three files exist and compile cleanly. Commit ea0e3b7 verified in git log.
