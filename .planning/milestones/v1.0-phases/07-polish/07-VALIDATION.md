---
phase: 7
slug: polish
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
note: Retroactive — Phase 7 was executed and human-verified before this doc was generated (clears health W009).
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Retroactive record: all tasks shipped and verified; statuses reflect the final green state.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`src/tests/*.spec.ts`) + Node `--experimental-strip-types` unit tests + static grep audits |
| **Config file** | `playwright.config.ts` (root; dev server auto-starts on port 5174) |
| **Quick run command** | `npx playwright test src/tests/backpressure.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~150s per Playwright spec (includes dev-server boot) |

---

## Sampling Rate

- **After every task commit:** `npx tsc -b --noEmit`
- **After every plan wave:** relevant Playwright spec + grep audits
- **Before sign-off:** `npx playwright test src/tests/backpressure.spec.ts` and `src/tests/navigation.spec.ts -g "Codec menu"` green
- **Max feedback latency:** ~150s (Playwright); <5s (tsc / grep)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SHELL-02 | T-07-01 | CSS-only pulse, no JS timer | unit | `npx tsc -b --noEmit` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | SHELL-02 | — | N/A | unit | `npx tsc -b --noEmit` | ✅ | ✅ green |
| 07-01-03 | 01 | 1 | SHELL-02 | — | N/A | e2e | `npx playwright test src/tests/backpressure.spec.ts` | ✅ | ✅ green (2/2) |
| 07-02-01 | 02 | 1 | SHELL-02 | — | inline script reads localStorage only | unit | `npx tsc -b --noEmit` | ✅ | ✅ green |
| 07-02-02 | 02 | 1 | WCAG focus | — | N/A | static | `grep -c focus-visible src/index.css` | ✅ | ✅ green |
| 07-02-03 | 02 | 1 | STORE-08 | — | N/A | static | `grep -rn "from '@/lib/stub-data'" src/components/` | ✅ | ✅ green (no matches) |
| 07-03-01 | 03 | 2 | SHELL-02, STORE-08, ESM | — | N/A | audit | tsc + ESM grep + STORE-08 grep + Playwright | ✅ | ✅ green (5/5) |
| 07-03-02 | 03 | 2 | SHELL-02, WCAG | — | N/A | human-verify | browser checkpoint | — | ✅ approved |
| 07-fix-01 | — | 2 | WCAG keyboard | — | N/A | e2e | `npx playwright test src/tests/navigation.spec.ts -g "Codec menu"` | ✅ | ✅ green (2/2) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*07-fix-01 = post-checkpoint dropdown arrow-key fix (Popover→DropdownMenu, commit c5fa841).*

---

## Wave 0 Requirements

- [x] `src/tests/backpressure.spec.ts` — covers SHELL-02 (indicator visible when running, hidden at rest)

*Existing infrastructure (navigation.spec.ts, stores.test.ts) covered the remaining requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Theme toggle has no FOUC on hard reload | SHELL-02 / theme | Pre-paint flash is a visual timing artifact, not assertable in Playwright reliably | Hard-reload (Cmd+Shift+R) in dark mode; confirm no white flash before dark renders |
| Focus rings visible on Tab traversal | WCAG focus | `:focus-visible` rendering is a visual property; axe-core not wired | Tab through TitleBar/Toolbar/file rows; confirm green outline on each |

*Both confirmed during the 07-03 human-verify checkpoint (approved 2026-05-25).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable (tsc/grep <5s; Playwright ~150s with dev-server boot)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25 (retroactive — phase executed + human-verified)
