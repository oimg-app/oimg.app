---
phase: 8
slug: worker-pipeline-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` → Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.x (e2e/spec) + `node --experimental-strip-types` (unit/bundle) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test src/tests/backpressure.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test src/tests/backpressure.spec.ts`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Rows below are requirement-level until plans
> exist; the planner/checker must back-fill `Task ID` / `Plan` / `Wave` columns so every
> task maps to an automated command or a Wave 0 dependency.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PIPE-01 | — | Worker validates `job.codec` against known enum before dispatch | Playwright e2e | `npx playwright test src/tests/worker-pipeline.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PIPE-02 | — | N/A | Playwright network | `npx playwright test src/tests/worker-pipeline.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PIPE-03 | — | `crossOriginIsolated === true` in app + worker | Playwright evaluate | `npx playwright test src/tests/worker-pipeline.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PIPE-04 | — | Pool bounds concurrent jobs; queue holds excess | Playwright e2e | `npx playwright test src/tests/backpressure.spec.ts` | ✅ exists (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/worker-pipeline.spec.ts` — new spec covering PIPE-01 (UI interactive during encode), PIPE-02 (AVIF WASM not fetched until selected), PIPE-03 (`crossOriginIsolated === true`)
- [ ] Extend `src/tests/backpressure.spec.ts` — assert real `runningJobs` / `queuedJobs` counts drive the indicator (not just the boolean `running`)

*Existing Playwright infrastructure (`playwright.config.ts`) covers config/runner — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Initial route < 200KB gzipped | PIPE-02 | Bundle size is a build-artifact measurement, not a runtime assertion | Run `npm run build`; inspect the gzipped size of the initial entry chunk(s) in the Vite/Rollup output; confirm AVIF WASM is in a separate lazy chunk |

*Network assertion (no AVIF WASM fetch until AVIF selected) IS automatable via Playwright request interception — keep it in `worker-pipeline.spec.ts`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`worker-pipeline.spec.ts`, extended `backpressure.spec.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
