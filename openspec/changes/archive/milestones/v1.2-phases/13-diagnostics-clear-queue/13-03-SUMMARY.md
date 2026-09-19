---
phase: 13
plan: 03
subsystem: runtime-atom-and-status-shell
tags: [phase-13, wave-1, atom-reshape, statusbar, main, DIA-01, DIA-02, DIA-03]
requirements: [DIA-01, DIA-02, DIA-03]

dependency-graph:
  requires:
    - 13-01-SUMMARY.md (BUILD_VERSIONS from src/lib/versions.ts)
    - 13-02-SUMMARY.md (probeCaps() + Caps interface from src/lib/caps.ts)
  provides:
    - "runtimeAtom.versions + runtimeAtom.caps live state (Wave 2 consumers)"
    - "setCaps(c) atomic setter for boot-time + future SW-precache wiring"
    - "StatusBar reads live versions + offline-ready conditional render"
  affects:
    - 13-04-PLAN.md (Toolbar Diagnostics tab — reads same atom shape)
    - 13-07-PLAN.md (Diagnostics tab consumes versions + caps verbatim)
    - 14-PWA-02 (will replace caps.offlineReady placeholder with precacheComplete)
    - 16-* (versions.ssim hook already typed)
    - 17-* (versions.butteraugli.buildHash hook already typed)

tech-stack:
  added: []
  patterns:
    - "Structured atom field (versions: typeof BUILD_VERSIONS) — single source of truth replaces three hardcoded strings"
    - "Pre-render side-effect for capability probing (D-04) — mirrors COI guard placement"
    - "Conditional pill render (D-09 HIDE-not-show) — never displays stale status"
    - "Derived-string-in-JSX (D-07 wasmStr ternary) — derive from caps; no extra atom field"
    - "Static-source fallback in shape tests — graceful when @/ alias unresolvable under bare Node"

key-files:
  created:
    - src/tests/runtime-shape.test.ts
    - src/tests/statusbar-versions.spec.ts
  modified:
    - src/stores/runtime.ts
    - src/components/shell/StatusBar.tsx
    - src/main.tsx
    - src/tests/stores.test.ts

decisions:
  - "Bundled Tasks 1+2 into ONE commit (878925c) per PATTERNS CRITICAL RISK #1 — splitting them would cause mid-wave npm run build red between commits."
  - "runtime-shape.test.ts uses static-source fallback when @/ alias unresolvable under Node — matches stores.test.ts Wave-0-stub convention while still enforcing the shape contract."
  - "Dropped backwards-compat assertion `not.toContain('4.0.1')` — current svgo build version IS 4.0.1, so the literal would false-positive. Retained `not.toContain('@squoosh-kit/core')` and `not.toContain('312 KB')` as unique-prior-literal sanity checks."

metrics:
  duration_min: 14
  completed_date: 2026-06-10
  tasks_completed: 2
  files_changed: 6
---

# Phase 13 Plan 03: Wave 1 — runtimeAtom Reshape + main.tsx Probe + StatusBar Live Versions Summary

Replaces three hardcoded runtimeAtom strings (`svgoVersion`, `codecVersion`, `wasmInfo`) with a structured `versions: typeof BUILD_VERSIONS` + `caps: Caps` shape — wired end-to-end (main.tsx boot probe → atom → StatusBar live render) in a single atomic commit so the build never goes red mid-wave.

## What Was Built

### `src/stores/runtime.ts` (reshape)

- `RuntimeState` drops `svgoVersion: string`, `codecVersion: string`, `wasmInfo: string`.
- Adds `versions: typeof BUILD_VERSIONS` (imported from `@/lib/versions`) and `caps: Caps` (imported from `@/lib/caps`).
- New module-scope `INITIAL_CAPS` const provides a safe-zero baseline (`simd: false, threads: false, crossOriginIsolated: false, hardwareConcurrency: 1, offlineReady: false`); `main.tsx` overwrites it pre-render.
- New `setCaps(c: Caps): void` exported — mirrors `setEncodingFile` / `setJobCounts` CR-01 atomic-setKey precedent.
- All existing exports (`startRun`, `stopRun`, `pushToast`, `dismissToast`, `setWorkerCount`, `setJobCounts`, `setEncodingFile`, `watchedFolderAtom`) preserved verbatim.

