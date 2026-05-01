# Phase 3: SVG Pipeline - Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 16 (5 create, 9 modify, 1 delete, 4 tests + fixtures)
**Analogs found:** 15 / 16 (XSS fixtures have no analog — first fixture corpus)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/workers/svg-adapter.ts` | adapter/service | transform (text) | `src/workers/stub-adapter.ts` | exact |
| `src/lib/sanitize-svg.ts` | utility | transform (text) | `src/workers/stub-adapter.ts` (shape); `OutputPanel` error pattern | role-match |
| `src/lib/svg-snippets.ts` | utility | transform (text) | `OutputPanel.tsx` lines 35-53 (string generation) | role-match |
| `src/lib/snippet-registry.ts` | config/registry | static lookup | `src/data/defaults.ts` (registry object shape) | role-match |
| `src/components/panels/SnippetPanel.tsx` | component | request-response | `src/components/panels/OutputPanel.tsx` | exact |
| `src/workers/worker.ts` (ADAPTERS map) | config | — | self (lines 21-39) | self |
| `src/workers/types.ts` (AdapterMeta) | types | — | self (lines 7-10) | self |
| `src/types/index.ts` (FileEntry + SnippetId) | types | — | self (lines 56-70) | self |
| `src/data/defaults.ts` (DEFAULT_CODEC_SVG) | config | — | self (lines 29-38) | self |
| `src/components/panels/SvgoPanel.tsx` | component | request-response | self (rewrite) + `OutputPanel` (WR-04 copy pattern) | self |
| `src/stores/settings.ts` (svg slice + snippetToggles) | store | event-driven | self (lines 40-56) | self |
| `src/stores/runtime.ts` (previewJobId + enqueuePreview) | store | event-driven | self (lines 35-54, debounce slot) | self |
| `src/stores/files.ts` (markDone + sanitizedCount) | store | CRUD | self (lines 56-75) | self |
| `src/App.tsx` (SnippetPanel mount) | component | — | self (inspect OutputPanel mount point) | self |
| `src/components/panels/FilePanel.tsx` (sanitized badge) | component | — | `SvgoPanel.tsx` (plugin row `warn` color pattern) | role-match |
| `src/tests/svg-pipeline.spec.ts` | test (E2E) | — | `src/tests/worker-pool.spec.ts` | exact |
| `src/tests/svg-xss.spec.ts` | test (E2E) | — | `src/tests/worker-pool.spec.ts` + RESEARCH.md §XSS Spec | exact |
| `src/tests/svg-adapter.unit.ts` | test (unit) | — | `src/tests/fixtures/synthetic.ts` shape | role-match |
| `src/tests/svg-snippets.unit.ts` | test (unit) | — | `src/tests/fixtures/synthetic.ts` shape | role-match |
| `src/tests/fixtures/xss-*.svg` | fixture | — | none | no-analog |

---

## Pattern Assignments

### `src/workers/svg-adapter.ts` (adapter, transform)

**Analog:** `src/workers/stub-adapter.ts`

**Imports pattern** (stub-adapter.ts lines 1-14):
```typescript
// Same file header comment pattern (Phase N, Source: N-RESEARCH.md)
import type { AdapterMeta } from './types'
```

**Core adapter pattern** (stub-adapter.ts lines 16-24):
```typescript
export async function run(
  input: ArrayBuffer,
  settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  // Phase 3 replaces input.slice(0) with:
  //   const svgString = new TextDecoder().decode(input)
  //   const result = optimize(svgString, buildSvgoConfig(settings as CodecSettingsSvg))
  //   const output = new TextEncoder().encode(result.data).buffer
  const output = input.slice(0)
  return { output, meta: { unchanged: true } }
}
```

**Error handling pattern** — wrap `optimize()` in try/catch, throw `AdapterError`:
```typescript
// From types.ts lines 41-50:
throw new AdapterError('svg', 'process', err instanceof Error ? err.message : String(err))
// phases: 'decode' | 'process' | 'encode'
```

**Note on DOMPurify:** Per RESEARCH.md Pattern 2 — DOMPurify cannot run in a Worker (no `document`). The svg-adapter handles SVGO only. Sanitization runs in `src/lib/sanitize-svg.ts` on the main thread, called from the pool `onDone` callback before `useFilesStore.markDone`.

---

### `src/lib/sanitize-svg.ts` (utility, transform)

**Analog:** No direct analog in codebase — new file category. Pattern from RESEARCH.md §DOMPurify Removal Detection.

**Full pattern to copy from RESEARCH.md:**
```typescript
import DOMPurify from 'dompurify'

