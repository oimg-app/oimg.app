# Phase 16: SSIM Quality Metric — Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 11 source + 4 test targets
**Analogs found:** 11 / 11 (all with strong repo precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/workers/metrics.worker.ts` | worker | request-response (Comlink) | `src/workers/codec.worker.ts` | exact (worker+PIPE-02) |
| `src/lib/metrics-worker.ts` | lib (singleton factory) | request-response | `src/lib/worker-pool.ts` | role-match (N=1 vs pool) |
| `src/lib/metrics-bands.ts` | lib (pure utility) | transform | `src/lib/format.ts` | exact (tiny pure lib) |
| `src/hooks/useMetricsAuto.ts` | hook | event-driven (store subscribe) | `src/hooks/useLiveEncode.ts` | exact (CR-02 seqRef) |
| `src/lib/settings.ts` (EDIT) | model | schema | `src/lib/settings.ts` `FileEntry` | self |
| `src/stores/files.ts` (EDIT) | store | CRUD | `src/stores/files.ts` `setFileResult` | self (extend existing) |
| `src/components/panels/inspector/ReportPanel.tsx` (EDIT) | component | render | `ReportPanel.tsx` "Total savings" Section | self (add Section) |
| `vite.config.ts` (EDIT) | config | build-time | `vite.config.ts:52-64` `VERSIONS.svgo` + `:145-150` `define` | self (append entry) |
| `src/lib/versions.ts` (EDIT) | lib | build-time wrapper | `src/lib/versions.ts:26,42-49` | self (promote optional → required) |
| `src/types/globals.d.ts` (EDIT) | types | ambient decl | `src/types/globals.d.ts:9` `__SVGO_VERSION__` | self (mirror) |
| `src/App.tsx` (EDIT) | root component | mount | `src/App.tsx:15` `useClipboardIngest()` | self (one-liner) |
| `src/tests/metrics-bands.test.ts` (NEW) | unit test | assertion | existing `--experimental-strip-types` tests | role-match |
| `src/tests/ssim-metric.spec.ts` (NEW) | e2e test | Playwright | existing `*.spec.ts` | role-match |

## Pattern Assignments

### `src/workers/metrics.worker.ts` (NEW — worker, request-response)

**Purpose:** Comlink-exposed `computeSSIM` — decode raw + encoded buffers, dimension-align via `@jsquash/resize`, run `ssim.js`, return `{ mssim, ms }`.

**Analog:** `src/workers/codec.worker.ts`

**Comlink expose skeleton** (codec.worker.ts:1-4, 293):
```typescript
import * as Comlink from 'comlink'
// ...
Comlink.expose({ optimize })
```

**PIPE-02 dynamic-import-in-branch pattern** (codec.worker.ts:30-73):
```typescript
async function decodeSource(buffer: ArrayBuffer, sourceFormat: string): Promise<ImageData | null> {
  switch (sourceFormat.toLowerCase()) {
    case 'png': {
      const { decode } = await import('@jsquash/png')
      return decode(buffer)
    }
    case 'jpeg':
    case 'jpg': {
      const { decode } = await import('@jsquash/jpeg')
      return decode(buffer)
    }
    case 'webp': {
      const { decode } = await import('@jsquash/webp')
      return decode(buffer)
    }
    case 'avif': {
      const { decode } = await import('@jsquash/avif')
      return decode(buffer)
    }
    case 'heic':
    case 'heif': {
      try {
        const { heicDecode } = (await import('@/lib/heic/decode'))
        const decoded = await heicDecode(buffer)
        return new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height)
      } catch (err) {
        throw new Error('HEIC decode failed ...: ' + String(err))
      }
    }
    default:
      throw new Error('Unknown source format: ' + sourceFormat)
  }
}
```

**Resize-before-encode dynamic import** (codec.worker.ts:105-111) — copy verbatim for dimensional alignment:
```typescript
const { default: resize } = await import('@jsquash/resize')
return resize(imageData, {
  width,
  height,
  method: settings.alg as 'lanczos3' | 'mitchell' | 'catrom' | 'triangle',
  fitMethod: toFitMethod(settings.fit),
})
```

**Try/catch reject-only-this-job pattern** (codec.worker.ts:161-162, 288-291) — never crash the worker:
```typescript
try {
  switch (job.codec) { /* ... */ }
} catch (err) {
  return Promise.reject(err)
}
```

**Delta vs analog:**
- Replace `optimize` API with `computeSSIM` (parallel decode of raw + encoded, dim-align, then `import('ssim.js')` inside the function body).
- Use `fitMethod: 'stretch'` (not codec worker's `toFitMethod()`) — Pitfall 1 requires pixel-for-pixel alignment.
- No `Comlink.transfer` on return (result is a scalar `{ mssim: number, ms: number }`, no ArrayBuffer to hand back).
- Guard `sourceFormat`/`targetFormat` against an enum before dispatch, mirroring `KNOWN_CODECS` at codec.worker.ts:26.

---

### `src/lib/metrics-worker.ts` (NEW — lib singleton factory)

**Purpose:** `getMetricsWorker()` singleton that lazy-instantiates the metrics worker + wraps with Comlink; HMR-dispose to prevent leaks.

**Analog:** `src/lib/worker-pool.ts`

**Singleton + HMR dispose** (worker-pool.ts:74-90):
```typescript
let _instance: WorkerPool | null = null

