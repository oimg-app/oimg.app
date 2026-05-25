# Phase 02: Files Pane — Research

**Researched:** 2026-05-16
**Domain:** React + nanostores + shadcn ContextMenu + Tailwind CSS
**Confidence:** HIGH

## Summary

Phase 2 wires the FilesPane from a skeleton stub into a fully reactive component backed by two new stores. `src/stores/files.ts` (STORE-01) supplies `filesAtom` with four actions and three `computed()` atoms. `src/stores/ui.ts` (STORE-03) holds the full uiAtom shape; Phase 3 actions are stubbed as `// @TODO`. Components subscribe exclusively via `useStore()` from `@nanostores/react` — no local `useState` for data.

The single largest implementation complexity is the shadcn `ContextMenu` trigger pattern (D-01): Radix `ContextMenu` fires on a native `contextmenu` DOM event, so the `ctxbtn` button must dispatch `new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY })` on the row's ref to reuse the same menu without a second component tree. This is the correct cross-browser pattern and does NOT require a Popover fallback.

All design tokens (format badge gradients, savings warn colour, totals bar accent, status dot palette) are locked in `example-ui/OIMG.html` and must be applied via Tailwind arbitrary values using the existing CSS variable names (e.g., `bg-[var(--accent)]`, `text-[var(--warn)]`).

**Primary recommendation:** Build in wave order — stores first (files.ts, ui.ts, update index.ts barrel), then FileRow, then FilesPane body replacement — so each wave is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use shadcn `ContextMenu` (Radix-based) as the single mechanism. The `ctxbtn` button dispatches a programmatic `contextmenu` event on the row element to trigger the same ContextMenu.
- **D-02:** File row + ContextMenu live in `src/components/file-row/FileRow.tsx`. `FilesPane` maps over `$filteredFiles` and renders `<FileRow>`.
- **D-03:** `$filteredFiles`, `$selectedFile`, and `$totals` are `nanostores computed()` reactive atoms defined in `src/stores/files.ts`. Components subscribe via `useStore($filteredFiles)` etc. Derivation logic stays in the store.
- **D-04:** Create `src/stores/ui.ts` with the **full STORE-03 spec** in Phase 2 (all fields + defaults). Phase 3 actions (`setView`, `setTab`, `setSplit`, etc.) are stubbed as `// @TODO` empty functions.

### Claude's Discretion
None stated — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-01 | `filesAtom` map with entries, selectedId, filterQuery, sortBy; computed $selectedFile, $filteredFiles, $totals; actions selectFile, setFilter, setSortBy, removeFile | nanostores `map()` + `computed()` API verified; initial entries from STUB_FILES |
| STORE-03 (partial) | `uiAtom` full shape; Phase 2 only wires selectedId/rowMenu/setRowMenu/selectFile; rest stubbed | nanostores `map()` API; circular ESM guard enforced |
| FILES-01 | FilesPane header "Queue · N files" + sort popover + add button | shadcn Popover already generated; N from $filteredFiles.length |
| FILES-02 | Dropzone always visible above file list | Pure markup; CSS vars from OIMG.html |
| FILES-03 | FileRow renders format badge, name, sizes, savings%, progress bar, ctxbtn, status dot; click selects | shadcn ContextMenu trigger pattern; phosphor icons |
| FILES-04 | Row context menu (right-click + ctxbtn); Remove calls removeFile(id); others call pushToast stub | programmatic contextmenu dispatch verified; ContextMenu already generated |
| FILES-05 | Totals bar 4 stat cells from $totals | Pure markup; $totals computed from filesAtom.entries |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File queue state | Store (files.ts) | — | nanostores map atom; components only read via useStore |
| Derived list / totals | Store (files.ts computed) | — | Derivation stays in store per D-03 |
| UI ephemeral state (rowMenu, selectedId) | Store (ui.ts) | — | Avoids prop drilling; Phase 3 extends same atom |
| FilesPane layout | Component (FilesPane.tsx) | — | Replaces Phase 1 skeleton; maps computed atom |
| File row + context menu | Component (FileRow.tsx) | — | Isolated per D-02; owns ContextMenu tree |
| Format badge colours | CSS vars (index.css) | Tailwind arbitrary values | Locked design tokens from OIMG.html |

## Standard Stack

