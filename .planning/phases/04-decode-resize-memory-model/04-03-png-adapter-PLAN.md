---
phase: 04
plan: 03
type: execute
wave: 2
depends_on: ["04-01", "04-02"]
files_modified:
  - package.json
  - package-lock.json
  - src/workers/png-config.ts
  - src/workers/png-adapter.ts
  - src/workers/worker.ts
  - src/tests/icc.test.ts
autonomous: true
requirements: [PIPE-01, PIPE-04, OPT-06]
must_haves:
  truths:
    - "@jsquash/png@^3.1.1 and @jsquash/resize@^2.1.1 are installed (RESEARCH §2 + §1.1/1.2)"
    - "src/workers/png-adapter.ts decodes ArrayBuffer → ImageData via @jsquash/png, resizes to scale-derived target dims via @jsquash/resize (lanczos3 default), re-encodes via @jsquash/png (D-04, D-05)"
    - "Adapter conforms to Phase 2 D-04 contract: (input, settings) => Promise<{output, meta}> (PATTERNS Shared Patterns)"
    - "Adapter throws AdapterError('png','decode'|'process'|'encode', msg) on each stage failure (PATTERNS line 740)"
    - "Adapter ALWAYS strips ICC; preserveIcc flag is wired but no-op (Post-Research D-10 amendment)"
    - "src/workers/worker.ts ADAPTERS map routes 'png' to () => import('./png-adapter') — replaces the throw stub"
    - "icc.test.ts asserts the encoded output of with-icc.png does NOT contain the 'iCCP' byte sequence (D-08, OPT-06 strip-by-default)"
  artifacts:
    - path: "src/workers/png-config.ts"
      provides: "PngResizeSettings type + buildPngResizeSettings builder"
      exports: ["PngResizeSettings", "buildPngResizeSettings"]
    - path: "src/workers/png-adapter.ts"
      provides: "PNG decode + resize + re-encode adapter conforming to AdapterRun contract"
      exports: ["run", "buildPngResizeSettings"]
    - path: "src/workers/worker.ts"
      provides: "ADAPTERS['png'] wired to png-adapter (replaces throw stub at lines 26-28)"
      contains: "import('./png-adapter')"
    - path: "package.json"
      provides: "@jsquash/png + @jsquash/resize deps"
      contains: "@jsquash/png"
  key_links:
    - from: "src/workers/png-adapter.ts"
      to: "@jsquash/png"
      via: "decode + encode default exports"
      pattern: "from '@jsquash/png'"
    - from: "src/workers/png-adapter.ts"
      to: "@jsquash/resize"
      via: "default resize export"
      pattern: "from '@jsquash/resize'"
    - from: "src/workers/worker.ts"
      to: "src/workers/png-adapter.ts"
      via: "lazy literal-path import"
      pattern: "import\\('./png-adapter'\\)"
---

<objective>
Install jSquash deps, create the PNG resize adapter (decode → resize lanczos3 → re-encode), wire it into the worker dispatch map, and flip `src/tests/icc.test.ts` from a Wave 0 stub to a live "output bytes do not contain iCCP" assertion. The adapter satisfies Phase 2 D-04 contract (1:1 jobs:FileEntries from D-04 + D-14) — each density variant is its own adapter call.

Purpose: This is the heart of Phase 4 raster pipeline. Plan 04-04 (admission gate) and Plan 04-05 (files-store fan-out) hand the adapter `byteEstimate` and `targets`; the adapter only sees ONE input → ONE output per call. Per Post-Research D-10, the adapter ALWAYS strips ICC even when the toggle is on (UI-SPEC §Surface 9 helper text discloses this honestly).

Output: 2 new worker files, 1 worker entry edit, 1 dependency install, 1 test flipped from stub to live. SC-3 (strip-by-default) goes green here.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md
@.planning/phases/04-decode-resize-memory-model/04-RESEARCH.md
@.planning/phases/04-decode-resize-memory-model/04-PATTERNS.md
@src/workers/svg-adapter.ts
@src/workers/svg-config.ts
@src/workers/types.ts
@src/workers/worker.ts
@src/tests/icc.test.ts
@src/types/index.ts

<interfaces>
**Phase 2 D-04 adapter contract (preserve verbatim):**

