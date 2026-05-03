---
phase: 04
plan: 04-02
subsystem: pure-libs
tags: [phase-4, wave-1, pure-modules, png-sniff, filename, memory-budget]
requires:
  - FileEntry.targetDensity (Plan 04-01)
  - SourceDensity type (Phase 1)
provides:
  - sniffPngDimensions (24-byte IHDR sniff)
  - applyDensitySuffix (idempotent @Nx templating)
  - deduplicateName ((N)-before-@Nx collision dedup)
  - computeMemoryBudget (deviceMemory-based, 600 MB cap)
  - estimateJobBytes (D-11.b 1.75x multiplier)
affects:
  - Plan 04-03 (PNG adapter — uses sniffPngDimensions)
  - Plan 04-04 (pool admission gate — uses computeMemoryBudget + estimateJobBytes)
  - Plan 04-05 (files-store fan-out — uses applyDensitySuffix + deduplicateName)
  - Plan 04-01 filename.test.ts flips from 1 stub-pass to 6 live assertions
tech-stack-added: []
patterns:
  - "Pure-function utility module shape (analog to src/lib/format.ts)"
  - "Relative ../types/index.ts type-import for node --experimental-strip-types compatibility (avoids Vite @/ alias)"
  - "navigator probe with typeof guard + ?? fallback (works in node + browser)"
  - "Anchored regex `/@[123]x$/` for idempotent suffix strip"
  - "Hard-stop loop bound (i<1000) + crypto.randomUUID() fallback for collision dedup"
key-files-created:
  - src/lib/sniff.ts
  - src/lib/memory-budget.ts
  - src/lib/filename.ts
key-files-modified: []
key-decisions:
  - "Phase 4 Plan 04-02: filename.ts uses relative `../types/index.ts` type-import instead of `@/types` alias so node --experimental-strip-types resolves it without a Vite path-config — same precedent as Phase 3 Plan 03-D svg-config.ts extraction"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_changed: 3
  commits: 2
  completed_date: "2026-05-03"
---

# Phase 4 Plan 04-02: Pure libs Summary

Three pure-function utility modules shipped in Wave 1 — PNG dimension sniff, density suffix templating + collision dedup, and device-aware memory budget + per-job byte estimate. All three are framework-free (zero React, zustand, jSquash imports) and unit-test under `node --experimental-strip-types`. Plan 04-01's `filename.test.ts` flipped from "1 stub-pass" to "6 live assertions passed", confirming the Wave 0 module-not-found branch is no longer triggered.

## What Shipped

### Task 1 — `src/lib/sniff.ts` + `src/lib/memory-budget.ts` (commit `606362f`)

**`src/lib/sniff.ts`** (947 B, 1 export)

```typescript
sniffPngDimensions(blob: Blob): Promise<{ width: number; height: number } | null>
```

24-byte IHDR sniff per RFC 2083. Returns `null` for blobs `< 24` bytes, blobs lacking the PNG signature `89 50 4E 47 0D 0A 1A 0A`, or blobs lacking the `IHDR` chunk type at offset 12. On the Plan 04-01 fixture `density-2x.png` returns `{ width: 800, height: 600 }`. T-04-02-03 mitigated: `blob.slice(0, 24).arrayBuffer()` reads only 24 bytes regardless of source size — no full-blob materialization.

**`src/lib/memory-budget.ts`** (1306 B, 2 exports)

```typescript
const MAX_BUDGET_BYTES = 600 * 1024 * 1024
computeMemoryBudget(): number
estimateJobBytes(srcW: number, srcH: number, tgtW: number, tgtH: number): number
```

`computeMemoryBudget()` reads `navigator.deviceMemory` (with `typeof navigator !== 'undefined'` guard for node) and falls back to `4` when undefined. Returns `min(0.75 × dm × 1024 MB, 600 MB)` in bytes. T-04-02-05 mitigated: even a forged `deviceMemory = 9999` value caps at 600 MB.

`estimateJobBytes(2000, 1500, 1000, 750)` returns `Math.ceil((3_000_000 + 750_000) × 4 × 1.75) = 26_250_000` — 1.75x multiplier on (src + tgt) × 4 bytes covers WASM heap intermediate buffers per RESEARCH §2.2.

### Task 2 — `src/lib/filename.ts` (commit `32467f5`)

**`src/lib/filename.ts`** (1568 B, 2 exports)

```typescript
applyDensitySuffix(originalName: string, density: SourceDensity): string
deduplicateName(proposed: string, takenSet: ReadonlySet<string>): string
```

`applyDensitySuffix` is idempotent — anchored regex `/@[123]x$/` strips an existing `@Nx` before re-appending, so `'logo@2x.png' + '1x' → 'logo@1x.png'` (NOT `'logo@2x@1x.png'`). T-04-02-01 mitigated: `$` anchor prevents middle-of-string false matches; `lastIndexOf('.')` extension split is deterministic.

