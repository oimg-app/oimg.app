# Chunk B Summary — Tasks 4-7 (TitleBar / Toolbar / StatusBar / CommandPalette)

**Quick task:** 260505-0hr-css-modules-migration-full-per-component
**Chunk:** B of 6 (Tasks 4-7)
**Base commit:** `1235314` (Chunk A — AppShell migrated)
**Result:** four atomic commits, all green on `npx tsc --noEmit`, dev server boots cleanly.

## Commits

| Task | Commit | Component | Module file |
|------|--------|-----------|-------------|
| 4 | `4e202fd` | TitleBar | `src/components/shell/TitleBar/titleBar.module.css` |
| 5 | `e35b301` | Toolbar | `src/components/shell/Toolbar/toolbar.module.css` |
| 6 | `4a803a3` | StatusBar | `src/components/shell/StatusBar/statusBar.module.css` |
| 7 | `61301d7` | CommandPalette | `src/components/shell/CommandPalette/commandPalette.module.css` |

## Per-commit changes

### Task 4 — TitleBar (`4e202fd`)
- Renamed `src/components/shell/TitleBar.tsx` → `src/components/shell/TitleBar/TitleBar.tsx` (git mv).
- Created `titleBar.module.css` with `.titlebar`, `.brand`, `.menu`, `.right`, `.kbd` (composes from primitives).
- `.brand .mark` matched via `:global(.mark)` — the `<span className="mark"></span>` stays a bare global token.
- `.menu button:global(.on)` — Menubar children carry `cn('on')` from the Tailwind cn helper, so `.on` is matched as a global descendant.
- Updated import in `src/App.tsx` (line 16): `from '@/components/shell/TitleBar'` → `from '@/components/shell/TitleBar/TitleBar'`.
- Removed `.titlebar*` block from `legacy.css`. `.kbd` retained globally for not-yet-migrated consumers.

### Task 5 — Toolbar (`e35b301`)
- Renamed `Toolbar.tsx` → `Toolbar/Toolbar.tsx` (git mv).
- Created `toolbar.module.css`:
  - Private: `.toolbar`, `.tdiv`, `.search`.
  - Composed from primitives: `.tbtn`, `.tbtnPrimary`, `.tbtnGhost`, `.tbtnOpen`, `.seg`.
  - Local `.tbtnPrimaryOpen` to mirror the legacy `.tbtn.primary.open` compound (brightness-boosted accent).
- Switched JSX from string concatenation to `clsx(s.tbtn, s.tbtnGhost, condition && s.tbtnOpen)`.
- View segmented control inner buttons keep bare `'on'` className — primitive's `.seg button:global(.on)` matches it.
- Updated `src/App.tsx` import path.
- Removed `.toolbar`, `.tdiv`, `.search`, `.seg*` blocks from `legacy.css`. `.tbtn*` retained — TitleBar's ⌘K Search button and the Compare-stage zoom button still consume it as a bare global className (will move out in their own migrations).

### Task 6 — StatusBar (`4a803a3`)
- Renamed `StatusBar.tsx` → `StatusBar/StatusBar.tsx` (git mv).
- Created `statusBar.module.css`:
  - Private: `.statusbar`, `.item`, `.pip`, `.pipIdle` (explicit key for legacy `.pip.idle` compound), `.right`.
  - `:global()` descendant rules: `.statusbar :global(.item)`, `.statusbar :global(.item .pip)`, `.statusbar :global(.item .pip.idle|.warn)` — so the `BackpressureIndicator` child's bare `<span className="item">` / `<span className="pip warn">` continue to render correctly without forcing that child to migrate in this chunk.
- Switched JSX to `clsx(s.pip, !running && s.pipIdle)`.
- Updated `src/App.tsx` import path.
- Removed `.statusbar*` block from `legacy.css`.

### Task 7 — CommandPalette (`61301d7`)
- Renamed `CommandPalette.tsx` → `CommandPalette/CommandPalette.tsx` (git mv).
- Created `commandPalette.module.css` with camelCase keys:
  - `.cmdkBack`, `.cmdk`, `.cmdkInput`, `.cmdkList`, `.cmdkItem`, `.cmdkFoot`.
  - Inner: `.ic`, `.meta`, `.sel`.
  - `:global()` descendants: `.cmdkList :global(.lbl)`, `.cmdkFoot :global(.kbd)` — palette uses bare `<span className="kbd">` for keyboard chips inside the input/foot rows.
- Switched JSX to `clsx(s.cmdkItem, i === sel && s.sel)`.
- Updated `src/App.tsx` import paths (both the value and the `type CmdGroup` re-export, line 19-20).
- Removed `.cmdk*` block from `legacy.css`. The `@keyframes pop` referenced by `.cmdkBack` stays global (defined in `legacy.css` Popovers section AND `primitives.module.css`) — module animation lookup resolves against the global keyframe; cleanup task will reconcile.

## Verification performed

- `npx tsc --noEmit -p tsconfig.json` after every commit (4× green).
- End-of-chunk: `npm run dev` boots cleanly — Vite v7.3.2 reports `ready in 269 ms` on http://localhost:5175/. No console errors. No HMR warnings. Visual click-through skipped (background server killed at 5s) but ready output + clean typecheck satisfy the chunk gate.

## Cross-component class boundaries handled

- **TitleBar `.kbd`** — composes from primitives; menu items inside Menubar still wire bare global `'kbd'` className (the popover-internal `.pi`/`.kbd`/`.lbl`/`.div` set is not yet modularized, so popover-content classNames remain global until later tasks migrate Popover).
- **Toolbar `.tbtn` ghost button kept as `s.tbtn` + `s.tbtnGhost`** — the previous concatenated `'tbtn ghost'` strings became `clsx(s.tbtn, s.tbtnGhost)`. The `.tbtn.primary.open` compound got its own explicit `s.tbtnPrimaryOpen` class.
- **StatusBar BackpressureIndicator child** — the indicator is rendered by StatusBar but lives in `src/components/shell/BackpressureIndicator.tsx` and emits bare `.item` / `.pip warn` global classNames. Solved by descendant `:global()` selectors inside `.statusbar`. The indicator itself is not migrated in this chunk — its module migration is out of scope.
- **CommandPalette `.kbd` chips** — three bare `<span className="kbd">` chips remain in the input + foot rows. Matched by `.cmdkFoot :global(.kbd)` and the foot-specific override; the input row's chip relies on the global `.kbd` rule that still lives in `legacy.css`.

## Deviations

None. Every locked decision honored:
- File / class naming (`titleBar.module.css`, `toolbar.module.css`, etc., camelCase keys, `s.foo` consumption pattern).
- `composes:` for shared primitives (`.tbtn`, `.tbtnPrimary`, `.tbtnGhost`, `.tbtnOpen`, `.seg`, `.kbd`).
- Pseudo-element / descendant selectors that need raw DOM matching wrapped in `:global()`.
- WHY comments preserved verbatim and extended with the Task-N reference for each migrated file.
- One atomic commit per task, each green on `npx tsc --noEmit` before commit.

## Stop gate

Stopped at Task 7 as instructed. Tasks 8-18 untouched. Subsequent chunks pick up from `61301d7`.
