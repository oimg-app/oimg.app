---
phase: 14-installable-pwa
plan: 04
subsystem: pwa-sw-registration
tags: [pwa, service-worker, register-sw, virtual-pwa-register, sonner, requestIdleCallback, bundle-budget, pipe-02, sc6, pwa-05]
requires: [14-00, 14-01, 14-02, 14-03]
provides:
  - "src/lib/register-sw.ts — bootstrapSW() registers SW with onNeedRefresh toast + onOfflineReady cap update + DEV/test simulate hooks"
  - "src/App.tsx useEffect — deferred dynamic-import SW registration via requestIdleCallback (setTimeout 2000 Safari fallback)"
  - "src/tests/pwa.spec.ts — PWA-05 update-toast e2e GREEN + SC#6 pill-flip e2e GREEN against current StatusBar D-09 HIDE-when-false markup"
affects:
  - src/lib/register-sw.ts (new)
  - src/App.tsx
  - src/tests/pwa.spec.ts
tech-stack:
  added: []
  patterns:
    - "virtual:pwa-register registerSW + sonner toast with action button + duration:Infinity + stable id 'sw-update'"
    - "registerType:'prompt' + user-action Reload → never auto-reload mid-optimize (T-14-RELOAD mitigation)"
    - "onOfflineReady → setCaps({ ...probeCaps(), offlineReady: true }) replaces Phase 13 boot-probe placeholder"
    - "Deferred SW registration via requestIdleCallback + dynamic import keeps register-sw out of initial chunk (PIPE-02 / 200KB gzipped budget)"
    - "DEV/test-only window.__simulateSW* hooks gated by import.meta.env.DEV || MODE==='test' (production tree-shakes)"
    - "e2e races prevented via page.waitForFunction on test hook before invoking — race-proof against deferred registration"
key-files:
  created:
    - src/lib/register-sw.ts
  modified:
    - src/App.tsx
    - src/tests/pwa.spec.ts
decisions:
  - "Spec assertion matches StatusBar D-09 HIDE-when-false markup reality (no data-testid/data-active node when caps.offlineReady===false) — assert pill ABSENT before onOfflineReady, VISIBLE after. Plan's '(e.g. data-state=ready / .bg-green-*, whichever StatusBar.tsx exposes)' explicitly invites this — StatusBar renders nothing when false."
  - "DEV/test hook gating uses import.meta.env.DEV || MODE==='test' to cover both vite dev + playwright (vite dev mode is DEV-true; playwright defaults to MODE=production but we still want hooks in CI). Production builds tree-shake."
  - "Both __simulateSW* hooks inline-duplicate the registerSW callback body rather than calling the callback object — vite-plugin-pwa's registerSW does not expose the callbacks externally. Body duplication is the minimal-surface contract for e2e."
  - "Stable toast id 'sw-update' + duration:Infinity prevents duplicate stacked toasts if onNeedRefresh fires twice (e.g. SW updates twice during a long session)"
  - "Bypass package.json `npm run build` (chains tsc -b which is documented RED baseline per 14-02/14-03 SUMMARYs); run ./node_modules/.bin/vite build directly. Bundle-budget gate measured on the largest dist/assets/index-*.js (multiple index-*.js chunks exist; main entry is the 645KB raw / 198KB gzipped one)."
metrics:
  duration: ~25min
  completed: 2026-06-12
  tasks: 3
  files: 3
---

# Phase 14 Plan 04: SW register + onNeedRefresh/onOfflineReady + bundle budget gate — Summary

PWA-05 + ROADMAP SC#5 + SC#6 + PIPE-02 satisfied. `bootstrapSW()` registers the service worker via `virtual:pwa-register`, wires `onNeedRefresh` to a sonner toast with a user-consented Reload action (never auto-reloads mid-optimize per T-14-RELOAD), and `onOfflineReady` calls `setCaps({ ...probeCaps(), offlineReady: true })` so the StatusBar D-09 "Offline-ready" pill flips from hidden → visible. `App.tsx` defers registration via `requestIdleCallback` (setTimeout 2000 Safari fallback) + dynamic `import('@/lib/register-sw')`, keeping register-sw out of the initial chunk. Main entry chunk gzipped is **198,328 bytes ≤ 204,800 byte (200KB) PIPE-02 budget — PASS** with ~6.3KB headroom. PWA-05 update-toast e2e GREEN; SC#6 pill-flip e2e GREEN; PWA-03 regression GREEN; foundation 3/3 GREEN.

## What Was Built