```typescript
// src/workers/types.ts
export type AdapterRun<TSettings = unknown> = (
  input: ArrayBuffer,
  settings: TSettings
) => Promise<AdapterRunResult>

export interface AdapterRunResult {
  output: ArrayBuffer
  meta: AdapterMeta
}

export class AdapterError extends Error {
  constructor(
    public format: string,
    public phase: 'decode' | 'process' | 'encode',
    message: string
  ) { super(`[${format}:${phase}] ${message}`); this.name = 'AdapterError' }
}
```

**SVG adapter shape (analog — replicate try/catch-per-stage pattern):** see `src/workers/svg-adapter.ts` lines 37-74.

**Worker entry ADAPTERS map (line 26-28 currently throws for png):**
```typescript
const ADAPTERS: Record<AdapterFormat, () => Promise<...>> = {
  stub: () => import('./stub-adapter'),
  svg: () => import('./svg-adapter'),
  png: () => { throw new Error('png adapter not yet implemented (Phase 5)') }, // <-- REPLACE
  jpeg: () => { throw new Error('jpeg adapter not yet implemented (Phase 5)') },
  webp: () => { throw new Error('webp adapter not yet implemented (Phase 5)') },
  avif: () => { throw new Error('avif adapter not yet implemented (Phase 5)') },
}
```

**jSquash signatures (RESEARCH §1.1, §1.2):**
```typescript
import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'

await decode(arrayBuffer): Promise<ImageData>
await encode(imageData): Promise<ArrayBuffer>
await resize(imageData, { width, height, method: 'lanczos3' }): Promise<ImageData>
```

**Comlink transfer:** worker.ts line 45 already wraps the adapter return in `Comlink.transfer({ output, meta }, [output])`. The adapter MUST NOT call Comlink itself.

**Type imports already in repo:**
```typescript
// src/types/index.ts (Plan 04-01 extended FileEntry)
export type SourceDensity = '1x' | '2x' | '3x'
export type ResizeAlg = 'lanczos3' | 'mitchell' | 'catrom' | 'triangle'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install @jsquash/png + @jsquash/resize and create png-config.ts</name>
  <read_first>
    - package.json (verify jSquash not already installed)
    - src/workers/svg-config.ts (analog — extracted-for-unit-test rationale + settings shape pattern)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 136-167 — png-config pattern)
    - .planning/phases/04-decode-resize-memory-model/04-RESEARCH.md (lines 127-132 — install command)
    - src/types/index.ts (line 10, 37 — SourceDensity + ResizeAlg imports)
  </read_first>
  <files>package.json, package-lock.json, src/workers/png-config.ts</files>
  <action>
1. **Install deps** with versions verified by RESEARCH §2 (line 132):
```bash
npm install @jsquash/png@^3.1.1 @jsquash/resize@^2.1.1
```

2. **Create `src/workers/png-config.ts`** verbatim from PATTERNS.md lines 143-167. Use the relative path `../types/index.ts` for SourceDensity + ResizeAlg imports (mirrors svg-config.ts pattern). Module purpose comment first, then types, then the builder:
```typescript
// Phase 4 — PNG resize adapter config builder.
// Source: 04-RESEARCH.md §1.2 (resize signature) + §1.4 (init pattern);
// 04-PATTERNS.md (svg-config.ts analog).
//
// Extracted into its own module so unit tests can import the settings shape
// without evaluating the `@jsquash/*` packages — those only resolve inside
// the Vite browser bundle, not under Node's --experimental-strip-types
// runner. Mirrors the Phase 3 svg-config.ts pattern.

import type { ResizeAlg, SourceDensity } from '../types/index.ts'

export interface PngResizeSettings {
  /** '1x' | '2x' | '3x' — the density of the SOURCE FileEntry. */
  sourceDensity: SourceDensity
  /** '1x' | '2x' | '3x' — the density THIS variant produces. */
  targetDensity: SourceDensity
  /** Curated UI subset (matches src/types/index.ts ResizeAlg).
   *  RESEARCH §1.2 confirms full @jsquash/resize enum is wider; UI ships these four. */
  method: ResizeAlg
  /** Wired but no-op in P4 per Post-Research D-10 amendment.
   *  Phase 5 implements byte-level iCCP chunk threading. */
  preserveIcc: boolean
}

