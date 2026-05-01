---
phase: 03
slug: svg-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `03-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test ^1.59.1`) for E2E + browser-driven unit |
| **Config file** | `playwright.config.ts` (repo root) |
| **Quick run command** | `npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30–60 s (Playwright cold; ~15 s warm) |

> Note: pure unit tests for `buildSvgoConfig` and the yoksel encoder use Node's experimental TS strip-types (`node --experimental-strip-types <file>`) since the project deliberately avoids vitest/jest. No test framework install is needed.

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-A-W0-01 | A | 0 | — | — | Wave 0 fixtures + spec stubs exist | scaffold | `test -f src/tests/svg-pipeline.spec.ts && test -f src/tests/svg-xss.spec.ts` | ❌ W0 | ⬜ pending |
| 03-A-01-01 | A | 1 | OPT-01 / PIPE-01 | T-V5-01 | SVGO returns optimized bytes via worker pool; status `done` | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "OPT-01"` | ❌ W0 | ⬜ pending |
| 03-A-01-02 | A | 1 | OPT-01 | — | `buildSvgoConfig` overrides reflect plugin record state | unit | `node --experimental-strip-types src/tests/svg-adapter.unit.ts` | ❌ W0 | ⬜ pending |
| 03-A-01-03 | A | 1 | — | T-V5-01..04 | DOMPurify removes `<script>`, on*, `javascript:` href, `data:` href on the main thread post-pool | E2E | `npx playwright test src/tests/svg-xss.spec.ts -g "script\|onload\|javascript\|data-uri"` | ❌ W0 | ⬜ pending |
| 03-A-01-04 | A | 1 | — | T-V5-05 | `foreignObject` script payloads neutralized (children removed or stripped) | E2E | `npx playwright test src/tests/svg-xss.spec.ts -g "foreignObject"` | ❌ W0 | ⬜ pending |
| 03-A-01-05 | A | 1 | OPT-01 | — | `FileEntry.sanitizedCount` populated on done; badge visible in row | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "sanitized badge"` | ❌ W0 | ⬜ pending |
| 03-B-02-01 | B | 2 | OPT-01 | — | SvgoPanel renders 10–12 curated plugins; default state mirrors SVGO v4 preset-default | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "plugin list"` | ❌ W0 | ⬜ pending |
| 03-B-02-02 | B | 2 | OPT-01 | — | Plugin toggle re-optimizes selected file in real time (D-08); batch unaffected | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "plugin toggle"` | ❌ W0 | ⬜ pending |
| 03-B-02-03 | B | 2 | OPT-01 | — | Mass-toggle (≥3 toggles within 200 ms) cancels prior preview; last-toggle-wins (D-11) | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "mass toggle\|cancel"` | ❌ W0 | ⬜ pending |
| 03-B-02-04 | B | 2 | OPT-01 | — | `pluginSavings` populated post-batch; SvgoPanel `.saves` column shows aggregate bytes/% | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "live savings"` | ❌ W0 | ⬜ pending |
| 03-B-02-05 | B | 2 | OPT-01 | — | Foot-gun warnings render on `removeViewBox`, `removeDimensions`, `cleanupIds` | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "foot-gun\|warning"` | ❌ W0 | ⬜ pending |
| 03-B-02-06 | B | 2 | — | T-V5-06 | "Disable SVG sanitization on export" toggle flips adapter behavior; default = sanitize | E2E | `npx playwright test src/tests/svg-xss.spec.ts -g "unsafe export toggle"` | ❌ W0 | ⬜ pending |
| 03-C-03-01 | C | 3 | SNIP-01 | — | SnippetPanel renders inline-svg + url-encoded sections for SVG file (D-12) | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "SNIP-01"` | ❌ W0 | ⬜ pending |
| 03-C-03-02 | C | 3 | SNIP-01 | — | Per-snippet checkbox hides body when unchecked (D-13) | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "checkbox"` | ❌ W0 | ⬜ pending |
| 03-C-03-03 | C | 3 | SNIP-04 | — | yoksel encoder: regex-mandated escapes; spaces and UTF-8 untouched; `"` → `'` | unit | `node --experimental-strip-types src/tests/svg-snippets.unit.ts` | ❌ W0 | ⬜ pending |
| 03-C-03-04 | C | 3 | SNIP-03 | — | Copy button writes snippet to clipboard; "copied" affordance ≥ 1100 ms | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "clipboard\|copy"` | ❌ W0 | ⬜ pending |
| 03-C-03-05 | C | 3 | SNIP-01 | T-V5-07 | Snippet output for sanitized SVG contains no `<script>` / on* / `javascript:` | E2E | `npx playwright test src/tests/svg-xss.spec.ts -g "snippet output"` | ❌ W0 | ⬜ pending |
| 03-D-04-01 | D | 4 | OPT-01..PIPE-01 | T-V5-* | Full XSS corpus (8 vectors) blocked end-to-end (preview + inline + dataURI + ZIP) | E2E | `npx playwright test src/tests/svg-xss.spec.ts` | ❌ W0 | ⬜ pending |
| 03-D-04-02 | D | 4 | PIPE-01 | — | Drop SVG → enqueue → optimize → done with byte-delta in row (Pipeline integration) | E2E | `npx playwright test src/tests/svg-pipeline.spec.ts -g "PIPE-01"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · IDs above are hints — final task IDs will be set by gsd-planner.*

---

## Wave 0 Requirements

- [ ] `src/tests/svg-pipeline.spec.ts` — stubs for OPT-01, SNIP-01, SNIP-03, SNIP-04, PIPE-01
- [ ] `src/tests/svg-xss.spec.ts` — stubs for SC-3 corpus (8 attack vectors)
- [ ] `src/tests/svg-adapter.unit.ts` — `buildSvgoConfig` unit-test stub
- [ ] `src/tests/svg-snippets.unit.ts` — yoksel encoder unit-test stub with reference cases
- [ ] `src/tests/fixtures/xss-script.svg`, `xss-onload.svg`, `xss-javascript-href.svg`, `xss-data-href.svg`, `xss-foreignobject.svg`, `xss-use-data.svg`, `xss-image-javascript.svg`, `xss-css-expression.svg` — fixture corpus
- [ ] `npm install svgo@^4.0.1 dompurify@^3.4.2` — required deps before Wave 1
- [ ] Empirical probe: confirm DOMPurify can/cannot init inside `new Worker({ type: 'module' })` — decides whether sanitization stays in worker or moves to main thread (planner gates Plan A on this result; research recommends main-thread)

*Existing infrastructure (`@playwright/test`, Vite dev server, `window.__OIMG_STORES__` exposure from Phase 2) covers everything else.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Foot-gun warning copy reads sensibly to a developer (D-07) | OPT-01 | Subjective UX phrasing | Open SvgoPanel; toggle `removeViewBox`; confirm hint text is actionable, not jargon |
| Sanitized badge tooltip / count display reads cleanly | — | Subjective UX phrasing | Drop XSS fixture, confirm badge UI matches D-03 intent (small, non-intrusive) |
| "Disable SVG sanitization on export" toggle copy is unambiguous and labeled advanced (D-04) | — | Legal/UX phrasing | Open settings; confirm copy clearly warns about XSS risk before toggling |

---

## Validation Sign-Off

- [ ] All tasks have automated verify command OR a Wave 0 gap entry
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (specs + fixtures + deps + DOMPurify-in-Worker probe)
- [ ] No watch-mode flags in any verify command
- [ ] Feedback latency < 60 s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 ships and full suite is green

**Approval:** pending
