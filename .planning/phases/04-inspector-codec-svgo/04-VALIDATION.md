---
phase: 4
slug: inspector-codec-svgo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `--experimental-strip-types` (TypeScript native, no Jest/Vitest) |
| **Config file** | none — run directly with node flag |
| **Quick run command** | `node --experimental-strip-types src/tests/settings.test.ts` |
| **Full suite command** | `node --experimental-strip-types src/tests/stores.test.ts && node --experimental-strip-types src/tests/settings.test.ts && node --experimental-strip-types src/tests/stub-data.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-strip-types src/tests/settings.test.ts`
- **After every plan wave:** Run full suite (stores + settings + stub-data tests)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-W0-01 | W0 | 0 | STORE-02 | — | N/A | unit | `node --experimental-strip-types src/tests/settings.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-01 | TBD | 1 | STORE-02 | — | N/A | unit | `node --experimental-strip-types src/tests/settings.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-02 | TBD | 1 | INSP-01 | — | N/A | unit | `node --experimental-strip-types src/tests/settings.test.ts` | ❌ W0 | ⬜ pending |
| 04-XX-03 | TBD | 2 | INSP-02 | — | N/A | visual/manual | browser verify | ❌ manual | ⬜ pending |
| 04-XX-04 | TBD | 2 | INSP-03 | — | N/A | visual/manual | browser verify | ❌ manual | ⬜ pending |
| 04-XX-05 | TBD | 2 | INSP-04 | — | N/A | visual/manual | browser verify | ❌ manual | ⬜ pending |
| 04-XX-06 | TBD | 2 | INSP-05 | — | N/A | visual/manual | browser verify | ❌ manual | ⬜ pending |
| 04-XX-07 | TBD | 2 | INSP-06 | — | N/A | visual/manual | browser verify | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/settings.test.ts` — stubs for STORE-02 (settingsAtom defaults + all actions + togglePlugin) and INSP-01 tab auto-switch logic

*Existing infrastructure covers stores.test.ts and stub-data.test.ts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Codec selector buttons render + lossless toggle hides for SVG | INSP-02 | Shadcn component rendering; no DOM testing setup | Open browser, select non-SVG file, verify codec row renders; select SVG file, verify lossless hidden |
| Quality/effort sliders move + conditional PNG palette / AVIF subsample segs | INSP-03 | Slider interaction requires browser | Open browser, drag quality slider, verify settingsAtom.q updates |
| Resize section toggle show/hide width/height inputs | INSP-04 | DOM show/hide interaction | Toggle "Resize on export", verify inputs appear/disappear |
| Metadata toggles update store | INSP-05 | Toggle interaction | Click strip EXIF toggle, verify settingsAtom.stripMeta flips |
| SvgoPanel 22 plugins grid renders + toggle state updates | INSP-06 | Grid render + toggle interaction | Open SVGO tab, count 22 plugin chips, click one, verify on/off state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
