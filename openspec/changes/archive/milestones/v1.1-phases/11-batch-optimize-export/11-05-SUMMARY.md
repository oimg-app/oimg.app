---
phase: 11-batch-optimize-export
plan: 05
subsystem: export
tags: [phase-11, wave-2, jszip, zip-export, toolbar, EXP-02]
requires: [11-00, 11-03, 11-04]
provides:
  - buildZip(entries) async ZIP builder (src/lib/build-zip.ts)
  - useExport().exportZip + useExport().exportIndividually (src/hooks/useExport.ts)
  - Toolbar Export button + "All as ZIP" + "Save individually" wired to useExport hook
  - App-wide Toaster mount (src/App.tsx) — required by D-12 toast contract
affects: [src/stores/files.ts]
tech-stack:
  added: []
  patterns:
    - "ZIP layout: flat (D-09), one entry per done file (D-08)"
    - "Filename pipeline: sanitizeBaseName(renameExtension(name, target)) → collisionSuffix(used) → zip.file"
    - "generateAsync: streamFiles:true + DEFLATE level:1 (codec outputs are already compressed)"
    - "Bulk save: forceFallback + 80ms inter-call sleep (D-06, Pitfall 5)"
key-files:
  created:
    - src/lib/build-zip.ts
    - src/tests/export-zip.spec.ts
  modified:
    - src/hooks/useExport.ts
    - src/components/shell/Toolbar.tsx
    - src/stores/files.ts
    - src/App.tsx
decisions:
  - "buildZip is a pure async transform (no toasts inside); the caller (useExport.exportZip) owns user-facing notifications. Keeps the lib node-testable and the hook the single toast surface."
  - "exportIndividually composes the same name pipeline as buildZip but operates on real Blobs per call so the user sees a stream of saves rather than a single ZIP. The 80ms inter-call delay is the smallest reliable interval across Chromium + WebKit."
  - "Rule-2 deviation: mounted sonner Toaster in App.tsx. D-12's 'X files exported, Y skipped' contract cannot pass without it; was a pre-existing gap from Phase 11 Plan 04 (toast.success / toast.error are already called)."
  - "E2E parses local-file-header records directly rather than adding an unzip dep — Test 4 'entry count == done count' only needs filenames + count, not decompressed content. The streamFiles fallback walk (deferred sizes → next-signature scan) handles either branch jszip emits."
metrics:
  duration: "~12.7 min"
  completed: "2026-06-02T01:38:36Z"
  tasks: 4
  files_modified: 6
  commits: 4
---

# Phase 11 Plan 05: Wave 2 — JSZip wrapper + Toolbar All-as-ZIP + exportIndividually bulk save — Summary

EXP-02 batch ZIP export ships end-to-end: pure `buildZip` builder, `useExport.exportZip` + `exportIndividually` orchestration, Toolbar wiring (with the empty `exportAsZip`/`exportIndividually` store stubs retired), an app-wide Toaster mount (Rule-2 auto-add), and a six-test e2e covering D-05 / D-08 / D-09 / D-10 / D-12 + the T-11-01 zip-slip composition.

## What Shipped

