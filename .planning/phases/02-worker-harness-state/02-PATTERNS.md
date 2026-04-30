# Phase 2: Worker Harness + State - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 19 (12 CREATE, 5 EDIT, 1 DELETE, multiple KEEP_REFERENCE)
**Analogs found:** 6 / 12 CREATE files (Phase 2 establishes new patterns; many files have no codebase analog)

## File Classification

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/workers/worker.ts` | CREATE | worker (entry, Comlink.expose) | request-response (RPC) | none — NEW pattern | no analog |
| `src/workers/pool.ts` | CREATE | service (singleton orchestrator class) | event-driven (FIFO queue + promise resolution) | `src/hooks/useTheme.ts` (singleton lifecycle) | partial (lifecycle only) |
| `src/workers/stub-adapter.ts` | CREATE | adapter (bytes-in/bytes-out fn) | transform | none — NEW contract from D-04 | no analog |
| `src/stores/index.ts` | CREATE | barrel | n/a | n/a | trivial |
| `src/stores/files.ts` | CREATE | store slice (canonical FileEntry) | CRUD | `src/hooks/useTheme.ts` (small focused state w/ persistence intent) | role-match (different shape) |
| `src/stores/settings.ts` | CREATE | store slice (codec configs) | CRUD | `src/data/defaults.ts` (initial state seed) + `useTheme.ts` | role-match |
| `src/stores/runtime.ts` | CREATE | store slice (queue, urlCache, pool stats) | event-driven | `src/hooks/useTheme.ts` (effect-driven state) | partial |
| `src/lib/object-url.ts` | CREATE | utility (lazy create/revoke helpers) | transform | `src/lib/format.ts` (small pure utils) | role-match |
| `src/lib/live-region.ts` | CREATE | utility (ARIA announcement bus) | event-driven | `src/lib/format.ts` (utility module shape) | partial |
| `src/tests/worker-pool.spec.ts` | CREATE | test (Playwright e2e) | request-response | `src/tests/shell.spec.ts` | exact |
| `src/tests/object-url.spec.ts` | CREATE | test (Playwright e2e) | event-driven | `src/tests/shell.spec.ts` | exact |
| `src/tests/aria-live.spec.ts` | CREATE | test (Playwright e2e) | event-driven | `src/tests/shell.spec.ts` | exact |
| `src/tests/fixtures/synthetic.ts` | CREATE | fixture (deterministic Blob factory) | transform | `src/data/mock.ts` (static fixture file pattern) | partial |
| `src/tests/fixtures/instrument-blob-urls.ts` | CREATE | fixture (monkey-patch counter) | event-driven | none — NEW pattern | no analog |
| `src/components/shell/Toolbar.tsx` | EDIT | component | request-response | self (lines 77-79, 132-149 — known edit points) | exact (self-edit) |
| `src/App.tsx` | EDIT | component (composition root) | n/a | self (lines 45-73 — useState hooks to migrate) | exact (self-edit) |
| `src/components/shell/CommandPalette.tsx` | EDIT | component (consumer of CmdGroup) | n/a | self via App.tsx cmdGroups (App.tsx:166-197) | exact (self-edit, App-side) |
| `src/main.tsx` | EDIT (defer) | bootstrap | n/a | self (lines 8-14 — existing isolation assertion) | exact (self-edit) |
| `src/data/mock.ts` | DELETE | fixture | n/a | n/a (deleted in last plan) | n/a |
| `src/types/index.ts` | KEEP_REFERENCE | types | n/a | reuse FileEntry, FileStatus, FormatId verbatim | full reuse |
| `src/data/defaults.ts` | KEEP_REFERENCE | seed data | n/a | imported by `useSettingsStore` initial state | full reuse |
| `package.json` | EDIT | config | n/a | n/a | trivial (`npm install comlink zustand sonner`) |

## Pattern Assignments

### `src/workers/worker.ts` (worker entry, request-response)

**Analog:** none. NEW pattern; no Web Worker exists in the codebase yet.
**Authoritative spec:** RESEARCH.md §Pattern 1 (lines 191-217), CONTEXT.md D-04 (adapter contract), D-05 (adapter owns decoding).

**Required shape (from RESEARCH.md §Pattern 1, verbatim contract):**
```typescript
import * as Comlink from 'comlink'
export interface AdapterMeta { unchanged?: boolean; codecVersion?: string }
export type AdapterFormat = 'stub' | 'svg' | 'png' | 'jpeg' | 'webp' | 'avif'

