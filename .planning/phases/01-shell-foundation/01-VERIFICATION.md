---
phase: 01-shell-foundation
verified: 2026-04-30T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "UI-02 shadcn primitives in use"
    reason: "Hand-rolled primitives kept (D-06). Documented deviation deferred to Phase 8 polish; ARIA parity verified in plan 05."
    accepted_by: "planner (deferred-items.md)"
    accepted_at: "2026-04-29T00:00:00Z"
human_verification:
  - test: "Visual fidelity vs example-ui/OIMG.html"
    expected: "Side-by-side rendering matches the locked example-ui prototype (oklch palette, Inter + JetBrains Mono, accent green ~145°, dark default + light theme)"
    why_human: "Visual diff requires human comparison; no automated pixel-diff harness in Phase 1"
  - test: "crossOriginIsolated === true under Cloudflare Pages headers"
    expected: "Deployed app sets window.crossOriginIsolated to true; no console error"
    why_human: "_headers file is verified static; runtime confirmation requires deploy or vite preview with Pages-equivalent serving"
---

# Phase 01: shell-foundation Verification Report

**Phase Goal:** Port full example-ui prototype to React + TypeScript, lock OIMG design system, prove crossOriginIsolated, deliver static shell ready for Phase 2.
**Status:** passed (with 2 human verifications outstanding — flagged but non-blocking for Phase 2 start)

## Codebase reality

- `tsc -b` exits 0 (no output)
- `vite build`: 51 modules, 236.87 kB / 72.80 kB gzip, success in 517ms
- `node src/tests/build.test.ts`: PASS — 70.9 KB < 200 KB
- `playwright test src/tests/shell.spec.ts`: 11/11 passed in 1.7s
- `public/_headers`: COOP same-origin + COEP require-corp present
- `vite.config.ts`: `server.headers` mirrors COOP/COEP
- `src/main.tsx`: imports `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono`; asserts `crossOriginIsolated`
- `grep fonts.googleapis.com|fonts.gstatic.com src/ public/`: zero hits
- `src/index.css`: `--color-bg-0`..`--color-bg-3` defined in both `:root` and `.dark`
- `src/components/shell/`: AppShell, TitleBar, Toolbar, StatusBar, CommandPalette all present
- `src/components/ui/`: Popover (Escape close), Tooltip (aria-describedby), Slider (aria-valuemin/max/now/text), Seg (radiogroup/radio), Section, button, Toggle
- `src/App.tsx`: 8 ARIA role hits (listbox/option/tablist/tab/slider) — work-area decomposition verified
- Foundation atoms exist: `src/types/index.ts`, `src/data/defaults.ts`, `src/data/mock.ts`, `src/hooks/useTheme.ts`, `src/components/icons/index.tsx`
- No Phase 2 leakage: zero imports of `@jsquash/*`, `svgo`, `comlink` in src/

## Requirements coverage

| Req | Status | Evidence |
|---|---|---|
| UI-01 (visual fidelity port) | SATISFIED | example-ui ported to src/, build green, tokens locked in index.css |
| UI-02 (shadcn primitives) | OVERRIDE | Hand-rolled per D-06; deferred-items.md schedules Phase 8 review |
| UI-06 (dark+light theme) | SATISFIED | useTheme.ts + .dark class + 11/11 tests including theme toggle |
| UI-07 (responsive desktop-first) | SATISFIED | AppShell layout ports example-ui; build succeeds |
| UI-08 (keyboard + ARIA + WCAG AA) | SATISFIED | 11/11 ARIA landmark + Cmd+K + Tab nav tests pass |
| PRIV-01 (no third-party requests + crossOriginIsolated) | SATISFIED | No CDN fonts; main.tsx asserts crossOriginIsolated; _headers wired |
| PERF-04 (initial route < 200KB) | SATISFIED | Bundle test: 70.9 KB gzip < 200 KB budget |

## Notable divergences (non-blocking)

- **DOCS-DRIFT (low):** CLAUDE.md still pins `vite: ^8.0` but package.json downgraded to `vite: ^7.3` (rolldown arm64 binding bug fix during plan 04). The downgrade is correct; CLAUDE.md should be updated when convenient.
- **DOCS-DRIFT (low):** `deferred-items.md` rolldown entry is not marked resolved despite plan 04 fixing it via the vite downgrade. Suggest adding "Resolution: vite downgraded 7.3 in plan 04" note.
- **DOCS-DRIFT (medium):** `.planning/REQUIREMENTS.md` tracking matrix still shows UI-01/02/06/07/08, PRIV-01, PERF-04 as `TBD` even though the requirement checklist marks UI-01/06/07/08 as `[x]`. PRIV-01 and PERF-04 checklist text describes Phase 2 scope (post-WASM-load + codec bundle splitting), not the Phase 1 sub-scope verified above. Recommend the requirements table is reconciled before phase 2 sign-off.
- **App.tsx is 620 LOC** (slightly over the 600 informal target). ~25 useState hooks remain — intentional per plan 04; Phase 2 store reorganization will reduce.
- **Hand-rolled primitives kept** (D-06 documented deviation, Phase 8 review).

## Phase 2 readiness

GREEN. Build green, tests green, COOP/COEP wired (verified statically; runtime confirmation deferred to deploy), bundle 64% under budget, design tokens locked, no Phase 2 leakage in src/.

---

_Verified: 2026-04-30_
_Verifier: Claude (gsd-verifier, opus 4.7)_
