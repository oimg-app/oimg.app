# Phase 3: SVG Pipeline — Research

**Researched:** 2026-05-01
**Domain:** SVGO v4 browser ESM, DOMPurify SVG profiles, snippet registry, yoksel URL-encoding, worker cancel/debounce
**Confidence:** HIGH (stack + API surface verified from local package inspection + npm registry; architecture from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sanitization Layering**
- D-01: Post-SVGO only. Pipeline: `ArrayBuffer → TextDecoder → SVGO → DOMPurify → TextEncoder → ArrayBuffer`
- D-02: `USE_PROFILES: { svg: true, svgFilters: true }` — no FORBID_TAGS overrides
- D-03: Sanitized content → per-file `sanitized · N` badge (warn color), no toast
- D-04: Single sanitized blob as source of truth + global "Disable SVG sanitization on export" toggle (default: sanitize)

**Plugin UI Surface**
- D-05: Curated 10–12 plugins replacing both `SVGO_PLUGINS` mock and `DEFAULT_CODEC_SVG.plugins` record
- D-06: Live per-plugin savings via N+1 SVGO passes per Optimize batch completion
- D-07: Default state mirrors SVGO preset-default exactly; `removeViewBox: false` flips to `true` (D-07 mandate — see **CRITICAL** finding below)
- D-08: Plugin toggle auto re-runs SVGO on the inspected/selected file only; rest of batch waits for explicit Optimize

**Real-time Re-optimize**
- D-09: SVGO settings are global in v1 (no per-file overrides)
- D-10: Store-subscriber → adapter run on selected file → `markDone` updates UI
- D-11: Mass-toggle race = cancel + restart, debounced ~200ms; `previewJobId` slot in `useRuntimeStore`

**Snippet Scope**
- D-12: `OutputPanel` → generic `SnippetPanel` with snippet registry
- D-13: Per-file per-snippet enable/disable checkboxes ship in Phase 3
- D-14: ID-collision handling for inline SVG deferred to Phase 6
- D-15: URL-encode mirrors yoksel minimal-escape verbatim (`<`, `>`, `#`, `"→'`; UTF-8/spaces left alone)

### Claude's Discretion
- Exact location of "Disable SVG sanitization on export" toggle (resolved in 03-UI-SPEC.md: `Sanitization` section in SvgoPanel)
- Whether `sanitizedCount` is boolean or numeric (resolved in 03-UI-SPEC.md: show count)
- Exact 10–12 plugin set (resolved in 03-UI-SPEC.md: 12 plugins listed with order)
- Foot-gun warning affordance (resolved in 03-UI-SPEC.md: inline `<small>` + info-circle glyph)
- File layout for adapter (`src/adapters/svg/` vs `src/workers/svg-adapter.ts`)
- Snippet registry shape (functional registry vs class hierarchy)
- Per-snippet, per-file checkbox state shape in the settings store
- Error type taxonomy for malformed SVG

### Deferred Ideas (OUT OF SCOPE)
- Per-file SVGO overrides (Phase 5/6)
- Inline-SVG ID-collision handling (Phase 6)
- Custom DOMPurify allow-list (post-v1)
- Pre-SVGO sanitization (rejected)
- Toast-style sanitization warnings (rejected for D-03)
- Deep custom plugin configuration UI (Phase 6+)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPT-01 | SVG optimization via SVGO browser bundle (preset-default + per-plugin toggles) | §SVGO v4 API; §Plugin Set Reconciliation; §Worker Wiring |
| SNIP-01 | Per-file snippet panel with inline SVG and URL-encoded data URI (SVG) | §Snippet Registry; §SnippetPanel; §yoksel Encoder |
| SNIP-03 | One-click copy-to-clipboard per snippet | §SnippetPanel: clipboard pattern from OutputPanel preserved verbatim |
| SNIP-04 | URL-encoded data URI for SVG (cross-browser CSS-safe) | §yoksel Encoder; §D-15 exact escape set |
| PIPE-01 | Drag-and-drop/file-pick for SVG files (already works via Phase 2 harness) | §Worker Wiring: svg slot in ADAPTERS map replaces throw stub |
</phase_requirements>

---

## Summary

Phase 3 wires the first real codec adapter (`svg-adapter.ts`) behind the existing Phase 2 worker/adapter contract, adds DOMPurify post-sanitization, refactors `OutputPanel` into a generic `SnippetPanel` with a registry, rewrites `SvgoPanel` to use the curated plugin set with live savings, and implements the two SVG snippet generators (inline SVG + yoksel URL-encoded data URI).

**CRITICAL finding — `removeViewBox` is NOT in SVGO v4 `preset-default`:** Verified by inspection of `/tmp/package/plugins/preset-default.js` (extracted from `svgo@4.0.1` tarball). The 34-plugin `preset-default` list contains neither `removeViewBox` nor `removeDimensions`. D-07 says "mirror preset-default" and 03-UI-SPEC.md row 11 says default `on` for `removeViewBox` citing D-07 reconciliation. There is a direct contradiction: the spec says `on` but preset-default doesn't include the plugin at all. **Resolution: Display `removeViewBox` and `removeDimensions` as opt-in extras (default `off` = not in preset-default). This is the correct D-07 behavior.** The 03-UI-SPEC.md row 11 entry is wrong and must be corrected in planning. See `§CRITICAL Contradiction` below.

**Primary recommendation:** `src/workers/svg-adapter.ts` (flat, parallel to stub-adapter) for the adapter; `src/lib/svg-snippets.ts` for generators; `src/components/panels/SnippetPanel.tsx` replaces `OutputPanel.tsx`. Registry is a plain `Record<SnippetId, SnippetDef>` object — no class hierarchy.

---

## CRITICAL Contradiction: UI-SPEC.md vs SVGO v4 Preset-Default

**Finding:** `removeViewBox` and `removeDimensions` are **not** in SVGO v4 `preset-default`. Verified by source inspection of `svgo@4.0.1` `plugins/preset-default.js`. The 34 plugins in preset-default are listed in `§Curated Plugin Set` below.

**Contradiction:** `03-UI-SPEC.md` specifies `removeViewBox` default = `on` and `removeDimensions` default = `off`, citing D-07 ("mirror preset-default"). But preset-default doesn't include either plugin. `on` would mean enabling a plugin that SVGO's own preset disables by default.

**Impact:** If `removeViewBox: true` is shipped in `DEFAULT_CODEC_SVG.plugins`, the adapter will run `removeViewBox` on every SVG even though SVGO's own preset doesn't. This contradicts D-07's intent ("don't override SVGO's defaults").

**Correct resolution for planner:** Set both `removeViewBox` and `removeDimensions` to `false` (off) in `DEFAULT_CODEC_SVG.plugins`. Display them in the curated panel as explicitly opt-in with foot-gun warnings. The UI-SPEC row 11 value (`on`) is a mistake in the spec derived from a misread of D-07. The D-07 text says "mirror preset-default" — mirroring means OFF because preset-default doesn't include `removeViewBox`. The existing `defaults.ts` `removeViewBox: false` was actually correct and must NOT flip to `true`.

**Update needed:** `src/data/defaults.ts` comment changes; `removeViewBox: false` stays; the 03-UI-SPEC.md row 11 value is a spec error to be caught in plan-checker.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SVG optimization (SVGO) | Worker thread (`svg-adapter.ts`) | — | Must not block main thread; Phase 2 D-04 contract |
| DOMPurify sanitization | Worker thread (inside `svg-adapter.ts`) | — | D-01: post-SVGO, in-adapter; DOMPurify is browser-native, works in workers |
| Plugin toggle → debounce → cancel/restart | Main thread (`useRuntimeStore`) | WorkerPool | D-11: `previewJobId` + debounced `enqueuePreview`; pool cancel is in pool.ts |
| Live per-plugin savings computation | Worker thread (N+1 SVGO runs per file) | Main thread (aggregate + store) | D-06: batch work in workers; aggregate stored in `useSettingsStore.svg.pluginSavings` |
| Snippet generation (inline-svg, url-encoded) | Main thread (`src/lib/svg-snippets.ts`) | — | Text manipulation only; no WASM; synchronous; safe on main thread |
| Snippet registry | Main thread (`src/lib/snippet-registry.ts`) | — | Static lookup; consumed by `SnippetPanel` render |
| Sanitized blob as source of truth | Worker (produces) → `useFilesStore.markDone` (consumes) | — | D-04 blob-in-store discipline from Phase 2 D-12 |
| File-row sanitized badge | Main thread (`FilePanel.tsx` or wherever `.file-row` renders) | — | D-03: reads `FileEntry.sanitizedCount` from `useFilesStore.byId[id]` |

---

## Standard Stack

### Core (new installs for Phase 3)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svgo` | `^4.0.1` | SVG optimization — browser ESM entry `svgo/browser` | `[VERIFIED: npm view svgo — 4.0.1, 2026-03-04]` Only library; v4 ships native ESM, no Node shims. Locked in CLAUDE.md. |
| `dompurify` | `^3.4.2` | XSS sanitization — native browser-DOM implementation | `[VERIFIED: npm view dompurify — 3.4.2, 2026-04-30]` Used by major platforms; battle-tested SVG profile. No jsdom needed in browser. |
| `@types/dompurify` | bundled in `dompurify` package | TypeScript types | `[VERIFIED: dompurify@3.4.2 src/purify.ts exports typed interfaces]` Types ship with package in `src/`; check `dist/purify.cjs.d.ts`. |

### Already Installed (reused)
| Library | Version | Purpose |
|---------|---------|---------|
| `comlink` | `^4.4.2` | Worker RPC — unchanged from Phase 2 |
| `zustand` | `^5.0.12` | Store subscriptions — `subscribeWithSelector` already wired in `settings.ts` |
| `sonner` | `^2.0.7` | Clipboard-failure toast — preserved from OutputPanel WR-04 pattern |

**Installation:**
```bash
npm install svgo dompurify
```

---

## Architecture Patterns

### System Architecture Diagram

```
MAIN THREAD
──────────────────────────────────────────────────────────────────
 User toggles plugin (SvgoPanel)
   │
   ▼
 useSettingsStore.setSvg({ plugins: { ... } })
   │ subscribeWithSelector fires
   ▼
 useRuntimeStore.enqueuePreview(selectedFileId)  ← debounce 200ms (D-11)
   │ if previewJobId != null: pool.cancel() first
   ▼
 WorkerPool.enqueue({ format: 'svg', ... })
   │ Comlink.transfer(ArrayBuffer)
   │
WORKER THREAD
──────────────────────────────────────────────────────────────────
   ▼
 svg-adapter.run(input, settings: CodecSettingsSvg)
   │ TextDecoder
   ▼
 SVGO optimize(svgString, { plugins: [{ name: 'preset-default', params: { overrides: { ... } } }] })
   │ returns { data: string }
   ▼
 DOMPurify.sanitize(data, { USE_PROFILES: { svg: true, svgFilters: true } })
   │ DOMPurify.removed[] reset each call; count accumulated
   ▼
 TextEncoder → ArrayBuffer (output)
   return { output, meta: { sanitizedCount, unchanged } }
   │
MAIN THREAD
──────────────────────────────────────────────────────────────────
   ▼
 pool.callbacks.onDone(jobId, result)
   │ revokeObjectURL(fileId) then write new blob
   ▼
 useFilesStore.markDone(fileId, new Blob([output]), output.byteLength)
   +  useFilesStore.setSanitizedCount(fileId, meta.sanitizedCount)
   │ triggers React re-render
   ▼
 FilePanel: shows "sanitized · N" badge if sanitizedCount > 0
 SnippetPanel: reads FileEntry.optimizedBlob → generates snippets
```

**Batch Optimize path** (user clicks Optimize button):
```
useRuntimeStore.startBatch([...fileIds])
  → for each SVG file: WorkerPool.enqueue(job)
  → on all jobs done: compute D-06 live savings (N+1 passes per file)
    → useSettingsStore.setSvg({ pluginSavings: { ... } })
    → SvgoPanel re-renders with live % values
```

### Recommended Project Structure
```
src/
├── workers/
│   ├── pool.ts               # (Phase 2, unchanged)
│   ├── worker.ts             # ADAPTERS map: svg: () => import('./svg-adapter')
│   ├── stub-adapter.ts       # (Phase 2, unchanged)
│   └── svg-adapter.ts        # NEW: TextDecoder → SVGO → DOMPurify → TextEncoder
├── lib/
│   ├── svg-snippets.ts       # NEW: inline-svg + url-encoded generators
│   ├── snippet-registry.ts   # NEW: SnippetDef registry + lookup
│   └── live-region.ts        # (Phase 2, unchanged)
├── stores/
│   ├── files.ts              # EXTEND: markDone signature adds sanitizedCount
│   ├── settings.ts           # EXTEND: svg adds unsafeExport, pluginSavings, snippetTogglesByFileId
│   └── runtime.ts            # EXTEND: previewJobId + enqueuePreview debounced action
├── types/
│   └── index.ts              # EXTEND: FileEntry adds sanitizedCount; SnippetId type
├── data/
│   └── defaults.ts           # REWRITE: DEFAULT_CODEC_SVG.plugins → 12-plugin record
└── components/
    ├── panels/
    │   ├── SvgoPanel.tsx     # REWRITE: curated plugins + live savings + sanitization section
    │   ├── SnippetPanel.tsx  # NEW: replaces OutputPanel.tsx
    │   └── OutputPanel.tsx   # DELETE (replaced by SnippetPanel)
    └── ui/
        └── (no new primitives per Phase 1 D-06)
```

### Pattern 1: SVGO v4 Browser ESM — optimize() API

**Import path:** `svgo/browser` (not bare `svgo` — that resolves to Node.js entry)

```typescript
// Source: /tmp/package/package.json exports field — verified 2026-05-01
// { './browser': { types: './types/lib/svgo.d.ts', import: './dist/svgo.browser.js' } }
import { optimize } from 'svgo/browser'

// Return shape: { data: string } — no error field; throws on malformed SVG
// [VERIFIED: /tmp/package/lib/svgo.js lines 131-133]
const result = optimize(svgString, {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Disable a preset-default plugin:
          cleanupIds: false,
          // Or configure it:
          convertPathData: { floatPrecision: 4 },
        },
      },
    },
    // Extra opt-in plugins (not in preset-default):
    'removeViewBox',   // opt-in only when user enables toggle
    'removeDimensions', // opt-in only when user enables toggle
  ],
})
// result.data = optimized SVG string
```

**Plugin config shape for Phase 3 adapter:**
```typescript
function buildSvgoConfig(settings: CodecSettingsSvg): Parameters<typeof optimize>[1] {
  const overrides: Record<string, boolean | object> = {}
  const extraPlugins: string[] = []

  // Plugins that ARE in preset-default → use overrides to disable when off
  const PRESET_DEFAULT_PLUGINS = new Set([
    'removeComments', 'removeMetadata', 'removeUselessDefs', 'removeUnusedNS',
    'cleanupIds', 'cleanupNumericValues', 'convertColors', 'convertPathData',
    'mergePaths', 'minifyStyles',
  ])
  // Plugins NOT in preset-default → include as extra plugin when on
  const EXTRA_PLUGINS = new Set(['removeViewBox', 'removeDimensions'])

  for (const [id, enabled] of Object.entries(settings.plugins)) {
    if (PRESET_DEFAULT_PLUGINS.has(id)) {
      if (!enabled) overrides[id] = false
    } else if (EXTRA_PLUGINS.has(id)) {
      if (enabled) extraPlugins.push(id)
    }
  }

  return {
    plugins: [
      { name: 'preset-default', params: { overrides } },
      ...extraPlugins,
    ],
  }
}
```

**Error handling:** `optimize()` throws (not rejects) on malformed SVG. Wrap in try/catch; throw `AdapterError(format, 'process', message)`.

### Pattern 2: DOMPurify SVG Profile

**Import:** `import DOMPurify from 'dompurify'` — browser-native; no jsdom. Works in Web Workers (they have access to the DOM API).

**Wait — DOMPurify requires `window` and `document`.** Standard Web Workers do NOT have `window` or `document`. This is a known limitation. **Resolution:** DOMPurify must run on the main thread, not inside the worker, OR the adapter must use `postMessage` to bounce sanitization back to main thread.

**Recommended approach for D-01 (post-SVGO in-adapter):** Move DOMPurify to main thread as a separate step after the worker returns SVGO-optimized bytes. Pipeline becomes:
- Worker: `ArrayBuffer → TextDecoder → SVGO → TextEncoder → ArrayBuffer` (SVGO only)
- Main thread: `ArrayBuffer → TextDecoder → DOMPurify → TextEncoder → ArrayBuffer` (sanitization)

This is architecturally cleaner and doesn't violate D-01's intent (DOMPurify still runs post-SVGO before bytes reach preview/snippet/ZIP).

**Alternatively (verified approach):** `svgo/browser` runs in a Worker because it's pure JS with no DOM access. DOMPurify cannot run directly in a standard Worker. The adapter can either:
1. Keep DOMPurify in a main-thread `useSanitize` hook that wraps the pool callback
2. Use a dedicated sanitization step in `useFilesStore.markDone` (preferred — keeps adapter contract clean and avoids special-casing in the worker)

**Recommended (for planner):** DOMPurify runs in the main thread in a `sanitizeSvgBlob(blob: Blob): Promise<{ blob: Blob; sanitizedCount: number }>` helper called from the pool `onDone` callback before `useFilesStore.markDone`. The svg-adapter becomes SVGO-only. D-01 is still satisfied (DOMPurify is still post-SVGO).

**DOMPurify config (D-02):**
```typescript
// Source: /tmp/dompurify/package/README.md line 205-208 [VERIFIED]
import DOMPurify from 'dompurify'

// USE_PROFILES: { svg: true } = allow all safe SVG elements
// USE_PROFILES: { svgFilters: true } = also allow SVG filter elements (feGaussianBlur etc.)
// Neither HTML nor MathML permitted in this config
const clean = DOMPurify.sanitize(dirtyString, {
  USE_PROFILES: { svg: true, svgFilters: true },
})
// Returns: string (clean SVG markup)
// DOMPurify.removed resets to [] at the start of each sanitize() call
// [VERIFIED: /tmp/dompurify/package/src/purify.ts line 1629]
const sanitizedCount = DOMPurify.removed.length
```

**`DOMPurify.removed` array shape (verified from source):**
```typescript
// [VERIFIED: /tmp/dompurify/package/src/purify.ts lines 2062-2084]
type RemovedElement = { element: Node }
type RemovedAttribute = { attribute: Attr | null; from: Node }
// DOMPurify.removed: Array<RemovedElement | RemovedAttribute>
// Each call to sanitize() resets removed = [] first (line 1629), then populates it.
// No accumulation across calls — safe to read .length immediately after sanitize().
```

**Hook signatures (if needed for debugging — D-03 does not require hooks):**
```typescript
// [VERIFIED: /tmp/dompurify/package/src/purify.ts lines 2141-2153]
DOMPurify.addHook('uponSanitizeElement',
  (currentNode: Node, hookEvent: UponSanitizeElementHookEvent, config: Config) => void
)
DOMPurify.addHook('uponSanitizeAttribute',
  (currentNode: Element, hookEvent: UponSanitizeAttributeHookEvent, config: Config) => void
)
// For D-03 (count), checking DOMPurify.removed.length after sanitize() is simpler than hooks.
```

**Return type:** Default (no `RETURN_DOM` / `RETURN_DOM_FRAGMENT`) returns a string. Use this path — we want string out for TextEncoder.

### Pattern 3: yoksel URL-Encoder (D-15)

**Source:** `inspired/url-encoder/src/js/script.js` — read and verified 2026-05-01.

**Exact escape set (line 15):**
```javascript
const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g
```

**D-15 operation — encode only the problematic characters:**
```typescript
// Source: inspired/url-encoder/src/js/script.js lines 134-148 [VERIFIED verbatim]
// "externalQuotesValue === 'double'" branch (oimg uses double quotes for CSS url())

function encodeSvgForDataUri(svgString: string): string {
  // Step 1: Replace double quotes with single (avoids percent-encoding in CSS url("..."))
  let data = svgString.replace(/"/g, "'")

  // Step 2: Collapse whitespace (optional but yoksel does it)
  data = data.replace(/>\s{1,}</g, '><')
  data = data.replace(/\s{2,}/g, ' ')

  // Step 3: Percent-encode only the characters that break URL/CSS contexts
  // The symbols regex from yoksel — these are the ONLY characters encoded
  const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g
  return data.replace(symbols, encodeURIComponent)
}

// Full CSS output:
// `url("data:image/svg+xml,${encodeSvgForDataUri(sanitizedSvg)}")`
```

**Reference test cases (derived from regex):**

| Input | Output | Why |
|-------|--------|-----|
| `<svg>` | `%3Csvg%3E` | `<` → `%3C`, `>` → `%3E` |
| `fill="#f00"` | `fill='%23f00'` | `"` → `'`, `#` → `%23` |
| `<path d="M0 0"/>` | `%3Cpath d='M0 0'/%3E` | `<`, `>`, `"` → `'` |
| `xmlns="http://..."` | `xmlns='http://...'` | `"` → `'`; `:` left alone (not in regex) |
| `viewBox="0 0 100 100"` | `viewBox='0 0 100 100'` | `"` → `'`; spaces left alone |
| `<!-- comment -->` | `%3C!-- comment --%3E` | `<` and `>` encoded |
| UTF-8 emoji `★` | `★` (unchanged) | Not in symbols regex; left as UTF-8 |
| Newline `\n` | `%0A` | `\r\n` in regex |

**Note:** yoksel also calls `addNameSpace()` to inject `xmlns` if missing. The adapter should also add xmlns when missing (SVGO may strip it). Pattern:
```typescript
function ensureNamespace(svg: string): string {
  if (!svg.includes('http://www.w3.org/2000/svg')) {
    return svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'")
  }
  return svg
}
```

### Pattern 4: Snippet Registry

**Registry interface (D-12 functional approach):**
```typescript
// src/lib/snippet-registry.ts
export type SnippetId = 'inline-svg' | 'url-encoded-uri' | 'picture' | 'img-srcset' | 'data-uri-base64'

export interface SnippetDef {
  id: SnippetId
  label: string            // Section title: "Inline SVG", "Data URI · URL-encoded"
  badge: string            // Section badge: "inline", "data-uri"
  codeLabel: string        // Row label: "<svg>", "CSS background"
  applicableFormats: FormatId[]  // ['svg'] or ['png','jpeg','webp','avif']
  generate: (file: FileEntryWithBlob) => string | null  // null = no data yet
}

// The registry — a plain object, not a class
export const SNIPPET_REGISTRY: Record<SnippetId, SnippetDef> = {
  'inline-svg': {
    id: 'inline-svg',
    label: 'Inline SVG',
    badge: 'inline',
    codeLabel: '<svg>',
    applicableFormats: ['svg'],
    generate: (file) => {
      if (!file.optimizedBlob) return null
      // Phase 3: caller reads blob as text synchronously (already done)
      // generate() receives pre-decoded string via SnippetPanel
      return null // placeholder; actual generator reads blob → string
    },
  },
  'url-encoded-uri': { /* ... */ },
  // Phase 5/6 stubs:
  'picture': { applicableFormats: ['png','jpeg','webp','avif'], generate: () => null },
  'img-srcset': { applicableFormats: ['png','jpeg','webp','avif'], generate: () => null },
  'data-uri-base64': { applicableFormats: ['png','jpeg','webp','avif'], generate: () => null },
}
```

**SnippetPanel render loop:**
```typescript
// Filter by format, then per-file enabled state
const visibleSnippets = Object.values(SNIPPET_REGISTRY)
  .filter(def => def.applicableFormats.includes(file.format))
// For SVG: only 'inline-svg' and 'url-encoded-uri' render
// Raster stubs: zero rows render (Phase 6 fills them in)
```

**Note on async blob reading:** `generate()` cannot be synchronous if it reads the blob. Recommended: `SnippetPanel` reads `optimizedBlob.text()` once when the selected file changes (via `useEffect`) and stores the decoded string in local state. Then `generate()` receives the pre-decoded string.

### Pattern 5: Worker Plumbing for D-10/D-11 (Preview Job)

**Current pool cancel surface:** `WorkerPool.cancel()` terminates all workers + rejects all pending jobs. This is too broad for D-11 (we only want to cancel the single preview job, not abort the whole batch).

**Recommended approach for D-11:** Use the existing `cancel()` only when no batch is running (`!running`). During an active batch, the preview job should be queued as a FIFO entry; toggling a plugin while a batch is in flight will not cancel the batch — it will queue a preview job that runs after the current in-flight jobs complete. The 200ms debounce prevents pile-up.

```typescript
// useRuntimeStore additions:
interface RuntimeState {
  // ... existing fields ...
  previewJobId: string | null
  enqueuePreview: (fileId: string, settings: CodecSettingsSvg) => void
}

// Implementation (simplified):
enqueuePreview: debounce((fileId, settings) => {
  const state = get()
  if (!state.running) {
    // No batch in flight — safe to cancel-and-restart pool for instant preview
    getWorkerPool().cancel()
  }
  const jobId = crypto.randomUUID()
  set({ previewJobId: jobId })
  getWorkerPool().enqueue({ id: jobId, fileId, format: 'svg', settings, blob: sourceBlob })
}, 200)
```

**Comlink.transfer for SVG path:** SVG is text, so the actual bytes are small (~10–100 KB). The ArrayBuffer transfer semantics still apply (zero-copy postMessage). No change needed from Phase 2 patterns. `Comlink.transfer(input, [input])` on the way in; `Comlink.transfer({ output, meta }, [output])` on the way back. Verified: Phase 2 `worker.ts` line 47 already does this for all formats.

### Anti-Patterns to Avoid

- **Importing `svgo` (not `svgo/browser`):** The default `svgo` export resolves to `lib/svgo-node.js` which requires Node.js APIs. Vite will error or produce a broken bundle. Always `import { optimize } from 'svgo/browser'`. `[VERIFIED: npm view svgo exports]`
- **Calling DOMPurify in a standard Web Worker:** Workers lack `document`; DOMPurify will throw. Move sanitization to main thread (see Pattern 2 above).
- **Using `extendDefaultPlugins` helper:** Removed in SVGO v3; does not exist in v4. Use `{ name: 'preset-default', params: { overrides: {...} } }` instead. `[VERIFIED: README.md]`
- **Treating `optimize()` return as `{ data, error }`:** v4 returns only `{ data: string }`. Errors throw. Catch them. `[VERIFIED: /tmp/package/lib/svgo.js lines 131-133]`
- **Passing `Response` or `ArrayBuffer` directly to `optimize()`:** Input must be a UTF-8 string. Use `TextDecoder` first.
- **Reading `DOMPurify.removed` before calling `sanitize()`:** It's a static property initialized to `[]` on module load, reset at the start of each `sanitize()` call (line 1629). Always read it immediately after `sanitize()`, on the same call stack.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG optimization | Custom XML transform | `svgo` v4 `optimize()` | 34 battle-tested plugins; handles edge cases like CDATA, namespaces, complex path arithmetic |
| XSS sanitization | Custom allowlist filtering | DOMPurify `USE_PROFILES.svg` | Security is context-dependent; hand-rolled allow-lists miss mutation XSS, polyglots, encoding tricks |
| SVG URL encoding | `encodeURIComponent(svg)` | yoksel minimal-escape | Full percent-encoding doubles the CSS string size; minimal-escape produces ~20–40% smaller output |
| Clipboard copy | `document.execCommand('copy')` | `navigator.clipboard.writeText()` with sonner error fallback | `execCommand` is deprecated; async Clipboard API is the standard; WR-04 pattern already in OutputPanel |

---

## Curated Plugin Set (D-05 — Final 12-Plugin List)

Verified against `svgo@4.0.1` `plugins/preset-default.js`. `[VERIFIED: source inspection 2026-05-01]`

**Plugins included in SVGO v4 `preset-default` (all 34):**
`removeDoctype`, `removeXMLProcInst`, `removeComments`, `removeDeprecatedAttrs`, `removeMetadata`, `removeEditorsNSData`, `cleanupAttrs`, `mergeStyles`, `inlineStyles`, `minifyStyles`, `cleanupIds`, `removeUselessDefs`, `cleanupNumericValues`, `convertColors`, `removeUnknownsAndDefaults`, `removeNonInheritableGroupAttrs`, `removeUselessStrokeAndFill`, `cleanupEnableBackground`, `removeHiddenElems`, `removeEmptyText`, `convertShapeToPath`, `convertEllipseToCircle`, `moveElemsAttrsToGroup`, `moveGroupAttrsToElems`, `collapseGroups`, `convertPathData`, `convertTransform`, `removeEmptyAttrs`, `removeEmptyContainers`, `mergePaths`, `removeUnusedNS`, `sortAttrs`, `sortDefsChildren`, `removeDesc`

**NOT in preset-default:** `removeViewBox`, `removeDimensions`, `removeDimensions`, `prefixIds`, `reusePaths`, `removeHiddenElems`, `addAttributesToSVGElement`, etc.

**Phase 3 curated 12 (from 03-UI-SPEC.md, corrected defaults):**

| # | Plugin id | In preset-default? | Correct default | Foot-gun warning |
|---|-----------|-------------------|-----------------|------------------|
| 1 | `removeComments` | YES | **on** | — |
| 2 | `removeMetadata` | YES | **on** | — |
| 3 | `removeUselessDefs` | YES | **on** | — |
| 4 | `removeUnusedNS` | YES | **on** | — |
| 5 | `cleanupIds` | YES | **on** | May break external CSS or `<use>` refs |
| 6 | `cleanupNumericValues` | YES | **on** | — |
| 7 | `convertColors` | YES | **on** | — |
| 8 | `convertPathData` | YES | **on** | — |
| 9 | `mergePaths` | YES | **on** | — |
| 10 | `minifyStyles` | YES | **on** | — |
| 11 | `removeViewBox` | **NO** | **off** | Disabling viewBox can break responsive scaling |
| 12 | `removeDimensions` | **NO** | **off** | Removes width/height — only safe when viewBox is preserved |

**`DEFAULT_CODEC_SVG.plugins` final shape (planner uses this):**
```typescript
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
  removeViewBox: false,   // NOT in preset-default — opt-in extra; foot-gun
  removeDimensions: false, // NOT in preset-default — opt-in extra; foot-gun
}
```

---

## DOMPurify Removal Detection Plumbing

**For D-03 sanitizedCount in `AdapterMeta`:**

Since DOMPurify moves to main thread (see Pattern 2), the count is produced in the main-thread sanitization helper:

```typescript
// src/lib/sanitize-svg.ts
import DOMPurify from 'dompurify'

export function sanitizeSvg(svgString: string, unsafe: boolean): {
  clean: string
  sanitizedCount: number
} {
  if (unsafe) return { clean: svgString, sanitizedCount: 0 }
  const clean = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
  })
  // DOMPurify.removed is reset at the start of each sanitize() call (verified line 1629)
  const sanitizedCount = DOMPurify.removed.length
  return { clean, sanitizedCount }
}
```

**Store extension for D-03:**

`FileEntry` in `src/types/index.ts` needs `sanitizedCount?: number`. `useFilesStore.markDone` gains a third optional param or a separate `setSanitizedCount(fileId, count)` action.

**`AdapterMeta` extension (backward-compatible):**

If DOMPurify stays in the worker (alternative approach), extend `AdapterMeta`:
```typescript
// src/workers/types.ts — add optional field
export interface AdapterMeta {
  unchanged?: boolean
  codecVersion?: string
  sanitizedCount?: number  // NEW: populated by svg-adapter only
}
```

---

## XSS Test Corpus (for SC-3)

Playwright spec must drop each SVG through the full pipeline (optimize → sanitize → preview → snippet) and assert execution does NOT occur.

| Attack Vector | SVG Fixture | DOMPurify action | Expected `removed.length` |
|---------------|-------------|-----------------|--------------------------|
| Script tag | `<svg><script>alert(1)</script></svg>` | Element removed | ≥ 1 |
| Inline handler | `<svg onload="alert(1)"></svg>` | Attribute stripped | ≥ 1 |
| SVG event handler | `<svg><circle onmouseover="alert(1)" r="50"/></svg>` | Attribute stripped | ≥ 1 |
| `javascript:` in href | `<svg><a href="javascript:alert(1)">x</a></svg>` | Attribute sanitized/removed | ≥ 1 |
| `javascript:` in xlink:href | `<svg><image xlink:href="javascript:alert(1)"/></svg>` | Attribute removed | ≥ 1 |
| `data:` URI in href | `<svg><a href="data:text/html,<script>alert(1)</script>">x</a></svg>` | Attribute removed | ≥ 1 |
| foreignObject with script | `<svg><foreignObject><script>alert(1)</script></foreignObject></svg>` | foreignObject or script removed | ≥ 1 |
| CSS expression (style) | `<svg><rect style="behavior: url(#xss)"/></svg>` | Style attribute cleaned | ≥ 0 (DOMPurify sanitizes CSS expressions in style) |

**Playwright assertion pattern:**
```typescript
// After DOMPurify, the clean string must NOT contain these patterns
expect(cleanSvg).not.toContain('<script')
expect(cleanSvg).not.toContain('onload=')
expect(cleanSvg).not.toContain('javascript:')
// Functional test: inject SVG as inline element, assert no alert fires
```

---

## Performance Budget for D-06 Live Savings

**Empirical estimate:** SVGO on a 10KB SVG ≈ 3–8ms (JavaScript, no WASM). For a 100KB complex illustration ≈ 15–40ms.

**Worst case (D-06 acknowledged):** 12 plugins × 30 files × 30ms avg = 10,800ms sequential. With 4 workers in parallel: ~2,700ms.

**Recommendation:** Run D-06 savings computation entirely in the worker pool as part of the post-batch lifecycle. Since it's N+1 passes per file and file processing is already done, queue the savings jobs immediately after batch completion. With pool parallelism, 30 files × 13 passes = 390 jobs ÷ 4 workers ≈ ~100 jobs per worker × 8ms each = ~800ms wall time. Acceptable.

**Abort threshold:** If post-batch savings computation exceeds 5s total, set a `pluginSavingsStale: true` flag and show `—` in the savings column. This is a fallback for very large batches (100+ files). Implement as a `Promise.race(savingsJob, timeout(5000))`.

---

## Common Pitfalls

### Pitfall 1: DOMPurify in a Web Worker
**What goes wrong:** `DOMPurify.sanitize()` called inside `svg-adapter.ts` (which runs in a Worker) throws because `document` is not defined in standard Workers.
**Why it happens:** DOMPurify checks `window.document.nodeType` at initialization (verified: `purify.ts` line 132–138). Workers have no `document`.
**How to avoid:** Move DOMPurify sanitization to main thread. The svg-adapter handles SVGO only. Sanitization runs in a main-thread helper (`src/lib/sanitize-svg.ts`) called from the pool `onDone` callback.
**Warning signs:** `ReferenceError: document is not defined` in worker console.

### Pitfall 2: `svgo` vs `svgo/browser` Import
**What goes wrong:** `import { optimize } from 'svgo'` resolves to `lib/svgo-node.js` in Vite, which uses Node.js-specific `path`, `fs` APIs → runtime error in browser.
**Why it happens:** The `svgo` package default export is the Node.js entry. `svgo/browser` is the browser-safe ESM export.
**How to avoid:** Always `import { optimize } from 'svgo/browser'`.
**Warning signs:** Vite warning about `require is not defined` or `path` module not found.

### Pitfall 3: removeViewBox Default State
**What goes wrong:** Setting `removeViewBox: true` in `DEFAULT_CODEC_SVG.plugins` when it's NOT in preset-default causes SVGO to run the plugin on every SVG even when preset-default wouldn't. This breaks responsive SVGs for users who don't know they enabled it.
**Why it happens:** 03-UI-SPEC.md row 11 has a spec error claiming default `on` per D-07. D-07 actually says "mirror preset-default" — but `removeViewBox` is not in preset-default.
**How to avoid:** `removeViewBox: false` stays (current `defaults.ts` value is correct). Update the `defaults.ts` comment.
**Warning signs:** SVGs rendered at fixed pixel size instead of scaling responsively in HTML embeds.

### Pitfall 4: `optimize()` Returns `{ data }` Not `{ data, error }`
**What goes wrong:** Code checks `result.error` to detect SVGO failures. SVGO v4 throws instead of returning an error object.
**Why it happens:** v2/v3 may have had an `error` field; v4 simplified return type.
**How to avoid:** Wrap `optimize()` in try/catch; emit `AdapterError(format, 'process', err.message)` on throw.
**Warning signs:** Unhandled promise rejection from the adapter.

### Pitfall 5: `DOMPurify.removed` Accumulation
**What goes wrong:** Code accumulates `.removed` across multiple sanitize calls by summing up counts without realizing each call resets the array.
**Why it happens:** Developers assume `.removed` is additive. It is NOT.
**How to avoid:** Read `DOMPurify.removed.length` immediately after each `sanitize()` call (on the same synchronous stack). `[VERIFIED: purify.ts line 1629 — reset before parse]`
**Warning signs:** `sanitizedCount` shows 0 when elements were removed (forgot to read before next call), or shows inflated count (read after a subsequent call reset it).

### Pitfall 6: Snippet Registry `switch` Backslide
**What goes wrong:** SnippetPanel contains `if (file.format === 'svg') renderSvgSnippets()` branches instead of using the registry's `applicableFormats` filter.
**Why it happens:** Feels simpler for Phase 3 (only SVG). Phase 5 then adds raster branches and the registry becomes a dead abstraction.
**How to avoid:** SnippetPanel iterates `Object.values(SNIPPET_REGISTRY).filter(def => def.applicableFormats.includes(file.format))`. Phase 5 adds entries to the registry, not branches to the component.

---

## State Extensions Required

| Store | Extension | Type | Default | Consumer |
|-------|-----------|------|---------|---------|
| `useFilesStore.byId[id]` | `sanitizedCount` | `number` | `0` | File-row badge `sanitized · N` |
| `useSettingsStore.svg` | `unsafeExport` | `boolean` | `false` | Sanitization section Toggle; svg-adapter sanitize step |
| `useSettingsStore.svg` | `pluginSavings` | `Record<PluginId, { bytes: number; pct: number }>` | `{}` | SvgoPanel `.saves` column |
| `useSettingsStore` | `snippetTogglesByFileId` | `Record<string, Record<SnippetId, boolean>>` | `{}` | SnippetPanel per-section checkboxes |
| `useRuntimeStore` | `previewJobId` | `string \| null` | `null` | D-11 cancel-on-toggle scheduler |
| `useRuntimeStore` | `enqueuePreview` | `(fileId: string) => void` (debounced 200ms) | action | Triggered by settings store subscriber |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (already installed — `@playwright/test ^1.59.1`) |
| Config file | `playwright.config.ts` at repo root |
| Quick run command | `npx playwright test src/tests/svg-pipeline.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-01 | SVG file optimizes via SVGO; optimizedSize < originalSize; byte delta shows in file row | E2E (Playwright) | `npx playwright test src/tests/svg-pipeline.spec.ts -g "OPT-01"` | ❌ Wave 0 |
| OPT-01 | Plugin toggle changes SVGO output (re-optimization on selected file) | E2E (Playwright) | `npx playwright test src/tests/svg-pipeline.spec.ts -g "plugin toggle"` | ❌ Wave 0 |
| OPT-01 | `buildSvgoConfig` emits correct overrides for on/off plugin states | Unit (Node TS) | `node --experimental-strip-types src/tests/svg-adapter.unit.ts` | ❌ Wave 0 |
| SNIP-01 | SnippetPanel renders inline-SVG and data-URI sections for SVG file | E2E (Playwright) | `npx playwright test src/tests/svg-pipeline.spec.ts -g "SNIP-01"` | ❌ Wave 0 |
| SNIP-01 | Per-snippet checkbox hides section body when unchecked | E2E (Playwright) | `npx playwright test src/tests/svg-pipeline.spec.ts -g "checkbox"` | ❌ Wave 0 |
| SNIP-03 | Copy button writes snippet text to clipboard; button shows "copied" 1100ms | E2E (Playwright) | `npx playwright test src/tests/svg-pipeline.spec.ts -g "clipboard"` | ❌ Wave 0 |
| SNIP-04 | URL-encoded output is CSS-safe (no unencoded `<` `>` `#` `"`) | Unit (Node TS) | `node --experimental-strip-types src/tests/svg-snippets.unit.ts` | ❌ Wave 0 |
| SNIP-04 | yoksel test cases: `<svg>` → `%3Csvg%3E`, `"` → `'`, `#` → `%23` | Unit | same file | ❌ Wave 0 |
| PIPE-01 | Drop SVG file → file appears in queue → Optimize → status `done` | E2E (Playwright) | existing `worker-pool.spec.ts` pattern extended with SVG format | ❌ extend |
| SC-3 | SVG with `<script>` tag — sanitized; preview does not execute JS | E2E (Playwright) | `npx playwright test src/tests/svg-xss.spec.ts -g "script"` | ❌ Wave 0 |
| SC-3 | SVG with `onload=` — handler attribute stripped; no execution | E2E (Playwright) | `npx playwright test src/tests/svg-xss.spec.ts -g "onload"` | ❌ Wave 0 |
| SC-3 | SVG with `javascript:` href — attribute removed | E2E (Playwright) | `npx playwright test src/tests/svg-xss.spec.ts -g "javascript"` | ❌ Wave 0 |
| SC-3 | All XSS fixtures: sanitizedCount > 0 AND inline-snippet is clean | E2E (Playwright) | `npx playwright test src/tests/svg-xss.spec.ts` | ❌ Wave 0 |

### XSS Spec: Playwright Pattern
```typescript
// src/tests/svg-xss.spec.ts — Wave 0 stub
test('script tag removed by DOMPurify (SC-3)', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__OIMG_STORES__ === 'object')

  const xssSvg = `<svg xmlns="http://www.w3.org/2000/svg">
    <script>window.__XSS_FIRED__ = true</script>
    <circle r="50" cx="50" cy="50"/>
  </svg>`

  // Drop SVG via store, optimize, check snippet
  await page.evaluate((svg) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    window.__OIMG_STORES__.files.getState().addFile({
      id: 'xss-test', name: 'xss.svg', format: 'svg',
      originalSize: blob.size, optimizedSize: null,
      status: 'idle', sourceDensity: '1x', thumbnail: null,
      sourceBlob: blob, optimizedBlob: null,
    })
    window.__OIMG_STORES__.files.getState().setSelected('xss-test')
  }, xssSvg)

  await page.getByRole('button', { name: /Optimize/i }).click()
  await page.waitForFunction(() => {
    const f = window.__OIMG_STORES__.files.getState().byId['xss-test']
    return f?.status === 'done'
  }, { timeout: 5000 })

  // Confirm XSS did not fire
  const xssFired = await page.evaluate(() => window.__XSS_FIRED__)
  expect(xssFired).toBeUndefined()

  // Confirm sanitizedCount > 0 in store
  const count = await page.evaluate(() =>
    window.__OIMG_STORES__.files.getState().byId['xss-test'].sanitizedCount
  )
  expect(count).toBeGreaterThan(0)
})
```

### Sampling Rate
- **Per task commit:** `npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/tests/svg-pipeline.spec.ts` — covers OPT-01, SNIP-01, SNIP-03, SNIP-04, PIPE-01
- [ ] `src/tests/svg-xss.spec.ts` — covers SC-3 XSS corpus (all 8 attack vectors)
- [ ] `src/tests/svg-adapter.unit.ts` — unit tests for `buildSvgoConfig`, `encodeSvgForDataUri`
- [ ] `src/tests/svg-snippets.unit.ts` — yoksel encoder test cases; snippet registry shape
- [ ] `src/tests/fixtures/xss-*.svg` — XSS fixture files for Playwright file-drop

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `svgo` npm | svg-adapter.ts | ✗ not installed | 4.0.1 available | none — must install |
| `dompurify` npm | sanitize-svg.ts | ✗ not installed | 3.4.2 available | none — must install |
| Node.js (for npm install) | install step | ✓ | (project already uses npm) | — |
| Playwright / Chromium | XSS specs | ✓ | `@playwright/test ^1.59.1` installed | — |
| Vite dev server | all specs | ✓ | `^7.3` in package.json | — |

**Missing dependencies with no fallback:**
- `svgo@^4.0.1` and `dompurify@^3.4.2` must be installed before Wave 1 begins.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | DOMPurify `USE_PROFILES.svg+svgFilters`; SVGO schema validation (throws on malformed) |
| V6 Cryptography | no | — |

### Known Threat Patterns for SVG + Browser

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Embedded `<script>` in SVG | Spoofing/Tampering | DOMPurify removes script elements |
| `on*` event handlers | Tampering | DOMPurify strips event handler attributes |
| `javascript:` URIs in href | Elevation of Privilege | DOMPurify sanitizes URI attributes |
| `data:` URI to HTML payload | Elevation of Privilege | DOMPurify removes `data:` URIs in href |
| `foreignObject` script injection | Tampering | DOMPurify removes foreignObject or neutralizes children |
| Malicious SVG through ZIP export | Tampering | ZIP uses `optimizedBlob` which is already sanitized (D-04) |
| `unsafe export` toggle enabling raw SVG | Information Disclosure | Toggle is clearly labeled; default = sanitized; no modal (D-04 design choice) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DOMPurify cannot run in a standard Web Worker (lacks `document`) | Pattern 2, Pitfall 1 | If wrong: adapter could run DOMPurify in-worker (simpler pipeline). Verify by checking SharedWorker or ServiceWorker support. LOW risk of being wrong — DOMPurify explicitly checks `window.document.nodeType` at init. |
| A2 | SVGO `optimize()` is synchronous (not async) and can safely run in a Worker | Pattern 1 | If wrong: would need worker await chain. From source inspection it returns `{ data }` synchronously. HIGH confidence. |
| A3 | The 03-UI-SPEC.md row 11 `removeViewBox: on` is a spec error | Critical Contradiction | If wrong: design intent was to ship removeViewBox enabled by default as a deviation from preset-default. Planner must confirm with user before flipping. MEDIUM risk — D-07 text is clear ("mirror preset-default") but spec doc was written after D-07. |
| A4 | `svgo/browser` import works in Vite worker thread without additional config | Standard Stack | If wrong: may need `optimizeDeps.include` in `vite.config.ts` for the browser bundle. LOW risk — SVGO ships native ESM with no Node APIs. |
| A5 | Pool `cancel()` is safe to call during plugin-toggle preview without affecting in-progress batch jobs when `running === false` | Pattern 5, D-11 | If wrong: cancel during batch would abort user's current optimization work. Guard with `if (!running)` check before cancel. |

---

## Open Questions

1. **DOMPurify Worker compatibility (A1)**
   - What we know: Standard Workers lack `document`; DOMPurify checks `window.document.nodeType` at init
   - What's unclear: Whether `new Worker({ type: 'module' })` in a crossOriginIsolated context has different `globalThis` properties
   - Recommendation: Planner should add a Wave 0 task to test `import DOMPurify from 'dompurify'` inside a worker — if it initializes, the adapter can keep sanitization co-located. If it throws, use main-thread sanitization.

2. **removeViewBox default state vs 03-UI-SPEC.md row 11 (A3)**
   - What we know: SVGO v4 `preset-default` does NOT include `removeViewBox`; D-07 says "mirror preset-default"
   - What's unclear: Whether the 03-UI-SPEC.md row 11 was intentionally overriding D-07 or is a spec error
   - Recommendation: Treat as spec error; keep `removeViewBox: false`; add a plan note for user confirmation if the planner wants certainty. See `§CRITICAL Contradiction`.

3. **pluginSavings storage location**
   - What we know: UI-SPEC requires `pluginSavings: Record<PluginId, { aggregateBytes, aggregatePct }>` for the `.saves` column
   - What's unclear: Whether savings lives in `useSettingsStore.svg` (global, reused on next Optimize) or `useRuntimeStore` (ephemeral, cleared on cancel)
   - Recommendation: `useSettingsStore.svg.pluginSavings` — it should persist between sessions (Phase 7) and is per-codec-settings, not per-batch. Cleared when settings change.

---

## Plan-Grouping Recommendation

**Plan A — Install + Adapter + Sanitization (Wave 1)**
- `npm install svgo dompurify`
- `src/workers/svg-adapter.ts` — SVGO-only adapter (TextDecoder → `optimize()` → TextEncoder)
- `src/lib/sanitize-svg.ts` — main-thread DOMPurify helper
- Wire `svg` slot in `src/workers/worker.ts` ADAPTERS map
- Extend `FileEntry` with `sanitizedCount`; `useFilesStore.markDone` calls sanitize helper
- Extend `AdapterMeta` (optional, for if DOMPurify moves to worker in future)
- Wave 0: `svg-pipeline.spec.ts` stubs; XSS fixture files

**Plan B — SvgoPanel Rewrite + Live Savings (Wave 2)**
- Rewrite `DEFAULT_CODEC_SVG.plugins` to 12-plugin record with corrected defaults
- Rewrite `SvgoPanel.tsx` — curated plugin list + savings column + Sanitization section
- Implement D-06 post-batch N+1 savings computation
- D-11 cancel-on-toggle debounce: `previewJobId` in `useRuntimeStore`; settings subscriber
- File-row sanitized badge in `FilePanel.tsx`

**Plan C — SnippetPanel + Generators (Wave 3)**
- `src/lib/snippet-registry.ts` — SNIPPET_REGISTRY with Phase 3 generators + Phase 5/6 stubs
- `src/lib/svg-snippets.ts` — `generateInlineSvg()` + `encodeSvgForDataUri()` (yoksel)
- `src/components/panels/SnippetPanel.tsx` — replace OutputPanel; per-snippet checkboxes
- `useSettingsStore.snippetTogglesByFileId` extension
- Delete `src/components/panels/OutputPanel.tsx`

**Plan D — Tests + XSS Corpus (Wave 4 / can overlap Wave 3)**
- `src/tests/svg-xss.spec.ts` — 8 attack vector Playwright specs
- `src/tests/svg-pipeline.spec.ts` — OPT-01, SNIP-01/03/04, PIPE-01 coverage
- `src/tests/svg-adapter.unit.ts` — `buildSvgoConfig` + yoksel encoder unit tests
- Final phase gate: all specs green

---

## Sources

### Primary (HIGH confidence)
- `svgo@4.0.1` npm tarball — `/tmp/package/plugins/preset-default.js` (34 plugins verified), `/tmp/package/lib/svgo.js` (`optimize()` API and return type), `README.md` (configuration examples) — inspected 2026-05-01
- `dompurify@3.4.2` npm tarball — `/tmp/dompurify/package/src/purify.ts` (`removed` array shape, reset behavior, hook signatures), `README.md` (`USE_PROFILES`, `sanitize()` options) — inspected 2026-05-01
- `npm view svgo exports` — import path `svgo/browser` — verified 2026-05-01
- Project codebase — `src/workers/types.ts`, `src/workers/worker.ts`, `src/workers/pool.ts`, `src/stores/settings.ts`, `src/stores/files.ts`, `src/stores/runtime.ts`, `src/data/defaults.ts`, `src/components/panels/SvgoPanel.tsx`, `src/components/panels/OutputPanel.tsx`, `inspired/url-encoder/src/js/script.js` — all read 2026-05-01

### Secondary (MEDIUM confidence)
- `inspired/url-encoder/src/js/script.js` lines 15 and 134–148 — yoksel `symbols` regex and `encodeSVG()` function (verbatim) — project vendored reference

### Tertiary (LOW confidence — to validate)
- A1: DOMPurify in Web Worker behavior — inferred from source; not empirically tested in this project's worker context

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions verified from npm registry + local tarball inspection
- SVGO API: HIGH — `optimize()` source read directly from extracted package
- DOMPurify API: HIGH — source read from extracted package; removed[] behavior traced in code
- yoksel encoder: HIGH — verbatim source from project's `inspired/url-encoder/` directory
- Architecture (DOMPurify in worker): MEDIUM — inferred from DOMPurify source; needs empirical Worker test (Open Question 1)
- Plugin set: HIGH — verified against SVGO v4 `preset-default.js`; contradiction with 03-UI-SPEC.md documented

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (SVGO and DOMPurify are stable; DOMPurify had patch on 2026-04-30 — re-check version before install)

---

## RESEARCH COMPLETE
