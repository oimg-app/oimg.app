---
phase: 14
slug: installable-pwa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 (e2e) + Node `--experimental-strip-types` (unit) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test src/tests/foundation.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~60–90 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test src/tests/foundation.spec.ts` (smoke — confirms app still loads + crossOriginIsolated intact)
- **After every plan wave:** Run `npx playwright test` (full suite)
- **Before `/gsd:verify-work`:** Full suite green + manual Lighthouse PWA audit (score ≥ 80)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-00-xx | 00 | 0 | PWA-01 | — | maskable icon asset present | smoke | `test -f public/oimg-logo-maskable-512.png` | ❌ W0 | ⬜ pending |
| 14-01-xx | 01 | 1 | PWA-01 | — | manifest fields correct, no script injection in name | unit | `node --experimental-strip-types src/tests/manifest.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-xx | 02 | 1 | PWA-02 | T-14-COEP | SW preserves COOP/COEP on cached responses; wasm NOT precached | e2e | `npx playwright test src/tests/pwa.spec.ts` | ❌ W0 | ⬜ pending |
| 14-03-xx | 03 | 2 | PWA-03 | — | Install button renders only on `beforeinstallprompt`; hidden post-install | e2e | `npx playwright test src/tests/pwa.spec.ts` | ❌ W0 | ⬜ pending |
| 14-04-xx | 04 | 2 | PWA-04 | T-14-HDR | `_headers` preserves COOP/COEP; sw.js no-cache | manual/smoke | curl preview headers | — | ⬜ pending |
| 14-05-xx | 05 | 2 | PWA-05 | — | update toast on SW activation; no auto-reload data loss | e2e | `npx playwright test src/tests/pwa.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `public/oimg-logo-maskable-512.png` — required maskable icon asset; manifest invalid without it (Lighthouse maskable check)
- [ ] `src/tests/manifest.test.ts` — Node unit: parse generated manifest, assert name/short_name/icons/theme_color/display/start_url (PWA-01)
- [ ] `src/tests/pwa.spec.ts` — Playwright: offline second-load (PWA-02), install button on synthetic `beforeinstallprompt` (PWA-03), update toast on SW message (PWA-05)
- [ ] `src/types/pwa.d.ts` — ambient `virtual:pwa-register` declaration if vite-plugin-pwa types aren't auto-resolved

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse PWA "installable" + maskable + offline | PWA-01/02 | Needs prod build + Chrome Lighthouse engine | `npm run build && npm run preview`, run Lighthouse PWA audit, score ≥ 80, AVIF wasm absent from precache list |
| `_headers` served correctly on Cloudflare Pages | PWA-04 | Edge-served headers only verifiable post-deploy | `curl -I <preview-url>/sw.js` → `no-cache`; `/manifest.webmanifest` → `max-age=86400`; COOP/COEP still present |
| `crossOriginIsolated === true` with SW active | PWA-02 | SharedArrayBuffer/MT codecs depend on it surviving SW | DevTools console `crossOriginIsolated` after SW controls page; run an OxiPNG MT optimize |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
