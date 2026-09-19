---
phase: 15
plan: 04
subsystem: ingest
tags: [toolbar, clipboard, ING-01, SC-1, SC-3, SC-5, D-14, D-15, stub-retirement, bundle-gate]
dependency-graph:
  requires:
    - 15-01-SUMMARY (src/lib/url-ingest.ts — pickFromUrl transitive via pickFromClipboard)
    - 15-02-SUMMARY (src/lib/clipboard-ingest.ts — pickFromClipboard, ClipboardDispatcher)
  provides:
    - "src/components/shell/Toolbar.tsx :: 'From URL or paste' wired to pickFromClipboard({ ingest })"
    - "Initial-route bundle budget gate (src/tests/build.test.ts) restored and scoped to HTML-referenced entry chunks"
  affects:
    - src/stores/files.ts (addFromUrl stub deleted — D-14 / SC-5)
tech-stack:
  added: []
  patterns:
    - "page.addInitScript clipboard shim (Object.defineProperty navigator.clipboard) installed BEFORE goto so React onClick sees the stub"
    - "fs.readFileSync static-source assertion inside a Playwright test (Node runtime) — regression-lock for stub retirement"
    - "HTML-entry-scoped bundle gate: parse dist/index.html for <script src> + <link rel=modulepreload href>, weigh only those gzip bytes"
key-files:
  created:
    - src/tests/toolbar-paste.spec.ts
    - src/tests/build.test.ts
  modified:
    - src/components/shell/Toolbar.tsx
    - src/stores/files.ts
decisions:
  - "D-14: addFromUrl(): void {} stub deleted from src/stores/files.ts; replaced with a one-line retirement comment that does NOT include the literal token addFromUrl (so grep stays clean)"
  - "D-15: Toolbar 'From URL or paste' onClick is fire-and-forget — void pickFromClipboard({ ingest }) + setOpen(null). No await; the dispatcher owns all toast feedback (matches useExport.exportOne precedent)"
  - "Rule 3 auto-fix: src/tests/build.test.ts restored after deletion in 87a8ab2; rewritten to weigh only HTML-referenced entry chunks (not every dist/assets/*.js) — the prior naïve sum reported false-over-budget"
metrics:
  duration: ~20 min
  completed_date: 2026-06-13
  tasks_total: 3
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  e2e_tests: 3
  initial_route_gzip_kb: 194.9
  bundle_baseline_kb: 197.97
  bundle_delta_kb: -3.07
---

# Phase 15 Plan 04: Toolbar wire-up + addFromUrl stub deletion Summary

The Toolbar "From URL or paste" menu item now fires the real
`pickFromClipboard` dispatcher from `src/lib/clipboard-ingest.ts`
(Wave 1, plan 15-02), closing ING-01's Toolbar surface. The empty
`addFromUrl(): void {}` stub in `src/stores/files.ts` is retired
(D-14 / SC-5), and three Playwright e2e tests regression-lock both
behaviour branches plus the source-grep stub-deletion guard.
Initial-route gzip remains comfortably under the 200 KB PIPE-02
ceiling at 194.9 KB.

## What Shipped

### `src/components/shell/Toolbar.tsx` (4 insertions, 3 deletions)

- `addFromUrl,` removed from the `@/stores/files` import block.
- New named import: `import { pickFromClipboard } from "@/lib/clipboard-ingest"` (alphabetical position between `@/lib/clipboard` and `@/lib/utils`).
- `useIngest()` destructure widened from `{ openPicker }` to `{ ingest, openPicker }`.
- "From URL or paste" button onClick body replaced:
  ```ts
  // Phase 15 — ING-01: clipboard → ingest dispatcher.
  onClick={() => {
    void pickFromClipboard({ ingest });
    setOpen(null);
  }}
  ```
- All other Toolbar markup, popover behaviour, and unrelated wires untouched.

### `src/stores/files.ts` (2 insertions, 1 deletion)

- Line 100 `export function addFromUrl(): void {}` deleted.
- Replaced with a two-line retirement comment that points readers at the
  new dispatcher path but deliberately avoids the literal token
  `addFromUrl` so the source-grep regression assertions stay clean.

### `src/tests/toolbar-paste.spec.ts` (170 lines, 3 Playwright tests)

