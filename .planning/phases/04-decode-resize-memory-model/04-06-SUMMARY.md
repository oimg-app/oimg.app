---
phase: 04
plan: 04-06
subsystem: ui-integration
tags: [phase-4, wave-3, ui-components, tweaks-panel, file-row, status-bar, d-05, d-06, d-09, d-10, d-13]
requires:
  - "useSettingsStore.resize.alg + setResize (Plan 04-05)"
  - "useSettingsStore.global.{stripMetadata,preserveIccProfile} (Plan 04-01 + Phase 2 scaffold)"
  - "useFilesStore.byId + setSourceDensity (Plan 04-05)"
  - "useFilesStore.sourceFamilyId + targetDensity (Plan 04-01 schema)"
  - "useRuntimeStore.throttleActive (Plan 04-04)"
  - "UI primitives: Section + Toggle + Seg + Popover (Phase 1)"
  - "Icons.ChevronDown (Phase 1 icon set)"
  - "RESIZE_ALG enum (src/data/defaults.ts)"
provides:
  - "TweaksResizeSection — Algorithm Seg bound to settings.resize.alg"
  - "TweaksPrivacySection — Strip metadata + Preserve ICC toggles with locked helper text"
  - "SourceDensityControl — hover-revealed Popover + Seg trigger for per-row density change"
  - "TargetDensityCheckboxes — 3-checkbox group with locked source-density (dim-accent + aria-disabled)"
  - "BackpressureIndicator — warn-pip Pacing pill subscribed to throttleActive"
  - "StatusBar slot — <BackpressureIndicator /> between worker-pip and SVGO version"
affects:
  - "Plan 04-07 (wiring + UAT) — composes TweaksResizeSection + TweaksPrivacySection into the existing TweaksPanel root; mounts SourceDensityControl + TargetDensityCheckboxes inside the file-row JSX in App.tsx; wires pool.onThrottle → markThrottle and toast latch"
tech-stack-added: []
patterns:
  - "Two named-export sections in TweaksPanel.tsx so 04-07 can import + compose without rebuilding the panel root"
  - "Helper-text style (4px top margin, 11.5px Inter, var(--fg-2), 1.45 line-height) mirrors SvgoPanel.footgunStyle for visual consistency"
  - "TODO(P5) inline comments mark Phase-5 ownership of mid-flight density re-fan-out (CONTEXT.md D-01/D-02 SCOPED amendment)"
  - "Defensive empty-family render in TargetDensityCheckboxes — Phase-4 unreachable but ships the inline error string `Pick at least one density` (UI-SPEC §Surface 2)"
  - "BackpressureIndicator returns null when throttleActive=false (zero DOM, never visibility:hidden) so StatusBar never reserves layout space"
  - "Title attribute as Tooltip surrogate for the locked source-density checkbox — Radix Tooltip provider lands in Plan 04-07 row composition"
key-files-created:
  - src/components/panels/TweaksPanel.tsx
  - src/components/file-row/SourceDensityControl.tsx
  - src/components/file-row/TargetDensityCheckboxes.tsx
  - src/components/shell/BackpressureIndicator.tsx
  - .planning/phases/04-decode-resize-memory-model/04-06-SUMMARY.md
key-files-modified:
  - src/components/shell/StatusBar.tsx
key-decisions:
  - "Phase 4 plan 04-06: TweaksPanel.tsx exports two named section components (TweaksResizeSection + TweaksPrivacySection) instead of a panel root — Plan 04-07 owns the composition root edit. Avoids App.tsx churn in this plan and keeps the components-only scope honest."
  - "Phase 4 plan 04-06: SourceDensityControl uses native onClick toggle for the chevron button + relies on the Popover primitive for Esc + outside-click; no Radix wrapper needed (existing Popover already provides keyboard contract)."
  - "Phase 4 plan 04-06: TargetDensityCheckboxes onToggle is intentionally a no-op (Phase-5 work per CONTEXT.md D-01/D-02 SCOPED) — TODO comment + parameter prefix `_density` to suppress unused-arg lint."
  - "Phase 4 plan 04-06: BackpressureIndicator pip class is `pip warn` (matches StatusBar's existing class convention from Phase 1 status footer)."
metrics:
  duration_minutes: 8
  tasks_completed: 1
  files_changed: 5
  commits: 1
  completed_date: "2026-05-03"
---

# Phase 4 Plan 04-06: UI Integration Summary

Plan 04-06 ships the four user-visible component surfaces required by the
Phase 4 UX without touching App.tsx wiring. The TweaksPanel "Resize / Variants"
+ "Privacy / Metadata" sections are exported as two named components for
Plan 04-07 to compose; the file-row gains hover-revealed source-density +
locked-source target-density controls; and the StatusBar gets a conditional
backpressure pill subscribed to `useRuntimeStore.throttleActive`. All locked
copy from UI-SPEC is rendered verbatim — including the critical D-10
disclosure that the Preserve-ICC toggle is wired-but-inactive in v1.

## What Shipped

### Task 1 — Five UI files (commit `4c5dc1b`)

