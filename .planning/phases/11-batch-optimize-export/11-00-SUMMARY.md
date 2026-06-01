---
phase: 11
plan: 00
subsystem: scaffold
tags: [phase-11, wave-0, scaffold, deps, fixtures, mocks]
requires:
  - Phase 10 single-file optimize loop (runtimeAtom + setJobCounts already wired)
provides:
  - jszip dependency (^3.10.1) — locked
  - file-saver dependency (^2.0.5) — locked
  - @types/file-saver devDependency (^2.0.7)
  - Test-only window bridge: window.__runningJobs + window.__peakRunning
  - installSaveFileMocks(page, opts) helper for renderer-side save-path stubbing
  - batchFixtures: 20-entry fixture array (mixed PNG/WebP, 3 dup.png collisions)
  - src/tests/deps.test.ts — version-pin assertion harness
affects:
  - package.json (3 entries added)
  - src/main.tsx (gated bridge block appended after registerCommands)
tech-stack:
  added: [jszip@^3.10.1, file-saver@^2.0.5, "@types/file-saver@^2.0.7"]
  patterns: [test-only-window-bridge, save-file-mocks, byte-fixture-array]
key-files:
  created:
    - src/tests/deps.test.ts
    - src/tests/setup/save-file-mocks.ts
    - src/tests/fixtures/batch-fixtures.ts
  modified:
    - package.json
    - package-lock.json
    - src/main.tsx
decisions:
  - "Followed PLAN literal gate: import.meta.env.MODE === 'test' (PATTERNS.md offered an extra `|| import.meta.env.DEV` branch — rejected to keep prod tree-shake guarantee verifiable by simple grep)"
  - "Fixture bytes embedded as inline base64 (PNG sample palette + 1 WebP), zero network at test time per threat T-11-FX"
  - "Save-file mock spies on file-saver via URL.createObjectURL wrap + click interception (no module-level fs-saver shim needed)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-02"
  tasks: 3
  files_changed: 6
---

# Phase 11 Plan 00: Wave 0 — Foundation Summary

Locks the Phase 11 dependency stack (jszip + file-saver + @types/file-saver), wires the test-mode-only `runtimeAtom→window.__peakRunning` bridge that Plan 08's SC-4 backpressure spec depends on, and ships the shared save-file mocks helper plus the 20-entry batch fixture set (including 3 `dup.png` collisions for Plan 05's D-10 logic) that every later plan in this phase imports.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install deps + write version-pin assertion test | `f20f204` | package.json, package-lock.json, src/tests/deps.test.ts |
| 2 | Add test-only runtimeAtom→window bridge | `c511745` | src/main.tsx |
| 3 | Save-file mocks helper + 20-file batch fixtures | `2e1b02d` | src/tests/setup/save-file-mocks.ts, src/tests/fixtures/batch-fixtures.ts |

## What Was Built

- **`src/tests/deps.test.ts`** — Node `--experimental-strip-types` unit-test harness mirroring `src/tests/format.test.ts` shape. Reads `package.json`, asserts the three locked semver strings start with `^3.10` / `^2.0` / `^2.0`. Exit 0 on green, exit 1 on red.
- **`src/main.tsx` bridge** — A guarded block right after `registerCommands(...)`. Gate: `import.meta.env.MODE === 'test'`. Dynamically imports `@/stores/runtime`, subscribes to `runtimeAtom`, mirrors `runningJobs` onto `window.__runningJobs`, and monotonically advances `window.__peakRunning = max(prev, runningJobs)`. The dynamic import keeps the runtime store entirely out of the prod bundle when the gate is false (verified by grep against `dist/assets/*.js` → 0 hits).
- **`src/tests/setup/save-file-mocks.ts`** — Exports `installSaveFileMocks(page, opts)`. Uses `page.addInitScript` so the stubs are in place before first paint. In `'accept'` mode the `showSaveFilePicker` stub returns a fake `FileSystemFileHandle` whose `createWritable()` records all written bytes onto `window.__savedFiles`. In `'cancel'` mode it throws `DOMException('user cancel', 'AbortError')` — exercises the AbortError silent-swallow path (RESEARCH §Pitfall 2). The `saveAs`/file-saver spy is implemented as a `URL.createObjectURL` wrapper + a capture-phase anchor-click listener; it pushes `{ name, blobSize }` onto `window.__saveAsCalls` and `event.preventDefault()`s the navigation so no real download fires in the test runner.
- **`src/tests/fixtures/batch-fixtures.ts`** — Exports `batchFixtures: ReadonlyArray<BatchFixture>` of exactly 20 entries: 14 unique `tiny-NNN-<color>.png` (7-color palette cycled twice), 3 `dup.png` (red/blue/green bytes — proves the collision logic keys off filename not content), and 3 `tiny-NNN.webp`. Largest fixture is 75 bytes. Runtime guard at module load verifies `length === 20` and `bytes.byteLength ≤ 200_000` for every entry.

