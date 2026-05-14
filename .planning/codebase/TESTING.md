# Testing Patterns

**Analysis Date:** 2026-05-14

## Test Framework

**Runner:**
- Playwright `^1.59.1` for all E2E and browser integration tests
- Config: `playwright.config.ts` (root)
- Node built-in `node:test` + `node:assert/strict` for unit tests run under `node --experimental-strip-types`

**Assertion Library:**
- Playwright E2E: `expect` from `@playwright/test`
- Node unit tests: `assert` from `node:assert/strict`, plus manual `assert(name, cond)` helper pattern

**Run Commands:**
```bash
npm test                    # Run all Playwright E2E specs (src/tests/*.spec.ts)
npm run test:ui             # Playwright with interactive UI
npm run test:headed         # Playwright with visible browser window
npm run test:bundle         # Node runner: node --experimental-strip-types src/tests/build.test.ts
node --experimental-strip-types src/tests/settings.unit.ts   # Run a unit test file directly
node --experimental-strip-types src/tests/svg-adapter.unit.ts
node --experimental-strip-types src/tests/svg-snippets.unit.ts
node --experimental-strip-types src/tests/icc-extract.unit.ts
node --experimental-strip-types src/tests/icc.test.ts
node --experimental-strip-types src/tests/runtime-throttle.test.ts
node --experimental-strip-types src/tests/settings-icc.test.ts
node --experimental-strip-types src/tests/settings-resize.test.ts
```

## Test File Organization

**Location:** All tests live in `src/tests/`

**Naming conventions:**
- `*.spec.ts` — Playwright E2E tests (matched by `playwright.config.ts` `testMatch: '**/*.spec.ts'`)
- `*.unit.ts` — Node runner unit tests using a manual `assert()` helper pattern
- `*.test.ts` — Node runner tests using `node:test` framework

**Directory structure:**
```
src/tests/
├── fixtures/               # Binary/SVG test fixtures
│   ├── density-2x.png
│   ├── with-icc.png
│   └── xss-*.svg           # XSS corpus (9 files)
├── aria-live.spec.ts       # ARIA live region E2E
├── icc-extract.unit.ts     # ICC chunk extraction unit
├── icc.test.ts             # ICC strip integration (Node + real adapter)
├── instrument-heap.ts      # Heap instrumentation helper
├── object-url.spec.ts      # Object URL lifecycle E2E
├── raster.spec.ts          # Raster pipeline E2E (density variants, removeFamily)
├── runtime-throttle.test.ts # Runtime store throttle unit (state mirror pattern)
├── settings-icc.test.ts    # Settings store ICC override unit
├── settings-resize.test.ts # Settings store resize override unit
├── settings.unit.ts        # PIPE-03 codec override merge unit
├── shell.spec.ts           # ARIA shell landmarks + interactions E2E
├── svg-adapter.unit.ts     # buildSvgoConfig unit (no browser dep)
├── svg-pipeline.spec.ts    # SVG optimize E2E (OPT-01, PIPE-01, SNIP-01)
├── svg-snippets.unit.ts    # Snippet generator unit
├── svg-xss.spec.ts         # XSS sanitization E2E corpus
└── worker-pool.spec.ts     # Worker pool VR-01..VR-03 E2E
```

## Test Structure

**Playwright E2E Suite Organization:**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Phase N — Feature name (VR-NN)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )
  })

  test('description referencing validation requirement (VR-NN)', async ({ page }) => {
    // Drive store directly via __OIMG_STORES__ dev surface
    await page.evaluate(() => { /* inject state */ })
    // Assert on DOM/store state
    await expect(page.getByRole('...', { name: /.../ })).toBeVisible()
  })
})
```

**Node Unit Test Pattern (manual assert helper):**
```typescript
// Run: node --experimental-strip-types src/tests/foo.unit.ts
import { buildFooSettings } from '../workers/foo-config.ts'

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  cond ? (passed++, console.log(`PASS: ${name}`)) : (failed++, console.error(`FAIL: ${name}`))
}

// Tests
assert('description', actualValue === expectedValue)

// Summary
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

**Node Unit Test Pattern (node:test framework):**
```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildJpegSettings } from '../workers/jpeg-config.ts'

test('PIPE-03: perFile override merges over global JPEG settings', () => {
  const result = buildJpegSettings({ globalJpeg: { quality: 80, progressive: true }, fileOverride: { quality: 55 } })
  assert.equal(result.quality, 55)
  assert.equal(result.progressive, true)
})
```

## Mocking

**Framework:** No external mocking library. Three strategies are used:

**Strategy 1 — `__OIMG_STORES__` dev surface (Playwright E2E):**
The app exposes stores globally in dev/test mode via `window.__OIMG_STORES__`. Playwright tests drive state directly via `page.evaluate()` without simulating user file picker interactions.

