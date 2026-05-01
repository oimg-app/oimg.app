---
phase: 03-svg-pipeline
plan: A
type: execute
wave: 0-1
depends_on: []
files_modified:
  - package.json
  - src/workers/svg-adapter.ts
  - src/workers/worker.ts
  - src/workers/types.ts
  - src/types/index.ts
  - src/data/defaults.ts
  - src/lib/sanitize-svg.ts
  - src/stores/files.ts
  - src/components/panels/FilePanel.tsx
  - src/tests/svg-pipeline.spec.ts
  - src/tests/svg-xss.spec.ts
  - src/tests/svg-adapter.unit.ts
  - src/tests/svg-snippets.unit.ts
  - src/tests/fixtures/xss-script.svg
  - src/tests/fixtures/xss-onload.svg
  - src/tests/fixtures/xss-javascript-href.svg
  - src/tests/fixtures/xss-data-href.svg
  - src/tests/fixtures/xss-foreignobject.svg
  - src/tests/fixtures/xss-xlink-href.svg
  - src/tests/fixtures/xss-use-data.svg
  - src/tests/fixtures/xss-css-expression.svg
autonomous: true
requirements:
  - OPT-01
  - PIPE-01

must_haves:
  truths:
    - "Dropping an SVG file triggers SVGO optimization through the worker pool and reports `status: done`"
    - "DOMPurify runs on the main thread (not inside the worker) after SVGO returns"
    - "FileEntry.sanitizedCount is populated; a 'sanitized · N' badge appears in the file row when N > 0"
    - "svg-adapter.ts does NOT import dompurify; sanitize-svg.ts does"
    - "The ADAPTERS map svg slot invokes `() => import('./svg-adapter')` — no throw stub"
  artifacts:
    - path: "src/workers/svg-adapter.ts"
      provides: "SVGO-only adapter (TextDecoder → optimize() → TextEncoder)"
      exports: ["run"]
    - path: "src/lib/sanitize-svg.ts"
      provides: "Main-thread DOMPurify helper"
      exports: ["sanitizeSvg"]
    - path: "src/tests/svg-pipeline.spec.ts"
      provides: "E2E spec stubs for OPT-01, SNIP-01, SNIP-03, SNIP-04, PIPE-01"
    - path: "src/tests/svg-xss.spec.ts"
      provides: "XSS corpus stubs for all 8 attack vectors"
    - path: "src/tests/fixtures/xss-script.svg"
      provides: "XSS fixture: embedded script tag"
  key_links:
    - from: "src/workers/worker.ts"
      to: "src/workers/svg-adapter.ts"
      via: "ADAPTERS.svg dynamic import"
      pattern: "import\\('./svg-adapter'\\)"
    - from: "src/stores/files.ts"
      to: "src/lib/sanitize-svg.ts"
      via: "markDone calls sanitizeSvg before writing blob"
      pattern: "sanitizeSvg"
    - from: "src/workers/svg-adapter.ts"
      to: "svgo/browser"
      via: "optimize() call"
      pattern: "from 'svgo/browser'"
---

<objective>
Wave 0: Install svgo + dompurify, create spec stubs and XSS fixture corpus, probe DOMPurify-in-Worker compatibility.
Wave 1: Wire the svg-adapter (SVGO-only worker), main-thread sanitize-svg helper, ADAPTERS map, FileEntry.sanitizedCount, markDone extension, and file-row sanitized badge.

Purpose: Deliver the functional SVG optimization + sanitization pipeline — first real codec in the app. Establishes the OPT-01 + PIPE-01 contracts that Plan B (panel UI) and Plan C (snippets) depend on.
Output: Working end-to-end: drop SVG → SVGO in worker → DOMPurify on main thread → sanitizedCount badge in row.
</objective>

<execution_context>
@/Users/jilizart/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jilizart/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-svg-pipeline/03-CONTEXT.md
@.planning/phases/03-svg-pipeline/03-RESEARCH.md
@.planning/phases/03-svg-pipeline/03-PATTERNS.md
@.planning/phases/02-worker-harness-state/02-CONTEXT.md

