---
phase: 12
slug: real-snippets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> No RESEARCH.md this phase (user chose to skip); seeded from CONTEXT.md D-01..D-15.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x / node --experimental-strip-types (unit) + Playwright 1.x (e2e) — already configured (Phase 11 Wave 0) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `node --experimental-strip-types src/tests/snippets.test.ts` (unit, ~2s) |
| **Full suite command** | `pnpm exec vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~90s (unit ~5s, e2e ~80s) |

---

## Sampling Rate

- **After every task commit:** Run unit tests for the changed lib (snippets, clipboard, filename)
- **After every plan wave:** Run the full vitest + playwright suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Stub rows seed dimensions; the planner replaces placeholders with real `12-NN-MM` IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-clipboard | 01 | 1 | SNIP-01 | T-12-01 (XSS in pasted snippet) | clipboard chokepoint feature-detects window.isSecureContext + 'clipboard' in navigator; falls back to textarea+execCommand; toast on both paths | unit | `node --experimental-strip-types src/tests/clipboard.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-snippets | 02 | 1 | SNIP-01 | T-12-01, T-12-02 (HTML-attr injection via file.name) | buildDataUri dispatches: SVG → URL-encoded; raster → base64 chunked; buildBase64Snippet wraps in <img src>; buildUrlEncodedSnippet wraps in url(); buildPictureSnippet shape per D-03/D-04 with attribute-escaped name + alt | unit | `node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs src/tests/snippets.test.ts` | ✅ | ✅ green |
| 12-03-output | 03 | 2 | SNIP-01 | — | OutputPanel useEffect depends on [file?.id, file?.encodedBuffer, file?.target]; per-status states (done/processing/queued/error) per D-06 | e2e | `pnpm exec playwright test src/tests/output-panel-live.spec.ts` | ✅ | ✅ green |
| 12-04-toolbar | 04 | 2 | SNIP-01 | — | All 3 Toolbar bulk items wired (Copy <picture> / Copy data URIs / Manifest JSON); operate on $hasDone set with disable-then-explain (Phase 11 D-13 pattern reuse) | e2e | `pnpm exec playwright test src/tests/toolbar-snippets.spec.ts` | ✅ | ✅ green |
| 12-05-filerow | 05 | 2 | SNIP-01 | — | FileRow ContextMenu gains Copy <picture> + Copy data-URI siblings to Save as…; disabled when status !== 'done'; WCAG-AA keyboard inherited from Radix | e2e | `pnpm exec playwright test src/tests/file-row-snippets.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Phase 11 already shipped: jszip, file-saver, @types/file-saver, sonner Toaster mount, $hasDone, ContextMenu wiring, save-file mocks.
> Phase 12 needs no new deps. Wave 0 may be folded into Wave 1 if the planner determines no scaffolding setup is required.

- [ ] `tests/setup/clipboard-mocks.ts` — shared helpers to mock `navigator.clipboard.writeText` + capture textarea+execCommand fallback calls (consumed by 12-01..12-05 specs)
- [ ] If `tests/setup/save-file-mocks.ts` clobbers global `document.execCommand` in any spec, isolate via `beforeEach`/`afterEach` per spec to keep the clipboard fallback testable without flake

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pasted `<picture>` snippet renders the optimized image in a real page | SNIP-01 SC-2 | Pasting into a browser is the canonical proof — page render is browser-chrome | Open `/test-paste.html` (or any blank HTML), paste the copied `<picture>` block into body, save, open. Image must render at intended dimensions in Chrome + Firefox + Safari. |
| Pasted Base64 data-URI renders in `<img src="…">` and `background-image: url("…")` | SNIP-01 SC-1 | Browser parser quirks for very long URIs (>2MB) — out of test runner scope | Copy base64 snippet from Output panel for the largest fixture (~2MB encoded). Paste into a test HTML. Verify render in Chrome, Firefox, Safari. No console errors, no truncation. |
| Pasted URL-encoded SVG snippet renders correctly | SNIP-01 SC-1 | SVG percent-encoding edge cases (control chars, named entities) require visual confirmation | Drop an SVG, optimize, copy URL-encoded snippet, paste into `background-image: url(...)` in a test CSS. Verify render in all three browsers. |
| Clipboard fallback (textarea+execCommand) works in non-secure context (http://) | SNIP-01 | navigator.clipboard rejects on http:// — needs a real http server to verify | Serve the dev build via `python3 -m http.server` (http://, not https), trigger any copy action. Toast must say copied; paste-into-notes must yield the snippet text. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (clipboard-mocks helper)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter after planner aligns all task rows to real IDs

**Approval:** pending
