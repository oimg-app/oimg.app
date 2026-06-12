---
phase: 15-from-url-or-paste
slug: from-url-or-paste
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 5/5 success_criteria + 2/2 requirements verified
created: 2026-06-13
requirements: [ING-01, ING-02]
overrides_applied: 0
human_verification:
  - test: "Real third-party CORS-blocked URL → toast surfaces; user can drop file as recovery"
    expected: "Paste e.g. a Google Images result URL into Toolbar 'From URL or paste'. Toast says 'URL blocked by CORS — download and drop the file, or paste it directly.' Then download + drop → ingest succeeds."
    why_human: "Real third-party servers vary on CORS; CI mocks (page.route) cannot replicate live edge behavior. Carry-forward from 15-VALIDATION.md."
  - test: "Paste image from Safari clipboard via Cmd+V"
    expected: "Copy image from Safari Photos or screenshot, Cmd+V into the app outside any input. Ingest fires + 'Pasted image imported' toast surfaces."
    why_human: "Safari's ClipboardEvent + DataTransferItem behavior differs from Chromium; automated test runs only on chromium project (playwright.config.ts)."
  - test: "Cmd+V inside Toolbar filter input does NOT ingest"
    expected: "Click search/filter input. Cmd+V plain text → text appears in input; NO toast, NO entry added."
    why_human: "D-11 input-elements guard regression check. Covered by paste-ingest.spec.ts Case C automatically, but human verification preferred per 15-VALIDATION.md manual checks."
---

# Phase 15: From URL or paste — Verification Report

**Phase Goal:** Wire the Toolbar "From URL or paste" menu item to a real clipboard-paste + URL-fetch dispatcher, with document-level paste-event support and honest CORS-failure messaging.
**Verified:** 2026-06-13
**Status:** human_needed (5/5 SCs + 2/2 requirements verified in code; 3 manual-only checks carry-forward from VALIDATION.md)
**Re-verification:** No — initial verification

---

## Success Criteria

| # | Success Criterion | Evidence | Verdict |
|---|---|---|---|
| 1 | Toolbar "From URL or paste" reads `navigator.clipboard.read()` (with paste-event fallback in non-secure contexts); image bytes → `useIngest.ingest()`; success toast | `Toolbar.tsx:154-158` onClick → `void pickFromClipboard({ ingest })`. `clipboard-ingest.ts:53-79` reads `navigator.clipboard.read()`, walks ClipboardItems, picks first `image/*`, builds `File`, calls `dispatcher.ingest([file])`, toasts `'Pasted image imported'`. Non-secure-context fallback: `useClipboardIngest.ts` mounts document `paste` listener invoking `processClipboardEvent`. Tests: `toolbar-paste.spec.ts` Case A (e2e happy), `clipboard-ingest.test.ts` image-bytes branch. **Note:** actual toast text is `'Pasted image imported'` (15-02 chose this over the SC-1 draft `'Pasted from clipboard: {name}'` — confirmed acceptable in objective). | PASS |
| 2 | Plain-text image URL in clipboard → `fetch(url)`; on success ingest + `"Imported from URL: {host}"`; on CORS failure `"URL blocked by CORS — download and drop the file, or paste it directly."` | `clipboard-ingest.ts:82-99` reads text, tests `IMAGE_URL_RE` (line 30), calls `pickFromUrl`, toasts `'Imported from URL: ${host}'` on success. `url-ingest.ts:40-46` `fetch(url, { mode: 'cors', credentials: 'omit' })` catch → `toast.error('URL blocked by CORS — download and drop the file, or paste it directly.')` (line 44, verbatim). Tests: `url-ingest.test.ts` Case 3 (fetch-throw → null), `url-ingest.spec.ts` happy + 403 case, `clipboard-ingest.test.ts` text-URL branch. | PASS |
| 3 | Non-image clipboard contents → `"Clipboard has no image or image URL"` toast (no error log) | `clipboard-ingest.ts:102` `toast.message('Clipboard has no image or image URL')` — uses `toast.message` (not `error`), no `console.*`. Zero-telemetry preserved in `url-ingest.ts:42-43` comment. Tests: `clipboard-ingest.test.ts` 'text without URL' + 'read throws → falls through to text → no image' cases; `toolbar-paste.spec.ts` Case B asserts visible. | PASS |
| 4 | Document-level Cmd/Ctrl+V handler on `<App />` ingests pasted image through same dispatcher | `App.tsx:15` `useClipboardIngest()` invoked at root. `useClipboardIngest.ts:23-39` mounts `document.addEventListener('paste', onPaste)` via `useEffect`, calls `processClipboardEvent(e, { ingest })` (same dispatcher as Toolbar). D-11 input-elements guard at line 30 (`tag === 'input' \|\| 'textarea' \|\| isContentEditable`). D-12 conditional `preventDefault` at line 34. Tests: `paste-ingest.spec.ts` Cases A (image), B (URL via page.route), C (input-guard). | PASS |
| 5 | Empty `addFromUrl` stub in `src/stores/files.ts` is deleted | `grep -rn 'addFromUrl' src/` → zero matches outside the regression-lock spec (`toolbar-paste.spec.ts:16/149/161/162`). `files.ts:100` carries the retirement comment `"URL-paste stub retired. Toolbar now calls..."` (no literal token). `Toolbar.tsx` does NOT import `addFromUrl`. Test: `toolbar-paste.spec.ts` Case C (fs.readFileSync asserts both files `.not.toContain('addFromUrl')` + positive lock for new dispatcher import). | PASS |

