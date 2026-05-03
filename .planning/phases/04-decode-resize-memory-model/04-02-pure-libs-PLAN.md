---
phase: 04
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/sniff.ts
  - src/lib/filename.ts
  - src/lib/memory-budget.ts
autonomous: true
requirements: [PIPE-04, OPT-06]
must_haves:
  truths:
    - "`sniffPngDimensions(blob)` returns {width,height} from a 24-byte PNG slice or null on non-PNG (D-12 byte-estimate enabler)"
    - "`applyDensitySuffix(name, density)` is idempotent: `logo@2x.png` + 1x → `logo@1x.png`, NOT `logo@2x@1x.png` (D-03)"
    - "`deduplicateName(proposed, taken)` inserts `(N)` BEFORE the `@Nx` suffix on collision (D-16)"
    - "`computeMemoryBudget()` returns `min(0.75 * (deviceMemory ?? 4) * 1024, 600) MB` in bytes (D-12)"
    - "`estimateJobBytes(srcW,srcH,tgtW,tgtH)` returns `(srcPixels + tgtPixels) * 4 * 1.75` (D-11.b)"
  artifacts:
    - path: "src/lib/sniff.ts"
      provides: "PNG IHDR dimension sniff"
      exports: ["sniffPngDimensions"]
    - path: "src/lib/filename.ts"
      provides: "Density suffix templating + collision dedup"
      exports: ["applyDensitySuffix", "deduplicateName"]
    - path: "src/lib/memory-budget.ts"
      provides: "Device-aware memory budget + per-job byte estimate"
      exports: ["computeMemoryBudget", "estimateJobBytes"]
  key_links:
    - from: "src/lib/filename.ts"
      to: "src/types"
      via: "SourceDensity type import"
      pattern: "from '@/types'"
    - from: "src/lib/memory-budget.ts"
      to: "navigator.deviceMemory"
      via: "device probe with ?? 4 fallback"
      pattern: "deviceMemory \\?\\? 4"
---

<objective>
Ship three pure-function utility modules that downstream waves depend on: PNG dimension sniff (`src/lib/sniff.ts`), filename suffix + collision dedup (`src/lib/filename.ts`), and memory budget + byte-estimate math (`src/lib/memory-budget.ts`). All three are framework-free — no React, no zustand, no jSquash imports — so they unit-test under `node --experimental-strip-types` without browser shims.

Purpose: The PNG adapter (Plan 04-03) needs `sniffPngDimensions` for the byte-estimate; the pool admission gate (Plan 04-04) needs `computeMemoryBudget` + `estimateJobBytes`; the files-store fan-out (Plan 04-05) needs `applyDensitySuffix` + `deduplicateName`. Landing these as pure modules in Wave 1 unblocks Wave 2 plans to execute in parallel.

Output: Three new files in `src/lib/`. Plan 04-01's `filename.test.ts` flips from "module-not-found counted-pass" to live assertions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md
@.planning/phases/04-decode-resize-memory-model/04-RESEARCH.md
@.planning/phases/04-decode-resize-memory-model/04-PATTERNS.md
@src/lib/format.ts
@src/lib/object-url.ts
@src/types/index.ts
@src/tests/filename.test.ts
@src/tests/svg-adapter.unit.ts

<interfaces>
Pure-function shape model — copy from `src/lib/format.ts` (named exports, no side effects, no top-level state):

```typescript
// src/lib/format.ts (existing pattern)
export function fmtBytes(n: number): string { /* ... */ }
export function fmtPct(orig: number, opt: number): string { /* ... */ }
```

Type imports use the `@/types` alias (verified in `src/lib/object-url.ts` line 1: `import { useRuntimeStore } from '@/stores/runtime'`).

`SourceDensity` and `ResizeAlg` are both exported from `src/types/index.ts` (lines 10, 37).

