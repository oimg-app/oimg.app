---
phase: 02-worker-harness-state
plan: 05
subsystem: cleanup
tags: [phase-02, wave-3, cleanup, mock-deletion, regression-sweep]

# Dependency graph
requires:
  - phase: 02-worker-harness-state
    plan: 04
    provides: "App.tsx + Toolbar wired to stores + worker pool, ARIA live region with quartile cadence, sonner Toaster, Wave 0 VR specs (VR-01..VR-05) flipped to live green, vite worker.format='es' chunk emission, dev-only window.__OIMG_STORES__"
provides:
  - "Phase 2 final regression-green build (17/17 Playwright tests, bundle 84.4 KB / 200 KB budget)"
  - "src/data/mock.ts deleted; types consolidated in @/types and data constants in @/data/defaults"
  - "Queue listbox now driven by useFilesStore (was MOCK_FILES); shell.spec.ts seeds 3 synthetic FileEntries via __OIMG_STORES__"
  - "VR-07 proven: dist/assets emits worker-*.js + stub-adapter-*.js as separate chunks; main index-*.js bundle does NOT contain stub-adapter code"
  - "T-02-EXP fully closed: __OIMG_STORES__ and __OIMG_SLOW_MS__ both tree-shaken from production build"
  - "Bundle test runner fixed for Node 22 (--input-type=module → --experimental-strip-types)"