async function runJob(input: ArrayBuffer, settings: unknown, format: AdapterFormat) {
  // PERF-02: lazy-import adapter module on first use INSIDE the worker.
  // Phase 2 only resolves 'stub' — Phase 3+ extends the static map.
  const adapter = await ADAPTERS[format]()
  const { output, meta } = await adapter.run(input, settings)
  return Comlink.transfer({ output, meta }, [output])
}
Comlink.expose({ runJob })
```

**Anti-pattern (RESEARCH.md §Pitfall 1, lines 540-547):** template-literal `import(\`./${format}-adapter.ts\`)` breaks Vite worker bundling. Use a static map: `const ADAPTERS = { stub: () => import('./stub-adapter.ts') }`.

---

### `src/workers/pool.ts` (singleton orchestrator class)

**Analog (lifecycle only):** `src/hooks/useTheme.ts` — the project's only existing example of a focused module that owns long-lived state. The shape is hook, not class, but the discipline (single-purpose, minimal API) transfers.

**Why class beats hook (locked by RESEARCH.md §Standard Stack alternatives, line 108):**
> Pool wins as a class: lifecycle is app-singleton — wrapping in a hook would force a Provider or Context indirection. Methods (`enqueue`, `cancel`, `terminate`) work fine called from outside React (e.g. from `useRuntimeStore` actions).

**Authoritative spec:** RESEARCH.md §Pattern 1 (lines 219-261), §Pattern 2 (lines 270-318), §Pattern 3 (lines 326-343).

**Worker bootstrap idiom (CITED Vite docs in RESEARCH.md line 264):**
```typescript
// DO NOT use ?worker suffix — limits dynamic imports inside worker (Pitfall 1).
const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
this.proxies[slot] = Comlink.wrap<WorkerProxy>(w)
```

**Pool sizing defensive default (Pitfall 6, line 583):**
```typescript
this.size = Math.min(navigator.hardwareConcurrency || 2, 4)
```

**Cancel correctness (RESEARCH.md §Pattern 3, lines 326-343 + Pitfall 4, line 569):**
- `worker.terminate()` discards postMessage channel — Comlink Promise pends forever.
- Wrap each `runOnSlot` proxy call in `Promise.race([proxyCall, abortPromise])` where `abortPromise` rejects on cancel.
- Explicitly clear `useRuntimeStore` state on cancel; do NOT rely on per-job rejection paths.

**Detached-buffer hazard (Pitfall 2, lines 549-555):** Never read `input.byteLength` after `Comlink.transfer(input, [input])`. D-12 forbids storing it anyway.

---

### `src/workers/stub-adapter.ts` (adapter, transform)

**Analog:** none. The contract is the FIRST instance of D-04's signature.

**Authoritative spec (RESEARCH.md §Code Examples, lines 588-605, verbatim):**
```typescript
// Phase 2 acceptance gate. Phase 3+ replaces with svg/png/jpeg/webp/avif adapters.
export interface AdapterMeta { unchanged?: boolean }

export async function run(
  input: ArrayBuffer,
  _settings: unknown
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  // CRITICAL: copy bytes via slice(0). Do NOT return the same ArrayBuffer —
  // Comlink.transfer on the way back would detach the input we just received.
  const output = input.slice(0)
  return { output, meta: { unchanged: true } }
}
```

**File location decision (Claude's discretion, CONTEXT.md line 50):** RESEARCH.md §Architecture (line 178) recommends `src/workers/stub-adapter.ts` (in-worker). Adopt this.

---

### `src/stores/runtime.ts` (store slice, event-driven)

**Analog:** none — first zustand store in the codebase. `src/hooks/useTheme.ts` is the closest *philosophical* match (focused single-purpose state).

**Pattern reference from `src/hooks/useTheme.ts:1-29` (entire file):**
```typescript
import { useState, useEffect } from 'react'
import type { ThemeMode } from '@/types'

const STORAGE_KEY = 'oimg-theme'

function readStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'dark'
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme())
  useEffect(() => { /* … */ }, [theme])
  // …
}
```

**What transfers:**
- Module-scoped constants (e.g. `STORAGE_KEY`) — runtime store has no persistence in Phase 2 (D-08 in-memory-only), but Phase 7 will add persistence following this discipline.
- Single-import `@/types` for typed surface.
- Defensive read paths (the `typeof localStorage === 'undefined'` guard mirrors `navigator.hardwareConcurrency || 2` in the pool).

**What does NOT transfer:** the `useState`/`useEffect` shape. Replace with zustand `create<T>()(subscribeWithSelector(...))` per RESEARCH.md §Pattern 4 (lines 349-432).

**Authoritative spec — store fields (RESEARCH.md §Pattern 4 + CONTEXT.md D-08, D-10, D-11):**
```typescript
interface RuntimeState {
  running: boolean
  queue: string[]              // jobIds in FIFO order (D-03, D-08)
  inFlight: Set<string>        // currently dispatched
  doneCount: number
  totalJobs: number
  errorCount: number
  urlCache: Map<string, string> // FileEntry.id → object URL (D-10, A3 in RESEARCH.md line 660)
  // actions: startBatch, markStarted, markDone, markError, cancelBatch,
  // getOrCreateObjectURL, revokeObjectURL
}
```

**Selector convention (D-09):** `useRuntimeStore(s => s.totalJobs - s.doneCount - s.errorCount)` — narrow, one slice per `useStore` call.

---

### `src/stores/files.ts` (store slice, CRUD)

**Analog:** `src/data/mock.ts:23-36` — current canonical fixture; pattern of "id-keyed records ordered by an array" maps onto the store's `byId` + `order` shape.

**Excerpt from `src/data/mock.ts:10-36`:**
```typescript
export interface MockFile { id: string; name: string; type: FileType; orig: number; opt: number; status: FileStatusMock; /* … */ }
export const MOCK_FILES: MockFile[] = [
  { id: 'f1', name: 'hero-banner@2x.png', type: 'png', orig: 1842300, opt: 412800, status: 'done', /* … */ },
  // 11 more rows
]
```

**What transfers:** field shape (id, name, format, originalSize, optimizedSize, status). Note: `MockFile` has fields like `orig`/`opt` while `FileEntry` (`src/types/index.ts:19-28`) has `originalSize`/`optimizedSize` — use the type from `src/types/index.ts` verbatim, do NOT introduce new field names.

**FileEntry type (already defined, REUSE — `src/types/index.ts:19-28`):**
```typescript
export interface FileEntry {
  id: string
  name: string
  format: FormatId
  originalSize: number
  optimizedSize: number | null
  status: FileStatus
  sourceDensity: SourceDensity
  thumbnail: string | null // Object URL — must be revoked when no longer needed (T-03-02)
}
```
The existing `thumbnail` field accommodates D-10's lazy URL pattern with no schema change.

**Object URL coordination (D-10 + RESEARCH.md Pitfall 3):** Files store actions MUST coordinate with runtime store:
```typescript
// In useFilesStore.removeFile
removeFile: (fileId) => {
  useRuntimeStore.getState().revokeObjectURL(fileId)  // BEFORE byId removal
  set(s => ({ byId: omit(s.byId, fileId), order: s.order.filter(id => id !== fileId) }))
}
```

---

### `src/stores/settings.ts` (store slice, CRUD)

**Analog:** `src/data/defaults.ts` — full file is the initial-state contract.

**Excerpt from `src/data/defaults.ts:1-58` (initial seed pattern):**
```typescript
import type {
  FormatDefinition, CodecSettingsSvg, CodecSettingsPng, CodecSettingsJpeg,
  CodecSettingsWebp, CodecSettingsAvif, GlobalSettings,
} from '@/types'

export const DEFAULT_FORMATS: FormatDefinition[] = [ /* 5 formats */ ]
export const DEFAULT_CODEC_SVG: CodecSettingsSvg = { preset: 'default', plugins: { /* … */ } }
export const DEFAULT_CODEC_PNG: CodecSettingsPng = { level: 3 }
export const DEFAULT_CODEC_JPEG: CodecSettingsJpeg = { quality: 80, progressive: true }
export const DEFAULT_CODEC_WEBP: CodecSettingsWebp = { quality: 80, lossless: false, method: 4 }
export const DEFAULT_CODEC_AVIF: CodecSettingsAvif = { quality: 60, lossless: false }
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = { stripMetadata: true, preserveIccProfile: false }
```

**Pattern:** Settings store imports the DEFAULT_* constants verbatim into its initial-state factory. Do not duplicate values — single source of truth lives in `defaults.ts`.

```typescript
// src/stores/settings.ts
import { DEFAULT_CODEC_SVG, DEFAULT_CODEC_PNG, /* … */ DEFAULT_GLOBAL_SETTINGS } from '@/data/defaults'

export const useSettingsStore = create<SettingsState>()(subscribeWithSelector((set) => ({
  svg: DEFAULT_CODEC_SVG,
  png: DEFAULT_CODEC_PNG,
  jpeg: DEFAULT_CODEC_JPEG,
  webp: DEFAULT_CODEC_WEBP,
  avif: DEFAULT_CODEC_AVIF,
  global: DEFAULT_GLOBAL_SETTINGS,
  // setters per format
})))
```

---

### `src/lib/object-url.ts` (utility, transform)

**Analog:** `src/lib/format.ts:1-14` — utility module shape (small pure functions, focused responsibility, ESM exports).

**Excerpt from `src/lib/format.ts:1-14` (module shape to mimic):**
```typescript
// Byte / percentage formatters — ported from example-ui/data.jsx.
export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}
```

**Key conventions transferring:**
- Header comment line citing source/contract.
- Pure functions, no top-level side effects.
- Defensive null/undefined handling (`b == null`).

**Authoritative spec (RESEARCH.md §Pattern 5, lines 435-470):** Helper functions wrap `useRuntimeStore.getState().getOrCreateObjectURL`/`revokeObjectURL` for use outside React. The store is the source of truth; this module is sugar.

---

### `src/lib/live-region.ts` (utility, event-driven)

**Analog:** `src/lib/format.ts` (module shape only — same comment header + pure-function discipline).

**Authoritative spec (RESEARCH.md §Pattern 6, lines 472-499 + UI-SPEC §5):**
```typescript
// src/lib/live-region.ts
let liveRegionEl: HTMLDivElement | null = null

export function setLiveRegion(el: HTMLDivElement | null) { liveRegionEl = el }

export function announce(message: string) {
  if (!liveRegionEl) return
  liveRegionEl.textContent = ''
  requestAnimationFrame(() => {
    if (liveRegionEl) liveRegionEl.textContent = message
  })
}
```

**Cadence (UI-SPEC §5, lines 178-185):** announce ONLY at batch boundaries — start, every `Math.max(1, Math.floor(total/4))`th completion, final, error, cancel. Per-file announcements cause screen-reader flooding (Pitfall 5, RESEARCH.md line 573).

---

### `src/tests/worker-pool.spec.ts` (test, request-response)

**Analog:** `src/tests/shell.spec.ts` — exact match (Playwright e2e against `http://localhost:5173`).

**Imports + describe pattern from `src/tests/shell.spec.ts:1-9`:**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Shell ARIA landmarks (UI-08)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })
```

**Console-error guard pattern from `src/tests/shell.spec.ts:11-20` (REUSE for worker tests — must filter the existing crossOriginIsolated warning):**
```typescript
test('page loads without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/')
  const hardErrors = errors.filter((e) => !e.includes('crossOriginIsolated'))
  expect(hardErrors).toHaveLength(0)
})
```

**Keyboard-driven test pattern from `src/tests/shell.spec.ts:66-81` (REUSE for `Cmd+Enter` Optimize trigger and `Cmd+.` Cancel):**
```typescript
test('Cmd+K opens command palette and Escape closes it', async ({ page }) => {
  await expect(page.locator('.cmdk-back')).toHaveCount(0)
  await page.keyboard.press('Meta+k')
  await expect(page.locator('.cmdk-back')).toBeVisible()
  // …
})
```

**Store inspection from page context (NEW — Phase 2 pattern):** Tests read store state via `page.evaluate()`. Expose stores on `window.__OIMG_STORES__` only in dev/test for inspection. Validation requirements VR-01..VR-06 in RESEARCH.md lines 727-732 enumerate the assertions.

---

### `src/tests/object-url.spec.ts` and `src/tests/aria-live.spec.ts`

**Analog:** `src/tests/shell.spec.ts` (exact match).

**Same imports, `test.describe`/`test.beforeEach`/`page.goto('/')` shape as worker-pool.spec.ts above.**

**aria-live unique assertion (UI-SPEC §5 + VR-05, RESEARCH.md line 731):**
```typescript
const liveRegion = page.locator('[role=status][aria-live=polite]')
// Assert text content updates 5 times for 12-file batch (start + 3 quartiles + final)
```

**object-url unique assertion (VR-04, RESEARCH.md line 730):** monkey-patch `URL.createObjectURL`/`URL.revokeObjectURL` on the page via `page.addInitScript` (loaded from `src/tests/fixtures/instrument-blob-urls.ts`). Assert `created === revoked + still-rendered` after batch.

---

### `src/tests/fixtures/synthetic.ts` (fixture, transform)

**Analog (partial):** `src/data/mock.ts` — the project's existing static fixture file. Mock.ts gives shape (header comment, exports, types) but synthetic.ts is functions, not constants.

**Excerpt from `src/data/mock.ts:1-6` (header convention to mimic):**
```typescript
// Visual-shell fixtures for Phase 1.
// Static mock data … This file will be deleted in Phase 2 …
```

**Authoritative spec (RESEARCH.md §Code Examples, lines 617-635):**
```typescript
// src/tests/fixtures/synthetic.ts
// Generate deterministic large Blobs without allocating 50×50MB upfront.