<interfaces>
<!-- Key contracts the executor must match exactly. Extracted from codebase. -->

From src/workers/types.ts:
```typescript
export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
  // Phase 3 adds:
  sanitizedCount?: number
}

export class AdapterError extends Error {
  constructor(public format: string, public phase: 'decode' | 'process' | 'encode', message: string)
}
```

From src/workers/stub-adapter.ts (template to follow):
```typescript
export async function run(
  input: ArrayBuffer,
  settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const output = input.slice(0)
  return { output, meta: { unchanged: true } }
}
```

From src/workers/worker.ts (ADAPTERS map — replace the svg throw stub):
```typescript
const ADAPTERS: Record<AdapterFormat, () => Promise<...>> = {
  svg: () => { throw new Error('svg adapter not yet implemented (Phase 3)') },  // REPLACE THIS
  // ... other formats
}
```

From src/stores/files.ts:
```typescript
markDone: (fileId: string, optimizedBlob: Blob, optimizedSize: number) => void
// Phase 3 extends signature:
markDone: (fileId: string, optimizedBlob: Blob, optimizedSize: number, sanitizedCount?: number) => void
```

From src/types/index.ts (FileEntry):
```typescript
export interface FileEntry {
  id: string
  name: string
  format: FormatId
  status: FileStatus
  originalSize: number
  optimizedSize: number | null
  sourceDensity: SourceDensity
  thumbnail: string | null
  sourceBlob: Blob
  optimizedBlob: Blob | null
  // Phase 3 adds:
  sanitizedCount?: number
}

export interface CodecSettingsSvg {
  preset: 'default'
  plugins: Record<string, boolean>
  // Phase 3 adds:
  unsafeExport?: boolean
  pluginSavings?: Record<string, { bytes: number; pct: number }>
}
```

From src/data/defaults.ts (current DEFAULT_CODEC_SVG shape):
```typescript
export const DEFAULT_CODEC_SVG: CodecSettingsSvg = {
  preset: 'default',
  plugins: {
    // Current 5-plugin record — Plan A rewrites to 12-plugin curated set
    removeViewBox: false,
    // ...
  },
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Install deps, create spec stubs, XSS fixtures, DOMPurify-in-Worker probe</name>
  <files>
    package.json
    src/tests/svg-pipeline.spec.ts
    src/tests/svg-xss.spec.ts
    src/tests/svg-adapter.unit.ts
    src/tests/svg-snippets.unit.ts
    src/tests/fixtures/xss-script.svg
    src/tests/fixtures/xss-onload.svg
    src/tests/fixtures/xss-javascript-href.svg
    src/tests/fixtures/xss-data-href.svg
    src/tests/fixtures/xss-foreignobject.svg
    src/tests/fixtures/xss-xlink-href.svg
    src/tests/fixtures/xss-use-data.svg
    src/tests/fixtures/xss-css-expression.svg
  </files>
  <action>
**Step 1: Install dependencies**
```bash
npm install svgo@^4.0.1 dompurify@^3.4.2
```

**Step 2: Verify DOMPurify-in-Worker compatibility (empirical probe)**

Create a temporary worker probe file (delete after test):
- Create `src/tests/fixtures/dompurify-probe.worker.ts` that does `import DOMPurify from 'dompurify'; self.postMessage({ ok: typeof DOMPurify.sanitize === 'function' })`
- If the worker throws `ReferenceError: document is not defined` → DOMPurify stays on main thread (RESEARCH.md Pitfall 1 confirmed)
- **Expected result**: DOMPurify cannot init in standard Worker. Proceed with main-thread sanitization in `sanitize-svg.ts`. Delete probe file.

**Step 3: Create spec stubs**

`src/tests/svg-pipeline.spec.ts` — stubs using `test.fail()` marker pattern (Phase 2 convention from STATE.md):

```typescript
import { test, expect } from '@playwright/test'