```typescript
await page.evaluate(async ({ bytes }) => {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
  const stores = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__
  await stores.files.getState().addFile({ id: 'test-1', name: 'test.png', /* ... */ })
}, { bytes: pngBytes })
```

**Strategy 2 — State mirror pattern (Node unit tests):**
When a module cannot be imported in Node (circular deps, WASM, Vite aliases), the unit test re-implements the action reducer inline as a plain object, matching production logic verbatim.

```typescript
// Re-emulate the runtime store action to avoid importing pool.ts (TypeScript class syntax breaks strip-types)
let state = { throttleActive: false, throttleToastFiredThisBatch: false, renameCountThisBatch: 0 }
function markThrottle() {
  if (!state.throttleToastFiredThisBatch) {
    state.throttleActive = true
    state.throttleToastFiredThisBatch = true
  }
}
```

**Strategy 3 — `__setWorkerPoolForTesting()` injection:**
The pool singleton exposes a test-only setter at `src/workers/pool.ts` for replacing the pool with a fake in unit tests.

```typescript
import { __setWorkerPoolForTesting } from '@/workers/pool'
__setWorkerPoolForTesting(fakePool)
```

**What to Mock:**
- Worker pool in unit tests that test orchestration logic without WASM
- Store state via `__OIMG_STORES__` when testing UI components driven by store

**What NOT to Mock:**
- WASM codecs in E2E integration tests (icc.test.ts uses the real adapter against real fixtures)
- SVGO `optimize()` — svg-pipeline.spec.ts uses live SVGO through the real worker

## Fixtures and Factories

**Binary fixtures** at `src/tests/fixtures/`:
- Loaded with `readFile(join(FIXTURE_DIR, name))` and converted to `Array.from(new Uint8Array(buf))` for cross-thread transfer
- `density-2x.png` — PNG with known dimensions for density variant tests
- `with-icc.png` — PNG with embedded ICC color profile for strip/preserve tests
- `xss-*.svg` — XSS corpus (9 files) for sanitization regression tests

**Inline synthetic fixtures (Playwright):**
- Small blobs created inline: `new Blob([new Uint8Array(1024)], { type: 'image/png' })`
- SVG strings defined as constants at the top of spec files for pipeline tests

**No factory functions** — test data is created inline per test or in `loadFixture()` helpers.

## Coverage

**Requirements:** No coverage threshold enforced.

**Coverage tooling:** Not configured — Playwright and Node test runners produce pass/fail only.

## Test Types

**E2E Tests (Playwright, `*.spec.ts`):**
- Run against the live Vite dev server (`npm run dev` auto-started by `playwright.config.ts`)
- Test ARIA landmarks, keyboard navigation, worker pool round-trips, SVG pipeline, XSS sanitization
- All assertions are against DOM state or store state read via `page.evaluate()`
- Chromium-only (`playwright.config.ts` projects: `['chromium']`)

**Integration Tests (Node runner, `*.test.ts`):**
- `icc.test.ts` — imports the real `png-adapter.ts` and runs it on binary fixtures
- `runtime-throttle.test.ts` — tests store action logic via state mirror
- `settings-icc.test.ts`, `settings-resize.test.ts` — settings override merge

**Unit Tests (Node runner, `*.unit.ts`):**
- Pure function tests: `svg-adapter.unit.ts` (buildSvgoConfig), `svg-snippets.unit.ts`, `settings.unit.ts` (buildJpegSettings etc.)
- No WASM, no browser APIs — modules must be importable under `node --experimental-strip-types`
- Require Node 22+ (TypeScript strip-types support)

## Common Patterns

**Async Testing (Playwright):**
```typescript
// Wait for store initialization before driving state
await page.waitForFunction(
  () => typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
)

// Wait for async optimization to complete
await page.waitForFunction(() => {
  const f = (window as unknown as { __OIMG_STORES__: any }).__OIMG_STORES__.files.getState().byId['file-id']
  return f && f.status === 'done'
}, { timeout: 10000 })
```

**Reading Fixture Files (Node integration tests):**
```typescript
import { readFile } from 'node:fs/promises'
const fixture = await readFile('src/tests/fixtures/density-2x.png')
const result = await adapter.run(
  fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength) as ArrayBuffer,
  { sourceDensity: '2x', targetDensity: '1x', method: 'lanczos3', preserveIcc: false },
)
```

**XSS Assertion Pattern:**
```typescript
const { xssFired, sanitizedCount, cleanSvg } = await runXssTest(page, 'xss-script.svg', 'xss-01')
expect(xssFired).toBeUndefined()           // script did not execute
expect(sanitizedCount).toBeGreaterThan(0)  // DOMPurify removed something
expect(cleanSvg).not.toContain('<script')  // cleaned output is safe
```

**Phase Attribution Comment (required on every test file):**
```typescript
// Phase N plan NN-NN — [what this tests] ([VR-NN / SC-N / OPT-N references]).
// Pattern: [brief description of test approach used]
```

---

*Testing analysis: 2026-05-14*
