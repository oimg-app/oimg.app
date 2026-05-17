---
phase: 3
slug: navigation-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run build -- --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build -- --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | STORE-04 | — | N/A | build | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | STORE-07 | — | N/A | build | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | STORE-03 | — | N/A | build | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | NAV-01 | — | N/A | build+visual | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | NAV-02 | — | N/A | build+visual | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | NAV-03 | — | N/A | build+visual | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 3 | NAV-04 | — | N/A | build+visual | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 3 | SHELL-03 | — | N/A | build+visual | `npm run build -- --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] All component files created per plan (TitleBar, Toolbar, StatusBar, CommandPalette)
- [ ] `src/stores/runtime.ts` — STORE-04
- [ ] `src/lib/commands.ts` — STORE-07
- [ ] TypeScript compilation passes after each new file

*Existing vitest infrastructure from Phase 1 covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TitleBar menus open as popovers | NAV-01 | Browser interaction | Click each menu, verify popover opens |
| Toolbar Optimize triggers `runtimeAtom.running=true` | NAV-02 | Store state observation | Click Optimize, check React DevTools |
| StatusBar shows live file count + size | NAV-03 | Dynamic data | Verify against stub data totals |
| ⌘K opens CommandPalette | NAV-04 | Keyboard shortcut | Press ⌘K, verify modal appears |
| Arrow keys navigate command list | NAV-04 | Keyboard interaction | Press ↑↓, verify selection moves |
| Theme toggle switches `data-theme` attribute | SHELL-03 | DOM attribute check | Toggle theme, inspect `<html>` element |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
