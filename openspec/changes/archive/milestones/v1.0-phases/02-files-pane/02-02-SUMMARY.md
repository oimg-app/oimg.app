---
phase: 02-files-pane
plan: 02
subsystem: components
tags:
  - phase-02
  - files-pane
  - vertical-slice
  - shadcn
  - context-menu
dependency_graph:
  requires:
    - src/stores/files.ts
    - src/stores/ui.ts
    - src/stores/index.ts
    - src/lib/format.ts
    - src/lib/stub-data.ts (types only)
    - src/components/ui/context-menu.tsx
    - src/components/ui/popover.tsx
  provides:
    - src/components/file-row/FileRow.tsx
    - src/components/panels/FilesPane.tsx (full body)
  affects:
    - AppShell (FilesPane slot — unchanged signature)
    - Phase 5 CenterPane (consumes $selectedFile set by FileRow selectFile action)
    - Phase 3 TitleBar/Toolbar (inherits working queue state)
tech_stack:
  added:
    - '@phosphor-icons/react (DotsThreeVertical, ArrowCounterClockwise, DownloadSimple, Copy, Code, Eye, Stack, Trash, Funnel, Plus)'
  patterns:
    - Nanostores useStore subscription pattern (zero useState for data)
    - Programmatic contextmenu dispatch via MouseEvent (D-01 single mechanism)
    - Separate FileRow component (D-02)
    - PITFALL-01 guard — ref attached to ContextMenuTrigger directly
    - PITFALL-05 guard — BADGE_CLASS keys on 'jpg' not 'jpeg'
key_files:
  created:
    - src/components/file-row/FileRow.tsx
  modified:
    - src/components/panels/FilesPane.tsx
decisions:
  - D-01 honored: right-click and ctxbtn both dispatch contextmenu to same Radix ContextMenu root
  - D-02 honored: FileRow is a standalone component, not inline JSX in FilesPane
  - PITFALL-01 honored: useRef attached to ContextMenuTrigger directly (no asChild+forwardRef)
  - PITFALL-05 honored: BADGE_CLASS keys on 'jpg' not 'jpeg'
  - T-02-07 mitigated: all user-visible strings via JSX interpolation, zero innerHTML usage
metrics:
  duration: 15min
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 02: FileRow + FilesPane Vertical Slice Summary

FileRow component with shadcn ContextMenu (right-click + ctxbtn) and full FilesPane body (header, dropzone, mapped rows, totals bar) wired to nanostores — the complete Files Pane vertical slice rendering from stub data.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create FileRow component with shadcn ContextMenu trigger and ctxbtn dispatch | 1b41c3d | src/components/file-row/FileRow.tsx |
| 2 | Replace FilesPane skeleton with full body — header, dropzone, mapped rows, totals bar | f31085d | src/components/panels/FilesPane.tsx |

## Task 3 — Awaiting Human Verification

Task 3 is a `checkpoint:human-verify` gate. The developer must run `npm run dev` and confirm all 6 Phase 2 ROADMAP success criteria pass before this plan is marked complete.

## Acceptance Evidence

### FILES-01 (Pane Header with file count)
- `grep -c "Queue · " src/components/panels/FilesPane.tsx` → 1
- Header renders `Queue · {files.length} files` driven by `$filteredFiles.length`

### FILES-02 (Always-visible Dropzone)
- `grep -c "Drop images to optimize" src/components/panels/FilesPane.tsx` → 1
- `grep -c "SVG · PNG · JPEG · WEBP · AVIF · JXL" src/components/panels/FilesPane.tsx` → 1
- Dropzone is above the file list; always in DOM (no conditional rendering)

### FILES-03 (FileRow renders each file)
- `src/components/file-row/FileRow.tsx` exists with 165 lines
- Renders format badge (BADGE_CLASS per type), file name, byte sizes, savings %, status dot
- `<ul aria-label="File queue">` maps each entry to `<FileRow file={f} />`

### FILES-04 (ContextMenu via right-click AND ctxbtn)
- `grep -c 'new MouseEvent' src/components/file-row/FileRow.tsx` → 1 (contextmenu event)
- `grep -c "from '@/components/ui/context-menu'" src/components/file-row/FileRow.tsx` → 1
- `variant="destructive"` on Remove from queue item → 1

### FILES-05 (Totals Bar)
- `grep -cE '(BEFORE|AFTER|SAVED|SAVED %)' src/components/panels/FilesPane.tsx` → 4
- Values derived from `$totals` computed atom (orig, opt, saved, pct)
- Remove action on FileRow triggers `removeFile(id)` → `$totals` recomputes reactively

### STORE-08 Audit
- `grep -c 'STUB_FILES' src/components/file-row/FileRow.tsx` → 0
- `grep -c 'STUB_FILES' src/components/panels/FilesPane.tsx` → 0

### No useState for Data
- `grep -cE '^import.*useState' src/components/file-row/FileRow.tsx` → 0
- `grep -cE '^import.*useState' src/components/panels/FilesPane.tsx` → 0

### T-02-07 Threat Mitigation
- `grep -ci 'innerHTML' src/components/file-row/FileRow.tsx` → 0
- `grep -ci 'innerHTML' src/components/panels/FilesPane.tsx` → 0

## Decisions Honored

- **D-01 (Single ContextMenu mechanism):** Both right-click and ctxbtn flow through the same Radix `ContextMenu`. The ctxbtn `handleCtxBtn` handler calls `rowRef.current?.dispatchEvent(new MouseEvent('contextmenu', ...))` targeting the same `ContextMenuTrigger` element.
- **D-02 (Separate FileRow component):** FileRow is a dedicated module at `src/components/file-row/FileRow.tsx`; FilesPane maps entries to `<FileRow>` instances with no inline row JSX.
- **PITFALL-01 guard:** `useRef<HTMLElement>` attached to `ContextMenuTrigger ref={rowRef}` directly — no `asChild` + plain `div` + `forwardRef` wrapper.
- **PITFALL-02 guard (inherited from Plan 01):** `$totals` reads `s.entries` (full list); filter does not affect totals.
- **PITFALL-05 guard:** `BADGE_CLASS` object keys on `jpg`, not `jpeg` — matches `FileEntry.type` in STUB_FILES.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following context menu items have `onSelect={() => { /* @TODO Phase 3 */ }}` no-op handlers — intentional per the plan spec:
- Re-optimize
- Save as…
- Copy data URI
- Copy `<picture>`
- Reveal in compare
- Apply same settings to all

"Remove from queue" is fully wired to `removeFile(file.id)`.

The Add files button (`Plus` icon) in the pane header is a no-op stub per plan spec — wired in Phase 3.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. All data is 100% client-side in-memory stub data. T-02-07 mitigation confirmed (zero innerHTML).

## Self-Check: PASSED

- src/components/file-row/FileRow.tsx: FOUND (165 lines)
- src/components/panels/FilesPane.tsx: FOUND (90 lines)
- Commit 1b41c3d: FOUND (FileRow)
- Commit f31085d: FOUND (FilesPane)
- `npm run build` exits 0 (verified above)
