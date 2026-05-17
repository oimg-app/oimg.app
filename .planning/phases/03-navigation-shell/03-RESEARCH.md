# Phase 3: Navigation Shell - Research

**Researched:** 2026-05-17
**Domain:** React navigation chrome — TitleBar, Toolbar, StatusBar, CommandPalette; nanostores uiAtom + runtimeAtom; keyboard event handling; theme switching via `data-theme`
**Confidence:** HIGH

---

## Summary

Phase 3 completes the navigation chrome around the existing 3-pane AppShell. The work falls into three buckets: (1) finish wiring `uiAtom` action stubs (currently all `/* @TODO Phase 3 */` no-ops in `src/stores/ui.ts`), (2) create `runtimeAtom` (`src/stores/runtime.ts`) and `ALL_COMMANDS` (`src/lib/commands.ts`), and (3) build four new components — `TitleBar`, `Toolbar`, `StatusBar`, and `CommandPalette` — all reading from / writing to stores, never from `useState` for data.

The reference implementation lives in `example-ui/app.jsx`. All structural patterns (popover menus, command palette keyboard handling, statusbar pip, theme toggling via `document.documentElement.dataset.theme`) are already proven there. The React port replaces inline state with nanostores atoms and replaces the custom `Popover` primitive with the already-generated Shadcn `Popover` component. The `cmdk` package is already installed (`package.json` lists it) and can drive the CommandPalette — or the component can be built directly from the `Dialog` + `Input` pattern used in the reference, which is simpler and fully sufficient for v1 scope.

`SHELL-03` (setting `<html data-theme>`) must be implemented as a `useEffect` inside `AppShell` or a thin root-level effect, not inside `TitleBar`, to keep the DOM mutation at the top of the tree.

**Primary recommendation:** Implement nav components as thin presentational wrappers over nanostores atoms, following the exact `useStore(atom)` + action-call pattern already established in `FilesPane` and `FileRow`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Theme state (`uiAtom.theme`) | Store (`ui.ts`) | `AppShell` effect | Single source of truth; DOM side-effect is a derived effect, not component state |
| `data-theme` DOM mutation | `AppShell` (or `main.tsx`) | — | Must run at root level, above all themed components |
| Keyboard shortcuts (Meta+K, Escape) | `AppShell` effect | `CommandPalette` | Global listeners belong at root; `CommandPalette` handles its own internal arrow-key nav |
| CommandPalette visibility | `uiAtom.cmdkOpen` | — | Store-driven per STORE-08 convention |
| Menu open/close state (`open` key) | `uiAtom.open` | — | Replace the vanilla JSX `useState(null)` pattern with nanostores `setOpen` |
| Runtime status (running/toasts) | `runtimeAtom` | `StatusBar` | New store in Phase 3; StatusBar reads it |
| Command registry | `src/lib/commands.ts` | `uiAtom.$cmdFlat` | Static command list; computed filtered view lives in `uiAtom` |

---

## Standard Stack

### Core (already installed — verified from `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nanostores` | installed | `runtimeAtom` map store | Project's chosen state primitive (files.ts, ui.ts both use it) |
| `@nanostores/react` | installed | `useStore(atom)` hook in components | Already used in FilesPane |
| `@phosphor-icons/react` | installed | Icons (Play, Pause, Upload, Download, Search, Sun, Moon, GearSix, Lightning, etc.) | Locked ICON-01 mapping established in Phase 1 |
| `sonner` | installed | `pushToast` side-effects on menu actions | Already in Shadcn generated set; runtimeAtom toasts feed Sonner's `toast()` |
| Shadcn `Popover` | generated | TitleBar/Toolbar dropdown menus | Already generated (`src/components/ui/popover.tsx`); replaces the custom `Popover` from `app.jsx` |
| Shadcn `Dialog` | generated | CommandPalette modal backdrop | Available at `src/components/ui/dialog.tsx` |
| Shadcn `Input` | generated | CommandPalette search field + Toolbar filter | Available |
| Shadcn `Kbd` | generated | Key hint display in menus and CommandPalette footer | Available |
| `cmdk` | installed | Optional — CommandPalette list with built-in keyboard navigation | Already in `package.json`; use if it simplifies keyboard nav, otherwise Dialog+Input is sufficient |

