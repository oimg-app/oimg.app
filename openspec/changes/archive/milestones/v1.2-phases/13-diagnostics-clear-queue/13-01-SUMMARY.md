---
phase: 13
plan: 01
subsystem: diagnostics
tags: [phase-13, wave-1, vite-define, versions, DIA-01]
requires:
  - .planning/phases/13-diagnostics-clear-queue/13-00-SUMMARY.md
provides:
  - vite.config.ts `define` block injecting `__SVGO_VERSION__` + `__JSQUASH_VERSIONS__`
  - src/lib/versions.ts typed wrapper exporting `BUILD_VERSIONS`, `BuildVersions`, `CodecKey`
  - src/tests/versions.test.ts Node shape + safe-fallback assertions (17 passing)
affects:
  - vite.config.ts (additive — `define` block + readVer helper)
tech-stack:
  added: []
  patterns:
    - "Vite `define` plugin for build-time literal injection (raster + svgo versions)"
    - "Typed env-global wrapper module with `typeof X === 'string'` safe-fallback (analog: src/lib/save-blob.ts)"
key-files:
  created:
    - src/lib/versions.ts
    - src/tests/versions.test.ts
  modified:
    - vite.config.ts
decisions:
  - "Use Vite `define` (build-time string substitution) instead of runtime `import('pkg/package.json')` — prod-Rollup-safe and avoids shipping the whole package.json as a chunk"
  - "Every `define` literal wrapped in `JSON.stringify(...)` per PATTERNS finding #3 — bare values inject as raw JS expressions (e.g. `4.0.1` → broken token)"
  - "Components/stores read `BUILD_VERSIONS` from src/lib/versions.ts, NEVER the raw globals — Phase 16/17 SSIM + Butteraugli additions become a single-file change"
  - "Safe-fallback sentinel `'0.0.0'` (invalid semver) so test assertions distinguish build-time-real-version from Node-runtime-fallback unambiguously"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-10"
  tasks: 2
  files_created: 2
  files_modified: 1
  commits: 2
---

# Phase 13 Plan 01: Vite `define` injection + typed BUILD_VERSIONS wrapper — Summary

JSquash + svgo versions are now sourced from real `node_modules/<pkg>/package.json` files at Vite build time and exposed through a single typed module (`src/lib/versions.ts`) that downstream code reads instead of touching the raw globals.

## Deliverables

### vite.config.ts (modified)

- Imports `fs from 'node:fs'`.
- Adds top-level `readVer(pkg: string): string` helper that resolves `node_modules/<pkg>/package.json` synchronously and returns the `version` field.
- Adds module-scope `VERSIONS` const populated via seven `readVer(...)` calls — one for `svgo` and six for `@jsquash/{webp,jpeg,avif,oxipng,png,resize}`.
- Adds a `define` block to `defineConfig({...})` that injects `__SVGO_VERSION__: JSON.stringify(VERSIONS.svgo)` and `__JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash)`. The `JSON.stringify` wrapper is mandatory — bare values would inject as raw JS expressions.
- Inline comment documents the **T-13-02 mitigation**: the `define` block injects ONLY `node_modules/<pkg>/package.json` version fields — no env vars, no filesystem paths.
- Phase 16/17 hook comments mark the SSIM + Butteraugli append points.
- All existing config sections (`plugins`, `resolve.alias`, `worker.format`, `assetsInclude`, `optimizeDeps`, `server.headers`) preserved verbatim.

### src/lib/versions.ts (new)

- Exports `CodecKey = 'webp' | 'jpeg' | 'avif' | 'oxipng' | 'png' | 'resize'`.
- Exports `BuildVersions` interface — `svgo: string`, `jsquash: Record<CodecKey, string>`, optional `ssim?: string` (Phase 16), optional `butteraugli?: { buildHash: string }` (Phase 17).
- Internal `FALLBACK_JSQUASH` const maps all six codec keys to `'0.0.0'` sentinel.
- Exports `BUILD_VERSIONS: BuildVersions` constant initialised via `typeof __SVGO_VERSION__ === 'string'` and `typeof __JSQUASH_VERSIONS__ === 'object'` guards. Outside Vite the guards fall back to `'0.0.0'` cleanly — no `ReferenceError` at module-init.
- Header comment cites Phase 13 / DIA-01 / D-01 / D-03 and the `src/lib/save-blob.ts` analog.

