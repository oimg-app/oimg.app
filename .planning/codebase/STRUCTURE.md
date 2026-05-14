# Codebase Structure

**Analysis Date:** 2026-05-14

## Directory Layout

```
oimg.app/
├── src/                        # Application source (all TypeScript/TSX)
│   ├── main.tsx                # Entry point — React root mount + COOP check
│   ├── App.tsx                 # Root component — store wiring + layout composition
│   ├── index.css               # Global CSS reset + design tokens
│   ├── vite-env.d.ts           # Vite type shims
│   ├── components/             # React UI components
│   │   ├── shell/              # Layout chrome (AppShell, TitleBar, Toolbar, StatusBar, CommandPalette)
│   │   ├── panels/             # Pane-level components (FilesPane, CenterPane, InspectorPane, codec panels)
│   │   ├── file-row/           # File queue row sub-components (ContextMenu, TargetDensityCheckboxes)
│   │   ├── icons/              # Icon re-exports (index.tsx)
│   │   └── ui/                 # shadcn/Radix primitives (Button, Popover, Slider, Toggle, etc.)
│   ├── stores/                 # Nanostores state atoms + action functions
│   │   ├── index.ts            # Barrel re-export of all three stores
│   │   ├── files.ts            # filesStore — file entries, order, selection
│   │   ├── settings.ts         # settingsStore — codec configs, SVGO plugins, per-file overrides
│   │   └── runtime.ts          # runtimeStore — batch queue, progress, urlCache, preview debounce
│   ├── workers/                # Web Worker layer — pool + adapters + types
│   │   ├── pool.ts             # WorkerPool class + getWorkerPool() singleton
│   │   ├── worker.ts           # Worker entry point (Comlink.expose)
│   │   ├── types.ts            # Shared types: AdapterFormat, PoolJob, AdapterRunResult, AdapterError
│   │   ├── svg-adapter.ts      # SVGO optimize adapter
│   │   ├── svg-config.ts       # buildSvgoConfig() — separated for unit-testability
│   │   ├── png-adapter.ts      # @jsquash/png decode + resize + oxipng encode
│   │   ├── png-config.ts       # buildPngResizeSettings()
│   │   ├── jpeg-adapter.ts     # @jsquash/jpeg (MozJPEG) encode
│   │   ├── jpeg-config.ts      # buildJpegSettings()
│   │   ├── webp-adapter.ts     # @jsquash/webp encode
│   │   ├── webp-config.ts      # buildWebpSettings()
│   │   ├── avif-adapter.ts     # @jsquash/avif encode (lazy chunk, ~2 MB)
│   │   ├── avif-config.ts      # buildAvifSettings()
│   │   └── stub-adapter.ts     # No-op passthrough for testing
│   ├── hooks/                  # Custom React hooks (orchestration + UI logic)
│   │   ├── useBatchOrchestrate.ts   # Pool setup, startOptimize, cancelBatch
│   │   ├── useFilePicker.ts         # Drag-and-drop + file input ingestion
│   │   ├── useCommandPalette.tsx    # cmdk groups + open state
│   │   ├── useKeyboardShortcuts.ts  # Global keyboard bindings
│   │   ├── useTotals.ts             # Derived totals from filesStore (count, bytes, %)
│   │   └── useTheme.ts              # next-themes wrapper
│   ├── lib/                    # Pure utilities (no React, no stores)
│   │   ├── filename.ts         # applyDensitySuffix, deduplicateName
│   │   ├── format.ts           # fmtBytes, fmtPct
│   │   ├── icc.ts              # ICC profile extraction
│   │   ├── live-region.ts      # ARIA live region helper + announce()
│   │   ├── memory-budget.ts    # computeMemoryBudget, estimateJobBytes
│   │   ├── object-url.ts       # Object URL helpers
│   │   ├── sanitize-svg.ts     # DOMPurify post-SVGO sanitizer (main thread only)
│   │   ├── sniff.ts            # sniffPngDimensions()
│   │   ├── snippet-registry.ts # SNIPPET_REGISTRY — format → snippet generator map
│   │   ├── svg-snippets.ts     # generateInlineSvg, generateDataUri
│   │   ├── tokenize.tsx        # SVG tokenizer for snippet display
│   │   └── utils.ts            # cn() (tailwind-merge + clsx)
│   ├── data/                   # Static defaults
│   │   └── defaults.ts         # DEFAULT_CODEC_SVG/PNG/JPEG/WEBP/AVIF, DEFAULT_GLOBAL_SETTINGS
│   ├── types/                  # Domain type definitions
│   │   └── index.ts            # FormatId, FileEntry, FileStatus, Density, CodecSettings*, SnippetId
│   ├── styles/                 # Global style files
│   │   ├── primitives.module.css   # Shared CSS Modules primitives
│   │   └── legacy.css              # CSS carried from early phases (migration in progress)
│   └── tests/                  # Playwright + unit tests
│       ├── fixtures/           # Test fixtures (SVGs, PNGs, JS instrumentation helpers)
│       ├── *.spec.ts           # Playwright E2E specs
│       ├── *.test.ts           # Node unit tests (--experimental-strip-types)
│       └── *.unit.ts           # Pure unit tests (no Playwright, no browser)
├── public/                     # Static assets served verbatim
│   └── r/                      # (static sub-path)
├── scripts/                    # Build helper scripts
│   └── ensure-rollup-binding.mjs   # postinstall: ensures correct Rollup native binding
├── example-ui/                 # Reference HTML — locked design tokens (oklch palette, fonts)
├── inspired/                   # Read-only reference repos (Squoosh, SVGOMG, url-encoder, version-0)
├── .planning/                  # GSD planning artifacts
│   └── codebase/               # Codebase map documents (this directory)
├── .agents/skills/             # Agent skill definitions
├── .claude/skills/             # Claude skill definitions
├── index.html                  # Vite HTML entry
├── vite.config.ts              # Vite config (COOP/COEP headers, worker ES format, WASM assets)
├── tsconfig.json               # TypeScript root config
├── tsconfig.app.json           # App-specific TS config
├── tsconfig.node.json          # Node scripts TS config
├── playwright.config.ts        # Playwright test config
├── components.json             # shadcn component registry config
└── package.json                # Dependencies + scripts
```

