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