export function makeSyntheticBlob(sizeBytes: number, seed: number): Blob {
  const arr = new Uint8Array(sizeBytes)
  for (let i = 0; i < arr.length; i += 1024) arr[i] = (seed + i) & 0xff
  return new Blob([arr], { type: 'application/octet-stream' })
}

export function makeSyntheticBatch(count: number, sizeBytes: number): Blob[] {
  return Array.from({ length: count }, (_, i) => makeSyntheticBlob(sizeBytes, i))
}
```

**Usage:** Tests call via `page.evaluate(() => { window.__OIMG_makeSyntheticBatch(50, 1024) })` after exposing on window in test bootstrap.

---

### `src/tests/fixtures/instrument-blob-urls.ts` (fixture, event-driven)

**Analog:** none — first monkey-patch helper in the codebase.

**Required behavior (RESEARCH.md VR-04, line 730 + Pitfall 3):**
```typescript
// Loaded via page.addInitScript before app boots.
// Wraps URL.createObjectURL and URL.revokeObjectURL with counters readable from
// the test via page.evaluate(() => window.__OIMG_URL_COUNTS__).
```

The exact shape is planner's choice; document the contract in PATTERNS.md so the planner doesn't have to re-derive it.

---

### `src/components/shell/Toolbar.tsx` (EDIT, request-response)

**Self-edit reference points:**

**1. Optimize button (lines 77-79, current shape):**
```typescript
<button className="tbtn" onClick={onStartOptimize} disabled={running}>
  {running ? <><Icons.Pause size={13} /> Optimizing…</> : <><Icons.Play size={13} /> Optimize all</>}
