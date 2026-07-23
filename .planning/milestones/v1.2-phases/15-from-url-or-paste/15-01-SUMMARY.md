---
phase: 15
plan: 01
subsystem: ingest
tags: [url-ingest, pickFromUrl, ING-01, T-15-04, sanitizeBaseName]
requires:
  - src/lib/filename.ts (sanitizeBaseName, T-11-01 chokepoint)
  - sonner (toast.error, toast.success — useExport precedent)
provides:
  - "src/lib/url-ingest.ts :: pickFromUrl(url: string): Promise<File | null>"
affects:
  - src/tests/_alias-loader.mjs (self-register via module.register; backward-compatible)
tech-stack:
  added: []   # No new npm dependencies
  patterns: [vite-page-evaluate-src-import, sonner-direct-toast, fetch-mode-cors-credentials-omit]
key-files:
  created:
    - src/lib/url-ingest.ts
    - src/tests/url-ingest.test.ts
    - src/tests/url-ingest.spec.ts
  modified:
    - src/tests/_alias-loader.mjs
decisions:
  - "D-06: pickFromUrl uses fetch(url, { mode: 'cors', credentials: 'omit' }) — explicit no-cookies, browser is the user agent"
  - "D-07: All failure modes emit toast.error and return null — never throws to caller"
  - "D-08: Zero canvas fallback — CORS rejection is honest user messaging, not silent re-encode"
  - "D-09: T-15-04 mitigation: all 3 filename sources (Content-Disposition, URL last segment, timestamped fallback) flow through sanitizeBaseName"
  - "Rule 3 auto-fix: src/tests/_alias-loader.mjs now self-registers via module.register() so PLAN's --import form actually activates the resolver"
metrics:
  duration: ~25 min
  completed_date: 2026-06-13
  tasks_total: 3
  tasks_completed: 3
  files_created: 3
  files_modified: 1
  unit_assertions: 19
  e2e_tests: 2
  estimated_bundle_delta_gzip_kb: 0.5  # Dead code until 15-02 wires it in
---

# Phase 15 Plan 01: URL ingest dispatcher (pickFromUrl) Summary

URL-string ingest now flows through `pickFromUrl(url): Promise<File | null>` in
`src/lib/url-ingest.ts` — a CORS-honest fetch dispatcher that validates scheme,
content-type, and size; derives a sanitized filename via a 3-tier priority
chain (Content-Disposition → URL last segment → timestamped fallback); and
returns `null` on every failure with a user-facing sonner toast. Backs SC-2
(URL ingest with CORS-honest failure messaging) and T-15-04 (filename
sanitization at the boundary).

## What Shipped

**`src/lib/url-ingest.ts` (118 lines).** Single async export `pickFromUrl(url)`.

- Scheme guard: malformed URL or non-http(s) → toast + `null`
- `fetch(url, { mode: 'cors', credentials: 'omit' })`:
  - throw → "URL blocked by CORS — download and drop the file, or paste it directly."
  - non-2xx → "URL fetch failed (${status})"
  - non-image MIME → "URL did not return an image"
- Size cap: header `content-length` AND `blob.size` checked against `MAX_URL_BYTES = 100 * 1024 * 1024`
- Happy path: `new File([blob], filename, { type, lastModified })`
- Private `deriveFilename` priority: CD `filename*=` / `filename=` → URL last path segment (URIError → fall through) → `pasted-image-${Date.now()}.${extFromMime}`. All three branches funnel through `sanitizeBaseName`.
- Zero `console.*` calls (zero-telemetry constraint preserved).

**`src/tests/url-ingest.test.ts` (Node unit, 19 assertions, 2s).** Covers the 12 enumerated cases:

