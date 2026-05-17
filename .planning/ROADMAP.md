# ROADMAP: oimg.app — UI Port Milestone

**Milestone:** UI Port (React + TypeScript + Tailwind + Shadcn)
**Granularity:** Standard (7 phases)
**Coverage:** 36/36 v1 requirements mapped
**Mode:** Vertical MVP — every phase delivers something visible in the browser

---

## Convention: STORE-08 (cross-cutting)

> Zero `useState` in components (except ephemeral hover/focus). All data via `useStore(atom)` or exported store constants. Enforced across every phase — not a standalone deliverable.

## Convention: Circular ESM guard

> `ui.ts` must NOT import from `files.ts`, `runtime.ts`, or `settings.ts`. Enforced at file creation and code review.

---

## Phases

- [x] **Phase 1: Foundation** — Tailwind + design tokens + AppShell skeleton + stub data + format utils (completed 2026-05-14)
- [ ] **Phase 2: Files Pane** — FilesPane, file rows, totals bar, context menu, backed by filesAtom + uiAtom
- [ ] **Phase 3: Navigation Shell** — TitleBar, Toolbar, StatusBar + runtimeAtom; CommandPalette backed by uiAtom
- [ ] **Phase 4: Inspector Pane — Codec + SVGO** — InspectorPane tabs, CodecPanel, SvgoPanel backed by settingsAtom
- [ ] **Phase 5: Center Pane** — CenterPane: header, compare stage, delta strip backed by $selectedFile
- [ ] **Phase 6: Inspector Pane — Output + Report** — OutputPanel (snippets + copy), ReportPanel (chart)
- [ ] **Phase 7: Polish** — BackpressureIndicator, theme toggle, WCAG AA audit, code review pass

---

## Phase Details

### Phase 1: Foundation
**Goal**: Developer can run `npm run dev` and see a rendered 3-pane AppShell skeleton with correct design tokens
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, STORE-05, STORE-06, ICON-01, SHELL-01
**Success Criteria** (what must be TRUE):
  1. `npm run dev` builds without errors and serves the app on localhost
  2. Browser renders a 3-pane layout (left ~240px | center flex-grow | right ~260px) that fills the viewport
  3. oklch CSS variables are active — accent green, dark theme default, Inter + JetBrains Mono fonts visible
  4. `stub-data.ts` exports 12 `FileEntry` items and 22 `SvgoPlugin` items; `format.ts` exports `fmtBytes` and `fmtPct`; `@phosphor-icons/react` resolves correctly
  5. All 17 Shadcn base components are generated and importable
**Plans:** 5/5 plans complete
Plans:
- [x] 01-01-PLAN.md — Wave 0: npm install + 3 test stubs (foundation.spec.ts, stub-data.test.ts, format.test.ts)
- [x] 01-02-PLAN.md — CSS tokens (SETUP-01, SETUP-02): src/index.css with Tailwind v4 @theme + :root + .dark, plus src/lib/utils.ts (cn helper)
- [x] 01-03-PLAN.md — Shadcn components (SETUP-03): generate 17 primitives via `npx shadcn@4.7.0 add`
- [x] 01-04-PLAN.md — Stub data + format utils (STORE-05, STORE-06, ICON-01): src/lib/stub-data.ts + src/lib/format.ts
- [x] 01-05-PLAN.md — AppShell walking skeleton (SHELL-01): src/App.tsx + AppShell + 3 skeleton panes + human verify
**UI hint**: yes

### Phase 2: Files Pane
**Goal**: Developer sees the file queue populated from stub data — rows, totals, dropzone, context menu all functional
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: STORE-01, STORE-03 (partial: selectedId/rowMenu actions only), FILES-01, FILES-02, FILES-03, FILES-04, FILES-05
**Note on STORE-03**: Only `selectedId`, `rowMenu`, `setRowMenu`, and `selectFile` from `uiAtom` are needed here; full `uiAtom` is completed in Phase 3.
**Success Criteria** (what must be TRUE):
  1. FilesPane header shows "Queue · 12 files" driven by `$filteredFiles.length` from stub data
  2. 12 file rows render with format badge, name, orig→opt sizes, savings% badge, and status dot
  3. Clicking a row updates `filesAtom.selectedId` (row highlights as selected)
  4. Right-clicking a row (or clicking the context button) opens the context menu popover; "Remove from queue" calls `removeFile(id)` and the row disappears
  5. Totals bar shows 4 stat cells with computed values from `$totals`
  6. Dropzone "Drop images to optimize" zone is visible above the file list
**Plans:** 1/2 plans executed
Plans:
- [x] 02-01-PLAN.md — Stores foundation: filesAtom (STORE-01) + uiAtom full shape (STORE-03) + barrel re-export
- [x] 02-02-PLAN.md — FilesPane vertical slice: FileRow + FilesPane body (FILES-01..05) + human-verify checkpoint
**UI hint**: yes

### Phase 3: Navigation Shell
**Goal**: Developer sees a complete navigation chrome — TitleBar, Toolbar, StatusBar menus all open and respond to store actions; CommandPalette opens on ⌘K
**Mode:** mvp
**Depends on**: Phase 1, Phase 2 (filesAtom, uiAtom)
**Requirements**: STORE-03 (complete), STORE-04, STORE-07, SHELL-03, NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. TitleBar renders brand mark, codec/view/help menus open as popovers, all menu items call store actions without errors
  2. Toolbar renders Add/Optimize/Export split-buttons, Batch/Compare/Report seg, filter input; clicking Optimize calls `startRun` and `runtimeAtom.running` becomes true
  3. StatusBar shows worker status pip (idle/running), SVGO version, codec version, WASM status, file count + size from `$totals`
  4. Pressing ⌘K (or Ctrl+K) opens CommandPalette modal; typing filters `$cmdFlat`; ↑↓ moves selection; Enter triggers the command; Escape closes
  5. `<html data-theme>` reflects `uiAtom.theme`; theme toggle in TitleBar View menu switches it
