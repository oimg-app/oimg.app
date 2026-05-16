---
phase: 02
slug: files-pane
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — visual/smoke verification only (tdd_mode: false) |
| **Config file** | none |
| **Quick run command** | `npm run dev` |
| **Full suite command** | `npm run build && npm run dev` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (type-check)
- **After every plan wave:** Run `npm run dev` → visual smoke check in browser
- **Before `/gsd-verify-work`:** Full visual smoke check against all 6 success criteria
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-store-01 | stores | 1 | STORE-01 | — | N/A (client-side) | manual | `npm run build` | ❌ W0 | ⬜ pending |
| 02-store-03 | stores | 1 | STORE-03 | — | N/A (client-side) | manual | `npm run build` | ❌ W0 | ⬜ pending |
| 02-filerow | filerow | 2 | FILES-01, FILES-02 | — | N/A (client-side) | manual | `npm run build` | ❌ W0 | ⬜ pending |
| 02-filespane | filespane | 2 | FILES-03, FILES-04, FILES-05 | — | N/A (client-side) | visual | `npm run dev` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing build infrastructure (`npm run build`, `npm run dev`) covers all phase requirements. No test framework install needed (tdd_mode: false per REQUIREMENTS.md Out of Scope).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 12 file rows render with badge, sizes, savings% | FILES-01 | Visual UI assertion | `npm run dev` → count rows, verify badges match format types |
| Row click selects (highlights) | FILES-02 | Interactive UI | Click a row → verify highlight style applied |
| Right-click / ctxbtn opens context menu | FILES-03 | Interactive UI | Right-click row → menu appears; click ctxbtn → same menu |
| "Remove from queue" removes row | FILES-04 | Interactive UI | Click "Remove from queue" → row disappears from list |
| Totals bar shows computed values | FILES-05 | Visual UI assertion | Verify 4 stat cells display non-zero values from `$totals` |
| Dropzone visible | FILES-01 | Visual UI assertion | Dropzone "Drop images to optimize" area visible above list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
