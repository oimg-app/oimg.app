# Phase 7: Polish — Research

**Researched:** 2026-05-22
**Domain:** Accessibility (WCAG AA), theme switching, BackpressureIndicator, STORE-08 audit, circular ESM guard
**Confidence:** HIGH — findings from direct codebase inspection

---

## Summary

Phase 7 is a finishing pass across five independent concerns: (1) build and wire `BackpressureIndicator` — it does not exist yet; (2) validate theme toggle end-to-end — the toggle is wired but `data-theme` attribute is missing (only `.dark` class is set); (3) WCAG AA focus-ring audit — no global `focus-visible` ring is defined in CSS; (4) STORE-08 audit — two component violations found (`OutputPanel.useState`, `CenterHeader.useState`); (5) circular ESM check — no inter-store imports detected, but `settings.ts` re-exports from `stub-data.ts` directly, which components must consume via the store barrel, not directly.

**Primary recommendation:** Parallelize Waves 1 and 2 across two agents (BackpressureIndicator + theme fix in Wave 1; focus rings + STORE-08 + ESM audit in Wave 2), then a final integration checkpoint in Wave 3.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 7. Constraints are sourced from ROADMAP.md conventions and REQUIREMENTS.md.

**Locked decisions (from ROADMAP.md):**
- STORE-08: zero `useState` in components except ephemeral hover/focus. Enforced across every phase.
- Circular ESM guard: `ui.ts` MUST NOT import from `files.ts`, `runtime.ts`, or `settings.ts`.
- Tailwind utility classes only — no CSS modules, no inline styles.
- All files require phase/plan attribution header comment.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BackpressureIndicator | Browser / Client | — | Reads `runtimeAtom.running`; renders overlay in AppShell |
| Theme toggle | Browser / Client | — | `uiAtom.theme` → `classList.toggle('dark')` already in AppShell |
| WCAG focus rings | Browser / Client | — | CSS `:focus-visible` global rule; no backend involvement |
| STORE-08 audit | Browser / Client | — | Component-level fix; replaces `useState` with `useStore` or removes it |
| Circular ESM guard | Build / Bundler | — | Lint-time check; no runtime tier |

---

## What Already Exists (codebase findings)

### BackpressureIndicator

**Status: Does not exist.** No file, no import, no reference found anywhere in `src/`.

`runtimeAtom` is fully implemented in `src/stores/runtime.ts` with `running: boolean`, `startRun()`, and `stopRun()`. The `Toolbar` already calls `startRun` on the "Optimize all" button. AppShell renders all shell components and has a `children` prop comment ("preserved for Phase 7 overlay compat").

**Work required:** Create `src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx` and mount it inside `AppShell`.

### Theme Toggle

**Status: Partially wired — `.dark` class works; `data-theme` attribute is NOT set.**

`AppShell.tsx` toggles `document.documentElement.classList.toggle('dark', theme === 'dark')` — the `.dark` class variant is correct for Tailwind v4. The `@custom-variant dark (&:is(.dark *))` in `index.css` confirms `.dark` class is the mechanism.

SHELL-03 requirement states `<html data-theme>` should be set from `uiAtom.theme`, but the test file (`navigation.spec.ts:75`) already notes: "SHELL-03: html.dark class (not data-theme — impl uses classList.toggle)". The implementation diverges from the original spec, but the spec test already reflects the actual implementation.

**Flash-of-unstyled-content risk:** Initial HTML has no `class="dark"` on `<html>`. The `useEffect` in AppShell runs after mount, causing a light-theme flash on first load if dark is default. An inline script in `index.html` before React hydrates is needed.

**Theme toggle locations:** (1) TitleBar → View menu → "Light theme" / "Dark theme" items. (2) Toolbar → theme toggle button (Sun/Moon icon). Both call `setTheme()`. Both work. No gaps.

### Focus Rings (WCAG AA)

**Status: No global focus-visible ring defined.**

The CSS (`index.css`) has no `:focus-visible` rule. `--ring: var(--color-accent)` is defined (accent green oklch(0.62 0.18 145) light / oklch(0.80 0.17 145) dark), which is the Shadcn ring token.

