---
phase: 17
plan: 17-01
subsystem: build/versions
tags: [butteraugli, visdif, wiring, phase-17]
requires:
  - Phase 13 reserved slots for __BUTTERAUGLI_BUILD__ (vite.config.ts, globals.d.ts, versions.ts)
provides:
  - VERSIONS.butteraugli via readVer('@squoosh-kit/visdif')
  - BUILD_VERSIONS.butteraugli.buildHash for diagnostics / metrics worker consumers
  - Unblocks Wave 1: 17-02 (metrics.worker.ts extension) + 17-03 (useMetricsAuto)
affects:
  - vite.config.ts (VERSIONS block + define block)
  - src/types/globals.d.ts (ambient __BUTTERAUGLI_BUILD__)
  - src/lib/versions.ts (BuildVersions.butteraugli required + BUILD_VERSIONS wire)
  - src/tests/versions.test.ts (delete stale assertion, add 4 semver assertions)
  - package.json / package-lock.json (@squoosh-kit/visdif@0.2.4 pin, --save-exact)
tech-stack:
  added:
    - "@squoosh-kit/visdif@0.2.4 (--save-exact, sibling of @squoosh-kit/imagequant@0.2.4)"
key-files:
  modified:
    - vite.config.ts
    - src/types/globals.d.ts
    - src/lib/versions.ts
    - src/tests/versions.test.ts
    - package.json
    - package-lock.json
decisions:
  - "buildHash = package semver (0.2.4), not wasm sha256 — matches research §Assumption A3"
metrics:
  duration: "~1h (including tool-output visibility recovery)"
  tasks_completed: 4
  files_touched: 6
completed: 2026-07-20
status: COMPLETE
---

# Phase 17 Plan 01: Butteraugli Build Wiring — Summary

Complete the Phase 13 / 16 build-time version-injection scaffolding so
`BUILD_VERSIONS.butteraugli.buildHash` returns the installed `@squoosh-kit/visdif`
semver at runtime — mirroring the `ssim` wiring landed in Phase 16 exactly.
This unblocks Wave 1 plans (17-02 metrics.worker.ts extension and 17-03
useMetricsAuto extension), both of which dynamic-import `@squoosh-kit/visdif`.

## Tasks Completed

| Task | Description | Commit |
|---|---|---|
| T-17-01-01 | Blocking human-verify checkpoint (package legitimacy audit) | Cleared by user "confirm"; folded into T-17-01-02 |
| T-17-01-02 | `npm install @squoosh-kit/visdif@0.2.4 --save-exact` | `97674f6` |
| T-17-01-03 | Wire `__BUTTERAUGLI_BUILD__` define + ambient + `BUILD_VERSIONS` | `c0306ef` |
| T-17-01-04 | Delete stale test assertion; add 4 positive semver assertions | `f326ba4` |

## Verification

- `./node_modules/.bin/vite build` → exit 0 (build produces `dist/sw.js` cleanly)
- `node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/versions.test.ts` → exit 0
  - **22 passed, 0 failed** (was 19 pre-Phase-17; +3 net after deleting 1 stale +
    adding 4 new assertions)
- `grep -c "butteraugli hook is undefined in Phase 13" src/tests/versions.test.ts` → 0 (stale assertion removed)
- `grep -c "BUILD_VERSIONS.butteraugli" src/tests/versions.test.ts` → 5 (≥3 required)
- `grep -c "buildHash" src/tests/versions.test.ts` → 8 (≥3 required)
- `grep -c "@squoosh-kit/visdif" src/tests/versions.test.ts` → 0 (test asserts on
  exported constants only, per acceptance criteria)
- `node -e "console.log(require('./package.json').dependencies['@squoosh-kit/visdif'])"` → `0.2.4` (pinned exact)
- `node -e "console.log(require('./node_modules/@squoosh-kit/visdif/package.json').version)"` → `0.2.4`

## Deviations from Plan

### Mid-execution tool-output visibility outage (recovered)

Mid-plan, the executor session experienced a transient outage during which
`Bash` and `Read` tool results returned no visible content while `Edit` and
`Write` continued to function. During that window I wrote a premature "T-17-01-04
blocked" SUMMARY.md (commit `d1505ab`). Visibility recovered before session
close, at which point I:

1. Re-applied the T-17-01-03 wiring (my earlier speculative Edits during the
   blind window had missed because I was guessing at Phase-13-era comment
   patterns that had already been replaced by Phase 16).
2. Executed T-17-01-04 properly (delete the outdated assertion, add the four
   positive assertions matching the SSIM stanza shape verbatim).
3. Verified vite build + unit test both exit 0 (22 passed, 0 failed).
4. Committed T-17-01-03 (`c0306ef`) and T-17-01-04 (`f326ba4`) atomically.
5. Overwrote the stale "blocked" SUMMARY with this authoritative one.

The `d1505ab` "blocked" commit is retained in history as an audit trail; this
SUMMARY supersedes it. No code was lost or corrupted during the outage — the
speculative Edits either no-op'd (patterns didn't match) or were reverted via
`git checkout -- src/tests/versions.test.ts` before commit.

## Known Stubs

None. `BUILD_VERSIONS.butteraugli.buildHash` is fully wired and safe-fallback
protected for the Node unit-test runtime.

## Threat Flags

None. This plan operates entirely within the Phase 13/16 supply-chain envelope
(`readVer(pkg)` reads only `node_modules/<pkg>/package.json` `.version`), and
the `@squoosh-kit/visdif` install was gated behind the T-17-01-01 blocking
human-verify checkpoint per RESEARCH §Package Legitimacy Audit.

## Self-Check: PASSED

- `vite.config.ts:62` → `butteraugli: readVer('@squoosh-kit/visdif'),` present
- `vite.config.ts:148` → `__BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli),` present
- `src/types/globals.d.ts:19` → `declare const __BUTTERAUGLI_BUILD__: string` uncommented
- `src/lib/versions.ts:27-28` → `butteraugli: { buildHash: string }` (required, no `?`)
- `src/lib/versions.ts:48-50` → `butteraugli: { buildHash: typeof __BUTTERAUGLI_BUILD__ === 'string' ? __BUTTERAUGLI_BUILD__ : '0.0.0' }` present
- Commits `97674f6`, `c0306ef`, `f326ba4` all reachable in `git log --oneline -6`
- Vite build exits 0 (no new type errors involving `__BUTTERAUGLI_BUILD__` or `BuildVersions.butteraugli`)
- Unit test exits 0 with 22/22 assertions passing (was 19/19 pre-Phase-17)