Source code excerpts to port verbatim are in 04-PATTERNS.md lines 264-290 (memory-budget), 294-315 (sniff), 320-356 (filename) and 04-RESEARCH.md lines 670-685 (sniff), 691-710 (filename), 379-385 (memory budget).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/lib/sniff.ts + src/lib/memory-budget.ts</name>
  <read_first>
    - src/lib/format.ts (pure-function module shape — analog)
    - src/lib/object-url.ts (alias-import shape — `@/stores/runtime`)
    - .planning/phases/04-decode-resize-memory-model/04-RESEARCH.md (lines 668-685, 379-385 — verbatim source)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 264-290, 294-315 — pattern + RFC 2083 reference)
  </read_first>
  <files>src/lib/sniff.ts, src/lib/memory-budget.ts</files>
  <behavior>
    - `sniffPngDimensions(blob: Blob)` returns `{ width: 800, height: 600 }` for the Plan-04-01 fixture `density-2x.png`.
    - `sniffPngDimensions` returns `null` for a Blob whose first 8 bytes are NOT the PNG signature `89 50 4E 47 0D 0A 1A 0A`.
    - `sniffPngDimensions` returns `null` for a Blob smaller than 24 bytes.
    - `computeMemoryBudget()` with `navigator.deviceMemory = 8` returns `600 * 1024 * 1024` (capped).
    - `computeMemoryBudget()` with `navigator.deviceMemory = undefined` returns `600 * 1024 * 1024` (fallback to 4 GB → cap).
    - `computeMemoryBudget()` with `navigator.deviceMemory = 0.5` returns `Math.min(0.75 * 0.5 * 1024, 600) * 1024 * 1024 = 384 * 1024 * 1024` (uncapped).
    - `estimateJobBytes(2000, 1500, 1000, 750)` returns `Math.ceil((3_000_000 + 750_000) * 4 * 1.75) = 26_250_000`.
  </behavior>
  <action>
1. **`src/lib/sniff.ts`** — copy verbatim from RESEARCH §Code Examples (lines 670-685) with this header:
```typescript
// Phase 4 — Pre-decode PNG dimension sniff (24-byte read).
// Source: 04-RESEARCH.md §Code Examples (lines 668-685); RFC 2083 PNG spec.
// Used by useFilesStore.addSourceWithVariants (Plan 04-05) to seed the
// byte-estimate for the admission gate BEFORE the worker pool dispatches
// the decode job. Pure async function — no React, no jSquash, no DOM.

export async function sniffPngDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  if (blob.size < 24) return null
  const buf = await blob.slice(0, 24).arrayBuffer()
  const view = new DataView(buf)
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null
  // IHDR chunk at offset 8: 4-byte length, 4-byte type "IHDR" (0x49484452),
  // width@16, height@20.
  if (view.getUint32(12) !== 0x49484452) return null
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
```

2. **`src/lib/memory-budget.ts`** — copy verbatim from PATTERNS lines 270-290:
```typescript
// Phase 4 D-12 + D-11(b) — dynamic device-aware memory budget + per-job byte estimate.
// Source: 04-RESEARCH.md §3 (cross-browser deviceMemory survey, lines 379-385)
// + §2.2 (peak working-set formula, lines 293-303).
//
// Firefox + Safari return undefined for navigator.deviceMemory → ?? 4 fallback.
// Chrome reports 0.25 | 0.5 | 1 | 2 | 4 | 8 (capped at 8 to mitigate fingerprinting).
// 600 MB cap leaves 200 MB headroom under SC-2's 800 MB ceiling for non-pipeline
// browser overhead.

const MAX_BUDGET_BYTES = 600 * 1024 * 1024

export function computeMemoryBudget(): number {
  const dm = (typeof navigator !== 'undefined'
    ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
    : undefined) ?? 4
  const rawMb = 0.75 * dm * 1024
  return Math.min(rawMb * 1024 * 1024, MAX_BUDGET_BYTES)
}

// 1.75x multiplier on (src + tgt) × 4 bytes covers WASM heap intermediate
// buffers (decode + resize linear-RGB temp + encode). Wave 0 perf budget
// task (Plan 04-03) validates empirically; revisit if SC-2 50-file batch
// exceeds 800 MB peak.
export function estimateJobBytes(
  srcW: number,
  srcH: number,
  tgtW: number,
  tgtH: number,
): number {
  const srcPixels = srcW * srcH
  const tgtPixels = tgtW * tgtH
  return Math.ceil((srcPixels + tgtPixels) * 4 * 1.75)
}
```

3. **Add a Wave 1 spec** at the bottom of `src/tests/filename.test.ts` is not the right home; instead, append a small inline node-script-style verifier at the END of the existing `src/tests/settings-icc.test.ts` import block (which already imports from a `.ts` source) — actually, simpler: create no new spec. Plan 04-01 already covers this via the filename.test.ts harness, which will pick up the new `src/lib/filename.ts` in Task 2 of THIS plan. memory-budget + sniff are consumed by Wave 2 plans which carry their own integration tests.
  </action>
  <verify>
    <automated>npx tsc --noEmit && node --experimental-strip-types -e "
