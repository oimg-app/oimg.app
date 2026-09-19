---
phase: 11
slug: batch-optimize-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (unit) + Playwright 1.x (e2e) — confirm with `package.json` (Wave 0 also adds `jszip ^3.10`, `file-saver ^2.0`, `@types/file-saver`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run --reporter=dot` (or `npm test -- --run`) |
| **Full suite command** | `pnpm exec vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~90s (vitest ~25s, playwright ~65s including the ≥20-file SC-4 batch) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --reporter=dot` (changed files only where possible)
- **After every plan wave:** Run the full vitest + playwright suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Filled in by the planner once tasks exist. Stub rows below seed the dimensions the
> planner must cover; the actual task IDs (`11-NN-MM`) replace the placeholders.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-00-deps | 00 | 0 | OPT-02, EXP-01, EXP-02 | — | Locked lib versions installed (jszip 3.10.1, file-saver 2.0.5, @types/file-saver) | unit | `pnpm exec vitest run tests/deps.spec.ts` | ❌ W0 | ⬜ pending |
| 11-01-stream | 01 | 1 | OPT-02 | — | runOptimize writes back per-promise; cap honored | unit + e2e | `vitest run src/hooks/useOptimize.test.ts` + `playwright test tests/e2e/batch-progress.spec.ts` | ❌ W0 | ⬜ pending |
| 11-02-counter | 02 | 1 | OPT-02 | — | Aggregate X/Y derived from runtime+filesAtom; aria-live polite | unit | `vitest run src/components/shell/StatusBar.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-filename | 03 | 1 | EXP-01, EXP-02 | T-11-01 (zip-slip) | sanitizeBaseName strips path traversal; ext swap per D-05 | unit | `vitest run src/lib/output-filename.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-save | 04 | 2 | EXP-01 | — | showSaveFilePicker w/ secure-context check; saveAs fallback; AbortError = silent | unit + e2e | `vitest run src/lib/save-file.test.ts` + `playwright test tests/e2e/single-download.spec.ts` | ❌ W0 | ⬜ pending |
| 11-05-zip | 05 | 2 | EXP-02 | T-11-01 | JSZip.generateAsync streams; level 1; collision suffix | unit + e2e | `vitest run src/lib/build-zip.test.ts` + `playwright test tests/e2e/batch-zip.spec.ts` | ❌ W0 | ⬜ pending |
| 11-06-menu | 06 | 2 | EXP-01 | — | FileRow ctxbtn menu opens via keyboard + ESC closes (WCAG-AA) | unit | `vitest run src/components/panels/files/FileRow.test.tsx` | ❌ W0 | ⬜ pending |
| 11-07-disable | 07 | 2 | OPT-02, EXP-01, EXP-02 | — | Exports disabled until ≥1 done; aria-disabled + title tooltip (D-13) | unit | `vitest run src/components/shell/Toolbar.test.tsx` | ❌ W0 | ⬜ pending |
| 11-08-backpressure | 08 | 3 | OPT-02 (SC-4) | — | runningJobs peak ≤ min(hwConc,4) on ≥20-file batch | e2e | `playwright test tests/e2e/backpressure.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `jszip ^3.10`, `file-saver ^2.0`, `@types/file-saver` (per CLAUDE.md locks; verified 3.10.1 / 2.0.5 / 2.0.7 by RESEARCH.md)
- [ ] `tests/deps.spec.ts` — assert pinned versions present in `package.json`
- [ ] `src/main.tsx` — add **test-only** `window.__peakRunning` + `window.__runningJobs` bridge gated by `import.meta.env.MODE === 'test'` (consumed by SC-4 e2e harness; bridge MUST be tree-shaken from prod builds)
- [ ] `tests/e2e/fixtures/` — seed ≥20 synthetic input files (mix of WebP/PNG ≤200KB each) for the backpressure harness and ZIP roundtrip
- [ ] `tests/setup/save-file-mocks.ts` — shared `showSaveFilePicker` + `file-saver.saveAs` mocks
- [ ] If `vitest` or `playwright` not detected in `package.json`: install + scaffold configs (treat as Wave 0 blocker)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `showSaveFilePicker` native dialog actually appears in Chrome/Edge | EXP-01 | Picker UI is browser chrome — cannot be asserted from page context, only mocked | In dev build, drop a file, optimize, click Inspector Download — native picker must appear in Chromium and the suggested name must be the swapped-extension base name |
| `file-saver` fallback delivers in Firefox/Safari | EXP-01 | Same — fallback path issues an anchor click; no programmatic confirmation of the download dialog | In Firefox + Safari dev builds, repeat the above; verify the file lands in Downloads with the expected name |
| Bulk "Save individually" doesn't trip browser anti-multi-download heuristics | EXP-01 (D-06) | Heuristics are browser-version-sensitive and not observable in test runners | Run on 20-file batch in Chrome, Firefox, Safari; confirm no per-file "Allow multiple downloads?" prompt blocks the loop |
| ZIP unzips correctly across OS unzip tools | EXP-02 | Roundtrip in test asserts byte-equal blob; OS tools (macOS Archive Utility, Windows Explorer, `unzip`) may differ on flat-layout edge cases | Export a 20-file ZIP, unzip on macOS Finder + Windows Explorer + `unzip -t`; all files present, correct extensions, no duplicates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (deps install, test-only window bridge, fixture seeds, save-file mocks)
- [ ] No watch-mode flags (`vitest --watch`, `playwright --ui`) in any plan command
- [ ] Feedback latency < 90s for the full suite
- [ ] `nyquist_compliant: true` set in frontmatter after planner aligns all task rows to real IDs

**Approval:** pending
