---
phase: 1
slug: shell-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
updated: 2026-04-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | @playwright/test (real Chromium — no jsdom) |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npx playwright test` |
| **Full suite command** | `npx playwright test --reporter=list` |
| **Bundle size check** | `node src/tests/build.test.ts` (standalone Node, no browser) |
| **Estimated runtime** | ~15–30 seconds (Playwright starts Vite dev server) |

---

## Sampling Rate

- **After every task commit (Wave 3+):** Run `npx playwright test`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Bundle check:** Run `node src/tests/build.test.ts` after each `npm run build`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PRIV-01 | — | No CDN font requests; fonts served locally | manual | Browser DevTools Network tab — no external font requests | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | PRIV-01 | — | crossOriginIsolated === true | manual | Browser console assertion + DevTools Security tab | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | UI-01 | — | oklch palette matches example-ui/ | manual | Visual comparison in browser | ✅ | ⬜ pending |
| 01-01-04 | 01 | 1 | UI-02 | — | Inter + JetBrains Mono render correctly | manual | Browser DevTools Fonts panel | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | UI-08 | — | ARIA landmark specs runnable (stubs skip gracefully) | e2e | `npx playwright test src/tests/shell.spec.ts` | ✅ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | PERF-04 | — | Initial route < 200KB JS gzipped | node | `node src/tests/build.test.ts` (after build) | ✅ W0 | ⬜ pending |
| 01-04-01 | 04 | 3 | UI-08 | — | All 5 ARIA landmarks visible in real Chromium | e2e | `npx playwright test src/tests/shell.spec.ts` | ✅ | ⬜ pending |
| 01-05-01 | 05 | 4 | UI-01 | — | Panels render with correct ARIA roles and empty-state copy | e2e | `npx playwright test` | ✅ | ⬜ pending |
| 01-05-02 | 05 | 4 | UI-06 | — | Keyboard navigation cycles all interactive elements | manual | Tab key navigation test | ✅ | ⬜ pending |
| 01-05-03 | 05 | 4 | UI-07 | — | ARIA roles present on landmark regions | e2e | `npx playwright test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/tests/shell.spec.ts` — ARIA landmark specs (conditional skips until Plan 04)
- [x] `src/tests/build.test.ts` — bundle size check (standalone Node script, exits 1 if over budget)
- [x] `@playwright/test` installed — real Chromium, no jsdom
- [ ] Chromium browser downloaded: `npx playwright install chromium`

*No vitest, @testing-library/react, or jsdom — Playwright uses real browsers.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `crossOriginIsolated === true` in Chrome/Firefox/Safari | PRIV-01 | Requires live browser with COOP/COEP headers | Open DevTools Console, assert `crossOriginIsolated === true`; check Security tab |
| No external font CDN requests | PRIV-01 | Network-level check | DevTools → Network → filter `fonts.googleapis.com` / `fonts.gstatic.com` — must be empty |
| Dark/light theme matches example-ui/ oklch palette | UI-01 | Visual comparison | Side-by-side browser diff against `example-ui/OIMG.html` |
| shadcn slider/checkbox/accordion visual tokens | UI-08 | Visual regression | Compare rendered components against prototype |
| Keyboard navigation completeness | UI-06 | Requires human tabbing through UI | Tab through all interactive elements; verify logical order and focus ring visibility |

---

## Playwright vs jsdom: Why

| Capability | Playwright | jsdom |
|------------|-----------|-------|
| Real ARIA tree | Real Chromium accessibility tree | Simulated; may miss CSS-driven visibility |
| Real CSS rendering | Full Tailwind/CSS computed styles | No CSS applied |
| COOP/COEP header inspection | CDP / Network tab | Not applicable |
| Performance API | CDP DevTools protocol | Not available |
| `crossOriginIsolated` | Real value from browser | Always false |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in automated commands
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
