# Phase 2: Files Pane - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the file queue UI: FilesPane header (sort, add), dropzone, file rows with context menu, totals bar — all backed by `filesAtom` (STORE-01) and a partial `uiAtom` (STORE-03, rowMenu only used in Phase 2). Components render from stub data only; no worker reconnection.

</domain>

<decisions>
## Implementation Decisions

### Context Menu Trigger
- **D-01:** Use shadcn `ContextMenu` (Radix-based) as the single mechanism — not a custom Popover. The `ctxbtn` button in each row dispatches a programmatic `contextmenu` event on the row element to trigger the same ContextMenu.
- **D-02:** File row + ContextMenu live in a separate `FileRow` component at `src/components/file-row/FileRow.tsx`. `FilesPane` maps over `$filteredFiles` and renders `<FileRow>`.

### Computed Atoms
- **D-03:** `$filteredFiles`, `$selectedFile`, and `$totals` are `nanostores computed()` reactive atoms defined in `src/stores/files.ts`. Components subscribe via `useStore($filteredFiles)` etc. Derivation logic stays in the store, testable without React.

### uiAtom Scope
- **D-04:** Create `src/stores/ui.ts` with the **full STORE-03 spec** in Phase 2 (all fields + default values). Phase 3 actions (`setView`, `setTab`, `setSplit`, etc.) are stubbed as `// @TODO` empty functions. This avoids rewriting the store shape in Phase 3 — only actions need to be wired.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full STORE-01, STORE-03 specs, FILES-01 through FILES-05 acceptance criteria
- `.planning/ROADMAP.md` §Phase 2 — Goal, success criteria, phase notes (STORE-03 partial split)

### Design Reference
- `example-ui/app.jsx` — FilesPane markup, file row structure, context menu pattern, rowMenu state wiring
- `example-ui/OIMG.html` — CSS variables locked (oklch palette, format badge colors, savings badge warn threshold)

### Phase 1 Outputs (already built — do not recreate)
- `src/lib/stub-data.ts` — `STUB_FILES` (12 FileEntry), `SVGO_PLUGINS`, `CODECS`, `RESIZE_ALGS`, `FIT_MODES`
- `src/lib/format.ts` — `fmtBytes`, `fmtPct`
- `src/components/panels/FilesPane.tsx` — Phase 1 skeleton stub (replace body, keep file)
- `src/components/ui/` — All 17 shadcn base components generated (includes `ContextMenu`, `Popover`, `Separator`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/context-menu.tsx` — shadcn ContextMenu already generated; use directly
- `src/lib/format.ts` — `fmtBytes(b)`, `fmtPct(orig, opt)` — use for row stats and totals
- `src/lib/stub-data.ts` — `STUB_FILES` is the initial `filesAtom.entries` source
- `src/lib/utils.ts` — `cn()` (tailwind-merge + clsx) for conditional className composition

### Established Patterns
- State: `nanostores map()` + `computed()` atoms, `useStore()` in components — no `useState` for data
- Circular ESM guard: `ui.ts` MUST NOT import `files.ts`, `runtime.ts`, or `settings.ts`
- Attribution header required: `// Phase 02 — [description]. Source: [plan doc]` on every file
- Tailwind utility classes only — no CSS modules, no inline styles
- Store actions are standalone exported functions (not methods), re-exported from `src/stores/index.ts`

### Integration Points
- `src/App.tsx` — FilesPane already slotted into AppShell left panel; no changes needed to App.tsx
- `src/stores/index.ts` — barrel must re-export new `files.ts` and `ui.ts` store exports
- `src/types/index.ts` — `FileEntry`, `FileStatus`, `SortKey` types already defined; verify before adding

</code_context>

<specifics>
## Specific Ideas

- Format badge colors: match `example-ui/OIMG.html` `.thumb.{type}` CSS — each format type (svg, png, jpeg, webp, avif) has a distinct accent color
- Savings badge warn: `<30% savings → orange` (from example-ui `'.save.warn'` pattern)
- `ctxbtn` programmatic contextmenu dispatch: `rowRef.current?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }))`
- STORE-03 full spec fields (from REQUIREMENTS.md STORE-03): `open`, `view`, `tab`, `split`, `zoom`, `cmdkOpen`, `cmdkQ`, `cmdkSel`, `rowMenu`, `theme` — all with defaults per spec

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Files Pane*
*Context gathered: 2026-05-15*