affects: [03-svg-pipeline, 05-raster-encoders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type unions/interfaces consolidated in src/types/index.ts; visual-shell data constants live in src/data/defaults.ts"
    - "MockFile-shaped view model derived on-the-fly from useFilesStore.byId/order so Phase 1 row-renderer keeps working without rewrite (Phase 5 replaces with FileEntry view model)"
    - "Empty-shell PLACEHOLDER_FILE pattern keeps Compare/Inspector panes mountable when queue is empty"
    - "Test-store seeding via window.__OIMG_STORES__.files.getState().addFile (replaces MOCK_FILES count assertions)"
    - "Bundle test script: node --experimental-strip-types runs TS directly under Node 22+ (no transpilation step)"

key-files:
  created: []
  modified:
    - "src/App.tsx"
    - "src/components/panels/CodecPanel.tsx"
    - "src/components/panels/OutputPanel.tsx"
    - "src/components/panels/ReportPanel.tsx"
    - "src/components/panels/SvgoPanel.tsx"
    - "src/components/shell/TitleBar.tsx"
    - "src/data/defaults.ts"
    - "src/tests/shell.spec.ts"
    - "src/types/index.ts"
    - "package.json"
    - ".planning/STATE.md"
    - ".planning/ROADMAP.md"
  removed:
    - "src/data/mock.ts"

key-decisions:
  - "Types `FileType`, `FileStatusMock`, `MockFile`, `CodecLabel`, `ResizeAlg`, `FitMode`, `SvgoPlugin` move to src/types/index.ts (single types module); data constants `CODECS`, `RESIZE_ALG`, `FIT_MODES`, `SVGO_PLUGINS` move to src/data/defaults.ts (single source of truth for UI control values)."
  - "MOCK_FILES is replaced by a store-derived `SHELL_FILES` MockFile[] computed from useFilesStore.byId/order. Phase 1's existing queue/Compare/Inspector renderer keeps working unchanged because it reads from the same shape — only the source flips from a static fixture to a live store subscription. Phase 5 will replace MockFile with a FileEntry view model and delete the shim."
  - "PLACEHOLDER_FILE pattern: when nothing is selected (empty queue), Compare/Inspector render a synthetic placeholder row (`'No file selected'`) so the visual shell keeps its layout. Phase 5 will swap placeholder logic for an empty-state component."
  - "selectedId fallback: 'f1' (legacy MOCK_FILES default) → 'placeholder' so aria-activedescendant continues to resolve to the placeholder row in the empty-shell state."
  - "Bundle test runner switched from `--input-type=module` (now disallowed for file paths in Node 22) to `--experimental-strip-types`. This change is invisible to consumers of `npm run test:bundle` — same exit codes, same output format."

requirements-completed: []
# PERF-04 (codec bundle splitting) NOT marked complete — Phase 5 must land AVIF lazy-load
# before the requirement closes. Phase 2 verified the chunking architecture works (worker
# + stub-adapter are separate chunks) but the AVIF-specific test ships in Phase 5.

# Metrics
duration: ~12min
completed: 2026-04-30
---

# Phase 2 Plan 05: Cleanup Summary

**`src/data/mock.ts` deleted in the final cleanup wave. Phase 1 visual-shell types and constants consolidated into the canonical `@/types` and `@/data/defaults` modules; the queue listbox is now driven by `useFilesStore` instead of a static fixture. Full Phase 2 regression: 17/17 Playwright tests green, bundle 84.4 KB / 200 KB budget, worker + stub-adapter chunks emit separately, `__OIMG_STORES__` + `__OIMG_SLOW_MS__` both tree-shaken from production. Phase 2 ships green.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-30T16:47:56Z
- **Completed:** 2026-04-30T16:59:36Z
- **Tasks:** 2
- **Files created:** 0
- **Files modified:** 11 (10 source + 1 package.json + STATE.md + ROADMAP.md = effective 12)
- **Files removed:** 1 (`src/data/mock.ts`)

## Accomplishments

- **`src/data/mock.ts` deleted** per Phase 1 plan 01-03 header comment + RESEARCH.md Open Question 3 ("delete in the LAST plan of Phase 2"). All 6 consumer files migrated cleanly: TitleBar.tsx, CodecPanel.tsx, SvgoPanel.tsx, OutputPanel.tsx, ReportPanel.tsx, App.tsx.
- **Types moved** from `src/data/mock.ts` to `src/types/index.ts`: `FileType`, `FileStatusMock`, `MockFile`, `CodecLabel`, `ResizeAlg`, `FitMode`, `SvgoPlugin`. Single types module is now the canonical source.
- **Data constants moved** from `src/data/mock.ts` to `src/data/defaults.ts`: `CODECS`, `RESIZE_ALG`, `FIT_MODES`, `SVGO_PLUGINS`. `defaults.ts` is now the single source of truth for UI control values.
- **App.tsx queue rendering rewired** to derive a `MockFile[]` view model on-the-fly from `useFilesStore.byId`/`order`. The queue listbox, totals row, and ReportPanel all read from this derived array — Phase 1 visual-shell renderer keeps working unchanged because the shape didn't move; only the source flipped from a static fixture to a live store subscription.
- **PLACEHOLDER_FILE pattern** added so Compare/Inspector panes mount cleanly when the queue is empty. Pattern survives until Phase 5 swaps placeholder for an empty-state component.
- **shell.spec.ts queue test rewritten:** old assertion `await expect(options).toHaveCount(12)` (mock-derived) replaced with a seeded test that drops 3 synthetic FileEntries via `window.__OIMG_STORES__.files.getState().addFile(...)` and asserts `toHaveCount(3)`. Test name updated to `'queue listbox renders option rows seeded from useFilesStore'`.
- **Full Playwright suite green: 17/17.** shell.spec.ts (11) + worker-pool.spec.ts (3) + object-url.spec.ts (1) + aria-live.spec.ts (2) — all PASS in 3.5s.
- **Bundle budget verified:** initial JS gzip total = **84.4 KB** (budget: 200 KB). Comfortably 58% under budget.
- **VR-07 proven:** `dist/assets/` emits `worker-yLMyQuJU.js` (4.5 KB) and `stub-adapter-DGDK3pfx.js` (151 B) as separate chunks. The main `index-*.js` bundle does NOT contain stub-adapter code (verified: `grep -l "input.slice(0)" dist/assets/index-*.js` returns no match).
- **T-02-EXP closed:** `__OIMG_STORES__` and `__OIMG_SLOW_MS__` both absent from `dist/assets/*.js` (0 matches each). Vite's `import.meta.env.DEV` guard tree-shakes both dev-only affordances cleanly.
- **`npm run test:bundle` fixed for Node 22:** `--input-type=module src/tests/build.test.ts` is no longer accepted by Node 22+ (the flag rejects file path inputs). Switched to `--experimental-strip-types src/tests/build.test.ts` which runs TypeScript directly under Node 22.6+.

## Task Commits

1. **Task 1: Delete mock.ts; migrate types to @/types and data to @/data/defaults; rewire App.tsx + 5 consumer components; rewrite shell.spec.ts queue test** — `c7107da` (feat)
2. **Task 2: Full regression sweep — fix bundle test for Node 22; ROADMAP / STATE updates** — final commit (this plan's metadata commit)

## Files Modified

- **`src/App.tsx`** — Removed import from `@/data/mock`; replaced with imports from `@/types` (types) and `@/data/defaults` (CODECS, SVGO_PLUGINS). MOCK_FILES references replaced with store-derived `SHELL_FILES` (MockFile-shaped view model from useFilesStore.byId/order). Added PLACEHOLDER_FILE for empty-shell state. selectedId fallback flipped 'f1' → 'placeholder'. totals/file/filteredFiles all now compute from store-derived data.
- **`src/components/shell/TitleBar.tsx`** — `import { CODECS, type CodecLabel } from '@/data/mock'` → `import type { ThemeMode, CodecLabel } from '@/types'; import { CODECS } from '@/data/defaults'`.
- **`src/components/panels/CodecPanel.tsx`** — `import { CODECS, RESIZE_ALG, FIT_MODES, type CodecLabel, type ResizeAlg, type FitMode } from '@/data/mock'` → `import { CODECS, RESIZE_ALG, FIT_MODES } from '@/data/defaults'; import type { CodecLabel, ResizeAlg, FitMode } from '@/types'`.
- **`src/components/panels/SvgoPanel.tsx`** — `import type { SvgoPlugin } from '@/data/mock'` → `import type { SvgoPlugin } from '@/types'`.
- **`src/components/panels/OutputPanel.tsx`** — `import type { MockFile } from '@/data/mock'` → `import type { MockFile } from '@/types'`.
- **`src/components/panels/ReportPanel.tsx`** — `import type { MockFile } from '@/data/mock'` → `import type { MockFile } from '@/types'`.
- **`src/types/index.ts`** — Added `FileType`, `FileStatusMock`, `MockFile`, `CodecLabel`, `ResizeAlg`, `FitMode`, `SvgoPlugin` exports (moved from mock.ts).
- **`src/data/defaults.ts`** — Added imports for new types, plus `CODECS`, `RESIZE_ALG`, `FIT_MODES`, `SVGO_PLUGINS` data constants (moved from mock.ts).
- **`src/tests/shell.spec.ts`** — `'queue renders a listbox with options'` test rewritten as `'queue listbox renders option rows seeded from useFilesStore'`. Now seeds 3 synthetic FileEntries via `window.__OIMG_STORES__` and asserts the option count is 3 (was 12 from MOCK_FILES.length).
- **`package.json`** — `test:bundle` script updated for Node 22 compatibility: `--input-type=module` → `--experimental-strip-types`.

## Files Removed

- **`src/data/mock.ts`** — Phase 1 visual-shell fixture file (12 fake files, 22 SVGO plugin entries, codec/resize/fit enums). Per its own header comment ("This file will be deleted in Phase 2") and per Phase 2 RESEARCH.md Open Question 3 ("delete in the LAST plan of Phase 2"). All consumers migrated; replacement constants live in `src/types/index.ts` (types) and `src/data/defaults.ts` (data).

## Decisions Made

- **Types in @/types, data in @/data/defaults** — Plan offered "either move types to types/index.ts or move data to defaults.ts." Did both, splitting cleanly: types are typed contracts, data are runtime values. Eliminates the cross-cutting mock module entirely.
- **Store-driven SHELL_FILES instead of empty array** — Plan's literal interpretation ("Phase 2 starts with an empty file list") would have made the queue listbox always render zero rows, breaking the seed-via-store test path. Instead, derive a MockFile-shaped view model from `useFilesStore.byId`/`order` so the existing renderer keeps working. The queue is empty by default (because the store is empty by default) but tests + future drag-drop populate it.
- **PLACEHOLDER_FILE for empty-shell state** — Compare/Inspector panes need a `file` prop to render. Rather than gate every panel on `file != null`, surface a synthetic placeholder MockFile so the layout stays mountable. Phase 5 replaces this with a proper empty-state component.
- **`requirements-completed: []`** — Plan frontmatter lists [PERF-01, PERF-02, PERF-03], but those were already closed by plan 02-04. No new requirements close in this plan. PERF-04 (codec bundle splitting) NOT marked complete — Phase 5 owns AVIF lazy-load verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `npm run test:bundle` failed on Node 22 with `ERR_INPUT_TYPE_NOT_ALLOWED`**

- **Found during:** Task 2 (`npm run test:bundle`).
- **Issue:** The package.json script uses `node --input-type=module src/tests/build.test.ts`. Node 22 enforces that `--input-type` only accepts string input via `--eval`/`--print`/STDIN. Passing a file path with the flag now throws.
- **Fix:** Switched to `node --experimental-strip-types src/tests/build.test.ts`, which runs TypeScript directly under Node 22.6+ without transpilation. Bundle test now passes: `[bundle-size] PASS: 84.4 KB < 200 KB`.
- **Files modified:** `package.json`
- **Committed in:** Task 2 metadata commit (this plan's final commit).

**2. [Rule 1 — Bug] Plan-literal "empty SHELL_FILES" would have made the queue test untestable**

- **Found during:** Task 1 (drafting the shell.spec.ts replacement test).
- **Issue:** Plan instructed to replace MOCK_FILES with "an empty initial state OR data drawn from the appropriate store" — but a fixed empty array means seeded files in `useFilesStore.byId` never reach the queue listbox renderer (which iterates `filteredFiles` derived from `SHELL_FILES`). The new shell.spec.ts test would fail.
- **Fix:** Derive `SHELL_FILES` as a MockFile[] view model computed on-the-fly from `useFilesStore.byId`/`order`. The shape stays the same so the Phase 1 row-renderer keeps working; the source becomes a live store subscription. Phase 5 will replace MockFile with a FileEntry view model and delete the shim.
- **Files modified:** `src/App.tsx`
- **Committed in:** `c7107da` (Task 1).

### Documented Deviations

None. Both auto-fixes are Rule-1/3 bugs found and fixed inline.

## Issues Encountered

- **MOCK_FILES was integrated more deeply than the plan implied.** App.tsx alone had 8 references (file selection, filteredFiles, totals, ReportPanel.files, StatusBar.filesCount, etc.). Plus 5 panel/shell components imported types or data. Plan instructed "minimum migration with empty initial state" — actually shipping that would have broken the queue listbox test path. Resolved by deriving SHELL_FILES from the store (still empty by default, but populates when seeded).
- **Node 22 bundle-test breakage.** The `--input-type=module` flag rejecting file paths was a regression introduced in Node 22's stricter ESM resolver. The fix (switching to `--experimental-strip-types`) is forward-compatible — Node 23+ has type-stripping on by default.

## Threat Flags

None new. The threat register entries from Plans 02-02..02-04 remain mitigated:

- **T-02-01 (cancel race)** — already fully mitigated; VR-03 still asserts <200ms cancel transition.
- **T-02-02 (URL leak)** — already fully mitigated; VR-04 still asserts created === revoked + cached.
- **T-02-EXP (`__OIMG_STORES__` info disclosure)** — fully closed by this plan: `grep '__OIMG_STORES__' dist/assets/*.js` returns 0 matches; `grep '__OIMG_SLOW_MS__' dist/assets/*.js` likewise 0 matches.
- **T-02-04 (DoS — unbounded queue)** — accepted; documented in STATE.md as a known v1 boundary deferred to Phase 4 memory-model work.

## Known Stubs

- **PLACEHOLDER_FILE in App.tsx** — Synthetic placeholder MockFile rendered in Compare/Inspector when nothing is selected. Documented inline; Phase 5 replaces with a proper empty-state component. Not a stub that prevents Phase 2's goal.
- **Codec UI state still local** — Same caveat as plan 02-04. Codec settings (`codec`, `q`, `method`, `lossless`, etc.) remain in App.tsx local state because the stub adapter ignores them. Phase 5 raster encoders plan owns the migration to `useSettingsStore`.
- **`saved bytes` placeholder in batch-end announcement** — Same as plan 02-04. Hardcoded `'0 bytes'` because the stub adapter doesn't actually shrink anything. Phase 3+ derives savedBytes from `optimizedSize - originalSize` deltas.

## Next Plan Readiness

- **Phase 3 (SVG Pipeline):** Has a clean adapter slot in `src/workers/worker.ts` ADAPTERS map. Replace the `'svg'` throw with `() => import('./svg-adapter')`. Worker pool, runtime store wiring, and live region all just work — Phase 3 only needs to swap the `'stub'` format in App.tsx's startOptimize for a per-FormatId picker.
- **Phase 5 (Raster encoders):** Same pattern as Phase 3. Each codec adapter is its own chunk; AVIF lazy-imports keep PERF-02 honored. Codec UI state migration to `useSettingsStore` happens here.
- **MOCK_FILES sequencing constraint resolved.** Phase 5 can drop the SHELL_FILES MockFile shim entirely once panels accept FileEntry directly.
- **Phase 2 ships green** with the entire VR-01..VR-07 contract live.

## Self-Check: PASSED

Verification commands run, all GREEN:

- `! test -e src/data/mock.ts` → PASS (file deleted)
- `grep -rn "from '@/data/mock'" src/` → no matches (exit 1) — PASS
- `grep -rn "MOCK_FILES" src/` → only comment matches in App.tsx + shell.spec.ts; no code references — PASS
- `./node_modules/.bin/tsc -b` → exit 0 — PASS
- `npm run build` → exit 0; emits `dist/assets/worker-yLMyQuJU.js` (4.57 kB) + `dist/assets/stub-adapter-DGDK3pfx.js` (151 B) — PASS
- `npx playwright test --reporter=list` → 17/17 PASS in 3.5s
- `npm run test:bundle` → `[bundle-size] PASS: 84.4 KB < 200 KB` — PASS
- `ls dist/assets/ | grep -E 'worker'` → `worker-yLMyQuJU.js` — PASS
- `ls dist/assets/ | grep -i 'stub-adapter'` → `stub-adapter-DGDK3pfx.js` — PASS
- `! grep -l 'input.slice(0)' dist/assets/index-*.js` → no match (stub-adapter code NOT in main bundle) — PASS
- `grep -l '__OIMG_STORES__' dist/assets/*.js` → 0 matches — T-02-EXP CLOSED
- `grep -l '__OIMG_SLOW_MS__' dist/assets/*.js` → 0 matches — test affordance tree-shaken — PASS
- `git log --oneline | grep c7107da` → FOUND (Task 1 commit)
- STATE.md / ROADMAP.md updated with Phase 2 completion

---
*Phase: 02-worker-harness-state*
*Completed: 2026-04-30*
