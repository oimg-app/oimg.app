---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (TypeScript compile + Vite build; catches import errors)
- **After every plan wave:** Run `npm test` (full Playwright suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-CSS-tokens | 01 | 1 | SETUP-01/02 | — | N/A | Smoke (Playwright) | `npm test -- --project=chromium` | ❌ Wave 0 | ⬜ pending |
| 1-build-smoke | 01 | 1 | SETUP-03 | — | N/A | Build smoke | `npm run build` | N/A | ⬜ pending |
| 1-stub-data | 01 | 1 | STORE-05 | — | N/A | Unit (Node) | `node --experimental-strip-types src/tests/stub-data.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-format-utils | 01 | 1 | STORE-06 | — | N/A | Unit (Node) | `node --experimental-strip-types src/tests/format.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-app-shell | 01 | 1 | SHELL-01 | — | N/A | Smoke (Playwright) | `npm test -- --project=chromium` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/foundation.spec.ts` — covers SETUP-01/02 (dark bg color token active, accent green visible) + SHELL-01 (3 panes render, fills viewport)
- [ ] `src/tests/stub-data.test.ts` — covers STORE-05 (`STUB_FILES.length === 12`, `SVGO_PLUGINS.length === 22`)
- [ ] `src/tests/format.test.ts` — covers STORE-06 (`fmtBytes(1024) === '1.0 KB'`, `fmtPct(100, 50) === '−50.0%'`; borrow pattern from `src/tests/filename.test.ts`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inter font loaded, JetBrains Mono for code elements | SETUP-01 | Font rendering is visual | Open dev tools → Network tab → confirm font files loaded |
| Dark theme default, light theme via `.light` class | SETUP-02 | Theme toggle not wired until Phase 3 | Add `.light` class to `<html>` in DevTools, verify bg/fg color vars change |
| Resizable panels respond to drag | SHELL-01 | Drag interaction hard to automate reliably | Manually drag the resize handle between panes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
