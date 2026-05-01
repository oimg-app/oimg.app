---
phase: 03-svg-pipeline
fixed_at: 2026-05-01T00:00:00Z
review_path: .planning/phases/03-svg-pipeline/03-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-05-01
**Source review:** `.planning/phases/03-svg-pipeline/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (1 Critical + 9 Warnings; 4 Info findings out of scope)
- Fixed: 10
- Skipped: 0

All 38 Playwright specs pass after the changes (including the new T-V5-04
`use[href=data:]` regression test). `npx tsc --noEmit` clean. The
`svg-snippets.unit.ts` suite now reports 15/15 (added 4 tests for WR-06).

## Fixed Issues

### CR-01: T-V5-04 `use href=data:` threat fixture is uncovered by any test

**Files modified:** `src/tests/svg-xss.spec.ts`
**Commit:** c3eb82b
**Applied fix:** Added a dedicated `T-V5-04: use href=data: external reference neutralized` test that calls `runXssTest(page, 'xss-use-data.svg', 'xss-use-data')`, then asserts `cleanSvg` contains neither `href="data:image/svg+xml"` nor `xlink:href="data:image/svg+xml"`, and the literal `__XSS_FIRED__` payload is gone. The test passes in CI today, confirming the existing DOMPurify configuration already neutralizes the vector — no DOMPurify allowlist change was required.

### WR-01: `enqueuePreview` cancels in-flight `computePluginSavings` jobs

**Files modified:** `src/workers/pool.ts`, `src/stores/runtime.ts`
**Commit:** 9bee279
**Applied fix:** Added `WorkerPool.cancelByPrefix(prefix)` that rejects only matching queued + in-flight jobs (without tearing down workers) and replaced the unconditional `pool.cancel()` inside `enqueuePreview` with `pool.cancelByPrefix('preview-')`. The full cancel previously terminated in-flight `savings-` benchmark jobs whenever the user toggled a plugin mid-benchmark, partially populating `pluginSavings` and suppressing the timeout warning. With `cancelByPrefix` the savings workers keep running; the discarded preview's late `resolve` is swallowed by the existing `settled=true` guard in `runOnSlot`.

### WR-02: `removeFile` does not clean up `snippetTogglesByFileId`

**Files modified:** `src/stores/files.ts`
**Commit:** 8bda7b1
**Applied fix:** `removeFile(fileId)` now deletes the per-file entry from `useSettingsStore.snippetTogglesByFileId` via `useSettingsStore.setState` before clearing `byId/order`. `clear()` resets the entire `snippetTogglesByFileId` map. Mirrors the existing URL-revocation cross-store pattern. No circular import (settings.ts does not import files.ts).

### WR-03: `SnippetPanel` blob `.text()` promise has no `.catch()`

**Files modified:** `src/components/panels/SnippetPanel.tsx`
**Commit:** c3c4ca5
**Applied fix:** Replaced the `.then(success)` with the two-arg form `.then(success, failure)`. On rejection, the failure handler logs to console and calls `setSvgText(null)` so the panel falls back to its `Run Optimize to generate snippet` empty state instead of staying permanently stuck on `null` with no diagnostic.

### WR-04: `SnippetPanel` `setTimeout` for copy reset can fire after unmount

**Files modified:** `src/components/panels/SnippetPanel.tsx`
**Commit:** c3c4ca5
**Applied fix:** Added a `copyTimerRef = useRef<...>(null)`. The unmount cleanup effect (`useEffect(() => () => clearTimeout(copyTimerRef.current), [])`) clears any pending timer. The `copy()` function clears any prior timer before scheduling a new one, and the timer callback nulls `copyTimerRef.current` after firing.

### WR-05: T-V5-05 foreignObject test substring check is too weak to catch `<xhtml:script>`

**Files modified:** `src/tests/svg-xss.spec.ts`
**Commit:** c3eb82b
**Applied fix:** Replaced the substring check with `expect(cleanSvg).not.toMatch(/<\w*:?script[\s>]/i)` — matches any optional namespace prefix before `script`. Added a defense-in-depth payload-string check (`expect(cleanSvg).not.toContain('__XSS_FIRED__')`).

### WR-06: `encodeSvgForDataUri` blanket `"` -> `'` replacement breaks SVGs with apostrophes inside attribute values

**Files modified:** `src/lib/svg-snippets.ts`, `src/tests/svg-snippets.unit.ts`
**Commit:** 4e91772
**Applied fix:** Added `hasApostropheInDoubleQuotedAttr(svgString)` that walks every `="..."` attribute value and detects literal apostrophes inside. When the conflict is present, the encoder leaves the literal `"` characters in place during the symbols pass and percent-encodes them as `%22` AT THE END (after the symbols regex; otherwise `%` would be re-encoded to `%25`). Added 4 unit tests covering the conflict path, the data-URI parses-via-`new URL()` round-trip, and the non-conflicting yoksel default. All 15/15 unit tests pass.

### WR-07: `enqueuePreview` outer IIFE has no error sink

**Files modified:** `src/stores/runtime.ts`
**Commit:** 9bee279
**Applied fix:** Replaced `void (async () => { ... })()` with `;(async () => { ... })().catch((err) => console.error('[enqueuePreview] {fileId} (outer):', err))` so any throw BEFORE the inner try/catch (synchronous setup like `crypto.randomUUID` or a future store-immutability tightening) becomes a logged error instead of an unhandled rejection.

### WR-08: `computePluginSavings` continues enqueuing after timeout fires

**Files modified:** `src/App.tsx`
**Commit:** b2c51f3
**Applied fix:** Added two `if (timedOut) return` guards inside the `svgFiles.map(async (file) => { ... })` callback — one before `pool.enqueue` (so the synchronous fan-out stops as soon as the wall-clock timeout lands) and one after the `await` resolves (so a late result is discarded without skewing the partially-measured plugin's `totalDisabledBytes` against `totalBaselineBytes`).

### WR-09: T-V5-07 snippet test asserts on substrings the encoder strips

**Files modified:** `src/tests/svg-xss.spec.ts`
**Commit:** c3eb82b
**Applied fix:** Per-block branch: for any block matching `url("data:image/svg+xml,(...)")`, decode the URI payload (with `decodeURIComponent`) and restore the yoksel `'` -> `"` substitution before substring-checking. For the inline-SVG block, the substring check still runs against the markup directly. The decoded data-URI payload is now what proves cleanliness, not the percent-encoded transport.

## Skipped Issues

None — all 10 in-scope findings were fixed.

---

_Fixed: 2026-05-01_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
