# Phase 10: Single-File Optimize Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 10-single-file-optimize-loop
**Areas discussed:** Ingestion & entry point, Demo files on first drop, Accepted formats & rejects, Truthful sizes & auto-optimize, Multi-drop auto-optimize scope

---

## Ingestion & entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Drop + picker, add all | Wire dropzone + picker; multiple files → add all, auto-select newest; each optimizes via single-file path | ✓ |
| Drop + picker, strictly one | Wire both, but exactly one file per drop (first wins; extras rejected) | |
| Dropzone only | Wire only the dropzone; leave picker/Toolbar "From device" stubbed | |

**User's choice:** Drop + picker, add all
**Notes:** Both the existing dropzone and the "Add files"/"From device" picker get wired. Multi-file drops add everything to the list.

---

## Demo files on first drop

| Option | Description | Selected |
|--------|-------------|----------|
| Clear demos on first drop | First real ingest clears seeded demos, then shows only real files | |
| Append real below demos | Keep demos; add real uploads alongside (mixes real + fake sizes) | |
| Remove demos now | Drop seeded demos entirely; app starts empty, dropzone-first | ✓ |

**User's choice:** Remove demos now
**Notes:** App starts empty. Consequence flagged + accepted: tests relying on seeded files (navigation/backpressure/per-file-settings/inspector-tabs/output-panel) must switch to a real-file fixture (captured as D-05).

---

## Accepted formats & rejects

| Option | Description | Selected |
|--------|-------------|----------|
| png/jpg/webp/svg/avif + toast reject | Accept decodable set; reject others with a toast naming the file | |
| Same set, silent skip | Accept decodable set; silently ignore unsupported (no toast) | ✓ |
| Broad image/* + per-file error | Accept any image/*; let codec fail per-file via D-13 | |

**User's choice:** Same set, silent skip
**Notes:** Ingest gate accepts png/jpg/jpeg/webp/svg/avif; unsupported files are dropped silently. Per-file encode failures still surface via Phase 9's D-13 path.

---

## Truthful sizes & auto-optimize

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-optimize on drop | Squoosh-style: auto-optimize on ingest; orig=File.size, opt=encoded byteLength, live Report | ✓ |
| Manual optimize | Show orig=File.size; opt blank until user clicks Optimize | |
| Auto-optimize newest only | Auto-optimize only the newest/selected file; others wait | |

**User's choice:** Auto-optimize on drop
**Notes:** Real File.size as orig, encoded byteLength as opt; Report shows honest before/after + savings. Re-adjusting re-optimizes (Phase 9 live re-encode).

---

## Multi-drop auto-optimize scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only the newest/selected | Add all; auto-optimize only newest; others optimize on select / Phase 11 batch | |
| Auto-optimize all dropped | Optimize every file in the drop immediately | ✓ |
| First file only, ignore extras | Accept only the first dropped file (strictly single) | |

**User's choice:** Auto-optimize all dropped
**Notes:** Every ingested file auto-optimizes. Accepted that this pulls some batch behavior forward; Phase 11's distinct deliverable remains the explicit "Optimize all" action + live per-file progress through the worker pool (OPT-02).

---

## Claude's Discretion

- Exact dropzone event wiring + drag-active visual state and drop-target bounds.
- Where ingestion logic lives (prefer a `useIngest` hook + thin store actions; logic in hooks/stores, not components).
- File → FileEntry mapping (id, name, type, dim via createImageBitmap, status, settings via defaultFileSettings).
- Dispatch path for auto-optimize-on-drop (useOptimize vs useLiveEncode).
- Reading image dimensions for the `dim` field.

## Deferred Ideas

- "From URL or paste" ingestion (clipboard + client-side URL fetch) — later phase.
- "Watch folder" ingestion (File System Access API) — later phase.
- Explicit "Optimize all" batch with live per-file progress through the worker pool — OPT-02 / Phase 11.
