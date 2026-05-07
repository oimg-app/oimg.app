# Codebase Structure

**Analysis Date:** 2026-05-07

## Directory Layout

```
oimg.app/
├── src/
│   ├── App.tsx                        # Root React component; wires stores + shell
│   ├── main.tsx                       # React entry point; COOP/COEP check; font imports
│   ├── index.css                      # Global CSS resets, Tailwind directives
│   ├── vite-env.d.ts                  # Vite env type shim
│   │
│   ├── components/
│   │   ├── shell/                     # App-level chrome (layout, navigation, overlays)
│   │   │   ├── AppShell/              # 4-row CSS grid layout wrapper
│   │   │   ├── TitleBar/              # Title, theme toggle, codec selector, view switcher
│   │   │   ├── Toolbar/               # Run/Cancel/Add buttons, workers pill
│   │   │   ├── StatusBar/             # Progress, totals, backpressure indicator
│   │   │   ├── CommandPalette/        # Cmd+K launcher
│   │   │   └── BackpressureIndicator.tsx
│   │   ├── panels/                    # Content panes (files queue, preview, inspector)
│   │   │   ├── FilesPane.tsx          # File list / drag-drop target (left pane)
│   │   │   ├── CenterPane.tsx         # Preview / split-view (center pane)
│   │   │   ├── InspectorPane.tsx      # Right panel — codec, snippets, report
│   │   │   ├── CodecPanel.tsx         # Codec selector segmented controls
│   │   │   ├── SvgoPanel.tsx          # SVGO plugin toggles + live savings
│   │   │   ├── SnippetPanel.tsx       # HTML/CSS snippet copy (registry-driven)
│   │   │   ├── ReportPanel.tsx        # Per-file optimization report
│   │   │   └── TweaksPanel.tsx        # Global resize/metadata settings
│   │   ├── file-row/                  # File queue row sub-components
│   │   │   ├── ContextMenu.tsx
│   │   │   ├── SourceDensityControl.tsx
│   │   │   └── TargetDensityCheckboxes.tsx
│   │   ├── icons/
│   │   │   └── index.tsx              # Custom SVG icon components
│   │   └── ui/                        # Design-system primitives (base-ui wrappers)
│   │       ├── button.tsx             # Button variant (CVA-based)
│   │       ├── button-group.tsx
│   │       ├── Popover.tsx            # @base-ui/react Popover wrapper
│   │       ├── Slider.tsx             # @base-ui/react Slider wrapper
│   │       ├── Toggle.tsx             # @base-ui/react Toggle wrapper
│   │       ├── Tooltip.tsx            # @base-ui/react Tooltip wrapper
│   │       ├── Seg.tsx                # Segmented control (codec selector)
│   │       ├── Section.tsx            # Inspector section wrapper
│   │       ├── dropdown-menu.tsx
│   │       ├── menubar.tsx
│   │       ├── separator.tsx
│   │       ├── sonner.tsx             # Sonner Toaster wrapper
│   │       └── switch.tsx             # @base-ui/react Switch wrapper
│   │
│   ├── hooks/                         # Custom React hooks (business logic, NO inline in components)
│   │   ├── useBatchOrchestrate.ts     # Pool setup, startOptimize, cancelBatch, batch subscribers
│   │   ├── useFilePicker.ts           # Drag-drop + file input ingestion → filesStore
│   │   ├── useCommandPalette.tsx      # Cmd+K command groups builder
│   │   ├── useKeyboardShortcuts.ts    # Global keyboard bindings
│   │   ├── useTotals.ts               # Aggregate bytes-saved totals from filesStore
│   │   └── useTheme.ts                # next-themes wrapper
│   │
│   ├── stores/                        # Zustand global state
│   │   ├── index.ts                   # Barrel re-export
│   │   ├── files.ts                   # useFilesStore — canonical file list + CRUD + variant fan-out
│   │   ├── settings.ts                # useSettingsStore — codec configs + global settings + snippet toggles
│   │   └── runtime.ts                 # useRuntimeStore — queue, inFlight, URL cache, throttle, preview debounce
│   │
│   ├── workers/                       # Web Worker layer
│   │   ├── worker.ts                  # Comlink.expose({ runJob }) — worker entry point
│   │   ├── pool.ts                    # WorkerPool class + getWorkerPool() singleton
│   │   ├── types.ts                   # AdapterFormat, AdapterMeta, PoolJob, WorkerProxyApi, AdapterError
│   │   ├── svg-adapter.ts             # SVGO optimize() pipeline
│   │   ├── svg-config.ts              # buildSvgoConfig() — extracted for unit testing
│   │   ├── png-adapter.ts             # @jsquash/png decode + resize + encode pipeline
│   │   ├── png-config.ts              # buildPngResizeSettings() — extracted for unit testing
│   │   └── stub-adapter.ts            # Byte-equal passthrough (test placeholder)
│   │
│   ├── lib/                           # Pure utilities (no React, no stores)
│   │   ├── sanitize-svg.ts            # DOMPurify wrapper — main-thread SVG XSS sanitization
│   │   ├── snippet-registry.ts        # SNIPPET_REGISTRY — SnippetDef map keyed by SnippetId
│   │   ├── svg-snippets.ts            # generateInlineSvg(), generateDataUri()
│   │   ├── filename.ts                # applyDensitySuffix(), deduplicateName()
│   │   ├── format.ts                  # Human-readable file size formatting
│   │   ├── sniff.ts                   # sniffPngDimensions() — reads PNG IHDR without full decode
│   │   ├── memory-budget.ts           # computeMemoryBudget(), estimateJobBytes()
│   │   ├── object-url.ts              # Object URL utilities
│   │   ├── live-region.ts             # ARIA live region announcements
│   │   ├── tokenize.tsx               # SVG snippet tokenizer (syntax highlight)
│   │   └── utils.ts                   # cn() class merge helper (clsx + tailwind-merge)
│   │
│   ├── data/
│   │   └── defaults.ts                # DEFAULT_CODEC_SVG, DEFAULT_CODEC_PNG, etc.
│   │
│   ├── types/
│   │   └── index.ts                   # All domain types: FileEntry, FormatId, CodecSettings*, SnippetId
│   │
│   ├── styles/
│   │   ├── legacy.css                 # App-grid rules, legacy resets
│   │   └── primitives.module.css      # Shared primitive styles
│   │
│   └── tests/                         # All test files
│       ├── *.spec.ts                  # Playwright E2E + integration specs (matched by playwright.config.ts)
│       ├── *.test.ts                  # Node unit tests (run via --experimental-strip-types)
│       ├── *.unit.ts                  # Logic-only unit tests (run manually / CI script)
│       └── fixtures/                  # Test fixtures: PNGs, XSS SVGs, synthetic data
│
├── public/                            # Static assets (served as-is by Vite)
├── dist/                              # Build output (gitignored)
├── example-ui/                        # Design reference HTML (locked design tokens)
├── inspired/                          # Reference implementations (squoosh, svgomg, url-encoder)
├── scripts/
│   └── ensure-rollup-binding.mjs      # postinstall: ensures Rollup Darwin x64 binding
├── vite.config.ts                     # Vite config: React plugin, Tailwind, worker ES format, aliases
├── tsconfig.json                      # TypeScript config
├── playwright.config.ts               # Playwright: Chromium only, testMatch *.spec.ts
└── package.json
```

