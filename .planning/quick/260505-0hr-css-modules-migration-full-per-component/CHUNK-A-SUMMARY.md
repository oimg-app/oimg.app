# Chunk A — Tasks 2 & 3 Summary

Quick task: `260505-0hr-css-modules-migration-full-per-component`
Worktree base: `b34275a9c28e3e83c3ff40e9b46b0d5c14205951`

## Commits

| # | Hash      | Subject                                                                |
|---|-----------|------------------------------------------------------------------------|
| 1 | `f3b11b3` | refactor(css): add primitives.module.css with shared structural classes |
| 2 | `1235314` | refactor(shell): co-locate AppShell with appShell.module.css            |

## Commit 1 — Task 2: primitives.module.css

**File created:** `src/styles/primitives.module.css` (128 lines)

Contains the 35+ shared structural classes specified in PLAN.md task 2:

- Pane shell: `pane`, `paneHd`, `paneBody`
- Toolbar buttons: `tbtn`, `tbtnPrimary`, `tbtnGhost`, `tbtnOpen`, `iconbtn`
- Segmented controls: `seg`, `segSm`
- Pills: `pill`, `pillAcc`, `pillWarn`, `pillSm`
- Toggle: `toggle`, `toggleOn`
- Section: `section`, `sectionTitle`
- Plugin row: `plugin`, `pluginCheck`
- Row, code/codeRow/copyBtn
- Popover primitives: `popover`, `popoverItem`, `popoverDivider`, `popoverLabel`
- Tooltip: `tip`
- `kbd`, `progbar`
- Chart: `chart`, `chartBar`, `chartAxis`
- Slider: `sliderBlock`, `rangeInput`

**Conventions applied (per locked decisions):**
- camelCase keys throughout (e.g. `.paneHd`, not `.pane-hd`).
- Pseudo-element selectors wrapped in `:global()` so they survive CSS
  Modules hashing and still match raw DOM nodes:
  - `.rangeInput:global(::-webkit-slider-thumb)`, `::-moz-range-thumb`, etc.
  - `.paneBody:global(::-webkit-scrollbar)` and friends.
  - `.seg button:global(.on)` since legacy markup uses bare `class="on"`.
- Pre-existing rationale comments preserved (D-03 plan reference on `.pillSm`).

**Coexistence guarantee:** legacy.css still owns the same rule bodies. Cascade
specificity is identical; this commit produces zero visual change. Per-component
migrations (Tasks 3–14) will delete the legacy duplicates as components migrate.

**Verify:** `npx tsc --noEmit -p tsconfig.json` → green.

## Commit 2 — Task 3: AppShell co-location

**Files:**
- Renamed: `src/components/shell/AppShell.tsx` → `src/components/shell/AppShell/AppShell.tsx`
- Created: `src/components/shell/AppShell/appShell.module.css`
- Modified: `src/styles/legacy.css` (removed `.app` rule, left pointer comment)
- Modified: `src/App.tsx` (import path bumped to new location)

**JSX change:** `className="app"` → `className={s.app}` after `import s from './appShell.module.css'`.

**Consumers updated:** Only `src/App.tsx` imports AppShell (verified via
`grep -rn "from.*shell/AppShell" src/`). Updated to
`from '@/components/shell/AppShell/AppShell'` (no barrel — chose the explicit
file path per PLAN.md option B; barrels can be added later if a consumer count
grows).

**legacy.css cleanup:** The `.app` rule was replaced with a pointer comment
(rather than a silent deletion) so future readers can trace the migration:

```css
/* `.app` grid moved to src/components/shell/AppShell/appShell.module.css
   (quick task 260505-0hr Task 3). */
```

This pattern will likely repeat for subsequent component migrations.

**Verification:**
- `npx tsc --noEmit -p tsconfig.json` → green.
- `npm run dev` booted to `http://localhost:5175/` in 254 ms with zero errors
  (port 5173/5174 in use; Vite picked next available — non-issue).

## Deviations

None. The plan was executed exactly as written for tasks 2 and 3.

One minor convention reinforcement worth noting for downstream chunks:
when a class like `seg button.on` references the bare `.on` from legacy
markup, the module wraps it as `:global(.on)`. Once consumers (Toolbar,
TitleBar, etc.) migrate fully and stop emitting `class="on"` literals,
the `:global()` wrappers in primitives can be tightened. For now they are
required for parity with the still-active legacy.css rules.

## Scope discipline

- No work attempted past Task 3.
- No docs (PLAN.md / STATE.md / ROADMAP.md) committed.
- Pre-existing untracked items (`.agents/`, `.claude/`, `ARCH.md`, etc.) and
  unrelated modified files (`.planning/STATE.md`, `.planning/ROADMAP.md`,
  `.planning/phases/04-decode-resize-memory-model/04-07-SUMMARY.md`) were
  left untouched.

## Handoff to Chunk B

- `src/styles/primitives.module.css` is the canonical home for shared classes.
  Component migrations should consume via `composes: pane from '@/styles/primitives.module.css'`.
- legacy.css now uses pointer comments to mark migrated rules. Continue this
  pattern for traceability until Task 18 deletes the file entirely.
- Import-path style: explicit `@/components/<area>/<Component>/<Component>`
  (no `index.ts` barrel) to keep the migration mechanical.
