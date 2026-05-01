---
phase: 03-svg-pipeline
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/App.tsx
  - src/components/panels/SnippetPanel.tsx
  - src/components/panels/SvgoPanel.tsx
  - src/data/defaults.ts
  - src/index.css
  - src/lib/sanitize-svg.ts
  - src/lib/snippet-registry.ts
  - src/lib/svg-snippets.ts
  - src/stores/files.ts
  - src/stores/runtime.ts
  - src/stores/settings.ts
  - src/tests/fixtures/xss-css-expression.svg
  - src/tests/fixtures/xss-data-href.svg
  - src/tests/fixtures/xss-foreignobject.svg
  - src/tests/fixtures/xss-javascript-href.svg
  - src/tests/fixtures/xss-onload.svg
  - src/tests/fixtures/xss-onmouseover.svg
  - src/tests/fixtures/xss-script.svg
  - src/tests/fixtures/xss-use-data.svg
  - src/tests/fixtures/xss-xlink-href.svg
  - src/tests/svg-adapter.unit.ts
  - src/tests/svg-pipeline.spec.ts
  - src/tests/svg-snippets.unit.ts
  - src/tests/svg-xss.spec.ts
  - src/types/index.ts
  - src/workers/svg-adapter.ts
  - src/workers/svg-config.ts
  - src/workers/types.ts
  - src/workers/worker.ts
  - vite.config.ts
findings:
  critical: 1
  warning: 9
  info: 4
  total: 14
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-01
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

The Phase 3 SVG pipeline (SVGO worker + main-thread DOMPurify + snippet registry) is largely sound: the worker boundary correctly excludes DOMPurify (no `document` in workers), `previewJobId` guards stale results, the `Math.max(0, pct)` clamp protects the savings UI, and the auxiliary-job (`preview-`/`savings-`) discriminator prevents the runtime store's `doneCount` from being inflated by background jobs. The XSS test corpus (T-V5-01..07) provides defence-in-depth via three independent assertions (`__XSS_FIRED__` undefined + cleaned-blob substring scan + sanitizedCount captured).

However, the review surfaced one BLOCKER and several quality defects:

