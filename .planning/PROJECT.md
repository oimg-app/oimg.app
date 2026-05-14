# oimg.app

## What This Is

A 100% client-side, zero-server browser tool for web developers to batch-optimize SVG/PNG/WebP/JPEG/AVIF assets, generate 1×/2×/3× variants, and copy production-ready `<picture>`, `<img srcset>`, CSS `background-image`, and inline SVG snippets. Built with React + Vite + TypeScript, jSquash WASM codecs, and svgo — everything runs in the browser, nothing leaves the machine.

## Core Value

A developer drops a folder of source assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.

## Requirements

### Validated

- ✓ Worker harness (WorkerPool singleton, Comlink, 4 ES-module Web Workers) — Phase 2
- ✓ nanostores state layer (`filesStore`, `settingsStore`, `runtimeStore`) — Phase 2
- ✓ SVG pipeline (svgo v4, DOMPurify sanitization, snippet generation) — Phase 3
- ✓ Decode/resize memory model (jSquash PNG decode, @jsquash/resize, ICC strip) — Phase 4
- ✓ Raster encoders (WebP, JPEG, AVIF, OxiPNG adapters + worker routing) — Phase 5
- ✓ Shadcn UI configured (`radix-lyra` style, phosphor icons, CSS variables, neutral base) — Phase 10

### Active

- [ ] Port example-ui prototype to React + TypeScript + Tailwind + Shadcn UI (full panel set, UI-only milestone)
  - AppShell: resizable 3-pane layout (FilesPane | CenterPane | InspectorPane)
  - TitleBar, Toolbar, StatusBar, CommandPalette (BackpressureIndicator)
  - FilesPane: file list, drag-drop zone, ContextMenu, TargetDensityCheckboxes
  - InspectorPane: tabs — codec panels (JPEG / PNG / WebP / AVIF / SVG / Tweaks), SnippetPanel, ReportPanel
  - All components render from static stub data (workers reconnected in next milestone)
- [ ] Port CSS variables from OIMG.html → Tailwind config (oklch palette locked)
- [ ] Port all CSS classes to Tailwind utility classes — no inline styles, no CSS modules
- [ ] Preserve HTML structure exactly as in example-ui prototype

### Out of Scope

- Worker/store reconnection — deferred to next milestone
- New codec features or settings panels not in example-ui — not in this milestone
- Server-side rendering — non-negotiable, this is a client-side-only app
- IE/legacy browser support — non-negotiable

## Context

**Source of truth:** `example-ui/` directory contains the reference prototype:
- `OIMG.html` (938 lines) — full HTML prototype with design tokens and CSS variables
- `app.jsx` (710 lines) — top-level layout, AppShell, FilesPane, CenterPane
- `panels.jsx` (326 lines) — codec settings panels
- `tweaks-panel.jsx` (425 lines) — tweaks/adjustments panel

**Prior work state:** `src/` was fully deleted in a component refactor (Phase 10 shadcn migration). This milestone rebuilds it from example-ui as the canonical source, not from the deleted files.

**Design tokens (locked — must port verbatim):**
- oklch color palette (from OIMG.html CSS vars)
- Fonts: Inter (UI) + JetBrains Mono (code/snippets)
- Accent: green ~145° oklch
- Dark theme default, light theme supported

**Shadcn config already set:**
- Style: `radix-lyra`, icon library: phosphor, CSS variables: on, baseColor: neutral
- Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`

**Architecture constraints:**
- Business logic in `src/hooks/*` and `src/stores/*` — never inline in components
- Phase/plan attribution headers required on all files
- Circular ESM: `files.ts ↔ runtime.ts ↔ settings.ts` — avoid importing these in the UI-only milestone
- Workers use literal string paths in ADAPTERS map (no template literals)

## Constraints

- **Tech stack**: React 19 + Vite 8 + TypeScript 5.9 — locked
- **UI framework**: Tailwind + Radix UI + Shadcn UI (`radix-lyra`) — this milestone adds Tailwind
- **Structure**: Preserve example-ui HTML structure exactly — no restructuring
- **CSS approach**: Tailwind utility classes only — no CSS modules, no inline styles
- **Privacy**: Zero-server, zero-telemetry — all processing client-side
- **Compatibility**: Modern browsers only (Chrome/Firefox/Safari/Edge last 2 stable)
- **Bundle budget**: Initial route < 200KB gzipped (codecs lazy-loaded)
- **Accessibility**: WCAG AA — keyboard navigation, ARIA, contrast

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tailwind over CSS modules | Shadcn requires Tailwind; CSS modules were deleted in refactor anyway | — Pending |
| UI-only milestone (stub data) | Decouples visual correctness from worker reconnection complexity | — Pending |
| Port from example-ui, not from deleted src/ | example-ui is the approved design reference; deleted src/ had bugs and stubs | — Pending |
| radix-lyra shadcn style | Already configured in components.json; matches oklch design token palette | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after initialization*