</button>
```
**Phase 2 edit:** `running` and `onStartOptimize` props become subscriptions to `useRuntimeStore` (D-09 narrow selectors). Toolbar moves from prop-drilled to store-subscribed at this point. Disabled state extends to `disabled = running || queueIsEmpty`.

**2. Workers pill insertion (UI-SPEC §1, lines 104-115):** Insert a NEW always-visible pill BETWEEN the segmented `view` control (line 113) and the `tdiv` separator (line 114). Use existing `.pill` / `.pill.acc` classes. Numbers in mono with `tabular-nums`.

```typescript
// Conceptual insertion at line 114-ish
<div className="pill" aria-label={pillAriaLabel}>
  <span style={{ fontFamily: 'var(--mono)' }}>{pillCopy}</span>
</div>
```
States and ARIA labels enumerated in UI-SPEC §1 table (lines 109-114).

**3. Settings popover Workers section (line 140-142, current placeholder):**
```typescript
<div className="lbl">Workers</div>
<div className="pi"><span>Pool size</span><span className="kbd mono">5</span></div>
<div className="pi"><span>WASM threading</span><span className="kbd">on</span></div>
```
**Phase 2 edit:** Replace hardcoded `5` with live `useRuntimeStore(s => s.poolSize)` derived value. Threading badge stays static for Phase 2 (defer until Phase 5 SAB work).

---

### `src/App.tsx` (EDIT, composition root)

**~25 useState hooks to migrate (lines 45-73):**

```typescript
// Lines 45-73 verbatim — pair each with destination store:
const [selectedId, setSelectedId] = useState<string>('f1')           // → useFilesStore.selectedId
const [tab, setTab] = useState<Tab>('codec')                          // → leave in App.tsx (UI-only)
const [split, setSplit] = useState<number>(50)                        // → leave in App.tsx (UI-only)
const [view, setView] = useState<View>('Batch')                       // → leave in App.tsx (UI-only)
const [open, setOpen] = useState<string | null>(null)                 // → leave (popover open key)
const [toasts, setToasts] = useState<Toast[]>([])                     // → REMOVE (replace with sonner)
const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)              // → leave (UI-only)
const [rowMenu, setRowMenu] = useState<string | null>(null)           // → leave (UI-only)