### Task 1 — `src/lib/build-zip.ts` (new)
- `buildZip(entries: FileEntry[]): Promise<Blob>`
- Filters `status === 'done' && encodedBuffer != null` (D-08 + D-12)
- Per-entry name pipeline: `sanitizeBaseName(renameExtension(e.name, e.target))` → `collisionSuffix(candidate, used)` → `used.add(final)` → `zip.file(final, e.encodedBuffer!)` (T-11-01 + D-05 + D-10 + D-09)
- `zip.generateAsync({ type: 'blob', streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 1 } })` (Pitfall 6 + CPU-saving on already-compressed inputs)
- Throws `Error('NO_EXPORTABLE_FILES')` on empty filtered input (defense-in-depth vs Plan 07's D-13 button-disable)
- Commit: `23abd73`

### Task 2 — `src/hooks/useExport.ts` (extend)
- `exportZip()`: reads `filesAtom.get().entries`, calls `buildZip(entries)`, catches `NO_EXPORTABLE_FILES` → `toast.error('Nothing to export — optimize files first')`. On success: `saveBlob(blob, timestampedZipName(), { ext: 'zip', mime: 'application/zip' })`, then `toast.success('${N} files exported[, ${M} skipped — fix and re-export]')` per D-12.
- `exportIndividually()`: loops `done` entries, per-iter `Blob` + sanitize-then-rename-then-collision-suffix → `saveBlob(blob, name, { forceFallback: true, ext, mime })` (D-06) → `await new Promise(r => setTimeout(r, 80))` (Pitfall 5). Final toast same shape as exportZip.
- Hook now returns `{ exportOne, exportZip, exportIndividually }`.
- Commit: `6d3f223`

### Task 3 — Toolbar + store stub retirement
- `src/components/shell/Toolbar.tsx`: `useExport()` hook imported; primary "Export" button + "All as ZIP" + "Save individually" menu items wired to `void exportZip()` / `void exportIndividually()`.
- `src/stores/files.ts`: empty `exportAsZip` and `exportIndividually` stubs deleted. Phase 12 stubs (`exportCopyHtml`, `exportCopyDataUris`, `exportManifestJson`) preserved.
- No other code references the deleted stubs (verified via `grep -r`).
- Commit: `b6fdc90`

### Task 4 — `src/tests/export-zip.spec.ts` (new) + Rule-2 Toaster mount
- Six tests under `test.describe('EXP-02 — Batch ZIP', ...)`:
  - Test 1: 5 done entries → ZIP with PK\x03\x04 signature + 5 swapped-ext names (D-05)
  - Test 2: saved filename matches `/^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/` (D-10)
  - Test 3: 3 `dup.png` → `dup.webp` + `dup (1).webp` + `dup (2).webp` (D-10 collision)
  - Test 4: ZIP entry count === done count (D-08)
  - Test 5: no entry name contains `/` or `\\` (D-09 flat layout)
  - Test 6: 4 done + 1 error → toast surfaces "4 files exported, 1 skipped" (D-12)
- Local-file-header scanner extracts entry names without an unzip dep; handles both inline-size and deferred-size jszip branches.
- All 6 tests green on chromium (~2.6 min total).
- Commit: `1fdf2cb`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Sonner Toaster never mounted app-wide**

- **Found during:** Task 4 (Test 6 — D-12 toast assertion failed because no `[data-sonner-toast]` element ever rendered)
- **Issue:** Plan 04 introduced `toast.success` / `toast.error` calls inside save paths, but the `<Toaster />` component (defined in `src/components/ui/sonner.tsx`) was never rendered in `App.tsx`. Sonner's emitter queues toasts until a Toaster mounts; with no Toaster, every `toast.*` call was a silent no-op.
- **Fix:** Added `<Toaster position="bottom-right" />` to `App.tsx` next to `<AppShell />`. The component already exists with the project's theme + icon configuration; this was a pure wiring miss.
- **Files modified:** `src/App.tsx`
- **Verification:** Test 6 now passes; `export-single.spec.ts` (3 tests) re-run green — no regression on the user-cancel / picker-success / fallback paths.
- **Commit:** `1fdf2cb` (bundled with Task 4 — the deviation was discovered while verifying Task 4)

## Threat Surface

No new threat flags. Plan 05 enforces the registered mitigations (T-11-01 sanitizeBaseName composition, T-11-EMP empty-ZIP guard, T-11-MEM streamFiles, T-11-BUL 80ms inter-call sleep, T-11-EXC bounded try/catch).

## Verification Results

- `tsc -b` → exits 0
- `grep -c "streamFiles: true" src/lib/build-zip.ts` → 2 (≥1 required)
- `grep -c "sanitizeBaseName" src/lib/build-zip.ts` → 3 (≥1 required)
- `npx playwright test src/tests/export-zip.spec.ts --reporter=line` → 6 passed
- `npx playwright test src/tests/export-single.spec.ts --reporter=line` → 3 passed (regression sanity check after Toaster mount)
- No dangling references to the deleted `exportAsZip` / `exportIndividually` store stubs

## Carry-forward for Plans 06/07

- **Plan 06** (Save individually deep coverage): exportIndividually already ships D-06 + Pitfall 5 mitigations. Plan 06 can extend e2e with multi-file saveAs spy assertions (the `__saveAsCalls` array on window — see save-file-mocks.ts).
- **Plan 07** (D-13 button disable): the Toolbar Export button + menu items are currently always-enabled. Plan 07 should bind a `$hasDone` computed atom to `disabled={!hasDone}` on both buttons. `buildZip`'s `NO_EXPORTABLE_FILES` throw remains as defense-in-depth.
- **Plan 12+** (snippet exports): three stubs preserved in `src/stores/files.ts` (`exportCopyHtml`, `exportCopyDataUris`, `exportManifestJson`). Same wiring pattern applies — call `useExport().…` once those land.

## Files

**Created:**
- `src/lib/build-zip.ts`
- `src/tests/export-zip.spec.ts`

**Modified:**
- `src/hooks/useExport.ts`
- `src/components/shell/Toolbar.tsx`
- `src/stores/files.ts`
- `src/App.tsx`

## Commits

| # | Hash      | Message |
|---|-----------|---------|
| 1 | `23abd73` | `feat(11-05): add buildZip async ZIP builder` |
| 2 | `6d3f223` | `feat(11-05): extend useExport with exportZip + exportIndividually` |
| 3 | `b6fdc90` | `feat(11-05): wire Toolbar to useExport + retire empty store stubs` |
| 4 | `1fdf2cb` | `test(11-05): EXP-02 e2e — full ZIP roundtrip + D-05/D-08/D-09/D-10/D-12` (incl. Rule-2 Toaster mount) |

## Self-Check: PASSED

- `src/lib/build-zip.ts` exists
- `src/tests/export-zip.spec.ts` exists
- All 4 task commits present in `git log --oneline -5`
- Rule-2 Toaster mount included in Task 4 commit