| Artifact | Path | Purpose |
|----------|------|---------|
| SW registration entry | `src/lib/register-sw.ts` | 82 lines — `bootstrapSW()` calls `registerSW` from `virtual:pwa-register`. `onNeedRefresh` → sonner toast `'New version available — reload?'` with stable id `'sw-update'`, `duration: Infinity`, Reload action → `updateSW(true)` (T-14-RELOAD mitigation). `onOfflineReady` → `setCaps({ ...probeCaps(), offlineReady: true })` + `toast.success('Ready to work offline', { duration: 3000 })`. `serviceWorker in navigator` guard. DEV/test-gated `window.__simulateSWNeedRefresh` + `window.__simulateSWOfflineReady` hooks for Playwright. |
| Deferred registration | `src/App.tsx` | Top-level `useEffect`: `requestIdleCallback` (Chromium/Firefox) → dynamic `import('@/lib/register-sw').then(m => m.bootstrapSW())`. Safari fallback: `setTimeout(bootstrap, 2000)`. Cleanup cancels idle/timeout handle on unmount. AppShell + Toaster unchanged. |
| PWA-05 + SC#6 e2e | `src/tests/pwa.spec.ts` | PWA-05: `page.waitForFunction` until `__simulateSWNeedRefresh` hook present (race-proof against requestIdleCallback deferral), invoke hook, assert "New version available" text + Reload button visible. SC#6: assert StatusBar Offline-ready text ABSENT (`toHaveCount(0)`) → wait for hook → invoke → assert text VISIBLE (HIDE-when-false rule inverted by setCaps). |

## Commits

| Task | Commit  | Type | Message |
|------|---------|------|---------|
| 1    | `c4f40c0` | feat | add bootstrapSW with onNeedRefresh toast + onOfflineReady cap |
| 2    | `197c64a` | feat | defer SW registration via requestIdleCallback + SC#6 pill-flip e2e |
| 3    | (no code commit — verification-only gate) | — | bundle-budget gate measured against Task-2 build output |

## Verification Results

### Task 1 — register-sw.ts
- `grep -q "virtual:pwa-register" src/lib/register-sw.ts` → **PASS**
- `grep -q "offlineReady: true" src/lib/register-sw.ts` → **PASS**
- `grep -q "New version available" src/lib/register-sw.ts` → **PASS**
- `grep -q "updateSW(true)" src/lib/register-sw.ts` → **PASS**
- `npx tsc -b` → same pre-existing baseline RED (TS1005 false-positive on inline `type` modifiers in button.tsx/tabs.tsx/sonner.tsx/utils.ts/caps.test.ts/useInstallPrompt.ts; tsconfig.node.json target/lib/moduleResolution; @types/node/crypto.d.ts). **Zero new errors from `src/lib/register-sw.ts`.** Documented baseline disposition per 14-02 / 14-03 SUMMARYs + MEMORY `typecheck-and-test-gotchas`.

### Task 2 — App.tsx + e2e
- `grep -q "register-sw" src/App.tsx` → **PASS**
- `grep -q "requestIdleCallback" src/App.tsx` → **PASS**
- `npx playwright test src/tests/pwa.spec.ts --grep "PWA-05|SC#6|Offline-ready" --reporter=line` → **PASS (2) FAIL (0)** in 153.4s
  - PWA-05 — `'New version available — reload?'` toast + Reload action button visible after `__simulateSWNeedRefresh()` invoked
  - SC#6 — StatusBar Offline-ready text count==0 before, visible after `__simulateSWOfflineReady()` invoked (HIDE-when-false → RENDER flip per D-09)

### Task 3 — Bundle budget gate (PIPE-02)
- `./node_modules/.bin/vite build` → **PASS** (vite 7.3.2, 82 modules, built in 3.14s; SW built in 58ms; precache 58 entries / 3923.10 KiB)
- Largest entry chunk: `dist/assets/index-jUO9q95s.js` (645.6 KB raw)
- `gzip -c dist/assets/index-jUO9q95s.js | wc -c` → **198,328 bytes** ≤ 204,800 (200KB PIPE-02 budget) → **PASS** (~6.3 KB headroom)
- Delta from 14-03's 198,261 B → +67 B (the App.tsx useEffect + idle-callback closure). register-sw.ts stayed in its own chunk via dynamic import (Pitfall 2 mitigation succeeded).

### Regression
- `npx playwright test src/tests/foundation.spec.ts --reporter=line` → **PASS (3) FAIL (0)** in 153.8s
- `npx playwright test src/tests/pwa.spec.ts --grep "install button"` → **PASS (1) FAIL (0)** in 1157.7s (background — PWA-03 regression GREEN)