- A test fixture (`xss-use-data.svg`) ships uncovered by any spec — the `T-V5-04 use[href=data:]` threat is materially untested even though the file exists.
- `pool.cancel()` inside `enqueuePreview` will terminate the post-batch `computePluginSavings` N+1 benchmark mid-run if the user toggles a plugin while it is still in flight, partially populating `pluginSavings`.
- `removeFile` does not clean up `snippetTogglesByFileId[fileId]` (leaks across file churn).
- Several promise chains drop errors without surfacing them (`SnippetPanel.text()`, `enqueuePreview`'s outer arrow).
- `encodeSvgForDataUri` blanket-replaces `"` with `'` and can produce a malformed CSS data-URI when the SVG contains apostrophes inside double-quoted attribute values.
- The `<script` substring assertion in the `T-V5-05 foreignObject` test is too weak — `<xhtml:script>` would slip through.

## Critical Issues

### CR-01: T-V5-04 `use href=data:` threat fixture is uncovered by any test

**File:** `src/tests/fixtures/xss-use-data.svg:1-3` and `src/tests/svg-xss.spec.ts:106-286`
**Issue:** `xss-use-data.svg` exists in the fixtures directory and contains a real `<use href="data:image/svg+xml,...">` payload that decodes to `<svg><script>__XSS_FIRED__</script></svg>`. This is a documented threat in the Phase 3 register (T-V5-04 family — `use[href]` data-URI external reference). Every other XSS fixture has a corresponding `test('T-V5-...', ...)` block in `svg-xss.spec.ts`, but **no test references `xss-use-data.svg`**. A grep of the spec file for `xss-use-data` returns no matches; the only `T-V5-04` test (`xss-data-href.svg`) covers `<a href=data:...>`, not `<use href=data:...>`. The two vectors have different sanitization paths in DOMPurify (anchor link handling vs `<use>` xlink resolution), so one passing does not validate the other.
**Fix:** Add a dedicated test case mirroring the existing T-V5-04 anchor test:
```ts
test('T-V5-04: use href=data: external reference neutralized', async ({ page }) => {
  const { cleanSvg } = await runXssTest(page, 'xss-use-data.svg', 'xss-use-data')
  // <use href="data:..."> must not survive; even if <use> is kept, the
  // dangerous data: URI must be stripped from its href/xlink:href.
  expect(cleanSvg).not.toMatch(/href=["']?data:image\/svg\+xml/)
  expect(cleanSvg).not.toContain('__XSS_FIRED__')
})
```
If the test fails, configure DOMPurify to drop `<use>` elements whose `href`/`xlink:href` resolves to a `data:` URI (or extend `FORBID_ATTR`/`FORBID_TAGS`) — but first establish whether the fixture is even neutralized today.

## Warnings

### WR-01: `enqueuePreview` cancels in-flight `computePluginSavings` jobs

**File:** `src/stores/runtime.ts:203-254` (interaction with `src/App.tsx:68-150`)
**Issue:** `computePluginSavings` runs only after `running` flips false (App.tsx:319-358 — guarded by `prev.running && !curr.running`). `enqueuePreview` then calls `pool.cancel()` whenever `!state.running`. If the user toggles a plugin while the 5s post-batch savings benchmark is still iterating its N+1 jobs, `pool.cancel()` will terminate every in-flight savings worker, the inner `await pool.enqueue(job)` rejects with `AbortError`, the outer `Promise.all` fails fast, and `pluginSavings` ends up partially populated (or empty, if cancellation lands before the first plugin completes). The user observes `—` in the savings column for plugins that had not yet been benchmarked, and the timeout warning never fires because the catch path returns before logging.
**Fix:** Tag preview jobs with a discriminator and have `pool.cancel()` filter to that namespace (or expose a `pool.cancelByPrefix('preview-')`):
```ts
// runtime.ts enqueuePreview — instead of pool.cancel(), cancel only previews.
if (!state.running && state.previewJobId !== null) {
  pool.cancelJob?.(state.previewJobId)  // narrow cancel surface
}
```
Alternatively, gate `pool.cancel()` on `!state.previewJobId.startsWith('savings-')` knowledge — but a typed cancel surface is the durable fix.

### WR-02: `removeFile` does not clean up `snippetTogglesByFileId`

**File:** `src/stores/files.ts:52-63` and `src/stores/settings.ts:39,66-75`
**Issue:** `useFilesStore.removeFile(fileId)` deletes the entry from `byId`, drops it from `order`, and revokes its object URL — but it leaves `useSettingsStore.snippetTogglesByFileId[fileId]` populated. Across batches with high file churn (drag-drop new set → optimize → remove → repeat) the toggles map grows unbounded, holding strings and booleans for files the user has long discarded. Same store-level leak as the documented Pitfall 3 for object URLs, just slower.
**Fix:** Mirror the URL-revocation cross-store call:
```ts
removeFile: (fileId) => {
  useRuntimeStore.getState().revokeObjectURL(fileId)
  // Drop snippet toggles for the removed file (Phase 3 D-13 cleanup).
  useSettingsStore.setState((s) => {
    const { [fileId]: _drop, ...rest } = s.snippetTogglesByFileId
    return { snippetTogglesByFileId: rest }
  })
  set((s) => { /* …existing body… */ })
},
```
Apply the same drop inside `clear()`.

### WR-03: `SnippetPanel` blob `.text()` promise has no `.catch()`

**File:** `src/components/panels/SnippetPanel.tsx:49-61`
**Issue:** `file.optimizedBlob.text().then((text) => { if (!cancelled) setSvgText(text) })` swallows rejection. `Blob.text()` can reject (most commonly when the underlying source is detached, e.g. from a transferred ArrayBuffer in some browser builds, or from an `AbortError` if the platform supports cancellation). An unhandled rejection here surfaces as a noisy console error in production and leaves `svgText` permanently `null` while the panel UI shows "Run Optimize to generate snippet" forever.
**Fix:**
```ts
file.optimizedBlob.text().then(
  (text) => { if (!cancelled) setSvgText(text) },
  (err) => { if (!cancelled) { console.error('[SnippetPanel] blob.text failed:', err); setSvgText(null) } },
)
```

### WR-04: `SnippetPanel` `setTimeout` for copy reset can fire after unmount

**File:** `src/components/panels/SnippetPanel.tsx:73-78`
**Issue:** `setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100)` is scheduled inside an event handler with no cleanup token. If the user clicks "copy", then quickly switches files (which unmounts/remounts SnippetPanel under a different `file?.id`), the 1100ms timer still fires. React 19 will surface a warning ("can't perform a state update on an unmounted component") and, more importantly, the functional updater does nothing useful — but the timer also retains a closure over the unmounted React internals.
**Fix:** Track the timer id in a ref and clear it on unmount / on file change:
```ts
const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
useEffect(() => () => {
  if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
}, [])
// In copy():
if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
copyTimerRef.current = setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100)
```

### WR-05: T-V5-05 foreignObject test substring check is too weak to catch `<xhtml:script>`

**File:** `src/tests/svg-xss.spec.ts:147-150` and `src/tests/fixtures/xss-foreignobject.svg:3`
**Issue:** The fixture embeds `<xhtml:script>...</xhtml:script>` and the test asserts `expect(cleanSvg).not.toContain('<script')`. `'<xhtml:script>'.includes('<script')` is **false** — the substring `<script` requires the `<` to be immediately followed by `s`, but in `<xhtml:script>` the `<` is followed by `x`. So a regression that left `<xhtml:script>` in the output would pass this assertion. The `__XSS_FIRED__` undefined check is also a weak signal because the SVG never gets rendered into the DOM during the test (snippets render inside `<pre>`). The actual mitigation is DOMPurify removing the namespaced script in practice, but the test isn't proving that.
**Fix:**
```ts
expect(cleanSvg).not.toMatch(/<\w*:?script[\s>]/i)
expect(cleanSvg).not.toContain('__XSS_FIRED__')  // payload string check
```
The payload-string check is the most durable defense — if the literal `__XSS_FIRED__` is gone, no execution path remains regardless of how the wrapper tag was named.

### WR-06: `encodeSvgForDataUri` blanket `"` → `'` replacement breaks SVGs containing apostrophes inside attribute values

**File:** `src/lib/svg-snippets.ts:30-35`
**Issue:** `data.replace(/"/g, "'")` runs unconditionally before percent-encoding. If the SVG has any double-quoted attribute whose value contains an apostrophe (e.g. `<text title="It's a test">`), the replacement produces `<text title='It's a test'>` which is malformed XML — the embedded `'` now closes the attribute prematurely. Browsers will still render most cases by being lenient, but the resulting CSS data URI is fragile and can fail in strict parsers (eg. some headless rendering pipelines or build-time CSS minifiers). yoksel's original encoder has the same defect but the project doesn't have to inherit it; the snippet generator can detect the conflict and fall back to encoding the inner `"` as `%22`.
**Fix:** Either round-trip through DOMParser to canonicalize quoting, or do a guarded replace that only swaps `"` when no `'` is present in attribute scope. A pragmatic minimum:
```ts
// If any `'` exists inside what looks like an attribute value, percent-encode `"` instead.
if (/=["'][^"']*'[^"']*["']/.test(svgString)) {
  data = svgString.replace(/"/g, '%22')  // safer fallback
} else {
  data = svgString.replace(/"/g, "'")
}
```
Add a unit test fixture that contains `&apos;` / literal `'` in an attribute and assert the resulting data URI parses back through `new URL()` cleanly.

### WR-07: `enqueuePreview` outer IIFE has no error sink

**File:** `src/stores/runtime.ts:203-254`
**Issue:** `void (async () => { ... })()` returns a promise that's only handled by the `try/catch` inside the IIFE — but anything that throws **outside** that `try` (lines 204-216, e.g. `crypto.randomUUID()` rejection theoretically, or the synchronous `set({ previewJobId: jobId })` failing on a future store-immutability tightening) becomes an unhandled rejection. The `void` operator silences the lint but does not register a `.catch`.
**Fix:** Wrap the entire IIFE body in a try/catch or attach a tail `.catch`:
```ts
;(async () => { /* body */ })().catch((err) => console.error('[enqueuePreview]', err))
```

### WR-08: `computePluginSavings` continues enqueuing after timeout fires

**File:** `src/App.tsx:91-132`
**Issue:** The timeout flips `timedOut = true` and rejects the race, but the inner `for` loop only checks `if (timedOut) break` between plugins. Within a plugin the `await Promise.all(svgFiles.map(...))` continues — every file's `pool.enqueue(job)` is fired synchronously inside `.map()` BEFORE the await. So if the timeout lands during plugin N, all of plugin N's SVG-file jobs (one per file) are still in flight and will block until they resolve or get cancelled. The pool has no idea the consumer no longer cares; jobs occupy worker slots and delay any subsequent legitimate work.
**Fix:** Either (a) check `timedOut` inside the `svgFiles.map` callback before calling `pool.enqueue`, or (b) wire an `AbortController` through `PoolJob.signal` and abort it from the timeout handler so in-flight savings jobs are dropped at the worker boundary.

### WR-09: `T-V5-07` snippet test asserts on substrings that the data-URI encoder ALWAYS strips

**File:** `src/tests/svg-xss.spec.ts:236-285`
**Issue:** The data-URI snippet runs `encodeSvgForDataUri` which percent-encodes `<` → `%3C` and replaces `"` → `'`. The test then asserts each `pre.code` block does not contain `<script` / `onload=` / `javascript:`. Because of the encoder, the data-URI block CANNOT contain `<script` even if the input did — `<` is always percent-encoded. So this assertion is trivially true for the data-URI section regardless of sanitization. The real signal is in the inline-svg `<pre>`, which IS a meaningful test, but rolling them together obscures whether the data-URI path actually carries clean bytes vs. just relies on transport encoding.
**Fix:** Split the assertion: for the inline-SVG block require the substring check; for the data-URI block decode the encoded payload first and then check:
```ts
const decoded = decodeURIComponent(dataUriEncoded.replace(/'/g, '"'))
expect(decoded).not.toContain('<script')
```

## Info

### IN-01: Hard-coded magic number `1100ms` for copy-feedback duration

**File:** `src/components/panels/SnippetPanel.tsx:74`
**Issue:** `setTimeout(..., 1100)` — same magic number repeated in tests (line 254 of svg-pipeline.spec.ts: `await page.waitForTimeout(1300)`). Centralizing this constant makes the copy-feedback duration auditable and testable from a single source.
**Fix:** Extract to a module-level `const COPY_FEEDBACK_MS = 1100` and reuse from the test via a Playwright fixture or environment marker.

### IN-02: `dim: '—'` placeholder hardcoded in store-derived view-model

**File:** `src/App.tsx:445`
**Issue:** The `SHELL_FILES` view-model fills `dim: '—'` for every store-derived row. Phase 5+ raster decoders will know dimensions, but the comment on line 423-424 already flags the hand-off; meanwhile the Compare panel and file-row both render `'—'` as a literal en-dash for every queue entry. Documented but easy to forget when the bug surfaces in a screenshot.
**Fix:** Either centralize the placeholder behind a `formatDim(entry)` helper now, or wire `originalSize`-derived metadata if available so future migration is mechanical.

### IN-03: `unsafeExport ?? false` defaulting repeated at every read site

**File:** `src/App.tsx:564`, `src/stores/runtime.ts:235`, `src/components/panels/SvgoPanel.tsx:155-168`
**Issue:** Three sites coalesce `unsafeExport` from `?? false`. Because `CodecSettingsSvg.unsafeExport?: boolean` permits undefined, every read needs the coalesce. Either initialize `DEFAULT_CODEC_SVG.unsafeExport = false` (so the field is always defined and the `?? false` becomes redundant) or change the type to non-optional.
**Fix:** In `src/data/defaults.ts`:
```ts
export const DEFAULT_CODEC_SVG: CodecSettingsSvg = {
  preset: 'default',
  plugins: { /* … */ },
  unsafeExport: false,  // explicit default — drops `?? false` at all read sites
}
```

### IN-04: `setSnippetToggle` spreads `undefined` (works, but obscures intent)

**File:** `src/stores/settings.ts:66-75`
**Issue:** `{ ...s.snippetTogglesByFileId[fileId], [snippetId]: value }` — when no entry exists for `fileId`, the spread is `{ ...undefined }`, which JavaScript silently treats as `{}`. This is correct but reads as if a TypeError might fire; future readers may mis-fix it. Make the empty-object fallback explicit.
**Fix:**
```ts
[fileId]: {
  ...(s.snippetTogglesByFileId[fileId] ?? {}),
  [snippetId]: value,
},
```

---

_Reviewed: 2026-05-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