// Codec settings — ALL → useSettingsStore
const [codec, setCodec] = useState<CodecLabel>('WebP')
const [q, setQ] = useState<number>(82)
const [method, setMethod] = useState<number>(4)
const [lossless, setLossless] = useState<boolean>(false)
const [resizeOn, setResizeOn] = useState<boolean>(true)
const [w, setW] = useState<string>('1600')
const [h, setH] = useState<string>('auto')
const [alg, setAlg] = useState<ResizeAlg>('lanczos3')
const [fit, setFit] = useState<FitMode>('contain')
const [stripMeta, setStripMeta] = useState<boolean>(true)
const [keepIcc, setKeepIcc] = useState<boolean>(false)
const [aggressive, setAggressive] = useState<boolean>(false)

const [running, setRunning] = useState<boolean>(false)                // → useRuntimeStore.running
const [filterQuery, setFilterQuery] = useState<string>('')            // → leave in App.tsx (UI-only)
const [sortBy, setSortBy] = useState<string>('queue order')           // → leave in App.tsx (UI-only)

const [plugins, setPlugins] = useState<SvgoPlugin[]>(SVGO_PLUGINS)    // → useSettingsStore.svg.plugins
```

**Migration discipline:** When `mock.ts` is deleted (last plan), all `MOCK_FILES`/`SVGO_PLUGINS`/`CODECS` imports break. Sequence — replace usages first, delete file last. RESEARCH.md Open Question 3 (lines 678-682) explicitly mandates "delete mock.ts in the LAST plan of Phase 2."

**Toast migration (line 77-81 + 561-568):** App.tsx today owns a `toasts` state + `pushToast` + a JSX render. Phase 2 replaces this with sonner's `<Toaster />` + `toast.success(...)` calls. The `pushToast` callback prop wired to Toolbar/CommandPalette becomes a thin wrapper around `toast(...)` for backward compat or is replaced wholesale.

**Existing pushToast call sites (use as wire-up reference for sonner toast.* calls):**
- App.tsx:148 `pushToast('Optimizing 12 files…', '5 workers')` — replace with batch-start (per UI-SPEC §7, no toast on batch start; live region only)
- App.tsx:151 `pushToast('Done · saved 8.4 MB', '76.4%')` — replace with `toast.success` per UI-SPEC §7 batch-complete copy
- App.tsx:156 `pushToast('Bundled oimg-export.zip', '2.6 MB')` — leave as-is for Phase 2 (export logic untouched)

---

### `src/components/shell/CommandPalette.tsx` (EDIT, App.tsx-side change)

**Self-edit reference (App.tsx lines 166-197 — `cmdGroups` builder):**
```typescript
const cmdGroups: CmdGroup[] = [
  { group: 'Actions', items: [
    { ic: <Icons.Upload size={13} />, label: 'Add files…', meta: 'A', do: () => pushToast('File picker opened') },
    { ic: <Icons.Play size={13} />, label: 'Optimize all', meta: 'O', do: startOptimize },         // ← REWIRE
    { ic: <Icons.Download size={13} />, label: 'Export ZIP', meta: 'E', do: exportZip },
    // …
  ]},
  // …
]
```

**Phase 2 edits to `cmdGroups` (UI-SPEC §3 + §Copywriting Contract):**
- `Optimize all` → meta becomes `Run worker pool · ⌘⏎`; `do` invokes `useRuntimeStore.getState().startBatch(...)` (see RESEARCH.md Pattern 4).
- ADD new entry `Cancel batch` (icon `Icons.X`, meta `Stops in-flight workers · ⌘.`, `do: useRuntimeStore.getState().cancelBatch`) — visible only when `running === true` (filter the array based on store state).

`CommandPalette.tsx` itself does NOT need edits — its `CmdGroup`/`CmdItem` API is sufficient. All edits are in App.tsx's `cmdGroups` builder.

---

### `src/main.tsx` (EDIT, defer per CONTEXT.md)

**Existing pattern to preserve (`src/main.tsx:8-14`):**
```typescript
if (!crossOriginIsolated) {
  console.error(
    '[oimg] crossOriginIsolated is false. ' +
    'COOP/COEP headers are missing or a cross-origin resource is blocking COEP. ' +
    'Codec workers will not function in Phase 2+.'
  )
}
```

**CONTEXT.md says defer hard-throw upgrade:** Phase 2 keeps the soft-warn behavior. Phase 5 (SAB threading for AVIF MT) will optionally upgrade to a hard throw. NO edits to main.tsx required for Phase 2 unless planner needs to register a `setLiveRegion` element ref or expose stores on `window.__OIMG_STORES__` for tests — both are App.tsx concerns, not main.tsx.

---

### `src/data/mock.ts` (DELETE — last plan of Phase 2)

**Sequencing constraint (RESEARCH.md Open Question 3, lines 678-682):**
> Delete in the LAST plan of Phase 2, after stores are seeded with real (or fixture-generated) FileEntry data and tests are updated to assert on store-driven counts.

**Test impact:** `src/tests/shell.spec.ts:88-93` asserts `await expect(options).toHaveCount(12)` — this count comes from `MOCK_FILES.length`. When mock.ts is deleted, the test must be updated to either (a) seed 12 synthetic FileEntry rows in a test fixture, or (b) assert `>=0` count and add a separate test that seeds + counts.

**Imports in App.tsx that break on delete (App.tsx lines 22-31):** `MOCK_FILES`, `SVGO_PLUGINS`, `CODECS`, `CodecLabel`, `ResizeAlg`, `FitMode`, `SvgoPlugin`, `MockFile`. Plan must replace each before delete.

---

## Shared Patterns

### Authentication / Authorization
**Not applicable.** Privacy-first, zero-server architecture (PROJECT.md). No auth surface anywhere in Phase 2.

### Error Handling
**Source:** RESEARCH.md Open Question 2 (lines 674-677) + CONTEXT.md Claude's discretion (line 51).
**Apply to:** `src/workers/pool.ts`, `src/workers/worker.ts`, `src/stores/runtime.ts`.
**Pattern:** Single `AdapterError` class for codec/adapter failures + standard `DOMException('AbortError')` for cancel. Do not pre-build a `CancelError`/`DecodeError`/`EncodeError` taxonomy in Phase 2 — Phase 5 subclasses when retry logic needs the discrimination.

```typescript
// In a shared types module (planner picks location — likely src/workers/types.ts):
export class AdapterError extends Error {
  constructor(public format: string, public phase: 'decode' | 'process' | 'encode', message: string) {
    super(`[${format}:${phase}] ${message}`)
    this.name = 'AdapterError'
  }
}
```

### Logging
**No logger framework.** Privacy-first (PRIV constraint) means no telemetry, no remote log shipping. Use `console.error` for fatal worker failures (matches `src/main.tsx:9` precedent). Use `console.warn` sparingly. NO `console.log` in committed code.

### Validation
**Worker payload validation:** Adapter contract (D-04) is the only validation surface. Stub adapter accepts unknown settings. Phase 5 adapters validate per-codec.

### Object URL discipline (CROSS-CUTTING, applies to all components rendering Blobs)
**Source:** `useRuntimeStore.urlCache` + `getOrCreateObjectURL` / `revokeObjectURL` actions.
**Apply to:** All current and future components that render `<img src=...>` from a FileEntry Blob.
**Pattern (RESEARCH.md §Pattern 5, lines 437-447):**
```typescript
const url = useRuntimeStore((s) => s.urlCache.get(file.id))
const getOrCreate = useRuntimeStore((s) => s.getOrCreateObjectURL)
const resolvedUrl = url ?? getOrCreate(file.id, file.sourceBlob)
return <img src={resolvedUrl} alt={file.name} />
```
**Hard rule (D-12):** never store ArrayBuffer in any zustand state. Derive on demand via `await blob.arrayBuffer()`.

### ARIA live region discipline (CROSS-CUTTING)
**Source:** `src/lib/live-region.ts` (NEW) + single App-root `<div role="status" aria-live="polite">`.
**Apply to:** Anywhere a batch-level event happens (start/quartile/done/error/cancel).
**Hard rule (UI-SPEC §5 + Pitfall 5):** NO per-file `aria-live` updates. Per-file rows toggle `aria-busy` only.

### Test setup pattern (CROSS-CUTTING for new specs)
**Source:** `src/tests/shell.spec.ts:1-9` and `:11-20` (entire console-guard test).
**Apply to:** `worker-pool.spec.ts`, `object-url.spec.ts`, `aria-live.spec.ts`.
**Reuse:** `import { test, expect } from '@playwright/test'` + `test.describe(...)` + `test.beforeEach(({ page }) => page.goto('/'))`. Always filter `crossOriginIsolated` from console-error assertions.

### Page-context store inspection (NEW for Phase 2)
**No existing pattern — establishes new convention.**
**Apply to:** Phase 2 worker tests + future phase tests.
**Pattern:** App.tsx attaches `window.__OIMG_STORES__ = { files, settings, runtime }` in dev/test mode only (`if (import.meta.env.DEV || import.meta.env.MODE === 'test')`). Tests inspect via `page.evaluate(() => window.__OIMG_STORES__.runtime.getState())`.
**Why:** Playwright runs against real Chromium; main-thread store state must be observable from the test runner without exposing in production.

## No Analog Found

| File | Role | Reason no analog exists |
|------|------|------------------------|
| `src/workers/worker.ts` | worker entry | First Web Worker in the project |
| `src/workers/pool.ts` | orchestrator class | First class-based service in the project (no precedent) |
| `src/workers/stub-adapter.ts` | adapter | First adapter; D-04 contract is greenfield |
| `src/stores/*.ts` (all 4 files) | zustand store | First zustand store in the project |
| `src/tests/fixtures/instrument-blob-urls.ts` | monkey-patch helper | First test instrumentation helper |
| `src/lib/live-region.ts` | a11y bus | First a11y-event utility (closest is the inline `aria-label` discipline in shell components) |

For these files the **planner must rely on RESEARCH.md patterns directly** (cited section/line numbers in each Pattern Assignment above). All cited patterns are verified against authoritative external sources (Comlink README, Vite docs, MDN, zustand docs) per RESEARCH.md §Sources (lines 757-771).

## Metadata

**Analog search scope:** `src/**/*.ts`, `src/**/*.tsx` (33 files total)
**Files scanned:** 18 read in full or in part during this mapping
**Pattern extraction date:** 2026-04-30
**Phase:** 02 - worker-harness-state
**Padded phase:** 02
