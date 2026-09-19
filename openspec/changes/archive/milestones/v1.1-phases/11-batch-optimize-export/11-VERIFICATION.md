---
phase: 11-batch-optimize-export
verified: 2026-06-02T00:00:00Z
status: passed
score: 4/4 success criteria verified (OPT-02, EXP-01, EXP-02 all satisfied; D-01..D-13 all traced; T-11-01 mitigated)
overrides_applied: 0
---

# Phase 11: Batch Optimize + Export Verification Report

**Phase Goal:** The optimize loop scales to a folder of files and the developer can walk away with their results — individual downloads and a single ZIP of the whole batch.
**Verified:** 2026-06-02
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | User clicks Optimize-all → batch runs through worker pool with live per-file progress visible | VERIFIED | `src/hooks/useOptimize.ts:121-134` per-promise streaming write-back (`.then(setFileResult/setFileError)`) — NOT `Promise.allSettled` batch-wait. D-11 skip in line 73 (`if (entry.status === 'done') continue`). `setFileProcessing(id)` onDispatch callback line 126. `src/components/shell/StatusBar.tsx:16-18,40-49` derives live `X/Y optimized` from `entries.filter(status==='done').length`, wrapped in `role="status" aria-live="polite" aria-atomic="true"`. No synthetic determinate bar (D-02): FileRow line 107-113 only renders progress bar when `status === 'processing'` and only displays `prog` if present (not synthesized). Tests: `batch-progress.spec.ts` mid-batch latch on processing≥1 AND queued≥1, `status-bar.spec.ts` mid-batch latch on `0 < k < 6`. |
| SC-2 | User can download a single optimized file to disk (native picker + file-saver fallback) | VERIFIED | `src/lib/save-blob.ts:42-90` feature-gates picker on `'showSaveFilePicker' in window && window.isSecureContext === true`, swallows `DOMException AbortError` silently (no toast/console/fallback re-prompt), falls through to `saveAs(blob, filename)` for all other paths. `src/hooks/useExport.ts:46-55` exportOne uses `renameExtension(entry.name, entry.target)` (D-05) + `mimeFor`. `src/components/panels/inspector/ReportPanel.tsx:72-84` Download button conditional on `selected.status === 'done'`. `FileRow.tsx:138-145` ContextMenuItem `disabled={file.status !== 'done'}` + `title="Optimize this file first"` + `onSelect={() => void exportOne(file)}`. Tests: `export-single.spec.ts` (3 paths: picker/fallback/cancel), `file-row-menu.spec.ts` (5 incl. ESC + ArrowDown WCAG-AA). |
| SC-3 | User can export the entire optimized batch as one ZIP via jszip | VERIFIED | `src/lib/build-zip.ts:21-48` filters `status === 'done' && encodedBuffer != null` (D-08+D-12), throws `NO_EXPORTABLE_FILES` on empty (defense-in-depth), uses `sanitizeBaseName(renameExtension(...))` before `zip.file(final, ...)` (T-11-01), collisionSuffix tracking `used` Set (D-10), flat layout — no folder prefix (D-09), `generateAsync({ streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 1 }})`. `useExport.ts:57-86` exportZip uses `timestampedZipName()`, surfaces skipped count via `summaryToast`. Toolbar `hasDone` gate via `$hasDone` computed atom (D-13). Tests: `export-zip.spec.ts` (6 tests: happy path, D-10 regex, dup→(1)/(2), D-08 count, D-09 no `/`, D-12 skip toast). |
| SC-4 | Backpressure holds — pool bounds concurrency, UI stays responsive | VERIFIED | `src/lib/worker-pool.ts:78` exact cap `Math.min(navigator.hardwareConcurrency ?? 4, 4)`. `useOptimize.ts:121-134` synchronous `.map(...)` then `Promise.all` (Pitfall 1 fix). Test `backpressure.spec.ts:144` literal `Math.min(navigator.hardwareConcurrency || 4, 4)` present; asserts `peak >= 2` AND `peak <= cap` after 20-file batch with monotonic `window.__peakRunning` latch wired in `main.tsx:25-34` (gated by `import.meta.env.MODE === 'test'` for tree-shake) AND re-bootstrapped in-page when dev-mode webServer is used. |