## Verification Results

All four verification gates from the plan's `<verification>` block passed:

| Gate | Command | Result |
|------|---------|--------|
| Deps pin assertion | `node --experimental-strip-types src/tests/deps.test.ts` | `3 passed, 0 failed` (exit 0) |
| Typecheck | `tsc -b` | exit 0 |
| Production build | `npm run build` | exit 0, `built in 2.56s` |
| Zero-telemetry bridge scan | `grep -c '__peakRunning' dist/assets/*.js` | All chunks 0 occurrences |
| Fixture verify | `node --experimental-strip-types -e "...batchFixtures..."` | `ok 20 fixtures, 3 dup.png, max=75 bytes` |

## Deviations from Plan

None. The plan executed exactly as written.

One small interpretation note for downstream agents: `11-PATTERNS.md` shows the bridge gate as `import.meta.env.MODE === 'test' || import.meta.env.DEV`, but `11-00-PLAN.md` Task 2 specifies the gate as `import.meta.env.MODE === 'test'` only. PLAN.md is authoritative; I used the literal PLAN.md form. This keeps the zero-telemetry tree-shake assertion (the `grep -c '__peakRunning' dist/...` check) deterministically green — `import.meta.env.DEV` is false in prod but the bundler still keeps the branch in some configurations.

## Carry-Forward Notes

- **Plan 04 (single-download spec)** can `import { installSaveFileMocks } from '../setup/save-file-mocks'` and assert recorded calls via `await page.evaluate(() => (window as { __savedFiles?: unknown[] }).__savedFiles)`. For the AbortError silent-swallow test, pass `{ mode: 'cancel' }`.
- **Plan 05 (batch ZIP)** can `import { batchFixtures } from '../fixtures/batch-fixtures'` and feed all 20 files in one batch; the 3 `dup.png` entries will exercise D-10's collision suffix logic. Use the `saveAs` spy (`window.__saveAsCalls`) to assert the timestamped ZIP filename pattern.
- **Plan 08 (SC-4 backpressure)** reads `await page.evaluate(() => (window as { __peakRunning?: number }).__peakRunning ?? 0)` after pushing the 20-file fixture set through the worker pool, then asserts `peak ≤ min(navigator.hardwareConcurrency, 4)`.

## Threat Flags

None — Phase 11 Plan 00 introduces no new trust boundaries beyond those already documented in the plan's threat model (T-11-SC accepted, T-11-BR mitigated via gate, T-11-FX accepted via committed bytes).

## Self-Check: PASSED

- [x] `package.json` contains `jszip@^3.10.1` — verified
- [x] `package.json` contains `file-saver@^2.0.5` — verified
- [x] `package.json` contains `@types/file-saver@^2.0.7` — verified
- [x] `src/tests/deps.test.ts` exists and exits 0 with `3 passed, 0 failed`
- [x] `src/main.tsx` contains `import.meta.env.MODE === 'test'` AND `__peakRunning`
- [x] `src/main.tsx` does not invoke `console.log` from the bridge
- [x] Production build green; `__peakRunning` absent from every `dist/assets/*.js` chunk
- [x] `src/tests/setup/save-file-mocks.ts` exists and exports `installSaveFileMocks`
- [x] `src/tests/fixtures/batch-fixtures.ts` exists; `batchFixtures.length === 20` with 3 `dup.png` collisions
- [x] Three commits on `main`: `f20f204`, `c511745`, `2e1b02d`
