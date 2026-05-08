---
phase: 05-raster-encoders
plan: "03"
subsystem: state
tags: [stores, types, per-file-overrides, density-model]
dependency_graph:
  requires: [05-01]
  provides: [perFile-slice, TargetDensity-type, setTargetDensities-action]
  affects: [05-04, 05-05]
tech_stack:
  added: []
  patterns: [zustand-per-file-keyed-record, cross-store-cleanup-on-remove]
key_files:
  created: []
  modified:
    - src/stores/settings.ts
    - src/stores/files.ts
    - src/types/index.ts
    - src/App.tsx
    - src/components/panels/FilesPane.tsx
decisions:
  - "perFile slice keyed by FileEntry.id in useSettingsStore — codec panel components write setPerFileCodec(fileId, patch), NOT global setSvg/setPng etc. (D-02)"
  - "clearPerFile(fileId) called in removeFile to prevent unbounded Record growth (T-5-03-02/T-5-03-03)"
  - "TargetDensity deliberately identical to SourceDensity union but semantically distinct — export-scope selector, not file identity"
  - "addSourceWithVariants and removeFamily marked @deprecated D-11 but NOT removed — Playwright raster.spec.ts calls addSourceWithVariants directly"
metrics:
  duration: 12min
  completed: "2026-05-08"
  tasks: 2
  files: 5
---

# Phase 05 Plan 03: Store Extensions for Per-File Overrides and Density Model Summary

**One-liner:** perFile codec override slice in useSettingsStore + TargetDensity type + setTargetDensities action, with T-5-03-02 clearPerFile wired into removeFile.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add perFile codec override slice to useSettingsStore | 248e7a2 | src/stores/settings.ts, src/App.tsx, src/components/panels/FilesPane.tsx |
| 2 | Extend types/index.ts and files.ts for Phase 5 density model | fc47f7a | src/types/index.ts, src/stores/files.ts |

## Interface Additions

### SettingsState (src/stores/settings.ts)

```typescript
perFile: Record<string, Partial<CodecSettingsPng | CodecSettingsJpeg | CodecSettingsWebp | CodecSettingsAvif>>
setPerFileCodec: (fileId: string, patch: Partial<...>) => void
clearPerFile: (fileId: string) => void
```

### FilesState (src/stores/files.ts)

```typescript
setTargetDensities: (fileId: string, targetDensities: TargetDensity[]) => void
```

## removeFile clearPerFile Wiring

`removeFile` in files.ts was updated to call `useSettingsStore.getState().clearPerFile(fileId)` after the existing `clearSnippetToggles` pattern. This satisfies T-5-03-02 (perFile slice not retained in memory after file removal) and T-5-03-03 (unbounded Record growth prevention).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing TypeScript build errors prevented npm run build from exiting 0**

- **Found during:** Task 1 verification
- **Issue:** Three pre-existing errors blocked the build — `useKeyboardShortcuts` call in App.tsx missing `setRowMenu` param (added to hook in Phase 10), `PLACEHOLDER_FILE` const in FilesPane.tsx declared but never used, unused CSS module import `FilePanel.module.css` (file doesn't exist on disk)
- **Fix:** Added `const [_rowMenu, setRowMenu]` in App.tsx + passed to hook; removed unused `PLACEHOLDER_FILE` const and `void _s` suppressor; removed the non-existent CSS import
- **Files modified:** src/App.tsx, src/components/panels/FilesPane.tsx
- **Commit:** 248e7a2 (bundled with Task 1)

## Self-Check: PASSED

- [x] src/stores/settings.ts exists and contains perFile slice
- [x] src/stores/files.ts exists and contains setTargetDensities + @deprecated markers
- [x] src/types/index.ts exists and exports TargetDensity + targetDensities field
- [x] Commits 248e7a2 and fc47f7a exist in git log
- [x] npm run build exits 0