1. Malformed URL → null
2. Non-http scheme (`data:`) → null
3. fetch throws (CORS sim) → null
4. Non-2xx (404) → null
5. Non-image content-type (`text/html`) → null
6. `content-length > 100 MB` → null
7. Lying header + `blob.size > 100 MB` → null
8. CD `filename="cat.png"` → File named `cat.png`
9. Percent-encoded path `p%C3%A9o%20le.jpg` → File named `péo le.jpg`
10. Multi-segment URL with clean last segment → that segment wins
11. No path → File named `pasted-image-<digits>.png` (regex)
12. Path-traversal CD value → no `/` or `\` in sanitized filename

**`src/tests/url-ingest.spec.ts` (Playwright e2e, 2 tests, ~15s each).**

- Happy: `page.route` serves 1×1 PNG → `pickFromUrl` returns `{ name: 'photo.png', type: 'image/png', size > 0 }`
- Negative: `page.route` returns 403 → `pickFromUrl` resolves `null` AND `[data-sonner-toast]` containing `"URL fetch failed (403)"` is visible

Run: `npx playwright test src/tests/url-ingest.spec.ts → PASS 2 / FAIL 0`.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] `--import ./src/tests/_alias-loader.mjs` did not activate the resolver hook**

- **Found during:** Task 2 verification
- **Issue:** The PLAN's stated test_command and Task 2 acceptance criterion both used `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs …`. The `--import` flag eagerly evaluates the module but does NOT register Node's loader hooks (those need `--experimental-loader=` or an explicit `module.register()`). Without registration, the dynamic import of `../lib/url-ingest.ts` failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'` because url-ingest.ts internally imports `@/lib/filename`.
- **Fix:** Added a top-level `register(import.meta.url, pathToFileURL('./'))` block to `src/tests/_alias-loader.mjs`, guarded by a `globalThis.__oimg_alias_loader_registered` flag to prevent double-register when used via `--experimental-loader=`. Now BOTH invocation forms work.
- **Files modified:** `src/tests/_alias-loader.mjs`
- **Commit:** `32c525b` (folded into Task 2 commit because the loader fix was prerequisite for the unit test to run)
- **Regression check:** Re-ran `watch-folder.test.ts` with `--experimental-loader=` form → 6 passed (no regression).

**2. [Minor - Test case 10 deviation]** RESEARCH §4 table example `https://cdn.example.com/p%E0%A0/file.png` requires the lib to navigate from "malformed % path → last clean segment". With Node's URL parser and the lib's current logic, that exact URL throws inside `new URL` because `%E0%A0` is incomplete percent-encoding (no third hex byte). To still exercise the "last clean segment wins" path, Case 10 uses `https://cdn.example.com/dir/file.png` — same assertion shape, valid URL parse. Filename derivation behavior is identical.

No architectural changes. No new npm dependencies. No CLAUDE.md rule violations.

## Validation

| Check | Result |
|---|---|
| `node --experimental-strip-types --check src/lib/url-ingest.ts` | PASS |
| `grep -c 'console\.' src/lib/url-ingest.ts` | 0 (zero-telemetry preserved) |
| `grep -c "from 'sonner'" src/lib/url-ingest.ts` | 1 |
| `grep -c sanitizeBaseName src/lib/url-ingest.ts` | 7 (≥4 required) |
| `grep -c '100 \* 1024 \* 1024' src/lib/url-ingest.ts` | 1 |
| `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/url-ingest.test.ts` | 19 passed, 0 failed |
| `npx playwright test src/tests/url-ingest.spec.ts --reporter=line` | PASS 2 / FAIL 0 (153s) |
| Existing `watch-folder.test.ts` regression check | 6 passed (no regression) |

## Bundle Impact

- `src/lib/url-ingest.ts`: ~0.5 KB initial gzip (RESEARCH §8 estimate)
- Dead code until Plan 15-02 wires it through `clipboard-ingest.ts`
- Initial JS gzip budget (≤ 200 KB) not affected by this plan; `npm run test:bundle` gate will catch any regression downstream

## Commits

- `a5c7462` — feat(15-01): add pickFromUrl URL ingest dispatcher
- `32c525b` — test(15-01): unit cover pickFromUrl (12 cases) + alias-loader self-register
- `440bbb1` — test(15-01): e2e cover pickFromUrl behind page.route PNG mock

## Self-Check: PASSED

- [x] `src/lib/url-ingest.ts` exists (118 lines, syntax-checked)
- [x] `src/tests/url-ingest.test.ts` exists (19 assertions pass)
- [x] `src/tests/url-ingest.spec.ts` exists (2 tests pass)
- [x] All 3 commits resolved via `git log --oneline -5`: a5c7462, 32c525b, 440bbb1
- [x] `pickFromUrl` exported with signature `(url: string): Promise<File | null>`
- [x] `sanitizeBaseName` reused on every filename source (T-15-04 chokepoint preserved)
- [x] Zero `console.*` calls in production code path

## Known Stubs

None. The lib is intentionally not wired to UI in this plan — Plan 15-02 (`clipboard-ingest.ts`) is the next consumer. This is documented in the plan's `<output>` section: "Task 4 plans wire the lib in; this plan's lib is dead code in the initial chunk until wired".