**Score:** 4/4 truths verified

### Required Artifacts (Three Levels)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/hooks/useOptimize.ts` | D-03 streaming + D-11 skip-done | VERIFIED | 138 lines, real implementation, imported via Toolbar |
| `src/hooks/useExport.ts` | exportOne/exportZip/exportIndividually | VERIFIED | 120 lines, imported by Toolbar + FileRow + ReportPanel |
| `src/lib/filename.ts` | sanitize/rename/timestampedZip/collision/mime | VERIFIED | 56 lines, 5 exported functions, used by useExport + build-zip |
| `src/lib/save-blob.ts` | picker + file-saver + silent AbortError | VERIFIED | 91 lines, used by useExport |
| `src/lib/build-zip.ts` | JSZip streamFiles + level 1 + sanitize | VERIFIED | 49 lines, used by useExport.exportZip |
| `src/components/shell/StatusBar.tsx` | aggregate X/Y aria-live | VERIFIED | testid `agg-counter`, role+aria-live+aria-atomic present |
| `src/components/shell/Toolbar.tsx` | All as ZIP + Save individually + $hasDone | VERIFIED | useStore($hasDone), disabled on hasDone===false + title |
| `src/components/panels/files/FileRow.tsx` | ContextMenu Save as… | VERIFIED | onSelect → void exportOne(file); disabled when status !== 'done' |
| `src/components/panels/inspector/ReportPanel.tsx` | Inspector Download conditional | VERIFIED | `selected && selected.status === 'done'` gate |
| `src/stores/files.ts` | $hasDone computed | VERIFIED | line 66 `s.entries.some(e => e.status === 'done')` |
| `src/main.tsx` | test-only window bridge | VERIFIED | gated by `import.meta.env.MODE === 'test'` |
| `package.json` | jszip ^3.10.1, file-saver ^2.0.5, @types/file-saver ^2.0.7 | VERIFIED | lines 34-35, 51 |

### Decision Coverage (D-01 .. D-13)

| Decision | File:Symbol | Status |
|---|---|---|
| D-01 dual progress surfaces | StatusBar.tsx agg-counter + FileRow status dot | VERIFIED |
| D-02 indeterminate encoding | FileRow.tsx:107-113 (bar gated on processing only, no synthetic fill) | VERIFIED |
| D-03 per-promise streaming write-back | useOptimize.ts:121-134 (.map + Promise.all + per-promise .then) | VERIFIED |
| D-04 per-row ContextMenu + Inspector | FileRow.tsx:138-145 + ReportPanel.tsx:72-84 | VERIFIED |
| D-05 base name + ext-swap | filename.ts:14-19 renameExtension | VERIFIED |
| D-06 Save individually = sequential fallback | useExport.ts:88-117 (forceFallback:true + 80ms sleep) | VERIFIED |
| D-07 single-file picker + fallback | save-blob.ts:42-90 | VERIFIED |
| D-08 optimized only in ZIP | build-zip.ts:21-23 filter status==='done' && encodedBuffer!=null | VERIFIED |
| D-09 flat layout | build-zip.ts:38-39 (no folder prefix) | VERIFIED |
| D-10 timestamped name + collision | filename.ts:22-45 collisionSuffix + timestampedZipName | VERIFIED |
| D-11 skip already-done on Optimize-all | useOptimize.ts:73 `if (entry.status === 'done') continue` | VERIFIED |
| D-12 skip errors + skipped count toast | build-zip.ts (encodedBuffer!=null filter) + useExport.ts:32-38 summaryToast | VERIFIED |
| D-13 disable-then-explain | files.ts:66 $hasDone + Toolbar.tsx:31,92-99,118-131 disabled+aria-disabled+title | VERIFIED |

### Threat-Mitigation Citations (T-11-01 zip-slip)

