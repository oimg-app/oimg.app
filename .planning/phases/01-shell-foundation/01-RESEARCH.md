# Phase 1: Shell + Foundation - Research

**Researched:** 2026-04-29
**Domain:** Vite + React 19 + TypeScript shell, Tailwind v4, shadcn/ui, COOP/COEP headers, fontsource variable fonts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Serve `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` via a Cloudflare Pages `public/_headers` file — single source of truth for production.
- **D-02:** Mirror the same headers in `vite.config.ts` `server.headers` for local dev. Both environments must satisfy `crossOriginIsolated === true`.
- **D-03:** `crossOriginIsolated === true` is a Phase 1 success criterion — non-negotiable, not deferred to Phase 2.
- **D-04:** Install `@fontsource/inter` and `@fontsource/jetbrains-mono` from npm. Import variable font cuts in `src/main.tsx`. No Google Fonts CDN — COEP-incompatible.
- **D-05:** Variable fonts only (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`) — one file covers all weights, WOFF2-compressed.
- **D-06:** Full `example-ui/` port in Phase 1 — all source files: `app.jsx`, `panels.jsx`, `tweaks-panel.jsx`, `icons.jsx`, `data.jsx`. Every component migrated to TypeScript + shadcn primitives.
- **D-07:** Pixel-faithful to `example-ui/OIMG.html` visual contract — exact spacing, radius, color tokens, typography. Any deviation must be deliberate and documented.
- **D-08:** `.dark` class toggled on `<html>` element — Tailwind v4 standard.
- **D-09:** Theme toggle lives in the header, top-right position (sun/moon icon button). Preference persisted to `localStorage`.

### Claude's Discretion
- Implementation order for porting individual components
- Exact shadcn primitives used to implement accordion, popover, tooltip
- TypeScript interface shapes for component props

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Port `example-ui/` to Vite + TypeScript — preserve layout, components, design tokens, theme system | Component porting strategy documented; existing tokens in `src/index.css` already match prototype |
| UI-02 | Use shadcn/ui components (sliders, checkboxes, etc.) adapted from `example-ui/` visual language | shadcn/ui already wired (`components.json`); slider/checkbox/accordion add commands documented |
| UI-06 | Dark + light theme (dark default, oklch palette from example-ui) | `.dark` class on `<html>` already in `index.html`; CSS vars already ported to `src/index.css` |
| UI-07 | Responsive desktop-first layout | Grid layout from prototype documented; Tailwind v4 approach clarified |
| UI-08 | Full keyboard navigation, ARIA labels, WCAG AA contrast | shadcn/ui primitives supply ARIA; landmark roles must be added manually |
| PRIV-01 | Zero telemetry, zero analytics, zero outbound requests after WASM load | Google Fonts CDN import in `src/index.css` must be replaced with fontsource in Phase 1 |
| PERF-04 | Codec bundle splitting (don't ship AVIF WASM if user only processes SVG/PNG) | No codecs in Phase 1; dynamic import pattern documented for Phase 2+ |
</phase_requirements>

---

## Summary

Phase 1 is a UI/UX porting and security foundation task, not a feature build. The Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui scaffold is already in place and working (`Button` component renders, design tokens are in `src/index.css`). The critical work is: (1) replace the Google Fonts CDN import with self-hosted `@fontsource-variable` packages, (2) add COOP/COEP headers in both `vite.config.ts` and `public/_headers`, (3) port all five `example-ui/` source files (~2,555 LOC total) to TypeScript React components using existing shadcn primitives, and (4) implement the theme toggle.

The existing `src/index.css` already has the OIMG oklch palette mapped to both `--color-*` custom properties and shadcn semantic aliases. The prototype uses `[data-theme="light"]` attribute; the implementation must use `.dark` class on `<html>` per D-08 (Tailwind v4 convention). The color values in `src/index.css` are slightly simplified compared to the prototype (the prototype uses a 5-stop `--bg-0…--bg-3` scale with subtle blue-grey chroma ~0.008–0.012 at hue 250; the current CSS uses a 2-stop scale with zero chroma). This is the most likely source of visual deviation.

The primary risk for the phase is scope: 2,555 LOC of prototype JSX must be ported while keeping visual fidelity. A wave-based delivery (icons → data/types → layout shell → panels → tweaks panel) keeps each commit reviewable.

**Primary recommendation:** Port in dependency order — icons and data types first (no UI), then layout shell with theme toggle and headers, then panels, then tweaks panel. Validate visual fidelity against `example-ui/OIMG.html` opened locally in the browser after each wave.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| COOP/COEP headers (dev) | Frontend Server (Vite dev) | — | `vite.config.ts` `server.headers` injects headers during `npm run dev` |
| COOP/COEP headers (prod) | CDN / Static (Cloudflare Pages) | — | `public/_headers` is parsed by Cloudflare Pages edge, not the app |
| Theme toggle state | Browser / Client | — | `localStorage` + `.dark` class on `<html>` — pure client concern |
| Design tokens | Browser / Client | — | CSS custom properties in `src/index.css`, consumed by Tailwind |
| Font loading | Browser / Client | — | `@fontsource-variable` imports in `src/main.tsx` — bundled WOFF2 |
| shadcn component rendering | Browser / Client | — | Client-side React, no SSR in this project |
| ARIA / keyboard nav | Browser / Client | — | React component attributes; shadcn Radix primitives handle focus rings |

---

## Standard Stack

### Core (already installed — verified from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | `^19.2` | UI framework | Locked in CLAUDE.md |
| `react-dom` | `^19.2` | DOM renderer | Pairs with React |
| `vite` | `^8.0` | Build tool + dev server | Locked; WASM-friendly, Rolldown bundler |
| `@vitejs/plugin-react` | `^6.0` | React Fast Refresh | Standard pairing |
| `typescript` | `^5.9` | Type safety | Locked |
| `tailwindcss` | `^4.1` | Utility CSS | Locked; `@theme {}` blocks, no config file |
| `@tailwindcss/vite` | `^4.1` | Vite integration for TW4 | Required for TW4 with Vite |
| `lucide-react` | `^0.468.0` | Icon library | Registered in `components.json` |

**Note:** `@base-ui/react` is in `dependencies` but is NOT listed in the CLAUDE.md locked stack. It may have been added during the shadcn quick task. Do not use it in Phase 1 — shadcn uses Radix UI primitives, not Base UI. [VERIFIED: package.json inspection]

### To Install (Phase 1)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@fontsource-variable/inter` | `^5.2.8` | Self-hosted Inter variable font | Replaces Google Fonts CDN; required for COEP compliance |
| `@fontsource-variable/jetbrains-mono` | `^5.2.8` | Self-hosted JetBrains Mono variable font | Same rationale |

[VERIFIED: npm registry — `npm view @fontsource-variable/inter version` returned `5.2.8`; same for jetbrains-mono — checked 2026-04-29]

### shadcn Components to Add (Phase 1)

Install via `npx shadcn@latest add <name>`:

| Component | Needed For | CLI command |
|-----------|------------|------------|
| `slider` | Quality/level controls in tweaks panel | `npx shadcn@latest add slider` |
| `checkbox` | Toggle options (lossless, strip meta, etc.) | `npx shadcn@latest add checkbox` |
| `accordion` | Settings panel accordion (per-format) | `npx shadcn@latest add accordion` |
| `popover` | Format settings popovers | `npx shadcn@latest add popover` |
| `tooltip` | Toolbar tooltips | `npx shadcn@latest add tooltip` |
| `select` | Algorithm/fit dropdowns | `npx shadcn@latest add select` |
| `switch` | Toggle switches | `npx shadcn@latest add switch` |
| `badge` | File status badges | `npx shadcn@latest add badge` |
| `separator` | Visual dividers (`.tdiv` in prototype) | `npx shadcn@latest add separator` |

**Already installed:** `button` [VERIFIED: `src/components/ui/button.tsx` exists]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource-variable/inter` | `@fontsource/inter` (static weights) | Variable covers all weights in one file; static needs one import per weight |
| shadcn accordion | `@radix-ui/react-accordion` directly | shadcn wraps Radix with OIMG styles already applied via `components.json` |

**Installation:**
```bash
npm install @fontsource-variable/inter @fontsource-variable/jetbrains-mono
npx shadcn@latest add slider checkbox accordion popover tooltip select switch badge separator
```

---

## Architecture Patterns

### System Architecture Diagram

```
src/main.tsx
  │  imports: @fontsource-variable/inter, @fontsource-variable/jetbrains-mono
  │  imports: src/index.css (tokens + TW4)
  └─► App.tsx
        │
        ├─► useTheme() hook
        │     reads/writes: localStorage "oimg-theme"
        │     sets: document.documentElement.classList (.dark / remove .dark)
        │
        ├─► AppShell (layout grid)
        │     grid-template: titlebar / toolbar / [file-panel | detail-panel | tweaks-panel] / statusbar
        │     ARIA landmarks on each region
        │
        ├─► TitleBar — brand, menu, theme toggle (sun/moon icon button, top-right)
        ├─► Toolbar — action buttons, view switcher (Batch/Detail), file counter
        ├─► FilePanel — file list rows (mocked/static data in Phase 1)
        ├─► DetailPanel — split-slider placeholder
        ├─► TweaksPanel — accordion: Global / per-format / Resize / Snippets
        └─► StatusBar — summary text

Security/hosting:
  public/_headers       ──► Cloudflare Pages edge: COOP/COEP for production
  vite.config.ts        ──► Vite dev server: COOP/COEP for npm run dev
```

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/              # shadcn primitives (button, slider, etc.)
│   ├── shell/           # AppShell, TitleBar, Toolbar, StatusBar
│   ├── panels/          # FilePanel, DetailPanel, TweaksPanel
│   └── icons/           # Custom SVG icons ported from example-ui/icons.jsx
├── hooks/
│   └── useTheme.ts      # Dark/light toggle + localStorage persistence
├── lib/
│   └── utils.ts         # cn() — already exists
├── types/
│   └── index.ts         # TypeScript interfaces for file entries, codec settings
├── data/
│   └── defaults.ts      # Ported from example-ui/data.jsx — default codec configs
├── main.tsx             # Font imports, React root mount
├── index.css            # Design tokens + Tailwind v4 — already exists
└── vite-env.d.ts        # Already exists

public/
└── _headers             # Cloudflare Pages COOP/COEP — create in Phase 1
```

### Pattern 1: COOP/COEP in Vite Dev Server
**What:** Add security headers to Vite's dev server so `crossOriginIsolated` is `true` locally.
**When to use:** Required whenever SharedArrayBuffer or `Atomics` are needed (codec workers in Phase 2+).
**Example:**
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```
[CITED: https://vitejs.dev/config/server-options.html#server-headers]

### Pattern 2: Cloudflare Pages `public/_headers` for COOP/COEP
**What:** Static header file parsed by Cloudflare Pages at deploy time.
**When to use:** Production deployment via Cloudflare Pages — the only way to add HTTP response headers on Pages without a Worker.
**Example:**
```
# public/_headers
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```
[CITED: https://developers.cloudflare.com/pages/configuration/headers/]

### Pattern 3: Fontsource Variable Font Import
**What:** Import self-hosted variable font from npm package. Replaces Google Fonts CDN link.
**Why required:** Google Fonts CDN fetches an external resource. COEP (`require-corp`) blocks any cross-origin resource that does not include `Cross-Origin-Resource-Policy: cross-origin` — which Google Fonts does not set. This breaks COEP and prevents `crossOriginIsolated === true`.
**Example:**
```typescript
// src/main.tsx — add before ./index.css import
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
```
Then remove the `@import url("https://fonts.googleapis.com/...")` line from `src/index.css`. The CSS custom properties (`--font-sans`, `--font-mono`) remain unchanged.
[VERIFIED: npm view @fontsource-variable/inter exports — exports `./*.css` pattern confirmed]

### Pattern 4: Theme Toggle Hook
**What:** Minimal hook that reads/writes `localStorage` and toggles `.dark` class on `<html>`.
**When to use:** D-08/D-09 mandate this pattern.
**Example:**
```typescript
// src/hooks/useTheme.ts
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('oimg-theme') as Theme) ?? 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('oimg-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
```
[ASSUMED — standard localStorage + classList pattern; `src/index.css` confirms `.dark {}` is the correct selector]

### Pattern 5: Tailwind v4 Token Extension (No tailwind.config.js)
**What:** All token extensions go in `@theme {}` blocks inside `src/index.css`. There is no `tailwind.config.js` in TW4 Vite projects.
**Example:**
```css
/* src/index.css — existing pattern already in use */
@theme inline {
  --color-accent-green: var(--color-accent-green);
  /* add new tokens here, not in a config file */
}
```
[VERIFIED: existing `src/index.css` uses this pattern]

### Anti-Patterns to Avoid

- **Google Fonts CDN in production:** `@import url("https://fonts.googleapis.com/...")` in `src/index.css` is marked as dev-only; it must be removed entirely before Phase 1 is done (COEP violation).
- **`tailwind.config.js` in TW4:** Tailwind v4 with `@tailwindcss/vite` does not use a JS config file. Adding one will conflict.
- **`data-theme` attribute for theme toggle:** The prototype uses `[data-theme="light"]` on a container element. The implementation must use `.dark` class on `<html>` per D-08. If ported CSS accidentally uses the prototype's `[data-theme="light"]` selector, the theme CSS will not fire — port only the variable values, not the selectors.
- **`@base-ui/react` usage:** This package is in `dependencies` but is not part of the locked stack. Do not use it for Phase 1 components; use shadcn (Radix-based) primitives instead.
- **Inline `style` props for prototype pixel values:** The prototype uses `px` values (e.g., `font-size: 13px`, `height: 28px`). Port these as Tailwind utility classes or CSS custom properties — not inline `style` props — to maintain the design system.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible tooltip with keyboard support | Custom tooltip component | `@radix-ui/react-tooltip` (via shadcn) | Focus management, escape key, ARIA attributes — 200+ LOC of edge cases |
| Accessible popover with outside-click dismiss | Custom popover + backdrop div | `@radix-ui/react-popover` (via shadcn) | The prototype already has a custom popover with `pop-backdrop` — this is the exact footgun to avoid in the React port |
| Accessible accordion open/close | Custom accordion | shadcn `accordion` (Radix-based) | Focus trapping, keyboard arrow navigation, ARIA `aria-expanded` |
| Accessible slider | Custom range input | shadcn `slider` (Radix-based) | Cross-browser thumb styling, keyboard step control, ARIA `role="slider"` |

**Key insight:** The prototype hand-rolled Popover, Tooltip, and accordion — these are the exact components that need Radix primitives in the React port for WCAG AA compliance (UI-08).

---

## Common Pitfalls

### Pitfall 1: Google Fonts CDN Blocks `crossOriginIsolated`
**What goes wrong:** `crossOriginIsolated` remains `false` in browser even with COOP/COEP headers correctly set.
**Why it happens:** COEP (`require-corp`) blocks any cross-origin resource that does not include `Cross-Origin-Resource-Policy` header. Google Fonts CSS and font files do not include this header. The browser blocks the fetch, breaking COEP.
**How to avoid:** Remove `@import url("https://fonts.googleapis.com/...")` from `src/index.css` before testing `crossOriginIsolated`. Install and import `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` instead.
**Warning signs:** DevTools Network tab shows `(blocked:coep)` for fonts.googleapis.com; `crossOriginIsolated` logs `false` in console.

### Pitfall 2: `_headers` File Must Be in `public/`, Not Repo Root
**What goes wrong:** COOP/COEP headers not served in production; `crossOriginIsolated === false` on Cloudflare Pages.
**Why it happens:** Cloudflare Pages looks for `_headers` in the build output root. Vite copies `public/` to the build output root. If `_headers` is placed at repo root (not in `public/`), it is not included in the build output.
**How to avoid:** Create `public/_headers`. Verify with `npm run build` and check that `dist/_headers` exists.
**Warning signs:** File missing from `dist/` directory after build.

### Pitfall 3: Design Token Drift (2-stop vs 5-stop surface scale)
**What goes wrong:** Components look subtly wrong — slightly different background shading, border colors.
**Why it happens:** The existing `src/index.css` simplifies the prototype's 5-stop surface scale (`--bg-0` through `--bg-3` with blue-grey chroma ~0.008–0.012 at hue 250) to a 2-stop scale with zero chroma. Components like the title bar (`bg-1`), panel background (`bg-0`), and elevated surfaces (`bg-2`) map to different prototype values.
**How to avoid:** Before porting components, cross-reference which prototype variable each component uses. Add intermediate token stops if needed.
**Warning signs:** Side-by-side comparison of prototype and app shows different surface contrast levels.

### Pitfall 4: `.dark` vs `[data-theme="light"]` Selector Mismatch
**What goes wrong:** Light theme toggle does nothing; components stay dark.
**Why it happens:** The prototype uses `[data-theme="light"]` to switch to light mode. The React implementation uses `.dark` class removal (Tailwind v4 standard, D-08). Ported CSS with the prototype's `[data-theme="light"]` selector will not fire.
**How to avoid:** The existing `src/index.css` already uses `.dark {}` block correctly. Do not copy prototype CSS wholesale — port only the variable values.
**Warning signs:** Toggling theme changes nothing visually; `document.documentElement.classList` shows class change but colors stay the same.

### Pitfall 5: shadcn `add` Overwrites Existing Components
**What goes wrong:** Re-running `npx shadcn@latest add button` overwrites the existing `src/components/ui/button.tsx`.
**Why it happens:** shadcn CLI writes files without checking for existing modifications.
**How to avoid:** Only run `npx shadcn@latest add` for components not yet created. `button.tsx` already exists — skip it.
**Warning signs:** `git diff` shows `button.tsx` modified unexpectedly after running an `add` command.

---

## Code Examples

### COOP/COEP Runtime Assertion in main.tsx
```typescript
// src/main.tsx — add after imports, before ReactDOM.createRoot
if (!crossOriginIsolated) {
  console.error(
    '[oimg] crossOriginIsolated is false. ' +
    'COOP/COEP headers are missing or a cross-origin resource is blocking COEP. ' +
    'Codec workers will not function in Phase 2+.'
  )
}
```
[ASSUMED — standard COEP diagnostic pattern]

### Landmark ARIA Roles for Shell
```tsx
<div className="app-grid" role="application" aria-label="OIMG Image Optimizer">
  <header role="banner">...</header>
  <nav role="toolbar" aria-label="Actions">...</nav>
  <main role="main">
    <section aria-label="File list">...</section>
    <section aria-label="File detail">...</section>
  </main>
  <aside role="complementary" aria-label="Settings">...</aside>
  <footer role="contentinfo">...</footer>
</div>
```
[ASSUMED — standard HTML5 landmark pattern; verify against WCAG 2.1 SC 1.3.6]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@fontsource/inter` (static weight files) | `@fontsource-variable/inter` (variable font) | Fontsource ~2022 | Single import covers all weights |
| `tailwind.config.js` | `@theme {}` blocks in CSS | Tailwind v4 (2025) | No JS config; tokens live in CSS |
| `[data-theme="light"]` attribute | `.dark` class on `<html>` (TW4) | Tailwind v4 | shadcn and TW4 both expect `.dark` class |
| Radix UI direct imports | shadcn/ui CLI (`npx shadcn add`) | 2023–2024 | shadcn wraps Radix with project styles pre-applied |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useTheme` hook toggling `.dark` on `document.documentElement` will work with Tailwind v4's `@custom-variant dark (&:is(.dark *))` | Pattern 4 | Theme toggle may not apply if `.dark` must be on a different ancestor; verify selector scope |
| A2 | `crossOriginIsolated === false` console error is sufficient as a Phase 1 diagnostic | Code Examples | Planner may want a more visible user-facing indicator |
| A3 | ARIA landmark structure in Code Examples follows correct WCAG 2.1 SC 1.3.6 pattern | Code Examples | Shell landmark roles need browser accessibility audit before Phase 1 closes |

---

## Open Questions

1. **Token depth: 2-stop vs 5-stop surface scale**
   - What we know: Prototype has `--bg-0` through `--bg-3` with subtle blue-grey chroma at hue 250. `src/index.css` has a 2-stop zero-chroma scale.
   - What's unclear: Whether the visual difference will be noticeable enough to fail the pixel-faithful requirement (D-07).
   - Recommendation: Planner should add a task to audit which components use which `--bg-N` variable and decide whether to expand the token scale before porting components.

2. **`@base-ui/react` in dependencies — intentional or leftover?**
   - What we know: `@base-ui/react` is in `dependencies` (likely added during the shadcn quick task). Not in the CLAUDE.md locked stack.
   - Recommendation: Planner should add a cleanup task to remove `@base-ui/react` if it is not used, or document the rationale for keeping it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Package installs | ✓ | inferred from working repo | — |
| Vite dev server | D-02 COOP/COEP dev headers | ✓ | 8.x (package.json) | — |
| `npx shadcn@latest` | shadcn component add | ✓ | 4.6.0 (devDependency) | — |
| Cloudflare Pages | D-01 prod headers | Not verified locally | — | Use `npm run preview` + check `dist/_headers` exists after build |

**Missing dependencies with no fallback:** None for local development.

**Missing dependencies with fallback:**
- Cloudflare Pages production deployment: verify COOP/COEP using `npm run build` (check `dist/_headers` present) + `npm run preview` (manual browser check of response headers).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must establish |
| Config file | None |
| Quick run command | `npm run build` (TypeScript + bundler — catches broken imports and type errors) |
| Full suite command | Manual browser verification (see Phase gate below) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | App builds and serves without errors | smoke | `npm run build` | ✓ (package.json script) |
| UI-02 | shadcn components render with correct tokens | visual | Manual: compare browser to `example-ui/OIMG.html` | manual only |
| UI-06 | Dark/light toggle changes CSS variables correctly | smoke | Manual: browser DevTools — verify `.dark` class and CSS var values | manual only |
| UI-07 | Layout renders at 1280px+ desktop | visual | Manual: browser resize | manual only |
| UI-08 | Keyboard navigation reaches all interactive elements | manual | Manual: Tab through in browser; verify visible focus ring | manual only |
| PRIV-01 | No outbound network requests after page load | smoke | Manual: DevTools Network tab — filter external domains | manual only |
| PERF-04 | No codec WASM loaded on initial page load | smoke | Manual: DevTools Network — no `.wasm` requests | manual only |
| D-01/D-02/D-03 | `crossOriginIsolated === true` in dev and prod build | smoke | Dev: browser console `console.log(crossOriginIsolated)`; Prod: inspect `dist/_headers` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` — catches TypeScript errors and broken imports
- **Per wave merge:** Manual browser test side-by-side with `example-ui/OIMG.html`
- **Phase gate:** All 5 success criteria from CONTEXT.md verified manually in Chrome, Firefox, and Safari before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No automated test runner configured — Phase 1 validation is primarily manual (visual + DevTools)
- [ ] `npm run build` as automated proxy is sufficient for TypeScript-level correctness in Phase 1
- [ ] Playwright smoke test for `crossOriginIsolated === true` is optional for Phase 1; recommended for Phase 2 when workers are introduced

*(Recommend: skip formal test framework setup in Phase 1 — manual verification is faster for a pure UI phase)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this app |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No access control |
| V5 Input Validation | no | No user input processed in Phase 1 |
| V6 Cryptography | no | No crypto in Phase 1 |
| V14 Configuration (Security Headers) | **yes** | COOP + COEP via `public/_headers` and `vite.config.ts` |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-origin window access (Spectre-class timing attacks) | Information Disclosure | `Cross-Origin-Opener-Policy: same-origin` isolates browsing context |
| Cross-origin resource loading that breaks COEP | Tampering / Info Disclosure | `Cross-Origin-Embedder-Policy: require-corp` — all sub-resources must opt-in |
| Font CDN as COEP violation vector | Information Disclosure | Replace Google Fonts with `@fontsource-variable` (same-origin, bundled) |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|------------------|
| Tech stack: React + Vite + TypeScript | Enforced — scaffold already matches |
| Privacy: Zero-server, zero-telemetry, no remote fetches | Drives font self-hosting; Google Fonts CDN must be removed |
| Compatibility: Modern browsers with WASM + Workers + OffscreenCanvas | COOP/COEP required for SharedArrayBuffer in Workers (Phase 2+) |
| Hosting: Cloudflare Pages | `public/_headers` file format required |
| Accessibility: WCAG AA | shadcn/Radix primitives for interactive components; manual landmark audit required |
| Design tokens from `example-ui/OIMG.html` are locked | Tokens must be pixel-faithful; do not invent new values |
| `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` | Install and import in Phase 1; remove Google Fonts CDN import |
| No codecs in Phase 1 | Phase 1 is UI-only; jSquash/svgo deferred to Phase 2+ |
| `@base-ui/react` NOT in locked stack | Do not use for Phase 1; use shadcn (Radix-based) primitives instead |

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `package.json`, `src/index.css`, `vite.config.ts`, `components.json`, `src/main.tsx`, `src/App.tsx`, `src/components/ui/button.tsx` — verified actual project state 2026-04-29
- npm registry: `npm view @fontsource-variable/inter version` → `5.2.8`; same for jetbrains-mono — verified 2026-04-29
- `example-ui/OIMG.html` + `example-ui/app.jsx` — visual contract, line counts, component inventory

### Secondary (MEDIUM confidence)
- [CITED: https://vitejs.dev/config/server-options.html#server-headers] — `server.headers` config option
- [CITED: https://developers.cloudflare.com/pages/configuration/headers/] — `_headers` file format for Cloudflare Pages

### Tertiary (LOW confidence / ASSUMED)
- `useTheme` hook pattern — standard React localStorage pattern, not verified against a specific library
- ARIA landmark structure — standard HTML5 pattern, not audited against WCAG 2.1 tooling in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and npm registry
- Architecture: HIGH — derived from locked decisions (D-01 through D-09) and existing codebase state
- Pitfalls: HIGH — Google Fonts CDN still present in `src/index.css` (observable); `[data-theme]` vs `.dark` mismatch observable from prototype vs implementation CSS
- Design token drift: MEDIUM — requires side-by-side visual comparison to quantify

**Research date:** 2026-04-29
**Valid until:** 2026-05-29