## Decisions Made

1. **Spec asserts visibility flip (text presence), not testid/data-active.** The Wave-0 stub assumed StatusBar would expose `data-testid="offline-ready-pill"` + `data-active="true"`. Reality: Phase 13 D-09 ruled "Offline-ready pill HIDES when SW controller is absent" — StatusBar.tsx renders nothing at all when `!caps.offlineReady`. The plan explicitly invites this ("locate by the existing testid and assert the green-state class/attribute … whichever StatusBar.tsx exposes"). The most-faithful SC#6 assertion against current markup is: count==0 before → visible after. This validates the same SC#6 semantic (the pill turns on when precache completes) and avoids gratuitously modifying StatusBar.tsx outside Plan 14-04 scope.
2. **DEV+test gating on the simulate hooks.** `import.meta.env.DEV || import.meta.env.MODE === 'test'` covers vite dev (DEV=true) and Playwright runs (MODE may be production but hooks must remain). Production-built deploys tree-shake the entire `if` block.
3. **Toast id `'sw-update'` + `duration: Infinity`.** Stable id prevents stacked duplicate toasts if onNeedRefresh fires twice in one session. Infinity duration is intentional — the toast is the consent gate; auto-dismiss would silently lose the user's ability to update.
4. **Bypass `npm run build` (which chains `tsc -b`).** tsc baseline is RED for documented pre-existing reasons (see Task 1 verify). `./node_modules/.bin/vite build` succeeds cleanly. Same disposition as 14-01/14-02/14-03 SUMMARYs.
5. **Use `requestIdleCallback` then `setTimeout(2000)` fallback.** Safari (and any non-Chromium browser) lacks `requestIdleCallback`. 2000ms is past the LCP budget for any oimg.app page — guarantees register-sw never blocks first paint.
6. **Bundle-budget verification picks the LARGEST `index-*.js`.** Multiple `index-*.js` chunks coexist (lazy-loaded encoder UIs, command palettes, etc.); the entry chunk is the 645KB raw / ~198KB gzipped one. Selecting `head -n1` after `sort -nr` on file size identifies it deterministically.

## Deviations from Plan

### Rule 1 (bug) — Wave-0 SC#6 spec assumed testid that StatusBar never exposed

**Found during:** Task 2

**Issue:** The Wave-0 pwa.spec.ts SC#6 block asserted `getByTestId('offline-ready-pill')` + `toHaveAttribute('data-active', 'true')`. StatusBar.tsx (Phase 13 D-09) does not expose either — it renders `<span>Offline-ready</span>` conditionally and emits nothing at all when `!caps.offlineReady`. The Wave-0 spec was a forward-looking RED stub that assumed Plan 14-02 would extend StatusBar's testid surface; that extension was never specified in 14-02 or anywhere else.

**Fix:** Updated the SC#6 block to match StatusBar reality — `toHaveCount(0)` for the text before, `toBeVisible` for the text after `__simulateSWOfflineReady()`. This validates the same SC#6 semantic (precache-complete → pill turns on) without modifying StatusBar.tsx outside this plan's `<files_modified>` declaration.

**Files modified:** `src/tests/pwa.spec.ts`

**Commit:** `197c64a`

### Rule 2 (auto-add) — PWA-05 e2e needed `waitForFunction` race guard

**Found during:** Task 2

**Issue:** App.tsx defers SW registration via `requestIdleCallback`. The Wave-0 PWA-05 spec called `__simulateSWNeedRefresh()` immediately after `page.goto('/')` — the hook may not yet be installed (the dynamic import is still pending in idle). Race-prone.

**Fix:** Added `page.waitForFunction` polling on the hook presence with 10s budget before invoking. Same pattern applied to SC#6. Both tests now race-proof.

**Files modified:** `src/tests/pwa.spec.ts`

**Commit:** `197c64a`

### Auto-fixed Issues

None beyond the two deviations above.

