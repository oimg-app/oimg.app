# Phase 10: Component Decomposition and MVP Wiring - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

App.tsx is 1,381 lines and a composition monolith: it holds inline file-list JSX, 15+ local `useState` calls (codec settings not yet in the store), module-level functions, pool setup, batch orchestration, keyboard shortcuts, and preview URL management — all in one file. This phase cuts it down to a lean composition root (~200–300 lines) by extracting the file-list pane into a co-located `FilePanel` component, moving batch/file-picker logic into custom hooks, and migrating codec settings from local state into `useSettingsStore` so Phase 5 can read them for real encoding.

**In scope:**
- Extract the work-area LEFT pane (queue, sort popover, drag-drop zone, file-picker `<input>`, ContextMenu wiring, density controls) into `src/components/panels/FilePanel/FilePanel.tsx`
- Extract `useBatchOrchestrate` hook: pool singleton setup, `startOptimize`, `cancelBatch`, batch-completion runtime-store subscription, auxiliary-job discrimination, `computePluginSavings` trigger, Cmd+Enter / Cmd+. keyboard shortcuts
- Extract `useFilePicker` hook: `ingestDroppedFiles`, `formatFromFile`, file-input ref, drag-over/drag-leave/drop handlers
- Migrate codec local state (`codec`, `q`, `method`, `lossless`) from App() `useState` to `useSettingsStore.codec` slice
- Wire the toolbar Add-files button and dropzone click through `useFilePicker` (currently `fileInputRef.current?.click()` scattered in two places)
- App.tsx residual: ~200–300 lines — imports, hook calls, thin JSX that assembles `<AppShell>` + extracted panels + `<Toaster>`

**Out of scope:**
- Actual raster codec implementations (Phase 5 — JPEG/WebP/AVIF adapters)
- Export ZIP real implementation (Phase 7 — jszip)
- Compare-view split-slider and preview (Phase 5 detail view)
- Per-file codec override UI (Phase 5 detail view)
- Phase 9 scope resolution (tracked in Deferred Ideas)

</domain>

<decisions>
## Implementation Decisions

### FilePanel Extraction (Claude's Discretion — all decisions)

- **D-01:** Extract work-area LEFT pane as `src/components/panels/FilePanel/FilePanel.tsx`. Co-located CSS in `src/components/panels/FilePanel/FilePanel.module.css`. Follows Phase 1 shell co-location pattern (`ComponentName/ComponentName.tsx`).
- **D-02:** FilePanel takes `selectedId`, `onSelect`, `onOptimize`, `onCancel` as props. It owns `filterQuery`, `sortBy`, `open` (for the sort popover), and `rowMenu` state internally — these are FilePanel-local UI state, not App-level concerns.
- **D-03:** FilePanel co-locates `useFilePicker` by importing it directly (not passing file picker state as props). The hidden `<input type="file">` ref lives inside FilePanel since it's always adjacent to the dropzone.
- **D-04:** FilePanel renders `<SourceDensityControl>` and `<TargetDensityCheckboxes>` per row (already exist in `src/components/file-row/`). No new sub-components for the row — these are sufficient.

### Hook Extraction (Claude's Discretion — all decisions)

