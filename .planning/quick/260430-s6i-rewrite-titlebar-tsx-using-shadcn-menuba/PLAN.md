---
id: 260430-s6i
slug: rewrite-titlebar-tsx-using-shadcn-menuba
status: in-progress
created: 2026-04-30
---

# Rewrite TitleBar.tsx with shadcn Menubar (option 2 — wrapper preserving OIMG visuals)

## Scope

Replace the three `<button>` + custom `<Popover>` constructs in `src/components/shell/TitleBar.tsx` (Codec / View / Help menus) with shadcn `Menubar` primitives from `src/components/ui/menubar.tsx`. Preserve OIMG visual contract: `.titlebar`, `.menu`, `.brand`, `.right`, `.popover`, `.pi`, `.lbl`, `.div`, `.kbd`, `.check`, `.on`, `.pill` classes and `role="banner"` are unchanged.

## Why option 2 works without CSS edits

`src/index.css` defines `.popover`, `.popover .pi`, `.popover .div`, `.popover .lbl`, `.titlebar .menu button` outside any `@layer`. Tailwind v4 utilities (`bg-popover`, `rounded-lg`, `shadow-md`, `hover:bg-muted`, etc.) live inside `@layer utilities` and lose to default-cascade rules. So shadcn's hardcoded Tailwind defaults render but get overridden.

## Changes

1. Drop import of `@/components/ui/Popover`.
2. Add import of `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`, `MenubarSeparator` from `@/components/ui/menubar`.
3. Add import of `cn` from `@/lib/utils`.
4. Replace `<nav className="menu">` with `<Menubar className={cn("menu", "h-auto rounded-none border-0 p-0 gap-[2px]")}` to nullify shadcn's wrapper Tailwind defaults.
5. For each menu (Codec / View / Help):
   - Wrap in `<MenubarMenu open={openKey === KEY} onOpenChange={(o) => onOpenKey(o ? KEY : null)}>` — preserves App-level cross-component coordination with Toolbar.
   - `<MenubarTrigger className={cn(isOpen && "on")}>` — `.titlebar .menu button` and `.on` style handle visuals.
   - `<MenubarContent className="popover">` — Base UI portal+positioner anchors below trigger; OIMG `.popover` paints background, border, shadow, animation.
   - Inside content, replace `<div className="pi check ...">` with `<MenubarItem className={cn("pi check", on && "on")}>`. Replace `<div className="div" />` with `<MenubarSeparator className="div" />`. Keep `<div className="lbl">…</div>` as-is (label is markup, not interactive).
6. Right cluster (privacy/offline pills, version, ⌘K Search button) is untouched.
7. Header comment updated to note the swap and keep the visual-contract reminder.

## Out of scope

- No edits to `App.tsx`, `index.css`, tests, or other components.
- `src/components/ui/Popover.tsx` is still used by `Toolbar.tsx` and stays in place.
- `dropdown-menu.tsx`, `menubar.tsx` remain unmodified — pure consumer-side change.

## Verification

- `bun run typecheck` (or `tsc --noEmit`) passes.
- `bun run build` succeeds.
- `bun run test` — `src/tests/shell.spec.ts` passes (asserts `role="banner"`, theme toggle, Cmd+K palette, no console errors).
- Visual smoke: titlebar layout unchanged; Codec/View/Help open, render OIMG-styled popover, support keyboard arrows + Esc + outside-click via Base UI.

## Risk

- Base UI `Menu` ignores `<MenubarItem>` clicks if the item disables the default close behavior. Default closes on select — matches existing behavior (current items close via `onOpenKey(null)` after action). For Codec items the existing UX keeps the menu open and shows toast — match by NOT calling `onOpenKey(null)` in those handlers; Base UI's `onSelect` default closes. To preserve "stay open" intent for codec selection (current code DOES close — `onClick={() => onSelectCodec(c)}` triggers handler but click also closes via outside dismissal), default close on select is acceptable and matches current behavior.
