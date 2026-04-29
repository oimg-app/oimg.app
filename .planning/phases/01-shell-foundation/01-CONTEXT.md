# Phase 1: Shell + Foundation - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Port the full `example-ui/` prototype (all 5 source files, ~2500 LOC) to React + TypeScript + shadcn/ui, pixel-faithful to the example-ui visual contract. Establish COOP/COEP security headers so `crossOriginIsolated === true` is provable on day 1. Self-host fonts via fontsource. The result is a running Vite app with the complete OIMG design system and security foundation locked — no codec work, no file processing.

</domain>

<decisions>
## Implementation Decisions

### COOP/COEP Headers
- **D-01:** Serve `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` via a Cloudflare Pages `public/_headers` file — single source of truth for production.
- **D-02:** Mirror the same headers in `vite.config.ts` `server.headers` for local dev. Both environments must satisfy `crossOriginIsolated === true`.
- **D-03:** `crossOriginIsolated === true` is a Phase 1 success criterion — non-negotiable, not deferred to Phase 2.

### Font Self-Hosting
- **D-04:** Install `@fontsource/inter` and `@fontsource/jetbrains-mono` from npm. Import variable font cuts in `src/main.tsx`. No Google Fonts CDN — COEP-incompatible.
- **D-05:** Variable fonts only (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`) — one file covers all weights, WOFF2-compressed.

### Component Porting Scope
- **D-06:** Full `example-ui/` port in Phase 1 — all source files: `app.jsx`, `panels.jsx`, `tweaks-panel.jsx`, `icons.jsx`, `data.jsx`. Every component migrated to TypeScript + shadcn primitives.
- **D-07:** Pixel-faithful to `example-ui/OIMG.html` visual contract — exact spacing, radius, color tokens, typography. Any deviation from the visual contract must be deliberate and documented.

### Theme Toggle
- **D-08:** `.dark` class toggled on `<html>` element — Tailwind v4 standard. Matches shadcn/ui and example-ui expectations.
- **D-09:** Theme toggle lives in the header, top-right position (sun/moon icon button). Preference persisted to `localStorage`.

### Claude's Discretion
- Implementation order for porting individual components (icons → layout → panels → tweaks panel — or whatever order minimizes blocked dependencies)
- Exact shadcn primitives used to implement accordion, popover, tooltip within example-ui/ components
- TypeScript interface shapes for component props

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Contract (Primary Source of Truth)
- `example-ui/OIMG.html` — Complete standalone prototype. Design tokens (oklch palette, radii, spacing), component shapes, layout structure, dark/light theme CSS. **Read this first.**
- `example-ui/app.jsx` — App-level layout, routing structure, top-level component composition
- `example-ui/panels.jsx` — File list panel, detail panel, all panel components
- `example-ui/tweaks-panel.jsx` — Settings accordion, codec controls, format-specific UI
- `example-ui/icons.jsx` — Icon system (all SVG icons used in the UI)
- `example-ui/data.jsx` — Static data structures, default codec configs, format definitions

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, design token decisions (locked)
- `.planning/REQUIREMENTS.md` — v1 requirements; Phase 1 covers UI-01, UI-02, UI-06, UI-07, UI-08, PRIV-01, PERF-04

### Security Reference
- Cloudflare Pages `_headers` docs — COOP/COEP header syntax for `public/_headers` file

### Design System
- `src/index.css` — OIMG design tokens already ported (oklch palette, Inter + JBMono, accent green ~145°)
- `components.json` — shadcn/ui wiring (style: base-nova, Tailwind v4, @/ aliases)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/index.css`: OIMG design tokens already defined (oklch palette, CSS variables, dark/light theme structure). Planner should extend this, not replace it.
- `src/components/ui/button.tsx`: shadcn Button — confirms `@/components` alias works, Tailwind v4 compiles correctly. Use as reference for adding more shadcn components.
- `components.json`: shadcn config is wired to `src/index.css` and `@/ aliases` — `npx shadcn@latest add <component>` should work without reconfiguration.

### Established Patterns
- Tailwind v4 with `@theme {}` blocks in CSS (no tailwind.config.js) — all token extensions go in `src/index.css`
- shadcn `base-nova` style selected — matches example-ui visual language better than default
- `lucide-react` for icons (already in components.json) — but example-ui has custom SVG icons; may need both

### Integration Points
- `src/main.tsx` — font imports (fontsource) go here
- `vite.config.ts` — `server.headers` for dev COOP/COEP; also configure `@/` path alias if not already present
- `public/_headers` — Cloudflare Pages production headers file (create this)

</code_context>

<specifics>
## Specific Ideas

- The `example-ui/` prototype renders correctly in browser via script tags — use it as a live reference during porting to catch visual regressions immediately
- Phase 1 success criteria from ROADMAP.md are the acceptance tests: `npm run dev` shows dark/light theme matching prototype; DevTools shows COOP/COEP headers; `crossOriginIsolated === true` in Chrome + Firefox + Safari; shadcn components (slider, checkbox, accordion) render with correct tokens; keyboard navigation works on landmark regions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Shell + Foundation*
*Context gathered: 2026-04-29*
