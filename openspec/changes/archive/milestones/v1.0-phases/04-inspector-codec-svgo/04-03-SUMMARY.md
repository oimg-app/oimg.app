---
phase: 04-inspector-codec-svgo
plan: "03"
subsystem: codec-panel
tags: [inspector, codec, sliders, resize, metadata, nanostores, react]
dependency_graph:
  requires: [04-01]
  provides: [INSP-02, INSP-03, INSP-04, INSP-05]
  affects: [src/components/panels/inspector/CodecPanel.tsx]
tech_stack:
  added: []
  patterns: [useStore(settingsAtom), Slider value as number[], SegControl, Section, Switch, conditional render]
key_files:
  created: []
  modified:
    - src/components/panels/inspector/CodecPanel.tsx
decisions:
  - "PNG Palette and AVIF Subsample SegControls are stubs (no store field yet) — onChange is no-op, value fixed; tracked per plan spec"
  - "Slider value prop uses number[] array syntax ([settings.q]) per Radix/Shadcn API requirement"
  - "Both Task 1 and Task 2 implemented in a single atomic commit since they target the same file"
metrics:
  duration: "3 minutes"
  completed: "2026-05-20T07:51:00Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 04 Plan 03: CodecPanel (INSP-02 through INSP-05) Summary

**One-liner:** Full CodecPanel with four Section blocks — codec buttons, Quality/Effort sliders, Resize gates, and Metadata toggles — all wired to settingsAtom actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CodecPanel — Output format + Parameters sections (INSP-02, INSP-03) | f5d5981 | CodecPanel.tsx (175 insertions, replaces 2-line stub) |
| 2 | CodecPanel — Resize + Metadata sections (INSP-04, INSP-05) | f5d5981 | CodecPanel.tsx (same commit — same file) |

## What Was Built

`src/components/panels/inspector/CodecPanel.tsx` — full 180-line implementation replacing the 7-line stub created in Plan 02. Contains:

- **INSP-02 Output format:** CODECS map to buttons with active/inactive state via `settings.codec === c`, `setCodec(c as Codec)` on click. Lossless Switch visible when `codec !== 'SVG'`.
- **INSP-03 Parameters:** Hidden entirely when `codec === 'SVG'`. Section badge shows engine name via `CODEC_ENGINE` map (libavif/libwebp/mozjpeg/oxipng/svgo). Quality slider (`value={[settings.q]}`) and Effort slider (`value={[settings.method]}`) both use Radix array syntax. PNG Palette SegControl conditionally visible for `codec === 'PNG'`. AVIF Subsample SegControl conditionally visible for `codec === 'AVIF'`.
- **INSP-04 Resize:** "Resize on export" Switch gates `{settings.resizeOn && ...}` body with Width/Height Inputs (`setResizeDimensions`), Fit SegControl (`FIT_MODES` / `setFit`), Algorithm SegControl (`RESIZE_ALGS` / `setAlg`).
- **INSP-05 Metadata:** Two flex rows — "Strip EXIF / XMP / IPTC" Switch (`setStripMeta`) and "Keep ICC profile" Switch (`setKeepIcc`).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| src/components/panels/inspector/CodecPanel.tsx | ~112 | PNG Palette SegControl — `value="off"`, `onChange={() => {}}` (no store field for palette in Phase 4; per plan spec) |
| src/components/panels/inspector/CodecPanel.tsx | ~120 | AVIF Subsample SegControl — `value="4:2:0"`, `onChange={() => {}}` (no store field for subsampling in Phase 4; per plan spec) |

These are intentional per plan — the plan notes these as display-only stubs for Phase 4.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. `setCodec(c as Codec)` cast is guarded by `CODECS.map()` — only values from the constant produce onClick handlers (T-04-09 mitigated as specified in threat model).

## Self-Check: PASSED

- `src/components/panels/inspector/CodecPanel.tsx` — exists, 180 lines (min 100 required)
- Commit f5d5981 — verified in git log
- Zero TypeScript errors referencing CodecPanel.tsx (pre-existing node_modules errors unrelated)
- All acceptance criteria grep patterns confirmed present