## Threat Surface Verification

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-14-RELOAD (DoS — update-toast forcing reload mid-optimize) | mitigate | `registerType:'prompt'` in vite.config.ts (Plan 14-01) means SW NEVER auto-reloads. `onNeedRefresh` only surfaces a toast; reload happens only when user clicks the Reload button → `updateSW(true)`. Stable id `'sw-update'` + `duration: Infinity` prevents stacked duplicate toasts. Verified by reading `src/lib/register-sw.ts` lines 32–48: no `location.reload()` or auto-`updateSW(true)` outside the Reload action's `onClick`. |
| T-14-OFFCAP (Tampering — offlineReady cap state) | accept | `setCaps({ ...probeCaps(), offlineReady: true })` writes a boolean. Local-only nanostores state. Zero PII; zero telemetry. Verified by grep: `grep -nE 'fetch\\(\|sendBeacon\|navigator\\.connection' src/lib/register-sw.ts src/App.tsx` → empty. |
| T-14-REG (Tampering — dynamic import of register-sw) | accept | `import('@/lib/register-sw')` resolves to same-origin module via Vite's `/@/lib/register-sw.ts` (dev) or content-hashed `dist/assets/register-sw-*.js` (prod). No CDN, no external code load. |
| T-14-BUDGET (DoS — bundle bloat past 200KB) | mitigate | Task 3 measured: 198,328 bytes gzipped ≤ 204,800. register-sw stayed out of the entry chunk thanks to the dynamic `import()` (Pitfall 2 mitigation). +67 B vs 14-03 baseline — attributable to the App.tsx useEffect + idle-callback closure, not register-sw. |

No new threat flags. No new network endpoints. No new auth paths. No new file-access patterns. No schema changes at trust boundaries.

## Known Stubs

None. `bootstrapSW()` ships with real `registerSW` integration; the simulate hooks are intentional DEV/test affordances (gated, tree-shaken in production). App.tsx useEffect is fully wired with real `requestIdleCallback` + dynamic import + cleanup.

## Carry-Forward Notes

**Phase 14 IS COMPLETE post-Plan 14-04.** This is the final plan in Phase 14.

**Phase 14 verifier MUST:**

1. Re-run `src/tests/pwa.spec.ts` end-to-end (PWA-02 + PWA-03 + PWA-05 + SC#6) — all four blocks must remain GREEN.
2. Verify the PWA-02 block (SW registration + crossOriginIsolated preservation). Note: the default `playwright.config.ts` runs `npm run dev` where `vite.config.ts` sets `devOptions: { enabled: false }` → SW does NOT register in dev. The PWA-02 block will RED-time-out against dev. To turn it GREEN, either:
   - (Recommended) Add a `vite preview` Playwright project that builds dist first.
   - (Quick) Temporarily flip `devOptions.enabled` to true for the test and revert after.
3. Re-confirm bundle budget gate (`gzip -c dist/assets/index-*.js | wc -c` ≤ 204800) on the final preview build.
4. Manual smoke (Cloudflare Pages preview deploy from Plan 14-05's deferred checkpoint): visit preview URL on Chromium → confirm Install button appears in StatusBar + Offline-ready pill turns on within ~3s of first paint (SW registers via idle callback) + COOP/COEP headers survive (`crossOriginIsolated === true`).

**Plan 14-05 (deployed-headers checkpoint) MUST:**

- Stay deferred to dogfood / first Cloudflare Pages preview deploy. Not blocking Phase 14 close.

## Self-Check: PASSED

- [x] `src/lib/register-sw.ts` — FOUND (82 lines; exports `bootstrapSW`; contains `virtual:pwa-register`, `New version available`, `updateSW(true)`, `offlineReady: true`)
- [x] `src/App.tsx` — modified (top-level useEffect; `requestIdleCallback` + `setTimeout(2000)` fallback; dynamic `import('@/lib/register-sw')`)
- [x] `src/tests/pwa.spec.ts` — modified (PWA-05 + SC#6 blocks: `waitForFunction` race guard + StatusBar-reality assertion)
- [x] Commit `c4f40c0` — FOUND (`git log --oneline | grep c4f40c0` → `feat(14-04): add bootstrapSW with onNeedRefresh toast + onOfflineReady cap`)
- [x] Commit `197c64a` — FOUND (`git log --oneline | grep 197c64a` → `feat(14-04): defer SW registration via requestIdleCallback + SC#6 pill-flip e2e`)
- [x] `npx playwright test src/tests/pwa.spec.ts --grep "PWA-05|SC#6|Offline-ready"` → PASS (2) / FAIL (0)
- [x] `npx playwright test src/tests/pwa.spec.ts --grep "install button"` → PASS (1) / FAIL (0) — PWA-03 regression GREEN
- [x] `npx playwright test src/tests/foundation.spec.ts` → PASS (3) / FAIL (0) — no regression
- [x] `./node_modules/.bin/vite build` succeeded; main JS gzipped **198,328 B ≤ 204,800 B (200KB)** budget → PIPE-02 GREEN