## Directory Purposes

**`src/components/shell/`:**
- Purpose: Application chrome — layout frame and global UI chrome
- Contains: `AppShell` (4-slot CSS grid), `TitleBar`, `Toolbar`, `StatusBar`, `CommandPalette`, `BackpressureIndicator`
- Key files: `AppShell/AppShell.tsx`, `AppShell/appShell.module.css`

**`src/components/panels/`:**
- Purpose: Pane-level UI for the three-column work area
- Contains: `FilesPane`, `CenterPane`, `InspectorPane`, plus format-specific codec settings panels (`SvgoPanel`, `PngPanel`, `JpegPanel`, `WebpPanel`, `AvifPanel`), `SnippetPanel`, `ReportPanel`, `TweaksPanel`
- Key files: `FilesPane.tsx`, `CenterPane.tsx`, `InspectorPane.tsx`

**`src/components/ui/`:**
- Purpose: Design system primitives (shadcn / Radix-based)
- Contains: `Button`, `Popover`, `Slider`, `Toggle`, `Tooltip`, `Checkbox`, `Input`, `Tabs`, `ContextMenu`, `DropdownMenu`, `Dialog`, `Separator`, `Seg`, `Spinner`, `Sonner`, etc.
- Note: Add new shadcn components here. Run `npx shadcn add <component>` to install.

**`src/stores/`:**
- Purpose: All application state
- Contains: Three nanostores `map<T>` atoms with exported action functions
- Note: `stores/index.ts` barrel-exports all three stores; import from `@/stores` rather than individual files in components

**`src/workers/`:**
- Purpose: Off-main-thread codec execution
- Contains: Pool singleton, worker entry, one adapter + one config file per format
- Note: `*-config.ts` files are separated from adapters so unit tests can import settings builders without importing `svgo/browser` or jSquash (which only resolve inside Vite browser bundles)

**`src/hooks/`:**
- Purpose: Encapsulate React-lifecycle + store interaction patterns
- Contains: All custom hooks; file/optimize business logic belongs here, NOT inline in components (per project memory constraint)

**`src/lib/`:**
- Purpose: Pure functions — no React, no stores, no side effects
- Contains: Utility modules imported by stores, hooks, and components

**`src/types/`:**
- Purpose: Single source of domain types
- Contains: `index.ts` only — all exported types, no runtime code

**`src/data/`:**
- Purpose: Static default values for codec settings
- Contains: `defaults.ts` — default codec config objects imported by `settingsStore`

**`src/tests/`:**
- Purpose: All tests — Playwright E2E specs and Node unit tests live together
- Contains: `*.spec.ts` (Playwright), `*.test.ts` (Node `--experimental-strip-types`), `*.unit.ts` (pure unit), `fixtures/`

**`inspired/`:**
- Purpose: Read-only reference codebases (Squoosh, SVGOMG, url-encoder, version-0 prototype)
- Note: Do NOT import from `inspired/` in application code. Reference only.