### Core (already installed — verified via package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nanostores` | `^1.3.0` | `map()`, `computed()`, `atom()` primitives | [VERIFIED: package.json] |
| `@nanostores/react` | `^1.1.0` | `useStore()` hook for React subscriptions | [VERIFIED: package.json] |
| `@phosphor-icons/react` | `^2.1.10` | Icon set; mapping locked in ICON_MAP | [VERIFIED: package.json] |
| `shadcn` | `^4.7.0` | Component generator; ContextMenu already generated | [VERIFIED: package.json] |

### Already Generated (Phase 1 — do not regenerate)

| File | Purpose |
|------|---------|
| `src/components/ui/context-menu.tsx` | shadcn ContextMenu wrapping Radix primitive |
| `src/components/ui/popover.tsx` | For sort popover in pane header |
| `src/components/ui/separator.tsx` | ContextMenu dividers |
| `src/lib/stub-data.ts` | STUB_FILES (12 FileEntry), format constants |
| `src/lib/format.ts` | fmtBytes, fmtPct |
| `src/lib/utils.ts` | cn() helper |

## Architecture Patterns

### System Architecture Diagram

```
STUB_FILES (stub-data.ts)
        │
        ▼
filesAtom [map]  ──── selectFile(id) ──► selectedId
        │              removeFile(id)
        │              setFilter(q)
        │              setSortBy(s)
        │
        ├─► $filteredFiles [computed]  ──► FilesPane maps rows
        ├─► $selectedFile  [computed]  ──► Phase 5 CenterPane
        └─► $totals        [computed]  ──► TotalsBar

uiAtom [map]  ─────── setRowMenu(id)  ──► rowMenu (which row has ctxmenu open)
        │              selectFile(id) mirrors filesAtom.selectedId

FileRow (per file)
  ├── ContextMenu (Radix) ──► onContextMenu right-click
  │        └── ctxbtn ──► dispatchEvent('contextmenu') on rowRef
  └── onClick ──► selectFile(id)
```

### Recommended Project Structure (new files this phase)

```
src/
├── stores/
│   ├── files.ts          # STORE-01: filesAtom + computed + actions
│   ├── ui.ts             # STORE-03: uiAtom + stubbed actions
│   └── index.ts          # barrel re-export (update existing)
├── components/
│   ├── file-row/
│   │   └── FileRow.tsx   # D-02: single file row + ContextMenu
│   └── panels/
│       └── FilesPane.tsx # Replace Phase 1 skeleton body
```

### Pattern 1: nanostores map atom with actions

```typescript
// Source: nanostores 1.3.0 API (VERIFIED via node -e require test)
import { map, computed } from 'nanostores'
import type { FileEntry, SortKey } from '@/lib/stub-data'
import { STUB_FILES } from '@/lib/stub-data'

interface FilesState {
  entries: FileEntry[]
  selectedId: string | null
  filterQuery: string
  sortBy: SortKey
}

export const filesAtom = map<FilesState>({
  entries: STUB_FILES,
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})

// Actions: standalone exported functions (not methods)
export function selectFile(id: string) {
  filesAtom.setKey('selectedId', id)
}

export function removeFile(id: string) {
  filesAtom.setKey('entries', filesAtom.get().entries.filter(f => f.id !== id))
}

export function setFilter(q: string) {
  filesAtom.setKey('filterQuery', q)
}

export function setSortBy(s: SortKey) {
  filesAtom.setKey('sortBy', s)
}
```

### Pattern 2: nanostores computed()

```typescript
// Source: nanostores 1.3.0 — computed() takes atom + pure function
export const $filteredFiles = computed(filesAtom, (s) => {
  const q = s.filterQuery.trim().toLowerCase()
  const list = q ? s.entries.filter(f => f.name.toLowerCase().includes(q)) : s.entries
  // sorting logic here by s.sortBy
  return list
})

export const $selectedFile = computed(filesAtom, (s) =>
  s.entries.find(f => f.id === s.selectedId) ?? null
)

export const $totals = computed(filesAtom, (s) => {
  const orig = s.entries.reduce((a, f) => a + f.orig, 0)
  const opt  = s.entries.reduce((a, f) => a + f.opt,  0)
  return { orig, opt, saved: orig - opt, pct: orig > 0 ? ((orig - opt) / orig) * 100 : 0 }
})
```

### Pattern 3: useStore subscription in components