**Score:** 5/5 Success Criteria verified.

---

## Requirements Coverage

| Requirement | Description (truncated) | Evidence | Verdict |
|---|---|---|---|
| ING-01 | Toolbar wires `addFromUrl` stub. On click reads `navigator.clipboard.read()` or paste-event fallback; image bytes → ingest; image URL → fetch + ingest; otherwise "no image or URL" toast; CORS failure clear messaging | Satisfied by SC-1 (Toolbar onClick → `pickFromClipboard`), SC-2 (URL fetch + host toast + CORS toast), SC-3 (no-image toast), SC-5 (stub deleted). Files: `src/lib/url-ingest.ts`, `src/lib/clipboard-ingest.ts`, `src/components/shell/Toolbar.tsx`, `src/stores/files.ts`. | SATISFIED |
| ING-02 | Document-level paste handler on app root: paste image anywhere (Cmd/Ctrl+V) ingests via same dispatcher; same toasts | Satisfied by SC-4. Files: `src/hooks/useClipboardIngest.ts`, `src/App.tsx`. D-11 input-elements guard + D-12 preventDefault discipline implemented and tested. | SATISFIED |

---

## Threat Coverage

| Threat | Description | Mitigation | Verdict |
|---|---|---|---|
| T-15-01 (LOW) | `pickFromUrl` fetches arbitrary user-supplied URLs (exfiltration/SSRF-like concern) | `url-ingest.ts:40` `fetch(url, { mode: 'cors', credentials: 'omit' })` — cookies never leak; intent documented in lib comment lines 38-39 | MITIGATED |
| T-15-02 (LOW) | Clipboard contents may be malicious (e.g. SVG with `<script>`) | Reuses existing `useIngest` pipeline → DOMPurify (Phase 3); no new attack surface introduced. Confirmed: `clipboard-ingest.ts` only constructs `File` objects and delegates to `dispatcher.ingest()` | MITIGATED |
| T-15-03 (LOW) | `paste` handler runs on every paste outside text inputs (perf) | Single `tagName.toLowerCase()` + `isContentEditable` check at `useClipboardIngest.ts:30`; negligible cost; e2e Case C confirms guard fires | MITIGATED |
| T-15-04 (LOW) | URL filename could contain path-traversal (`../../etc/passwd`) | All three filename sources (Content-Disposition, URL path segment, timestamp fallback) flow through `sanitizeBaseName` (`url-ingest.ts:98, 100, 109, 117`). `url-ingest.test.ts` Case 12 asserts no `/` or `\\` survive | MITIGATED |

