---
phase: 15
plan: 03
subsystem: ingest
tags: [paste, clipboard, ING-02, T-15-03, useClipboardIngest, hook, D-11, D-12]
dependency-graph:
  requires:
    - 15-02-SUMMARY (src/lib/clipboard-ingest.ts :: processClipboardEvent, ClipboardDispatcher)
    - 15-01-SUMMARY (src/lib/url-ingest.ts :: pickFromUrl — used transitively via processClipboardEvent)
  provides:
    - "src/hooks/useClipboardIngest.ts :: useClipboardIngest(): void"
  affects:
    - src/App.tsx (single hook invocation added at component root; SW bootstrap untouched)
tech-stack:
  added: []
  patterns:
    - "Single-useEffect listener + cleanup mirrors useWatchFolder shape (Quick 260603-s2x)"
    - "Synthetic ClipboardEvent dispatch via new DataTransfer() + items.add in page.evaluate"
    - "Runtime import via /* @vite-ignore */ '/src/...' absolute URL (matches url-ingest.spec.ts)"
key-files:
  created:
    - src/hooks/useClipboardIngest.ts
    - src/tests/paste-ingest.spec.ts
  modified:
    - src/App.tsx
decisions:
  - "D-11 inputs-elements guard enforced via tagName check + isContentEditable (RESEARCH §3 confirms no Shadow DOM, so composedPath is not needed)"
  - "D-12 preventDefault discipline: only when processClipboardEvent returns true; unrelated text pastes flow through native semantics"
  - "D-13 hook mounted at App root before the SW useEffect — hook lifetime = SPA lifetime; cleanup removeEventListener on unmount"
  - "Rule 3 auto-fix: runtime dynamic-import path inside page.evaluate must be /src/*-absolute (e.g. '/src/stores/files.ts') — Vite cannot serve '/stores/files.ts'. Matched the pattern from url-ingest.spec.ts."
metrics:
  duration: ~30 min
  completed_date: 2026-06-13
  tasks_total: 3
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  e2e_tests: 3
  estimated_bundle_delta_gzip_kb: 0.2
---

# Phase 15 Plan 03: Document-level paste hook (useClipboardIngest) Summary

Document-level `Cmd/Ctrl+V` is now live across the entire app. The new
`useClipboardIngest()` hook mounts a single `document.paste` listener at App
root and routes every paste through the Wave 1 dispatcher
(`processClipboardEvent` from `src/lib/clipboard-ingest.ts`), satisfying
SC-4 (document-level handler) without introducing a second decision tree.
The D-11 input-elements guard and D-12 conditional `preventDefault` keep
the Toolbar filter / future text inputs working untouched. Three Playwright
e2e cases regression-lock the behavior end-to-end.

## What Shipped

### `src/hooks/useClipboardIngest.ts` (40 lines)

| Concern | Implementation |
|---|---|
| Signature | `useClipboardIngest(): void` |
| Effect lifecycle | `useEffect(() => { document.addEventListener('paste', onPaste); return () => document.removeEventListener('paste', onPaste) }, [ingest])` |
| Dispatcher seam | `const { ingest } = useIngest()` — same single seam used by Watch folder, device picker, drop |
| D-11 guard | `tagName === 'input' \|\| tagName === 'textarea' \|\| isContentEditable → return` (no composedPath; no Shadow DOM in app) |
| D-12 preventDefault | Only when `processClipboardEvent` returned `true` |
| Listener phase | Default (bubble) — capture would conflict with D-12 |

Provenance comment at top: `// Phase 15 — ING-02: document-level Cmd/Ctrl+V handler. Source: 15-03-PLAN.md`.

### `src/App.tsx` (+3 lines)

- Import added: `import { useClipboardIngest } from '@/hooks/useClipboardIngest'`
- Invocation at the top of the `App()` body, BEFORE the existing SW
  bootstrap `useEffect`. Inline comment marks the provenance.
- SW bootstrap useEffect, Toaster mount, and AppShell render are unchanged.

### `src/tests/paste-ingest.spec.ts` (148 lines, 3 Playwright tests)

| Case | What it verifies | Assertion |
|---|---|---|
| A — image paste | document.body receives a `paste` with an `image/png` File | `filesAtom.entries` contains `pasted.png`; sonner toast `"Pasted image imported"` is visible |
| B — URL paste | document.body receives a `paste` with `text/plain` payload `https://cors-test.example/paste-via-url.png`; `page.route` stubs the URL with a 1×1 PNG | `filesAtom.entries` contains `paste-via-url.png`; sonner toast `"Imported from URL: cors-test.example"` is visible |
| C — input guard | Focus the Toolbar filter input (`getByRole('searchbox', { name: 'Filter files' })`), dispatch the same image paste with `e.target = inputEl` | After 750 ms settle window: `filesAtom.entries.length === 0` AND the success toast count is `0` |

