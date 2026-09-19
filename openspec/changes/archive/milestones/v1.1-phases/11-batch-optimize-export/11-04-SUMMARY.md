---
phase: 11-batch-optimize-export
plan: 04
subsystem: export
tags: [phase-11, wave-2, save-blob, useExport, inspector, EXP-01]
requirements: [EXP-01]
dependency_graph:
  requires: [11-00, 11-03]
  provides:
    - src/lib/save-blob.ts (saveBlob dispatcher)
    - src/hooks/useExport.ts (useExport hook skeleton, exportOne)
    - src/components/panels/inspector/ReportPanel.tsx (Download button)
  affects: [11-05 exportZip, 11-06 exportIndividually, 11-07 D-13 disable]
tech_stack:
  added: []  # file-saver already locked in Plan 00
  patterns:
    - "FS Access API feature-detect + isSecureContext gate + AbortError silent swallow"
    - "MIME → ext[] dict shape for showSaveFilePicker types[].accept"
    - "hook returns { fnA, fnB, ... } open shape for future Plan 05/06 additions"
key_files:
  created:
    - src/lib/save-blob.ts
    - src/hooks/useExport.ts
    - src/tests/export-single.spec.ts
  modified:
    - src/components/panels/inspector/ReportPanel.tsx
decisions:
  - "saveBlob silently swallows AbortError — no toast, no console, no fallback (Pitfall 2)"
  - "saveBlob falls through to file-saver for ALL non-AbortError picker exceptions (opaque-error UX)"
  - "useExport returns { exportOne } now; Plan 05/06 will add exportZip + exportIndividually to the same hook"
  - "Inspector Download button mounted inside ReportPanel (D-04) — no new panel file"
  - "e2e spec hijacks HTMLAnchorElement.prototype.dispatchEvent to intercept file-saver's detached-anchor click (the document-level listener can't see it)"
metrics:
  duration: ~10m
  completed: 2026-06-02
  commits: 3
---

# Phase 11 Plan 04: saveBlob dispatcher + useExport.exportOne + Inspector Download Button Summary

**One-liner:** EXP-01 minimum slice — Chromium picker + file-saver fallback dispatcher, useExport hook skeleton, and Inspector Download button that swaps extension on save.

## Tasks Completed

| Task | Name                                                        | Commit  | Files                                             |
| ---- | ----------------------------------------------------------- | ------- | ------------------------------------------------- |
| 1    | Implement src/lib/save-blob.ts dispatcher                   | 91c161c | src/lib/save-blob.ts                              |
| 2    | Implement src/hooks/useExport.ts skeleton with exportOne    | c5ac760 | src/hooks/useExport.ts                            |
| 3    | Wire ReportPanel Download button + e2e spec for EXP-01      | f993d13 | src/components/panels/inspector/ReportPanel.tsx, src/tests/export-single.spec.ts |

## Verification

- `grep -c "isSecureContext" src/lib/save-blob.ts` → 2 (feature-detect + comment)
- `grep -c "AbortError" src/lib/save-blob.ts` → 2 (catch + comment)
- `grep -c "showSaveFilePicker" src/lib/save-blob.ts` → 3 (feature-detect + cast + comment)
- `grep -c "export function useExport" src/hooks/useExport.ts` → 1
- `grep -c "Download optimized file" src/components/panels/inspector/ReportPanel.tsx` → 1
- `grep -c "selected.status === 'done'" src/components/panels/inspector/ReportPanel.tsx` → 1
- `npx playwright test src/tests/export-single.spec.ts --project=chromium --reporter=dot` → PASS 3/3 (~154s)
- `npx tsc -b` → no new errors in new files (baseline pre-existing debt unchanged per MEMORY note)

## E2E Tests Added

1. **native picker path:** showSaveFilePicker fires with swapped extension (`fixture-0.png` → `fixture-0.webp`; D-05). Asserts no fallback was invoked when picker succeeded.
2. **fallback path:** stripping `showSaveFilePicker` from window simulates Firefox/Safari → file-saver `saveAs` fires with the same swapped name. Asserts native path recorded nothing.
3. **user cancel (AbortError):** picker throws DOMException AbortError → no toast appears, no save recorded on either path, no console errors leak.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inline `type` import triggered TS1005 against tsc baseline parser**
- **Found during:** Task 2
- **Issue:** `import { filesAtom, type FileEntry } from '@/stores/files'` produced TS1005 in `tsc -b`. The baseline already has TS1005 noise (per MEMORY `typecheck-and-test-gotchas.md`), but useOptimize/useIngest use `import type { ... }` separately.
- **Fix:** Split the inline `type` modifier into a separate `import type` line to match useIngest pattern.
- **Files modified:** src/hooks/useExport.ts
- **Commit:** c5ac760