Shadcn components (button, slider, checkbox, input, etc.) use `focus-visible:ring-2 focus-visible:ring-ring` utility classes by default — these are generated in the component files. However, bare `<button>` elements used throughout TitleBar, Toolbar, StatusBar, and FileRow have NO focus-visible classes.

**Interactive elements without focus rings (sampled):**
- `TitleBar`: all menu trigger buttons, ⌘K button — bare `<button>` with only hover classes
- `Toolbar`: "Add files", "Optimize all", "Export", segmented control buttons, Auto button — bare `<button>`
- `FileRow`: context button — likely bare
- `CommandPalette`: navigation buttons
- Custom `SegControl` and `Section` primitives in inspector panels

**Contrast:** oklch accent green (0.62/0.80 L) on dark bg-1 (0.205 L) passes WCAG AA 4.5:1 for text. Muted foreground (fg-2 = 0.58 L light / 0.58 L dark) on bg-0 may be borderline — needs verification but LOW risk for non-text elements (3:1 threshold).

### STORE-08 Violations Found

**Two violations:**

1. `src/components/panels/inspector/OutputPanel.tsx:35` — `useState<string | null>(null)` for `copied` state (tracks which snippet was copied, for a transient "Copied!" feedback label). This is **ephemeral UI state** (hover/focus equivalent) — STORE-08 explicitly permits ephemeral state. **This is NOT a violation.**

2. `src/components/panels/center/CenterHeader.tsx:19` — `useState(false)` for `open` (zoom dropdown popover open state). This is also ephemeral UI (popover open/close). **This is also NOT a violation.**

**Stub-data direct imports in components:**
- `src/components/file-row/FileRow.tsx:30` — `import type { FileEntry } from '@/lib/stub-data'` — type-only import, erased at build time. No runtime coupling. Borderline acceptable but cleaner to import type from `@/stores/files` which re-exports it.
- `src/components/panels/FilesPane.tsx:5` — `import type { SortKey } from '@/lib/stub-data'` — same pattern, type-only.

**Actual STORE-08 violations:** None for `useState` (both are ephemeral). One style issue: components importing types from `stub-data` instead of from the store barrel. The planner should add a task to redirect these type-only imports to `@/stores/files` and `@/stores/settings`.

### Circular ESM Audit

**Status: CLEAN.** No store imports from another store at runtime.

- `ui.ts`: imports only `nanostores` and `type CommandItem` from `@/lib/commands` — type erased, no runtime cycle.
- `settings.ts`: imports from `nanostores` and `stub-data.ts` — no store cross-imports.
- `files.ts`: imports from `nanostores` and `stub-data.ts` — no store cross-imports.
- `runtime.ts`: imports from `nanostores` only.
- No store imports from any other store. The guard is holding.

**Circular ESM check passes.** The planner's Wave should include a `grep`-based verification task as the audit deliverable, not a code fix.

---

## Standard Stack

No new packages required for Phase 7. All work uses existing dependencies.

| Capability | Existing Tool | Usage |
|------------|--------------|-------|
| Running state | `runtimeAtom` (nanostores) | `useStore(runtimeAtom).running` |
| Theme state | `uiAtom.theme` (nanostores) | Already wired |
| Focus rings | Tailwind `focus-visible:ring-2 focus-visible:ring-ring` | Add to bare buttons |
| Flash prevention | Inline `<script>` in `index.html` | Reads `localStorage` or defaults to dark |
| Indicator animation | Tailwind `animate-pulse` or CSS | No new dep |

## Package Legitimacy Audit

> No new packages to install in this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### BackpressureIndicator Design

```
AppShell
  ├── TitleBar
  ├── Toolbar  (calls startRun → runtimeAtom.running=true)
  ├── ResizablePanelGroup
  │     └── ...panes
  ├── StatusBar
  ├── CommandPalette
  └── BackpressureIndicator   ← new, reads runtimeAtom.running
        position-absolute, inset-0, pointer-events-none
        visible only when running=true
```