import('./src/lib/sniff.ts').then(async (m) => {
  const { readFileSync } = await import('node:fs');
  const buf = readFileSync('src/tests/fixtures/density-2x.png');
  const blob = new Blob([buf], { type: 'image/png' });
  const dims = await m.sniffPngDimensions(blob);
  if (dims?.width !== 800 || dims?.height !== 600) { console.error('FAIL dims:', dims); process.exit(1); }
  const empty = await m.sniffPngDimensions(new Blob([new Uint8Array(10)]));
  if (empty !== null) { console.error('FAIL empty:', empty); process.exit(1); }
  const fake = await m.sniffPngDimensions(new Blob([new Uint8Array(40)]));
  if (fake !== null) { console.error('FAIL fake:', fake); process.exit(1); }
  console.log('sniff OK');
});
import('./src/lib/memory-budget.ts').then((m) => {
  // navigator is undefined in node — the fallback path returns 600 MB cap.
  const b = m.computeMemoryBudget();
  if (b !== 600 * 1024 * 1024) { console.error('FAIL budget:', b); process.exit(1); }
  const est = m.estimateJobBytes(2000, 1500, 1000, 750);
  if (est !== Math.ceil((3000000 + 750000) * 4 * 1.75)) { console.error('FAIL estimate:', est); process.exit(1); }
  console.log('memory-budget OK');
});
"</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - The inline node verifier prints `sniff OK` AND `memory-budget OK` and exits 0.
    - `grep -c '^export ' src/lib/sniff.ts` returns 1 (only `sniffPngDimensions` exported).
    - `grep -cE '^export (function|const)' src/lib/memory-budget.ts` returns 2 (`computeMemoryBudget`, `estimateJobBytes`).
    - `grep -c "import.*react\|import.*zustand\|import.*jsquash" src/lib/sniff.ts src/lib/memory-budget.ts` returns 0 (zero framework imports — pure modules).
  </acceptance_criteria>
  <done>Both modules exist with documented exports; sniff returns expected dims for the Plan-04-01 fixture; budget returns 600 MB cap for the node-no-navigator path; estimate matches the documented formula.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create src/lib/filename.ts and flip filename.test.ts to live</name>
  <read_first>
    - src/lib/format.ts (pure-string-helper analog)
    - src/types/index.ts (SourceDensity import target — line 10)
    - src/tests/filename.test.ts (Plan-04-01 stub — body becomes live with this task)
    - .planning/phases/04-decode-resize-memory-model/04-RESEARCH.md (lines 691-710 — verbatim source)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 320-356 — locked pattern with collision-aware insertion order)
  </read_first>
  <files>src/lib/filename.ts</files>
  <behavior>
    - `applyDensitySuffix('logo.png', '2x') === 'logo@2x.png'` (basic append).
    - `applyDensitySuffix('logo@2x.png', '1x') === 'logo@1x.png'` (idempotent — strips existing density before re-appending).
    - `applyDensitySuffix('logo@3x.png', '3x') === 'logo@3x.png'` (no double-tag).
    - `applyDensitySuffix('logo', '3x') === 'logo@3x'` (no extension, no dot prefix).
    - `applyDensitySuffix('archive.tar.gz', '2x') === 'archive.tar@2x.gz'` (lastIndexOf('.') — only the final extension is preserved; documented behavior).
    - `deduplicateName('logo@1x.png', new Set())` returns `'logo@1x.png'` (no collision passthrough).
    - `deduplicateName('logo@1x.png', new Set(['logo@1x.png']))` returns `'logo (2)@1x.png'` (insert (2) BEFORE @Nx).
    - `deduplicateName('logo@2x.png', new Set(['logo@2x.png', 'logo (2)@2x.png']))` returns `'logo (3)@2x.png'`.
    - `deduplicateName('plain.png', new Set(['plain.png']))` returns `'plain.png'` unchanged when there is no `@Nx` suffix to insert before (regex no-match passthrough — documented behavior; addSourceWithVariants ALWAYS calls applyDensitySuffix first, so `proposed` will always have a density tag in production).
  </behavior>
  <action>
1. **Create `src/lib/filename.ts`** — verbatim from PATTERNS.md lines 326-356, but use the relative `../types` path so the unit test under `node --experimental-strip-types` (which does not resolve the `@/` alias) can import it without TS path config:
```typescript
// Phase 4 D-03 + D-16 — density suffix templating + collision dedup.
// Source: 04-RESEARCH.md §6.1 + §6.2; CONTEXT.md D-16 amendment.
// Pure functions — no React, no zustand. Unit-tested via --experimental-strip-types
// (src/tests/filename.test.ts).

import type { SourceDensity } from '../types/index.ts'

/** Idempotent: strip an existing @1x/@2x/@3x before re-appending. So
 *  applyDensitySuffix('logo@2x.png', '1x') === 'logo@1x.png', NOT 'logo@2x@1x.png'. */
export function applyDensitySuffix(originalName: string, density: SourceDensity): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  const stripped = base.replace(/@[123]x$/, '')
  return `${stripped}@${density}${ext}`
}

/** D-16 — order-of-operations: applyDensitySuffix runs FIRST, then dedup
 *  against the existing FileEntry name set. Insert " (N)" BEFORE the @Nx
 *  suffix so the extension and density tag stay terminal. */
export function deduplicateName(proposed: string, takenSet: ReadonlySet<string>): string {
  if (!takenSet.has(proposed)) return proposed
  // Strip the @Nx suffix so " (N)" inserts before it.
  const m = proposed.match(/^(.*?)(@[123]x)(\.[^.]+)?$/)
  if (!m) return proposed
  const [, head, density, ext = ''] = m
  for (let i = 2; i < 1000; i++) {
    const candidate = `${head} (${i})${density}${ext}`
    if (!takenSet.has(candidate)) return candidate
  }
  return `${head} (${crypto.randomUUID().slice(0, 8)})${density}${ext}`
}
```

