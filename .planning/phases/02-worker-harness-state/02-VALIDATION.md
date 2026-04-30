---
phase: 2
slug: worker-harness-state
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source-of-truth: §Validation Architecture in `02-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `^1.59.1` (already installed; `@playwright/test`) |
| **Config file** | `playwright.config.ts` (existing — runs against dev server at :5173) |
| **Quick run command** | `npx playwright test src/tests/worker-pool.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Bundle size check** | `npm run test:bundle` |
| **Estimated runtime** | Quick: ~10s · Full: ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test src/tests/worker-pool.spec.ts` (focused new file)
- **After every plan wave:** Run `npx playwright test` (full suite) + `npm run test:bundle`
- **Before `/gsd-verify-work`:** Full suite green + manual DevTools Performance check (concurrency visible in worker timeline)
- **Max feedback latency:** 30 seconds

---

## Validation Requirements (VR-01..VR-07)

Concrete, testable assertions the planner MUST turn into Wave 0 test scaffolds before any task can claim Phase 2 done.

| VR | Behavior | Maps To | Spec File |
|----|----------|---------|-----------|
| **VR-01** | Stub round-trip end-to-end. Synthetic 1KB Blob → Optimize → < 500ms → `optimizedSize === originalSize`, status `done`, `0 bytes saved` row. | PERF-01, ROADMAP SC-1, SC-2 | `worker-pool.spec.ts` |
| **VR-02** | Concurrency cap enforced. `min(hwConc, 4) + 1` jobs against 200ms slow stub; `useRuntimeStore.getState().inFlight.size <= min(hwConc, 4)` continuously throughout batch (poll via `page.evaluate`). | PERF-01, ROADMAP SC-4 | `worker-pool.spec.ts` |
| **VR-03** | Cancel kills in-flight. 4 jobs against 1000ms stub; trigger Cancel after 50ms; within 200ms `running===false`, `inFlight.size===0`, no `markDone` actions in next 2000ms. | D-02, ROADMAP SC-3 | `worker-pool.spec.ts` |
| **VR-04** | Object URL leak-free. 12-file batch with re-optimize per file; monkey-patched `createObjectURL`/`revokeObjectURL` counters; `created === revoked + stillRendered` post-batch. | D-10, PRIV-04 | `object-url.spec.ts` |
| **VR-05** | ARIA quartile cadence. 12-file batch; `[role=status]` text updated exactly 5× (start + completions at 3,6,9 + final). No per-file announcements. | PERF-03, UI-SPEC §5 | `aria-live.spec.ts` |
| **VR-06** | Phase 1 ARIA contract preserved. All 11 existing `shell.spec.ts` tests pass post-migration. queue `role=listbox`, inspector `role=tablist`, compare `role=slider` semantics unchanged. | regression | `shell.spec.ts` (existing) |
| **VR-07** | Bundle size budget unbroken. `npm run test:bundle` < 200KB gzipped initial route. Worker + lazy adapter chunks NOT in initial bundle. | PERF-02, PERF-04 | `build.test.ts` (existing) |

---

## Per-Task Verification Map

Stubbed — populated by planner during plan generation. Each task references one or more VRs and one or more requirement IDs.

| Task ID | Plan | Wave | Requirement | VR | Threat Ref | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|----|------------|-----------|-------------------|-------------|--------|
| 02-WAVE0 | Wave 0 | 0 | — | VR-01..VR-07 | — | Playwright fixtures | `npx playwright test src/tests/worker-pool.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERF-01 | VR-01, VR-02 | — | e2e | `npx playwright test -g "stub round-trip"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERF-01 | VR-03 | T-02-01 (cancel race) | e2e | `npx playwright test -g "cancel correctness"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERF-02 | — | — | e2e + network | `npx playwright test -g "lazy load"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERF-03 | VR-05 | — | e2e + role=status | `npx playwright test src/tests/aria-live.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-10 / PRIV-04 | VR-04 | T-02-02 (URL leak) | e2e + counter instrumentation | `npx playwright test src/tests/object-url.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | regression | VR-06 | — | e2e | `npx playwright test src/tests/shell.spec.ts` | ✅ existing | ⬜ pending |
| TBD | TBD | TBD | PERF-02 / PERF-04 | VR-07 | — | bundle audit | `npm run test:bundle` | ✅ existing | ⬜ pending |

*Planner: replace `TBD` rows with actual task IDs during plan generation.*

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test scaffolds and fixtures that MUST exist before any execution-wave task begins:

- [ ] `src/tests/worker-pool.spec.ts` — covers VR-01..VR-03 (stub round-trip, concurrency cap, cancel correctness)
- [ ] `src/tests/object-url.spec.ts` — covers VR-04 (objectURL leak parity)
- [ ] `src/tests/aria-live.spec.ts` — covers VR-05 (quartile cadence)
- [ ] `src/tests/fixtures/synthetic.ts` — synthetic Blob batch generator (deterministic; sizes from 1KB to 50MB; no OOM)
- [ ] `src/tests/fixtures/instrument-blob-urls.ts` — monkey-patch helper that wraps `URL.createObjectURL`/`URL.revokeObjectURL` with counters, exposed on `window.__urlCounters` for test inspection
- [ ] `src/tests/shell.spec.ts` extension — Optimize button state transitions (`Optimize all` → `Optimizing…` → `Optimize all`), Workers status pill text, additive to existing 11 tests
- [ ] `npm run test:bundle` — extend if needed to enumerate worker chunks separately from main bundle

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DevTools Performance worker tracks | ROADMAP SC-4 | Browser-internal threading visualization not Playwright-observable | Open DevTools → Performance → record a 50-file batch with synthetic 5MB blobs (use `src/tests/fixtures/synthetic.ts` from console). Verify exactly `min(hwConc, 4)` parallel worker tracks during run. Confirm main thread blocks < 50ms continuously. |
| Reduced-motion respect | UI-SPEC §10 | OS-level preference toggle | Set `prefers-reduced-motion: reduce` in DevTools Rendering tab. Run optimize. Confirm: no pulse animation on running rows, no transition on Workers pill, no toast slide-in. |
| Cross-origin isolation runtime guard | SEC inherited from Phase 1 | Boot-time assertion already in `src/main.tsx`; manual verification when COOP/COEP headers are accidentally relaxed | After deploy, browser console: `crossOriginIsolated` must be `true`. Phase 2 strengthens nothing yet — this is a regression check. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all VR-01..VR-07
- [ ] No watch-mode flags (`playwright test --watch` is forbidden in CI loops)
- [ ] Feedback latency < 30s for quick-run, < 60s for full suite + bundle
- [ ] `nyquist_compliant: true` set in frontmatter once planner closes the per-task map and Wave 0 ships green

**Approval:** pending
