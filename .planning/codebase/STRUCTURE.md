# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```
oimg.app/
├── src/                         # All application source
│   ├── main.tsx                 # App bootstrap, React DOM mount
│   ├── App.tsx                  # Root component, store wiring, layout composition
│   ├── index.css                # Global CSS (design tokens, reset, primitives)
│   ├── vite-env.d.ts            # Vite env type declarations
│   ├── components/
│   │   ├── shell/               # App chrome (layout, navigation)
│   │   │   ├── AppShell/        # 4-row CSS grid layout container
│   │   │   ├── TitleBar/        # App title + menu bar
│   │   │   ├── Toolbar/         # Codec selector, view switcher, actions
│   │   │   ├── StatusBar/       # Running state, totals, Pacing pill
│   │   │   └── CommandPalette/  # Keyboard-driven cmdk overlay
│   │   ├── panels/              # Content panes
│   │   │   ├── FilesPane.tsx    # File queue list + drop zone
│   │   │   ├── CenterPane.tsx   # Preview / compare area
│   │   │   ├── InspectorPane.tsx # Codec settings + snippets + report
│   │   │   ├── CodecPanel.tsx   # Format-switching codec settings wrapper
│   │   │   ├── SvgoPanel.tsx    # SVGO plugin toggles
│   │   │   ├── PngPanel.tsx     # OxiPNG level
│   │   │   ├── JpegPanel.tsx    # MozJPEG quality + progressive
│   │   │   ├── WebpPanel.tsx    # libwebp quality + lossless + method
│   │   │   ├── AvifPanel.tsx    # libavif quality + lossless
│   │   │   ├── SnippetPanel.tsx # HTML/CSS snippet generators
│   │   │   ├── ReportPanel.tsx  # Per-file optimization report
│   │   │   └── TweaksPanel.tsx  # Global resize + ICC settings
│   │   ├── file-row/            # File queue row sub-components
│   │   │   ├── ContextMenu.tsx  # Right-click context menu on file rows
│   │   │   └── TargetDensityCheckboxes.tsx # Density variant export selectors
│   │   ├── icons/               # Custom SVG icon components
│   │   │   └── index.tsx
│   │   └── ui/                  # Primitive UI wrappers (base-ui + shadcn)
│   │       ├── Popover.tsx      # @base-ui/react popover wrapper
│   │       ├── Slider.tsx       # @base-ui/react slider wrapper
│   │       ├── Toggle.tsx       # @base-ui/react toggle wrapper
│   │       ├── Tooltip.tsx      # @base-ui/react tooltip wrapper
│   │       ├── Seg.tsx          # Segmented control wrapper
│   │       ├── Section.tsx      # Inspector section layout
│   │       ├── button.tsx       # shadcn button
│   │       ├── button-group.tsx # Grouped button row
│   │       ├── dropdown-menu.tsx # shadcn dropdown menu
│   │       ├── menubar.tsx      # shadcn menubar
│   │       ├── separator.tsx    # shadcn separator
│   │       ├── sonner.tsx       # Toaster wrapper component
│   │       └── switch.tsx       # shadcn switch
│   ├── hooks/                   # Business logic hooks
│   │   ├── useBatchOrchestrate.ts # Pool wiring, batch lifecycle, SVG savings
│   │   ├── useFilePicker.ts     # File drag-drop + File API
│   │   ├── useKeyboardShortcuts.ts # Global keyboard bindings
│   │   ├── useCommandPalette.tsx # Command palette data + open state
│   │   ├── useTotals.ts         # Aggregate file size totals
│   │   └── useTheme.ts          # Theme toggle
│   ├── stores/                  # Zustand state slices
│   │   ├── index.ts             # Barrel re-export
│   │   ├── files.ts             # FileEntryWithBlob registry (byId, order, selectedId)
│   │   ├── settings.ts          # Codec configs, global settings, perFile overrides
│   │   └── runtime.ts           # Batch progress, urlCache, pool coordination
│   ├── workers/                 # Web Worker layer
│   │   ├── worker.ts            # Worker entry; ADAPTERS map; Comlink.expose
│   │   ├── pool.ts              # WorkerPool class + getWorkerPool() singleton
│   │   ├── types.ts             # AdapterFormat, AdapterRunResult, PoolJob, WorkerProxyApi
│   │   ├── svg-adapter.ts       # SVGO pipeline (ArrayBuffer → SVGO → ArrayBuffer)
│   │   ├── svg-config.ts        # buildSvgoConfig() pure function
│   │   ├── png-adapter.ts       # decode → resize → encode → oxipng pipeline
│   │   ├── png-config.ts        # buildPngResizeSettings() pure function
│   │   ├── jpeg-adapter.ts      # MozJPEG encode pipeline
│   │   ├── jpeg-config.ts       # buildJpegSettings() pure function
│   │   ├── webp-adapter.ts      # libwebp encode pipeline
│   │   ├── webp-config.ts       # buildWebpSettings() pure function
│   │   ├── avif-adapter.ts      # libavif encode pipeline (lazy ~2 MB)
│   │   ├── avif-config.ts       # buildAvifSettings() pure function
│   │   └── stub-adapter.ts      # No-op pass-through (test/Phase 2 fallback)
│   ├── lib/                     # Pure utilities (no React, no stores)
│   │   ├── sanitize-svg.ts      # DOMPurify wrapper; main-thread only
│   │   ├── filename.ts          # applyDensitySuffix, deduplicateName
│   │   ├── format.ts            # File format helpers
│   │   ├── icc.ts               # extractPngIcc / embedPngIcc
│   │   ├── live-region.ts       # ARIA live region announce()
│   │   ├── memory-budget.ts     # computeMemoryBudget, estimateJobBytes
│   │   ├── object-url.ts        # Object URL helpers
│   │   ├── sanitize-svg.ts      # DOMPurify XSS sanitization
│   │   ├── sniff.ts             # sniffPngDimensions (PNG header read)
│   │   ├── snippet-registry.ts  # SnippetDef registry
│   │   ├── svg-snippets.ts      # inline-svg, url-encoded-uri generators
│   │   ├── tokenize.tsx         # Token-based text rendering
│   │   └── utils.ts             # General utilities (cn() etc.)
│   ├── data/
│   │   └── defaults.ts          # DEFAULT_CODEC_* and DEFAULT_GLOBAL_SETTINGS constants
│   ├── types/
│   │   └── index.ts             # Domain types: FileEntry, CodecSettings*, FormatId, Density, etc.
│   ├── styles/
│   │   ├── legacy.css           # CSS to be migrated to CSS Modules
│   │   └── primitives.module.css # Shared primitive CSS module
│   └── tests/                   # All Playwright tests + unit-style tests
│       ├── *.spec.ts            # Playwright browser tests
│       ├── *.test.ts            # Node test runner tests (--experimental-strip-types)
│       ├── *.unit.ts            # Importable unit tests (no runner framework)
│       └── fixtures/            # Test fixtures (PNGs, SVGs with XSS payloads)
├── public/                      # Static assets served as-is
├── example-ui/                  # Reference HTML/CSS design files (not compiled)
├── inspired/squoosh/            # Squoosh reference submodule (not imported)
├── scripts/
│   └── ensure-rollup-binding.mjs # postinstall: verify native Rollup binding
├── .planning/                   # GSD planning artifacts (phases, codebase maps)
├── index.html                   # Vite entry HTML
├── vite.config.ts               # Vite configuration
├── package.json                 # Dependencies + scripts
├── tsconfig.json                # TypeScript project references root
├── tsconfig.app.json            # App TypeScript config (bundler moduleResolution)
├── tsconfig.node.json           # Node TypeScript config (for vite.config.ts)
├── playwright.config.ts         # Playwright test runner config
└── components.json              # shadcn CLI config
```

## Directory Purposes

**`src/components/shell/`:**
- Purpose: App chrome — layout container, navigation, global overlays
- Contains: CSS-grid layout (AppShell), TitleBar, Toolbar, StatusBar, CommandPalette; each in its own subdirectory with a co-located `.module.css`
- Key files: `AppShell/AppShell.tsx`, `Toolbar/Toolbar.tsx`, `StatusBar/StatusBar.tsx`

**`src/components/panels/`:**
- Purpose: The three main work-area panes and per-codec settings panels
- Contains: FilesPane, CenterPane, InspectorPane, and all format-specific codec setting panels
- Key files: `FilesPane.tsx`, `InspectorPane.tsx`, `SvgoPanel.tsx`, `PngPanel.tsx`, `JpegPanel.tsx`, `WebpPanel.tsx`, `AvifPanel.tsx`

**`src/components/ui/`:**
- Purpose: Thin wrappers around `@base-ui/react` primitives and shadcn-generated components
- Contains: Popover, Slider, Toggle, Tooltip, Seg, Section, button, dropdown-menu, menubar, separator, sonner, switch
- Key note: These are the only components that may import `@base-ui/react` directly

**`src/hooks/`:**
- Purpose: All business logic requiring React hooks (effects, memos, subscriptions)
- Contains: Batch orchestration, file picking, keyboard shortcuts, command palette, totals aggregation
- Key constraint: File/optimize logic belongs here (not inline in components); see memory note `architecture_file_business_logic.md`

**`src/stores/`:**
- Purpose: Single source of truth for all application state via zustand
- Contains: Three slices (`files`, `settings`, `runtime`) + barrel `index.ts`
- Key constraint: Cross-store reads use `getState()` never hooks; never pass store state as deeply nested props

**`src/workers/`:**
- Purpose: Web Worker entry + WorkerPool + per-format codec adapters + config builders
- Contains: `worker.ts` (entry), `pool.ts` (orchestrator), per-format `*-adapter.ts` and `*-config.ts` pairs, `types.ts`
- Key constraint: New adapters require explicit literal-path entry in `worker.ts` ADAPTERS map; no template literals

**`src/lib/`:**
- Purpose: Pure utility functions with no React or store dependencies
- Contains: File format helpers, ICC profile handling, ARIA live region, memory budget, filename utilities, snippet generators, DOMPurify wrapper
- Key constraint: `sanitize-svg.ts` may only run on the main thread (requires `document`)

**`src/types/`:**
- Purpose: Shared TypeScript domain types and interfaces
- Contains: Single `index.ts` — `FileEntry`, `FileEntryWithBlob`, `CodecSettings*`, `FormatId`, `Density`, `SnippetId`, `GlobalSettings`

**`src/tests/`:**
- Purpose: All automated tests (Playwright e2e, Playwright component integration, Node unit)
- Contains: `*.spec.ts` (Playwright), `*.test.ts` (Node `--experimental-strip-types`), `*.unit.ts` (importable logic tests), `fixtures/` (PNG/SVG test assets)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM mount + COOP check + font import
- `src/App.tsx`: Root component, store subscriptions, layout composition
- `src/workers/worker.ts`: Worker entry point, Comlink.expose

**Configuration:**
- `vite.config.ts`: Build + dev server settings
- `tsconfig.app.json`: App TypeScript (imports resolve with `moduleResolution: "bundler"`)
- `playwright.config.ts`: Test runner (Playwright)
- `components.json`: shadcn component scaffolding

**Core Logic:**
- `src/workers/pool.ts`: WorkerPool class + singleton
- `src/hooks/useBatchOrchestrate.ts`: Batch optimize orchestration
- `src/stores/files.ts`: File registry + `addSourceWithVariants`
- `src/stores/runtime.ts`: Batch progress + Object URL cache
- `src/lib/memory-budget.ts`: `computeMemoryBudget` + `estimateJobBytes`
- `src/lib/sanitize-svg.ts`: Post-SVGO DOMPurify sanitization

**Types:**
- `src/types/index.ts`: All domain types
- `src/workers/types.ts`: Worker-specific types

## Naming Conventions

**Files:**
- React components: PascalCase, `.tsx` extension (e.g., `FilesPane.tsx`, `AppShell.tsx`)
- Hooks: camelCase prefixed with `use`, `.ts` or `.tsx` (e.g., `useBatchOrchestrate.ts`)
- Stores: camelCase, `.ts` (e.g., `files.ts`, `settings.ts`)
- Worker adapters: kebab-case `<format>-adapter.ts` (e.g., `png-adapter.ts`)
- Worker config builders: kebab-case `<format>-config.ts` (e.g., `png-config.ts`)
- CSS Modules: camelCase module name matches component (`appShell.module.css` for `AppShell.tsx`)
- Utilities: camelCase (e.g., `filename.ts`, `memory-budget.ts`)
- Tests: `<subject>.spec.ts` (Playwright) or `<subject>.test.ts` (Node) or `<subject>.unit.ts`

**Directories:**
- Shell components: PascalCase subdirectory with index file (e.g., `AppShell/AppShell.tsx`)
- Panels: flat files in `panels/` (no subdirectory)

## Where to Add New Code

**New codec format (e.g., JPEG XL):**
1. Adapter: `src/workers/jxl-adapter.ts` — implement `run(input, settings): Promise<AdapterRunResult>`
2. Config builder: `src/workers/jxl-config.ts` — implement `buildJxlSettings({...})`
3. Register in ADAPTERS map: `src/workers/worker.ts` — add `jxl: () => import('./jxl-adapter')` as a literal-path entry
4. Extend `AdapterFormat` union: `src/workers/types.ts`
5. Extend `FormatId` union: `src/types/index.ts`
6. Add codec settings type `CodecSettingsJxl`: `src/types/index.ts`
7. Add store slice + defaults: `src/stores/settings.ts`, `src/data/defaults.ts`
8. Add settings panel: `src/components/panels/JxlPanel.tsx`
9. Wire in `useBatchOrchestrate.ts` settings resolution + `startOptimize` dispatch

**New inspector panel:**
- Add `src/components/panels/<Name>Panel.tsx`
- Import and render from `src/components/panels/InspectorPane.tsx`

**New shell component:**
- Create `src/components/shell/<Name>/<Name>.tsx` + `<name>.module.css`
- Import and compose in `src/App.tsx` or `src/components/shell/AppShell/AppShell.tsx`

**New utility:**
- Add to `src/lib/<name>.ts` if it has no React/store dependencies
- Add to appropriate hook in `src/hooks/` if it needs React lifecycle

**New Playwright test:**
- Add `src/tests/<subject>.spec.ts`
- Use `src/tests/fixtures/` for test assets

**New store action:**
- Add method signature to the store interface in the relevant `src/stores/<slice>.ts`
- Add implementation in the `create()` call
- Cross-store reads must use `getState()`, not hooks

## Special Directories

**`example-ui/`:**
- Purpose: Reference HTML/CSS design files with locked design tokens (oklch palette, typography)
- Generated: No
- Committed: Yes (source of truth for design token values)

**`inspired/squoosh/`:**
- Purpose: Squoosh source reference for architecture and codec patterns (do not import)
- Generated: No
- Committed: Yes (git submodule)

**`.planning/`:**
- Purpose: GSD planning artifacts — phase plans, codebase maps, research docs
- Generated: By GSD commands
- Committed: Yes

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (`vite build`)
- Committed: No (in `.gitignore`)

**`src/tests/fixtures/`:**
- Purpose: Binary test assets (PNGs with ICC profiles, SVGs with XSS payloads)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-12*