**`example-ui/`:**
- Purpose: Locked design token reference (`OIMG.html` — oklch palette, Inter + JetBrains Mono, accent green ~145°)
- Note: Port design tokens from here verbatim; do not redesign.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React app bootstrap, COOP check
- `index.html`: Vite HTML shell
- `src/workers/worker.ts`: Web Worker entry point

**Configuration:**
- `vite.config.ts`: Vite build config (worker format, WASM assets, COOP/COEP headers, path alias `@`)
- `tsconfig.app.json`: TypeScript config for app source
- `playwright.config.ts`: Playwright test config
- `components.json`: shadcn component registry

**Core Logic:**
- `src/App.tsx`: Root wiring
- `src/stores/files.ts`: File state + actions
- `src/stores/runtime.ts`: Batch orchestration state + `enqueuePreview`
- `src/workers/pool.ts`: WorkerPool class

**Testing:**
- `src/tests/`: All tests
- `src/tests/fixtures/`: XSS SVGs, PNG fixtures, instrumentation helpers

## Naming Conventions

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `FilesPane.tsx`, `AppShell.tsx`)
- CSS Modules: camelCase matching component name with `.module.css` (e.g., `appShell.module.css`)
- Hooks: camelCase prefixed with `use` (e.g., `useBatchOrchestrate.ts`)
- Stores: camelCase with `Store` suffix (e.g., `files.ts` exports `filesStore`)
- Worker adapters: `{format}-adapter.ts` (e.g., `svg-adapter.ts`, `png-adapter.ts`)
- Worker configs: `{format}-config.ts` (e.g., `svg-config.ts`)
- Tests: `{subject}.spec.ts` (Playwright E2E), `{subject}.test.ts` (Node unit), `{subject}.unit.ts` (pure)

**Directories:**
- kebab-case for multi-word directories (e.g., `file-row/`, `shell/`)
- PascalCase for component-specific sub-directories that match the component (e.g., `AppShell/`, `CommandPalette/`)

## Where to Add New Code

**New codec format (e.g., JXL):**
1. Add adapter: `src/workers/jxl-adapter.ts`
2. Add config builder: `src/workers/jxl-config.ts`
3. Add literal import entry to `ADAPTERS` map in `src/workers/worker.ts`
4. Extend `AdapterFormat` union in `src/workers/types.ts`
5. Extend `FormatId` in `src/types/index.ts`
6. Add codec settings type to `src/types/index.ts`
7. Add default config to `src/data/defaults.ts`
8. Add settings panel: `src/components/panels/JxlPanel.tsx`
9. Add snippet registry entry in `src/lib/snippet-registry.ts` if format produces snippets

**New snippet type:**
- Add entry to `SNIPPET_REGISTRY` in `src/lib/snippet-registry.ts`
- Add generator function in `src/lib/svg-snippets.ts` (or new `{format}-snippets.ts`)
- Do NOT add `switch(file.format)` to `SnippetPanel`

**New UI component (primitive):**
- Location: `src/components/ui/{ComponentName}.tsx`
- Use `npx shadcn add <component>` if a shadcn component exists

**New panel or pane component:**
- Location: `src/components/panels/{Name}.tsx`

**New shell chrome component:**
- Location: `src/components/shell/{Name}/{Name}.tsx` with co-located `{name}.module.css`

**New hook:**
- Location: `src/hooks/use{Name}.ts`
- Business logic (file handling, optimization) belongs in hooks, not components

**New store action:**
- Add exported function to the relevant store file (`src/stores/files.ts`, `src/stores/settings.ts`, or `src/stores/runtime.ts`)
- Re-export from `src/stores/index.ts` barrel

**New utility (pure function):**
- Location: `src/lib/{name}.ts`

**New test:**
- Playwright E2E: `src/tests/{subject}.spec.ts`
- Node unit test: `src/tests/{subject}.test.ts`
- Pure unit (no browser, no Playwright): `src/tests/{subject}.unit.ts`

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow planning artifacts (PROJECT.md, ROADMAP.md, phase plans, codebase map)
- Generated: Partially (by GSD commands)
- Committed: Yes

**`.agents/skills/`:**
- Purpose: Agent skill definitions (SKILL.md indexes + rules)
- Generated: No
- Committed: Yes

**`inspired/`:**
- Purpose: Reference-only submodule repos (Squoosh, SVGOMG, url-encoder, version-0)
- Generated: No
- Committed: Yes (as subdirectories with their own `.git`)
- Warning: Do NOT import from `inspired/` in application code

**`example-ui/`:**
- Purpose: Locked design reference HTML (`OIMG.html`)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-14*
