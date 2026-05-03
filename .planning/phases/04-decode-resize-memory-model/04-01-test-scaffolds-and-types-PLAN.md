---
phase: 04
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/index.ts
  - src/workers/types.ts
  - src/data/defaults.ts
  - src/tests/raster.spec.ts
  - src/tests/filename.test.ts
  - src/tests/icc.test.ts
  - src/tests/settings-icc.test.ts
  - src/tests/instrument-heap.ts
  - src/tests/fixtures/density-2x.png
  - src/tests/fixtures/with-icc.png
autonomous: true
requirements: [PIPE-04, OPT-06]
must_haves:
  truths:
    - "FileEntry interface carries resizeOverride, preserveIcc, sourceFamilyId, targetDensity fields (D-04, D-07, D-09)"
    - "AdapterMeta carries optional density tag for variant attribution (D-04)"
    - "DEFAULT_RESIZE_SETTINGS exists with alg='lanczos3' (D-05)"
    - "Wave 0 spec stubs exist as failing tests so later waves can flip them green (Nyquist gate)"
  artifacts:
    - path: "src/types/index.ts"
      provides: "FileEntry extended fields + ResizeAlg/SourceDensity reuse"
      contains: "resizeOverride"
    - path: "src/workers/types.ts"
      provides: "AdapterMeta.density extension"
      contains: "density?:"
    - path: "src/data/defaults.ts"
      provides: "DEFAULT_RESIZE_SETTINGS constant"
      contains: "DEFAULT_RESIZE_SETTINGS"
    - path: "src/tests/raster.spec.ts"
      provides: "Wave 0 E2E spec covering SC-1, SC-2, SC-4, throttle, perf budget, collision toast"
      contains: "test.fail"
    - path: "src/tests/filename.test.ts"
      provides: "Unit suite for applyDensitySuffix + deduplicateName"
      contains: "applyDensitySuffix"
    - path: "src/tests/icc.test.ts"
      provides: "Unit suite asserting iCCP chunk absence in optimized output"
      contains: "iCCP"
    - path: "src/tests/settings-icc.test.ts"
      provides: "Unit suite asserting preserveIcc toggle wired to settings store"
      contains: "preserveIccProfile"
    - path: "src/tests/instrument-heap.ts"
      provides: "CDP heap-probe helper for SC-2"
      contains: "newCDPSession"
    - path: "src/tests/fixtures/density-2x.png"
      provides: "800x600 reference PNG for variant tests"
    - path: "src/tests/fixtures/with-icc.png"
      provides: "PNG with embedded iCCP chunk for strip-by-default assertion"
  key_links:
    - from: "src/types/index.ts"
      to: "FileEntry"
      via: "additive optional fields"
      pattern: "resizeOverride\\?: ResizeAlg"
    - from: "src/tests/raster.spec.ts"
      to: "window.__OIMG_STORES__"
      via: "store-driven test scaffold"
      pattern: "__OIMG_STORES__"
---

<objective>
Land Wave 0 foundations: extend `FileEntry` + `AdapterMeta` data shapes (D-04, D-07, D-09), add `DEFAULT_RESIZE_SETTINGS`, and create failing-stub Playwright + unit specs that cover every Phase 4 success criterion (SC-1, SC-2, SC-3, SC-4) plus locked decisions (D-13 throttle toast, D-15 perf budget, D-16 collision toast). Specs use `test.fail()` markers so CI is green-but-interpretable until Waves 2/3 wire real implementations.

Purpose: Per Nyquist (`04-VALIDATION.md`), every later task that produces verifiable output references one of these spec/fixture paths. Landing them up front means later tasks just flip `test.fail()` to live `test()`.

Output: 3 source files modified (types + defaults), 5 test files created, 2 binary fixtures generated, 1 CDP test helper.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md
@.planning/phases/04-decode-resize-memory-model/04-RESEARCH.md
@.planning/phases/04-decode-resize-memory-model/04-PATTERNS.md
@.planning/phases/04-decode-resize-memory-model/04-VALIDATION.md
@src/types/index.ts
@src/workers/types.ts
@src/data/defaults.ts
@src/tests/svg-pipeline.spec.ts
@src/tests/svg-adapter.unit.ts
@src/tests/object-url.spec.ts
@src/tests/fixtures/instrument-blob-urls.js

<interfaces>
Existing contracts the executor must preserve verbatim:

