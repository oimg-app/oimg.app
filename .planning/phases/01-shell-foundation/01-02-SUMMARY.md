---
phase: 01-shell-foundation
plan: 02
subsystem: testing
tags: [playwright, e2e, aria, bundle-size, perf, validation]

# Dependency graph
requires:
  - phase: 01-shell-foundation
    provides: vite dev server contract (port 5173, COOP/COEP headers from Plan 01-01)
provides:
  - Playwright E2E test runner targeting localhost:5173
  - ARIA landmark spec stubs for shell components (UI-08)
  - Bundle size smoke test under 200 KB gzipped budget (PERF-04)
  - npm scripts: test, test:ui, test:headed, test:bundle
affects:
  - 01-03 (Vite dev server must be runnable for Playwright webServer to start)
  - 01-04 (will activate the conditional landmark skips once AppShell mounts)
  - 01-05 (panel ARIA assertions hook into the same test file)
  - all subsequent phases needing E2E feedback in CI

# Tech tracking
tech-stack:
  added:
    - "@playwright/test ^1.59 (real Chromium, no jsdom)"
  patterns:
    - "Playwright webServer config drives Vite — no DOM simulation"
    - "Bundle-size check is a standalone Node script (spawnSync gzip), not a Playwright spec"
    - "Landmark stubs use test.skip(count === 0, ...) to defer activation to Wave 3"

key-files:
  created:
    - playwright.config.ts
    - src/tests/shell.spec.ts
    - src/tests/build.test.ts
    - .planning/phases/01-shell-foundation/deferred-items.md
  modified:
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "Use Playwright + real Chromium instead of vitest + jsdom for accurate ARIA/CSS inspection"
  - "Bundle-size check stays out of Playwright (no browser needed) to keep E2E runs fast"
  - "Landmark assertions ship as conditional skips so Wave 3 can flip them without rewriting"

patterns-established:
  - "Conditional landmark skip: count locator targets, test.skip when count === 0, expect when present"
  - "spawnSync over execSync for child processes (no shell, no injection surface)"
  - "Hardcoded path arguments only into spawnSync calls — never user-controlled strings"

requirements-completed: [UI-08, PERF-04]

# Metrics
duration: 11min
completed: 2026-04-29
---

# Phase 01 Plan 02: Test Infrastructure Setup Summary

**Playwright + real Chromium test runner with 6 ARIA landmark stubs (UI-08) and a Node-only 200 KB gzipped bundle-size guard (PERF-04), ready for Wave 3 to activate.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-29T21:22:45Z
- **Completed:** 2026-04-29T21:33:34Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Installed `@playwright/test` and downloaded Chromium browser to `~/Library/Caches/ms-playwright/`
- Wrote `playwright.config.ts` with `webServer` driving `npm run dev` on `http://localhost:5173`
- Scaffolded `src/tests/shell.spec.ts` — 1 active console-error smoke + 5 conditional landmark stubs (application/banner/toolbar/main/contentinfo)
- Scaffolded `src/tests/build.test.ts` — Node-only gzip-size check that exits 1 if dist/assets JS exceeds 200 KB
- `npx playwright test --list` parses cleanly and reports all 6 tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Playwright and configure the test runner** — `1d7d4a1` (chore)
2. **Task 2: Scaffold ARIA landmark spec and bundle size test** — `d0859c2` (test)

## Files Created/Modified
- `playwright.config.ts` — Playwright config: testDir `src/tests`, baseURL `http://localhost:5173`, webServer `npm run dev`, Chromium project
- `src/tests/shell.spec.ts` — 6 ARIA landmark tests (UI-08); 5 stubs auto-skip until landmarks render in Plan 04
- `src/tests/build.test.ts` — Node script reading `dist/assets/*.js`, gzipping with `spawnSync`, asserting <200 KB (PERF-04)
- `.planning/phases/01-shell-foundation/deferred-items.md` — Documents pre-existing rolldown-vite arm64 binding bug
- `package.json` — Added `test`, `test:ui`, `test:headed`, `test:bundle` scripts; added `@playwright/test` devDep
- `package-lock.json` — Regenerated after npm install
- `.gitignore` — Added `test-results/`, `playwright-report/`, `playwright/.cache/`

## Decisions Made
- **Playwright over vitest:** Real Chromium gives accurate ARIA accessibility tree, real CSS, and CDP access for future perf checks. jsdom would force simulated DOM that misses CSS-driven visibility.
- **Bundle test as standalone Node script:** Avoids spinning Playwright/Chromium for a file-system gzip check; keeps E2E feedback latency under 30s per VALIDATION.md.
- **Conditional skips for landmark stubs:** Lets Plan 03 ship without landmarks failing, while keeping the assertion shape ready for Plan 04 to flip on by simply removing `test.skip`.