[VERIFIED: package.json live read]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next-themes` | installed | Theme provider alternative | Already installed; however REQUIREMENTS.md specifies manual `data-theme` on `<html>` via `uiAtom.theme` — do NOT use `next-themes` ThemeProvider, it would conflict with the custom CSS variable approach |

[VERIFIED: package.json; ASSUMED: `next-themes` conflicts with `data-theme` pattern — low risk but document]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shadcn `Popover` for menus | Radix `DropdownMenu` (also installed) | Dropdown menus have built-in keyboard semantics; Popover needs manual handling. Either works for v1 since menus are purely visual stubs. Use `Popover` to match the Phase 2 pattern (FilesPane uses Popover). |
| Manual `Dialog` + `Input` for CommandPalette | `cmdk` package | `cmdk` is battle-tested for exactly this pattern; already installed; removes ~80 LOC of keyboard handling code |

**Installation:** Nothing new to install — all dependencies are already present.

---

## Architecture Patterns

### System Architecture Diagram

```
window keydown listener (AppShell useEffect)
  |- Meta+K / Ctrl+K ──────────────────────────► openCmdk() ──► uiAtom.cmdkOpen = true
  |- Escape ────────────────────────────────────► closeCmdk() / setOpen(null)
  └─ / (not in input) ──────────────────────────► focus Toolbar filter input

AppShell (root)
  |- useStore(uiAtom).theme ──► useEffect ──────► document.documentElement.dataset.theme
  |- TitleBar ─────────────────────────────────────────────────────────────────────────┐
  |    reads: uiAtom.open, uiAtom.theme                                                │
  |    writes: setOpen(), setView(), setTheme()                                        │
  |    children: brand mark | Codec menu | View menu | Help menu | pills | Search btn  │
  |                                                                                    │
  |- Toolbar ──────────────────────────────────────────────────────────────────────────┤
  |    reads: uiAtom.open, uiAtom.view, runtimeAtom.running, filesAtom.filterQuery     │
  |    writes: setOpen(), setView(), startRun(), setFilter(), setTheme()               │
  |    children: Add split-btn | Optimize btn | Export split-btn | Batch/Compare/Report│
  |              seg | Auto split-btn | filter input | theme toggle | settings popover │
  |                                                                                    │
  |- ResizablePanelGroup (3 panes — from Phase 1/2)                                    │
  |                                                                                    │
  |- StatusBar ────────────────────────────────────────────────────────────────────────┤
  |    reads: runtimeAtom.running, $totals                                             │
  |    shows: worker pip | SVGO 4.0.1 | codec version | WASM ready | file count       │
  |                                                                                    │
  └─ CommandPalette (modal overlay) ──────────────────────────────────────────────────┘
       reads: uiAtom.cmdkOpen, uiAtom.cmdkQ, uiAtom.cmdkSel, $cmdFlat
       writes: closeCmdk(), setCmdkQuery(), setCmdkSel()
       on Enter: cmdFlat[cmdkSel].do()
```

### Recommended Project Structure

```
src/
├── stores/
│   ├── ui.ts          # STORE-03: fill in all @TODO Phase 3 action stubs
│   ├── runtime.ts     # STORE-04: NEW — runtimeAtom (running, toasts)
│   ├── files.ts       # existing — no changes needed
│   └── index.ts       # re-export runtime.ts
├── lib/
│   └── commands.ts    # STORE-07: NEW — ALL_COMMANDS: CommandGroup[]
├── components/
│   └── shell/
│       ├── AppShell/
│       │   └── AppShell.tsx   # add TitleBar+Toolbar+StatusBar, data-theme effect, keyboard listener
│       ├── TitleBar/
│       │   └── TitleBar.tsx   # NAV-01
│       ├── Toolbar/
│       │   └── Toolbar.tsx    # NAV-02
│       ├── StatusBar/
│       │   └── StatusBar.tsx  # NAV-03
│       └── CommandPalette/
│           └── CommandPalette.tsx  # NAV-04
```

### Pattern 1: nanostores action stubs to real implementations

**What:** The 9 no-op functions in `ui.ts` get real bodies using `uiAtom.setKey(...)`.
**When to use:** Every action in Phase 3 follows this shape.

```typescript
// Source: existing files.ts + ui.ts pattern [VERIFIED: codebase read]
export function setOpen(key: string | null): void {
  uiAtom.setKey('open', key)
}
export function setView(v: View): void {
  uiAtom.setKey('view', v)
}
export function setTheme(t: 'dark' | 'light'): void {
  uiAtom.setKey('theme', t)
}
export function openCmdk(): void {
  uiAtom.setKey('cmdkOpen', true)
  uiAtom.setKey('cmdkQ', '')
  uiAtom.setKey('cmdkSel', 0)
}
export function closeCmdk(): void {
  uiAtom.setKey('cmdkOpen', false)
}
```

### Pattern 2: `$cmdFlat` computed atom

**What:** Computed atom inside `ui.ts` that returns filtered flat command list from `ALL_COMMANDS`.
**Circular ESM guard:** `ui.ts` MUST NOT import from `commands.ts` if `commands.ts` imports from any other store. Resolution: `commands.ts` imports store actions directly (NOT atoms) — it can safely import action functions since those are pure function references that do not create circular module graph cycles at load time. OR: pass `ALL_COMMANDS` into `ui.ts` via a `setCommands()` initializer called from `main.tsx`.

**Recommended approach:** Keep `ALL_COMMANDS` as a static const in `commands.ts` that imports action functions from stores. Define `$cmdFlat` as a computed atom in `ui.ts` that accepts `ALL_COMMANDS` via a module-level variable set at app init. This avoids circular imports completely.

```typescript
// src/lib/commands.ts [ASSUMED: this pattern avoids circular ESM]
import { setView, setTheme } from '@/stores/ui'
import { startRun } from '@/stores/runtime'