| Case | Behaviour | Key assertions |
|---|---|---|
| A — happy | `page.addInitScript` overrides `navigator.clipboard` with `{ read: async () => [{ types: ['image/png'], getType: async () => blob }], readText: async () => '' }` before navigation. Click `Add files ▾` (aria-label "Add files options") → "From URL or paste". | `filesAtom.entries` contains an entry matching `^pasted-\d+\.png$`; sonner toast `"Pasted image imported"` is visible; the "From URL or paste" button has `count === 0` after click (popover closed by Radix unmount). |
| B — negative | `read()` throws `NotAllowedError`; `readText()` resolves `''`. Same click sequence. | sonner toast `"Clipboard has no image or image URL"` is visible; `filesAtom.entries.length === 0`; success toast count is 0. |
| C — stub retired | Node-side `fs.readFileSync` on `src/stores/files.ts` and `src/components/shell/Toolbar.tsx`. | Both files `.not.toContain('addFromUrl')`. Toolbar `.toContain('from "@/lib/clipboard-ingest"')` and `.toContain('pickFromClipboard({ ingest })')` (positive locks). |

### `src/tests/build.test.ts` (62 lines)

Rule 3 auto-fix restoration. The `package.json` `"test:bundle"` script
already targeted `src/tests/build.test.ts`, but a prior `fix: reinit
foundation` commit (`87a8ab2`) deleted the file without updating the
script — so the phase's mandated bundle gate was broken on entry. The
restored implementation tightens the original logic:

- Parses `dist/index.html` for `<script type="module" src="/assets/...js">` and `<link rel="modulepreload" href="/assets/...js">`.
- Sums gzip bytes ONLY for those entry/preload chunks — lazy splits (jSquash codec glue, `svgo.browser`, `libheif-bundle`, `register-sw`, workbox) are excluded.
- Exits 1 if total ≥ 200 KB, 0 otherwise.

This matches CLAUDE.md PIPE-02 intent ("initial route < 200 KB JS
gzipped — all codec WASM is lazy-imported inside the worker").

## Commits

| Task | Description | Commit | Files |
|---|---|---|---|
| 1 | feat(15-04): wire Toolbar From URL or paste to pickFromClipboard | `827ff30` | `src/components/shell/Toolbar.tsx` |
| 2 | refactor(15-04): retire addFromUrl stub from files store (D-14) | `7e6070e` | `src/stores/files.ts` |
| 3 | test(15-04): e2e cover Toolbar From URL or paste + restore bundle gate | `06d087a` | `src/tests/toolbar-paste.spec.ts`, `src/tests/build.test.ts` |

## Verification

```bash
# (1) Toolbar wire-up greps
grep -c "addFromUrl" src/components/shell/Toolbar.tsx                  → 0
grep -c "pickFromClipboard" src/components/shell/Toolbar.tsx           → 2 (import + onClick)
grep -c 'from "@/lib/clipboard-ingest"' src/components/shell/Toolbar.tsx → 1
grep -c "Phase 15 — ING-01" src/components/shell/Toolbar.tsx           → 1
grep -F "void pickFromClipboard({ ingest" src/components/shell/Toolbar.tsx → 1

# (2) Stub retirement (no token in any production file)
grep -rn "addFromUrl" src/  (excluding the new spec which uses the literal as a regression target)
  → only matches in src/tests/toolbar-paste.spec.ts (deliberate)

# (3) e2e
npx playwright test src/tests/toolbar-paste.spec.ts --reporter=line
  → PASS 3 / FAIL 0 (~154s)

# (4) Bundle gate
./node_modules/.bin/vite build  &&  npm run test:bundle
  → [bundle-size] Initial route JS chunks: index-BzDPgc9p.js
  → [bundle-size] Initial JS gzip total: 194.9 KB (budget: 200 KB)
  → [bundle-size] PASS: 194.9 KB < 200 KB
```

## Phase 15 Success Criteria — Final Roll-up

| SC | Coverage | Verified by |
|---|---|---|
| SC-1 — Toolbar From URL or paste → clipboard image → file ingested + success toast | DONE | 15-04 Case A (happy) + 15-02 unit (`clipboard-ingest.test.ts` image branch) |
| SC-2 — URL fetch with CORS-honest failure messaging | DONE | 15-01 (`url-ingest.spec.ts` both cases + `url-ingest.test.ts` 19 assertions) |
| SC-3 — Empty clipboard → friendly no-image toast | DONE | 15-04 Case B (negative) + 15-02 unit (no-URL text branch) |
| SC-4 — Document-level Cmd/Ctrl+V outside text inputs | DONE | 15-03 (`paste-ingest.spec.ts` cases A/B/C — image, URL, input-guard) |
| SC-5 — addFromUrl stub deleted | DONE | 15-04 Case C source-grep + commit `7e6070e` |

## Bundle Impact

| | Before phase | After 15-04 | Delta |
|---|---|---|---|
| Initial route gzip (KB) | 197.97 (pre-phase baseline) | 194.9 | **−3.07 KB** |

The cumulative phase appears to have come in *under* the baseline because
the refined bundle gate now measures only the HTML-referenced entry
chunks (the old gate, before it broke in 87a8ab2, had the same scoping
goal but a coarser filter). The 200 KB ceiling has comfortable headroom
for the next phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] `npm run test:bundle` broken at plan entry**

