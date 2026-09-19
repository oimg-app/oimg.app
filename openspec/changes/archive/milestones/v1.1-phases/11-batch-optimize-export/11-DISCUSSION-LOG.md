# Phase 11: Batch Optimize + Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 11-Batch Optimize + Export
**Areas discussed:** Live batch progress, Single-file download, Batch ZIP structure, Failed/unoptimized files

---

## Live batch progress

### Progress display granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file + aggregate | Each FileRow flips queued→encoding→done live AND StatusBar shows aggregate `X/Y optimized` counter + overall bar. Reuses both existing scaffolds. | ✓ |
| Per-file only | Rows flip queued→encoding→done live; no aggregate counter/bar. | |
| Aggregate only | A single batch progress bar; rows just end as done. | |

**User's choice:** Per-file + aggregate
**Notes:** Reuses the FileRow status dot + bar scaffold (already present from Phase 3) and the StatusBar worker-pip + BackpressureIndicator (Phases 8–9).

### Per-file encoding indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Indeterminate spinner/pulse | Honest indeterminate state (existing animate-pulse pattern) while in-flight, snap to done. Codec encodes are atomic — no real intra-file %. | ✓ |
| Determinate estimated bar | Animate the FileRow progress bar with an estimated/eased fill. Looks precise but synthetic. | |
| Queued vs encoding vs done | Three discrete dot states only, no bar at all. | |

**User's choice:** Indeterminate spinner/pulse
**Notes:** Codec encode is atomic, so no honest determinate %. The existing FileRow determinate bar stays empty during encoding under D-02.

---

## Single-file download (EXP-01)

### Download affordance location

| Option | Description | Selected |
|--------|-------------|----------|
| Row + inspector | Hover/context button on each FileRow AND an inspector "Download" button. | (refined → File options ctx menu + inspector) |
| Inspector only | Single inspector button for the selected file. | |
| Row only | Per-row download button only. | |

**User's choice:** Download lives in the per-row **File options context menu** (the existing `ctxbtn`) AND in the inspector for the selected file.
**Notes:** User clarified the row affordance is the existing per-row File options menu, not a new hover icon — keeps queue rows visually clean.

### Filename convention

| Option | Description | Selected |
|--------|-------------|----------|
| Swap extension | `hero.png` → `hero.webp`. Clean, matches dev expectations. | ✓ |
| Add suffix | `hero.min.webp` — marks optimized, avoids clobbering an original. | |
| Keep exact name | `hero.png` even if bytes are WebP — extension lies. | |

**User's choice:** Swap extension
**Notes:** When `target === source`, extension is unchanged.

### "Save individually" delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-download each | Sequential downloads to the browser Downloads folder (file-saver/anchor). No per-file dialog. | ✓ |
| Save dialog per file | Native showSaveFilePicker prompt per file — precise but tedious. | |
| Redirect to ZIP | Just route "Save individually" to the ZIP export. Loses the per-file option. | |

**User's choice:** Auto-download each
**Notes:** Watch for browser anti-multi-download heuristics (deferred to researcher).

---

## Batch ZIP (EXP-02)

### ZIP contents

| Option | Description | Selected |
|--------|-------------|----------|
| Optimized only | Just optimized files, one per source. Smallest, matches "walk away with results". | ✓ |
| Optimized + manifest | Optimized files + manifest.json with per-file before/after + settings. (Manifest is Phase 12 Snippets.) | |
| Optimized + originals | Both, in `optimized/` and `originals/` subfolders. | |

**User's choice:** Optimized only

### Folder structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat | All files at ZIP root. Simplest; drops/picker don't reliably preserve paths anyway. | ✓ |
| Preserve folder paths | Preserve `webkitRelativePath` for folder drops; fall back to flat for picker. | |
| Group by format | Subfolders per target format (`webp/`, `avif/`, `png/`). | |

**User's choice:** Flat

### ZIP filename + collisions

| Option | Description | Selected |
|--------|-------------|----------|
| oimg-export.zip + dedupe | Fixed name; same-name files get `(1)`, `(2)` suffix. | |
| Timestamped name | `oimg-export-YYYY-MM-DD-HHMM.zip` so successive exports don't clobber. Same-name dedupe inside. | ✓ |
| Prompt user | `showSaveFilePicker` so user names it. | |

**User's choice:** Timestamped name (with in-zip `(1)`/`(2)` dedupe)

---

## Failed / unoptimized files

### Optimize-all re-run scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only not-yet-done | Files with status ≠ 'done' (queued + error). useLiveEncode still handles per-file re-encodes on settings change. | ✓ |
| Everything | Re-run every file unconditionally. Burns CPU on already-done files. | |
| Queued + changed | Skip done unless settings changed since last encode (dirty flag). | |

**User's choice:** Only not-yet-done

### Errored files in exports

| Option | Description | Selected |
|--------|-------------|----------|
| Skip from exports | Errored files excluded from ZIP and Save individually; surface skipped count in feedback. | ✓ |
| Include original bytes | Fall back to source bytes (with original extension) so developer still gets the asset. | |
| Include + .error.txt | Include original bytes AND a per-file `<name>.error.txt` with the error message. | |

**User's choice:** Skip from exports

### Export gating

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt to optimize | Exports enabled; if nothing optimized, show "Optimize first?" toast/dialog that runs Optimize-all then exports. | |
| Disable until 1+ done | Export controls disabled (with tooltip) until ≥1 file has status='done'. Safer, less convenient. | ✓ |
| Allow exporting originals | Always enabled; unoptimized files fall back to original bytes. Defeats the "optimized batch" promise. | |

**User's choice:** Disable until 1+ done

---

## Claude's Discretion

- The exact wiring of `runOptimize` for per-promise write-back vs `Promise.allSettled` (D-03 contract: live transitions, not the mechanism).
- Aggregate counter derivation (reuse `runtimeAtom.runningJobs/queuedJobs/setJobCounts` from Phase 9 vs a new atom).
- "File options" context-menu primitive — shadcn `DropdownMenu` vs `ContextMenu` vs custom popover on `ctxbtn` (must meet WCAG-AA).
- "Save individually" delivery — repeated `file-saver` calls vs sequential anchor clicks vs `for await` over a save micro-job; pick what doesn't trip browser anti-multi-download heuristics.
- ZIP generation strategy — in-memory `JSZip.generateAsync({type:'blob'})` vs streaming; ensure UI stays responsive (WCAG-AA).
- aria-live announcements during the batch (likely a single polite live region on the StatusBar aggregate counter; verify against WCAG-AA expectations).
- `package.json` additions — `jszip ^3.10` (3.10.1), `file-saver ^2.0` (2.0.5), `@types/file-saver`. Versions per CLAUDE.md pins.

## Deferred Ideas

- Per-format subfolders inside the ZIP (`webp/`, `avif/`, `png/`) — revisit on demand.
- Preserve folder paths via `webkitRelativePath` — needs ingest path-propagation.
- `manifest.json` in the ZIP — Phase 12 (Real Snippets).
- Copy `<picture>` HTML / data URIs — Phase 12.
- Save-to-folder via `FileSystemDirectoryHandle` (showDirectoryPicker).
- "Cancel batch" + per-file retry — separate UX scope.
- Include-originals option — explicitly rejected by D-08/D-12.
- `showSaveFilePicker` per file in "Save individually" — explicitly rejected by D-06.
- "Re-run everything" Optimize-all mode — explicitly rejected by D-11.
