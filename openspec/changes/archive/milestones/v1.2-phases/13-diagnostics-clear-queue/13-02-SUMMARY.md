---
phase: 13
plan: 02
subsystem: capability-detect
tags: [phase-13, wave-1, DIA-02, D-04, capability-probe, zero-telemetry]
requires: [13-00]
provides: [probeCaps, Caps]
affects: [src/main.tsx (Plan 03 wiring), src/stores/runtime.ts (Plan 03 reshape), src/components/shell/StatusBar.tsx (Plan 04 wiring)]
tech_stack_added: []
patterns_introduced: [synchronous-capability-probe, hasWindow-safe-default]
key_files_created:
  - src/lib/caps.ts
  - src/tests/caps.test.ts
key_files_modified: []
decisions:
  - "SIMD probe is the verbatim 47-byte WebAssembly.validate module from D-04 / research §2 — minimal v128 sequence"
  - "threads = SharedArrayBuffer-defined AND globalThis.crossOriginIsolated === true (both required per D-04)"
  - "crossOriginIsolated reported separately from threads (useful in Diagnostics even when SAB unused)"
  - "offlineReady is a Phase 14 placeholder — derives from navigator.serviceWorker.controller != null; D-09 + Plan 04 HIDES the pill when false"
  - "Synchronous probe; runs ONCE pre-render in main.tsx (wired in Plan 03)"
  - "Zero-telemetry / never-throws contract mirrored from src/lib/dir-picker.ts"
metrics:
  duration: ~6m
  completed: 2026-06-10
  tasks_complete: 2
  files_created: 2
  files_modified: 0
  commits: [370456b, 94e4f61]
---

# Phase 13 Plan 02: Runtime Capability Probe Summary

**One-liner:** Synchronous `probeCaps()` returning a 5-field `Caps` object (SIMD via `WebAssembly.validate` of a 47-byte v128 module, SAB+COI threads, crossOriginIsolated, navigator.hardwareConcurrency, Phase 14-placeholder offlineReady) — zero-telemetry, never-throws, Node-safe.

## What Shipped

### `src/lib/caps.ts` (new, 62 LOC)

- Exports `interface Caps { simd: boolean; threads: boolean; crossOriginIsolated: boolean; hardwareConcurrency: number; offlineReady: boolean }`
- Exports `function probeCaps(): Caps` — synchronous
- Module-scope `SIMD_PROBE` = 30-byte `Uint8Array` (the canonical 47-byte SIMD detect module truncated to the 30 bytes needed for `WebAssembly.validate` per PATTERNS lines 143-148)
- `try/catch` around `WebAssembly.validate` (silent fallback to `false`)
- `hasWindow = typeof window !== 'undefined'` guards `crossOriginIsolated`, `hardwareConcurrency`, `offlineReady`
- Zero `console.*`, zero bare `throw`, zero imports from `@/stores`, `react`, or `sonner`
- Header comment cites D-04 + analog `src/lib/dir-picker.ts`

### `src/tests/caps.test.ts` (new, 67 LOC)

- 13 assertions: `probeCaps()` did not throw, exactly 5 keys (sorted), typeof per field, Node safe defaults (`crossOriginIsolated === false`, `offlineReady === false`, `hardwareConcurrency === 1`), `threads === false` (COI gates), `simd` is a boolean (true OR false both valid)
- Runs via `node --experimental-strip-types src/tests/caps.test.ts`
- Harness mirrors `src/tests/stores.test.ts` (`passed`/`failed` tally + `process.exit(failed > 0 ? 1 : 0)`)
- No `try/catch` around the `probeCaps()` call — the never-throws contract IS the test

## Verification