#### `src/components/panels/TweaksPanel.tsx` (new)

Two named-export section components:

- **`TweaksResizeSection`** — single row inside `<Section title="Resize / Variants">`:
  Algorithm label + 4-option `<Seg>` (Lanczos3 default · Mitchell · Catrom · Triangle).
  Subscribes `useSettingsStore((s) => s.resize.alg)`; writes via
  `useSettingsStore.getState().setResize({ alg: next })`.

- **`TweaksPrivacySection`** — `<Section title="Privacy / Metadata">` with two
  toggle rows:
  1. `Strip metadata` (default ON) bound to `global.stripMetadata` via `setGlobal`.
  2. `Preserve ICC color profiles` (default OFF) bound to `global.preserveIccProfile`
     via `setGlobal`.

  Helper text below the Preserve-ICC toggle is the LOCKED verbatim copy from
  UI-SPEC §Surface 9:

  > Wired but inactive in this version. Color profiles are stripped along
  > with all metadata. ICC preservation ships in v1.1 once raster encoders
  > integrate.

  Always visible (no aria-expanded, no `<details>`); style matches
  SvgoPanel.tsx `footgunStyle` for visual consistency.

#### `src/components/file-row/SourceDensityControl.tsx` (new)

Hover/focus-revealed icon button + Popover + Seg trigger.

- Reads the file's `sourceDensity` via `useFilesStore((s) => s.byId[fileId]?.sourceDensity)`.
- Button has `aria-label="Change source density (currently {density})"` +
  `aria-haspopup="menu"` + `aria-expanded` (UI-SPEC §Surface 1).
- Popover anchored bottom-right; renders `<Seg<SourceDensity>>` with options
  `'1x' | '2x' | '3x'`.
- On select: closes popover and calls `useFilesStore.getState().setSourceDensity(fileId, next)`.
- Inline `// TODO(P5): re-fan-out variants when sourceDensity changes mid-batch` —
  marks Phase-5 ownership per CONTEXT.md D-01/D-02 SCOPED amendment.

#### `src/components/file-row/TargetDensityCheckboxes.tsx` (new)

Three checkboxes (`1x` · `2x` · `3x`) bound to a sourceFamilyId.

- Reads all variants whose `sourceFamilyId === prop` from `useFilesStore.byId`.
- Each box has `role="checkbox"` + `aria-checked` reflecting whether a variant
  with that `targetDensity` exists in the family.
- The variant whose `targetDensity === sourceDensity` is LOCKED:
  - `aria-disabled="true"`
  - `tabIndex={-1}` (skipped in keyboard nav)
  - dim-accent fill (`var(--accent-dim)`) instead of solid `var(--accent)`
  - `title` attribute reading `Source density ({Nx}) — included automatically`
    (Radix Tooltip lands in Plan 04-07).
- Toggle handler is a NO-OP in Phase 4 (TODO P5 inline comment).
- Defensive empty-family branch renders the locked inline error
  `Pick at least one density` (UI-SPEC §Surface 2).

#### `src/components/shell/BackpressureIndicator.tsx` (new)

Verbatim from PATTERNS.md lines 591-608:

- Returns `null` when `throttleActive === false` (zero DOM, never `visibility:hidden`).
- When active, renders `<span class="item">` with a `<span className="pip warn" />`
  + the locked text `Pacing`.
- `aria-label` is the locked verbatim string from UI-SPEC §Surface 6:
  > Memory pacing active — admission gate is throttling new jobs

  (drift = blocker per threat T-04-06-01).

#### `src/components/shell/StatusBar.tsx` (modified)

Two surgical edits:

1. New import at top: `import { BackpressureIndicator } from './BackpressureIndicator'`.
2. `<BackpressureIndicator />` inserted as the SECOND status item — between the
   worker-pip span and the SVGO 4.0.1 item. Existing prop signature unchanged.

## Verbatim-Copy Audit (Threat T-04-06-01 + T-04-06-02 mitigation)

All grep checks against the locked UI-SPEC strings passed:

| Locked string | File | Result |
|---|---|---|
| `Resize / Variants` | TweaksPanel.tsx | 3 matches (header copy + comments) |
| `Privacy / Metadata` | TweaksPanel.tsx | 3 matches (header copy + comments) |
| `Wired but inactive in this version` | TweaksPanel.tsx | 1 match (verbatim) |
| `v1.1 once raster encoders integrate` | TweaksPanel.tsx | 1 match (verbatim) |
| `Memory pacing active` | BackpressureIndicator.tsx | 1 match (verbatim aria-label) |
| `BackpressureIndicator` import + JSX | StatusBar.tsx | 2 matches |
| `useFilesStore` / `useSettingsStore` | SourceDensityControl.tsx | 4 matches |
| `aria-disabled` | TargetDensityCheckboxes.tsx | 3 matches (1 attr + 2 docs) |
| `throttleActive` | BackpressureIndicator.tsx | 2 matches (1 selector + 1 comment) |