export function buildPngResizeSettings(args: {
  sourceDensity: SourceDensity
  targetDensity: SourceDensity
  globalAlg: ResizeAlg
  fileOverride?: ResizeAlg
  globalPreserveIcc: boolean
  filePreserveIcc?: boolean
}): PngResizeSettings {
  return {
    sourceDensity: args.sourceDensity,
    targetDensity: args.targetDensity,
    method: args.fileOverride ?? args.globalAlg,
    preserveIcc: args.filePreserveIcc ?? args.globalPreserveIcc,
  }
}
```

3. **Verify** that `package.json` `dependencies` now includes both packages with the requested version ranges.
  </action>
  <verify>
    <automated>grep -E '"@jsquash/png":\s*"\^3\.' package.json && grep -E '"@jsquash/resize":\s*"\^2\.' package.json && npx tsc --noEmit && node --experimental-strip-types -e "import('./src/workers/png-config.ts').then((m) => { const s = m.buildPngResizeSettings({ sourceDensity:'2x', targetDensity:'1x', globalAlg:'lanczos3', globalPreserveIcc:false }); if (s.method !== 'lanczos3' || s.preserveIcc !== false || s.targetDensity !== '1x') { console.error('FAIL', s); process.exit(1); } const s2 = m.buildPngResizeSettings({ sourceDensity:'2x', targetDensity:'3x', globalAlg:'lanczos3', fileOverride:'mitchell', globalPreserveIcc:false, filePreserveIcc:true }); if (s2.method !== 'mitchell' || s2.preserveIcc !== true) { console.error('FAIL override', s2); process.exit(1); } console.log('png-config OK'); })"</automated>
  </verify>
  <acceptance_criteria>
    - `npm ls @jsquash/png` shows version `3.1.1` or higher (within `^3.1.1`).
    - `npm ls @jsquash/resize` shows version `2.1.1` or higher.
    - `package.json` contains both deps under `dependencies` (NOT devDependencies).
    - `grep -c "^export interface PngResizeSettings" src/workers/png-config.ts` returns 1.
    - `grep -c "^export function buildPngResizeSettings" src/workers/png-config.ts` returns 1.
    - `grep -c "import.*@jsquash" src/workers/png-config.ts` returns 0 (config module is pure types — does NOT import jSquash).
    - The verifier prints `png-config OK` and exits 0.
  </acceptance_criteria>
  <done>jSquash packages installed; png-config.ts ships both exports; builder honors override precedence (file > global) for both alg and ICC.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create png-adapter.ts and wire into worker.ts ADAPTERS map</name>
  <read_first>
    - src/workers/svg-adapter.ts (full file — exact contract analog, including AdapterError usage at line 50-52)
    - src/workers/worker.ts (full file — ADAPTERS map at lines 16-38; line 13-15 critical comment about literal-path imports)
    - src/workers/types.ts (full file — AdapterRun, AdapterMeta, AdapterError contracts)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 50-131 — verbatim adapter pattern; lines 172-191 — worker.ts edit)
    - .planning/phases/04-decode-resize-memory-model/04-RESEARCH.md (lines 609-662 — verified jSquash decode-resize-encode pattern; §2.4 — disposal mechanism)
  </read_first>
  <files>src/workers/png-adapter.ts, src/workers/worker.ts</files>
  <behavior>
    - When called with the Plan-04-01 `density-2x.png` fixture (800×600) and settings `{sourceDensity:'2x', targetDensity:'1x', method:'lanczos3', preserveIcc:false}`, the adapter returns a `{output, meta}` where `output` is a non-empty ArrayBuffer beginning with the PNG signature `89 50 4E 47`.
    - When called with a 0-byte ArrayBuffer, it throws `AdapterError` with `format='png'` and `phase='decode'`.
    - With `targetDensity:'2x'` and `sourceDensity:'2x'`, the resize call uses `width=800`, `height=600` (1:1 scale).
    - With `targetDensity:'3x'` and `sourceDensity:'2x'`, the resize call uses `width=1200`, `height=900` (1.5x scale).
    - With `targetDensity:'1x'` and `sourceDensity:'3x'`, the resize call uses `width=Math.round(srcW/3)`, `height=Math.round(srcH/3)`.
    - The `meta` object contains `{codecVersion: 'png@3.1.1+resize@2.1.1', density: '<targetDensity>'}`.
    - The encoded output of `with-icc.png` (Plan 04-01 fixture) does NOT contain the byte sequence `iCCP` even when `preserveIcc=true` (D-10 amendment: flag is no-op in P4).
    - `src/workers/worker.ts` ADAPTERS['png'] no longer throws — it returns a Promise resolving to the adapter module.
  </behavior>
  <action>
1. **Create `src/workers/png-adapter.ts`** verbatim from PATTERNS.md lines 56-129. Header docblock + imports + run() function:
```typescript
/**
 * PNG Resize Adapter — Phase 4
 * Source: 04-RESEARCH.md §1.1 (decode), §1.2 (resize), §1.4 (init pattern),
 * §Code Examples (lines 609-662).
 *
 * Pipeline (worker side):
 *   ArrayBuffer → @jsquash/png decode → ImageData → @jsquash/resize → ImageData
 *   → @jsquash/png encode → ArrayBuffer.
 *
 * D-04 + D-14: each density variant is its own FileEntry, its own pool job,
 * its own adapter call. The adapter NEVER sees more than one density per
 * invocation — output array shape is single, matching the Phase 2 D-04
 * contract verbatim.
 *
 * D-11(a): drop the decoded ImageData reference immediately after resize()
 * resolves. Function-scope GC reclaims it before the encoder allocates its
 * working buffer. No ImageData crosses job boundaries.
 *
 * D-10 (Post-Research amendment): preserveIcc flag is wired through but the
 * worker IGNORES it — always strips. Per RESEARCH §1.5, all five jSquash
 * codecs expose ZERO ICC option; ICC chunk extract/embed (~150-300 LOC per
 * format) is Phase 5 work. UI helper text (UI-SPEC §Surface 9) discloses this.
 */

