---
phase: 16-ssim-quality-metric
plan: 01
title: Install ssim.js and wire build-time version constant into BUILD_VERSIONS
executed: 2026-07-19
tasks_completed: 3/3
requirements_partial: [MTR-01]
key-files:
  modified:
    - package.json
    - package-lock.json
    - vite.config.ts
    - src/types/globals.d.ts
    - src/lib/versions.ts
    - src/tests/versions.test.ts
commits:
  - 626e066 feat(phase-16): install ssim.js@3.5.0 as runtime dependency
  - 41cd58e feat(phase-16): wire ssim into VERSIONS, define, ambient globals, versions.ts
  - c041b57 test(phase-16): assert BUILD_VERSIONS.ssim is a semver string
---

# Phase 16 Plan 01: Install ssim.js and wire BUILD_VERSIONS.ssim — Summary

**One-liner:** Installed `ssim.js@3.5.0` (exact) and completed the Phase 13-carved build-time
version-injection slots so `BUILD_VERSIONS.ssim` returns `"3.5.0"` at runtime and `"0.0.0"`
sentinel outside Vite. Unblocks Wave 1 & 2 (metrics worker + hook + UI).

## What shipped

- **T-16-01-01** — `npm install ssim.js@3.5.0 --save-exact` added a top-level, zero-dependency runtime dependency. `npm ls ssim.js --depth=0` prints `ssim.js@3.5.0`; only `package.json` and `package-lock.json` changed.
- **T-16-01-02** — Replaced three Phase 13 reserved comment slots with real assignments:
  - `vite.config.ts:62` → `ssim: readVer('ssim.js'),` inside `VERSIONS`.
  - `vite.config.ts:148` → `__SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),` inside `define`.
  - `src/types/globals.d.ts:18` → uncommented `declare const __SSIM_VERSION__: string`. Phase 17 Butteraugli line remains commented.
  - `src/lib/versions.ts:26` → promoted `ssim?: string` to required `ssim: string`.
  - `src/lib/versions.ts:48` → assigned `ssim: typeof __SSIM_VERSION__ === 'string' ? __SSIM_VERSION__ : '0.0.0'`.
- **T-16-01-03** — Extended `src/tests/versions.test.ts` with three ssim assertions (string type, semver shape, runtime-branched fallback vs. inlined value). Went from 15 → 19 passed assertions.

## Files touched (all committed)

| File | Task | Change |
|------|------|--------|
| `package.json` | T-16-01-01 | Added `"ssim.js": "3.5.0"` to `dependencies` |
| `package-lock.json` | T-16-01-01 | Lockfile entry for ssim.js@3.5.0 (zero deps) |
| `vite.config.ts` | T-16-01-02 | +1 line in `VERSIONS`, +1 line in `define` |
| `src/types/globals.d.ts` | T-16-01-02 | Uncommented `declare const __SSIM_VERSION__: string` |
| `src/lib/versions.ts` | T-16-01-02 | `ssim` promoted to required + `BUILD_VERSIONS.ssim` populated |
| `src/tests/versions.test.ts` | T-16-01-03 | +3 assertions covering both fallback and inlined paths |

## Verification

| Command | Exit | Notes |
|---------|------|-------|
| `node -e "console.log(require('./package.json').dependencies['ssim.js'])"` | 0 | prints `3.5.0` |
| `node -e "console.log(require('./node_modules/ssim.js/package.json').version)"` | 0 | prints `3.5.0` |
| `npm ls ssim.js --depth=0` | 0 | `ssim.js@3.5.0` at top-level, zero children |
| `./node_modules/.bin/vite build` | 0 | Bundle inlines `"3.5.0"` and eliminates the `__SSIM_VERSION__` identifier (verified via `grep -c __SSIM_VERSION__ dist/assets/index-*.js` → 0) |
| `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/versions.test.ts` | 0 | 19 passed / 0 failed |
| `npx tsc -b` | non-zero | 11 baseline errors, all `stageBg` missing from `UiState` in `src/tests/stores.test.ts` — pre-existing debt (see CLAUDE.md), none touch `__SSIM_VERSION__` or `BuildVersions.ssim` |

## Deviations from plan

**None.** All three tasks executed exactly as written. No Rule 1/2/3 auto-fixes triggered.

## Gotcha (for future waves)

The existing `stores.test.ts` `stageBg` baseline debt means `npm run build` (`tsc -b && vite build`)
will exit non-zero on the tsc gate before ever running vite build. Wave 1/2 tasks that need
to verify vite output must invoke `./node_modules/.bin/vite build` directly (as done here).
The plan's acceptance criterion is satisfied by "no NEW type errors involving `__SSIM_VERSION__`
or `BuildVersions.ssim`" — confirmed.

## Threat Flags

None. No new network surface, auth path, file-access pattern, or schema change introduced.
Build-time `readVer('ssim.js')` inherits the T-13-02 mitigation (only reads
`node_modules/<pkg>/package.json` `.version` field).

## Self-Check: PASSED

- `package.json` dependencies show `"ssim.js": "3.5.0"` — FOUND
- `node_modules/ssim.js/package.json` version = `3.5.0` — FOUND
- Commit `626e066` (T-16-01-01) — FOUND in `git log`
- Commit `41cd58e` (T-16-01-02) — FOUND in `git log`
- Commit `c041b57` (T-16-01-03) — FOUND in `git log`
- vite build inlines `"3.5.0"` into `dist/assets/index-*.js` — FOUND
- `__SSIM_VERSION__` identifier absent from dist bundle — CONFIRMED