export interface CommandItem {
  label: string
  meta?: string
  group: string
  do: () => void
}
export interface CommandGroup { group: string; items: CommandItem[] }

export const ALL_COMMANDS: CommandGroup[] = [
  { group: 'Actions', items: [
    { label: 'Add files', meta: 'A', group: 'Actions', do: () => {} },
    { label: 'Optimize all', meta: 'O', group: 'Actions', do: startRun },
  ]},
  // View and Codec groups follow same shape
]
```

```typescript
// src/stores/ui.ts — $cmdFlat (no import from commands.ts needed)
// ui.ts receives ALL_COMMANDS via injection, not import
let _allCommands: CommandItem[] = []
export function registerCommands(cmds: CommandItem[]): void {
  _allCommands = cmds
}
export const $cmdFlat = computed(uiAtom, (s) =>
  s.cmdkQ
    ? _allCommands.filter(i => i.label.toLowerCase().includes(s.cmdkQ.toLowerCase()))
    : _allCommands
)
```

### Pattern 3: `data-theme` on `<html>`

**What:** `AppShell` subscribes to `uiAtom.theme` and applies it to `document.documentElement.dataset.theme`.
**When to use:** Theme toggle in TitleBar View menu and Toolbar both call `setTheme()`; effect runs once per theme change.

```typescript
// Source: example-ui/app.jsx theme useEffect [VERIFIED: codebase read]
// In AppShell.tsx:
const { theme } = useStore(uiAtom)
useEffect(() => {
  document.documentElement.dataset.theme = theme
}, [theme])
```

Note: The existing `AppShell` wraps with `className="dark"` — this needs to be removed or made dynamic once `data-theme` drives styling. Check `src/index.css` for whether `:root` vs `[data-theme=dark]` selectors are used.

### Pattern 4: CommandPalette keyboard navigation

**What:** Arrow keys move `cmdkSel`, Enter fires `do()`, Escape closes. Matches `app.jsx` exactly.

```typescript
// Source: example-ui/app.jsx lines 665-668 [VERIFIED: codebase read]
onKeyDown={(e) => {
  if (e.key === 'ArrowDown') { setCmdkSel(Math.min(cmdFlat.length - 1, cmdkSel + 1)); e.preventDefault() }
  if (e.key === 'ArrowUp')   { setCmdkSel(Math.max(0, cmdkSel - 1)); e.preventDefault() }
  if (e.key === 'Enter')     { cmdFlat[cmdkSel]?.do?.(); closeCmdk() }
}}
```

### Pattern 5: runtimeAtom `startRun` stub

**What:** For UI milestone, `startRun` just sets `running=true` and `stopRun` sets `running=false`. No real workers.

```typescript
// Source: example-ui/app.jsx startOptimize [VERIFIED: codebase read]
export function startRun(): void {
  runtimeAtom.setKey('running', true)
  // Phase 7: replaced with real worker pool call
}
export function stopRun(): void {
  runtimeAtom.setKey('running', false)
}
```

### Anti-Patterns to Avoid

- **Using `useState` for `open`, `cmdkOpen`, `running`:** STORE-08 prohibits this. All data state via stores.
- **Importing `ALL_COMMANDS` into `ui.ts` directly:** Creates circular ESM if `commands.ts` imports store actions. Use the `registerCommands()` injection pattern.
- **Putting `data-theme` mutation inside `TitleBar`:** The mutation must be at root level (AppShell). TitleBar only calls `setTheme()`.
- **Using `next-themes` ThemeProvider:** Installed but conflicts with manual `data-theme` approach required by design tokens.
- **Hardcoding SVGO/codec version strings in StatusBar:** Match the strings from `app.jsx` exactly ("SVGO 4.0.1", "WASM ready · 312 KB") for UI milestone; these become dynamic in a later milestone.
- **Rendering command labels as raw HTML:** Use text nodes only — command labels are static strings, never markup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CommandPalette keyboard navigation | Custom arrow-key state machine | `cmdk` package (already installed) | cmdk handles focus management, ARIA combobox role, virtual scroll — ~80 LOC saved |
| Popover positioning logic | DIY anchor/offset calculation | Shadcn `Popover` (Radix-based) | Already generated; Radix handles viewport collision detection |
| Toast display | Manual toast array + timeout | `sonner` (already installed + `runtimeAtom.toasts` feed) | sonner is already in the Shadcn setup; `toast()` call replaces `pushToast` |
| Theme DOM manipulation | Custom CSS class toggling | `dataset.theme` + CSS `[data-theme=light]` selectors (already in design tokens) | Design tokens already use `[data-theme]` selectors |

**Key insight:** Every non-trivial UI primitive needed for this phase is already installed. No new packages required.

---

## Common Pitfalls

### Pitfall 1: Circular ESM between `ui.ts` and `commands.ts`
**What goes wrong:** `ui.ts` imports `ALL_COMMANDS` from `commands.ts`; `commands.ts` imports action functions from `ui.ts` and `runtime.ts`. Node/Vite resolves this as a circular graph and one module gets `undefined` exports at load time.
**Why it happens:** The `$cmdFlat` computed atom needs the command list, but the command list needs to call store actions.
**How to avoid:** Use the `registerCommands()` injection pattern (see Pattern 2 above). `commands.ts` imports actions fine; `ui.ts` never imports `commands.ts`.
**Warning signs:** `ALL_COMMANDS` is `undefined` in `$cmdFlat`; TypeScript does not catch this at build time.

### Pitfall 2: `AppShell` hardcoded `className="dark"` conflicts with theme toggle
**What goes wrong:** AppShell currently has `className="dark"` hardcoded. If the theme toggler switches `data-theme` on `<html>` but the component still has `className="dark"`, CSS specificity battles cause visual bugs in light theme.
**Why it happens:** Phase 1 built the shell with dark-only in mind.
**How to avoid:** Check `src/index.css` — if `.dark` class drives the variables, keep the class approach and also set `data-theme`. If `[data-theme=dark]` drives it, remove the hardcoded class and drive everything via the dataset attribute. Audit `index.css` before touching AppShell.
**Warning signs:** Light theme toggle has no visible effect; dark styling persists after theme switch.

### Pitfall 3: Global keyboard listener added multiple times
**What goes wrong:** If `AppShell` adds a `window.addEventListener('keydown', ...)` inside a `useEffect` without a cleanup function, StrictMode double-invocation and hot reloads can attach multiple listeners.
**Why it happens:** Missing return cleanup in useEffect.
**How to avoid:** Always `return () => window.removeEventListener('keydown', onKey)` from the effect. Match `app.jsx` pattern exactly (it has the cleanup on line 113).
**Warning signs:** Meta+K opens CommandPalette twice or fires commands twice.

### Pitfall 4: StatusBar version strings
**What goes wrong:** SVGO version or codec version shown as placeholder or wrong value.
**Why it happens:** These are static strings in the UI milestone (real dynamic detection is v2 scope).
**How to avoid:** Use the exact strings from `app.jsx`: `"SVGO 4.0.1"`, `"@squoosh-kit/core 0.6.0"`, `"WASM ready · 312 KB"`. These are stub display values for visual fidelity.

### Pitfall 5: `cmdk` package vs. manual Dialog approach
**What goes wrong:** Using `cmdk`'s `Command` component forces its opinionated ARIA structure; if combined with Shadcn's Dialog it can produce double `role="dialog"` nesting.
**Why it happens:** `cmdk` is designed to be the root primitive, but Shadcn's `Dialog` wraps it for modal behavior.
**How to avoid:** Either (a) use `cmdk`'s `Command.Dialog` variant which handles the backdrop/modal internally, or (b) skip `cmdk` entirely and use Dialog + Input + manual keyboard nav (reference: `app.jsx` lines 656-693 — the whole CommandPalette is ~40 LOC and has no a11y gaps for v1 scope). For v1 scope, option (b) is simpler.

---

## Code Examples

### runtimeAtom (STORE-04)

```typescript
// Source: REQUIREMENTS.md STORE-04 spec [VERIFIED: requirements read]
// src/stores/runtime.ts
import { map } from 'nanostores'

