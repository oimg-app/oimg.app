---
phase: 5
slug: raster-encoders
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 (E2E) + `node --experimental-strip-types` (unit) |
| **Config file** | `playwright.config.ts` (exists from Phase 3/4) |
| **Quick run command** | `npx playwright test --grep "raster"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --grep "raster"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | OPT-02 | T-5-01 | Malformed PNG throws AdapterError, not crashes renderer | E2E | `npx playwright test --grep "OPT-02"` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | OPT-03 | — | N/A | E2E | `npx playwright test --grep "OPT-03"` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | OPT-04 | — | N/A | E2E | `npx playwright test --grep "OPT-04"` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 0 | OPT-05 | T-5-02 | AVIF WASM not fetched until format selected | E2E | `npx playwright test --grep "OPT-05"` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | PIPE-02 | — | N/A | E2E | `npx playwright test --grep "raster"` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | PIPE-03 | — | N/A | E2E | `npx playwright test --grep "raster"` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | UI-03 | — | N/A | E2E | `npx playwright test --grep "UI-03"` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | UI-04 | — | N/A | E2E | `npx playwright test --grep "UI-04"` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 1 | UI-05 | — | N/A | E2E | `npx playwright test --grep "UI-05"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/raster.spec.ts` — E2E stubs covering OPT-02 through UI-05
- [ ] `src/tests/settings.unit.ts` — per-file override merge logic (PIPE-03)
- [ ] `npm install @jsquash/jpeg @jsquash/webp @jsquash/avif @jsquash/oxipng` — codec packages

*All phase requirements need Wave 0 test stubs before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AVIF WASM bundle not in initial network load | OPT-05 | Network tab inspection required | Open DevTools → Network → reload page → confirm no avif.wasm before adding AVIF file |
| Split slider drag feel | UI-04 | Subjective interaction quality | Click file → drag slider left/right → verify smooth response and correct image halves |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