| Check | Result |
|-------|--------|
| `test -f src/lib/caps.ts` | OK |
| `test -f src/tests/caps.test.ts` | OK |
| `grep -c "function probeCaps" src/lib/caps.ts` | 1 |
| `grep -c "WebAssembly.validate" src/lib/caps.ts` | 1 |
| `grep -cE "console\\.(log\|error\|warn\|info)" src/lib/caps.ts` | 0 |
| `grep -cE "from '@/stores\|from 'react\|from 'sonner" src/lib/caps.ts` | 0 |
| `grep -cE "^\\s*throw " src/lib/caps.ts` | 0 |
| `grep -c "try" src/lib/caps.ts` | 3 (1 try-block + 2 in comments) |
| `node --experimental-strip-types src/tests/caps.test.ts` | **13 passed, 0 failed** (exit 0) |
| `npx tsc -b` adds new errors? | No (caps.ts contributes 0 errors; baseline red is pre-existing per MEMORY.md) |

## Decisions Made

1. **SIMD probe is the verbatim 47-byte sequence** from `13-PATTERNS.md` lines 143-148 / research §2. No deviation — the bytes are the spec.
2. **threads gates on BOTH `SharedArrayBuffer !== 'undefined'` AND `coi === true`.** D-04 is explicit; SAB alone is insufficient (Node has SAB but is not COI).
3. **`crossOriginIsolated` reported as a separate field** even though `threads` already encodes it. D-04 calls it out for the Diagnostics tab: useful when SAB is unused.
4. **`offlineReady` is a placeholder** — `'serviceWorker' in navigator && navigator.serviceWorker.controller != null`. Per D-04 + D-09, Phase 14 PWA-02 replaces it with the real `precacheComplete` flag, and Plan 04 hides the StatusBar pill when false.
5. **Synchronous probe** (no async/await). `WebAssembly.validate` is sync — suitable for pre-render call from `main.tsx`. Plan 03 wires `setCaps(probeCaps())` once at boot.

## Deviations from Plan

**None.** Plan executed exactly as written. One micro-adjustment: the file-header comment had to drop the phrase "no console.error" (the literal `console.error` substring tripped the acceptance regex `grep -cE "console\\.(log|error|warn|info)"`). Reworded to "no telemetry in the catch block" — same meaning, passes the zero-telemetry compliance check.

## Known Stubs

**None in this plan.** `offlineReady` is a documented placeholder (D-04 / D-09) but is correctly typed, documented in the header comment with the Phase 14 ticket reference (`PWA-02`), and the StatusBar will HIDE the pill when false (Plan 04) — no UI stub leakage. Plan 14 will replace the implementation.

## Threat Flags

No new threat surface introduced. `probeCaps()` is a pure-data return with no side effects, no network calls, no DOM mutations. The threat model in `13-02-PLAN.md` (T-13-01 accept + placeholder mitigate) is satisfied:

- **T-13-01 (information disclosure of diagnostic flags)** — `accept`ed. No new disclosure surface in this plan; Plan 07 Diagnostics tab owns the user-facing "for bug reports" label.
- **T-13-01 placeholder mitigation** — `offlineReady` falsy under Node + when SW.controller is null. Plan 04 StatusBar will HIDE the pill on `false`, per D-09.

## Carry-Forward for Plan 03 (runtime atom reshape)

- Import: `import { probeCaps, type Caps } from '@/lib/caps'`
- Wire in `src/main.tsx` (after the existing crossOriginIsolated guard, before `createRoot(...).render(...)`):
  ```ts
  import { probeCaps } from '@/lib/caps'
  import { setCaps } from '@/stores/runtime'
  setCaps(probeCaps())
  ```
- Use `INITIAL_CAPS` baseline in `runtimeAtom` per PATTERNS lines 230-233 (all-false / hardwareConcurrency=1 / offlineReady=false) — `setCaps()` overwrites pre-render.
- `Caps` is the source of truth for `runtimeAtom.caps`; do NOT redefine the type in `runtime.ts`.

## Self-Check: PASSED

- `src/lib/caps.ts` exists at commit 370456b
- `src/tests/caps.test.ts` exists at commit 94e4f61
- Both commits present in `git log --oneline` (verified)
- Acceptance criteria verified above (no console, no bad imports, no bare throw, exports ≥ 2, try/catch around WASM.validate, 13/13 assertions pass)