export function getPool(): WorkerPool {
  if (!_instance) {
    const size = Math.min(navigator.hardwareConcurrency ?? 4, 4)
    _instance = new WorkerPool(size, (active, queued) => {
      import('@/stores/runtime').then(({ setJobCounts }) => setJobCounts(active, queued))
    })
  }
  return _instance
}

// HMR cleanup — terminate stale workers on hot reload
if (import.meta.hot) {
  import.meta.hot.dispose(() => { _instance = null })
}
```

**Literal-URL worker instantiation + Comlink.wrap** (worker-pool.ts:27-33):
```typescript
// CRITICAL: literal URL string — no template literals; Vite static analysis requires this form
const w = new Worker(new URL('../workers/codec.worker.ts', import.meta.url), { type: 'module' })
const proxy = Comlink.wrap<WorkerApi>(w)
```

**Delta vs analog:**
- Reduce from N-worker pool to a single worker: `_worker: Worker | null` + `_proxy: Comlink.Remote<MetricsApi> | null`.
- No job queue, no `run(job, onDispatch)` — callers invoke `getMetricsWorker().computeSSIM(job)` directly.
- HMR dispose MUST also `_worker?.terminate()` in addition to nulling the proxy (Pitfall 6).
- Import URL string becomes `new URL('../workers/metrics.worker.ts', import.meta.url)` (literal — Vite requires this exact form).

---

### `src/lib/metrics-bands.ts` (NEW — pure utility)

**Purpose:** Verbatim threshold constants (`SSIM_BANDS = { green: 0.95, yellow: 0.85 }`) + `ssimBand(v)` pure function.

**Analog:** `src/lib/format.ts`

**Tiny pure lib shape** (format.ts:1-18):
```typescript
// Byte / percentage formatters — ported from example-ui/data.jsx with zero-savings guard (returns '').
// Phase 01, Plan 04 — STORE-06

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}

export function fmtPct(orig: number | null | undefined, opt: number | null | undefined): string {
  if (orig == null || opt == null) return '—'
  if (orig === 0) return '—'
  const saved = ((orig - opt) / orig) * 100
  if (saved === 0) return ''
  return (saved > 0 ? '−' : '+') + Math.abs(saved).toFixed(1) + '%'
}
```

**Delta vs analog:**
- No I/O, no store touch — module exports `type Band`, `const SSIM_BANDS` (`as const`), and `ssimBand(v: number): Band`.
- File header preserves Phase 16 provenance tag pattern (`// Phase 16 — MTR-03: threshold constants...`).
- Include Phase 17 hook comment (`BUTTERAUGLI_BANDS`) as documented seam for the next phase.

---

### `src/hooks/useMetricsAuto.ts` (NEW — hook, event-driven)

**Purpose:** Subscribe `$selectedFile`; on `status==='done'` + missing metric + non-SVG source/target, dispatch `computeSSIM` with CR-02 seqRef stale-drop guard.

**Analog:** `src/hooks/useLiveEncode.ts`