### `src/main.tsx` (boot wiring — D-04)

- Two new imports: `probeCaps` from `@/lib/caps` and `setCaps` from `@/stores/runtime`.
- Single side-effect statement `setCaps(probeCaps())` inserted AFTER the existing `crossOriginIsolated` probe block and BEFORE the `registerCommands(...)` call.
- The COI guard is preserved (different purpose: codec-worker COOP/COEP smoke test vs UI-surface capability state).

### `src/components/shell/StatusBar.tsx` (consumer reshape — D-07 / D-08 / D-09)

- Line 9 destructure: `{ running, svgoVersion, codecVersion, wasmInfo }` → `{ running, versions, caps }`.
- SVGO badge: `SVGO {versions.svgo}` (label unchanged, source live).
- Codec badge: `@squoosh-kit/core {codecVersion}` → `jSquash · webp {versions.jsquash.webp}` (D-08 label rename + representative-codec convention per PATTERNS line 292).
- WASM badge: replaced `{wasmInfo}` static string with `{wasmStr}` derived inline from `caps.simd && caps.threads` four-way ternary (D-07).
- Offline-ready pill: NEW conditional render `{caps.offlineReady && (...)}` — when SW controller is absent (Playwright runtime), nothing renders (D-09 HIDE rule).

### `src/tests/stores.test.ts` (regression update)

- Top-of-file additions: `import { BUILD_VERSIONS } from '../lib/versions.ts'` + a local `TEST_CAPS` const.
- Three `runtimeAtom.set({...})` fixture-resets updated to new shape — drop legacy keys, add `versions: BUILD_VERSIONS, caps: { ...TEST_CAPS }`.
- All 17 existing assertions still pass.

### `src/tests/runtime-shape.test.ts` (new — Wave 1 unit)

- Asserts `runtimeAtom.get()` exposes `versions` + `caps` keys.
- Asserts legacy keys (`svgoVersion`, `codecVersion`, `wasmInfo`) are absent from atom state.
- Asserts `versions.svgo` is string + all six `jsquash.{webp,jpeg,avif,oxipng,png,resize}` keys are strings.
- Asserts `caps.{simd,threads,crossOriginIsolated,offlineReady}` are boolean + `caps.hardwareConcurrency` is number.
- Includes a static-source fallback that strips comments and asserts no legacy field declarations remain in `src/stores/runtime.ts` — runs even when the `@/` alias is unresolvable under bare Node.

### `src/tests/statusbar-versions.spec.ts` (new — Wave 1 e2e)

- Navigates to `/` and reads `data-testid="statusbar"` textContent.
- Asserts prefix-only matches: `SVGO `, `jSquash · webp `, `WASM ready` (versions drift with deps, but prefixes are stable).
- Asserts `Offline-ready` is absent (under Playwright, `navigator.serviceWorker.controller` is null → `caps.offlineReady === false` → pill hidden per D-09).
- Asserts legacy label `@squoosh-kit/core` and legacy hardcoded WASM blob `312 KB` are absent.

## Decisions Made

| ID  | Decision                                                                                            | Why                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Bundle Tasks 1+2 into a single commit                                                               | PATTERNS CRITICAL RISK #1: `runtime.ts` reshape + `StatusBar.tsx` consumer update MUST land atomically — splitting them = mid-wave `npx tsc -b` / `vite build` red between commits. The plan's per-task `<verify>` for Task 1 includes `npx tsc -b`, which cannot pass until StatusBar reads the new shape. |
| D-2 | `runtime-shape.test.ts` falls back to a static-source check when the `@/` alias is unresolvable     | Matches the established Wave-0-stub pattern in `stores.test.ts:117-124`. The shape contract is still enforced via comment-stripped textual assertions on the source file.                                                                                          |
| D-3 | Dropped `not.toContain('4.0.1')` from the Playwright sanity assertions                              | The current build-injected svgo version is literally `4.0.1`, so the assertion would false-positive against the real build. The unique legacy markers `@squoosh-kit/core` and `312 KB` are retained.                                                                |

## Verification Results