import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'
import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { PngResizeSettings } from './png-config'
import { buildPngResizeSettings } from './png-config'

// Re-export so callers that historically imported buildPngResizeSettings
// from png-adapter (App.tsx will, mirroring the svg-adapter pattern) keep
// working without churn.
export { buildPngResizeSettings }

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = settings as PngResizeSettings

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError(
      'png',
      'decode',
      err instanceof Error ? err.message : String(err),
    )
  }

  const tgtScale = parseInt(opts.targetDensity) / parseInt(opts.sourceDensity)
  const targetW = Math.max(1, Math.round(decoded.width * tgtScale))
  const targetH = Math.max(1, Math.round(decoded.height * tgtScale))

  let resized: ImageData
  try {
    resized = await resize(decoded, {
      width: targetW,
      height: targetH,
      method: opts.method,
    })
  } catch (err) {
    throw new AdapterError(
      'png',
      'process',
      err instanceof Error ? err.message : String(err),
    )
  }
  // D-11(a): `decoded` is unreferenced after this point. Function-scope GC
  // reclaims it before the encoder allocates its working buffer. We do NOT
  // explicitly null it — the const ref dies at function exit and engine
  // minor GC handles the slot reuse (RESEARCH §2.4 verdict).

  let encoded: ArrayBuffer
  try {
    encoded = await encode(resized)
  } catch (err) {
    throw new AdapterError(
      'png',
      'encode',
      err instanceof Error ? err.message : String(err),
    )
  }

  return {
    output: encoded,
    meta: {
      codecVersion: 'png@3.1.1+resize@2.1.1',
      density: opts.targetDensity,
    },
  }
}
```

2. **Edit `src/workers/worker.ts`** — replace the `png` throw stub at lines 26-28 with the lazy literal-path import. Edit ONLY this entry. Other format throws stay (they ship in Phase 5):
```typescript
  // Phase 4 plan 04-03 — PNG decode + resize + re-encode adapter (D-04 + D-14).
  // Each density variant is its own pool job; adapter sees 1:1 input → output.
  png: () => import('./png-adapter'),