**2. [Rule 1 - Bug] save-file-mocks document-level listener missed file-saver's detached anchor**
- **Found during:** Task 3 e2e run (fallback test timed out at 5s waiting for `__saveAsCalls` length === 1)
- **Issue:** file-saver creates an `<a>` element, sets `href = createObjectURL(blob)` and `download = name`, then dispatches `new MouseEvent('click')` directly on the anchor — WITHOUT appending it to the DOM. Save-file-mocks' `document.addEventListener('click', ..., true)` listener never sees clicks on detached nodes (the capture path traverses connected ancestors only).
- **Fix:** In the spec's fallback test setup, also hijack `HTMLAnchorElement.prototype.dispatchEvent` to detect `click` on detached anchors with `download` attribute and push into `__saveAsCalls` directly. Kept Plan 00's save-file-mocks unchanged (shared artifact) — fix is local to this spec.
- **Files modified:** src/tests/export-single.spec.ts (in-spec setup script)
- **Commit:** f993d13
- **Carry-forward note for Plan 05:** Plan 05's batch-zip.spec.ts will hit the same detached-anchor issue when testing the file-saver path for ZIP export. Either (a) lift the anchor-prototype hijack into a shared helper next to save-file-mocks, or (b) extend save-file-mocks itself with the same logic.

**3. [Rule 1 - Bug] ArrayBuffer can't cross page.evaluate JSON channel**
- **Found during:** Task 3 e2e run (native test failed: `saved[0].bytes.byteLength` was undefined)
- **Issue:** Returning `Array<{ name, bytes: ArrayBuffer }>` from `page.evaluate` strips the ArrayBuffer (not JSON-serializable). Test received `{ name, bytes: undefined }`.
- **Fix:** Map to `{ name, byteLength }` inside the evaluate body before returning.
- **Files modified:** src/tests/export-single.spec.ts
- **Commit:** f993d13

## Carry-forward Notes for Plans 05/06/07

- **Plan 05 (exportZip):** Extend `useExport` to return `{ exportOne, exportZip }`. exportZip MUST read `filesAtom.get().entries` inside the body (not the useStore snapshot — stale-closure discipline per useOptimize). Use `saveBlob(zipBlob, timestampedZipName(), { ext: 'zip', mime: 'application/zip' })`. For e2e: lift the anchor-prototype hijack from this plan's spec into a shared helper.
- **Plan 06 (exportIndividually + FileRow ContextMenu):** Add `exportIndividually` to useExport. FileRow's existing `<ContextMenuItem onSelect={...}>Save as…</ContextMenuItem>` stub at lines 136-139 wires to `() => void exportOne(file)` with `disabled={file.status !== 'done'}` per 11-PATTERNS.md.
- **Plan 07 (D-13 disable):** Add `$hasDone` computed atom in `src/stores/files.ts` for Toolbar's Export button disable + tooltip ("Optimize at least one file first"). The Inspector Download button this plan adds is already self-gated (renders only when done) — Plan 07's pattern applies to the always-visible Toolbar buttons.

## Threat Flags

None — no new trust boundaries beyond those documented in the plan's `<threat_model>` section. T-11-PIC, T-11-ABT, T-11-OPQ all mitigated as planned.

## Self-Check: PASSED

- `[x]` src/lib/save-blob.ts exists
- `[x]` src/hooks/useExport.ts exists
- `[x]` src/tests/export-single.spec.ts exists
- `[x]` src/components/panels/inspector/ReportPanel.tsx modified (Download button, useExport import)
- `[x]` Commit 91c161c found (saveBlob)
- `[x]` Commit c5ac760 found (useExport)
- `[x]` Commit f993d13 found (ReportPanel + e2e)
- `[x]` Playwright spec passes 3/3 on chromium
