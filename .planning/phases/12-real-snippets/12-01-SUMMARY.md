---
phase: 12
plan: 01
subsystem: clipboard
tags: [phase-12, wave-1, clipboard, SNIP-01, D-14, D-15]
requirements_completed: [SNIP-01]
dependency_graph:
  requires: []
  provides:
    - "copyToClipboard chokepoint — Plans 03, 04, 05 funnel through it"
    - "installClipboardMocks Playwright helper — Plans 03, 04, 05 e2e specs consume"
  affects:
    - "src/components/panels/inspector/OutputPanel.tsx (Plan 03 reroutes navigator.clipboard.writeText through copyToClipboard)"
    - "src/components/shell/Toolbar.tsx (Plan 04 wires bulk-copy buttons through copyToClipboard via useSnippets hook)"
    - "src/components/panels/files/FileRow.tsx (Plan 05 wires two ContextMenu items through copyToClipboard via useSnippets hook)"
tech_stack:
  added: []
  patterns:
    - "feature-detect + silent-fallback dispatcher (parallel to src/lib/save-blob.ts EXP-01 shape)"
    - "try/finally textarea cleanup (T-12-04 mitigation)"
    - "addInitScript-based mock helper with three modes (parallel to save-file-mocks.ts shape)"
    - "Node --experimental-strip-types unit runner with Object.defineProperty global stubs (Node 22+ navigator-getter workaround)"
key_files:
  created:
    - src/lib/clipboard.ts
    - src/tests/setup/clipboard-mocks.ts
    - src/tests/clipboard.test.ts
  modified: []
decisions:
  - "D-14 chokepoint signature locked: copyToClipboard(text, kind, label) → { ok, method }; kind unused in v1, kept for future analytics off-ramp"
  - "D-15 single-import policy: src/lib/clipboard.ts is the only file in the app importing sonner.toast for clipboard surface — all other surfaces (OutputPanel, Toolbar, FileRow) call this helper"
  - "Test stub strategy: globalThis defineProperty (NOT direct assignment) — Node 22+ exposes navigator as a read-only getter"
  - "Sonner import side-effects absorbed via headStub.appendChild + createTextNode stubs — module-level __insertCSS runs at import time and cannot be avoided"
metrics:
  duration_seconds: 213
  duration_human: "3 min 33 sec"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
  completed_at: "2026-06-03"
---

# Phase 12 Plan 01: Clipboard Chokepoint Dispatcher Summary

**One-liner:** copyToClipboard chokepoint with navigator.clipboard → execCommand fallback + sonner toast; Playwright mock helper with three modes; node --experimental-strip-types native-path unit test.

## Tasks Completed

| Task | Name                                                                  | Commit    | Files                                  |
| ---- | --------------------------------------------------------------------- | --------- | -------------------------------------- |
| 1    | Implement src/lib/clipboard.ts copyToClipboard chokepoint dispatcher  | `d130c1f` | src/lib/clipboard.ts                   |
| 2    | Create src/tests/setup/clipboard-mocks.ts shared Playwright helper    | `8db9e1e` | src/tests/setup/clipboard-mocks.ts     |
| 3    | Create src/tests/clipboard.test.ts unit test (native path)            | `7df68ab` | src/tests/clipboard.test.ts            |

## Verification Results

| Gate                                                                              | Result      |
| --------------------------------------------------------------------------------- | ----------- |
| `./node_modules/.bin/tsc -b`                                                      | EXIT 0      |
| `node --experimental-strip-types src/tests/clipboard.test.ts`                     | 5 passed, 0 failed |
| `grep -c "isSecureContext" src/lib/clipboard.ts`                                  | 2 (≥ 1 OK)  |
| `grep -c "addInitScript" src/tests/setup/clipboard-mocks.ts`                      | 2 (≥ 1 OK)  |
| `grep -v '^//' src/lib/clipboard.ts \| grep -cE 'console\.(log\|error)'`          | 0 (zero-telemetry OK) |
| `grep -c "finally" src/lib/clipboard.ts`                                          | 2 (T-12-04 cleanup OK) |

## Decisions Made

