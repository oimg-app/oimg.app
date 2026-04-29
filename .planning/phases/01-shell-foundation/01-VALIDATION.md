---
phase: 1
slug: shell-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (vitest inline) or vitest.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PRIV-01 | — | No CDN font requests; fonts served locally | manual | Browser DevTools Network tab — no external font requests | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | PRIV-01 | — | crossOriginIsolated === true | manual | Browser console assertion + DevTools Security tab | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | UI-01 | — | oklch palette matches example-ui/ | manual | Visual comparison in browser | ✅ | ⬜ pending |
| 01-01-04 | 01 | 1 | UI-02 | — | Inter + JetBrains Mono render correctly | manual | Browser DevTools Fonts panel | ✅ | ⬜ pending |
| 01-01-05 | 01 | 1 | UI-06 | — | Keyboard navigation cycles all interactive elements | manual | Tab key navigation test | ✅ | ⬜ pending |
| 01-01-06 | 01 | 1 | UI-07 | — | ARIA roles present on landmark regions | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | UI-08 | — | shadcn components match example-ui/ visual language | manual | Visual regression check | ✅ | ⬜ pending |
| 01-01-08 | 01 | 1 | PERF-04 | — | Initial route < 200KB JS gzipped | unit | `npm run build && npx vite-bundle-visualizer` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/shell.test.tsx` — stubs for ARIA/a11y assertions (UI-07)
- [ ] `src/tests/build.test.ts` — bundle size check (PERF-04)
- [ ] vitest + @testing-library/react installed — if not already present

*Existing COOP/COEP and visual checks are manual-only — browser automation required for full automation.*

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

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