## Directory Purposes

**`src/components/shell/`:**
- Purpose: App chrome — layout container plus TitleBar, Toolbar, StatusBar, CommandPalette
- Contains: One subdirectory per shell component; each has `.tsx` + `.module.css`
- Key files: `AppShell/AppShell.tsx` — the outermost `role="application"` grid

**`src/components/panels/`:**
- Purpose: The three work-area panes: files queue (left), preview (center), inspector (right)
- Contains: Flat `.tsx` files — no sub-directories
- Key files: `FilesPane.tsx`, `CenterPane.tsx`, `InspectorPane.tsx`

**`src/components/ui/`:**
- Purpose: Design-system primitives wrapping `@base-ui/react` and CVA variants
- Contains: Reusable UI atoms; consumed by panels and shell components

**`src/hooks/`:**
- Purpose: Business logic extraction — file ingestion, batch lifecycle, keyboard, totals
- Contains: Hook files only; all file/optimize logic belongs here or in stores, never inline in components

**`src/stores/`:**
- Purpose: Global state — three sliced Zustand stores
- Key files: `files.ts`, `settings.ts`, `runtime.ts`; `index.ts` is a barrel re-export

**`src/workers/`:**
- Purpose: Web Worker code — pool orchestrator, Comlink entry, codec adapters
- Contains: `pool.ts` (class + singleton), `worker.ts` (Comlink entry), one `*-adapter.ts` per format

**`src/lib/`:**
- Purpose: Pure functions with no React/store dependencies
- Contains: Utilities consumed by multiple layers; safe to import anywhere

**`src/types/`:**
- Purpose: Shared TypeScript interfaces and union types
- Key files: `index.ts` — all domain types exported from one file