## Deviations from Plan

None — plan executed exactly as written. The two specs match the plan's reference implementations verbatim, including the 6 test blocks and 5 conditional skips.

## Issues Encountered

### Pre-existing rolldown-vite arm64 binding loader bug (out of scope)

**Discovered while:** Trying to run `npx playwright test` (Playwright tries to start `npm run dev` via webServer config).

**Symptom:** `npm run dev` crashes with `Cannot find native binding ... @rolldown/binding-darwin-x64` even though `process.arch === "arm64"` and `@rolldown/binding-darwin-arm64@1.0.0-rc.17` is installed.

**Investigation:**
- Reproduces in BOTH this worktree and the main repo (`/Users/jilizart/Projects/oimg.app`) — confirms it pre-dates Plan 01-02.
- Persists across `rm -rf node_modules package-lock.json && npm install`.
- Direct `node -e "require('@rolldown/binding-darwin-arm64')"` succeeds — only the rolldown loader path is broken.
- Likely a bundler artifact in `node_modules/rolldown/dist/shared/binding-BeU_1iEk.mjs` where the darwin platform's arm64 branch is unreachable from the win32 fall-through.

**Resolution:** Documented in `deferred-items.md`. Out of scope per executor SCOPE BOUNDARY (pre-existing failure unrelated to Plan 01-02 changes). Plan 01-03 (Vite app shell) MUST address this before any E2E test can actually run; suggested fixes include setting `NAPI_RS_NATIVE_LIBRARY_PATH`, downgrading to `vite@^7` (esbuild-based), or pinning a working `rolldown` version.

**Impact on Plan 01-02:** Plan deliverables (config, specs, scripts, --list parsing) all complete and verified. The end-to-end run cannot be exercised yet, but per VALIDATION.md the spec activation is staged for Wave 3 (Plan 04) anyway, so no Wave 0 commitment slipped.

## Verification

```bash
$ test -f playwright.config.ts && echo OK
OK
$ test -f src/tests/shell.spec.ts && echo OK
OK
$ test -f src/tests/build.test.ts && echo OK
OK
$ node -e "console.log(require('./package.json').scripts.test)"
npx playwright test
$ npx playwright test --list
Listing tests:
  [chromium] › shell.spec.ts:12:3 › Shell ARIA landmarks (UI-08) › page loads without console errors
  [chromium] › shell.spec.ts:23:3 › Shell ARIA landmarks (UI-08) › application landmark renders with correct label
  [chromium] › shell.spec.ts:31:3 › Shell ARIA landmarks (UI-08) › banner landmark renders (TitleBar)
  [chromium] › shell.spec.ts:38:3 › Shell ARIA landmarks (UI-08) › toolbar landmark renders with label "Actions"
  [chromium] › shell.spec.ts:45:3 › Shell ARIA landmarks (UI-08) › main landmark renders (work area)
  [chromium] › shell.spec.ts:52:3 › Shell ARIA landmarks (UI-08) › contentinfo landmark renders (StatusBar)
Total: 6 tests in 1 file
$ node -e "const v=require('./package.json').devDependencies; console.log('vitest:', v.vitest || 'NOT PRESENT (correct)')"
vitest: NOT PRESENT (correct)
```

## User Setup Required

None — Chromium browser is downloaded automatically by `npx playwright install chromium` and lives in the user's Playwright cache (`~/Library/Caches/ms-playwright/`), not in the project tree.

## Next Phase Readiness
- **Plan 03** (Vite app shell) needs to fix the rolldown-vite arm64 binding bug before any E2E run is possible. Until then, the suite still parses (--list), CI will be able to run once Vite boots.
- **Plan 04** (Wave 3) just needs to remove the `test.skip(count === 0, ...)` lines and the assertions are already in place — the stubs are deliberately one-line activations.
- Bundle-size test is ready to plug into CI on every `npm run build`.

## Self-Check: PASSED

- All 5 referenced files exist on disk: playwright.config.ts, src/tests/shell.spec.ts, src/tests/build.test.ts, .planning/phases/01-shell-foundation/deferred-items.md, .planning/phases/01-shell-foundation/01-02-SUMMARY.md
- Both task commits (1d7d4a1, d0859c2) found in git log

---
*Phase: 01-shell-foundation*
*Completed: 2026-04-29*
