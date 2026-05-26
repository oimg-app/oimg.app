# oimg.app

## What This Is

A 100% client-side, zero-server browser tool for web developers to batch-optimize SVG/PNG/WebP/JPEG/AVIF assets, generate 1×/2×/3× variants, and copy production-ready `<picture>`, `<img srcset>`, CSS `background-image`, and inline SVG snippets. Built with React + Vite + TypeScript, jSquash WASM codecs, and svgo — everything runs in the browser, nothing leaves the machine.

## Core Value

A developer drops a folder of source assets, adjusts settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.

## Current Milestone: v1.1 Real Optimization Pipeline

**Goal:** Reconnect the full codec pipeline behind the v1.0 UI so a developer can drop assets, adjust settings, and walk away with real optimized files + ZIP + paste-ready snippets — all client-side.

**Target features:**
- Full jSquash worker pipeline — WebP, JPEG (MozJPEG), AVIF (lazy-loaded), OxiPNG, SVG (svgo v4)
- Single-file optimize + download (drop → adjust → real output)
- Batch ZIP export (jszip)
- Real paste-ready snippets — Output panel wired to actual encoded bytes

**Deferred:** 1×/2×/3× density variants (future milestone).

## Requirements

### Validated

- ✓ Worker harness (WorkerPool singleton, Comlink, 4 ES-module Web Workers) — Phase 2
- ✓ nanostores state layer (`filesStore`, `settingsStore`, `runtimeStore`) — Phase 2
- ✓ SVG pipeline (svgo v4, DOMPurify sanitization, snippet generation) — Phase 3
- ✓ Decode/resize memory model (jSquash PNG decode, @jsquash/resize, ICC strip) — Phase 4
- ✓ Raster encoders (WebP, JPEG, AVIF, OxiPNG adapters + worker routing) — Phase 5
- ✓ Shadcn UI configured (`radix-lyra` style, phosphor icons, CSS variables, neutral base) — Phase 10
- ✓ example-ui prototype ported to React + TS + Tailwind + Radix — full 3-pane AppShell, TitleBar/Toolbar/StatusBar/CommandPalette, FilesPane, InspectorPane (codec + SVGO + Output + Report), CenterPane — v1.0
- ✓ oklch design tokens + fonts ported verbatim from OIMG.html, Tailwind v4 @theme — v1.0
- ✓ WCAG AA keyboard nav (DropdownMenu menus, focus rings), theme toggle w/ no FOUC — v1.0
- ✓ Worker pipeline foundation — bounded Comlink WorkerPool (`getPool()`, cap min(hwConc,4)), codecs dynamic-imported inside the worker, COOP/COEP isolation, real backpressure via `runtimeAtom`; PNG→OxiPNG is the one real path (other codecs stubbed for Phase 9). Initial route 144KB gzip < 200KB. — Phase 8

### Active (v1.1)

- [ ] Worker pipeline: WorkerPool + Comlink, codecs dynamic-imported inside workers (WebP/JPEG/AVIF/OxiPNG/SVG)
- [ ] Single-file optimize: drop → decode → encode → real optimized output, wired to runtime store
- [ ] Settings actually drive encoding (quality/effort/lossless/resize/metadata per codec)
- [ ] Batch ZIP export via jszip
- [ ] Output panel snippets wired to real encoded bytes (Base64 / URL-encoded / `<picture>`)
- [x] COOP/COEP headers for SharedArrayBuffer (MT codecs) — Phase 8

Deferred to a future milestone:
- 1×/2×/3× density variants (@jsquash/resize)
- v1.0 tech debt: phase verification, duplicate `banner` landmarks (WCAG)

### Out of Scope

- New codec features or settings panels not in example-ui — not in v1.0
- Server-side rendering — non-negotiable, this is a client-side-only app
- IE/legacy browser support — non-negotiable

## Context

**Current state (after v1.0, 2026-05-25):** UI Port shipped as Executed — 7 phases, 22 plans, ~379 commits over 27 days. Full React + TS + Tailwind + Radix component tree renders from Zustand stores against static stub data. Workers/stores not yet reconnected (next-milestone work). Formal phase verification was skipped at close (accepted as tech debt — see MILESTONES.md Known Gaps / STATE.md Deferred Items).

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
*Last updated: 2026-05-26 after Phase 8 (Worker Pipeline Foundation) complete*
