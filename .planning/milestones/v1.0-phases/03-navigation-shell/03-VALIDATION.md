---
phase: 3
slug: navigation-shell
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-17
audited: 2026-05-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E) + Node unit tests |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npx playwright test --project=chromium` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build -- --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|------|--------|
| 3-01-01 | 01 | 1 | STORE-04 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-01-02 | 01 | 1 | STORE-07 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-01-03 | 01 | 1 | STORE-03 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-02-01 | 02 | 2 | NAV-01 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-02-02 | 02 | 2 | NAV-02 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-02-03 | 02 | 2 | NAV-03 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-03-01 | 03 | 3 | NAV-04 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |
| 3-03-02 | 03 | 3 | SHELL-03 | — | N/A | E2E | `npx playwright test --project=chromium` | navigation.spec.ts | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] All component files created per plan (TitleBar, Toolbar, StatusBar, CommandPalette)
- [x] `src/stores/runtime.ts` — STORE-04
- [x] `src/lib/commands.ts` — STORE-07
- [x] TypeScript compilation passes (`npm run build` ✅)

*Playwright E2E suite in `src/tests/navigation.spec.ts` covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TitleBar menus open as popovers | NAV-01 | Browser interaction | Click each menu, verify popover opens |
| Toolbar Optimize triggers `runtimeAtom.running=true` | NAV-02 | Store state observation | Click Optimize, check React DevTools |
| StatusBar shows live file count + size | NAV-03 | Dynamic data | Verify against stub data totals |
| ⌘K opens CommandPalette | NAV-04 | Keyboard shortcut | Press ⌘K, verify modal appears |
| Arrow keys navigate command list | NAV-04 | Keyboard interaction | Press ↑↓, verify selection moves |
| Theme toggle switches `html.dark` class | SHELL-03 | Automated in navigation.spec.ts | — |

---

## Validation Sign-Off

- [x] All tasks have automated E2E verify (navigation.spec.ts)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all requirements
- [x] No watch-mode flags
- [x] Feedback latency < 10s (build) / ~30s (Playwright)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-05-18

---

## Validation Audit 2026-05-18
| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

Fixed: SHELL-03 theme tests updated from `data-theme` attribute check to `classList.contains('dark')` to match actual implementation.