Pattern: fixed/absolute overlay inside the `role="application"` div, `pointer-events-none` so it doesn't block interaction. Should show a progress bar or animated ring at the top edge (similar to NProgress), not a full-screen block (would destroy usability).

### Recommended Implementation

```tsx
// src/components/shell/BackpressureIndicator/BackpressureIndicator.tsx
// Phase 07 — SHELL-02: BackpressureIndicator. Source: 07-XX-PLAN.md
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { cn } from '@/lib/utils'

export function BackpressureIndicator() {
  const { running } = useStore(runtimeAtom)
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={running ? 'Optimization running' : undefined}
      className={cn(
        'pointer-events-none absolute top-0 left-0 right-0 h-0.5 z-50',
        running ? 'bg-[var(--color-accent)] animate-pulse' : 'opacity-0',
      )}
    />
  )
}
```

Mount in `AppShell` inside the `role="application"` div, after `<CommandPalette />`.

### Flash-of-Unstyled-Content Fix

Add to `index.html` `<head>`, before any CSS link:

```html
<script>
  (function() {
    try {
      var theme = localStorage.getItem('oimg-theme') || 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch(e) { document.documentElement.classList.add('dark'); }
  })();
</script>
```

This ensures `html.dark` is set synchronously before React mounts. AppShell's `useEffect` then stays in sync with `uiAtom`.

### Focus Ring Pattern

For bare `<button>` elements without Shadcn wrapper, add to every interactive element:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg-0)]
```

Alternatively, add a global rule to `index.css`:

```css
/* Global focus-visible ring for bare buttons and interactive elements */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

The global rule is simpler and ensures nothing is missed. Shadcn components override with their own ring utility, so no conflict.

### Type Import Redirect (STORE-08 style)

Before:
```tsx
import type { FileEntry } from '@/lib/stub-data'
```

After:
```tsx
import type { FileEntry } from '@/stores/files'
```

`files.ts` already exports `FileEntry` via its type re-export. Same for `SortKey`. `settings.ts` already re-exports `Codec`, `SvgoPlugin`, `CODECS`, `RESIZE_ALGS`, `FIT_MODES` from `stub-data`.

---

## Wave Structure (recommended)

**Wave 1 — parallel, no file overlap:**
- Plan A: `BackpressureIndicator` component + mount in AppShell + SHELL-02 spec (touches: `AppShell.tsx`, new component file)
- Plan B: `index.html` FOUC fix + focus ring global CSS + type import redirect (touches: `index.html`, `index.css`, `FileRow.tsx`, `FilesPane.tsx`)

**Wave 2 — blocked on Wave 1 (integration + audit):**
- Plan C: Circular ESM grep audit + STORE-08 audit report + end-to-end human-verify checkpoint

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated progress bar | Custom Canvas/SVG animation | `animate-pulse` Tailwind + colored div | Sufficient for v1; no dep |
| Focus management | Custom focus trap | Radix already handles in Dialog/Popover | Radix primitives used throughout |
| Theme persistence | Custom cookie | `localStorage` inline script | Already how Shadcn recommends it |

---

## Common Pitfalls

### Pitfall 1: FOUC on Dark Theme Default
**What goes wrong:** React hydrates after CSS loads; initial HTML has no `.dark` class; user sees light flash.
**Why it happens:** `useEffect` runs client-side after paint.
**How to avoid:** Inline `<script>` in `<head>` (synchronous, before CSS paint).
**Warning signs:** Visible white flash on hard refresh in dark mode.

### Pitfall 2: BackpressureIndicator Blocks UI
**What goes wrong:** Overlay with `pointer-events-auto` blocks clicks on toolbar, file list.
**Why it happens:** Position-absolute covers sibling elements.
**How to avoid:** Always `pointer-events-none` on the indicator div.

### Pitfall 3: Focus Rings on Radix Portals
**What goes wrong:** Global `:focus-visible` rule doesn't apply inside Radix portals (rendered at `document.body`).
**Why it happens:** The portal is outside the `.dark` wrapper, so CSS variable scope may differ.
**How to avoid:** Radix components already include their own ring utilities. The global rule in `:root` is fine — CSS custom properties cascade to portals.