```typescript
// Source: @nanostores/react 1.1.0 — VERIFIED installed
import { useStore } from '@nanostores/react'
import { $filteredFiles } from '@/stores/files'

export function FilesPane() {
  const files = useStore($filteredFiles)
  // files is FileEntry[] — re-renders on change only
}
```

### Pattern 4: shadcn ContextMenu with programmatic trigger

The shadcn ContextMenu (wrapping Radix `@radix-ui/react-context-menu`) fires from the native browser `contextmenu` event on the trigger element. Programmatic trigger from `ctxbtn`:

```typescript
// Source: D-01 from CONTEXT.md; OIMG.html confirms clientX/clientY requirement
const rowRef = useRef<HTMLDivElement>(null)

function handleCtxBtn(e: React.MouseEvent) {
  e.stopPropagation()
  rowRef.current?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
    })
  )
}

return (
  <ContextMenu>
    <ContextMenuTrigger asChild>
      <div ref={rowRef} onClick={...} onContextMenu={...}>
        {/* row content */}
        <button className="ctxbtn" onClick={handleCtxBtn}>
          <DotsThreeVertical size={12} />
        </button>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => removeFile(file.id)} className="text-destructive">
        Remove from queue
      </ContextMenuItem>
      {/* other items call pushToast stub */}
    </ContextMenuContent>
  </ContextMenu>
)
```

### Pattern 5: STORE-03 full shape with @TODO stubs

```typescript
// Source: REQUIREMENTS.md STORE-03 spec
import { map, computed } from 'nanostores'
// CIRCULAR ESM GUARD: ui.ts MUST NOT import files.ts, runtime.ts, or settings.ts

export type View = 'Batch' | 'Compare' | 'Report'
export type Tab  = 'codec' | 'svgo' | 'output' | 'report'

interface UiState {
  open: string | null
  view: View
  tab: Tab
  split: number
  zoom: number
  cmdkOpen: boolean
  cmdkQ: string
  cmdkSel: number
  rowMenu: string | null
  theme: 'dark' | 'light'
}

export const uiAtom = map<UiState>({
  open: null,
  view: 'Batch',
  tab: 'codec',
  split: 50,
  zoom: 100,
  cmdkOpen: false,
  cmdkQ: '',
  cmdkSel: 0,
  rowMenu: null,
  theme: 'dark',
})

// Phase 2 active actions
export function setRowMenu(id: string | null) { uiAtom.setKey('rowMenu', id) }

// Phase 3 actions — stubbed; wire in Phase 3
export function setOpen(key: string | null) { /* @TODO Phase 3 */ }
export function setView(v: View)             { /* @TODO Phase 3 */ }
export function setTab(t: Tab)               { /* @TODO Phase 3 */ }
export function setSplit(pct: number)        { /* @TODO Phase 3 */ }
export function setZoom(z: number)           { /* @TODO Phase 3 */ }
export function openCmdk()                   { /* @TODO Phase 3 */ }
export function closeCmdk()                  { /* @TODO Phase 3 */ }
export function setCmdkQuery(q: string)      { /* @TODO Phase 3 */ }
export function setCmdkSel(n: number)        { /* @TODO Phase 3 */ }
export function setTheme(t: 'dark'|'light')  { /* @TODO Phase 3 */ }

// NOTE: $cmdFlat computed (depends on ALL_COMMANDS from STORE-07) is Phase 3 only
```

### Pattern 6: Format badge colours (Tailwind arbitrary values)

From `example-ui/OIMG.html` `.thumb.{type}` CSS — locked design tokens:

```typescript
// Source: OIMG.html lines 260-264 (VERIFIED by reading file)
const BADGE_CLASS: Record<string, string> = {
  svg:  'bg-[repeating-linear-gradient(45deg,var(--bg-2)_0_4px,var(--bg-3)_4px_5px)] text-[var(--accent)]',
  png:  'bg-[linear-gradient(135deg,oklch(0.55_0.12_250)_0%,oklch(0.45_0.10_280)_100%)] text-[oklch(0.95_0_0)]',
  jpg:  'bg-[linear-gradient(135deg,oklch(0.65_0.13_60)_0%,oklch(0.55_0.15_30)_100%)] text-[oklch(0.95_0_0)]',
  webp: 'bg-[linear-gradient(135deg,oklch(0.60_0.14_195)_0%,oklch(0.50_0.12_220)_100%)] text-[oklch(0.95_0_0)]',
  avif: 'bg-[linear-gradient(135deg,oklch(0.60_0.14_320)_0%,oklch(0.45_0.12_290)_100%)] text-[oklch(0.95_0_0)]',
}
```