**Plans:** 3 plans
Plans:
- [x] 03-01-PLAN.md — Wave 1: ui.ts action bodies + runtime.ts + minimal Toolbar/StatusBar slice (STORE-03/04, NAV-02/03 minimal)
- [x] 03-02-PLAN.md — Wave 2: TitleBar + full Toolbar + full StatusBar (NAV-01/02/03)
- [ ] 03-03-PLAN.md — Wave 3: $cmdFlat + commands.ts + CommandPalette + data-theme effect + checkpoint (STORE-03 complete, STORE-07, SHELL-03, NAV-04)
**UI hint**: yes

### Phase 4: Inspector Pane — Codec + SVGO
**Goal**: Developer can switch inspector tabs and adjust codec/resize/metadata/SVGO settings that update store state
**Mode:** mvp
**Depends on**: Phase 1, Phase 3 (uiAtom.tab)
**Requirements**: STORE-02, INSP-01, INSP-02, INSP-03, INSP-04, INSP-05, INSP-06
**Circular ESM warning**: `ui.ts` created in Phase 3 must NOT import from `settings.ts` (created here). Verify at file creation.
**Success Criteria** (what must be TRUE):
  1. InspectorPane header and tab bar render; clicking Codec/SVGO/Output/Report tabs updates `uiAtom.tab`; tab auto-switches when selected file type changes (svg↔non-svg)
  2. CodecPanel "Output format" section shows codec selector; clicking a codec calls `setCodec` and `settingsAtom.codec` updates
  3. CodecPanel "Parameters" section quality and effort sliders move and call `setQuality`/`setMethod`; codec-specific controls (PNG palette seg, AVIF subsample seg) show/hide correctly
  4. CodecPanel "Resize" section toggle enables/disables width/height inputs; fit/algorithm segs call store actions
  5. SvgoPanel plugin grid renders 22 plugins from stub data; toggling a plugin calls `togglePlugin(id)` and reflects on/off state
**Plans**: TBD
**UI hint**: yes

### Phase 5: Center Pane
**Goal**: Developer sees the selected file's compare stage, breadcrumb, and delta strip all rendering from $selectedFile
**Mode:** mvp
**Depends on**: Phase 2 ($selectedFile), Phase 3 (uiAtom.zoom/split)
**Requirements**: CENTER-01, CENTER-02, CENTER-03, CENTER-04
**Success Criteria** (what must be TRUE):
  1. CenterPane renders 3 vertical sections (header / compare stage / delta strip) filling available height
  2. Breadcrumb shows the selected file name, type→target tag, dim tag, and q tag from `$selectedFile`; zoom dropdown reads/writes `uiAtom.zoom`
  3. Compare stage shows left/right placeholder layers with split labels ("ORIGINAL · {orig}" / "{target} · {opt}"); split handle is draggable and calls `setSplit(pct)`; `--split` CSS var updates
  4. Delta strip shows 6 metric cards (Original, Optimized, Saved, SSIM, Butteraugli, Decode) with values from `$selectedFile` and `settingsAtom`
**Plans**: TBD
**UI hint**: yes

### Phase 6: Inspector Pane — Output + Report
**Goal**: Developer can copy production-ready snippets from the Output tab and view per-file savings chart in the Report tab
**Mode:** mvp
**Depends on**: Phase 4 (InspectorPane tabs), Phase 2 (filesAtom.entries)
**Requirements**: INSP-07, INSP-08
**Success Criteria** (what must be TRUE):
  1. Output tab shows 3 sections (Data URI Base64, Data URI URL-encoded, Responsive `<picture>`); each has a copy button that calls `navigator.clipboard.writeText` with the correct stub snippet
  2. Report tab "Total savings" section shows before/after stats grid; per-file bar chart renders with stub data (12 bars, warn color on <30% savings)
  3. Report tab "Format breakdown" section shows per-format rows with type label, file count, and bytes saved from `filesAtom.entries`
**Plans**: TBD
**UI hint**: yes

### Phase 7: Polish
**Goal**: App meets WCAG AA, theme switching works end-to-end, BackpressureIndicator is visible during a run, and code review passes
**Mode:** mvp
**Depends on**: All prior phases
**Requirements**: SHELL-02
**Note**: STORE-08 is validated as a cross-cutting convention audit in this phase.
**Success Criteria** (what must be TRUE):
  1. BackpressureIndicator renders in the shell and is visible (not hidden) when `runtimeAtom.running=true`; clicking Optimize in Toolbar triggers it
  2. Theme toggle switches between dark and light themes with no unstyled flash; all components respect the active theme
  3. All interactive elements (buttons, menus, sliders, inputs) are keyboard-reachable and have visible focus rings
  4. No component imports stub-data directly; no app-level `useState` for data (STORE-08 audit passes)
  5. Code review finds no circular ESM imports between ui.ts and other stores
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete    | 2026-05-14 |
| 2. Files Pane | 1/2 | In Progress|  |
| 3. Navigation Shell | 0/3 | Planned     | - |
| 4. Inspector — Codec + SVGO | 0/? | Not started | - |
| 5. Center Pane | 0/? | Not started | - |
| 6. Inspector — Output + Report | 0/? | Not started | - |
| 7. Polish | 0/? | Not started | - |