---

## Test Inventory

| File | Type | Count | Coverage |
|---|---|---|---|
| `src/tests/url-ingest.test.ts` | Node unit | 20 assertions across 12 cases | pickFromUrl: 7 failure modes + 5 filename derivations (incl. T-15-04 traversal) |
| `src/tests/clipboard-ingest.test.ts` | Node unit | 16 `test()` blocks | IMAGE_URL_RE regex (3) + pickFromClipboard cap-gate/image/text (5) + processClipboardEvent file/URL/silent-miss (8) |
| `src/tests/url-ingest.spec.ts` | Playwright e2e | 2 tests | happy PNG via `page.route` + 403 → toast |
| `src/tests/paste-ingest.spec.ts` | Playwright e2e | 3 tests | Case A image-paste, Case B text/plain URL paste, Case C input-guard |
| `src/tests/toolbar-paste.spec.ts` | Playwright e2e | 3 tests | Case A happy (addInitScript clipboard shim), Case B negative (no-image toast), Case C source-grep stub retirement |

**Bundle gate:** `src/tests/build.test.ts` restored (Rule 3 auto-fix in 15-04). `npm run test:bundle` reports 194.9 KB < 200 KB ceiling (verified manually post-execution per objective).

---

## Anti-Pattern Scan

| File | Finding | Severity |
|---|---|---|
| `src/lib/url-ingest.ts` | No `TODO/FIXME/XXX`; no `console.*`; no `return null` without prior toast emission; `Phase 15 — ING-01` provenance tag at line 1 | CLEAN |
| `src/lib/clipboard-ingest.ts` | No debt markers; no `console.*`; `Phase 15 — ING-01` provenance tag at line 1 | CLEAN |
| `src/hooks/useClipboardIngest.ts` | No debt markers; `Phase 15 — ING-02` provenance tag at line 1; D-11/D-12 inline comments | CLEAN |
| `src/components/shell/Toolbar.tsx` | `Phase 15 — ING-01:` comment at line 154; no debt markers introduced | CLEAN |
| `src/stores/files.ts` | Retirement comment at line 100 (no literal `addFromUrl` token); no debt markers | CLEAN |
| `src/App.tsx` | `useClipboardIngest()` invoked at line 15 with Phase 15 — ING-02 inline tag | CLEAN |

---

## Behavioral Spot-Checks

| Check | Method | Result |
|---|---|---|
| `addFromUrl` removed from production tree | `grep -rn 'addFromUrl' src/` | Only matches in `toolbar-paste.spec.ts` (regression lock); zero in production — PASS |
| Toolbar imports new dispatcher | `grep -n 'pickFromClipboard' Toolbar.tsx` | 2 hits (import + onClick) — PASS |
| `useClipboardIngest` invoked in App | `grep -n 'useClipboardIngest' App.tsx` | Lines 12 (import) + 15 (call) — PASS |
| CORS error message verbatim | grep `'URL blocked by CORS'` in `url-ingest.ts` | Line 44 matches verbatim — PASS |
| `IMAGE_URL_RE` covers required extensions | Read `clipboard-ingest.ts:30` | png, jpe?g, webp, avif, gif, svg, heic, heif — PASS |

---

## Deferred Items

None. All 5 Success Criteria and both requirements (ING-01, ING-02) are demonstrably wired in code with unit + e2e coverage.

---

## Overall Verdict

**status: human_needed** — All 5 phase Success Criteria are observably true in the codebase; both ING-01 and ING-02 requirements are satisfied; all 4 T-15-* threats are mitigated; bundle ceiling holds at 194.9 KB. Three carry-forward manual-only checks from `15-VALIDATION.md` (real CORS-blocked URL, Safari paste, FilesPane filter input guard) are routed to human verification per the verifier decision tree — they do not block phase closure.

**Sign-off:** Phase 15 code-level goal achievement: VERIFIED. Proceeding to human verification of the 3 manual checks above before milestone closure.

---

*Verified: 2026-06-13*
*Verifier: Claude (gsd-verifier)*