Synthetic ClipboardEvent built in-browser via `new DataTransfer()` +
`dt.items.add(file)` / `dt.items.add(string, mime)` — both shapes are native
in Chromium. Same `page.route` interception pattern used in
`url-ingest.spec.ts`. Tests share the verified 1×1 transparent PNG byte
string with that spec.

## Commits

| Task | Description | Commit | Files |
|---|---|---|---|
| 1 | feat(15-03): add useClipboardIngest document-paste hook | `3606858` | `src/hooks/useClipboardIngest.ts` |
| 2 | feat(15-03): wire useClipboardIngest at App root (ING-02) | `352904c` | `src/App.tsx` |
| 3 | test(15-03): e2e cover paste hook (image, URL, input-guard) | `8a2cc2e` | `src/tests/paste-ingest.spec.ts` |

## Verification

```bash
node --experimental-strip-types --check src/hooks/useClipboardIngest.ts
# → OK (exit 0)

grep -c "addEventListener('paste'" src/hooks/useClipboardIngest.ts   # → 1
grep -c "removeEventListener('paste'" src/hooks/useClipboardIngest.ts # → 1
grep -c "isContentEditable" src/hooks/useClipboardIngest.ts          # → 2 (≥1 required)
grep -c "if (consumed)" src/hooks/useClipboardIngest.ts              # → 1
grep -c "export function useClipboardIngest" src/hooks/useClipboardIngest.ts # → 1

grep -c "useClipboardIngest" src/App.tsx                              # → 2 (import + invocation)
grep -c "from '@/hooks/useClipboardIngest'" src/App.tsx               # → 1
grep -c "Phase 15 — ING-02" src/App.tsx                               # → 1

npx playwright test src/tests/paste-ingest.spec.ts --reporter=line
# → PASS (3)  FAIL (0)  Time: ~154 s
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Runtime `import('../stores/files.ts')` failed inside `page.evaluate`**

- **Found during:** Task 3 first test run
- **Issue:** Initial implementation used `await import('../stores/files.ts')` inside `page.evaluate` callbacks, copying the shape from `src/tests/ingest.spec.ts`. In Playwright's `page.evaluate`, the function body is serialized and run in the browser, so the relative path resolves against the spec file's served URL (`http://localhost:5174/tests/paste-ingest.spec.ts`) — producing `http://localhost:5174/stores/files.ts`, which Vite can't serve. All 3 tests failed with `TypeError: Failed to fetch dynamically imported module`.
- **Fix:** Switched every `page.evaluate` import to the absolute Vite-served URL pattern from `src/tests/url-ingest.spec.ts`: `await import(/* @vite-ignore */ '/src/stores/files.ts')`. The `@vite-ignore` comment matches the prior spec's style (TypeScript still type-checks the result via a local type assertion).
- **Files modified:** `src/tests/paste-ingest.spec.ts`
- **Commit:** `8a2cc2e` (folded into the Task 3 commit because the import-fix was prerequisite for the spec to run)
- **Regression check:** Reran the full spec → 3/3 pass.

No architectural changes. No new npm dependencies. No CLAUDE.md rule violations.

## Bundle Impact

- `src/hooks/useClipboardIngest.ts`: ~0.2 KB initial gzip (estimate per RESEARCH §8)
- `src/App.tsx`: +3 lines (single import + invocation). The import pulls in the hook which is already counted above. No new runtime cost.
- Phase 15 Wave 1 already added the dispatcher (~0.7 KB) and url-ingest (~0.5 KB) to the eventually-loaded set; ING-02 is the consumer that activates them at runtime. Phase 15 cumulative bundle delta ≈ 1.5 KB gzip — within the 200 KB ceiling.

## Threat Model — T-15-03 (Per-paste cost)

Per-paste hot-path is:
1. `e.target as HTMLElement | null`
2. `target?.tagName?.toLowerCase()`
3. One string-comparison vs `'input'` / `'textarea'`
4. `target?.isContentEditable` check (boolean read)

Negligible per-event cost. P-12 (double-handle prevention) confirmed by Case C — focusing the filter input and dispatching the image paste produces zero ingestion.

## Carry-forward Concerns

None. The hook + the dispatcher together fully cover ING-02. Wave 2 Plan 15-04 (Toolbar wire-up) will exercise `pickFromClipboard` — the other branch of `clipboard-ingest.ts` — and retire the `addFromUrl` empty stub.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `src/hooks/useClipboardIngest.ts` — FOUND (40 lines, syntax-checked)
- [x] `src/App.tsx` — invocation + import present (greps verified above)
- [x] `src/tests/paste-ingest.spec.ts` — FOUND (3 tests, all pass)
- [x] All 3 commits in `git log`: `3606858`, `352904c`, `8a2cc2e`
- [x] D-11 guard implemented (tagName + isContentEditable)
- [x] D-12 preventDefault gated on `consumed === true`
- [x] Hook listener mounts/unmounts via `useEffect` cleanup
- [x] No `console.*` calls in the hook
- [x] No new npm dependencies
- [x] No edits to STATE.md / ROADMAP.md / REQUIREMENTS.md