export function sanitizeSvg(svgString: string, unsafe: boolean): {
  clean: string
  sanitizedCount: number
} {
  if (unsafe) return { clean: svgString, sanitizedCount: 0 }
  const clean = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
  })
  // DOMPurify.removed resets at the start of each sanitize() call (purify.ts line 1629)
  const sanitizedCount = DOMPurify.removed.length
  return { clean, sanitizedCount }
}
```

---

### `src/lib/svg-snippets.ts` (utility, transform)

**Analog:** `src/components/panels/OutputPanel.tsx` lines 35-53 (static string generation pattern)

**yoksel URL-encode pattern** (from `inspired/url-encoder/src/js/script.js` lines 134-148, verified in RESEARCH.md Pattern 3):
```typescript
// The symbols regex — ONLY these characters are percent-encoded
const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g

export function encodeSvgForDataUri(svgString: string): string {
  let data = svgString.replace(/"/g, "'")           // " → ' (avoids encoding in CSS url())
  data = data.replace(/>\s{1,}</g, '><')             // collapse whitespace
  data = data.replace(/\s{2,}/g, ' ')
  return data.replace(symbols, encodeURIComponent)   // encode only the problematic chars
}

export function ensureNamespace(svg: string): string {
  if (!svg.includes('http://www.w3.org/2000/svg')) {
    return svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'")
  }
  return svg
}

// CSS output: `url("data:image/svg+xml,${encodeSvgForDataUri(sanitizedSvg)}")`
```

---

### `src/lib/snippet-registry.ts` (registry, static lookup)

**Analog:** `src/data/defaults.ts` (plain `Record<K, V>` export pattern, lines 21-97)

**Registry shape pattern** (from RESEARCH.md Pattern 4):
```typescript
// Mirrors the defaults.ts export pattern: named const export of a plain object
export type SnippetId = 'inline-svg' | 'url-encoded-uri' | 'picture' | 'img-srcset' | 'data-uri-base64'

export interface SnippetDef {
  id: SnippetId
  label: string
  badge: string
  codeLabel: string
  applicableFormats: FormatId[]
  generate: (svgText: string | null) => string | null  // null = no data yet
}

export const SNIPPET_REGISTRY: Record<SnippetId, SnippetDef> = { ... }
```

**SnippetPanel render loop pattern** (filter by format, not switch-on-format):
```typescript
// CRITICAL: never use switch(file.format) — use registry filter
const visibleSnippets = Object.values(SNIPPET_REGISTRY)
  .filter(def => def.applicableFormats.includes(file.format))
```

---

### `src/components/panels/SnippetPanel.tsx` (component, request-response)

**Analog:** `src/components/panels/OutputPanel.tsx` (complete replacement)

**Imports pattern** (OutputPanel.tsx lines 1-6):
```typescript
import { useState } from 'react';
import { toast } from 'sonner';
import { Section } from '@/components/ui/Section';
import { Icons } from '@/components/icons';
// Phase 3 adds: import { SNIPPET_REGISTRY } from '@/lib/snippet-registry'
// Phase 3 adds: import { useSettingsStore } from '@/stores/settings'
// Phase 3 adds: import type { FileEntryWithBlob } from '@/stores/files'
```

**WR-04 clipboard copy pattern** (OutputPanel.tsx lines 17-33) — copy verbatim:
```typescript
type CopyKey = string | null;  // was 'b64' | 'url' | 'pic' | null; Phase 3 uses SnippetId

const copy = async (key: string, text: string) => {
  if (!navigator.clipboard?.writeText) {
    toast.error('Clipboard unavailable');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100);
  } catch {
    toast.error('Copy failed');
  }
};
```

**Section + code-row render pattern** (OutputPanel.tsx lines 56-75):
```typescript
<Section title="Data URI · URL-encoded">
  <div className="code-row">
    <span className="lbl">CSS background</span>
    <button
      className={'copy-btn ' + (copied === 'url' ? 'ok' : '')}
      onClick={() => copy('url', urlEnc)}
    >
      {copied === 'url' ? <Icons.Check size={11} /> : <Icons.Copy size={11} />}
      {copied === 'url' ? 'copied' : 'copy'}
    </button>
  </div>
  <pre className="code">...</pre>