**`src/tests/`:**
- Purpose: All tests — Playwright specs, Node unit tests, fixtures
- Contains: `*.spec.ts` (Playwright), `*.test.ts` (Node strip-types), `*.unit.ts` (manual/CI)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React root mount, COOP/COEP check, font imports
- `src/workers/worker.ts`: Web Worker entry (`Comlink.expose`)

**Configuration:**
- `vite.config.ts`: Vite plugins, path alias `@`, worker ES format, COOP/COEP dev headers
- `playwright.config.ts`: Test runner config (Chromium, dev server, `src/tests/*.spec.ts`)
- `src/data/defaults.ts`: Default codec/settings values

**Core Logic:**
- `src/workers/pool.ts`: WorkerPool class + `getWorkerPool()` singleton
- `src/hooks/useBatchOrchestrate.ts`: startOptimize, cancelBatch, plugin-savings
- `src/stores/files.ts`: addSourceWithVariants (variant fan-out), markDone, removeFamily
- `src/lib/sanitize-svg.ts`: DOMPurify SVG sanitization (main-thread only)
- `src/lib/memory-budget.ts`: computeMemoryBudget(), estimateJobBytes()

**Types:**
- `src/types/index.ts`: All domain types — `FileEntry`, `FormatId`, `CodecSettings*`, `SnippetId`
- `src/workers/types.ts`: Worker-layer types — `AdapterFormat`, `PoolJob`, `WorkerProxyApi`, `AdapterError`

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g. `FilesPane.tsx`, `AppShell.tsx`)
- CSS Modules: `camelCase.module.css` co-located with component (e.g. `appShell.module.css`)
- Hooks: `useCamelCase.ts` or `useCamelCase.tsx`
- Stores: `camelCase.ts` (e.g. `files.ts`, `settings.ts`, `runtime.ts`)
- Workers/adapters: `kebab-case.ts` (e.g. `svg-adapter.ts`, `png-config.ts`)
- Lib utilities: `kebab-case.ts` (e.g. `sanitize-svg.ts`, `memory-budget.ts`)
- Tests: `kebab-case.spec.ts` (Playwright) or `kebab-case.test.ts` (Node)

**Directories:**
- `PascalCase/` for shell components with co-located CSS (e.g. `AppShell/`, `TitleBar/`)
- `kebab-case/` for file-row sub-components (e.g. `file-row/`)
- `camelCase/` not used for directories

## Where to Add New Code

**New codec adapter (e.g. JPEG):**
- Adapter implementation: `src/workers/jpeg-adapter.ts`
- Settings config builder: `src/workers/jpeg-config.ts`
- Register in static ADAPTERS map: `src/workers/worker.ts` (add literal import, NOT template literal)
- Add `CodecSettingsJpeg` to `src/types/index.ts` (already defined, wire to store)

**New UI panel:**
- Implementation: `src/components/panels/MyPanel.tsx`
- If it needs complex state logic: extract to `src/hooks/useMyPanelLogic.ts`

**New shell component:**
- Directory: `src/components/shell/MyComponent/`
- Files: `MyComponent.tsx` + `myComponent.module.css`

**New store action:**
- Add to the relevant store slice: `src/stores/files.ts`, `src/stores/settings.ts`, or `src/stores/runtime.ts`
- Never add file/optimize logic inline in components — use hooks or stores

**New lib utility:**
- File: `src/lib/kebab-case.ts`
- Must be pure (no React, no stores, no workers) — safe to import from any layer

**New snippet type:**
- Register in `src/lib/snippet-registry.ts` SNIPPET_REGISTRY — add a `SnippetDef` entry
- Add `SnippetId` union member to `src/types/index.ts`
- Never add `switch(file.format)` in `SnippetPanel` — use `applicableFormats` filter

**New Playwright test:**
- File: `src/tests/my-feature.spec.ts`
- Playwright picks up all `*.spec.ts` in `src/tests/`

**New unit test (Node strip-types):**
- File: `src/tests/my-logic.test.ts`
- Run via: `node --experimental-strip-types src/tests/my-logic.test.ts`

## Special Directories

**`inspired/`:**
- Purpose: Reference implementations — squoosh, svgomg, url-encoder
- Generated: No
- Committed: Yes — read-only reference; do not modify

**`example-ui/`:**
- Purpose: Locked design reference HTML with design tokens (oklch palette, Inter, JetBrains Mono)
- Generated: No
- Committed: Yes — source of truth for visual identity; tokens must match

**`dist/`:**
- Purpose: Vite build output
- Generated: Yes
- Committed: No (gitignored)

**`.claude/worktrees/`:**
- Purpose: Agent worktrees for parallel agent execution
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-05-07*