The Preserve-ICC helper text is the SOLE disclosure preventing the UI from
lying about the worker no-op (D-10 amendment, threat T-04-06-02). Verbatim
preservation is the rendered defense; the grep check is the structural
defense; visual UAT in Plan 04-07 is the human defense.

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | exit 0; 482.55 kB / 155.67 kB gzip (under budget) |
| `npm test` (full Playwright suite) | 47/47 passed |
| File existence: 4 new + 1 modified | all 5 present |
| Locked-copy grep audit (9 items) | all 9 passed |

No regression in Phase 1 + 2 + 3 + Phase-4-Wave-2 specs. raster.spec.ts tests
that already flipped to live (#1 density variants, #6 collision rename,
removeFamily cascade, settings resize slice) all green.

## Deviations from Plan

None — plan executed exactly as written. The plan body's ambiguity ("create
TweaksPanel.tsx if it does not exist") was resolved by creating the file and
exporting two named section components per the plan's literal action; the
panel composition root remains untouched (Plan 04-07's job).

The CodecPanel.tsx already has its own Resize + Metadata sections from
Phase 1; the new TweaksPanel sections are independent surfaces — Plan 04-07
will decide composition order (per UI-SPEC §Surface 4: section position is
"second in the panel ordering, before any per-codec parameters").

## Threat Surface Verification (against plan threat_model)

| Threat | Disposition | Verified |
|---|---|---|
| T-04-06-01 (UI copy diverges from locked UI-SPEC strings) | mitigate | All 9 acceptance greps passed; locked copy rendered verbatim including `v1.1` substring + `Memory pacing active`. |
| T-04-06-02 (UI shows ICC toggle ON but worker stripped — user thinks ICC was preserved) | mitigate | Helper text rendered always-visible (no `aria-expanded`, no `<details>`); style matches SvgoPanel footgun copy block; verbatim grep enforces. Visual UAT in Plan 04-07 is the human double-check. |
| T-04-06-03 (File-row controls mutate sourceDensity mid-flight without regenerating variants) | accept | Two TODO(P5) inline comments in SourceDensityControl.tsx (line 49) and TargetDensityCheckboxes.tsx (line 65) reference CONTEXT.md D-01/D-02 SCOPED amendment. Initial-drop fan-out (Plan 04-05) is fully wired; mid-flight is a no-op; user experience is acceptable for v1. |

No new threat-relevant surface introduced. No new network endpoints. No new
file-access patterns. No schema changes (FileEntry.{sourceDensity,targetDensity,
sourceFamilyId} were already shipped by Plan 04-01 + Plan 04-05). No new auth
paths. The popover trigger is a presentational mutation surface only — store
input is bounded by the `SourceDensity` enum at the type boundary
(threat_model §Trust Boundaries).

## Closure Hooks for Plan 04-07

| Surface | What 04-07 must do |
|---|---|
| `TweaksResizeSection` | Compose into the TweaksPanel composition root (currently App.tsx renders `<CodecPanel>` + `<SvgoPanel>` directly; 04-07 picks the composition shape — extend CodecPanel, build a new TweaksPanel root, or render alongside in App.tsx). Position: second section per UI-SPEC §Surface 4. |
| `TweaksPrivacySection` | Same — render after `TweaksResizeSection`. Already binds to `useSettingsStore.global` via `setGlobal`; no further wiring needed. |
| `SourceDensityControl` | Mount inside each file-row JSX (App.tsx lines 710-808 file-row block) at the right edge of the stat line. Pass `fileId={f.id}`. Add CSS for hover/focus-reveal on the parent row (existing iconbtn pattern). |
| `TargetDensityCheckboxes` | Mount inside each file-row stat line (one per family — group by `sourceFamilyId`). Pass `sourceFamilyId={f.sourceFamilyId}`. Renders for variant rows; defensive empty-family branch is unreachable from production paths. |
| `BackpressureIndicator` | Already wired via the StatusBar slot — no further composition work. Plan 04-07 must wire `pool.onThrottle` → `useRuntimeStore.getState().markThrottle()` in the App.tsx pool-callback `useMemo` so the pill actually appears. Toast wiring (`toast.info('Pacing batch for memory', { description: ... })`) sits next to the `markThrottle` call, gated on the latch transition. |

## Self-Check: PASSED

- Files created exist:
  - `src/components/panels/TweaksPanel.tsx` FOUND
  - `src/components/file-row/SourceDensityControl.tsx` FOUND
  - `src/components/file-row/TargetDensityCheckboxes.tsx` FOUND
  - `src/components/shell/BackpressureIndicator.tsx` FOUND
  - `.planning/phases/04-decode-resize-memory-model/04-06-SUMMARY.md` FOUND (this file)
- Files modified exist:
  - `src/components/shell/StatusBar.tsx` FOUND (BackpressureIndicator import + JSX present)
- Commits exist:
  - `4c5dc1b` FOUND (Task 1: TweaksPanel sections + file-row controls + backpressure pill + StatusBar slot)
- Build + tests:
  - `npx tsc --noEmit` clean
  - `npm run build` exit 0
  - `npm test` 47/47 passed