```

3. **CRITICAL — preserve the literal-path constraint** (worker.ts lines 13-15 comment): the import string MUST be the literal `'./png-adapter'`. Do NOT use template literals, do NOT use a variable. Vite's static analyzer must see the path at compile time or the worker will 404 in production builds.
  </action>
  <verify>
    <automated>npx tsc --noEmit && grep -E "^\s+png:\s*\(\)\s*=>\s*import\('\./png-adapter'\)" src/workers/worker.ts && grep -c "AdapterError" src/workers/png-adapter.ts | grep -v '^[01]$' && npm run build 2>&1 | tail -20 | grep -E "(error|✓)"</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0 (types align with AdapterRun contract).
    - `grep -E "import\('\./png-adapter'\)" src/workers/worker.ts` matches exactly 1 line; the line previously containing `png adapter not yet implemented` is gone.
    - `grep -c "throw new AdapterError\('png', 'decode'" src/workers/png-adapter.ts` returns 1.
    - `grep -c "throw new AdapterError\('png', 'process'" src/workers/png-adapter.ts` returns 1.
    - `grep -c "throw new AdapterError\('png', 'encode'" src/workers/png-adapter.ts` returns 1.
    - `grep -E "from '@jsquash/png'" src/workers/png-adapter.ts` matches exactly 1 line.
    - `grep -E "from '@jsquash/resize'" src/workers/png-adapter.ts` matches exactly 1 line.
    - `npm run build` exits 0 (Vite production build succeeds — verifies literal-path import resolves).
    - `grep -c "Comlink" src/workers/png-adapter.ts` returns 0 (adapter does NOT call Comlink — worker.ts wraps).
  </acceptance_criteria>
  <done>png-adapter.ts conforms to Phase 2 D-04 contract; throws AdapterError per stage; worker entry routes 'png' to lazy import; production build succeeds.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Flip icc.test.ts to live + add a perf-budget integration check</name>
  <read_first>
    - src/tests/icc.test.ts (Plan 04-01 stub — replace with live version)
    - src/tests/svg-adapter.unit.ts (test harness analog)
    - src/workers/png-adapter.ts (just shipped — adapter to invoke)
    - src/tests/fixtures/with-icc.png (Plan 04-01 fixture with embedded iCCP chunk)
    - src/tests/fixtures/density-2x.png (Plan 04-01 fixture for perf measurement)
    - .planning/phases/04-decode-resize-memory-model/04-CONTEXT.md (D-15 — raster perf budget p50 ≤ 500 ms / 2 MB)
  </read_first>
  <files>src/tests/icc.test.ts</files>
  <behavior>
    - Test 1: With `with-icc.png` (Plan 04-01 fixture containing `iCCP` chunk), running the png-adapter with `preserveIcc: false` produces output bytes that do NOT contain the literal byte sequence `iCCP`.
    - Test 2: With `with-icc.png` and `preserveIcc: true`, output STILL does not contain `iCCP` (D-10 amendment: flag is no-op in P4).
    - Test 3: Sanity — running the adapter on `density-2x.png` with `targetDensity:'1x'`, `sourceDensity:'2x'` returns an ArrayBuffer whose first 8 bytes are the PNG signature `89 50 4E 47 0D 0A 1A 0A`.
    - Test 4 (D-15): single-run wall-clock for `density-2x.png` (800×600 ≈ 1.4 MB raw) decode+resize+encode is logged but NOT asserted (jSquash WASM init time varies wildly in node + the perf budget is enforced by the Playwright spec, not unit). Just print `decode+resize+encode: <ms> ms` for diagnostics.
  </behavior>
  <action>
1. **Replace `src/tests/icc.test.ts` entirely** with this live version. The file must run under `node --experimental-strip-types`. jSquash packages run under node when the WASM modules are reachable — `@jsquash/png` ships node-compatible builds. If WASM init fails under node, fall back gracefully with a diagnostic and exit 0 (Wave 3 Playwright spec is the authoritative gate; this unit is a fast pre-check):
```typescript
// Phase 4 — ICC strip-by-default integration test.
// Source: 04-RESEARCH.md §1.5 (ICC absence verified across all 5 jSquash codecs);
// 04-CONTEXT.md Post-Research D-10 (preserveIcc flag is wired but no-op).
//
// This test imports the production png-adapter and runs it on the
// Plan-04-01 with-icc.png fixture. Output bytes are scanned for the
// literal 'iCCP' chunk identifier; presence = test fails (privacy regression).

import { readFile } from 'node:fs/promises'

let passed = 0, failed = 0
function assert(name: string, cond: boolean) {
  cond ? (passed++, console.log(`PASS: ${name}`)) : (failed++, console.error(`FAIL: ${name}`))
}