- **Found during:** Task 3 verification
- **Issue:** `package.json:13` invokes `node --experimental-strip-types src/tests/build.test.ts`, but that file was deleted by commit `87a8ab2` ("fix: reinit foundation") without a corresponding script update. The plan's mandatory bundle gate (`npm run test:bundle`) and the phase's PIPE-02 200 KB ceiling were both unrunnable.
- **Fix:** Restored `src/tests/build.test.ts` from git history (commit `d0859c2`) and tightened the logic to weigh only HTML-referenced entry chunks. The original implementation summed every `dist/assets/*.js`, which conflated lazy codec/svgo/libheif splits with the initial route and produced a false-over-budget reading of 948.2 KB. The new implementation reads `dist/index.html`, extracts all `<script src>` and `<link rel="modulepreload" href>` URLs, and sums gzip bytes only for those — yielding the accurate 194.9 KB measurement.
- **Files modified:** `src/tests/build.test.ts` (created)
- **Commit:** `06d087a` (folded into the Task 3 commit because the gate is the verification command for the same task)
- **Regression check:** Run is fast (`< 1s` after build); does not affect production code; the entry-chunk parse is identical to how Vite emits the HTML.

**2. [Rule 1 — Minor]** The retirement comment placed at `src/stores/files.ts:100` originally read `// Phase 15 — ING-01 (D-14): addFromUrl() stub retired. …` — including the literal `addFromUrl` token would have violated Task 2's `grep -c "addFromUrl" src/stores/files.ts → 0` acceptance criterion. Reworded to `URL-paste stub retired.` and verified.

No architectural changes. No new npm dependencies. No CLAUDE.md rule violations.

## Threat Flags

None. This plan introduces no new trust boundaries; it wires the
Toolbar onClick into the Wave 1 dispatcher (15-02) and deletes the
empty stub (D-14). All Wave-1 mitigations (T-15-01 fetch credentials
omission, T-15-04 filename sanitization, DOMPurify in `useIngest`)
remain in force on every code path.

## Known Stubs

None. The empty `addFromUrl(): void {}` stub is the LAST stub
retirement of Phase 15. `addFromDevice(): void {}` remains in
`src/stores/files.ts:99` — it is consciously retained per Phase 10
Plan 02 (the device picker is fully owned by `useIngest.openPicker`
and the empty stub is intentionally there to discourage future
re-imports; Phase 15 does NOT take it).

## Self-Check: PASSED

- [x] `src/components/shell/Toolbar.tsx` — wire-up greps all pass (verified above)
- [x] `src/stores/files.ts` — `grep -c addFromUrl → 0`
- [x] `grep -rn addFromUrl src/` — only matches inside the regression-lock spec; zero matches in production code
- [x] `src/tests/toolbar-paste.spec.ts` — exists (170 lines, 3 tests pass)
- [x] `src/tests/build.test.ts` — exists, bundle gate runs PASS
- [x] All 3 commits in `git log`: `827ff30`, `7e6070e`, `06d087a`
- [x] `npx playwright test src/tests/toolbar-paste.spec.ts` exits 0 (3 pass)
- [x] `npm run test:bundle` exits 0 (194.9 KB < 200 KB)
- [x] No edits to STATE.md / ROADMAP.md / REQUIREMENTS.md (orchestrator-owned)
- [x] No new npm dependencies
- [x] No `console.*` calls in production code
