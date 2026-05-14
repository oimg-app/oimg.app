---
phase: 01-foundation
milestone: UI Port (React + TypeScript + Tailwind + Shadcn)
created: 2026-05-14
status: draft
---

# Walking Skeleton: oimg.app UI Port

The **thinnest end-to-end stack** that proves the foundation works and that all subsequent phases will build on without renegotiating architectural decisions.

After Phase 1 ships, `npm run dev` serves a dark-themed OIMG AppShell with three resizable panes (Files / Preview / Inspector) at `http://localhost:5173`. Nothing is wired to data yet — that begins in Phase 2.

---

## End-to-End Stack

| Layer | Choice | Locked in Phase 1 by |
|-------|--------|----------------------|
| **UI framework** | React 19.2.x | `package.json` (existing) |
| **Build tool** | Vite 7.3.2 | `package.json` (existing) — CLAUDE.md says "Vite 8" but actual lock is 7.3.2; resolve later if upgrade desired |
| **Language** | TypeScript 5.9 with `moduleResolution: bundler`, `allowImportingTsExtensions` | `tsconfig.json` (existing) |
| **CSS framework** | Tailwind CSS v4.2.4 — CSS-only config (no `tailwind.config.ts`) | Plan 02 — `src/index.css` `@theme inline` blocks |
| **Tailwind plugin** | `@tailwindcss/vite@4.2.4` | Plan 02 (via existing vite.config) |
| **Design tokens** | OIMG oklch palette ported from `example-ui/OIMG.html`; dark default via `.dark` class + `@custom-variant dark (&:is(.dark *))` | Plan 02 |
| **Fonts** | `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono`, imported in `src/main.tsx` and `src/index.css` respectively | Existing main.tsx + Plan 02 |
| **Icons** | `@phosphor-icons/react@2.1.10` — used inline in components; lucide→phosphor name map in `src/lib/stub-data.ts` (`ICON_MAP`) | Plan 04 (ICON-01) |
| **State** | `nanostores@1.3.x` + `@nanostores/react@1.1.0` — **NOT used in Phase 1**; first atoms created Phase 2 | Phase 2+ |
| **Component primitives** | shadcn `radix-lyra` style, generated via `npx shadcn@4.7.0 add` into `src/components/ui/` | Plan 03 (17 components) |
| **Resizable layout** | `react-resizable-panels@4.11.0` wrapped by shadcn `resizable.tsx` | Plan 05 |
| **Toasts** | `sonner@2.0.7` via shadcn `sonner.tsx` — **NOT mounted in Phase 1**; added when first toast call appears (Phase 2) | Phase 2+ |
| **Routing** | None (single-page application; no router) | Implicit — never introduced |
| **Persistence** | None in Phase 1; Phase 2+ may add `idb-keyval` for preset storage | Phase 2+ |
| **Worker pool** | `comlink@4.4.2` — **not in scope for the UI Port milestone**; reconnected in WRKR-01..05 (v2) | v2 milestone |
| **Test framework** | Playwright 1.59.1 (E2E) + Node `--experimental-strip-types` (unit) | Existing playwright.config.ts |
| **Lint/format** | Not configured in Phase 1 (no eslint config); rely on `tsc -b` for type safety | Phase 7 may add |
| **Deployment** | Cloudflare Pages with COOP/COEP headers for SharedArrayBuffer (needed by jSquash MT in v2) | Out of scope for UI Port milestone |

---

## Directory Layout (locked)

```
src/
├── main.tsx                       # Entry — imports fonts + index.css + App (existing)
├── App.tsx                        # Thin shell — renders <AppShell />              [Plan 05]
├── index.css                      # Tailwind v4 + @theme inline + :root + .dark    [Plan 02]
├── styles/
│   └── legacy.css                 # Empty stub — satisfies @import in index.css     [Plan 02]
├── components/
│   ├── shell/
│   │   └── AppShell/
│   │       └── AppShell.tsx       # 3-pane PanelGroup layout                       [Plan 05]
│   ├── panels/
│   │   ├── FilesPane.tsx          # Skeleton placeholder                            [Plan 05]
│   │   ├── CenterPane.tsx         # Skeleton placeholder                            [Plan 05]
│   │   └── InspectorPane.tsx      # Skeleton placeholder                            [Plan 05]
│   └── ui/                        # 17 shadcn components                            [Plan 03]
│       ├── button.tsx
│       ├── separator.tsx
│       ├── tooltip.tsx
│       ├── popover.tsx
│       ├── slider.tsx
│       ├── dialog.tsx
│       ├── tabs.tsx
│       ├── input.tsx
│       ├── checkbox.tsx
│       ├── switch.tsx
│       ├── dropdown-menu.tsx
│       ├── context-menu.tsx
│       ├── menubar.tsx
│       ├── kbd.tsx
│       ├── resizable.tsx
│       ├── sonner.tsx
│       └── spinner.tsx
├── lib/
│   ├── utils.ts                   # cn() helper                                     [Plan 02]
│   ├── stub-data.ts               # STUB_FILES, SVGO_PLUGINS, CODECS, ICON_MAP      [Plan 04]
│   └── format.ts                  # fmtBytes, fmtPct                                [Plan 04]
└── tests/
    ├── foundation.spec.ts         # Playwright smoke (dark bg, 3 panes)             [Plan 01]
    ├── stub-data.test.ts          # Node unit (12 files, 22 plugins)                [Plan 01]
    └── format.test.ts             # Node unit (fmtBytes, fmtPct)                    [Plan 01]
```

