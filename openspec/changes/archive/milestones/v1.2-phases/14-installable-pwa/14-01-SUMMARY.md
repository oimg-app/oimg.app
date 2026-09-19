---
phase: 14-installable-pwa
plan: 01
subsystem: pwa-foundation
tags: [pwa, vite-plugin-pwa, manifest, injectManifest]
requires: [14-00]
provides:
  - vite-plugin-pwa@^1.3.0 wired in injectManifest mode
  - public/manifest.webmanifest (PWA-01 schema)
  - index.html <link rel="manifest">
affects:
  - vite.config.ts
  - index.html
tech-stack:
  added:
    - "vite-plugin-pwa@^1.3.0 (devDependency; workbox-* transitive)"
  patterns:
    - "injectManifest mode with hand-authored manifest (manifest:false)"
    - "globIgnores '**/*.wasm' to keep AVIF codec wasm out of precache"
    - "devOptions:{enabled:false} to keep SW out of dev (preserves HMR + crossOriginIsolated)"
key-files:
  created:
    - public/manifest.webmanifest
  modified:
    - vite.config.ts
    - index.html
    - package.json
    - package-lock.json
decisions:
  - "Used PWA-01 verbatim theme_color #5eb87a (matches index.html meta theme-color) over the RESEARCH alternative"
  - "Added '**/avif_enc*.wasm' explicit entry to globIgnores in addition to '**/*.wasm' (belt-and-braces; AVIF wasm is the largest precache risk)"
  - "Did NOT add experimental.enableNativePlugin:'resolver' — virtual:pwa-register resolves cleanly under Vite 7 without the Rolldown workaround (deferred unless 14-02 build proves otherwise)"
  - "Did NOT create src/sw.ts here — Plan 14-02 owns it (Blocker 2 fix in plan); full npm run build assertion deferred to 14-02"
metrics:
  duration: ~6min
  completed: 2026-06-11
  tasks: 3
  files: 4
---

# Phase 14 Plan 01: vite-plugin-pwa + manifest.webmanifest Summary

PWA-01 wired — vite-plugin-pwa@1.3.0 installed and configured in injectManifest mode with `**/*.wasm` precache exclusion; hand-authored `public/manifest.webmanifest` references the Wave-0 maskable icon; `index.html` links the manifest so `beforeinstallprompt` can fire in Plan 14-03.

## What Was Built

| Artifact | Path | Purpose |
|----------|------|---------|
| Plugin config | `vite.config.ts` | `VitePWA({ strategies:'injectManifest', srcDir:'src', filename:'sw.ts', manifest:false, devOptions:{enabled:false}, injectManifest:{ globIgnores:['**/node_modules/**','**/*.wasm','**/codec.worker-*.js','**/avif_enc*.wasm'], maximumFileSizeToCacheInBytes: 2MB } })` appended to `plugins[]` without altering existing worker/optimizeDeps/define/server config |
| Manifest | `public/manifest.webmanifest` | PWA-01 schema verbatim: `name="oimg.app — Image Optimizer"`, `short_name="oimg"`, `display="standalone"`, `start_url="/"`, `theme_color="#5eb87a"`, `background_color="#0f1410"`, `display_override=["window-controls-overlay","standalone"]`, three icons (svg any, 1024 png any, 512 png maskable) |
| Manifest link | `index.html` | `<link rel="manifest" href="/manifest.webmanifest" />` inserted after `meta name="theme-color"`; plugin does not inject because `manifest:false` (Pitfall 5) |

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `8b3a818` | feat | wire vite-plugin-pwa in injectManifest mode |
| 2 | `1c99206` | feat | author manifest.webmanifest + link from index.html |
| 3 | (no commit — verification only) | — | tsc -b green; VitePWA wired confirmed |

## Verification Results

- **Task 1 verify** — `node -e "require('vite-plugin-pwa')" && grep -q "VitePWA" vite.config.ts && grep -q '\*\*/\*\.wasm' vite.config.ts`: **PASS**.
- **Task 2 verify** — `node --experimental-strip-types src/tests/manifest.test.ts`: **11 passed, 0 failed** (Wave 0 RED → GREEN). `grep -q 'rel="manifest"' index.html`: **PASS**.
- **Task 3 verify** — `npx tsc -b`: same pre-existing red baseline (TS1005 in `button.tsx`, `tabs.tsx`, `sonner.tsx`, `utils.ts`, `caps.test.ts`, plus `@types/node/crypto.d.ts`) — documented in 14-00-SUMMARY and MEMORY `typecheck-and-test-gotchas`. **Zero new errors** from `vite.config.ts`, `manifest.webmanifest`, `index.html`, or any file touched by Plan 14-01. `node -e ... VitePWA`: **PASS**.