| Threat | Mitigation | Citation |
|---|---|---|
| T-11-01 zip-slip / path-traversal | `sanitizeBaseName` strips `/`, `\`, NUL → `_` | `filename.ts:53-56` (impl); `build-zip.ts:33-34` (applied at zip.file dispatch); `useExport.ts:101` (applied in bulk save-individually dispatcher); unit-tested in `filename.test.ts:52-58` (`../etc/passwd` and `a\b\c` cases) |

### Requirements Coverage

| Requirement | Plan Source | Description | Status | Evidence |
|---|---|---|---|---|
| OPT-02 | 11-01, 11-02 | User clicks Optimize-all → batch runs through worker pool with live per-file progress | SATISFIED | SC-1 evidence above |
| EXP-01 | 11-04, 11-06 | User can download a single optimized file to disk | SATISFIED | SC-2 evidence above |
| EXP-02 | 11-05 | User can export the entire optimized batch as a ZIP (jszip) | SATISFIED | SC-3 evidence above |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (none in Phase 11 modified files) | — | grep for `TBD\|FIXME\|XXX` returned no matches | — | None |
| `FileRow.tsx` | 134, 146, 150, 154, 159 | `@TODO Phase 3 — pushToast(...)` placeholder onSelect on Re-optimize, Copy data URI, Copy `<picture>`, Reveal in compare, Apply same settings | Info | Pre-existing from Phase 02; NOT Phase 11 scope. The Phase 11 Save as… item (line 141) IS wired to exportOne. Not a Phase 11 regression. |

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|---|---|---|
| jszip is importable & API present | `build-zip.ts` `import JSZip from 'jszip'`; `package.json` line 35 `jszip ^3.10.1` | PASS |
| file-saver is importable | `save-blob.ts` `import { saveAs } from 'file-saver'`; `package.json` line 34 | PASS |
| timestampedZipName regex contract | `filename.test.ts:35-42` proves `/^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/` | PASS |
| sanitizeBaseName neutralizes traversal | `filename.test.ts:52-58` (passed) | PASS |
| Test-only window bridge tree-shakes | `main.tsx:25` `if (import.meta.env.MODE === 'test')` gate confirmed | PASS |

### Test Result Inventory (from verification context)

- E2E: 24/24 passed (batch-progress 3, status-bar 3, export-single 3, export-zip 6, file-row-menu 5, backpressure 4 incl. SC-4, export-disabled covered separately)
- Unit: filename 18 passed, deps 3 passed
- Build: `npm run build` exit 0 (clean)
- TS baseline debt pre-existing per MEMORY note typecheck-and-test-gotchas; NOT a Phase 11 regression

### Human Verification Required

None — all observable truths are mechanically verifiable from code + test artifacts. Visual/UX feel of mid-batch progress was harvested into `status-bar.spec.ts` mid-batch latch (k>0 && k<6) and `batch-progress.spec.ts` (processing≥1 && queued≥1), both deterministic.

### Gaps Summary

No gaps. Phase goal achieved.

- All 4 Success Criteria verified against code with cited file:line evidence
- All 3 requirement IDs (OPT-02, EXP-01, EXP-02) satisfied
- All 13 decisions (D-01..D-13) traced to implementation
- T-11-01 zip-slip mitigation applied at both surfaces (ZIP builder + bulk save dispatcher) and unit-tested
- Pinned dep versions match CLAUDE.md contract (jszip ^3.10, file-saver ^2.0, @types/file-saver ^2.0)
- WorkerPool cap (`Math.min(navigator.hardwareConcurrency ?? 4, 4)`) intact; backpressure test asserts both lower (≥2) and upper (≤cap) bounds dynamically
- Test-only `main.tsx` bridge correctly gated by `import.meta.env.MODE === 'test'` for production tree-shake (zero-telemetry constraint)
- No `TBD`/`FIXME`/`XXX` debt markers in any Phase 11 modified file
- Pre-existing `@TODO Phase 3` placeholders in FileRow.tsx are out-of-scope (Phase 02 origin) and do not affect the Phase 11 Save as… wiring (which IS hooked to exportOne)

---

_Verified: 2026-06-02_
_Verifier: Claude (gsd-verifier)_