</Section>
```

**Per-snippet checkbox** — new for Phase 3 (no direct analog). Pattern: read from `useSettingsStore.snippetTogglesByFileId[fileId]?.[snippetId] ?? true`; render as `<input type="checkbox">` inline in `Section` title area.

**Async blob reading** — `SnippetPanel` reads `optimizedBlob.text()` once when selected file changes via `useEffect`, stores decoded string in local state; passes to `generate()`.

---

### `src/workers/worker.ts` (ADAPTERS map modification)

**Self-pattern** (worker.ts lines 21-39) — replace the throw stub:
```typescript
// BEFORE (lines 25-27):
svg: () => {
  throw new Error('svg adapter not yet implemented (Phase 3)')
},

// AFTER:
svg: () => import('./svg-adapter'),
```

**Critical constraint** (worker.ts lines 14-15): Static literal path only — no template literals.

---

### `src/workers/types.ts` (AdapterMeta extension)

**Self-pattern** (types.ts lines 7-10):
```typescript
// BEFORE:
export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
}

// AFTER — add optional field (backwards-compatible):
export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
  sanitizedCount?: number  // populated by svg-adapter path only; 0 = clean
}
```

---

### `src/types/index.ts` (FileEntry + SnippetId extensions)

**Self-pattern** (types.ts lines 56-70):
```typescript
// FileEntry — add optional field (backwards-compatible):
export interface FileEntry {
  // ... existing fields ...
  sanitizedCount?: number  // D-03: per-file badge; undefined = not yet processed
}

// New type (add near CodecSettings):
export type SnippetId = 'inline-svg' | 'url-encoded-uri' | 'picture' | 'img-srcset' | 'data-uri-base64'
```

**CodecSettingsSvg extension** (types.ts lines 67-70):
```typescript
export interface CodecSettingsSvg {
  preset: 'default'
  plugins: Record<string, boolean>
  unsafeExport?: boolean         // D-04: default false = sanitize; true = skip DOMPurify
  pluginSavings?: Record<string, { bytes: number; pct: number }>  // D-06 live savings
}
```

---

### `src/data/defaults.ts` (DEFAULT_CODEC_SVG rewrite + SVGO_PLUGINS removal)

**Self-pattern** (defaults.ts lines 29-38):
```typescript
// REWRITE to 12-plugin curated set (RESEARCH.md §Curated Plugin Set):
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
    removeViewBox: false,    // NOT in preset-default — opt-in; foot-gun
    removeDimensions: false, // NOT in preset-default — opt-in; foot-gun
  },
}
```

**Deletion:** Remove `SVGO_PLUGINS` array (lines 74-97) and its `SvgoPlugin` import. Remove `SvgoPlugin` import from `@/types`.

---

### `src/components/panels/SvgoPanel.tsx` (rewrite)

**Analog:** Self (rewrite) + `OutputPanel.tsx` (WR-04 copy pattern for foot-gun hints)

**Existing props interface** (SvgoPanel.tsx lines 5-10) — replace entirely:
```typescript
// NEW props (Phase 3):
interface SvgoPanelProps {
  plugins: Array<{ id: string; on: boolean; savings: { bytes: number; pct: number } | null; footgun?: string }>
  togglePlugin: (id: string) => void
  unsafeExport: boolean
  setUnsafeExport: (v: boolean) => void
}
```

**Existing Section + plugin row pattern** (SvgoPanel.tsx lines 26-39) — reuse `.plugin`, `.check`, `.name`, `.saves` class names verbatim. Add `<small>` foot-gun hint below plugin row when `p.footgun` is set, using the existing "aggressive mode" paragraph style (lines 21-23):
```typescript
// Foot-gun hint — copy aggressive mode paragraph style verbatim:
<p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>
  {p.footgun}
</p>
```

**Aggressive mode section** — DELETE the butteraugli toggle (lines 16-24); replace with "Sanitization" section containing the `unsafeExport` Toggle, reusing the same Toggle component.

---

### `src/stores/settings.ts` (svg slice + snippetTogglesByFileId)

**Self-pattern** (settings.ts lines 40-56):
```typescript
// Extend SettingsState interface:
interface SettingsState {
  // ... existing ...
  snippetTogglesByFileId: Record<string, Record<string, boolean>>  // D-13
  setSnippetToggle: (fileId: string, snippetId: string, value: boolean) => void
}