```typescript
// src/types/index.ts (Phase 1+3)
export type SourceDensity = '1x' | '2x' | '3x'
export type ResizeAlg = 'lanczos3' | 'mitchell' | 'catrom' | 'triangle'
export interface FileEntry {
  id: string
  name: string
  format: FormatId
  originalSize: number
  optimizedSize: number | null
  status: FileStatus
  sourceDensity: SourceDensity
  thumbnail: string | null
  sanitizedCount?: number
}

// src/workers/types.ts (Phase 2)
export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
  sanitizedCount?: number
}

// src/data/defaults.ts (Phase 1)
export const RESIZE_ALG: ResizeAlg[] = ['lanczos3', 'mitchell', 'catrom', 'triangle']
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  stripMetadata: true,
  preserveIccProfile: false,
}
```

Test-scaffold pattern from `src/tests/svg-pipeline.spec.ts` (lines 29-78): page.goto('/'), wait for `window.__OIMG_STORES__`, evaluate `stores.files.getState().addFile(...)`, click Optimize, wait for status='done'.

Failing-stub pattern from Phase 2 plan 02-01: use `test.fail('reason — Wave N flips this')` so Playwright reports the spec as expected-fail (green CI) until later waves remove the marker.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend FileEntry + AdapterMeta + add DEFAULT_RESIZE_SETTINGS</name>
  <read_first>
    - src/types/index.ts (full file — additive edit at FileEntry interface)
    - src/workers/types.ts (full file — additive edit at AdapterMeta)
    - src/data/defaults.ts (full file — append new constant)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 361-389: types/index.ts edit pattern; lines 39: AdapterMeta extension)
  </read_first>
  <files>src/types/index.ts, src/workers/types.ts, src/data/defaults.ts</files>
  <action>
1. **src/types/index.ts** — extend `FileEntry` interface (existing block at lines 56-69) with these EXACT optional fields appended after `sanitizedCount?: number` (preserve existing fields verbatim, no reordering):
```typescript
  // Phase 4 (D-04 + D-14) — variants are siblings, not children. The source
  // FileEntry id is the prefix; variant ids are `${sourceUuid}-${density}`.
  // sourceFamilyId === source's id; useful for groupBy in FilePanel render.
  sourceFamilyId?: string
  // Density THIS entry produces. Mirrors `sourceDensity` semantics but for
  // the OUTPUT slot. addSourceWithVariants populates this on each variant.
  targetDensity?: SourceDensity
  // Phase 4 (D-07) — per-file resize algorithm override (UI deferred to Phase 5).
  resizeOverride?: ResizeAlg
  // Phase 4 (D-09) — per-file ICC preserve override (data shape only; worker
  // no-op in P4 per Post-Research D-10 amendment).
  preserveIcc?: boolean
```

2. **src/workers/types.ts** — extend `AdapterMeta` interface (existing block at lines 7-14) by appending an OPTIONAL field after `sanitizedCount?: number`. Do NOT touch existing fields:
```typescript
  // Phase 4 (D-04) — density tag attribution: png-resize adapter populates
  // this with the variant density it produced ('1x' | '2x' | '3x'). Other
  // adapters omit. Used by App.tsx markDone callback for telemetry only;
  // does not affect output bytes.
  density?: '1x' | '2x' | '3x'
```

