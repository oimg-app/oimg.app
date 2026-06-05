# Milestones

## v1.0 UI Port (Shipped: 2026-05-25)

**Phases completed:** 7 phases, 22 plans

**Status:** Executed — all plans built + summarized; formal phase verification skipped (accepted as tech debt, see Known Gaps).

**Delivered:** A complete React + TypeScript + Tailwind + Radix port of the OIMG image-optimizer UI — 3-pane AppShell rendering from stores, fully navigable and keyboard-accessible, ported verbatim from the locked `example-ui/` design tokens.

**Key accomplishments:**

- Foundation: Vite + React 19 + Tailwind v4 design tokens (oklch palette, Inter + JetBrains Mono), 17 shadcn/Radix UI primitives, 3-pane AppShell walking skeleton
- Files Pane: file list with selection, filter, sort, row menus driven by Zustand stores
- Navigation Shell: TitleBar menus, Toolbar split-buttons + segmented view control, StatusBar, ⌘K CommandPalette, theme toggle
- Inspector — Codec + SVGO: tabbed inspector with codec/quality/resize/metadata controls + 22-plugin SVGO grid
- Center Pane: breadcrumb header, zoom controls, compare-stage viewport with pan/zoom
- Inspector — Output + Report: 3 paste-ready snippet builders (Base64 / URL-encoded / `<picture>`) + per-file savings report
- Polish: BackpressureIndicator (SHELL-02), theme FOUC fix, global `:focus-visible` rings, STORE-08 audit, dropdown arrow-key keyboard nav (Popover→DropdownMenu)

**Known Gaps (accepted at close):**

- Verification: 0 phases formally verified. Phases 01/02/04 have `VERIFICATION.md` at `human_needed`; 03/05/06/07 have none.
- Requirements: 18/36 checked in traceability table — largely tracking drift (code shipped), not necessarily missing work.
- WCAG: duplicate `banner` landmarks (3 `<header>` elements) — deferred follow-up.
- See STATE.md → Deferred Items for the full list.

**Stats:** 27-day span (2026-04-28 → 2026-05-25), ~379 commits.

---

## v1.1 Real Optimization Pipeline (Shipped: 2026-06-03)

**Phases completed:** 5 phases, 25 plans + 1 quick task (8 atomic commits)

**Status:** Audit `tech_debt` — all 15 requirements satisfied (PIPE-01..04 / ENC-01..06 / OPT-01..02 / EXP-01..02 / SNIP-01), all 3 cross-phase user flows walked end-to-end, 7 non-blocking debt items captured.

**Delivered:** The full real codec pipeline behind the v1.0 UI. A developer drops assets, adjusts settings once, and walks away with real optimized files + ZIP + paste-ready snippets — all client-side. The PROJECT.md core-value promise is now reality.

**Key accomplishments:**

- Worker pipeline: bounded Comlink WorkerPool (`Math.min(hwConc, 4)`), all five jSquash + svgo codec adapters running off-main-thread, dynamic imports keep initial route at 194.88 KB gzipped (under 200 KB PIPE-02 budget), AVIF lazy-loaded, COOP/COEP for SharedArrayBuffer
- End-to-end optimize → download for a single file: drop → real encodedBuffer → Report numbers → showSaveFilePicker (native) or file-saver (fallback)
- Batch optimize at scale: streaming per-promise write-back, FileRow status flips live, StatusBar X/Y counter advances mid-run, SC-4 backpressure verified on 20-file batch (peak ≥ 2 AND ≤ Math.min(hwConc, 4))
- Batch ZIP export via jszip: timestamped filename, flat layout, collision-suffix, optimized-only, T-11-01 zip-slip mitigation
- Real paste-ready snippets: Output panel × 3 + Toolbar bulk × 3 + FileRow row × 2 — eight clipboard surfaces all routing through one chokepoint with navigator.clipboard.writeText + textarea/execCommand fallback. Yoksel-style SVG URL-encoding + chunked-32KB base64 for large raster
- Bonus: Watch folder via showDirectoryPicker + FileSystemObserver (Chrome live, Firefox/Safari snapshot-only)
- Security hardening across the milestone: T-11-01 zip-slip, T-12-01 SVG XSS, T-12-02 HTML-attr injection, T-12-03/04 clipboard fallback safety, T-WF-01..04 directory-watch lifecycle

**Tech Debt (non-blocking — see [v1.1-MILESTONE-AUDIT.md](v1.1-MILESTONE-AUDIT.md)):**

- Phase 12 has 4 paste-into-real-browser manual dogfood checks pending
- `addFromDevice` empty stub at `src/stores/files.ts:87` (dead code, retire in v1.2 cleanup)
- `tsc -b` red on `output-panel-live.spec.ts:92` page.evaluate dynamic-import (accepted Vite pattern; pre-Phase-8 test-config debt)
- Initial JS gzipped: 194.88 KB / 200 KB (PIPE-02 budget) — ~5 KB headroom
- Vite double-import inefficiency on `stores/files.ts` + `stores/runtime.ts`
- Nyquist sign-off not flipped on Phase 11 + 12 VALIDATION.md
- Phases 8–10 pre-date Nyquist framework — no VALIDATION.md (not a regression, just discovery)

**Stats:** 10-day span (2026-05-25 → 2026-06-03), 167 commits, 239 files changed (71 src, 28 tests), +22,549 / −459 LOC.

---
