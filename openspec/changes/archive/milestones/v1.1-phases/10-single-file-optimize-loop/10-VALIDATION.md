---
phase: 10
slug: single-file-optimize-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 |
| **Config file** | `playwright.config.ts` (root) |
| **Quick run command** | `npx playwright test src/tests/ingest.spec.ts --project=chromium` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30–60 seconds (quick) / ~3 min (full) |

---

## Sampling Rate

- **After every task commit:** `npx playwright test src/tests/ingest.spec.ts --project=chromium`
- **After every plan wave:** `npx playwright test` (full — confirm the D-05 fixture migration didn't break existing specs)
- **Before `/gsd:verify-work`:** Full suite green
- **Max feedback latency:** ~60 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-XX-XX | TBD | TBD | OPT-01 / SC-1 | — | Only accepted formats ingested | e2e | `npx playwright test src/tests/ingest.spec.ts -g "drop"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | TBD | OPT-01 / SC-2 | — | N/A | e2e | `npx playwright test src/tests/ingest.spec.ts -g "Report"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | TBD | OPT-01 / SC-3 | — | N/A | e2e | `npx playwright test src/tests/ingest.spec.ts -g "re-optimize"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | TBD | D-04 | — | App starts empty (no stub files) | e2e | `npx playwright test src/tests/ingest.spec.ts -g "empty"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | TBD | D-06/D-07 | T-10-V5 | Unsupported file silently skipped at ingest | e2e | `npx playwright test src/tests/ingest.spec.ts -g "skip"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are TBD until the planner assigns plan/wave numbers.*

---

## Wave 0 Requirements

- [ ] `src/tests/fixtures/ingest-helper.ts` — shared `ingestFixtureFiles(page, n)` helper (inject real `FileEntry` objects into `filesAtom` via `page.evaluate`, mirroring the existing pattern in `per-file-settings.spec.ts`)
- [ ] `src/tests/ingest.spec.ts` — OPT-01 SC-1/2/3 + D-04 empty-start + D-06/D-07 silent-skip
- [ ] Update `src/tests/inspector-tabs.spec.ts` — replace `hero-banner@2x.png` text lookups with `ingestFixtureFiles` (D-05)
- [ ] Update `src/tests/output-panel.spec.ts` — same (D-05)
- [ ] Update `src/tests/per-file-settings.spec.ts` — inject 2 fixture entries before evaluate (D-05)
- [ ] Update `src/tests/navigation.spec.ts` + `src/tests/backpressure.spec.ts` — "Optimize all"/running-state assertions need ≥1 ingested fixture file (D-05; these relied on seeded demos)

*Removing the seeded demos (D-04) is what forces this Wave 0 fixture work — without it, every spec that assumed a pre-populated list goes red.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-active visual state on the dropzone while dragging a file over it | OPT-01 (D-01) | Native drag hover state is awkward to drive deterministically in Playwright | Drag a file over the dropzone, confirm the drag-active highlight appears and clears on dragleave/drop |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the ingest helper + ingest.spec + all 5 D-05 spec migrations
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (quick)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