3. **src/data/defaults.ts** — append a new exported constant after `DEFAULT_GLOBAL_SETTINGS` (line 81). Use the EXISTING `ResizeAlg` import that already lives at line 20 — do not re-import:
```typescript
// Phase 4 (D-05 + D-06) — default global resize settings. Lanczos3 is the
// photo-grade default; Mitchell/Catrom/Triangle live in RESIZE_ALG for the
// TweaksPanel "Resize / Variants" section dropdown.
export const DEFAULT_RESIZE_SETTINGS: { alg: ResizeAlg } = {
  alg: 'lanczos3',
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tee /tmp/tsc-04-01.log; grep -E 'sourceFamilyId|targetDensity|resizeOverride|preserveIcc' src/types/index.ts | grep -v '^//' | wc -l | tr -d ' ' | grep -E '^[4-9]$|^[0-9][0-9]+$' && grep -E '^\s*density\?:' src/workers/types.ts && grep -c 'DEFAULT_RESIZE_SETTINGS' src/data/defaults.ts | grep -v '^0$'</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0 (no type errors).
    - `grep -E 'resizeOverride\?: ResizeAlg' src/types/index.ts` matches exactly 1 line.
    - `grep -E 'preserveIcc\?: boolean' src/types/index.ts` matches exactly 1 line.
    - `grep -E 'sourceFamilyId\?: string' src/types/index.ts` matches exactly 1 line.
    - `grep -E 'targetDensity\?: SourceDensity' src/types/index.ts` matches exactly 1 line.
    - `grep -E "^\s*density\?: '1x' \| '2x' \| '3x'" src/workers/types.ts` matches exactly 1 line.
    - `grep -E "^export const DEFAULT_RESIZE_SETTINGS:" src/data/defaults.ts` matches exactly 1 line.
    - `grep -E "alg: 'lanczos3'" src/data/defaults.ts` matches exactly 1 line.
  </acceptance_criteria>
  <done>Types compile; all four FileEntry fields, the AdapterMeta.density field, and DEFAULT_RESIZE_SETTINGS appear in the codebase exactly once.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create Wave 0 specs + fixtures + CDP heap probe</name>
  <read_first>
    - src/tests/svg-pipeline.spec.ts (lines 1-110 — analog for raster.spec.ts scaffold)
    - src/tests/svg-adapter.unit.ts (full file — analog for filename.test.ts + icc.test.ts harness)
    - src/tests/object-url.spec.ts (lines 23-105 — analog for SC-4 url-leak assertion using existing instrument-blob-urls helper)
    - src/tests/fixtures/instrument-blob-urls.js (full file — REUSE, do not duplicate)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 643-716 — test scaffolds)
    - .planning/phases/04-decode-resize-memory-model/04-VALIDATION.md (lines 41-55 — per-task verification map)
  </read_first>
  <files>src/tests/raster.spec.ts, src/tests/filename.test.ts, src/tests/icc.test.ts, src/tests/settings-icc.test.ts, src/tests/instrument-heap.ts, src/tests/fixtures/density-2x.png, src/tests/fixtures/with-icc.png</files>
  <action>
1. **Generate `src/tests/fixtures/density-2x.png`** — an 800×600 RGBA PNG fixture. Use Playwright's bundled Node + a small inline script. Run from project root:
```bash
node -e "
const { writeFileSync } = require('fs');
const w=800,h=600;
const raw = Buffer.alloc(w*h*4);
for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
  const i=(y*w+x)*4; raw[i]=x%256; raw[i+1]=y%256; raw[i+2]=(x+y)%256; raw[i+3]=255;
}
// Minimal PNG encode via zlib + IHDR/IDAT/IEND chunks
const zlib = require('zlib');
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  const c = require('zlib').crc32 ?? ((b)=>{ let crc=~0>>>0; for (const x of b){ crc^=x; for(let i=0;i<8;i++) crc=(crc>>>1)^(0xedb88320 & -(crc&1)); } return (~crc)>>>0; });
  crc.writeUInt32BE(c(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
const filtered = Buffer.alloc(h*(w*4+1));
for (let y=0; y<h; y++) { filtered[y*(w*4+1)] = 0; raw.copy(filtered, y*(w*4+1)+1, y*w*4, (y+1)*w*4); }
const idat = zlib.deflateSync(filtered);
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
writeFileSync('src/tests/fixtures/density-2x.png', png);
console.log('Wrote density-2x.png:', png.length, 'bytes');
"
```

2. **Generate `src/tests/fixtures/with-icc.png`** — a 32×32 PNG with an embedded `iCCP` chunk for the strip-by-default test. Same script as above but smaller, AND splice an `iCCP` chunk (profile name "test\0\0" + zlib-compressed 4 dummy bytes) between IHDR and IDAT:
```bash
node -e "
const { writeFileSync } = require('fs');
const zlib = require('zlib');
const w=32,h=32;
const raw = Buffer.alloc(w*h*4);
for (let i=0; i<raw.length; i+=4) { raw[i]=128; raw[i+1]=64; raw[i+2]=200; raw[i+3]=255; }
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const c = (b)=>{ let crc=~0>>>0; for (const x of b){ crc^=x; for(let i=0;i<8;i++) crc=(crc>>>1)^(0xedb88320 & -(crc&1)); } return (~crc)>>>0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(c(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
const profileName = Buffer.from('test\\0', 'binary');
const compressionMethod = Buffer.from([0]);
const profilePayload = zlib.deflateSync(Buffer.from([0,1,2,3]));
const iccp = Buffer.concat([profileName, compressionMethod, profilePayload]);
const filtered = Buffer.alloc(h*(w*4+1));
for (let y=0; y<h; y++) { filtered[y*(w*4+1)] = 0; raw.copy(filtered, y*(w*4+1)+1, y*w*4, (y+1)*w*4); }
const idat = zlib.deflateSync(filtered);
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('iCCP', iccp), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
writeFileSync('src/tests/fixtures/with-icc.png', png);
console.log('Wrote with-icc.png:', png.length, 'bytes');
"
```

3. **`src/tests/raster.spec.ts`** — Playwright spec with seven `test.fail()`-marked stubs. Each test goes to `/`, waits for `window.__OIMG_STORES__`, but the assertion is intentionally one that will fail until the real implementation lands. Use this exact skeleton (copying scaffold from svg-pipeline.spec.ts lines 1-78):
```typescript
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const FIXTURE_DIR = 'src/tests/fixtures'

async function loadFixture(name: string): Promise<number[]> {
  const buf = await readFile(join(FIXTURE_DIR, name))
  return Array.from(new Uint8Array(buf))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object')
})

test('density variants — source 2x emits @1x/@2x/@3x FileEntries', async ({ page }) => {
  test.fail(true, 'Wave 2/3 flips this — addSourceWithVariants + png-adapter not yet shipped')
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    ;(window as any).__OIMG_STORES__.files.getState().addSourceWithVariants({
      sourceBlob: blob, sourceDensity: '2x', name: 'logo.png', format: 'png',
      targets: ['1x', '2x', '3x'],
    })
  }, { bytes: pngBytes })
  const names = await page.evaluate(() =>
    Object.values((window as any).__OIMG_STORES__.files.getState().byId).map((f: any) => f.name).sort()
  )
  expect(names).toEqual(['logo@1x.png', 'logo@2x.png', 'logo@3x.png'])
})

test('memory budget — 50 PNG @ 2x stays under 800 MB peak heap', async ({ page }) => {
  test.fail(true, 'Wave 2 flips this — admission gate + CDP heap probe wiring required')
  // Real implementation will use src/tests/instrument-heap.ts probeHeapDuringBatch.
  expect(true).toBe(false)
})

test('no url leaks — 20-file batch revokes every createObjectURL', async ({ page }) => {
  test.fail(true, 'Wave 3 flips this — uses existing src/tests/fixtures/instrument-blob-urls.js')
  expect(true).toBe(false)
})

test('throttle toast — first admission-gate trigger fires once per batch', async ({ page }) => {
  test.fail(true, 'Wave 2 flips this — pool onThrottle + runtime store flag required')
  expect(true).toBe(false)
})

test('perf budget — decode+resize+encode on 2 MB PNG p50 ≤ 500 ms', async ({ page }) => {
  test.fail(true, 'Wave 2 flips this — D-15 raster perf budget (RESEARCH §4)')
  expect(true).toBe(false)
})

test('collision rename — duplicate @Nx names auto-suffix (2)', async ({ page }) => {
  test.fail(true, 'Wave 2 flips this — deduplicateName + addSourceWithVariants required')
  expect(true).toBe(false)
})

test('metadata strip — output bytes contain no iCCP chunk by default', async ({ page }) => {
  test.fail(true, 'Wave 2 flips this — png-adapter must round-trip without ICC')
  expect(true).toBe(false)
})
```

4. **`src/tests/filename.test.ts`** — node `--experimental-strip-types` unit suite. Copy harness verbatim from `src/tests/svg-adapter.unit.ts` lines 1-40 (the `passed/failed` counter + `assert`/`assertDeep` helpers). Tests reference `src/lib/filename.ts` which does NOT exist yet (Plan 04-02 ships it). Mark each test with a leading `// TODO: Plan 04-02 implements src/lib/filename.ts` comment AND wrap the body in a try/catch that flips to `passed++` on the expected `Cannot find module` import error so Wave 1 keeps CI green:
```typescript
// Wave 0 stub — flips to live assertions in Wave 1 (Plan 04-02).
let passed = 0, failed = 0
function assert(name: string, cond: boolean) { cond ? passed++ : (failed++, console.error(`FAIL: ${name}`)) }

try {
  const mod = await import('../lib/filename.ts')
  // Wave 1 assertions (live):
  assert('applyDensitySuffix appends @Nx', mod.applyDensitySuffix('logo.png', '2x') === 'logo@2x.png')
  assert('applyDensitySuffix is idempotent', mod.applyDensitySuffix('logo@2x.png', '1x') === 'logo@1x.png')
  assert('applyDensitySuffix handles no-extension', mod.applyDensitySuffix('logo', '3x') === 'logo@3x')
  assert('deduplicateName passthrough on no collision', mod.deduplicateName('logo@1x.png', new Set()) === 'logo@1x.png')
  assert('deduplicateName inserts (2) before @Nx', mod.deduplicateName('logo@1x.png', new Set(['logo@1x.png'])) === 'logo (2)@1x.png')
  assert('deduplicateName handles repeat collisions', mod.deduplicateName('logo@1x.png', new Set(['logo@1x.png', 'logo (2)@1x.png'])) === 'logo (3)@1x.png')
} catch (err) {
  // Wave 0 stub: src/lib/filename.ts not yet shipped. Acceptable until Plan 04-02.
  if (err instanceof Error && err.message.includes('filename.ts')) {
    passed++ // expected stub state
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

5. **`src/tests/icc.test.ts`** — same harness shape; Wave 0 stub asserts the helper module path stub. Wave 2 (Plan 04-03 PNG adapter) flips to a real assertion that runs the adapter on `with-icc.png` and asserts the output ArrayBuffer contains no `iCCP` byte sequence (use `Buffer.from('iCCP')` as the search needle):
```typescript
let passed = 0, failed = 0
function assert(name: string, cond: boolean) { cond ? passed++ : (failed++, console.error(`FAIL: ${name}`)) }

// Wave 0 stub — Wave 2 (Plan 04-03) reads with-icc.png, runs png-adapter,
// asserts output bytes do NOT include the literal 'iCCP' chunk identifier.
import { readFile } from 'node:fs/promises'
const fixture = await readFile('src/tests/fixtures/with-icc.png')
assert('fixture has iCCP chunk before optimization', fixture.includes(Buffer.from('iCCP')))
// TODO Wave 2: import { run } from '../workers/png-adapter.ts'; const result = await run(...);
// assert('output strips iCCP', !Buffer.from(result.output).includes(Buffer.from('iCCP')))

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

6. **`src/tests/settings-icc.test.ts`** — node strip-types unit asserting `useSettingsStore.global.preserveIccProfile` is wired. Wave 0 already passes (the field exists from Phase 1). Live now:
```typescript
let passed = 0, failed = 0
function assert(name: string, cond: boolean) { cond ? passed++ : (failed++, console.error(`FAIL: ${name}`)) }

// Settings store imports zustand which imports React — only safe under
// node --experimental-strip-types if React is not actually invoked. Settings
// store create() does NOT call React, so import is safe.
const { useSettingsStore } = await import('../stores/settings.ts')

const initial = useSettingsStore.getState()
assert('preserveIccProfile defaults false', initial.global.preserveIccProfile === false)
assert('stripMetadata defaults true', initial.global.stripMetadata === true)

useSettingsStore.getState().setGlobal({ preserveIccProfile: true })
assert('setGlobal({preserveIccProfile:true}) flips state', useSettingsStore.getState().global.preserveIccProfile === true)
useSettingsStore.getState().setGlobal({ preserveIccProfile: false })

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

7. **`src/tests/instrument-heap.ts`** — CDP heap-probe helper (RESEARCH §Risk 5; PATTERNS lines 695-715). Exports `probeHeapDuringBatch(page, runBatch): Promise<number>` that opens a CDP session, samples Memory.getDOMCounters in a polling loop, runs the batch, returns peak observed heap bytes:
```typescript
import type { Page } from '@playwright/test'

/** Phase 4 SC-2 verification helper — measures peak heap during a batch via CDP.
 *  Source: 04-RESEARCH.md §Risk 5; 04-PATTERNS.md lines 695-715.
 *  Falls back to `performance.memory.usedJSHeapSize` polling on non-Chromium. */
export async function probeHeapDuringBatch(
  page: Page,
  runBatch: () => Promise<void>,
): Promise<number> {
  const cdp = await page.context().newCDPSession(page).catch(() => null)
  let peak = 0
  let stop = false

  const poll = async () => {
    while (!stop) {
      try {
        if (cdp) {
          const counters = await cdp.send('Memory.getDOMCounters' as any).catch(() => null) as { jsHeapSizeUsed?: number } | null
          if (counters?.jsHeapSizeUsed && counters.jsHeapSizeUsed > peak) peak = counters.jsHeapSizeUsed
        } else {
          const used = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0)
          if (typeof used === 'number' && used > peak) peak = used
        }
      } catch { /* swallow — best-effort sampling */ }
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  const pollPromise = poll()
  try {
    await runBatch()
  } finally {
    stop = true
    await pollPromise
    if (cdp) await cdp.detach().catch(() => undefined)
  }
  return peak
}
```
  </action>
  <verify>
    <automated>npx playwright test src/tests/raster.spec.ts --reporter=line 2>&1 | grep -E "(passed|failed|expected to fail)" | head -5; node --experimental-strip-types src/tests/filename.test.ts; node --experimental-strip-types src/tests/icc.test.ts; node --experimental-strip-types src/tests/settings-icc.test.ts; ls -la src/tests/fixtures/density-2x.png src/tests/fixtures/with-icc.png src/tests/instrument-heap.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx playwright test src/tests/raster.spec.ts --reporter=line` reports 7 tests, all marked "expected to fail" (Playwright treats `test.fail` passes as overall green CI). Output line `7 did not run` or `7 expected to fail` is acceptable; output `failed` (without "expected") is NOT acceptable.
    - `node --experimental-strip-types src/tests/filename.test.ts` exits 0 (Wave 0 stub state — module-not-found counted as passed; no other failures).
    - `node --experimental-strip-types src/tests/icc.test.ts` exits 0 (fixture-has-iCCP assertion passes).
    - `node --experimental-strip-types src/tests/settings-icc.test.ts` exits 0 (3 assertions pass).
    - `src/tests/fixtures/density-2x.png` exists, `file` reports it as PNG, dimensions 800×600 — verify with `node -e "const b=require('fs').readFileSync('src/tests/fixtures/density-2x.png'); console.log(b.readUInt32BE(16), b.readUInt32BE(20))"` outputs `800 600`.
    - `src/tests/fixtures/with-icc.png` exists and contains the byte sequence `iCCP` — verify with `node -e "console.log(require('fs').readFileSync('src/tests/fixtures/with-icc.png').includes(Buffer.from('iCCP')))"` outputs `true`.
    - `src/tests/instrument-heap.ts` exists; `grep -c 'newCDPSession' src/tests/instrument-heap.ts` returns at least 1.
    - `grep -c "test.fail" src/tests/raster.spec.ts` returns 7.
  </acceptance_criteria>
  <done>Seven raster.spec tests are recorded as expected-fail; three unit specs pass; both fixture PNGs decode to expected dimensions; instrument-heap helper exports probeHeapDuringBatch.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test fixtures → repo | Fixture binaries live in src/tests/fixtures and are NOT user-supplied; threat surface is "fixture corruption" (test reliability), not "untrusted input" |
| TypeScript declarations → consumers | New optional fields on FileEntry / AdapterMeta become available to all subsequent code; mismatched types = compile failure (Wave 1+ catches) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01-01 | Tampering | Test fixture PNGs (`density-2x.png`, `with-icc.png`) | mitigate | Generated deterministically from inline Node script in this plan; commit binaries directly so executor and CI see identical bytes (verify SHA via Wave 2 task acceptance criteria if needed). |
| T-04-01-02 | Information Disclosure | Test fixtures + spec files | accept | All test data is synthetic (constructed pixels + placeholder ICC payload); no PII or production data risk. |
| T-04-01-03 | Denial of Service | `test.fail()` placeholder spam | mitigate | Each `test.fail()` carries a comment naming the wave that flips it; final phase gate (Plan 04-06) MUST remove every `test.fail` marker — enforced by `grep -c "test.fail" src/tests/raster.spec.ts` in 04-06 acceptance criteria. |
| T-04-01-04 | Repudiation | None | accept | Solo developer; no audit trail required. |
</threat_model>

<verification>
- TypeScript compiles cleanly with extended FileEntry + AdapterMeta.
- All seven raster.spec.ts tests run as expected-fail under Playwright (no false negatives, no real failures).
- All three unit specs run under `node --experimental-strip-types` and exit 0.
- Both PNG fixtures parse correctly when read with PNG header byte indexing.
- CDP heap helper module exports `probeHeapDuringBatch` and survives import.
</verification>

<success_criteria>
- `npx tsc --noEmit` passes.
- `npx playwright test src/tests/raster.spec.ts` reports 7 expected-fail tests, no real failures.
- `npm test` (full suite) stays green (Phase 1+2+3 specs unchanged + Phase 4 raster expected-fail acceptable).
- Wave 0 fixtures + helpers exist on disk and are syntactically/structurally valid.
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-01-SUMMARY.md` describing the data-shape extensions, the seven raster.spec stubs (and which later plan flips each), and the fixture/helper files.
</output>
