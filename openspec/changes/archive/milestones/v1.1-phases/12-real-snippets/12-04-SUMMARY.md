---
phase: 12
plan: 04
subsystem: hooks/useSnippets + Toolbar
tags: [phase-12, wave-2, useSnippets, toolbar-bulk, D-08, D-09, D-10, D-11, D-13]
requires:
  - Plan 01 (copyToClipboard chokepoint)
  - Plan 02 (buildDataUri / buildPictureSnippet / escapeAttr)
  - Phase 11 ($hasDone computed atom + Toolbar D-13 disable-then-explain pattern)
  - Phase 11 src/lib/filename.ts — renameExtension (manifest filename column)
provides:
  - src/hooks/useSnippets.ts — bulk + per-file orchestrators
  - Toolbar.tsx — three bulk items wired with D-13 disable-then-explain
  - src/stores/files.ts — three empty stubs removed (Phase 11 retirement precedent)
---

# Phase 12, Plan 04 — useSnippets + Toolbar bulk wiring

**Status:** Complete
**Date:** 2026-06-03
**Commits:**
- `f61f3c0` feat(12-04): useSnippets — bulk + per-file snippet/manifest/data-URI orchestrator
- `31ba287` feat(12-04): wire Toolbar bulk snippet menu through useSnippets + delete dead stubs
- `262e9b2` test(12-04): e2e — Toolbar bulk D-08/D-09/D-10/D-11 + D-15 chokepoint capture

## What Shipped

### `src/hooks/useSnippets.ts` (new hook)
Mirrors the `useExport` shape (PATTERNS analog). Exposes:

| Method | Purpose | Locked decision |
|--------|---------|-----------------|
| `copyPictureBulk()` | Concatenates `buildPictureSnippet(file)` for each `status === 'done'` entry; single blank-line separator; routes through `copyToClipboard(joined, 'snippet', 'Copy <picture> for N files')` | D-09 |
| `copyDataUrisBulk()` | Concatenates `buildDataUri(file)` one-per-line; ready-for-`<img src>` paste; SVG → URL-encoded, raster → base64 | D-10 |
| `copyManifestJson()` | `JSON.stringify(arr, null, 2)` with five fields per done file: `{ filename, target, originalSize, optimizedSize, quality }`; `filename` uses `renameExtension(file.name, file.target)` | D-11 |
| `copyPictureOne(file)` | Single-file `<picture>` clipboard write (consumed by Plan 05 FileRow menu) | D-12 |
| `copyDataUriOne(file)` | Single-file data-URI clipboard write | D-12 |

All async bodies read `filesAtom.get().entries` (not `useStore` snapshot) — same stale-closure dodge as `useOptimize` / `useExport`. All clipboard writes flow through the Plan 01 chokepoint; the hook never calls `navigator.clipboard.writeText` directly (D-15).

### Stub deletion in `src/stores/files.ts`
- Removed `exportCopyHtml`, `exportCopyDataUris`, `exportManifestJson` (Phase 11 retirement precedent).
- `grep -n 'exportCopyHtml\|exportCopyDataUris\|exportManifestJson' src/stores/files.ts` → 0 hits.

### Toolbar wiring (`src/components/shell/Toolbar.tsx`)
- Removed dead imports of the three stubs.
- Imports `useSnippets` from `@/hooks/useSnippets`; subscribes to `$hasDone` via `useStore` (Phase 11 D-13 reuse).
- Each menu item carries the **disable-then-explain triple** `disabled={!hasDone}` + `aria-disabled={!hasDone}` + `title={hasDone ? '' : 'Optimize at least one file first'}` matching Toolbar.tsx lines 117-123 verbatim.
- onClick is a one-liner that calls the matching `useSnippets` method and closes the menu — business logic stays in the hook (CLAUDE.md project rule).

## Threat Mitigations

| Threat | Surface | Mitigation |
|--------|---------|------------|
| T-12-01 (SVG XSS) | Bulk `<picture>` + Copy data URI for SVG | Inherits Plan 02 `buildDataUri` SVG → URL-encoded branch; never reaches base64 for SVG. |
| T-12-02 (HTML-attr injection) | `<picture>` block per file | Inherits Plan 02 `escapeAttr` on alt/src/srcset interpolations. |
| T-12-03 / T-12-04 (clipboard fallback) | All three Toolbar writes | Inherits Plan 01 chokepoint dispatcher (feature-detect + textarea+execCommand try/finally cleanup). |

## Test Results

`npx playwright test src/tests/toolbar-snippets.spec.ts --reporter=dot` → **PASS** for the four scenarios:
1. Copy `<picture>` HTML — clipboard captures joined blocks separated by blank lines
2. Copy as data URIs — one URI per line; SVG URL-encoded, raster base64
3. Manifest JSON — pretty-printed array with the five fields per done file
4. Disable-then-explain — `aria-disabled="true"` + `title="Optimize at least one file first"` when no done files

VALIDATION.md row 12-04-toolbar marked ✅ green.

## Carry-Forward for Plan 05 (FileRow ContextMenu)

- `copyPictureOne(file)` and `copyDataUriOne(file)` are ready for the two new ContextMenu siblings.
- Both methods accept a `FileEntry` and write through the Plan 01 chokepoint with file-specific toast labels.
- Plan 05 onClick handlers should be one-liners: `() => { useSnippets.copyPictureOne(file) }` — disabled gating via `file.status !== 'done'` lives on the ContextMenuItem prop, same as Phase 11 `Save as…`.
- Test pattern: `installClipboardMocks(page, { mode: 'native' })` + the `injectEntries` helper copied verbatim from `file-row-menu.spec.ts:34-72` (Plan 03 precedent).

## Files

- `/Users/jilizart/Projects/oimg.app/src/hooks/useSnippets.ts` — new
- `/Users/jilizart/Projects/oimg.app/src/components/shell/Toolbar.tsx` — modified
- `/Users/jilizart/Projects/oimg.app/src/stores/files.ts` — three stubs removed
- `/Users/jilizart/Projects/oimg.app/src/tests/toolbar-snippets.spec.ts` — new
- `/Users/jilizart/Projects/oimg.app/.planning/phases/12-real-snippets/12-VALIDATION.md` — 12-04-toolbar ✅ green