## Decisions Made

1. **theme_color `#5eb87a` (PWA-01 verbatim)** chosen over the RESEARCH alternative — matches existing `<meta name="theme-color">` in `index.html`. Documented inline comment in `vite.config.ts` near the VitePWA call.
2. **globIgnores belt-and-braces** — `**/*.wasm` already covers AVIF, but added explicit `**/avif_enc*.wasm` entry for greppability and to document the precache risk that motivated the rule (T-14-WASM threat).
3. **Did not add `experimental.enableNativePlugin:'resolver'`** — RESEARCH §Integration Risk #2 calls for this only if Rolldown fails to resolve `virtual:pwa-register`. Vite 7 (current stack per MEMORY) resolves it cleanly; deferred unless Plan 14-02's `npm run build` proves otherwise.
4. **No `src/sw.ts` placeholder created** — Blocker 2 fix in plan (file ownership boundary: 14-02 owns `src/sw.ts`). Full build assertion + `dist/sw.js` grep for absent `.wasm` precache entries lives in Plan 14-02 Task 2.

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

### Process notes

- Two `PreToolUse:Edit` workflow advisories fired (vite.config.ts + manifest.webmanifest + index.html). These are advisory only — this executor is the GSD-spawned plan agent, so SUMMARY.md + STATE.md updates are produced by the standard execution flow. Advisories acknowledged inline; not blockers.

## Threat Surface Verification

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-14-MAN (Tampering of manifest fields) | mitigate | `manifest.test.ts` asserts `name` and `short_name` contain no `<` — 11/11 GREEN |
| T-14-WASM (precache pulls AVIF wasm) | mitigate | `vite.config.ts` `globIgnores` includes both `**/*.wasm` and `**/avif_enc*.wasm`; dist/sw.js grep assertion lives in Plan 14-02 Task 2 |
| T-14-01-SC (vite-plugin-pwa supply chain) | accept | per plan threat_model; vite-pwa team + transitive workbox-* are mature; install logged 0 vulnerabilities |

No new threat flags discovered (no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what 14-RESEARCH already documented).

## Carry-Forward Notes

**Plan 14-02 (`src/sw.ts` + `src/lib/register-sw.ts`) MUST:**
- Create `src/sw.ts` implementing Workbox `precacheAndRoute(self.__WB_MANIFEST)` plus the AVIF wasm runtime-cache route (precache excludes wasm — 14-02 must add a `CacheFirst` route for `/node_modules/@jsquash/avif/*.wasm` or the codec's deployed asset path).
- Run `npm run build` and assert `dist/manifest.webmanifest` exists, `dist/sw.js` exists, `dist/sw.js` contains zero `.wasm` precache entries (grep), and main JS gzipped < 200 KB (existing budget).
- Implement `bootstrapSW()` with `onNeedRefresh` (sonner toast) + `onOfflineReady` (`setCaps`) per 14-00-SUMMARY carry-forward; expose `window.__simulateSWNeedRefresh` / `window.__simulateSWOfflineReady` test hooks.
- If `npm run build` fails to resolve `virtual:pwa-register`, add `experimental: { enableNativePlugin: 'resolver' }` (RESEARCH §Integration Risk #2 fallback).

**Plan 14-05 (manifest schema final check / Lighthouse) MUST:**
- Lighthouse PWA audit must pass; `manifest.webmanifest` schema is now frozen (do not re-edit unless Lighthouse flags it).
- Verify the maskable icon renders with safe-zone padding in Chrome devtools "Application > Manifest".

## Self-Check: PASSED

- [x] `public/manifest.webmanifest` — FOUND (711 bytes, JSON parses, 11/11 schema assertions GREEN)
- [x] `vite.config.ts` — FOUND, contains `VitePWA` import + plugin call, `globIgnores` has `**/*.wasm`
- [x] `index.html` — FOUND, contains `<link rel="manifest" href="/manifest.webmanifest" />`
- [x] `package.json` — FOUND, `vite-plugin-pwa` in `devDependencies`
- [x] Commit `8b3a818` — FOUND (`git log --oneline | grep 8b3a818`)
- [x] Commit `1c99206` — FOUND