// Extend create body:
snippetTogglesByFileId: {},
setSnippetToggle: (fileId, snippetId, value) =>
  set((s) => ({
    snippetTogglesByFileId: {
      ...s.snippetTogglesByFileId,
      [fileId]: { ...s.snippetTogglesByFileId[fileId], [snippetId]: value },
    },
  })),
```

**subscribeWithSelector usage** (settings.ts line 41) — the subscriber for D-10 plugin-toggle → enqueuePreview:
```typescript
// In a React component or App.tsx useEffect:
useSettingsStore.subscribe(
  (s) => s.svg.plugins,
  () => {
    const selectedId = useFilesStore.getState().selectedId
    if (selectedId) useRuntimeStore.getState().enqueuePreview(selectedId)
  },
  { equalityFn: shallowEqual }  // zustand/shallow
)
```

---

### `src/stores/runtime.ts` (previewJobId + enqueuePreview)

**Self-pattern** (runtime.ts lines 13-33):
```typescript
// Extend RuntimeState interface:
interface RuntimeState {
  // ... existing ...
  previewJobId: string | null   // D-11: tracks the pending preview job
  enqueuePreview: (fileId: string) => void  // debounced 200ms
}

// In create body:
previewJobId: null,
enqueuePreview: debounce((fileId: string) => {
  const state = get()
  if (!state.running) {
    // No batch in flight — cancel and restart for instant preview
    getWorkerPool().cancel()
  }
  const jobId = crypto.randomUUID()
  set({ previewJobId: jobId })
  // enqueue via WorkerPool using fileId + current svg settings
}, 200),
```

---

### `src/stores/files.ts` (markDone + sanitizedCount)

**Self-pattern** (files.ts lines 56-75):
```typescript
// Extend markDone signature to accept sanitizedCount:
markDone: (fileId: string, optimizedBlob: Blob, optimizedSize: number, sanitizedCount?: number) => void

// Implementation addition inside markDone set():
[fileId]: {
  ...prev,
  optimizedBlob,
  optimizedSize,
  status: 'done',
  ...(sanitizedCount !== undefined ? { sanitizedCount } : {}),
},
```

**Revoke discipline** (files.ts lines 56-59) — preserved verbatim; sanitizedCount is an additional field, does not affect the revokeObjectURL call order.

---

### `src/components/panels/FilePanel.tsx` (sanitized badge)

**Analog:** `src/components/panels/SvgoPanel.tsx` lines 17-23 (warn color pattern)

**Badge pattern** — inline in file row, read `FileEntry.sanitizedCount`:
```typescript
// Color: var(--warn) per UI-SPEC §Color
{entry.sanitizedCount !== undefined && entry.sanitizedCount > 0 && (
  <span style={{ color: 'var(--warn)', font: '9.5px var(--mono)', fontWeight: 600, marginLeft: 2 }}>
    sanitized · {entry.sanitizedCount}
  </span>
)}
```

---

### Tests: `src/tests/svg-pipeline.spec.ts` and `src/tests/svg-xss.spec.ts`

**Analog:** `src/tests/worker-pool.spec.ts` (full file)

**Boilerplate pattern** (worker-pool.spec.ts lines 1-21):
```typescript
import { test, expect } from '@playwright/test'