`deduplicateName` inserts `" (N)"` BEFORE the `@Nx` suffix on collision, so the extension and density tag stay terminal — `'logo@1x.png'` collision → `'logo (2)@1x.png'`, repeat collision → `'logo (3)@1x.png'`. Hard-stop at `i = 1000` falls back to `crypto.randomUUID().slice(0, 8)` rather than throwing (T-04-02-02 mitigated). When `proposed` lacks an `@Nx` suffix, the regex no-match branch returns `proposed` unchanged — documented behavior; production callers always run `applyDensitySuffix` first.

## Empirically-Verified Test Cases

### sniffPngDimensions

| Input | Expected | Verified |
|-------|----------|---------|
| `density-2x.png` (Plan 04-01 fixture, 491 KB, 800×600 IHDR) | `{ width: 800, height: 600 }` | ✓ |
| `new Blob([new Uint8Array(10)])` (10 bytes < 24) | `null` | ✓ |
| `new Blob([new Uint8Array(40)])` (40 bytes, no PNG signature) | `null` | ✓ |

### computeMemoryBudget + estimateJobBytes

| Call | Expected | Verified |
|------|----------|---------|
| `computeMemoryBudget()` (node, no `navigator`) | `600 × 1024 × 1024` (cap) | ✓ |
| `estimateJobBytes(2000, 1500, 1000, 750)` | `26_250_000` (= ceil((3M+750k) × 4 × 1.75)) | ✓ |

### applyDensitySuffix + deduplicateName (filename.test.ts, 6/6 live)

| # | Assertion | Verified |
|---|-----------|---------|
| 1 | `applyDensitySuffix('logo.png', '2x') === 'logo@2x.png'` | ✓ |
| 2 | `applyDensitySuffix('logo@2x.png', '1x') === 'logo@1x.png'` (idempotent) | ✓ |
| 3 | `applyDensitySuffix('logo', '3x') === 'logo@3x'` (no extension) | ✓ |
| 4 | `deduplicateName('logo@1x.png', new Set()) === 'logo@1x.png'` (passthrough) | ✓ |
| 5 | `deduplicateName('logo@1x.png', Set(['logo@1x.png'])) === 'logo (2)@1x.png'` | ✓ |
| 6 | `deduplicateName('logo@1x.png', Set([..., 'logo (2)@1x.png'])) === 'logo (3)@1x.png'` | ✓ |

## Deviations from Plan

None — plan executed exactly as written. PATTERNS.md spec used `@/types` alias; the plan body explicitly directed using the relative `../types/index.ts` path for node compatibility. Followed the plan-body directive (which is the locked decision in the plan key-decisions).

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `node --experimental-strip-types src/tests/filename.test.ts` | `6 passed, 0 failed` (live, was 1 stub-pass) |
| Inline node verifier (sniff + memory-budget) | `sniff OK` + `memory-budget OK` |
| `grep -c '^export ' src/lib/sniff.ts` | 1 |
| `grep -cE '^export (function\|const)' src/lib/memory-budget.ts` | 2 |
| `grep -c '^export function applyDensitySuffix' src/lib/filename.ts` | 1 |
| `grep -c '^export function deduplicateName' src/lib/filename.ts` | 1 |
| Framework imports across 3 modules | 0 |
| Sibling unit tests regression (icc.test.ts, settings-icc.test.ts) | 1/1 + 3/3 still pass |

## Closure Hooks for Later Plans

| Plan | Hook |
|---|---|
| 04-03 (PNG adapter) | Imports `sniffPngDimensions` from `src/lib/sniff.ts` for byte-estimate seeding before pool dispatch. |
| 04-04 (pool admission gate) | Imports `computeMemoryBudget` + `estimateJobBytes` from `src/lib/memory-budget.ts` to gate FIFO pull on `inflightBytes + estimate > budget`. |
| 04-05 (files fan-out) | Imports `applyDensitySuffix` + `deduplicateName` from `src/lib/filename.ts` inside `addSourceWithVariants`; per D-16 calls `applyDensitySuffix` FIRST, then `deduplicateName` against the existing FileEntry name set. |
| 04-01 raster.spec.ts test #6 (collision rename) | Will flip green once Plan 04-05 wires `addSourceWithVariants` through these two helpers. |

## Self-Check: PASSED

- Files created exist:
  - `src/lib/sniff.ts` FOUND (947 B, 1 export)
  - `src/lib/memory-budget.ts` FOUND (1306 B, 2 exports)
  - `src/lib/filename.ts` FOUND (1568 B, 2 exports)
- Commits exist:
  - `606362f` FOUND (Task 1: sniff + memory-budget)
  - `32467f5` FOUND (Task 2: filename + filename.test.ts flip)
