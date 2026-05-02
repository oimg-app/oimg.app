---
phase: 4
slug: decode-resize-memory-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `^1.59.1` (existing E2E) + node `--experimental-strip-types` (unit) |
| **Config file** | `playwright.config.ts` (existing) |
| **Quick run command** | `npx playwright test src/tests/raster.spec.ts -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~45–90s (full); ~10s (raster-only fast subset) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test src/tests/raster.spec.ts -x` (raster spec, fail-fast)
- **After every plan wave:** Run `npm test` (Phase 1+2+3+4 specs all green)
- **Before `/gsd-verify-work`:** Full suite must be green AND manual UAT walkthrough of SC-1..SC-4
- **Max feedback latency:** 90 seconds (full suite); 10 seconds (per-task quick subset)

---

## Per-Task Verification Map

> Filled by planner during Plan A–N task drafting. Every task with verifiable output gets a row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-XX-XX | XX | N | PIPE-04 / SC-1 | — | density variants emitted with `@Nx.ext` filenames | E2E | `npx playwright test src/tests/raster.spec.ts -g "density variants"` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | OPT-06 / SC-3 (strip) | — | output bytes contain no `iCCP`/EXIF chunks by default | unit | `node --experimental-strip-types src/tests/icc.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | OPT-06 / SC-3 (preserve) | — | preserveIcc toggle is wired to state; worker no-ops in P4 (P5 honors) | unit | `node --experimental-strip-types src/tests/settings-icc.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | SC-2 | T-04-MEM | 50 PNG @ 2x → 150 FileEntries process under 800 MB peak heap | E2E + CDP | `npx playwright test src/tests/raster.spec.ts -g "memory budget"` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | SC-4 | T-04-LEAK | 20-file batch — every `createObjectURL` paired with `revokeObjectURL` | E2E | `npx playwright test src/tests/raster.spec.ts -g "no url leaks"` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | D-16 (collision) | — | `name@1x.png` collisions auto-suffix `(2)` + one toast per batch | unit + E2E | `node --experimental-strip-types src/tests/filename.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | D-13 (throttle toast) | — | first-throttle Sonner toast fires once per batch | E2E | `npx playwright test src/tests/raster.spec.ts -g "throttle toast"` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | N | D-15 (raster budget) | — | decode+resize+stub-encode on 2 MB PNG p50 ≤ 500 ms | E2E + perf | `npx playwright test src/tests/raster.spec.ts -g "perf budget"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Planner: replace `XX-XX` with concrete task IDs. Every row whose `File Exists` is `❌ W0` MUST have a Wave 0 task that creates the spec file/fixture before the task that depends on it.

---

## Wave 0 Requirements

- [ ] `src/tests/raster.spec.ts` — new Playwright spec covering SC-1, SC-2, SC-4, throttle toast, perf budget
- [ ] `src/tests/filename.test.ts` — unit tests for `applyDensitySuffix` (idempotence + collision suffix `(2)`)
- [ ] `src/tests/icc.test.ts` — parses optimized output bytes; asserts no `iCCP` chunk (PNG) / `APP2 ICC_PROFILE` marker (JPEG fixtures, if used)
- [ ] `src/tests/settings-icc.test.ts` — asserts `preserveIcc` toggle is wired to `useSettingsStore` state and persisted across reloads
- [ ] `src/tests/fixtures/density-2x.png` — 800×600 reference PNG (known pixel dims) for variant + suffix tests
- [ ] `src/tests/fixtures/with-icc.png` — PNG with embedded `iCCP` chunk for strip-by-default assertion
- [ ] `src/tests/instrument-heap.ts` — CDP heap-probe helper (`Memory.getDOMCounters` via `BrowserContext.newCDPSession()`) for SC-2
- [ ] Reuse `src/tests/instrument-blob-urls.ts` from Phase 2 plan 02-01 for SC-4 (no new file — verify exists)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backpressure StatusBar indicator visual | D-13 | Visual fidelity (icon vs badge vs progress) — automated would over-pin | Open dev server; load 50× 4MB PNG fixtures at 3x source / all-targets; observe StatusBar — indicator shows during throttle, clears post-batch; capture screenshot |
| First-throttle toast copy + dismiss | D-13 | Sonner UX timing | Same 50-file batch; verify exactly one info toast "Pacing batch for memory" appears; toast dismisses on click and auto-dismisses after default Sonner timeout |
| File row UI grouping for N-FileEntries-per-source | Claude's discretion (CONTEXT.md) | Layout ergonomics, density tradeoffs | Load 5 sources × 3 targets each; verify variant rows are visually grouped with parent source identifiable; confirm dense file row stays scannable |
| TweaksPanel "Resize / Variants" section | D-06 | Section placement is design judgment | Open TweaksPanel; locate new section; verify algorithm dropdown defaults to lanczos3 |
| Preserve ICC toggle copy + helper text | D-09 + D-10 amended | UX truthfulness about P4 no-op | Open TweaksPanel "Privacy"/"Metadata" section; confirm toggle off by default; helper text mentions "applies once encoders ship in v1.1" |

---

## Threat → Test Bindings

> Per `workflow.security_enforcement: true` (default). Each threat from PLAN.md `<threat_model>` blocks pairs to a test row above.

| Threat | Description | Mitigation Test |
|--------|-------------|-----------------|
| T-04-MEM | Memory exhaustion → tab crash on large batch | SC-2 row (CDP heap probe enforces 800 MB ceiling) |
| T-04-LEAK | Object-URL leak → unbounded memory growth across batches | SC-4 row (instrument-blob-urls helper diff) |
| T-04-META | Metadata (EXIF/GPS/IPTC) leaks to optimized output → privacy regression | OPT-06 strip row (icc.test.ts asserts no `iCCP`/`tEXt`/EXIF chunks) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