**Future directories** (introduced in later phases — locked here so the layout is stable):
- `src/stores/` — Phase 2+ — nanostores atoms (`files.ts`, `settings.ts`, `ui.ts`, `runtime.ts`)
- `src/hooks/` — Phase 2+ — custom hooks (file orchestration, keyboard shortcuts)
- `src/components/file-row/` — Phase 2 — file list row + context menu
- `src/components/shell/{TitleBar,Toolbar,StatusBar,CommandPalette}/` — Phase 3
- `src/workers/` — v2 milestone — jSquash WASM worker pool

---

## Architectural Decisions (locked for the UI Port milestone)

1. **Tailwind v4, CSS-only configuration.** All design tokens live in `src/index.css` via `@theme inline {}` blocks plus `:root` (light) and `.dark` (dark) variable declarations. No `tailwind.config.ts` will be created. Future phases extend tokens by editing `index.css` only.

2. **Dark theme default via `.dark` class on AppShell root.** Theme switching (Phase 3 NAV-01 / Phase 7) will toggle this class. We do NOT use `data-theme` attribute despite OIMG.html using it — git HEAD's `@custom-variant dark (&:is(.dark *))` pattern uses the class-based approach.

3. **Path alias `@/*` → `./src/*`.** Configured in `tsconfig.json` (existing) and used by all generated shadcn components. All new imports MUST use `@/` not relative `../../`.

4. **Named exports for components and utilities; default export only for `App.tsx`.** Consistent with shadcn output and the prior codebase.

5. **No CSS Modules. No inline `style={}`. Tailwind utility classes only.** OIMG-specific tokens are referenced via arbitrary-value syntax: `bg-[var(--color-bg-0)]`, `border-[var(--color-line)]`, `h-[var(--height-pane-header)]`.

6. **STORE-08 from day one.** No `useState` for data in components. Only ephemeral hover/focus state is allowed. Phase 1 has zero `useState`. Phase 2 introduces `useStore(atom)` for data.

7. **Circular ESM guard.** When `src/stores/ui.ts` is created in Phase 3, it must NOT import from `files.ts`, `runtime.ts`, or `settings.ts`. Computed views that cross stores live in component files via `useStore` composition.

8. **Test layout: `src/tests/`.** Playwright reads `**/*.spec.ts` here; Node unit tests use `*.test.ts`. Tests live alongside source, not in a separate `tests/` root.

9. **Shadcn `radix-lyra` style + phosphor icon library.** Locked in `components.json`. Future shadcn additions use the same style to keep visual consistency.

10. **`@fontsource-variable/inter` lives in `src/main.tsx`, `@fontsource-variable/jetbrains-mono` lives in `src/index.css`.** This is the git HEAD convention; we preserve it. Do NOT consolidate.

11. **Vite 7.3.2 (not 8).** CLAUDE.md mentions Vite 8 but the pinned version is 7.3.2. Locking on 7.3.2 for the UI Port milestone; upgrade decision deferred.

---

## What This Skeleton Does NOT Include (intentional)

These are scoped to later phases and MUST NOT be introduced in Phase 1:

- Any nanostores atom or `useStore` call.
- Any business logic (file optimization, codec calls, ZIP generation).
- Any worker, Web Worker, or comlink usage.
- Any `idb-keyval` / persistence layer.
- TitleBar, Toolbar, StatusBar, CommandPalette components.
- Real file list rows (the FilesPane in Phase 1 is just a header strip).
- Inspector tabs (Codec / SVGO / Output / Report).
- Center compare stage.
- Theme toggle (the toggle UI is Phase 3; the underlying CSS supports it via `.dark` class — Phase 3 just adds a button that flips it).
- Sonner toast container (added when the first `toast()` call appears in Phase 2).

---

## Validation Contract

A green Phase 1 means:

1. `npm install` — exits 0, populates `node_modules/`.
2. `npm run build` — exits 0, produces `dist/index.html` + assets.
3. `node --experimental-strip-types src/tests/stub-data.test.ts` — `6 passed, 0 failed`.
4. `node --experimental-strip-types src/tests/format.test.ts` — `8 passed, 0 failed`.
5. `npm test -- --project=chromium` — `3 passed` (dark bg, 3 panes, viewport fills).
6. Human approval of the visual checkpoint in Plan 05 Task 5.

When all six gates pass, the Walking Skeleton is the ground truth for Phase 2.