test.describe('Phase 3 — SVG pipeline (OPT-01, PIPE-01, SNIP-01, SNIP-03, SNIP-04)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )
  })

  test('OPT-01: SVG optimizes via SVGO; optimizedSize < originalSize; byte delta shows in file row', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan A Wave 1')
  })
  test('OPT-01: plugin toggle re-optimizes selected file in real time (D-08)', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan B')
  })
  test('SNIP-01: SnippetPanel renders inline-svg and data-URI sections for SVG file', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan C')
  })
  test('SNIP-01: per-snippet checkbox hides section body when unchecked (D-13)', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan C')
  })
  test('SNIP-03: copy button writes snippet to clipboard; shows copied 1100ms', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan C')
  })
  test('SNIP-04: URL-encoded output is CSS-safe (no unencoded < > # ")', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan C')
  })
  test('PIPE-01: drop SVG → enqueue → optimize → status done', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan A Wave 1')
  })
  test('OPT-01: live savings column shows aggregate bytes/% post-batch (D-06)', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan B')
  })
  test('OPT-01: foot-gun warnings render on removeViewBox, removeDimensions, cleanupIds', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan B')
  })
  test('sanitized badge: FileEntry.sanitizedCount populated; badge visible in row', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan A Wave 1')
  })
})
```

`src/tests/svg-xss.spec.ts` — 8 attack vector stubs (copy the verbatim XSS pattern from RESEARCH.md §XSS Spec: Playwright Pattern for the first test; stub others):

```typescript
import { test, expect } from '@playwright/test'

