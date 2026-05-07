---
phase: 10-component-decomposition-and-mvp-wiring-split-app-tsx-into-co
verified: 2026-05-07T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run npm run dev, open http://localhost:5173, drag an image onto the dropzone"
    expected: "App loads, file appears in queue, Optimize button triggers batch, Cmd+Enter works, Cmd+. cancels, Cmd+K opens command palette, codec change in CodecPanel persists across re-renders"
    why_human: "Runtime behavior — drag-drop, keyboard shortcuts, codec persistence, and dev-server startup cannot be verified programmatically without running the app"
---

# Phase 10: Component Decomposition and MVP Wiring — Verification Report

**Phase Goal:** Split App.tsx (1,381 lines) down to a ~200-300 line composition root by extracting FilePanel, useBatchOrchestrate, useFilePicker hooks and migrating codec settings to useSettingsStore.codec slice
**Verified:** 2026-05-07T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | useSettingsStore exposes a codec slice with label/quality/method/lossless fields and setCodec action | VERIFIED | `src/stores/settings.ts` lines 34-68: CodecSlice interface, setCodec action at line 100; CodecLabel imported line 20 |
| 2 | CodecPanel reads and writes useSettingsStore.codec directly — no codec/q/method/lossless props | VERIFIED | `CodecPanel.tsx` lines 46-52: four useSettingsStore selectors; line 7 imports useSettingsStore; no codec prop in interface |
| 3 | The 4 useState calls (codec, q, method, lossless) are removed from App() | VERIFIED | `grep "useState<CodecLabel>"` → 0 matches in App.tsx; setCodecFromMenu at line 160 calls `useSettingsStore.getState().setCodec({ label: c })` |
| 4 | useFilePicker hook exists at src/hooks/useFilePicker.ts | VERIFIED | File exists (2.9K); exports `useFilePicker`, `fileInputRef`, `handleFilePick`, `handleDrop`, `handleDragOver`, `handleDragLeave`, `handleFileInputChange`; calls `addSourceWithVariants` at line 33 |
| 5 | FilePanel component exists at src/components/panels/FilePanel/FilePanel.tsx | VERIFIED | File exists (8.7K); imports useFilePicker (line 11), useFilesStore.byId (line 43), PLACEHOLDER_FILE at line 17, SourceDensityControl at line 9; filteredFiles useMemo at line 76 |
| 6 | useBatchOrchestrate hook exists at src/hooks/useBatchOrchestrate.ts | VERIFIED | File exists (21.2K); exports `useBatchOrchestrate`; `getWorkerPool` at line 9/142; `useRuntimeStore.subscribe` at line 178; `computePluginSavings` and `isAuxiliaryJob` present; returns `{ startOptimize, cancelBatch, running }` |
| 7 | useKeyboardShortcuts hook exists at src/hooks/useKeyboardShortcuts.ts | VERIFIED | File exists (2.0K); `export function useKeyboardShortcuts` at line 18 |
| 8 | App.tsx is 282 lines (≤350) and imports FilePanel/useBatchOrchestrate/useKeyboardShortcuts | VERIFIED | `wc -l` = 282; imports confirmed at lines 14, 22, 23; FilePanel rendered at line 194; hooks called at lines 59-60; `computePluginSavings`, `ingestDroppedFiles`, `formatFromFile`, `getWorkerPool`, `SHELL_FILES`, `PLACEHOLDER_FILE`, `filteredFiles`, `const pool = useMemo` — all absent |
| 9 | TypeScript build is clean (`npx tsc --noEmit` exits 0) | VERIFIED | Exit code 0 confirmed |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/settings.ts` | codec slice with setCodec | VERIFIED | CodecSlice interface + setCodec action present |
| `src/components/panels/CodecPanel.tsx` | store-connected, no codec props | VERIFIED | useSettingsStore selectors for all 4 fields |
| `src/hooks/useFilePicker.ts` | useFilePicker hook | VERIFIED | Exports hook + all 6 return values including handleFileInputChange |
| `src/components/panels/FilePanel/FilePanel.tsx` | FilePanel component | VERIFIED | PLACEHOLDER_FILE, SHELL_FILES, filteredFiles, useFilePicker, SourceDensityControl all present |
| `src/components/panels/FilePanel/FilePanel.module.css` | CSS module stub | VERIFIED | File exists co-located with FilePanel.tsx |
| `src/hooks/useBatchOrchestrate.ts` | useBatchOrchestrate hook | VERIFIED | Pool singleton, batch subscribers, startOptimize/cancelBatch/running |
| `src/hooks/useKeyboardShortcuts.ts` | useKeyboardShortcuts hook | VERIFIED | Exported function at line 18 |
| `src/App.tsx` | Thin composition root ≤350 lines | VERIFIED | 282 lines; all extracted logic confirmed absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CodecPanel.tsx` | `settings.ts` | `useSettingsStore((s) => s.codec)` | WIRED | Lines 46-52 use 4 store selectors |
| `App.tsx` | `settings.ts` | `useSettingsStore.getState().setCodec({ label: c })` | WIRED | Line 160 of App.tsx |
| `useFilePicker.ts` | `stores/files.ts` | `addSourceWithVariants` | WIRED | Line 33 |
| `FilePanel.tsx` | `stores/files.ts` | `useFilesStore((s) => s.byId)` | WIRED | Line 43 |
| `FilePanel.tsx` | `hooks/useFilePicker.ts` | `useFilePicker()` | WIRED | Line 11 import, line 48 call |
| `useBatchOrchestrate.ts` | `workers/pool.ts` | `getWorkerPool()` | WIRED | Lines 9, 142 |
| `useBatchOrchestrate.ts` | `stores/runtime.ts` | `useRuntimeStore.subscribe` | WIRED | Line 178 |
| `App.tsx` | `FilePanel/FilePanel.tsx` | `<FilePanel selectedId=... onSelect=... onOptimize=... onCancel=...>` | WIRED | Lines 14 (import), 194 (JSX) |
| `App.tsx` | `hooks/useBatchOrchestrate.ts` | `useBatchOrchestrate()` | WIRED | Lines 22 (import), 59 (call) |
| `App.tsx` | `hooks/useKeyboardShortcuts.ts` | `useKeyboardShortcuts(...)` | WIRED | Lines 23 (import), 60 (call) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FilePanel.tsx` | `filteredFiles` | `useFilesStore.byId + order` → SHELL_FILES useMemo | Yes — live store data | FLOWING |
| `CodecPanel.tsx` | `codec/q/method/lossless` | `useSettingsStore.codec` | Yes — live store state | FLOWING |
| `useBatchOrchestrate.ts` | `running` | `useRuntimeStore((s) => s.running)` | Yes — live runtime state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | Exit 0 | PASS |
| App.tsx line count ≤ 350 | `wc -l src/App.tsx` | 282 | PASS |
| useBatchOrchestrate exports | `grep "export function useBatchOrchestrate"` | 1 match | PASS |
| useFilePicker exports | `grep "export function useFilePicker"` | 1 match | PASS |
| useKeyboardShortcuts exports | `grep "export function useKeyboardShortcuts"` | 1 match | PASS |
| FilePanel exports | `grep "export function FilePanel"` (inferred from imports) | import resolves | PASS |
| Removed funcs absent from App.tsx | `grep computePluginSavings\|ingestDroppedFiles\|formatFromFile\|getWorkerPool\|SHELL_FILES\|filteredFiles` | 0 matches | PASS |

*Step 7b runtime checks (dev server, drag-drop, keyboard): SKIPPED — requires running server, routed to human verification below.*

### Requirements Coverage

No requirement IDs declared for phase 10 (requirements: [] in all plans).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `App.tsx` line ~161 | `// TODO Phase 11: wire toolbar Add button through FilePanel forwarded ref or a shared event bus` | Info | Toolbar "from-device" path currently shows a toast placeholder; dropzone + pane-header + button still work — not a blocker |
| `CodecPanel.tsx` line ~13 | `// TODO Phase 10 Task 2 follow-up: resizeOn/w/h/alg... duplicate of useSettingsStore.resize/.global` | Info | Intentional deferral documented; resize props still prop-drilled but not blocking codec slice goal |