test.describe('Phase 3 — SVG pipeline (OPT-01, SNIP-01, SNIP-03, SNIP-04)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() =>
      typeof (window as unknown as { __OIMG_STORES__?: unknown }).__OIMG_STORES__ === 'object'
    )
  })
  // ...
})
```

**Store access pattern** (worker-pool.spec.ts lines 25-42):
```typescript
await page.evaluate(() => {
  const stores = (window as unknown as {
    __OIMG_STORES__: { files: { getState: () => any } }
  }).__OIMG_STORES__
  stores.files.getState().addFile({
    id: 'svg-test', name: 'test.svg', format: 'svg',
    originalSize: svgBlob.size, optimizedSize: null,
    status: 'idle', sourceDensity: '1x', thumbnail: null,
    sourceBlob: svgBlob, optimizedBlob: null,
  })
})
```

**Completion wait pattern** (worker-pool.spec.ts lines 48-54):
```typescript
await page.waitForFunction(() => {
  const s = (window as unknown as {
    __OIMG_STORES__: { runtime: { getState: () => any }; files: { getState: () => any } }
  }).__OIMG_STORES__
  const f = s.files.getState().byId['svg-test']
  return !s.runtime.getState().running && f && f.status === 'done'
}, { timeout: 5000 })
```

**XSS spec pattern** — from RESEARCH.md §XSS Spec: Playwright Pattern (lines 706-744); copy verbatim as the base for all 8 attack vectors. Key assertion:
```typescript
const xssFired = await page.evaluate(() => window.__XSS_FIRED__)
expect(xssFired).toBeUndefined()
const count = await page.evaluate(() =>
  window.__OIMG_STORES__.files.getState().byId['xss-test'].sanitizedCount
)
expect(count).toBeGreaterThan(0)
```

### Tests: `src/tests/svg-adapter.unit.ts` and `src/tests/svg-snippets.unit.ts`

**Analog:** `src/tests/fixtures/synthetic.ts` (Node TS unit pattern)

**Run command:** `node --experimental-strip-types src/tests/svg-adapter.unit.ts`

Key assertions for `svg-adapter.unit.ts`:
- `buildSvgoConfig({ plugins: { cleanupIds: false } })` → overrides contains `cleanupIds: false`
- `buildSvgoConfig({ plugins: { removeViewBox: true } })` → extra plugins contains `'removeViewBox'`
- `buildSvgoConfig({ plugins: { removeViewBox: false } })` → extra plugins does NOT contain `'removeViewBox'`

Key assertions for `svg-snippets.unit.ts` (yoksel test cases from RESEARCH.md §Pattern 3):
- `encodeSvgForDataUri('<svg>')` → `'%3Csvg%3E'`
- `encodeSvgForDataUri('fill="#f00"')` → `"fill='%23f00'"`
- UTF-8 `★` left unchanged

---

## Shared Patterns

### Zustand Store Slice Pattern
**Source:** `src/stores/settings.ts` lines 40-56
**Apply to:** All store extensions (settings, runtime, files)
```typescript
export const useXxxStore = create<XxxState>()(
  subscribeWithSelector((set, get) => ({
    // state fields,
    // actions use: set((s) => ({ ...s, field: newValue }))
  }))
)
```

### Object URL Revoke Discipline
**Source:** `src/stores/files.ts` lines 56-59
**Apply to:** Any code that updates `optimizedBlob` — ALWAYS call `revokeObjectURL(fileId)` BEFORE writing new blob.
```typescript
useRuntimeStore.getState().revokeObjectURL(fileId)
set((s) => { /* then write new blob */ })
```

### AdapterError Throw Pattern
**Source:** `src/workers/types.ts` lines 41-50
**Apply to:** `svg-adapter.ts` error handling
```typescript
throw new AdapterError('svg', 'process', err instanceof Error ? err.message : String(err))
```

### WR-04 Clipboard Copy Pattern
**Source:** `src/components/panels/OutputPanel.tsx` lines 17-33
**Apply to:** `SnippetPanel.tsx` — every copy button
- Wait for `navigator.clipboard.writeText()` to resolve before flipping UI
- `toast.error('Clipboard unavailable')` when API missing
- `toast.error('Copy failed')` on rejection
- 1100ms auto-reset of "copied" state

### Section / Plugin Row CSS Classes
**Source:** `src/components/panels/SvgoPanel.tsx` + `src/components/ui/Section.tsx`
**Apply to:** `SvgoPanel.tsx` rewrite, `SnippetPanel.tsx`
- Use `<Section title="..." badge={{ text: '...', acc: true }}>` — do not change padding
- Use `.plugin`, `.check`, `.name`, `.saves` class names verbatim for plugin rows
- Use `.code-row`, `.lbl`, `.copy-btn`, `.code` class names verbatim for snippet rows
- Foot-gun hint: `<p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>` (copies line 21-23 of SvgoPanel.tsx)

### Playwright `__OIMG_STORES__` Access
**Source:** `src/tests/worker-pool.spec.ts` lines 25-42
**Apply to:** All Phase 3 E2E tests
- Always cast through `window as unknown as { __OIMG_STORES__: ... }`
- Always await `page.waitForFunction(() => typeof window.__OIMG_STORES__ === 'object')` in beforeEach

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/tests/fixtures/xss-*.svg` | fixture | — | First fixture corpus; no existing SVG fixtures in codebase |

---

## Metadata

**Analog search scope:** `src/workers/`, `src/components/panels/`, `src/stores/`, `src/types/`, `src/data/`, `src/tests/`
**Files read:** 12 source files + 3 planning documents
**Pattern extraction date:** 2026-05-01
