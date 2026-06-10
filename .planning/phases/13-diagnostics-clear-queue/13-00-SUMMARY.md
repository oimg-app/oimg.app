---
phase: 13
plan: 00
subsystem: types
tags: [phase-13, wave-0, globals, ambient-declarations, DIA-01]
requires: []
provides:
  - "Ambient declarations __SVGO_VERSION__ + __JSQUASH_VERSIONS__ for all src/**/* consumers"
affects:
  - "src/lib/versions.ts (Plan 01 consumer — typed wrapper around the globals)"
  - "vite.config.ts (Plan 02 producer — define block injects the literals)"
tech-stack:
  added: []
  patterns:
    - "single-purpose ambient .d.ts (analog: src/vite-env.d.ts)"
key-files:
  created:
    - src/types/globals.d.ts
  modified: []
decisions:
  - "Adopted ambient declare const (no export {} module-mode) to keep the names truly global"
  - "Reserved Phase 16/17 hooks as commented declarations so the next milestone is a single-file append"
  - "Skipped tsconfig.app.json edit — include: [\"src\"] already covers src/types/**/*.d.ts auto-pickup"
metrics:
  duration: "~3 minutes"
  completed: "2026-06-10"
---

# Phase 13 Plan 00: Ambient Globals for Vite `define` — Summary

**One-liner:** Ships `src/types/globals.d.ts` with ambient `declare const` declarations for `__SVGO_VERSION__` (string) and `__JSQUASH_VERSIONS__` (six-codec map) so Wave 1 plans that reference these Vite-injected literals compile without TS errors.

## What Shipped

- **`src/types/globals.d.ts`** (20 lines, zero runtime emission):
  - `declare const __SVGO_VERSION__: string`
  - `declare const __JSQUASH_VERSIONS__: { webp; jpeg; avif; oxipng; png; resize: string }`
  - Header comment cites Phase 13 Wave 0 + DIA-01 + consumer link (`src/lib/versions.ts`) + the `typeof X === 'string'` safe-fallback rule for non-Vite runtimes
  - Phase 16 / Phase 17 hook lines commented out for the next milestone's single-file append

## Verification

| Check | Result |
|-------|--------|
| `test -f src/types/globals.d.ts` | PASS |
| Contains literal `__SVGO_VERSION__` | PASS |
| Contains literal `__JSQUASH_VERSIONS__` | PASS |
| All six codec keys present (`webp jpeg avif oxipng png resize`) | PASS (6/6) |
| Zero `export ` statements (ambient mode preserved) | PASS (0 matches) |
| Phase 16 / Phase 17 forward-hook comments present | PASS (both literals found) |
| `./node_modules/.bin/tsc -b` exits 0 | PASS (EXIT_CODE=0) |

## Commits

| Hash | Message |
|------|---------|
| `1ee3181` | `chore(13-00): add ambient declarations for Vite define globals` |

## Deviations from Plan

None — plan executed exactly as written. The pre-task tsconfig.app.json check confirmed `include: ["src"]` already covers `src/types/**/*.d.ts`, so no tsconfig escalation was needed.

**Note on tooling:** The system PATH `tsc` (`/usr/local/bin/tsc`, v11.12.1) is not real TypeScript — it errors on `moduleResolution: bundler` and other modern options. The correct binary is `./node_modules/.bin/tsc` (or `npx tsc -b` after npm prepares the bin). Verification used the direct local path. Carry-forward note for Plans 01/03: prefer `npm run typecheck` (if present) or `./node_modules/.bin/tsc -b` over bare `tsc`.

## Carry-Forward Notes for Wave 1

- **Plan 01 (`src/lib/versions.ts`)** can now reference `__SVGO_VERSION__` and `__JSQUASH_VERSIONS__` as documented in PATTERNS lines 86-113 — the typed wrapper module pattern with `typeof X === 'string'` safe-fallback. The fallback path is required for Node unit tests (`--experimental-strip-types`) where Vite `define` does not run.
- **Plan 02 (`vite.config.ts`)** must inject the matching literals via `define: { __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo), __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash) }`. The shape of `VERSIONS.jsquash` MUST match the six-key declaration in `globals.d.ts` exactly (`webp jpeg avif oxipng png resize`) or `tsc -b` will catch the mismatch.
- **Plan 03 (atom reshape + StatusBar)** is unblocked from the type-system side — once Plan 01 lands `BUILD_VERSIONS`, the new `runtimeAtom.versions` field types check cleanly.
- **Phase 16/17 future-append:** Uncomment the two reserved lines (`__SSIM_VERSION__`, `__BUTTERAUGLI_BUILD__`) and add a matching `define` entry — no atom-shape churn, single-file diff per global.

## Threat Flags

None. This plan introduces no runtime code path and no new trust boundary. T-13-02 (Information Disclosure via define literal substitution) is mitigated as planned — only the two scoped version globals are declared; no `process.env.*` leakage into ambient scope.

## Self-Check: PASSED

- `src/types/globals.d.ts` exists (verified via `test -f`)
- Commit `1ee3181` exists on `main` (verified via `git rev-parse --short HEAD`)
- `./node_modules/.bin/tsc -b` exits 0 with no errors
- Acceptance criteria: 7/7 PASS
