---
phase: 9
slug: codec-encoders
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 |
| **Config file** | `playwright.config.ts` (root) |
| **Quick run command** | `npx playwright test src/tests/codec-encoders.spec.ts --project=chromium` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test src/tests/codec-encoders.spec.ts --project=chromium`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-XX-XX | TBD | TBD | ENC-01 | T-9-V5 / — | Empty buffer rejected before WASM dispatch (WR-02) | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "PNG"` | ❌ W0 | ⬜ pending |
| 9-XX-XX | TBD | TBD | ENC-02 | — | N/A | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "WebP"` | ❌ W0 | ⬜ pending |
| 9-XX-XX | TBD | TBD | ENC-03 | — | N/A | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "JPEG"` | ❌ W0 | ⬜ pending |
| 9-XX-XX | TBD | TBD | ENC-04 | T-9-AVIF / — | AVIF decode failure on Safari <16.4 caught → fallback (D-13) | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "AVIF"` | ❌ W0 | ⬜ pending |
| 9-XX-XX | TBD | TBD | ENC-05 | T-9-SVG / — | svgo text-transform only, no eval; DOMPurify available | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "SVG"` | ❌ W0 | ⬜ pending |
| 9-XX-XX | TBD | TBD | ENC-06 | — | Codec enum guarded by KNOWN_CODECS.has() | integration | `npx playwright test src/tests/codec-encoders.spec.ts -g "settings"` | ❌ W0 | ⬜ pending |
| 9-XX-XX | TBD | TBD | D-13 | T-9-V5 / — | Encode failure → per-file error state + original-bytes fallback | unit | `npx playwright test src/tests/codec-encoders.spec.ts -g "error"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are TBD until the planner assigns plan/wave numbers — execute-phase backfills them.*

---

## Wave 0 Requirements

- [ ] `src/tests/codec-encoders.spec.ts` — covers ENC-01..06 + D-13 (real small image buffers injected into the worker pool; assert `EncodeResult.buffer.byteLength > 0` and `optimizedSize < originalSize` for lossless codecs; SVG asserts valid XML + shorter than input)
- [ ] `src/tests/per-file-settings.spec.ts` — covers D-01/D-02/D-03 per-file settings store behavior

*Existing `worker-pipeline.spec.ts` covers PIPE-01..03 and stays green; extend it only if the real-bytes wiring changes observable pipeline behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live debounced re-encode visibly updates CompareStage/DeltaStrip while dragging a slider | ENC-06 (D-05/D-07) | Timing/visual feedback hard to assert deterministically; debounce window is perceptual | Select a file, drag the quality slider, confirm the before/after delta updates ~once per pause (not per keystroke) |
| AVIF unsupported-browser path (Safari <16.4) surfaces error state + keeps original bytes | ENC-04 (D-13) | Requires a real Safari <16.4 engine unavailable in CI matrix | Manually load in Safari <16.4 (or simulate decode throw), confirm sonner toast + file marked errored + batch still completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`codec-encoders.spec.ts`, `per-file-settings.spec.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
