---
phase: 09-codec-encoders
plan: "04"
subsystem: components/panels
tags: [ui-wiring, per-file-settings, useLiveEncode, apply-to-all, DeltaStrip, CompareStage, D-02, D-03, D-05, D-10, D-13, ENC-06]
dependency_graph:
  requires:
    - FileSettings + setFileSettings + applyToAll (Plan 01)
    - useLiveEncode().trigger + runtimeAtom.encodingFileId (Plan 03)
    - real EncodeResult bytes on FileEntry.encodedBuffer (Plans 02/03)
  provides:
    - CodecPanel/SvgoPanel bound to the selected file's own settings + live re-encode trigger
    - InspectorPane context label (D-03) + "Apply to all files" button (D-02)
    - DeltaStrip real optimized size + in-flight shimmer + (fallback) error state (D-13)
    - CompareStage real original/encoded images via object URLs
  affects:
    - Phase 10+ (snippets/export) — consumes the per-file encodedBuffer surfaced here
tech_stack:
  added: []
  patterns:
    - Components read selectedFile.settings via useStore, never the global settingsAtom (D-03)
    - Every control onChange → setFileSettings(id, key, value) + useLiveEncode().trigger(id) (D-05)
    - animate-pulse shimmer gated on runtimeAtom.encodingFileId === file.id (UI-SPEC §4)
    - URL.createObjectURL + revokeObjectURL cleanup in useEffect for CompareStage images
    - PNG → Quality slider disabled + "(lossless)" label; JPEG → Progressive Switch (UI-SPEC §6)
    - All color via var(--color-*) tokens; no hardcoded hex
key_files:
  created: []
  modified:
    - src/components/panels/inspector/CodecPanel.tsx
    - src/components/panels/inspector/SvgoPanel.tsx
    - src/components/panels/InspectorPane.tsx
    - src/components/panels/center/DeltaStrip.tsx
    - src/components/panels/center/CompareStage.tsx
decisions:
  - Components are presentational — all settings mutation goes through store actions (setFileSettings/applyToAll) per CLAUDE.md "logic in hooks/stores, never inline in components"
  - Live re-encode trigger fired on every control change; debounce lives in useLiveEncode (Plan 03), not the components
  - Closed out manually by the orchestrator: the executor committed all 3 tasks but a transient socket error dropped the run before it wrote SUMMARY.md / updated tracking. No code was lost; this summary documents already-committed work verified against the live tree.
metrics:
  duration: "~10m (executor) + manual close-out"
  completed: "2026-05-26"
  tasks: 3
  files: 5
---

# Phase 09 Plan 04: Inspector + center UI wiring to per-file settings & real bytes Summary

**One-liner:** The existing CodecPanel/SvgoPanel/InspectorPane/DeltaStrip/CompareStage components now read and write the selected file's own `settings`, trigger debounced live re-encode, and render real encoded bytes with shimmer + fallback states — per the locked 09-UI-SPEC contract.

## What Was Built

**Task 1 — CodecPanel + SvgoPanel per-file wiring (commit e967835):**
- Both panels read the selected file's `settings` (via `useStore`), not the global `settingsAtom` (D-03)
- Every control `onChange` calls `setFileSettings(id, key, value)` then `useLiveEncode().trigger(id)` (D-05)
- PNG: Quality slider `disabled` with "(lossless)" label; JPEG: new Progressive `<Switch>` (UI-SPEC §6)
- SvgoPanel: curated plugin toggles write into the file's `settings.plugins`, then trigger re-encode

**Task 2 — InspectorPane context label + Apply-to-all (commit 49b5aa7):**
- Context label shows `{filename}` + "currently editing" when a file is selected, "Global defaults" otherwise (D-03)
- "Apply to all files" button calls `applyToAll()` — the explicit batch trigger (D-02); batch does not re-encode on global-panel keystroke (D-06)

**Task 3 — DeltaStrip + CompareStage real bytes (commit 6a56678):**
- DeltaStrip renders the real `selectedFile.encodedBuffer` size; `animate-pulse` shimmer while `runtimeAtom.encodingFileId === file.id`; `(fallback)` label on per-file error (D-13)
- CompareStage renders real original/encoded `<img>` via `URL.createObjectURL`, with `revokeObjectURL` cleanup in an effect

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — Codec/Svgo panel per-file wiring | e967835 | CodecPanel.tsx, SvgoPanel.tsx |
| 2 — Context label + Apply-to-all | 49b5aa7 | InspectorPane.tsx |
| 3 — DeltaStrip + CompareStage real bytes | 6a56678 | DeltaStrip.tsx, CompareStage.tsx |

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| codec-encoders.spec.ts (Chromium) | 7/7 | PASS |
| per-file-settings.spec.ts (Chromium) | 3/3 | PASS |

All 10 Phase 9 tests pass (exit 0, 2.6m): ENC-01..06, D-13 error path, and D-01/D-02/D-03 per-file settings behavior.

## Deviations from Plan

**Manual close-out (not a code deviation):** The executor committed all 3 tasks atomically (e967835, 49b5aa7, 6a56678) but a transient API socket error terminated the run before it wrote `09-04-SUMMARY.md` and updated STATE/ROADMAP. The orchestrator verified the committed work against the live tree (all 5 target files modified, typecheck clean, no hardcoded hex, 10/10 tests green) and wrote this summary + tracking updates. No code was re-run or lost.

## Known Stubs

None. All components consume real per-file settings and real encoded bytes.

## Threat Surface Scan

No new network endpoints. All changes are presentational/in-memory. Threat mitigations per plan:

| Threat ID | Status |
|-----------|--------|
| T-9-V5 (codec enum / settings integrity) | Mitigated: controls write typed FileSettings keys; codec value flows through the existing KNOWN_CODECS-guarded worker |
| T-9-FB (D-13 error display) | Mitigated: DeltaStrip surfaces (fallback) state; original bytes retained upstream (Plan 03) |
| T-9-PII (object URLs) | Accepted: object URLs are in-memory blobs, revoked on cleanup; zero-server (CLAUDE.md) |

## Self-Check: PASSED

- CodecPanel.tsx: `setFileSettings`, `useLiveEncode`, `lossless`, `progressive` present
- SvgoPanel.tsx: `setFileSettings`, `useLiveEncode`, `trigger` present
- InspectorPane.tsx: `applyToAll`, "Apply to all", "currently editing" present
- DeltaStrip.tsx: `encodedBuffer`, `encodingFileId`, `animate-pulse`, `fallback` present
- CompareStage.tsx: `createObjectURL`, `revokeObjectURL`, `encodedBuffer`, `rawBuffer` present
- No hardcoded hex in any of the 5 components (grep clean)
- `npx tsc --noEmit` clean (0 errors)
- 10/10 Phase 9 Playwright tests pass on Chromium (exit code 0)
- Commits e967835, 49b5aa7, 6a56678 verified in git log