export interface Toast { id: string; msg: string; meta?: string }
interface RuntimeState { running: boolean; toasts: Toast[] }

export const runtimeAtom = map<RuntimeState>({ running: false, toasts: [] })

export function startRun(): void { runtimeAtom.setKey('running', true) }
export function stopRun(): void  { runtimeAtom.setKey('running', false) }
export function pushToast(msg: string, meta?: string): void {
  const id = String(Date.now() + Math.random())
  runtimeAtom.setKey('toasts', [...runtimeAtom.get().toasts, { id, msg, meta }])
}
export function dismissToast(id: string): void {
  runtimeAtom.setKey('toasts', runtimeAtom.get().toasts.filter(t => t.id !== id))
}
```

### TitleBar skeleton (NAV-01)

```typescript
// Source: example-ui/app.jsx titlebar block [VERIFIED: codebase read]
// src/components/shell/TitleBar/TitleBar.tsx
import { useStore } from '@nanostores/react'
import { uiAtom, setOpen, setView, setTheme, openCmdk } from '@/stores/ui'
import { MagnifyingGlass, Sun, Moon } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function TitleBar() {
  const { open, view, theme } = useStore(uiAtom)
  // menus driven by open === 'menu-codec' | 'menu-view' | 'menu-help'
  // ...
}
```

### AppShell layout with new chrome

```typescript
// Updated AppShell structure (illustrative — Phase 3 modifies AppShell.tsx)
// Source: example-ui/app.jsx overall app div structure [VERIFIED: codebase read]
<div role="application" className="h-screen w-screen flex flex-col overflow-hidden ...">
  <TitleBar />          {/* ~28px */}
  <Toolbar />           {/* ~40px */}
  <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
    {/* 3 panes from Phase 1+2 */}
  </ResizablePanelGroup>
  <StatusBar />         {/* ~22px */}
  <CommandPalette />    {/* modal overlay, always mounted */}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` for menu open state | `uiAtom.open` string key | Phase 3 (this phase) | All popovers use one key in the store; closing one opens another |
| `pushToast` as local closure | `runtimeAtom.toasts` + sonner | Phase 3 | Components can trigger toasts without prop drilling |
| Hardcoded `className="dark"` | `document.documentElement.dataset.theme` | Phase 3 | Enables CSS `[data-theme=light]` selectors from design tokens |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `registerCommands()` injection resolves the circular ESM between `ui.ts` and `commands.ts` | Architecture Patterns | If wrong, alternative is to move `$cmdFlat` computation into a separate `src/lib/cmd-filter.ts` that imports both `ui.ts` and `commands.ts` with no back-import |
| A2 | The hardcoded `className="dark"` on AppShell will conflict with `[data-theme=light]` CSS selectors | Pitfall 2 | Requires auditing `src/index.css` at implementation time — low risk to verify |
| A3 | `next-themes` package should not be used for this phase's theme switching | Standard Stack | Verify that no existing component already uses `useTheme()` from next-themes — would need a unified approach |

---

## Open Questions

1. **`$cmdFlat` circular ESM resolution**
   - What we know: `ui.ts` circular ESM guard prohibits importing `files.ts`, `runtime.ts`, `settings.ts` — `commands.ts` is not listed but the pattern implies no cross-store imports
   - What's unclear: Whether `commands.ts` importing from `ui.ts` and `runtime.ts` action functions (not atoms) triggers the guard
   - Recommendation: Use `registerCommands()` injection; audit at PR time

2. **`cmdk` package vs. manual Dialog**
   - What we know: `cmdk` is installed; Shadcn `Dialog` is generated; both can work
   - What's unclear: Whether Phase 2 or prior art in the codebase already chose one approach
   - Recommendation: Use manual Dialog + Input (matches `app.jsx`, ~40 LOC, no extra abstraction)

---

## Environment Availability

Step 2.6: SKIPPED (no external tools required; all dependencies are npm packages already installed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (already configured) |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npm test -- --project=chromium` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-03 | uiAtom actions update store state | unit | `npm run test:bundle` pattern (Node) | ❌ Wave 0 |
| STORE-04 | runtimeAtom.running=true after startRun() | unit | same | ❌ Wave 0 |
| STORE-07 | ALL_COMMANDS array is non-empty | unit | same | ❌ Wave 0 |
| SHELL-03 | `html[data-theme]` reflects uiAtom.theme | smoke | `npm test -- --project=chromium` | ❌ Wave 0 |
| NAV-01 | TitleBar renders + menus open | smoke | `npm test -- --project=chromium` | ❌ Wave 0 |
| NAV-02 | Toolbar renders + Optimize sets running=true | smoke | `npm test -- --project=chromium` | ❌ Wave 0 |
| NAV-03 | StatusBar renders with worker pip | smoke | `npm test -- --project=chromium` | ❌ Wave 0 |
| NAV-04 | Meta+K opens CommandPalette; Escape closes | smoke | `npm test -- --project=chromium` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --project=chromium --grep "navigation"`
- **Per wave merge:** `npm test -- --project=chromium`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/tests/navigation.spec.ts` — covers SHELL-03, NAV-01, NAV-02, NAV-03, NAV-04
- [ ] `src/tests/stores.test.ts` — unit tests for STORE-03 actions, STORE-04, STORE-07

