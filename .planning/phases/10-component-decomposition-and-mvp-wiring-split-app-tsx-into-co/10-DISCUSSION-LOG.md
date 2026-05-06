# Phase 10: Component Decomposition and MVP Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co
**Areas discussed:** All — user deferred all decisions to Claude ("Just do it")

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 9 vs 10 scope split | Both phases share nearly the same name — what does each own? | — |
| FilePanel extraction | Extract work-area file list from App.tsx inline JSX | — |
| Hook extraction | Which useState clusters leave App.tsx? | — |
| UI control wiring targets | Migrate codec settings from local useState to useSettingsStore | — |

**User's response:** "Just do it!" (free-text via Other)
**Notes:** User delegated all implementation decisions to Claude. No individual areas selected; Claude analyzed codebase and made all decisions based on existing patterns.

---

## Claude's Discretion

All areas were Claude's discretion. Key decisions made:

- **FilePanel extraction** — `src/components/panels/FilePanel/FilePanel.tsx` co-located folder, follows Phase 1 shell pattern
- **useBatchOrchestrate hook** — pool setup, startOptimize, cancelBatch, batch-completion subscription, plugin savings trigger, keyboard shortcuts
- **useFilePicker hook** — ingestDroppedFiles, formatFromFile, file-input ref, drag handlers
- **Codec store migration** — add `codec` slice to `useSettingsStore` (`label`, `quality`, `method`, `lossless`); remove 4 `useState` calls from App()
- **App.tsx residual target** — ≤ 300 lines (down from 1,381); no business logic remaining

## Deferred Ideas

- Phase 9 scope resolution — both Phase 9 and Phase 10 have identical names; planner should flag for roadmap cleanup
- Compare-view extraction — split slider + previewUrls deferred to Phase 5
- MockFile elimination — deferred to Phase 5 (when FileEntry becomes the canonical view model)
- useExport hook — deferred to Phase 7 (jszip)
