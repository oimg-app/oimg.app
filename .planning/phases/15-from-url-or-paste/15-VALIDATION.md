---
phase: 15
slug: from-url-or-paste
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: v1.2 REQUIREMENTS (ING-01, ING-02) + research/v1.2-ingest.md + CONTEXT D-01..D-15.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --experimental-strip-types (unit) + Playwright 1.x (e2e) — already configured |
| **Quick run command** | `node --experimental-strip-types src/tests/url-ingest.test.ts` (~2s) |
| **Full suite command** | `npm run build && npx playwright test src/tests/url-ingest.spec.ts src/tests/paste-ingest.spec.ts` |
| **Estimated runtime** | ~60s |

---

## Sampling Rate

- **After every task commit:** Run the changed-area test
- **After every plan wave:** Full suite
- **Before phase verification:** `npm run build` green + new tests + no regressions on existing 30+ Phase 11..14 e2e
- **Max feedback latency:** 60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-url-ingest | 01 | 1 | ING-01 | T-15-01, T-15-04 | pickFromUrl: fetch with cors mode; blob.type check; sanitizeBaseName on filename; null on failure; no console | unit + e2e | `node --experimental-strip-types src/tests/url-ingest.test.ts` + `npx playwright test src/tests/url-ingest.spec.ts` | ❌ W0 | ⬜ pending |
| 15-02-clipboard-ingest | 02 | 1 | ING-01 | T-15-02 | pickFromClipboard: image-first walk; URL-string route; honest no-image toast | unit | `node --experimental-strip-types src/tests/clipboard-ingest.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-paste-hook | 03 | 2 | ING-02 | T-15-03 | document paste handler; input-elements early-return; image-first; preventDefault only when consumed | e2e | `npx playwright test src/tests/paste-ingest.spec.ts` | ❌ W0 | ⬜ pending |
| 15-04-toolbar-wire | 04 | 2 | ING-01 | — | Toolbar From URL or paste → pickFromClipboard; addFromUrl stub deleted; menu closes | e2e | `npx playwright test src/tests/toolbar-paste.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new deps needed — all browser APIs built-in (paste event, ClipboardEvent, fetch, URL)
- [ ] If unit-test mocks for `navigator.clipboard.read()` need updating, share with Phase 12's clipboard chokepoint mock helpers from `tests/setup/clipboard-mocks.ts` (paste-direction; write-direction shipped Phase 12)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real CORS-blocked URL → toast surfaces; user can drop the file as recovery | ING-01 D-07 | Real third-party servers vary on CORS; CI mocks can't replicate every edge | Paste a Google Images result URL into "From URL or paste". Confirm toast says "URL blocked by CORS — download and drop the file, or paste it directly." Then download + drop → confirm ingest works as recovery. |
| Paste from Safari clipboard | ING-02 | Safari's ClipboardEvent + DataTransferItem behavior differs from Chrome | Copy an image from Safari Photos or a screenshot, then Cmd+V into the app. Confirm ingest fires + toast surfaces. |
| Cmd/Ctrl+V inside the FilesPane filter input does NOT ingest | ING-02 D-11 | Input-elements guard regression check | Click the search/filter input. Cmd+V plain text → the text appears in the input; NO toast, NO ingest. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set after planner aligns task IDs

**Approval:** pending
