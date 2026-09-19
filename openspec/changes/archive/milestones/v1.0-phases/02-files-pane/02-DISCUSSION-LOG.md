# Phase 2: Files Pane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 2-Files Pane
**Areas discussed:** Context menu trigger, Computed atoms strategy, uiAtom scope

---

## Context Menu Trigger

**Q1: How should the file row context menu open?**

| Option | Description | Selected |
|--------|-------------|----------|
| Match prototype pattern | onContextMenu + ctxbtn both set rowMenu state → open a Popover (mirrors example-ui) | |
| Radix ContextMenu + separate Dropdown | Right-click = ContextMenu; ctxbtn = DropdownMenu; shared menu items list | |
| shadcn ContextMenu only | ContextMenu on row; ctxbtn dispatches programmatic contextmenu event | ✓ |

**User's choice:** shadcn ContextMenu only

---

**Q2: Where should the file row + ContextMenu live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Separate FileRow component in file-row/ | src/components/file-row/FileRow.tsx; FilesPane maps over $filteredFiles | ✓ |
| Inline in FilesPane | Row rendering + ContextMenu stays in FilesPane.tsx | |

**User's choice:** Separate FileRow component in file-row/

---

## Computed Atoms Strategy

**Q1: Where should $filteredFiles, $selectedFile, $totals live?**

| Option | Description | Selected |
|--------|-------------|----------|
| nanostores computed() in the store | Reactive atoms in files.ts; useStore($filteredFiles) in components | ✓ |
| Custom hooks with useMemo | src/hooks/useFilesData.ts derives from useStore(filesAtom) + useMemo | |

**User's choice:** nanostores computed() in the store

---

## uiAtom Scope

**Q1: How much of uiAtom to create in Phase 2?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full spec now, stub Phase 3 actions | ui.ts with all STORE-03 fields + defaults; Phase 3 actions as // @TODO stubs | ✓ |
| Minimal — rowMenu only | ui.ts with just rowMenu + setRowMenu; Phase 3 adds other fields | |

**User's choice:** Full spec now, stub Phase 3 actions

---

## Claude's Discretion

None — all areas had clear user selections.

## Deferred Ideas

None — discussion stayed within Phase 2 scope.