---

## Security Domain

> `security_enforcement` not explicitly disabled in config — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (filter input, CommandPalette search) | Filter is client-side string match only; no eval, no DOM injection. Input values bound to store string fields via `setFilter()` / `setCmdkQuery()`. |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via command label rendering | Tampering | Command labels are static strings in `ALL_COMMANDS` — use text node children, not raw HTML insertion |
| URL injection via "From URL or paste" toolbar item | Tampering | UI milestone only — the button calls `pushToast()` stub; actual URL parsing deferred to v2. No fetch/eval in this phase. |

---

## Sources

### Primary (HIGH confidence)
- `example-ui/app.jsx` — verified full TitleBar, Toolbar, StatusBar, CommandPalette implementation patterns
- `src/stores/ui.ts` — verified existing uiAtom shape and all @TODO stubs
- `src/stores/files.ts` — verified nanostores `map` + `computed` patterns used in this project
- `src/components/panels/FilesPane.tsx` — verified `useStore` consumption pattern
- `package.json` — verified all required packages already installed
- `REQUIREMENTS.md` — verified STORE-03/04/07, SHELL-03, NAV-01/02/03/04 specs
- `.planning/STATE.md` — verified STORE-08 convention and circular ESM guard

### Secondary (MEDIUM confidence)
- nanostores `map.setKey()` API — matches usage already in `files.ts` and `ui.ts`