**CR-02 monotonic seqRef pattern** (useLiveEncode.ts:47-51, 111, 115, 122):
```typescript
// CR-02: monotonic invocation token. Each trigger bumps seqRef; an in-flight pool.run whose
// token no longer matches the latest seq is stale ... and its result must be dropped so it
// never lands on the wrong/superseded file.
const seqRef = useRef(0)
// ...
const seq = ++seqRef.current
// ...
// CR-02: drop superseded results
if (seq !== seqRef.current) return
setFileResult(fileId, result.buffer, result.optimizedSize)
```

**useStore + filesAtom.get() split** (useLiveEncode.ts:60, and general project rule per CLAUDE.md "Hook pattern"):
```typescript
// useStore drives re-renders on state changes, but reads inside async bodies
// use filesAtom.get() to see the freshest snapshot.
const entry = filesAtom.get().entries.find((e) => e.id === fileId)
```

**Slice-before-transfer (preserve original)** (useLiveEncode.ts:78):
```typescript
let dispatchBuffer = entry.rawBuffer.slice(0)
```

**Delta vs analog:**
- No debounce (`setTimeout` / `timerRef`) — auto-trigger is driven by `useEffect` deps `[selected?.id, selected?.status, selected?.encodedBuffer, selected?.metrics?.ssim]`, not user input.
- Subscribe via `useStore($selectedFile)` (computed atom), not `filesAtom`.
- Guards short-circuit: `status !== 'done'`, missing buffers, SVG source/target, cache hit (`metrics?.ssim !== undefined`).
- Dynamic-import worker singleton inside the effect body — keeps initial route free of the metrics-worker module itself (`await import('@/lib/metrics-worker')`).
- Two writes: `setFileMetric(id, 'ssim', mssim)` on success, `setFileMetric(id, 'ssim', null)` on catch. `null` distinguishes failed-compute from `undefined` (pending/uncomputed).

---

### `src/lib/settings.ts` (EDIT — add `FileEntry.metrics` field)

**Purpose:** Extend `FileEntry` interface with optional `metrics?: { ssim?: number | null }`.

**Analog:** `src/lib/settings.ts` — extend interface at the same block that already carries `rawBuffer`/`encodedBuffer`/`error`.

**Existing FileEntry** (settings.ts:11-28):
```typescript
export interface FileEntry {
    id: string;
    name: string;
    type: string;
    orig: number;
    opt: number;
    status: FileStatus;
    target: string;
    dim: string;
    q: number | null;
    createdAt?: number;
    prog?: number;
    settings?: FileSettings; // per-file settings (D-01)
    rawBuffer?: ArrayBuffer; // original file bytes; cache for live re-encode (D-05)
    encodedBuffer?: ArrayBuffer; // result of last encode
    error?: string; // per-file error message (D-13)
}
```

**Delta:**
- Append `metrics?: { ssim?: number | null }` after `error`.
- Follow existing optional-field commenting style (one-liner justification: `// Phase 16 — MTR-01: perceptual-quality cache; undefined=pending, null=failed, number=computed`).
- Leave `defaultFileSettings()` (settings.ts:122-145) untouched — `metrics` lives on `FileEntry`, not `FileSettings`.

---

### `src/stores/files.ts` (EDIT — add `setFileMetric` + invalidate in `setFileResult`)

**Purpose:** New atomic writer `setFileMetric(id, 'ssim', number|null)` through the WR-02 `updateEntry` funnel; extend `setFileResult` to clear stale metric on re-encode.

**Analog:** `src/stores/files.ts` itself — mimic `setFileError` (files.ts:143-145) shape and thread through `updateEntry`.

**WR-02 funnel** (files.ts:118-122):
```typescript
function updateEntry(id: string, patch: (e: FileEntry) => Partial<FileEntry>): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, ...patch(e) } : e
  ))
}
```

**Existing setFileResult** (files.ts:150-152) — to be extended:
```typescript
export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  updateEntry(id, () => ({ encodedBuffer, opt: optimizedSize, error: undefined, status: 'done' as const }))
}
```

**Existing setFileError shape** (files.ts:143-145) as template for `setFileMetric`:
```typescript
export function setFileError(id: string, error: string | undefined): void {
  updateEntry(id, () => (error ? { error, status: 'error' as const } : { error: undefined }))
}
```

**Delta:**
- Add `setFileMetric<K extends 'ssim'>(id: string, key: K, value: number | null)` — merges into `metrics` via `updateEntry(id, (e) => ({ metrics: { ...(e.metrics ?? {}), [key]: value } }))`.
- Extend `setFileResult` returned patch to include `metrics: undefined` — invalidates the cache on any successful re-encode (Pitfall 4).
- No new computed atoms are needed (ReportPanel already reads `$selectedFile`).