Savings badge warn threshold: `savings < 30%` → `text-[var(--warn)]`; otherwise `text-[var(--accent)]`.

### Anti-Patterns to Avoid

- **useState for file list data:** Components must not own any list or selection state. Use `useStore(filesAtom)` or the computed atoms.
- **Importing stub-data.ts in components:** STORE-08 prohibition. Only stores and tests may import stub-data.ts.
- **ui.ts importing other stores:** Circular ESM guard — ui.ts has zero imports from files.ts, runtime.ts, or settings.ts.
- **Custom popover for context menu:** D-01 locks shadcn ContextMenu; do not fall back to a Popover for the row menu.
- **Recreating FileEntry type:** Types `FileEntry`, `FileStatus`, `SortKey`, `Codec` are already exported from `src/lib/stub-data.ts`. Verify before re-declaring in types/index.ts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Context menu | Custom Popover + manual positioning | shadcn `ContextMenu` (already generated) | Radix handles keyboard nav, focus trap, portal, z-index, a11y |
| Reactive subscriptions | Manual event emitters / useState | `useStore()` from @nanostores/react | Handles stale closure, batching, unmount cleanup |
| Tailwind class merging | String concatenation | `cn()` from `src/lib/utils.ts` | Handles conflicts between conditional classes |
| Byte formatting | Inline logic | `fmtBytes()` / `fmtPct()` from `src/lib/format.ts` | Already unit-tested in Phase 1 |

## Common Pitfalls

### Pitfall 1: ContextMenuTrigger asChild + ref forwarding

**What goes wrong:** `ContextMenuTrigger` with `asChild` requires the child to forward a ref. A plain `<div>` does NOT forward refs automatically.

**Why it happens:** Radix `asChild` uses `React.cloneElement` + ref merge under the hood.

**How to avoid:** Wrap the row div in a `React.forwardRef` OR attach the ref directly and skip `asChild` — use `ContextMenuTrigger` as the row's outer element with `className` applied. Then track `rowRef` from `ContextMenuTrigger`'s own ref prop.

**Alternative:** Attach `ref` to the `ContextMenuTrigger` itself (it accepts a ref); then `rowRef.current.dispatchEvent(...)`.

### Pitfall 2: $totals derived from all entries (not filteredFiles)

**What goes wrong:** Computing totals only from `$filteredFiles` makes the totals bar show wrong numbers when a filter is active.

**Why it happens:** REQUIREMENTS.md FILES-05 says totals are from `$totals` which is derived from `filesAtom.entries` (the full list), not filtered.

**How to avoid:** `$totals = computed(filesAtom, s => ...)` — use `s.entries`, not `$filteredFiles`.

### Pitfall 3: Circular ESM import from ui.ts

**What goes wrong:** `ui.ts` imports a type from `files.ts` (e.g., to use `FileEntry`), creating a circular dependency that silently resolves to `undefined` at runtime.

**Why it happens:** Both stores are in `src/stores/`; it's easy to accidentally cross-import.

**How to avoid:** `ui.ts` imports types ONLY from `src/lib/stub-data.ts` or from inline type declarations. Never from other store modules.

### Pitfall 4: Stale filesAtom.get() inside removeFile

**What goes wrong:** `removeFile` reads `filesAtom.get()` synchronously, but if two removes fire in the same tick (unlikely but possible), the second gets stale state.

**Why it happens:** nanostores `map` is synchronous; `.get()` returns snapshot at call time.

**How to avoid:** This is acceptable for Phase 2 (stub data, user-initiated). Document the limitation. For Phase 2 the stub size (12 items) makes this a non-issue.

### Pitfall 5: Type mismatch — `type: 'jpg'` vs `type: 'jpeg'`

**What goes wrong:** STUB_FILES uses `type: 'jpg'` for JPEG files (see stub-data.ts line 34), but the format badge map may key on `'jpeg'`.

**Why it happens:** OIMG.html uses `.thumb.jpg` CSS class. STUB_FILES uses `'jpg'` as the type value.