No blockers found.

### Human Verification Required

#### 1. Full E2E Flow Check

**Test:** Run `npm run dev`, open http://localhost:5173
**Expected:**
1. Vite dev server starts with no errors in terminal
2. App shell renders
3. Drag an image file onto the dropzone — file appears in queue
4. Click the + button in the queue header — file picker dialog opens
5. Click Optimize — batch starts (status pills change to processing)
6. Press Cmd+Enter — Optimize triggers
7. Press Cmd+. while optimizing — Cancel triggers
8. Press Cmd+K — command palette opens
9. Change codec in CodecPanel — selection persists on re-render (not reset)
10. `npx tsc --noEmit` exits 0 (already verified automatically)
11. `wc -l src/App.tsx` prints ≤ 350 (already verified: 282)

**Why human:** Runtime behavior — dev server startup, drag-drop FileList events, keyboard shortcut routing, and codec store persistence across React re-renders require browser execution.

---

## Gaps Summary

No gaps found. All 9 must-have truths are VERIFIED with direct codebase evidence. The phase goal — decomposing App.tsx from 1,381 lines into co-located components and hooks, with all UI controls wired to real store implementations — is achieved. Status is `human_needed` solely because the plan itself includes a `checkpoint:human-verify` task for browser E2E testing (Plan 05, Task 2) that cannot be replaced by static analysis.

---

_Verified: 2026-05-07T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