---

### `src/components/panels/inspector/ReportPanel.tsx` (EDIT — new Quality Section)

**Purpose:** Render a "Quality" `<Section>` with a banded SSIM row (data-testid + data-band + inline `color:` style) when `selected.status === 'done'` and source isn't SVG.

**Analog:** `ReportPanel.tsx` — existing `Section` composition + inline-CSS-var pattern.

**Existing Section + inline CSS var color pattern** (ReportPanel.tsx:86-118):
```tsx
<Section title="Total savings">
  <div className="grid grid-cols-2 gap-3 mb-3">
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-2)]">
        Saved
      </span>
      <span
        className="text-[14px] font-semibold font-mono"
        style={{ color: 'var(--color-accent)' }}
      >
        {'−' + fmtBytes(savedTotal)}
      </span>
    </div>
    {/* ... */}
  </div>
</Section>
```

**Existing gated-by-status render** (ReportPanel.tsx:72-84):
```tsx
{selected && selected.status === 'done' && (
  <Button
    data-testid="inspector-download"
    onClick={() => { void exportOne(selected) }}
    /* ... */
  >
    Download
  </Button>
)}
```

**Existing store subscribe** (ReportPanel.tsx:31-34):
```tsx
export function ReportPanel() {
  const { entries } = useStore(filesAtom)
  const selected = useStore($selectedFile)
  const { exportOne } = useExport()
```

**Delta:**
- Import `ssimBand, SSIM_BANDS` from `@/lib/metrics-bands`; add local `BAND_COLOR: Record<Band, string>` mapping to CSS vars.
- New `<Section title="Quality">` gated on `selected?.status === 'done' && selected.type.toLowerCase() !== 'svg'`.
- Ternary on `selected.metrics?.ssim`: `undefined → "Computing…"`, `null → "N/A"`, `number → colored 3-decimal score`.
- `data-testid="ssim-score"` + `data-band={ssimBand(v)}` for Playwright assertions.
- If `--color-error` CSS token is missing (Assumption A5), add it to `src/index.css` (planner call — not a code diff yet).

---

### `vite.config.ts` (EDIT — VERSIONS.ssim + `__SSIM_VERSION__` define)

**Purpose:** Append `ssim: readVer('ssim.js')` to `VERSIONS`; append `__SSIM_VERSION__: JSON.stringify(VERSIONS.ssim)` to `define`.

**Analog:** `vite.config.ts:47-64, 145-150` — carved slots already exist as comments.

**readVer pattern** (vite.config.ts:47-50):
```typescript
function readVer(pkg: string): string {
  const pkgPath = path.resolve(`node_modules/${pkg}/package.json`)
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version as string
}
```

**Existing VERSIONS block** (vite.config.ts:52-64) with reserved Phase 16 slot:
```typescript
const VERSIONS = {
  svgo: readVer('svgo'),
  jsquash: {
    webp: readVer('@jsquash/webp'),
    jpeg: readVer('@jsquash/jpeg'),
    avif: readVer('@jsquash/avif'),
    oxipng: readVer('@jsquash/oxipng'),
    png: readVer('@jsquash/png'),
    resize: readVer('@jsquash/resize'),
  },
  // Phase 16 — append: ssim: readVer('ssim.js')
  // Phase 17 — append: butteraugli build hash (read from vendored artefact)
}
```

**Existing define block** (vite.config.ts:145-150) with reserved slot:
```typescript
define: {
  __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo),
  __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash),
  // Phase 16 — append: __SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),
  // Phase 17 — append: __BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli),
}
```

**Delta:**
- Replace the two Phase 16 comment lines with real assignments (`ssim: readVer('ssim.js')` in `VERSIONS`; `__SSIM_VERSION__: JSON.stringify(VERSIONS.ssim)` in `define`).
- No other changes — `readVer` is reused as-is; T-13-02 constraint (only `node_modules/<pkg>/package.json`) already satisfied.
- If Pitfall 5 fires at build time, add `'ssim.js'` to `optimizeDeps.include` at vite.config.ts:126.

---

### `src/lib/versions.ts` (EDIT — promote `ssim` to required)

