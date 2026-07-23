---
phase: 13
slug: diagnostics-clear-queue
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: v1.2 REQUIREMENTS + research/v1.2-diagnostics.md + Phase 11/12 test infra (already shipped).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x / node --experimental-strip-types (unit) + Playwright 1.x (e2e) — already configured |
| **Quick run command** | `node --experimental-strip-types src/tests/versions.test.ts` (~2s) |
| **Full suite command** | `npm run build && npx playwright test src/tests/diagnostics.spec.ts src/tests/clear-queue.spec.ts` |
| **Estimated runtime** | ~60s (unit ~3s, e2e ~55s) |

---

## Sampling Rate

- **After every task commit:** Run the changed-area test (versions, clearFiles, statusbar, settings, filespane-header)
- **After every plan wave:** Full suite
- **Before phase verification:** `npm run build` green + all new tests + no regressions on existing 24+ Phase 11/12 e2e
- **Max feedback latency:** 60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-versions | 01 | 1 | DIA-01 | — | Vite `define` injects version strings at build time; no runtime package.json reads in prod chunks (verified via grep on `dist/`) | unit + build | `node --experimental-strip-types src/tests/versions.test.ts` + `npm run build` | ❌ W0 | ⬜ pending |
| 13-02-caps | 02 | 1 | DIA-02 | — | Capability probe runs in main.tsx pre-render; uses standard WebAssembly.validate + crossOriginIsolated globals | unit | `node --experimental-strip-types src/tests/caps.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-atom-reshape | 03 | 1 | DIA-01, DIA-02 | — | runtimeAtom drops svgoVersion/codecVersion/wasmInfo strings; adds versions + caps structured fields | unit | `node --experimental-strip-types src/tests/runtime-shape.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-statusbar | 04 | 2 | DIA-03 | — | StatusBar reads versions.svgo + versions.jsquash.webp; offlineReady=false hides Offline-ready pill | e2e | `npx playwright test src/tests/statusbar-versions.spec.ts` | ❌ W0 | ⬜ pending |
| 13-05-clearfiles | 05 | 1 | CLR-01 | — | clearFiles() empties entries + nulls selectedId; warning toast when runningJobs > 0 | unit | `node --experimental-strip-types src/tests/clearfiles.test.ts` | ❌ W0 | ⬜ pending |
| 13-06-toolbar-clear | 06 | 2 | CLR-01 | — | Settings popover gains "Clear all" with disable-then-explain (aria-disabled + title) when total === 0 | e2e | `npx playwright test src/tests/toolbar-clear.spec.ts` | ❌ W0 | ⬜ pending |
| 13-07-filespane-x | 07 | 2 | CLR-01 | — | FilesPane header × icon with aria-label="Clear all files" + disable-then-explain | e2e | `npx playwright test src/tests/filespane-clear.spec.ts` | ❌ W0 | ⬜ pending |
| 13-08-settings-tab | 08 | 2 | DIA-04 | — | Radix Tabs renders General + Diagnostics; Diagnostics tab reads from runtimeAtom; Copy button routes through copyToClipboard chokepoint | e2e | `npx playwright test src/tests/settings-diagnostics.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/_alias-loader.mjs` — already shipped Phase 11; reused as-is
- [ ] If `vite.config.ts` `define` block needs adjusting for tests (define globals must be `undefined` outside Vite dev/build), declare them in `src/types/globals.d.ts` AND default to safe fallbacks in `src/lib/versions.ts` (so unit tests outside Vite still type-check)
- [ ] No new fixtures required (existing 20-file batch fixture from Phase 11 covers the clear-queue e2e setup)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Diagnostics tab copy → paste into a real bug report | DIA-04 | Clipboard round-trip across application boundary | Open Settings → Diagnostics → click Copy. Paste into a text editor + GitHub issue. Verify JSON is parseable + readable. |
| Capability detection on a real low-end device | DIA-02 | SIMD/threads support varies by hardware; CI may not represent reality | Open Diagnostics on an older iPhone or low-end Android. Confirm `caps.simd` and `caps.threads` reflect the device. |
| StatusBar version badges look correct in dark + light theme | DIA-03 | Theme contrast checks need visual confirmation | Toggle theme in Toolbar; confirm version badges remain WCAG-AA legible. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers `globals.d.ts` augmentation
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set after planner aligns task IDs

**Approval:** pending