test.describe('Phase 3 — XSS corpus (SC-3, T-V5-01..07)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )
  })

  test('T-V5-01: script tag removed by DOMPurify (SC-3)', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan A Wave 1')
  })
  test('T-V5-02: onload handler stripped by DOMPurify', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('T-V5-02: onmouseover handler stripped by DOMPurify', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('T-V5-03: javascript: href attribute removed', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('T-V5-03: javascript: xlink:href attribute removed', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('T-V5-04: data: URI HTML payload in href removed', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('T-V5-05: foreignObject script injection neutralized', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('CSS expression in style attribute cleaned', async ({ page }) => {
    test.fail(true, 'Wave 0 stub')
  })
  test('T-V5-06: unsafe export toggle flips adapter behavior; default = sanitize', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan B')
  })
  test('T-V5-07: snippet output for sanitized SVG contains no script/on*/javascript:', async ({ page }) => {
    test.fail(true, 'Wave 0 stub — implement in Plan C')
  })
})
```

`src/tests/svg-adapter.unit.ts`:
```typescript
// Unit tests for buildSvgoConfig and sanitizeSvg
// Run: node --experimental-strip-types src/tests/svg-adapter.unit.ts
// Wave 0: failing stubs

console.log('svg-adapter.unit.ts — Wave 0 stubs')
console.log('TODO: implement after Plan A ships svg-adapter.ts')
process.exit(0) // placeholder — Plan A Wave 1 fills these in
```

`src/tests/svg-snippets.unit.ts`:
```typescript
// Unit tests for encodeSvgForDataUri (yoksel encoder, D-15)
// Run: node --experimental-strip-types src/tests/svg-snippets.unit.ts
// Wave 0: stubs

console.log('svg-snippets.unit.ts — Wave 0 stubs')
console.log('TODO: implement after Plan C ships svg-snippets.ts')
process.exit(0) // placeholder — Plan C fills these in
```

**Step 4: Create XSS fixture SVGs** (8 files) — these are the actual malicious SVG fixtures used by Playwright:

`src/tests/fixtures/xss-script.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <script>window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'script'</script>
  <circle r="50" cx="50" cy="50" fill="blue"/>
</svg>
```

`src/tests/fixtures/xss-onload.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
  onload="window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'onload'">
  <circle r="50" cx="50" cy="50" fill="blue"/>
</svg>
```

`src/tests/fixtures/xss-javascript-href.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <a href="javascript:window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'javascript-href'">
    <circle r="50" cx="50" cy="50" fill="blue"/>
  </a>
</svg>
```

`src/tests/fixtures/xss-data-href.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <a href="data:text/html,&lt;script&gt;window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'data-href'&lt;/script&gt;">
    <circle r="50" cx="50" cy="50" fill="blue"/>
  </a>
</svg>
```

`src/tests/fixtures/xss-foreignobject.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" viewBox="0 0 100 100">
  <foreignObject width="100" height="100">
    <xhtml:script>window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'foreignObject'</xhtml:script>
  </foreignObject>
  <circle r="50" cx="50" cy="50" fill="blue"/>
</svg>
```

`src/tests/fixtures/xss-xlink-href.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
  <image xlink:href="javascript:window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'xlink-href'" width="100" height="100"/>
</svg>
```

`src/tests/fixtures/xss-use-data.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <use href="data:image/svg+xml,&lt;svg&gt;&lt;script&gt;window.__XSS_FIRED__ = true; window.__XSS_VECTOR__ = 'use-data'&lt;/script&gt;&lt;/svg&gt;"/>
</svg>
```

`src/tests/fixtures/xss-css-expression.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" style="behavior: url(#xss); -moz-binding: url('data:text/xml,&lt;bindings&gt;'); fill: blue"/>
</svg>
```
  </action>
  <verify>
    <automated>
      test -f src/tests/svg-pipeline.spec.ts &amp;&amp;
      test -f src/tests/svg-xss.spec.ts &amp;&amp;
      test -f src/tests/svg-adapter.unit.ts &amp;&amp;
      test -f src/tests/svg-snippets.unit.ts &amp;&amp;
      test -f src/tests/fixtures/xss-script.svg &amp;&amp;
      test -f src/tests/fixtures/xss-onload.svg &amp;&amp;
      test -f src/tests/fixtures/xss-javascript-href.svg &amp;&amp;
      test -f src/tests/fixtures/xss-data-href.svg &amp;&amp;
      test -f src/tests/fixtures/xss-foreignobject.svg &amp;&amp;
      test -f src/tests/fixtures/xss-xlink-href.svg &amp;&amp;
      test -f src/tests/fixtures/xss-use-data.svg &amp;&amp;
      test -f src/tests/fixtures/xss-css-expression.svg &amp;&amp;
      node -e "require('svgo')" 2&gt;/dev/null &amp;&amp; echo "svgo ok" &amp;&amp;
      node -e "require('dompurify')" 2&gt;/dev/null &amp;&amp; echo "dompurify ok"
    </automated>
  </verify>
  <acceptance_criteria>
    - `npm ls svgo` shows version `^4.0.1` installed
    - `npm ls dompurify` shows version `^3.4.2` installed
    - All 8 XSS fixture files exist in `src/tests/fixtures/`
    - Each fixture contains `window.__XSS_FIRED__ = true` script content
    - `src/tests/svg-pipeline.spec.ts` contains `test.fail(true,` on every stub test
    - `src/tests/svg-xss.spec.ts` has exactly 10 test stubs (8 attack vectors + unsafe-export + snippet-output)
    - `npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts` exits with 0 (all tests expected-fail = passing Playwright stubs)
  </acceptance_criteria>
  <done>All Wave 0 scaffolding committed. `npm install` succeeds with svgo + dompurify. Spec files exist. XSS fixtures contain real attack payloads. Playwright stubs pass.</done>
</task>

<task type="auto">
  <name>Task 2 (Wave 1): svg-adapter.ts + sanitize-svg.ts + type extensions + ADAPTERS wiring + markDone + sanitized badge</name>
  <files>
    src/workers/svg-adapter.ts
    src/workers/worker.ts
    src/workers/types.ts
    src/types/index.ts
    src/data/defaults.ts
    src/lib/sanitize-svg.ts
    src/stores/files.ts
    src/components/panels/FilePanel.tsx
  </files>
  <action>
**Read first before writing:**
- `src/workers/stub-adapter.ts` — exact template for svg-adapter structure
- `src/workers/worker.ts` — ADAPTERS map lines; svg throw stub to replace
- `src/workers/types.ts` — AdapterMeta, AdapterError interfaces
- `src/types/index.ts` — FileEntry, CodecSettingsSvg, FormatId
- `src/data/defaults.ts` — DEFAULT_CODEC_SVG current shape, SVGO_PLUGINS array to remove
- `src/stores/files.ts` — markDone implementation, revoke-then-write discipline
- `src/components/panels/FilePanel.tsx` — file row render; where .file-stat spans live
- `src/components/panels/SvgoPanel.tsx` lines 17-23 — warn color pattern for badge

**Step 1: Extend types**

`src/workers/types.ts` — add `sanitizedCount?: number` to AdapterMeta:
```typescript
export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
  sanitizedCount?: number  // Phase 3: populated by svg path; 0 = clean; undefined = non-svg adapter
}
```

`src/types/index.ts` — add to FileEntry and CodecSettingsSvg:
```typescript
// In FileEntry interface — add optional field (backwards-compatible):
sanitizedCount?: number  // D-03: per-file badge; undefined = not processed yet

// In CodecSettingsSvg interface — add optional fields:
unsafeExport?: boolean   // D-04: default false = sanitize; true = skip DOMPurify on export
pluginSavings?: Record<string, { bytes: number; pct: number }>  // D-06 live savings
```

Also add `SnippetId` type near CodecSettings:
```typescript
export type SnippetId = 'inline-svg' | 'url-encoded-uri' | 'picture' | 'img-srcset' | 'data-uri-base64'
```

**Step 2: Rewrite DEFAULT_CODEC_SVG to 12-plugin curated set**

`src/data/defaults.ts` — replace DEFAULT_CODEC_SVG.plugins with the 12-plugin record from RESEARCH.md §Curated Plugin Set. Remove SVGO_PLUGINS array entirely. Remove SvgoPlugin import if present.

```typescript
// Mirrors SVGO v4 preset-default (10 plugins: on) + 2 opt-in extras (off).
// removeViewBox and removeDimensions are NOT in preset-default — kept off per D-07.
// Phase 3: D-07 — mirror preset-default exactly; foot-gun warnings surface in SvgoPanel.
export const DEFAULT_CODEC_SVG: CodecSettingsSvg = {
  preset: 'default',
  plugins: {
    removeComments: true,
    removeMetadata: true,
    removeUselessDefs: true,
    removeUnusedNS: true,
    cleanupIds: true,
    cleanupNumericValues: true,
    convertColors: true,
    convertPathData: true,
    mergePaths: true,
    minifyStyles: true,
    removeViewBox: false,    // NOT in preset-default — opt-in extra; foot-gun (D-07)
    removeDimensions: false, // NOT in preset-default — opt-in extra; foot-gun (D-07)
  },
}
```

NOTE: UI-SPEC.md row 11 says `removeViewBox: on` — this is a SPEC ERROR confirmed by RESEARCH.md §Critical Contradiction. `removeViewBox` is NOT in SVGO v4 preset-default. D-07 says "mirror preset-default" → value stays `false`. Do NOT flip to true.

**Step 3: Create svg-adapter.ts (SVGO-only, no DOMPurify)**

`src/workers/svg-adapter.ts`:
```typescript
/**
 * SVG Adapter — Phase 3
 * Source: 03-RESEARCH.md §Pattern 1 (SVGO v4 browser ESM)
 * Pipeline: ArrayBuffer → TextDecoder → SVGO optimize() → TextEncoder → ArrayBuffer
 *
 * IMPORTANT: DOMPurify is NOT called here. Workers lack `document`.
 * Sanitization runs on the main thread in src/lib/sanitize-svg.ts,
 * called from useFilesStore.markDone (via pool onDone callback).
 * D-01 is still satisfied: DOMPurify runs post-SVGO before bytes reach preview/snippet/ZIP.
 */
import { optimize } from 'svgo/browser'
import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { CodecSettingsSvg } from '../types/index'

// Plugins in SVGO v4 preset-default (D-07: these are disabled via overrides when off)
const PRESET_DEFAULT_PLUGINS = new Set([
  'removeComments', 'removeMetadata', 'removeUselessDefs', 'removeUnusedNS',
  'cleanupIds', 'cleanupNumericValues', 'convertColors', 'convertPathData',
  'mergePaths', 'minifyStyles',
])

// Plugins NOT in preset-default (D-07: included as extra plugins only when explicitly on)
const EXTRA_PLUGINS = new Set(['removeViewBox', 'removeDimensions'])

export function buildSvgoConfig(settings: CodecSettingsSvg): Parameters<typeof optimize>[1] {
  const overrides: Record<string, boolean | object> = {}
  const extraPlugins: string[] = []

  for (const [id, enabled] of Object.entries(settings.plugins)) {
    if (PRESET_DEFAULT_PLUGINS.has(id)) {
      if (!enabled) overrides[id] = false  // disable preset-default plugin
    } else if (EXTRA_PLUGINS.has(id)) {
      if (enabled) extraPlugins.push(id)   // include opt-in extra plugin
    }
  }

  return {
    plugins: [
      { name: 'preset-default', params: { overrides } },
      ...extraPlugins,
    ],
  }
}

export async function run(
  input: ArrayBuffer,
  settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const svgString = new TextDecoder().decode(input)

  let optimized: string
  try {
    const result = optimize(svgString, buildSvgoConfig(settings as CodecSettingsSvg))
    // SVGO v4 returns { data: string } — no error field; throws on malformed SVG
    optimized = result.data
  } catch (err) {
    throw new AdapterError('svg', 'process', err instanceof Error ? err.message : String(err))
  }

  const output = new TextEncoder().encode(optimized).buffer as ArrayBuffer
  return {
    output,
    meta: {
      unchanged: output.byteLength === input.byteLength,
      // sanitizedCount is NOT set here — DOMPurify runs on main thread
    },
  }
}
```

**Step 4: Wire ADAPTERS map in worker.ts**

`src/workers/worker.ts` — replace the svg throw stub with the dynamic import:
```typescript
// BEFORE:
svg: () => {
  throw new Error('svg adapter not yet implemented (Phase 3)')
},
// AFTER:
svg: () => import('./svg-adapter'),
```

Static literal path — no template literals (T-02-03 constraint from STATE.md).

**Step 5: Create sanitize-svg.ts (main-thread DOMPurify)**

`src/lib/sanitize-svg.ts`:
```typescript
/**
 * Main-thread SVG sanitization helper — Phase 3
 * Source: 03-RESEARCH.md §Pattern 2 (DOMPurify SVG Profile)
 *
 * DOMPurify requires window/document — cannot run in standard Web Workers.
 * This helper is called from useFilesStore pool onDone callback, AFTER
 * the worker returns SVGO-optimized bytes (D-01: post-SVGO, pre-store).
 *
 * D-02: USE_PROFILES: { svg: true, svgFilters: true }
 * D-04: unsafe=true skips DOMPurify (global "Disable SVG sanitization on export" toggle)
 */
import DOMPurify from 'dompurify'

export interface SanitizeResult {
  clean: string
  sanitizedCount: number
}

export function sanitizeSvg(svgString: string, unsafe: boolean): SanitizeResult {
  if (unsafe) {
    return { clean: svgString, sanitizedCount: 0 }
  }
  // DOMPurify.removed resets at the start of each sanitize() call (purify.ts line 1629)
  // Read .length immediately after the call — do NOT await or yield between sanitize() and .length
  const clean = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
  })
  const sanitizedCount = DOMPurify.removed.length
  return { clean, sanitizedCount }
}
```

**Step 6: Extend markDone in files.ts**

`src/stores/files.ts` — read the file first to find the exact markDone signature. Add optional `sanitizedCount` param. Inside the `set()` call, spread `sanitizedCount` into the FileEntry when provided:

```typescript
markDone: (fileId: string, optimizedBlob: Blob, optimizedSize: number, sanitizedCount?: number) => {
  // existing: revokeObjectURL first, then set
  useRuntimeStore.getState().revokeObjectURL(fileId)
  set((s) => ({
    byId: {
      ...s.byId,
      [fileId]: {
        ...s.byId[fileId],
        optimizedBlob,
        optimizedSize,
        status: 'done',
        ...(sanitizedCount !== undefined ? { sanitizedCount } : {}),
      },
    },
  }))
},
```

Also wire DOMPurify into the pool's `onDone` callback path. Read `src/App.tsx` or wherever `WorkerPool` callbacks are registered (Phase 2 wired Optimize → pool.enqueue). The `onDone` callback currently calls `markDone(fileId, blob, size)`. Phase 3 extends it:

```typescript
// In the pool onDone callback (find in App.tsx or useRuntimeStore):
// After worker returns optimizedBlob for format === 'svg':
const svgText = await new Response(optimizedBlob).text()  // or blob.text()
const unsafe = useSettingsStore.getState().svg.unsafeExport ?? false
const { clean, sanitizedCount } = sanitizeSvg(svgText, unsafe)
const sanitizedBlob = new Blob([clean], { type: 'image/svg+xml' })
useFilesStore.getState().markDone(fileId, sanitizedBlob, sanitizedBlob.size, sanitizedCount)
```

If the file format is not SVG, call `markDone` with the original blob unchanged (no sanitization for raster formats).

**Step 7: Add sanitized badge to FilePanel.tsx**

`src/components/panels/FilePanel.tsx` — read the file to find the `.file-stat` / file row render. After the existing savings spans, add:

```tsx
{entry.sanitizedCount !== undefined && entry.sanitizedCount > 0 && (
  <span
    className="pill warn sm"
    aria-label={`${entry.sanitizedCount} element${entry.sanitizedCount === 1 ? '' : 's'} removed by sanitizer`}
    title={`${entry.sanitizedCount} dangerous element${entry.sanitizedCount === 1 ? '' : 's'} removed by DOMPurify`}
    style={{ marginLeft: 2 }}
  >
    sanitized · {entry.sanitizedCount}
  </span>
)}
```

Color: `var(--warn)` via `.pill.warn` rule (existing). The `.pill.sm` class is a new CSS-only modifier — add to `src/index.css` or the panel CSS if a co-located stylesheet exists:
```css
.pill.sm { padding: 0 5px; font-size: 9.5px; }
```
  </action>
  <verify>
    <automated>
      grep -c "from 'svgo/browser'" src/workers/svg-adapter.ts &amp;&amp;
      grep -v '^//' src/workers/svg-adapter.ts | grep -c "from 'dompurify'" | grep -q "^0$" &amp;&amp;
      grep -c "from 'dompurify'" src/lib/sanitize-svg.ts &amp;&amp;
      grep -c "import('./svg-adapter')" src/workers/worker.ts &amp;&amp;
      grep -c "sanitizedCount" src/workers/types.ts &amp;&amp;
      grep -c "sanitizedCount" src/types/index.ts &amp;&amp;
      grep -c "removeViewBox: false" src/data/defaults.ts &amp;&amp;
      grep -v '^[[:space:]]*//' src/data/defaults.ts | grep -c "SVGO_PLUGINS" | grep -q "^0$" &amp;&amp;
      npx tsc --noEmit
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep "from 'svgo/browser'" src/workers/svg-adapter.ts` returns a match
    - `grep "from 'dompurify'" src/workers/svg-adapter.ts` returns NO match (DOMPurify not in worker)
    - `grep "from 'dompurify'" src/lib/sanitize-svg.ts` returns a match
    - `grep "import('./svg-adapter')" src/workers/worker.ts` returns a match (no template literal)
    - `grep "sanitizedCount" src/workers/types.ts` returns a match in AdapterMeta interface
    - `grep "sanitizedCount" src/types/index.ts` returns a match in FileEntry interface
    - `grep "removeViewBox: false" src/data/defaults.ts` returns a match (NOT `true`)
    - `grep "SVGO_PLUGINS" src/data/defaults.ts` returns NO match (array deleted)
    - `buildSvgoConfig` function exists and exported from `svg-adapter.ts`
    - `sanitizeSvg` function exists and exported from `sanitize-svg.ts`
    - `npx tsc --noEmit` exits 0
    - `npx playwright test src/tests/svg-pipeline.spec.ts -g "OPT-01"` passes (stub or live test)
  </acceptance_criteria>
  <done>
    svg-adapter.ts ships SVGO-only pipeline. sanitize-svg.ts runs DOMPurify on main thread post-pool. ADAPTERS map svg slot wired. markDone extended with sanitizedCount. File-row badge renders for XSS-laden SVGs. TypeScript compiles clean.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| File drop → worker | User-supplied SVG bytes cross from main thread to worker via ArrayBuffer transfer |
| Worker output → main thread | SVGO-optimized bytes return to main thread; DOMPurify runs here before store write |
| Sanitized blob → preview/snippet/ZIP | All downstream consumers derive from the single sanitized blob (D-04) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-V5-01 | Tampering | `src/lib/sanitize-svg.ts` | mitigate | DOMPurify `USE_PROFILES: { svg: true, svgFilters: true }` removes `<script>` elements; verified by `svg-xss.spec.ts -g "script"` |
| T-V5-02 | Tampering | `src/lib/sanitize-svg.ts` | mitigate | DOMPurify strips `on*` event handler attributes; verified by `svg-xss.spec.ts -g "onload"` |
| T-V5-03 | Elevation of Privilege | `src/lib/sanitize-svg.ts` | mitigate | DOMPurify sanitizes `javascript:` URIs in href and xlink:href; verified by `svg-xss.spec.ts -g "javascript"` |
| T-V5-04 | Elevation of Privilege | `src/lib/sanitize-svg.ts` | mitigate | DOMPurify removes `data:text/html` payloads in href; verified by `svg-xss.spec.ts -g "data-href"` |
| T-V5-05 | Tampering | `src/lib/sanitize-svg.ts` | mitigate | DOMPurify neutralizes `foreignObject` script injection; verified by `svg-xss.spec.ts -g "foreignObject"` |
</threat_model>

<verification>
```bash
# After Task 1 commit:
test -f src/tests/svg-pipeline.spec.ts && test -f src/tests/svg-xss.spec.ts
npm ls svgo dompurify

# After Task 2 commit:
grep "from 'svgo/browser'" src/workers/svg-adapter.ts
grep -c "from 'dompurify'" src/workers/svg-adapter.ts  # must be 0
grep "from 'dompurify'" src/lib/sanitize-svg.ts
grep "import('./svg-adapter')" src/workers/worker.ts
grep "removeViewBox: false" src/data/defaults.ts
npx tsc --noEmit
npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts
```
</verification>

<success_criteria>
- Drop an SVG file → Optimize → file row shows non-zero byte delta (optimizedSize < originalSize)
- Drop `src/tests/fixtures/xss-script.svg` → optimize → `FileEntry.sanitizedCount > 0` in store
- File row displays `sanitized · N` badge in warn color for xss-script.svg
- `grep "from 'dompurify'" src/workers/svg-adapter.ts` returns empty (DOMPurify stays off worker)
- `npx tsc --noEmit` exits 0
- `npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts` exits 0 (stubs pass)
</success_criteria>

<output>
After completion, create `.planning/phases/03-svg-pipeline/03-A-SUMMARY.md`
</output>