2. **Confirm Plan 04-01's `src/tests/filename.test.ts` now passes its live assertions** — the file already contains the live `assert(...)` block inside the `try` (Plan 04-01 Task 2 step 4). With `src/lib/filename.ts` shipped, the dynamic import resolves and all 6 assertions execute. No edit needed unless the path mismatches.

3. **Verify** the test file imports relative path `'../lib/filename.ts'` (matches the file we just shipped). If Plan 04-01 wrote the import as `'../lib/filename'` without `.ts`, leave it — node `--experimental-strip-types` resolves both. If executor finds it points elsewhere, fix only the import line in `src/tests/filename.test.ts`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && node --experimental-strip-types src/tests/filename.test.ts | tee /tmp/filename-test.log; grep -E '^[6-9] passed, 0 failed|^1[0-9] passed, 0 failed' /tmp/filename-test.log</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `node --experimental-strip-types src/tests/filename.test.ts` exits 0 AND stdout contains the substring `6 passed, 0 failed` (live assertions ran — module resolved, no longer the Wave 0 stub-pass path).
    - `grep -c "^export function applyDensitySuffix" src/lib/filename.ts` returns 1.
    - `grep -c "^export function deduplicateName" src/lib/filename.ts` returns 1.
    - `grep -c "import.*react\|import.*zustand\|import.*jsquash" src/lib/filename.ts` returns 0.
  </acceptance_criteria>
  <done>filename.ts exports both functions; the unit test prints `6 passed, 0 failed`, confirming the Wave 0 stub-pass branch is no longer triggered.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User filename → FileEntry.name | User-supplied filename string is used in DOM, ZIP, snippets — must not enable injection downstream |
| navigator.deviceMemory → memory budget | Browser-supplied number; treat as untrusted but spec-bounded (0.25..8) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-02-01 | Tampering | `applyDensitySuffix` regex `/@[123]x$/` | mitigate | Anchored regex (`$`) prevents middle-of-string false matches; ext-preserving split via `lastIndexOf('.')` is deterministic. Unit tests in this plan cover the idempotence + extension cases. |
| T-04-02-02 | Information Disclosure | `deduplicateName` infinite-loop fallback | mitigate | Hard-stop at i=1000; falls back to `crypto.randomUUID().slice(0,8)` rather than throwing. Worst case: a non-collision-free name leaks a partial UUID — acceptable since UUIDs carry no meaning. |
| T-04-02-03 | Denial of Service | `sniffPngDimensions` reading 24 bytes from arbitrarily-large Blob | mitigate | `blob.slice(0, 24).arrayBuffer()` reads ONLY 24 bytes regardless of source size; no full-blob materialization. |
| T-04-02-04 | Spoofing | `sniffPngDimensions` accepts any blob with PNG-shaped header | accept | Caller (Plan 04-05 addSourceWithVariants) only trusts dimensions, not content; full decode validation happens in the worker (Plan 04-03 png-adapter throws AdapterError on malformed bytes). |
| T-04-02-05 | Elevation of Privilege | `computeMemoryBudget` uses navigator.deviceMemory unchecked | mitigate | Math.min cap at 600 MB regardless of input; even a forged `deviceMemory = 9999` value caps output. Lower bound implicit (Math.min with positive multiplication). |
</threat_model>

<verification>
- All three modules import zero React/zustand/jSquash dependencies.
- `npx tsc --noEmit` clean.
- Plan 04-01's `src/tests/filename.test.ts` flips from "module-not-found counted-pass" to "6 live assertions passed".
- `sniffPngDimensions` round-trips correctly on Plan-04-01 fixture (800x600).
- `computeMemoryBudget()` returns 600 MB cap in Node (no navigator) and on Chrome ≥4 GB devices (per spec).
</verification>

<success_criteria>
- Three new files in `src/lib/`.
- `filename.test.ts` reports "6 passed, 0 failed".
- TypeScript compiles cleanly.
- No framework imports leaked into pure modules.
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-02-SUMMARY.md` listing the three modules, their exports, and the empirically-verified test case for each.
</output>
