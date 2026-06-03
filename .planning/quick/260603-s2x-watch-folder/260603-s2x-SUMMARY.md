---
quick_id: 260603-s2x
slug: watch-folder
date: 2026-06-03
mode: quick
duration_minutes: ~35
tasks_completed: 8
tasks_total: 8
commits:
  - 9a2d502 feat(quick): add pickDirectory dispatcher with feature-detect + AbortError swallow
  - 2c0ba9b feat(quick): add watchedFolderAtom to runtime store
  - 81f45f6 chore(quick): export isAccepted helper from useIngest
  - c83d305 feat(quick): add useWatchFolder hook with snapshot + FileSystemObserver
  - cdfed19 feat(quick): wire Toolbar Watch folder menu item to useWatchFolder
  - 64bb0d3 refactor(quick): retire addWatchFolder empty stub from files store
  - 1b55c7e test(quick): add unit harness for pickDirectory feature-detect + AbortError
  - "(forthcoming) test(quick): add Playwright e2e for Watch folder snapshot + observer"
files_created:
  - src/lib/dir-picker.ts
  - src/hooks/useWatchFolder.ts
  - src/tests/watch-folder.test.ts
  - src/tests/watch-folder.spec.ts
files_modified:
  - src/stores/runtime.ts
  - src/hooks/useIngest.ts
  - src/components/shell/Toolbar.tsx
  - src/stores/files.ts
threats_mitigated:
  - T-WF-01: feature-detect on 'showDirectoryPicker' in window && window.isSecureContext (dir-picker.ts:23)
  - T-WF-02: ingest funnels through existing useIngest().ingest() (no new pool, reuses WorkerPool backpressure)
  - T-WF-03: observer.disconnect() literal in stopWatching() (useWatchFolder.ts:58, 129)
  - T-WF-04: try/catch around observer cb; any 'errored' record → stopWatching + 'access revoked' toast (useWatchFolder.ts:103-122)
---

# Quick Task 260603-s2x: Watch folder — Summary

**Result:** Toolbar "Watch folder" menu item now picks a directory via showDirectoryPicker, ingests image entries through the existing useIngest pipeline, and on supporting browsers (Chrome 132+) attaches a FileSystemObserver to auto-ingest new files added to the folder. Snapshot-only fallback on Firefox/Safari with a clear "one-shot" toast.

## What landed

1. **`src/lib/dir-picker.ts`** — `pickDirectory()` dispatcher mirroring `save-blob.ts` (Plan 11-04 D-07): secure-context + feature-detect gate, AbortError silent swallow, never throws.
2. **`watchedFolderAtom`** added to `src/stores/runtime.ts` — `WatchedFolderState | null` shape (name, handle, observer). Powers future "Stop watching" UI (out of scope here).
3. **`useIngest.isAccepted`** exported so the new hook can filter directory entries without duplicating the extension table.
4. **`src/hooks/useWatchFolder.ts`** — `startWatching` / `stopWatching` / `isWatching`. Single-watcher invariant; one-level traversal only (no recursion this iteration); locally typed `FileSystemObserver` because it's not yet in lib.dom.d.ts.
5. **Toolbar wired** — replaced `addWatchFolder()` no-op with `void startWatching()`, preserving the trailing `setOpen(null)` closer.
6. **`addWatchFolder` stub retired** from `src/stores/files.ts` (same precedent as Phase 11 export stubs and Phase 12 snippet stubs).
7. **Unit test** (`watch-folder.test.ts`) — 6 asserts across three pickDirectory branches.
8. **Playwright spec** (`watch-folder.spec.ts`) — 3 tests: snapshot ingest + Watching toast, no-observer fallback toast, observer-cb appended file + Added toast. Mocks injected via `addInitScript`; never touches real OS file system.

## Verification

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs src/tests/watch-folder.test.ts` | **6 passed, 0 failed** |
| `npx playwright test src/tests/watch-folder.spec.ts` | **3 passed, 0 failed** (154 s) |
| `./node_modules/.bin/tsc -b` for new files | **clean** (one pre-existing baseline error in `output-panel-live.spec.ts` unrelated to this task — see MEMORY tsc-and-test-gotchas) |
| `npm run build` | Fails on the same single pre-existing `output-panel-live.spec.ts` baseline error; no new errors introduced by this task. |
| Threat-model grep mitigations | All four (T-WF-01..04) present in source |

## Deviations from plan

- **Plan referenced `pushToast({ kind, message })` object signature**; the actual runtime API is `pushToast(msg: string, meta?: string)` (Phase 03 STORE-04 contract). Adapted: all toast calls use the positional string form. Behavior is equivalent — toasts surface in `runtimeAtom.toasts`, which the existing toast renderer reads. (Rule 3 — blocking type signature; auto-fixed inline.)
- **Test bridging via `window.__toasts`** — added a `bridgeRuntimeToasts` helper that subscribes runtimeAtom.toasts onto `window.__toasts`. Mirrors the existing `backpressure.spec.ts` pattern. Without the bridge, `page.evaluate` re-imports of `/src/stores/runtime.ts` sometimes resolve to a parallel module evaluation that misses writes from the React tree's alias-resolved instance. (Rule 1 — bug; auto-fixed inline.)
- **`Uint8Array` BlobPart TS2322** in the e2e spec — refactored to allocate `new ArrayBuffer` and view through `Uint8Array`, then pass the buffer to `new Blob([buf], …)`. (Rule 1 — TS strict; auto-fixed inline.)
- **Pre-existing `output-panel-live.spec.ts` build error** — confirmed present BEFORE this task (the spec uses the same `/src/stores/files.ts` runtime-URL dynamic-import pattern documented as accepted in MEMORY tsc-and-test-gotchas). Out of scope per Phase-12 acceptance; not addressed here.

## Parked for follow-up (per plan)

- "Stop watching" Toolbar item + StatusBar pill (atom + `stopWatching()` already plumbed; UI lands next).
- Persisting `FileSystemDirectoryHandle` across reloads via IndexedDB + permission re-prompt.
- Recursive directory traversal (sub-folders).
- Watching multiple folders simultaneously.

## Self-Check

- [x] `src/lib/dir-picker.ts` exists
- [x] `src/hooks/useWatchFolder.ts` exists
- [x] `src/tests/watch-folder.test.ts` exists
- [x] `src/tests/watch-folder.spec.ts` exists
- [x] `watchedFolderAtom` exported from `src/stores/runtime.ts`
- [x] `addWatchFolder` removed from `src/stores/files.ts` (only stale comment reference remains)
- [x] Toolbar wires `useWatchFolder().startWatching` and removed `addWatchFolder` import
- [x] All 7 task commits present in `git log --oneline`
- [x] 6/6 unit assertions pass
- [x] 3/3 Playwright tests pass

## Self-Check: PASSED