### src/tests/versions.test.ts (new)

- Mirrors the `src/tests/stores.test.ts` Node harness: `passed`/`failed` tally + `assert(name, cond)` + `process.exit(failed > 0 ? 1 : 0)`.
- 17 assertions: shape (svgo + all six codecs are strings), safe-fallback (all values === `'0.0.0'` outside Vite), Phase 16/17 hooks remain `undefined`.
- Runs under `node --experimental-strip-types src/tests/versions.test.ts`.
- Result: `17 passed, 0 failed`.

## Verified Versions (real, not hardcoded)

| Package           | Version |
| ----------------- | ------- |
| svgo              | 4.0.1   |
| @jsquash/webp     | 1.5.0   |
| @jsquash/jpeg     | 1.6.0   |
| @jsquash/avif     | 2.1.1   |
| @jsquash/oxipng   | 2.3.0   |
| @jsquash/png      | 3.1.1   |
| @jsquash/resize   | 2.1.1   |

These flow live from `node_modules/<pkg>/package.json` → Vite `define` → bundle.

## Verification

| Check                                                    | Result |
| -------------------------------------------------------- | ------ |
| `tsc -p tsconfig.app.json --noEmit`                      | green  |
| `vite build`                                             | green (3.24s) |
| `node --experimental-strip-types src/tests/versions.test.ts` | 17 passed, 0 failed |
| `grep -c "JSON.stringify" vite.config.ts`                | 4 (≥ 2 required for PATTERNS #3) |
| `grep -c "readVer(" vite.config.ts`                      | 9 (≥ 7 required: 1 def + 1 type sig + 7 calls) |
| `grep -c "process.env" vite.config.ts`                   | 0 (T-13-02: no regression from baseline 0) |
| `grep -rc "__SVGO_VERSION__" dist/assets/*.js` non-zero  | 0 (raw token NOT in bundle — Vite substituted correctly) |

## Deviations from Plan

None — plan executed exactly as written.

The only minor adjustment was wording in two inline comments inside `vite.config.ts`: the original wording mentioned `process.env.*` as the thing NOT being injected. To keep the `grep -c "process.env" vite.config.ts` count at the baseline of **0** (the plan's T-13-02 acceptance criterion), the comments were reworded to say "no env vars" instead. The security meaning is identical; only the substring spelling changed.

## Threat Surface

T-13-02 mitigation is in place: the `define` block reads only the `version` field from `node_modules/<pkg>/package.json` files. There is no path for environment variables, filesystem paths, or any other untrusted strings to leak into the bundle through this mechanism. The Vite docs warn that `define` can inadvertently inject env-var values — this codebase explicitly does not.

T-13-04 (XSS via version string in JSX) is mitigated downstream — Plan 04 (StatusBar) and Plan 07 (Diagnostics tab) will render `BUILD_VERSIONS.*` values via React text children, using React's default escaping. The type system constrains each value to `string`.

## Commits

| Hash      | Message                                                           |
| --------- | ----------------------------------------------------------------- |
| `90dca04` | feat(13-01): inject svgo + jSquash versions via Vite define       |
| `15e1e99` | feat(13-01): typed BUILD_VERSIONS wrapper + Node shape test       |

## Carry-Forward (Plan 03)

Plan 03 (atom reshape) can now safely:

```ts
import { BUILD_VERSIONS } from '@/lib/versions'
```

and source `svgoVersion`, `codecVersion(s)`, and the future `ssim` / `butteraugli` keys from a single typed surface. The StatusBar's three hardcoded strings (`'4.0.1'`, `'0.6.0'`, `'WASM ready · 312 KB'`) become a derived computation off `BUILD_VERSIONS` once Plan 03 lands.

## Self-Check: PASSED

- `vite.config.ts`: FOUND
- `src/lib/versions.ts`: FOUND
- `src/tests/versions.test.ts`: FOUND
- commit `90dca04`: FOUND
- commit `15e1e99`: FOUND
