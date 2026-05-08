---
phase: 05-raster-encoders
plan: "04"
subsystem: ui-codec-panels
tags: [inspector, codec-panels, per-file-overrides, debounce, d-04]
dependency_graph:
  requires: [05-02, 05-03, 05-05]
  provides: [codec-panel-ui, inspector-tab-split, per-file-override-ui]
  affects: [src/components/panels/InspectorPane.tsx, src/App.tsx]
tech_stack:
  added: []
  patterns:
    - "CodecTabContent inline function — format discriminant inside InspectorPane"
    - "setPerFileCodec(fileId, patch) as sole write path from codec panels"
    - "200ms debounce wrapper (debouncedPreview) for enqueueRasterPreview on slider change"
key_files:
  created:
    - src/components/panels/PngPanel.tsx
    - src/components/panels/JpegPanel.tsx
    - src/components/panels/WebpPanel.tsx
    - src/components/panels/AvifPanel.tsx
  modified:
    - src/components/panels/InspectorPane.tsx
    - src/stores/files.ts
    - src/App.tsx
decisions:
  - "setPreserveIcc added to files.ts (mirrors setSourceDensity pattern) — needed for PngPanel ICC toggle wiring"
  - "TargetDensityCheckboxes (D-12) NOT added inline to CodecTabContent — already rendered inside TweaksResizeSection; no duplication needed"
  - "App.tsx MockFile view-model removed (EMPTY_FILE, fmtToType, file var) — InspectorPane now reads selectedEntry from store directly"
  - "Slider ui component used (src/components/ui/Slider.tsx) instead of @radix-ui/react-slider directly — project already has a Slider wrapper with ARIA"
metrics:
  duration: "~20min"
  completed: "2026-05-08"
  tasks_completed: 2
  files_changed: 7
---

# Phase 5 Plan 04: Codec Panel Components + InspectorPane Restructure Summary

Format-aware codec panels for PNG/JPEG/WebP/AVIF created; InspectorPane restructured to Codec|Snippets tab split with per-file override writes (D-02) and 200ms debounced enqueueRasterPreview on every codec setting change (D-04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PngPanel, JpegPanel, WebpPanel, AvifPanel | 9e14ad7 | 4 new panel files |
| 2 | Restructure InspectorPane + wire D-04 debounce | 5714422 | InspectorPane.tsx, files.ts, App.tsx |

## What Was Built

**Four codec panel components** following the SvgoPanel analog:
- `PngPanel`: OxiPNG level (0–6) slider + ICC preserve toggle. Props: `settings: CodecSettingsPng`, `preserveIcc: boolean`, `onChange`, `onPreserveIccChange`.
- `JpegPanel`: quality (0–100) + progressive toggle. Props: `settings: CodecSettingsJpeg`, `onChange`.
- `WebpPanel`: quality + method (0–6) + lossless toggle. Quality badge shows "lossless" when mode is active.
- `AvifPanel`: quality + lossless toggle + Safari 16.4+ note. Quality badge shows "lossless" when mode is active.

All panels use `src/components/ui/Slider.tsx` (hand-rolled wrapper with full ARIA: `aria-valuemin/max/now/text`, `aria-label`) and `src/components/ui/Toggle.tsx` (`role="switch"`, `aria-checked`, keyboard handler).

**InspectorPane restructured** (`type Tab = 'codec' | 'snippets'`):
- `CodecTabContent` inline function: format discriminant switch → correct panel (or "Select a file" prompt).
- All panel `onChange` calls `setPerFileCodec(selectedId, patch)` then `debouncedPreview(selectedId)`.
- SVG: SvgoPanel wiring preserved unchanged from Phase 3.
- Snippets tab: `SnippetPanel` with `file={selectedEntry ?? null}`.
- `useEffect` auto-switches to Codec tab on selectedId change (D-01).

**files.ts addition:** `setPreserveIcc(fileId, preserveIcc)` action added — mirrors `setSourceDensity` pattern. Required for PngPanel's `onPreserveIccChange` callback.

**App.tsx cleanup:** `EMPTY_FILE`, `fmtToType`, `file: MockFile` view-model removed. `InspectorPane` now takes only `open/setOpen/onToast` — reads `selectedEntry` from store internally.

## Deviations from Plan

### Auto-added Missing Functionality

**1. [Rule 2 - Missing] setPreserveIcc added to files.ts**
- **Found during:** Task 2 implementation
- **Issue:** Plan's PngPanel `onPreserveIccChange` callback required `setPreserveIcc(fileId, v)` but files.ts had no such action
- **Fix:** Added `setPreserveIcc` action to FilesState interface and store implementation
- **Files modified:** src/stores/files.ts
- **Commit:** 5714422

**2. [Rule 2 - Scope] TargetDensityCheckboxes NOT added inline to CodecTabContent**
- Plan item 11 mentioned adding TargetDensityCheckboxes in Codec tab below codec controls
- Investigation: `TweaksResizeSection` (already in Codec tab content) already renders `TargetDensityCheckboxes` internally (TweaksPanel.tsx line 84)
- Decision: No duplication — Phase 7 export handling will read from there

**3. [Rule 1 - Cleanup] App.tsx MockFile view-model removed**
- `file: MockFile` prop no longer needed after InspectorPane reads from store
- Removed `EMPTY_FILE`, `fmtToType`, `selectedEntry` from App.tsx to prevent dead code

## Verification

```
grep -c "type Tab = 'codec' | 'snippets'" src/components/panels/InspectorPane.tsx → 1 ✓
grep -c "setPerFileCodec" src/components/panels/InspectorPane.tsx → 5 ✓
grep -c "enqueueRasterPreview" src/components/panels/InspectorPane.tsx → 2 ✓
grep -c "setJpeg\|setWebp\|setAvif\|setPng" src/components/panels/InspectorPane.tsx → 0 ✓
npm run build → ✓ built in 2.08s
```

## Known Stubs

None. All panels receive real resolved settings and write through to perFile store slice. enqueueRasterPreview is wired with 200ms debounce.

## Self-Check: PASSED

- src/components/panels/PngPanel.tsx: FOUND
- src/components/panels/JpegPanel.tsx: FOUND
- src/components/panels/WebpPanel.tsx: FOUND
- src/components/panels/AvifPanel.tsx: FOUND
- commit 9e14ad7 (Task 1): FOUND
- commit 5714422 (Task 2): FOUND