### Tertiary (LOW confidence)
- `registerCommands()` injection pattern for avoiding circular ESM — [ASSUMED] based on standard module boundary analysis

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json
- Architecture: HIGH — direct reference to `app.jsx` + existing store patterns
- Pitfalls: HIGH (circular ESM, keyboard listener cleanup) / MEDIUM (theme class conflict — needs index.css audit)

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable stack — no fast-moving dependencies)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-03 (complete) | Fill all @TODO Phase 3 action stubs in `ui.ts` (setOpen, setView, setTab, setSplit, setZoom, openCmdk, closeCmdk, setCmdkQuery, setCmdkSel, setTheme) + add `$cmdFlat` computed | Pattern 1, Pattern 2 |
| STORE-04 | Create `src/stores/runtime.ts` — runtimeAtom (running, toasts), startRun, stopRun, pushToast, dismissToast | Code Examples (runtimeAtom) |
| STORE-07 | Create `src/lib/commands.ts` — ALL_COMMANDS with Actions/View/Codec groups | Pattern 2; app.jsx lines 166-191 |
| SHELL-03 | `<html data-theme>` reflects `uiAtom.theme`; useEffect in AppShell | Pattern 3 |
| NAV-01 | TitleBar: brand mark, Codec/View/Help popovers, pills, Search/Meta+K button | app.jsx lines 196-264; Pattern 1 |
| NAV-02 | Toolbar: Add/Optimize/Export split-buttons, Batch/Compare/Report seg, Auto popover, filter input, theme toggle, settings popover | app.jsx lines 267-381 |
| NAV-03 | StatusBar: worker pip, SVGO version, codec version, WASM status, file count+size from $totals | app.jsx lines 635-642 |
| NAV-04 | CommandPalette: Dialog modal, search input, grouped list from $cmdFlat, arrow-key nav, Enter runs, Escape closes | app.jsx lines 655-693; Pitfall 5 |
</phase_requirements>
