---
id: 260430-s6i
slug: rewrite-titlebar-tsx-using-shadcn-menuba
status: complete
created: 2026-04-30
completed: 2026-04-30
---

# Summary — Rewrite TitleBar.tsx with shadcn Menubar

## What changed

`src/components/shell/TitleBar.tsx` rewritten to use shadcn `Menubar` primitives (Base UI under the hood) for the Codec / View / Help menus. OIMG visual contract preserved.

## Approach (option 2 — wrapper)

- Swapped `<button>` + custom `<Popover>` triplets for `MenubarMenu` + `MenubarTrigger` + `MenubarContent` + `MenubarItem` + `MenubarSeparator`.
- Kept OIMG class names on the rendered nodes: `.titlebar`, `.menu`, `.popover`, `.pi`, `.lbl`, `.div`, `.kbd`, `.check`, `.on`, `.brand`, `.right`, `.pill`, `.tbtn`, `.mark`.
- Kept `role="banner"` on the outer `<header>`.
- Controlled open state via `MenubarMenu open` / `onOpenChange` mapped to existing `openKey` / `onOpenKey` props so cross-component coordination with `Toolbar` (App-level state in `App.tsx:824–846`) is unchanged.
- Passed `MENUBAR_RESET` (`h-auto rounded-none border-0 p-0 gap-[2px]`) via `cn()` to nullify shadcn's wrapper Tailwind defaults.
- shadcn's other Tailwind utilities (`bg-popover`, `rounded-lg`, `shadow-md`, `hover:bg-muted`, etc.) are visually inert — `.popover` and `.titlebar .menu button` live outside `@layer utilities` in `src/index.css` and beat layered utilities in the cascade.
- Dropped the now-unused `Popover` import (still consumed by `Toolbar.tsx` — kept in place).
- Replaced backdrop click-trap with Base UI's built-in outside-click + Escape handling.

## Verification

- `tsc --noEmit -p tsconfig.app.json` — passes.
- `bun run build` — passes (vite v7.3.2, 1.25s).
- `bunx playwright test src/tests/shell.spec.ts` — 11/11 passed (1.9s). Includes:
  - banner landmark renders
  - page loads without console errors
  - theme toggle round-trip flips `.dark`
  - Cmd+K palette open/close
  - Tab navigation reaches a toolbar button

## Files touched

- `src/components/shell/TitleBar.tsx` — rewritten.
- `.planning/quick/260430-s6i-rewrite-titlebar-tsx-using-shadcn-menuba/PLAN.md` — plan.
- `.planning/quick/260430-s6i-rewrite-titlebar-tsx-using-shadcn-menuba/SUMMARY.md` — this file.
- `.planning/STATE.md` — quick-tasks table row appended.

## Out of scope (untouched)

`App.tsx`, `index.css`, other shell components, `Toolbar.tsx`, `dropdown-menu.tsx`, `menubar.tsx`, tests.