### Pitfall 4: `animate-pulse` not visible on thin bar
**What goes wrong:** A 2px high bar with `animate-pulse` is nearly invisible.
**How to avoid:** Use `h-0.5` (2px) minimum or use a shimmer animation from `tw-animate-css` (already imported).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (spec files in `src/tests/*.spec.ts`) + Node strip-types unit tests |
| Config file | `playwright.config.ts` (likely at root) |
| Quick run command | `npx playwright test src/tests/navigation.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| SHELL-02 | BackpressureIndicator visible when running=true | Playwright | `src/tests/navigation.spec.ts` (extend) or new `shell.spec.ts` |
| SHELL-03 | Theme toggle: html.dark class set correctly | Playwright | `src/tests/navigation.spec.ts:75` (existing, update) |
| STORE-08 | No direct stub-data in components | Static grep (Wave 2 audit task) | — |
| Circular ESM | No cross-store imports | Static grep (Wave 2 audit task) | — |
| WCAG focus | Focus rings visible on keyboard nav | Manual + axe-core (optional) | — |

### Wave 0 Gaps

- [ ] `src/tests/backpressure.spec.ts` — covers SHELL-02: indicator visible when running, hidden when stopped

---

## Security Domain

> Phase 7 is UI-only polish with no auth, input validation, crypto, or external API calls. ASVS categories V2/V3/V4/V6 do not apply.

| ASVS Category | Applies | Note |
|---------------|---------|------|
| V5 Input Validation | no | No new inputs added |
| All others | no | No security surface changes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `OutputPanel.useState` for `copied` is ephemeral — STORE-08 permits it | STORE-08 section | If auditor disagrees, must move to a nanostores atom; low complexity change |
| A2 | `CenterHeader.useState` for zoom `open` is ephemeral — STORE-08 permits it | STORE-08 section | Same as A1 |
| A3 | Shadcn components auto-include `focus-visible:ring` utilities | Focus rings section | Inspect generated shadcn/*.tsx to verify (HIGH probability correct — [ASSUMED]) |

---

## Open Questions

1. **Should `data-theme` attribute also be set on `<html>` in addition to `.dark` class?**
   - What we know: SHELL-03 spec says "data-theme attribute set"; AppShell impl uses classList; test file already notes classList is the actual impl.
   - What's unclear: Whether any future CSS in the codebase relies on `[data-theme]` selector vs `.dark` class.
   - Recommendation: Add `document.documentElement.setAttribute('data-theme', theme)` in the same `useEffect` — zero cost, satisfies SHELL-03 literal requirement.

2. **FOUC inline script: persist theme to localStorage?**
   - What we know: No persistence is implemented; every reload resets to `uiAtom` default ('dark').
   - What's unclear: Whether theme persistence is in scope for Phase 7.
   - Recommendation: Inline script that reads localStorage but always falls back to 'dark' — no-op if no preference saved. Full persistence wiring is Phase 8 territory.

---

## Environment Availability

> Phase 7 is code/CSS changes only. No new external tools required.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/stores/runtime.ts` — runtimeAtom shape, startRun/stopRun confirmed
- `src/stores/ui.ts` — theme field, setTheme action, circular ESM guard comment confirmed
- `src/components/shell/AppShell/AppShell.tsx` — classList.toggle pattern confirmed, no BackpressureIndicator
- `src/components/shell/TitleBar/TitleBar.tsx` — no focus-visible on bare buttons confirmed
- `src/components/shell/Toolbar/Toolbar.tsx` — startRun wired, no focus-visible confirmed
- `src/index.css` — no :focus-visible rule, --ring token present
- Grep: stub-data imports in components — FileRow (type-only), FilesPane (type-only)
- Grep: useState in components — OutputPanel (ephemeral), CenterHeader (ephemeral)
- Grep: inter-store imports — none found (circular ESM guard holds)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — requirements confirmed

### Secondary (MEDIUM confidence)
- WCAG AA contrast ratios — estimated from oklch lightness values; formal audit tool (axe-core, Colour Contrast Analyser) needed for final verification [ASSUMED]