- **D-14 chokepoint contract:** `copyToClipboard(text, kind, label) → Promise<CopyResult>` returns `{ ok: boolean, method: 'native' | 'execCommand' | 'failed' }`. Caller never has to try/catch.
- **D-15 single-import policy:** Only `src/lib/clipboard.ts` imports `toast` from `sonner` for the clipboard surface. Plans 03–05 consume this helper and rely on its toast emission; no double-toasting.
- **Node 22+ navigator-getter workaround:** Direct assignment `globalThis.navigator = …` throws `TypeError: Cannot set property navigator of #<Object> which has only a getter`. Resolved via `Object.defineProperty(globalThis, 'navigator', { value: …, writable: true, configurable: true })`.
- **Sonner side-effect at import:** sonner's `__insertCSS` runs at module-load and calls `document.getElementsByTagName('head')`, `document.createElement('style')`, and `document.createTextNode(...)`. Unit test absorbs all three via the document stub. The toast emission itself is not asserted in the unit (the e2e specs in Plans 03/04/05 carry that coverage).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Node 22+ navigator-getter rejection in unit test**
- **Found during:** Task 3 first run
- **Issue:** `(globalThis as any).navigator = { … }` threw `TypeError: Cannot set property navigator of #<Object> which has only a getter` under Node 25.9.0. The PATTERNS.md sample used direct assignment, which works on older Node but not the current runtime.
- **Fix:** Wrapped global stubs in `Object.defineProperty(globalThis, name, { value, writable: true, configurable: true })` via a `defineGlobal()` helper. Same shape, runs on modern Node.
- **Files modified:** src/tests/clipboard.test.ts
- **Commit:** Part of `7df68ab`

**2. [Rule 3 - Blocking issue] Sonner __insertCSS side-effect at import time**
- **Found during:** Task 3 second run
- **Issue:** sonner v2 runs an `__insertCSS` IIFE at module-load. `import('../lib/clipboard.ts')` triggers sonner's import, which calls `document.getElementsByTagName('head')` → `headStub.appendChild(styleEl)` → `styleEl.appendChild(document.createTextNode(css))`. The minimal document stub from PATTERNS.md (just `createElement` / `body`) was insufficient.
- **Fix:** Extended the document stub with `getElementsByTagName` (returns `[headStub]` for `'head'`), `head` property, `createTextNode`, and a branched `createElement('style')` path.
- **Files modified:** src/tests/clipboard.test.ts
- **Commit:** Part of `7df68ab`

### Architectural Changes

None.

### Authentication Gates

None.

## Carry-Forward Notes for Plans 02–05

Plans 03 (OutputPanel), 04 (Toolbar), and 05 (FileRow) all consume the artifacts shipped here:

1. **Import path:** `import { copyToClipboard } from '@/lib/clipboard'`
2. **Call shape:** `await copyToClipboard(text, 'snippet' | 'manifest' | 'data-uri', label)`
3. **Do NOT double-toast:** the helper already calls `toast.success(\`${label} copied\`)` on success and `toast.error('Copy failed — try again')` on dual-failure. Plans 03/04/05 should NOT toast again on the same call. The OutputPanel "Copied!" inline button-state flip is independent of the toast and still valid (gate it on `result.ok`).
4. **Label format:** per D-04 / D-09 / D-12, labels read like `'Base64'`, `'<picture> for 5 files'`, `'Data URI for hero.png'`. The helper appends `' copied'` automatically.
5. **Mock import:** `import { installClipboardMocks } from '@/tests/setup/clipboard-mocks'` — call BEFORE `page.goto('/')`. Default mode is `'native'`.
6. **Spy globals available after install:**
   - `window.__clipboardWrites: string[]` — every text passed through either path
   - `window.__execCopyCalls: string[]` — fallback path only (the textarea value at copy time)
   - `window.__clipboardMocksInstalled: boolean` — early presence assertion
7. **Plan 02 (snippets builders) does NOT consume clipboard.ts** — that plan ships pure builders. Clipboard wiring lands in Plans 03/04/05.

## Known Stubs

None — clipboard.ts is fully wired; no UI hooks yet because Plans 03–05 own that work.

## Threat Flags

None — the implementation matches the threat model in PLAN.md exactly (T-12-03 mitigation via feature-detect, T-12-04 mitigation via try/finally, T-12-LOG mitigation via zero-console-call assertion).

## Self-Check: PASSED

- `src/lib/clipboard.ts` exists — verified
- `src/tests/setup/clipboard-mocks.ts` exists — verified
- `src/tests/clipboard.test.ts` exists — verified
- Commits `d130c1f`, `8db9e1e`, `7df68ab` all in `git log --oneline -5` — verified
- `tsc -b` exits 0 — verified
- Unit test exits 0 with `5 passed, 0 failed` — verified