**Purpose:** Add `ssim: string` to `BuildVersions`, populate `BUILD_VERSIONS.ssim` with safe-fallback guard.

**Analog:** `src/lib/versions.ts` itself.

**Existing safe-fallback pattern** (versions.ts:42-49):
```typescript
export const BUILD_VERSIONS: BuildVersions = {
  svgo: typeof __SVGO_VERSION__ === 'string' ? __SVGO_VERSION__ : '0.0.0',
  jsquash:
    typeof __JSQUASH_VERSIONS__ === 'object' && __JSQUASH_VERSIONS__
      ? __JSQUASH_VERSIONS__
      : FALLBACK_JSQUASH,
  // ssim, butteraugli intentionally omitted — Phase 16/17 will populate.
}
```

**Existing interface with reserved slot** (versions.ts:22-29):
```typescript
export interface BuildVersions {
  svgo: string
  jsquash: Record<CodecKey, string>
  /** Phase 16 hook — populated when SSIM image-quality metric lands. */
  ssim?: string
  /** Phase 17 hook — populated when Butteraugli vendored build lands. */
  butteraugli?: { buildHash: string }
}
```

**Delta:**
- Change `ssim?: string` → `ssim: string` (drop the `?`).
- Add `ssim: typeof __SSIM_VERSION__ === 'string' ? __SSIM_VERSION__ : '0.0.0'` to `BUILD_VERSIONS`.
- Remove the "intentionally omitted" trailer comment (keep Butteraugli's).

---

### `src/types/globals.d.ts` (EDIT — declare `__SSIM_VERSION__`)

**Purpose:** Ambient declaration so `typeof __SSIM_VERSION__` in versions.ts type-checks.

**Analog:** `src/types/globals.d.ts:9-10` — existing `__SVGO_VERSION__` declaration.

**Existing declarations** (globals.d.ts:9-20):
```typescript
declare const __SVGO_VERSION__: string
declare const __JSQUASH_VERSIONS__: {
  webp: string
  jpeg: string
  avif: string
  oxipng: string
  png: string
  resize: string
}
// Phase 16/17 — append:
// declare const __SSIM_VERSION__: string
// declare const __BUTTERAUGLI_BUILD__: string
```

**Delta:**
- Uncomment `declare const __SSIM_VERSION__: string` (drop the leading `// `).
- Leave `__BUTTERAUGLI_BUILD__` commented (Phase 17).

---

### `src/App.tsx` (EDIT — mount `useMetricsAuto()`)

**Purpose:** One-liner mount of the auto-trigger hook alongside `useClipboardIngest()`.

**Analog:** `src/App.tsx:14-15` — existing hook mount pattern.

**Existing mount** (App.tsx:14-15):
```tsx
export default function App() {
  useClipboardIngest() // Phase 15 — ING-02: document-level Cmd/Ctrl+V handler.
```

**Delta:**
- Add `import { useMetricsAuto } from '@/hooks/useMetricsAuto'` (mirror line 12).
- Add `useMetricsAuto() // Phase 16 — MTR-01: auto-compute SSIM on selected file done` under the existing call.
- No other App.tsx changes.

---

### `src/tests/metrics-bands.test.ts` (NEW — unit)

**Purpose:** Assert boundary cases (0.85, 0.95, 0.85-ε, 0.95+ε) return correct band; assert threshold constants match REQUIREMENTS.md MTR-03.

**Analog:** existing `--experimental-strip-types` tests under `src/tests/` (e.g. `src/tests/versions.test.ts`).

**Delta:** pure-fn unit test — no fixtures, no worker. Two describe blocks: (1) `SSIM_BANDS` verbatim values; (2) `ssimBand` boundary sweep (0, 0.849, 0.85, 0.85, 0.949, 0.95, 1.0).

---

### `src/tests/ssim-metric.spec.ts` (NEW — Playwright e2e)

**Purpose:** ingest PNG → optimize → SSIM row auto-populates with valid `data-band`; selection-thrash preserves final score; SVG source shows N/A.

**Analog:** existing `*.spec.ts` under `src/tests/`.

**Delta:** three test cases (happy path, thrash, svg-N/A). Data-testids: `ssim-row`, `ssim-score`, `data-band`. Assert `computeSSIM` resolves within 2 s (Assumption A5 empirical check).

---

## Shared Patterns

### Comlink worker + Vite literal-URL instantiation
**Source:** `src/lib/worker-pool.ts:27-33`, `src/workers/codec.worker.ts:1-4,293`
**Apply to:** New metrics worker + singleton factory
```typescript
const w = new Worker(new URL('../workers/metrics.worker.ts', import.meta.url), { type: 'module' })
const proxy = Comlink.wrap<MetricsApi>(w)
// worker file:
import * as Comlink from 'comlink'
Comlink.expose({ computeSSIM })
```

### PIPE-02 dynamic-import-in-branch discipline
**Source:** `src/workers/codec.worker.ts:31-73, 105, 173, 236, 259`
**Apply to:** New metrics worker (`import('ssim.js')`, `import('@jsquash/*')`, `import('@jsquash/resize')` all inside async body — never hoisted).
```typescript
// Never at top of file:
// import ssim from 'ssim.js'   // WRONG — hoists into initial bundle
// Correct — inside the async function that uses it:
const { default: ssim } = await import('ssim.js')
```

### CR-02 monotonic seqRef stale-drop
**Source:** `src/hooks/useLiveEncode.ts:47-51, 111, 115, 122`
**Apply to:** `useMetricsAuto`
```typescript
const seqRef = useRef(0)
const seq = ++seqRef.current
// ... after await ...
if (seq !== seqRef.current) return
```

### WR-02 single-funnel per-entry mutation
**Source:** `src/stores/files.ts:118-122, 143-145`
**Apply to:** New `setFileMetric` action + extended `setFileResult`
```typescript
function updateEntry(id: string, patch: (e: FileEntry) => Partial<FileEntry>): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, ...patch(e) } : e
  ))
}
```

### Vite `define` + JSON.stringify + typed wrapper + ambient decl
**Source:** `vite.config.ts:47-64,145-150`, `src/lib/versions.ts:22-49`, `src/types/globals.d.ts:9-20`
**Apply to:** Phase 16 SSIM version wiring — same 3-file split, Phase 16 hooks already carved with commented-out placeholders at each site.

### HMR-dispose worker cleanup
**Source:** `src/lib/worker-pool.ts:87-90`
**Apply to:** `src/lib/metrics-worker.ts` (add `_worker?.terminate()` step — pool's version relies on the closure holding worker refs internally; the singleton needs to terminate explicitly).
```typescript
if (import.meta.hot) {
  import.meta.hot.dispose(() => { _instance = null })
}
```

### Slice-before-transfer (preserve original buffer)
**Source:** `src/hooks/useLiveEncode.ts:78`
**Apply to:** `useMetricsAuto` before dispatching rawBuffer + encodedBuffer to worker.
```typescript
rawBuffer: selected.rawBuffer!.slice(0),
encodedBuffer: selected.encodedBuffer!.slice(0),
```

### V5 Input Validation (enum guard before dispatch)
**Source:** `src/workers/codec.worker.ts:26, 147-149, 166`
**Apply to:** metrics.worker — `KNOWN_SOURCE_FORMATS` Set + empty-buffer guard at top of `computeSSIM`.
```typescript
const KNOWN_CODECS = new Set<string>(['PNG', 'WebP', 'JPEG', 'AVIF', 'SVG'])
if (!KNOWN_CODECS.has(String(job.codec))) throw new Error('Invalid codec: ' + String(job.codec))
if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
```

### One-liner hook mount at App root
**Source:** `src/App.tsx:14-15`
**Apply to:** `useMetricsAuto()` inserted immediately after `useClipboardIngest()`.

---

## No Analog Found

_None._ Every file in this phase has a strong repo-local precedent — the Phase 13 authors intentionally carved reserved slots in `vite.config.ts`, `versions.ts`, and `globals.d.ts` for the Phase 16 SSIM wiring; the worker/singleton/hook trio maps 1:1 onto the codec pipeline's existing `codec.worker.ts` + `worker-pool.ts` + `useLiveEncode.ts` structure.

## Metadata

**Analog search scope:** `src/workers/`, `src/lib/`, `src/hooks/`, `src/stores/`, `src/components/panels/inspector/`, `src/types/`, `vite.config.ts`, `src/App.tsx`
**Files scanned:** 11
**Pattern extraction date:** 2026-07-19
