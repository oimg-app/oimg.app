---
phase: 05-center-pane
plan: 02
subsystem: center-pane
tags: [ui, delta-strip, metrics, nanostores]
dependency_graph:
  requires: [05-01, stores/files, stores/settings, lib/format]
  provides: [DeltaStrip component, wired CenterPane]
  affects: [src/components/panels/center/DeltaStrip.tsx, src/components/panels/CenterPane.tsx]
tech_stack:
  added: []
  patterns: [nanostores useStore, DeltaCard internal component, flex metric strip]
key_files:
  created:
    - src/components/panels/center/DeltaStrip.tsx
  modified:
    - src/components/panels/CenterPane.tsx
decisions:
  - Used U+2212 MINUS SIGN in saved value string literal per plan spec
  - fmtPct returns em-dash when null — guarded to avoid rendering "em-dash smaller" in empty state
metrics:
  duration: "~5 minutes"
  completed: "2026-05-21"
  tasks: 2
  files: 2
---

# Phase 05 Plan 02: DeltaStrip 6 metric cards wired to live store state

**One-liner:** DeltaStrip renders 6 horizontal metric cards (Original, Optimized, Saved, SSIM, Butteraugli, Decode) reading live values from $selectedFile and settingsAtom, accent-colored savings, zero TypeScript errors.

## What Was Built

**Task 1 — DeltaStrip.tsx (new)**

Created `src/components/panels/center/DeltaStrip.tsx` with:
- `DeltaCard` internal component accepting `label`, `value` (ReactNode), `sub`, `accent?` props
- Root `h-[72px] shrink-0` flex container matching the Layout Contract
- 6 metric cards in horizontal row, each `flex-1 border-r last:border-r-0`
- Original card: live `fmtBytes(orig)` + `${dim} · ${type}` from `$selectedFile`
- Optimized card: live `fmtBytes(opt)` + `${codec} q${q} m${method}` from `settingsAtom`
- Saved card: computed savings with U+2212 prefix, `fmtPct` percentage, `accent={true}`
- SSIM / Butteraugli / Decode: hardcoded stub values
- Empty state (null selectedFile): all variable values show em-dash
- No useState — all data via `useStore($selectedFile)` and `useStore(settingsAtom)`

**Task 2 — CenterPane.tsx (updated)**

- Added `import { DeltaStrip } from './center/DeltaStrip'`
- Replaced placeholder div (containing "DeltaStrip — Plan 05-02") with `<DeltaStrip />`
- Updated phase attribution comment to include CENTER-04

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| 1. TypeScript 0 errors | `npx tsc --noEmit \| grep -c "error TS"` | 0 |
| 2. No useState | `grep -n "useState" DeltaStrip.tsx` | PASS (no matches) |
| 3. DeltaStrip in CenterPane | `grep "DeltaStrip" CenterPane.tsx` | import + JSX usage found |
| 4. Placeholder removed | `grep "DeltaStrip — Plan 05-02" CenterPane.tsx` | PASS (no matches) |
| 5. Card count >= 6 | `grep -c "DeltaCard\|flex-1.*border-r" DeltaStrip.tsx` | 9 |
| 6. Accent class present | `grep "color-accent" DeltaStrip.tsx` | FOUND |

TypeScript error count: **0**

## Commits

| Hash | Message |
|------|---------|
| 5929140 | feat(05-02): DeltaStrip 6 metric cards, wire into CenterPane |

## Deviations from Plan

None — plan executed exactly as written.

One implementation note: `fmtPct` returns an em-dash when inputs are null (per `format.ts` implementation). The Saved card sub-text guard prevents rendering "em-dash smaller" in the empty state. This matches the specified empty-state behavior.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| SSIM value "0.987" | DeltaStrip.tsx | Real SSIM computation deferred to future codec integration phase |
| Butteraugli value "1.24" | DeltaStrip.tsx | Real Butteraugli computation deferred to future codec integration phase |
| Decode value "38ms" | DeltaStrip.tsx | Estimated decode time — real measurement deferred |

These stubs are intentional per plan spec.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All values rendered as React text nodes via JSX expressions. Matches threat model T-05-04 (mitigated by design).

## Self-Check: PASSED

- [x] `src/components/panels/center/DeltaStrip.tsx` exists
- [x] `src/components/panels/CenterPane.tsx` modified
- [x] Commit 5929140 exists in git log