- **D-05:** `useBatchOrchestrate` hook at `src/hooks/useBatchOrchestrate.ts`. Returns `{ startOptimize, cancelBatch, running }`. Internally: pool singleton via `getWorkerPool({ onStarted, onDone, onError, onThrottle })`, `useEffect` for the batch-completion runtime-store subscription and SVG plugin-savings trigger, `computePluginSavings` as a local helper (private to the hook — it's only called here).
- **D-06:** `useFilePicker` hook at `src/hooks/useFilePicker.ts`. Returns `{ fileInputRef, handleFilePick, handleDrop, handleDragOver, handleDragLeave }`. Contains `ingestDroppedFiles` and `formatFromFile` as local helpers. FilePanel calls `handleDrop` on its drop zone and mounts the hidden `<input ref={fileInputRef}>`.
- **D-07:** Keyboard shortcuts (Cmd+Enter / Cmd+. / Esc / /) move INTO `useBatchOrchestrate` along with the pool. The `cmdkOpen` and `setOpen` refs are passed in as params so the hook can close modals on Esc. (Alternative: keep shortcuts in a thin `useKeyboardShortcuts` hook — Claude's discretion at planning time; whichever produces fewer prop chains.)
- **D-08:** `previewUrls` state and the `useEffect` that creates/revokes object URLs for the compare stage stay in App.tsx until Phase 5 extracts the compare view. It's 15 lines and touches `selectedEntry` from the store — no meaningful win to extract now.

### Codec Settings Store Migration (Claude's Discretion — all decisions)

- **D-09:** Add `codec` slice to `useSettingsStore` at `src/stores/settings.ts`. Shape:
  ```ts
  codec: {
    label: CodecLabel        // default: 'WebP'
    quality: number          // default: 82
    method: number           // default: 4
    lossless: boolean        // default: false
  }
  ```
  Action: `setCodec(patch: Partial<CodecSettings>)`.
- **D-10:** Remove the 4 `useState` calls (`codec`, `q`, `method`, `lossless`) from App(). `CodecPanel` reads from and writes to `useSettingsStore.codec` directly (no prop drilling). Phase 5's encoder dispatch reads `useSettingsStore.getState().codec` the same way `startOptimize` reads `useSettingsStore.getState().svg` today.
- **D-11:** `resizeOn`, `w`, `h`, `alg`, `fit`, `stripMeta`, `keepIcc` — these are ALREADY partially in `useSettingsStore.resize` and `useSettingsStore.global` (added in Phase 4). Phase 10 audits the remaining local state copies and removes the duplicates. If any of these local states are still driving UI that hasn't been wired to the store yet, wire them now.
- **D-12:** `setCodecFromMenu` in the command palette (line 815) calls `setCodec(c)` (local). After D-09, it calls `useSettingsStore.getState().setCodec({ label: c })` directly. `pushToast` stays — it's just a sonner wrapper.

### App.tsx Residual Shape (Claude's Discretion)

- **D-13:** After extraction, App.tsx contains: imports, `useTheme`, `useBatchOrchestrate`, `useFilePicker`, narrow store selectors (`tab`, `split`, `view`, `cmdkOpen` local state — these are view-routing UI state), `previewUrls` (see D-08), `cmdGroups` array wired to real actions, and JSX assembling `<AppShell>`, `<FilePanel>`, `<TitleBar>`, `<StatusBar>`, `<Toolbar>`, `<CommandPalette>`, `<Toaster>`. No business logic.
- **D-14:** `PLACEHOLDER_FILE` and `SHELL_FILES` / `SHELL_FILES`-derived `file` / `filteredFiles` `useMemo` calls move INTO FilePanel. They are purely consumed by the file list. Phase 5 will delete `MockFile` altogether; Phase 10 just moves the interim shim closer to its consumer.
- **D-15:** `totals` `useMemo` (orig/opt/saved/pct) stays in App.tsx and is passed as a prop to `<StatusBar>`. StatusBar already accepts this data shape — no change to the StatusBar contract.
- **D-16:** `exportZip` (currently `toast.success('Bundled oimg-export.zip', …)`) stays as a no-op stub in App.tsx. Phase 7 replaces it. Phase 10 does NOT create a `useExport` hook — one stub function doesn't justify a hook.

### Claude's Discretion (open items for planner)
- Whether keyboard shortcuts live inside `useBatchOrchestrate` or a thin sibling `useKeyboardShortcuts` hook — pick whichever avoids passing `setCmdkOpen` as a param to `useBatchOrchestrate`
- Exact prop shape for `<FilePanel>` — minimum viable props to keep App.tsx thin; avoid over-threading
- Whether `computePluginSavings` stays private inside `useBatchOrchestrate.ts` or gets promoted to `src/lib/plugin-savings.ts` (private is simpler; promote only if Phase 5 needs to reuse it)
- Whether `filterQuery` / `sortBy` sort state needs to survive navigation (if yes, lift to useRuntimeStore; if no, keep in FilePanel local state)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App.tsx — source of truth for extraction scope
- `src/App.tsx` — read fully before planning; every extraction target is currently here; line comments identify "deferred to Phase 5/6/7" items that must NOT be silently deleted

### Existing co-location pattern (follow exactly)
- `src/components/shell/AppShell/AppShell.tsx` — folder + file + module.css pattern to replicate for FilePanel
- `src/components/shell/StatusBar/StatusBar.tsx` — same pattern

### Stores (codec slice target)
- `src/stores/settings.ts` — add `codec` slice here; read existing `resize` and `global` slices to understand shape conventions
- `src/stores/files.ts` — FilePanel reads `filesOrder`, `filesById`, `selectedId` from here
- `src/stores/runtime.ts` — `useBatchOrchestrate` reads `running`, `doneCount`, `totalJobs`, `markStarted`, `markDone`, `markError`, `startBatch`, `setThrottleActive`, `markThrottle`, `throttleToastFiredThisBatch`

### Prior phase context (carry-forward decisions)
- `.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md` — D-11 (worker discipline + admission gate), D-13 (backpressure toast pattern), D-04+D-14 (1:1 jobs:FileEntries; no N-fanout inside one pool job)
- `.planning/phases/02-worker-harness-state/02-CONTEXT.md` — D-04 (adapter contract), D-10 (URL revoke on eviction), D-11 (streaming concurrency cap)

### Types
- `src/types/index.ts` — `MockFile`, `CodecLabel`, `ResizeAlg`, `FitMode` — understand before replacing local state

### Worker pool API (do not change the interface)
- `src/workers/pool.ts` — `getWorkerPool` singleton; `useBatchOrchestrate` wraps this, does not re-implement it

### Project constraints
- `.planning/PROJECT.md` — zero-telemetry, 200 KB initial JS budget (no new heavy imports in App.tsx or FilePanel)
- `.planning/ROADMAP.md` Phase 10 entry — goal definition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/file-row/ContextMenu.tsx`** — already extracted; FilePanel just imports and renders it per row (no changes needed)
- **`src/components/file-row/SourceDensityControl.tsx`** + **`TargetDensityCheckboxes.tsx`** — already extracted; FilePanel renders per-row
- **`src/components/panels/TweaksPanel.tsx`** → `TweaksResizeSection` + `TweaksPrivacySection` — already extracted; stays in App.tsx layout (right pane)
- **`getWorkerPool`** at `src/workers/pool.ts` — singleton; `useBatchOrchestrate` calls it once, same as App.tsx today
- **`src/lib/live-region.ts`** → `announce`, `isQuartileBoundary` — used in `useBatchOrchestrate`
- **`src/lib/sanitize-svg.ts`** → `sanitizeSvg` — used in `useFilePicker` (ingestDroppedFiles SVG path)

### Established Patterns
- **Co-located component folders:** `ComponentName/ComponentName.tsx` + `ComponentName.module.css` — mandatory for FilePanel
- **Narrow store selectors:** `useFilesStore((s) => s.selectedId)` — one selector per field; do not select the whole store object
- **Auxiliary-job prefix discrimination:** `jobId.startsWith('preview-') || jobId.startsWith('savings-')` — must preserve in `useBatchOrchestrate`
- **Fire-and-forget with wall-time cap:** `computePluginSavings` already has a 5s timeout; keep the pattern
- **queueMicrotask before reading file state after batch completion** — Phase 3 fix (see App.tsx line ~430); preserve in `useBatchOrchestrate`
- **Zustand `getState()` for write paths:** `useFilesStore.getState().setSelected(id)` — use `.getState()` in event handlers (not hooks), selectors in render path

### Integration Points
- **`<AppShell>`** layout grid — FilePanel mounts inside the LEFT pane of the AppShell grid; the grid CSS is in `AppShell.module.css`
- **`<Toolbar>`** Add-files button → calls `onToolbarChange('from-device')` → currently triggers `fileInputRef.current?.click()` in App.tsx → after Phase 10, `useFilePicker.handleFilePick()` does the same via the hidden input inside FilePanel
- **`<StatusBar>`** → receives `totals` (orig/opt/saved/pct) + backpressure state from `useRuntimeStore` — no change to contract

</code_context>

<specifics>
## Specific Ideas

- User said "Just do it" — all decisions above are Claude's discretion; no specific user preferences beyond the phase name and goal.
- The App.tsx inline comment at line ~3 ("Work-area JSX intentionally remains here pending Plan 05's panel decomposition") is the primary extraction target; Phase 10 closes this comment.
- The App.tsx comment at line 237 ("Codec UI state — full migration to settings store deferred to Phase 5") is superseded by D-09/D-10; Phase 10 delivers this migration.
- Target App.tsx line count post-extraction: ≤ 300 lines (down from 1,381).

</specifics>

<deferred>
## Deferred Ideas

- **Phase 9 scope resolution** — Both Phase 9 and Phase 10 have nearly identical names and are both unplanned. Phase 10 is defined here as the full decomposition phase. The planner should flag whether Phase 9 should be removed from the roadmap or reassigned a distinct scope (e.g., Phase 9 = structural refactor only, Phase 10 = store wiring only). This is a roadmap maintenance item, not a blocker.
- **Compare-view detail panel extraction** — `split`, `previewUrls`, `onSplitDrag` and the `<div className="stage">` JSX are deferred to Phase 5, which builds the real compare/detail view with the Radix slider.
- **`MockFile` view model elimination** — `PLACEHOLDER_FILE`, `SHELL_FILES`, `fmtToType` shim belong to Phase 5 when FileEntry becomes the canonical view model and the placeholder is replaced with real file data.
- **`useExport` hook** — no hook needed until Phase 7 (jszip). Phase 10 leaves `exportZip` as a stub.
- **Per-file codec override UI** — `resizeOverride`, `preserveIcc` per-file data shapes exist (Phase 4); Phase 5 adds the picker UI.

</deferred>

---

*Phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co*
*Context gathered: 2026-05-06*