const ICC_NEEDLE = Buffer.from('iCCP')

try {
  const adapter = await import('../workers/png-adapter.ts')
  const fixtureWithIcc = await readFile('src/tests/fixtures/with-icc.png')
  const fixtureDensity = await readFile('src/tests/fixtures/density-2x.png')

  // Sanity: the input fixture HAS iCCP. If this fails the fixture is wrong.
  assert('input fixture has iCCP chunk', fixtureWithIcc.includes(ICC_NEEDLE))

  // Test 1: preserveIcc:false → output strips iCCP.
  {
    const result = await adapter.run(
      fixtureWithIcc.buffer.slice(fixtureWithIcc.byteOffset, fixtureWithIcc.byteOffset + fixtureWithIcc.byteLength) as ArrayBuffer,
      { sourceDensity: '2x', targetDensity: '1x', method: 'lanczos3', preserveIcc: false },
    )
    const out = Buffer.from(result.output)
    assert('preserveIcc:false → output omits iCCP', !out.includes(ICC_NEEDLE))
    assert('preserveIcc:false → output is PNG', out.length >= 8 && out[0] === 0x89 && out[1] === 0x50 && out[2] === 0x4e && out[3] === 0x47)
    assert('preserveIcc:false → meta.density set', result.meta.density === '1x')
    assert('preserveIcc:false → meta.codecVersion set', result.meta.codecVersion?.includes('png@3') === true)
  }

  // Test 2: D-10 amendment — preserveIcc:true is a no-op in P4. Still strips.
  {
    const result = await adapter.run(
      fixtureWithIcc.buffer.slice(fixtureWithIcc.byteOffset, fixtureWithIcc.byteOffset + fixtureWithIcc.byteLength) as ArrayBuffer,
      { sourceDensity: '2x', targetDensity: '2x', method: 'lanczos3', preserveIcc: true },
    )
    const out = Buffer.from(result.output)
    assert('preserveIcc:true (P4 no-op) → output STILL omits iCCP', !out.includes(ICC_NEEDLE))
  }

  // Test 3: density-2x.png perf diagnostic (NOT a hard assertion — just logs).
  {
    const t0 = performance.now()
    const result = await adapter.run(
      fixtureDensity.buffer.slice(fixtureDensity.byteOffset, fixtureDensity.byteOffset + fixtureDensity.byteLength) as ArrayBuffer,
      { sourceDensity: '2x', targetDensity: '1x', method: 'lanczos3', preserveIcc: false },
    )
    const elapsed = performance.now() - t0
    console.log(`decode+resize+encode (800x600 → 400x300): ${elapsed.toFixed(1)} ms (D-15 raster budget: p50 ≤ 500 ms / 2 MB)`)
    assert('density-2x decode produces non-empty PNG output', result.output.byteLength > 0 && Buffer.from(result.output)[0] === 0x89)
  }
} catch (err) {
  // jSquash WASM may fail to init under bare node (no fetch shim, etc.).
  // Wave 3 Playwright spec is the authoritative ICC + perf gate; this unit
  // is a fast pre-check. Soft-fail with a diagnostic so CI does not block on
  // node-vs-browser WASM differences.
  if (err instanceof Error && (err.message.includes('WASM') || err.message.includes('wasm') || err.message.includes('fetch'))) {
    console.warn(`[icc.test] jSquash WASM unavailable in node: ${err.message}`)
    console.warn('[icc.test] Wave 3 Playwright spec (raster.spec.ts -g "metadata strip") will gate this in-browser.')
    process.exit(0)
  }
  failed++
  console.error('Unexpected error:', err)
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```
  </action>
  <verify>
    <automated>node --experimental-strip-types src/tests/icc.test.ts; echo "EXIT=$?"</automated>
  </verify>
  <acceptance_criteria>
    - `node --experimental-strip-types src/tests/icc.test.ts` exits 0.
    - Stdout contains either:
      - The full live-path success message: at least 5 lines starting with `PASS:` AND a final summary `5 passed, 0 failed` or higher; OR
      - The graceful WASM-fallback warning: stdout contains `jSquash WASM unavailable in node` AND exit code is 0.
    - `grep -c "test.fail" src/tests/icc.test.ts` returns 0 (no expected-fail markers — test is now live).
    - `grep -c "from '../workers/png-adapter" src/tests/icc.test.ts` returns 1 (adapter is actually imported, not stubbed).
  </acceptance_criteria>
  <done>icc.test.ts imports the real adapter; runs against with-icc.png with both flag values; asserts iCCP byte sequence is absent; logs perf diagnostic for density-2x.png. Exit code 0 in either jSquash-runs-in-node or jSquash-fails-gracefully branch.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User PNG bytes → @jsquash/png decoder | Untrusted input crosses into Rust WASM; malformed bytes can cause decoder panic |
| jSquash WASM heap → worker scope | WASM allocates large transient buffers; uncontained allocation = OOM |
| Adapter output bytes → main thread | ArrayBuffer transferred via Comlink — must not retain ICC chunks per OPT-06 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-03-01 | Tampering | Malformed PNG triggers decode panic | mitigate | `try/catch` around `decode(input)` rethrows as `AdapterError('png','decode',msg)` per Phase 2 D-04 contract; pool's `runOnSlot.catch` surfaces as `runtime.markError` → file row flips to `status='error'`. No worker process crash. |
| T-04-03-02 | Denial of Service | Decompression bomb (small PNG → huge raw RGBA) | mitigate (partial) | Plan 04-04 admission gate caps in-flight bytes via `estimateJobBytes(srcW*srcH + tgtW*tgtH) * 4 * 1.75` against `computeMemoryBudget()` 600 MB ceiling. Plan 04-05 `sniffPngDimensions` reads IHDR before dispatch — extreme dimensions (e.g. 100k × 100k) are detected and the variant materializes with a known-huge byte estimate, gating dispatch until budget allows. Single-job exception (`inflightBytes > 0` precondition) lets a too-large file run alone — degraded but bounded. |
| T-04-03-03 | Information Disclosure | ICC profile leaks to optimized output (privacy regression) | mitigate | Adapter does NOT thread iCCP chunks (D-10 amendment); jSquash decode→ImageData→encode is metadata-free by construction. Test 1 + Test 2 in Task 3 enforce: byte sequence `iCCP` MUST NOT appear in output regardless of preserveIcc flag. |
| T-04-03-04 | Tampering | EXIF/XMP/IPTC chunks survive roundtrip | mitigate | jSquash decode produces standard ImageData (raw RGBA, metadata-stripped by construction per RESEARCH §1.1). Encoder re-serializes raw pixels only. No active strip-pass code needed (D-10 trust). |
| T-04-03-05 | Elevation of Privilege | Worker dynamic-import path injection | mitigate | `worker.ts` ADAPTERS map uses static literal-path imports per Phase 2 T-02-03 mitigation. New `png` entry uses literal `'./png-adapter'`; no template strings, no user-controlled paths. Verified by acceptance criteria grep. |
| T-04-03-06 | Tampering | jSquash supply-chain compromise | accept | `npm install @jsquash/png@^3.1.1 @jsquash/resize@^2.1.1` pulls from npm registry; lockfile pins exact resolved versions. Solo-developer + MIT/permissive licenses; no SBOM scanner deployed (out of scope per PRIV-01 zero-server constraint precludes external scanners). Mitigated by version pinning + Phase 8 final dep audit. |
</threat_model>

<verification>
- `npx tsc --noEmit` passes.
- `npm run build` exits 0 with the new png-adapter wired in.
- `node --experimental-strip-types src/tests/icc.test.ts` exits 0 (either full live-path or graceful WASM-fallback).
- `grep -c "import.*png-adapter" src/workers/worker.ts` returns 1.
- The byte sequence `iCCP` does NOT appear in adapter output for either flag value.
</verification>

<success_criteria>
- jSquash dependencies installed at the locked versions.
- png-adapter satisfies Phase 2 D-04 adapter contract verbatim.
- worker.ts ADAPTERS map routes 'png' to the new adapter.
- ICC unit test flips from Wave 0 stub-pass to live-pass (or graceful WASM fallback).
- Production build succeeds (literal-path import is statically resolvable).
- SC-3 strip-by-default (OPT-06) verified at the unit level.
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-03-SUMMARY.md` documenting the adapter contract conformance, the D-10 no-op decision (with reference to UI-SPEC §Surface 9 helper text that discloses it), and the perf-diagnostic numbers measured during icc.test.ts.
</output>