| Check                                                                                  | Result                            |
| -------------------------------------------------------------------------------------- | --------------------------------- |
| `npx vite build`                                                                       | ✅ built in 3.06s                  |
| `npx tsc -b`                                                                           | ⚠️ 14 errors — pre-existing baseline; my changes add 0 new errors (MEMORY: baseline tsc is red with pre-existing debt) |
| `node --experimental-strip-types src/tests/stores.test.ts`                             | ✅ 17 passed, 0 failed             |
| `node --experimental-strip-types src/tests/runtime-shape.test.ts`                      | ✅ 6 passed, 0 failed (static-source fallback path) |
| `node --experimental-strip-types src/tests/caps.test.ts`                               | ✅ 13 passed, 0 failed (regression) |
| `node --experimental-strip-types src/tests/versions.test.ts`                           | ✅ 17 passed, 0 failed (regression) |
| `npx playwright test src/tests/statusbar-versions.spec.ts --reporter=dot`              | ✅ 1 passed                        |
| `grep -rE "svgoVersion\|codecVersion\|wasmInfo" src/` (excluding comments + test asserts) | ✅ 0 hits in code; remaining hits are intentional doc-comments + test-assertion strings enforcing the contract |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — blocking] Atomic-commit bundling of Tasks 1+2**

- **Found during:** Task 1 verification
- **Issue:** Plan separated Tasks 1 and 2 into independent commits, but Task 1's `<verify>` includes `npx tsc -b` and `grep -rE "svgoVersion|..." src/` returning 0 — both impossible while `StatusBar.tsx` still reads the legacy fields.
- **Fix:** Bundled Tasks 1+2 into a single commit (878925c) per PATTERNS CRITICAL RISK #1. PATTERNS line 252 explicitly mandates same-task landing.
- **Files modified:** all six files in one commit.
- **Commit:** 878925c

**2. [Rule 1 — bug] Playwright `not.toContain('4.0.1')` false-positive**

- **Found during:** Task 2 first Playwright run.
- **Issue:** The plan suggested asserting absence of the legacy literal `4.0.1`, but the build-injected `versions.svgo` is currently `4.0.1` — assertion failed because the test was contradicting itself.
- **Fix:** Removed the version-number absence assertions; retained unique-prior-marker checks (`@squoosh-kit/core`, `312 KB`).
- **Files modified:** `src/tests/statusbar-versions.spec.ts`
- **Commit:** 878925c

### Out-of-Scope Issues Noted

- `src/tests/status-bar.spec.ts` has 2 pre-existing failures (`fixtures/ingest-helper` page.evaluate import) unrelated to this plan; verified by stash-and-rerun. Not addressed.
- `npx tsc -b` baseline 14 errors are pre-existing tech debt per MEMORY. My changes add zero new tsc errors.

## Known Stubs

None. `caps.offlineReady` is a typed placeholder owned by `src/lib/caps.ts` (line 21) — already documented as Phase-14 PWA-02's responsibility to replace with `precacheComplete`. The runtimeAtom field is intentional, not a UI stub.

## Self-Check: PASSED

Verified:

- `src/stores/runtime.ts` — modified ✅
- `src/components/shell/StatusBar.tsx` — modified ✅
- `src/main.tsx` — modified ✅
- `src/tests/stores.test.ts` — modified ✅
- `src/tests/runtime-shape.test.ts` — created ✅
- `src/tests/statusbar-versions.spec.ts` — created ✅
- Commit `878925c` — present in `git log` ✅

## Carry-Forward for Plan 07 (Diagnostics tab)

- `runtimeAtom.versions` is now the canonical version source. Plan 07's Diagnostics tab can `useStore(runtimeAtom)` and destructure `versions` directly — no additional store work required.
- `runtimeAtom.caps` carries SIMD/threads/COI/hardwareConcurrency/offlineReady. Plan 07 can render any of these without a new probe.
- The `versions.ssim` (Phase 16) and `versions.butteraugli.buildHash` (Phase 17) hooks are already typed as optional — Plan 07 should defensively check `versions.ssim ?? '—'`.
- Phase 14 PWA-02: when the SW precache lands, call `setCaps({ ...runtimeAtom.get().caps, offlineReady: true })` (or re-run `probeCaps()` if extended). The Offline-ready pill will surface automatically without StatusBar changes.

## VALIDATION.md Status

- `13-03-atom-reshape` ⬜ → ✅
- `13-04-statusbar` ⬜ → ✅
