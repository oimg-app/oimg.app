---
phase: 01-shell-foundation
plan: 05
subsystem: ui
tags: [aria, work-area, primitives-audit, playwright, visual-checkpoint]

# Dependency graph
requires:
  - phase: 01-shell-foundation
    provides: shell tree (AppShell + TitleBar + Toolbar + StatusBar + CommandPalette) from 01-04
  - phase: 01-shell-foundation
    provides: foundation atoms ratified by 01-03
provides:
  - work-area-aria (queue listbox, inspector tablist, compare slider)
  - hand-rolled-primitive-aria (role=switch, role=radiogroup/radio, aria-value*, Escape handlers)
  - extended-shell-spec (11 Playwright tests covering UI-01/06/07/08)
  - shadcn-migration-deferred-record (Phase 8 polish item logged)
affects:
  - Phase 2+ codec pipeline — App.tsx state surface and ARIA contract are now stable
  - Future ui/ primitives — audit baseline established; Phase 8 will migrate to shadcn

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Work-area ARIA: queue rendered as role=listbox with role=option rows; inspector tabs as role=tablist with role=tab + aria-selected + aria-controls; compare split handle as role=slider with aria-valuemin/max/now"
    - "Primitive ARIA tightening without API change — Toggle gains role=switch + aria-checked, Seg gains role=radiogroup/role=radio, Slider gains aria-valuemin/max/now/text, Popover gains Escape close, Tooltip gains aria-describedby wiring"
    - "Playwright interaction tests use getByRole + page.keyboard rather than CSS selectors — survives className changes"

key-files:
  modified:
    - src/App.tsx
    - src/components/ui/Slider.tsx
    - src/components/ui/Seg.tsx
    - src/components/ui/Popover.tsx
    - src/components/ui/Tooltip.tsx
    - src/tests/shell.spec.ts
    - .planning/phases/01-shell-foundation/deferred-items.md

key-decisions:
  - "Hand-rolled primitives accepted as Phase-1 deviation per the planner divergence briefing — replacing all six with shadcn now would risk D-07 visual regression for zero behavioral gain. shadcn migration logged as Phase 8 polish item."
  - "Toggle component absent from src/components/ui/ — its switch role is added inline at App.tsx call sites. Documented so a future shadcn Switch port has a clear migration target."
  - "Visual checkpoint passed by user — D-07 pixel-fidelity confirmed against example-ui/OIMG.html, theme round-trip works, keyboard nav cycles, no third-party network requests, COOP/COEP headers + crossOriginIsolated === true verified live."

requirements-completed: [UI-01, UI-06, UI-07, UI-08]

# Metrics
duration: ~15min
completed: 2026-04-30
---

# Phase 01 Plan 05: Work-Area ARIA + Primitives Audit + Visual Checkpoint Summary

**Tightened work-area and hand-rolled primitive ARIA so the entire static shell satisfies UI-01/06/07/08 in real Chromium; extended shell.spec.ts from 6 → 11 passing tests; user signed off on the D-07 visual checkpoint against example-ui/OIMG.html.**

## Performance

- **Duration:** ~15 min (3 autonomous tasks + human checkpoint turnaround)
- **Tasks:** 3 autonomous + 1 checkpoint
- **Files modified:** 7

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Add ARIA roles to work-area JSX | `1c4474f` |
| 2 | Audit hand-rolled primitives + log shadcn deferral | `6499c8b` |
| 3 | Extend shell.spec.ts to 11 interaction tests | `948d38c` |
| 4 | Human visual checkpoint | (no commit — user-approved) |

## Verification

- `./node_modules/.bin/tsc -b` — exits 0
- `./node_modules/.bin/vite build` — exits 0; `index-Cgv1O8re.js` 236.87 KB raw / 72.80 KB gzip
- `node --experimental-strip-types src/tests/build.test.ts` — `[bundle-size] PASS: 70.9 KB < 200 KB`
- `npx playwright test src/tests/shell.spec.ts` — **11 passed** (6 landmark + 5 interaction)
- `dist/_headers` contains `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`
- All grep acceptance criteria for Tasks 1, 2, 3 succeed

## Visual Checkpoint Result (User-Approved)

User confirmed all 5 manual checks PASS:
1. **Visual fidelity (D-07):** running app pixel-faithful to example-ui/OIMG.html
2. **Theme toggle:** round-trip works, preference persists across reload
3. **Keyboard navigation:** Tab cycles with focus rings; Cmd+K palette + autoFocus + filter + Arrow/Enter + Escape all work; `/` jumps to filter
4. **Network privacy (PRIV-01):** zero third-party font requests
5. **Headers + crossOriginIsolated (PRIV-01):** COOP `same-origin` + COEP `require-corp` present; `crossOriginIsolated === true`

## Decisions Made

- **Hand-rolled primitives stay** — replacing Popover/Tooltip/Slider/Toggle/Seg/Section with shadcn now would risk D-07 visual regression. ARIA gaps are filled in-place. shadcn migration logged in `deferred-items.md` as a Phase 8 polish item.
- **Toggle ARIA inline** — no `Toggle` component file exists in `src/components/ui/`; the role=switch + aria-checked attributes are applied at the App.tsx call sites. A future shadcn Switch port replaces these inline attributes with a typed component.

## Deviations from Plan

None — autonomous tasks executed as written. Visual checkpoint approved by user without remediation.

## Threat Surface Scan

No new trust boundaries, no new network endpoints, no new persistence keys. ARIA additions are presentation-only.

## Known Stubs

- `OutputPanel.tsx` and `ReportPanel.tsx` remain Phase-5/6 placeholders (per their plan annotations) — out of scope for Phase 1.
- shadcn primitive migration — logged in `deferred-items.md` for Phase 8.

## Next Phase Readiness

Phase 1 success criteria from ROADMAP.md all green:
- `npm run dev` shows dark/light theme matching prototype ✓
- DevTools shows COOP + COEP response headers ✓
- `crossOriginIsolated === true` in Chromium ✓
- shadcn-equivalent components render correctly (hand-rolled, accepted deviation) ✓
- Keyboard navigation works on landmark regions ✓
- 11/11 Playwright tests pass ✓
- Bundle 70.9 KB < 200 KB budget ✓

Phase 2 (codec pipeline + worker harness) is unblocked.

## Self-Check: PASSED

- All 7 modified files exist on disk and contain the expected ARIA / docstrings / test additions
- All 3 autonomous task commits found in git log
- Human visual checkpoint approved by user
- Phase 1 ROADMAP success criteria all confirmed

---
*Phase: 01-shell-foundation*
*Completed: 2026-04-30*
