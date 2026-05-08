---
phase: 05-raster-encoders
plan: "05"
subsystem: ui-pipeline
tags: [center-pane, batch-orchestrate, raster-routing, per-file-override, preview]
dependency_graph:
  requires: [05-02, 05-03]
  provides: [CenterPane-real-data, raster-routing-all-formats, enqueueRasterPreview]
  affects: [src/components/panels/CenterPane.tsx, src/hooks/useBatchOrchestrate.ts, src/App.tsx]
tech_stack:
  added: []
  patterns:
    - Format-aware PoolJob routing (isSvg / isRealRasterFile / stub)
    - Per-file codec override merge via useSettingsStore.perFile[fileId]
    - cancelByPrefix('preview-') + crypto.randomUUID() for debounced re-optimize
key_files:
  created: []
  modified:
    - src/components/panels/CenterPane.tsx
    - src/hooks/useBatchOrchestrate.ts
    - src/App.tsx
decisions:
  - "PNG routing discriminant: byteEstimate gate (Case A) — useFilePicker.ts calls addSourceWithVariants which seeds byteEstimate; direct format match would route synthetic test blobs through real png-adapter, breaking Phase 2/4 tests"
  - "enqueueRasterPreview placed in useBatchOrchestrate.ts (not runtime.ts) to avoid circular dependency"
  - "Unified raster .then() handler replaces separate hasPngFanoutShape branch — isRealRasterFile covers png+jpeg+webp+avif"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-08"
  tasks_completed: 2
  files_modified: 3
---

# Phase 05 Plan 05: CenterPane + useBatchOrchestrate Raster Wiring Summary

**One-liner:** CenterPane reads real FileEntry blob sizes; useBatchOrchestrate routes JPEG/WebP/AVIF/PNG to jSquash adapters with per-file override merge and exports enqueueRasterPreview.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Upgrade CenterPane to use real FileEntry data | c1da059 | CenterPane.tsx, App.tsx |
| 2 | Extend useBatchOrchestrate to route all raster formats | a31366d | useBatchOrchestrate.ts |

## What Was Built

### Task 1: CenterPane Real Data Wiring

- Removed `file: MockFile` prop from `CenterPane` interface; component now reads `selectedEntry` from `useFilesStore` directly
- Removed `useSettingsStore` codec slice reads (codecLabel, codecQ, codecMethod) — no longer needed in CenterPane
- Breadcrumb shows `selectedEntry.name` and `selectedEntry.format`
- Delta strip wired to `selectedEntry.sourceBlob.size` (original) and `selectedEntry.optimizedBlob?.size` (optimized)
- Removed SSIM, Butteraugli, Decode mock rows per D-08
- Status pill: shows "Optimized" (accent) when `status === 'done' && optimizedBlob != null`; shows neutral pill with status text otherwise; shows nothing when no file selected
- Blob URL useEffect (lines 19-28) unchanged per RESEARCH Pitfall 5 / D-07
- App.tsx call site updated: `<CenterPane open={open} setOpen={setOpen} />` (file prop removed)

### Task 2: useBatchOrchestrate Raster Routing

**useFilePicker.ts inspection (critical finding):** `useFilePicker.ts` calls `addSourceWithVariants()` (not `addFile()`). `addSourceWithVariants` seeds `byteEstimate` on every FileEntry variant. Therefore **Case A applies**: the existing `hasPngFanoutShape` byteEstimate gate is the correct discriminant for PNG. Direct format match is NOT used because it would route synthetic test blobs (format='png', no byteEstimate) through the real png-adapter, causing Phase 2/4 test failures.

**New routing logic:**
```
isSvg → 'svg'
f.format === 'jpeg' || 'webp' || 'avif' || hasPngFanoutShape → f.format (real adapter)
else → 'stub'
```

**Settings merge:** Per-format branches call `buildJpegSettings / buildWebpSettings / buildAvifSettings` with `globalForFormat + perFile[fileId]` override merge (D-02 compliance).

**Unified .then() handler:** `isRealRasterFile` covers png+jpeg+webp+avif — wraps `result.output` as Blob with correct MIME type and calls `markDone`.

**`enqueueRasterPreview(fileId)`:** Exported standalone async function (outside the hook). Calls `pool.cancelByPrefix('preview-')` first (T-5-05-01 DoS mitigation), builds per-format settings, enqueues with `preview-${crypto.randomUUID()}` job ID (skips batch bookkeeping via `isAuxiliaryJob` — unchanged), calls `markDone` on result. InspectorPane (Plan 04) calls this with 200ms debounce on settings change.

## Deviations from Plan

None — plan executed exactly as written.

The one decision point (Case A vs Case B for PNG discriminant) was resolved by reading useFilePicker.ts as instructed: `addSourceWithVariants` is called and it sets `byteEstimate`. Case A (byteEstimate gate) is correct.

## Key Decisions Made

1. **PNG routing discriminant = byteEstimate (Case A):** useFilePicker.ts confirmed using `addSourceWithVariants` which seeds `byteEstimate`. The existing `hasPngFanoutShape` guard is preserved. Direct format match (`f.format === 'png'`) would break Phase 2/4 test fixtures that use `format='png'` synthetic blobs without byteEstimate.

2. **enqueueRasterPreview in useBatchOrchestrate.ts (not runtime.ts):** Placed as standalone exported function to avoid circular dependency (runtime.ts already imports from pool.ts; adding pool.enqueue calls there would create a cycle through useBatchOrchestrate).

3. **Unified raster .then() handler:** The `hasPngFanoutShape` branch is merged into `isRealRasterFile` which covers all four formats. MIME type lookup table replaces per-format if/else for the Blob constructor.

## Known Stubs

None — all three delta strip rows are wired to real FileEntry data. No placeholder text or mock values remain in modified files.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes introduced. The `enqueueRasterPreview` → pool flow is within the existing worker/pool trust boundary (T-5-05-01 through T-5-05-04 in plan threat model, all mitigated as documented).

## Self-Check: PASSED

- `src/components/panels/CenterPane.tsx` — exists, no MockFile, no SSIM/Butteraugli/Decode
- `src/hooks/useBatchOrchestrate.ts` — exists, has buildJpegSettings/buildWebpSettings/buildAvifSettings imports, has enqueueRasterPreview export
- `npm run build` — exits 0 (verified)
- Commits c1da059, a31366d — exist in git log