**How to avoid:** Key the badge map on `'jpg'` not `'jpeg'`. If `FileEntry.type` can be either, add both keys to BADGE_CLASS.

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield feature phase, not a rename/refactor/migration phase.

## Environment Availability

Step 2.6: SKIPPED — this phase requires no external tools, services, or CLIs beyond what was verified in Phase 1. All dependencies (nanostores, @nanostores/react, shadcn/ui) are already installed per package.json.

## Validation Architecture

`tdd_mode: false` per REQUIREMENTS.md Out of Scope section. No test gates required.

Smoke check: `npm run dev` → browser shows 12 file rows + totals bar + context menu opens on right-click.

## Security Domain

Phase 2 is 100% client-side UI with stub data. No authentication, session management, input to backend, or cryptography involved. ASVS V5 input validation is not applicable (no user input leaves the browser; filter query is local DOM state). No security controls required for this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `filesAtom.setKey('entries', ...)` is the correct nanostores v1.3 API for updating a key in a map atom | Pattern 1 | removeFile action breaks; fix: use `filesAtom.set({...filesAtom.get(), entries: ...})` |
| A2 | `ContextMenuTrigger` accepts a `ref` prop directly (not needing asChild + forwardRef) | Pitfall 1 | programmatic contextmenu dispatch fails silently |

Both can be verified in 2 minutes at implementation time by checking the Radix and nanostores type signatures.

## Sources

### Primary (HIGH confidence)
- `package.json` (VERIFIED) — nanostores 1.3.0, @nanostores/react 1.1.0, @phosphor-icons/react 2.1.10 all installed
- `example-ui/OIMG.html` (VERIFIED read) — all CSS design tokens, file-row/thumb/dropzone/totals structure
- `example-ui/app.jsx` lines 384–492 (VERIFIED read) — FilesPane markup, context menu pattern, totals logic
- `src/components/ui/context-menu.tsx` (VERIFIED read) — shadcn ContextMenu exports and variant props
- `src/lib/stub-data.ts` (VERIFIED read) — FileEntry shape, STUB_FILES 12 entries, type values
- `src/lib/format.ts` (VERIFIED read) — fmtBytes, fmtPct signatures
- `src/components/panels/FilesPane.tsx` (VERIFIED read) — Phase 1 skeleton to replace
- `.planning/phases/02-files-pane/02-CONTEXT.md` (VERIFIED read) — locked decisions D-01 through D-04
- `.planning/REQUIREMENTS.md` (VERIFIED read) — STORE-01, STORE-03, FILES-01 through FILES-05 acceptance criteria

### Secondary (MEDIUM confidence)
- nanostores `map()` + `computed()` API confirmed via `node -e` require test (VERIFIED runtime)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified installed at stated versions
- Architecture patterns: HIGH — verified against example-ui reference and locked decisions
- Pitfalls: HIGH — derived from reading actual source files and known Radix behavior
- Design tokens: HIGH — read directly from OIMG.html locked source

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (stable stack; no fast-moving dependencies added this phase)

## Project Constraints (from CLAUDE.md)

| Directive | Source | Applies to This Phase |
|-----------|--------|----------------------|
| Tailwind utility classes only — no CSS modules, no inline styles | CLAUDE.md Conventions | All new components |
| nanostores for state (not useState for data) | CLAUDE.md + CONTEXT.md | files.ts, ui.ts, FileRow, FilesPane |
| Attribution header `// Phase 02 — [desc]. Source: [plan doc]` on every file | CLAUDE.md + CONTEXT.md | files.ts, ui.ts, FileRow.tsx, FilesPane.tsx |
| `cn()` for conditional className | CLAUDE.md | FileRow conditional selected/has-menu classes |
| STORE-08: zero direct stub-data imports in components | REQUIREMENTS.md | FileRow, FilesPane must not import stub-data.ts |
| Circular ESM guard: ui.ts must not import files.ts / runtime.ts / settings.ts | ROADMAP.md | ui.ts |
| Store actions are standalone exported functions, re-exported from stores/index.ts | CONTEXT.md | selectFile, removeFile, setFilter, setSortBy, setRowMenu |
| `src/stores/index.ts` barrel must re-export new store exports | CONTEXT.md | files.ts and ui.ts exports |
| `src/types/index.ts` — verify types before adding (FileEntry, FileStatus, SortKey already in stub-data.ts) | CONTEXT.md | Don't duplicate types |
