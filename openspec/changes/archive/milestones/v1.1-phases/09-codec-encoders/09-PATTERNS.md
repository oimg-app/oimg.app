# Phase 9: Codec Encoders - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 12
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/workers/codec.worker.ts` | worker | transform (WASM encode) | self (extend existing switch) | exact |
| `src/lib/worker-pool.ts` | utility | request-response | self (add Comlink.transfer) | exact |
| `src/lib/stub-data.ts` | model | — | self (extend FileEntry + FileSettings) | exact |
| `src/stores/files.ts` | store | CRUD | self (extend with per-file settings actions) | exact |
| `src/stores/settings.ts` | store | CRUD | self (add applyToAll, keep as defaults) | exact |
| `src/stores/runtime.ts` | store | event-driven | self (fix setJobCounts CR-01) | exact |
| `src/hooks/useOptimize.ts` | hook | request-response | self (replace 0-byte stubs) | exact |
| `src/hooks/useLiveEncode.ts` | hook | event-driven | `src/hooks/useOptimize.ts` | role-match |
| `src/components/panels/inspector/CodecPanel.tsx` | component | request-response | self (read selectedFile.settings) | exact |
| `src/components/panels/inspector/SvgoPanel.tsx` | component | request-response | `src/components/panels/inspector/CodecPanel.tsx` | role-match |
| `src/components/panels/center/DeltaStrip.tsx` | component | request-response | self (read from encodedBuffer) | exact |
| `src/components/panels/center/CompareStage.tsx` | component | request-response | self (show real encoded image) | exact |
| `src/tests/codec-encoders.spec.ts` | test | — | `src/tests/worker-pipeline.spec.ts` | exact |
| `src/tests/per-file-settings.spec.ts` | test | — | `src/tests/worker-pipeline.spec.ts` | role-match |

---

## Pattern Assignments

### `src/workers/codec.worker.ts` (worker, transform)

**Analog:** Self — `src/workers/codec.worker.ts`

**Existing structure to extend** (lines 1–59):
```typescript
// KEEP: Comlink import, KNOWN_CODECS guard, outer try/catch, Comlink.expose
import * as Comlink from 'comlink'
const KNOWN_CODECS = new Set<string>(['PNG', 'WebP', 'JPEG', 'AVIF', 'SVG'])
async function optimize(job: EncodeJob): Promise<EncodeResult> {
  if (!KNOWN_CODECS.has(String(job.codec))) throw new Error('Invalid codec: ' + String(job.codec))
  try {
    switch (job.codec) { ... }
  } catch (err) { return Promise.reject(err) }
}
Comlink.expose({ optimize })
```

**EncodeJob schema extension — add `sourceFormat` and typed `settings`**:
```typescript
// Replace existing EncodeJob in codec.worker.ts (lines 9–13)
export interface EncodeJob {
  codec: 'PNG' | 'WebP' | 'JPEG' | 'AVIF' | 'SVG'
  sourceFormat: 'png' | 'jpeg' | 'jpg' | 'webp' | 'avif' | 'svg'  // NEW — drives decoder selection
  buffer: ArrayBuffer
  settings: FileSettings  // replace Record<string, unknown>
}
```

**WR-02 fix + Comlink.transfer return pattern** (copy into each branch):
```typescript
// WR-02: guard at top of every case before any await import
if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
// ...encode logic...
// WR-03: transfer result buffer (zero-copy return)
return Comlink.transfer(
  { buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength },
  [result]
)
```

**Source-agnostic decode helper** (new private function, insert above `optimize`):
```typescript
async function decodeSource(buffer: ArrayBuffer, sourceFormat: string): Promise<ImageData> {
  switch (sourceFormat.toLowerCase()) {
    case 'png':  { const { decode } = await import('@jsquash/png');  return decode(buffer) }
    case 'jpeg':
    case 'jpg':  { const { decode } = await import('@jsquash/jpeg'); return decode(buffer) }
    case 'webp': { const { decode } = await import('@jsquash/webp'); return decode(buffer) }
    case 'avif': { const { decode } = await import('@jsquash/avif'); return decode(buffer) }
    default: throw new Error('Unknown source format: ' + sourceFormat)
  }
}
```

**PNG case — replace stub** (lines 33–43):
```typescript
case 'PNG': {
  if (job.buffer.byteLength === 0) throw new Error('Empty buffer')
  const { optimise } = await import('@jsquash/oxipng')
  // oxipng optimise accepts ArrayBuffer directly for PNG→PNG; use decodeSource for PNG→other
  const level = (job.settings.method as number) ?? 2
  const result = await optimise(job.buffer, { level, interlace: false, optimiseAlpha: true })
  return Comlink.transfer(
    { buffer: result, originalSize: job.buffer.byteLength, optimizedSize: result.byteLength },
    [result]
  )
}
```

**WebP, JPEG, AVIF, SVG cases** (replace stub throw at lines 45–50):
Each case follows `if (job.buffer.byteLength === 0) throw` → `decodeSource` → `encode` → `Comlink.transfer`. AVIF wraps entirely in try/catch for Safari <16.4 guard. SVG uses `new TextDecoder('utf-8').decode(job.buffer)` before `import('svgo/browser').then(m => m.optimize(...))` — no decodeSource call.

**Dynamic import discipline** — ALL `await import('@jsquash/...')` calls MUST stay inside their case branch (existing PIPE-02 pattern, lines 35–36 as reference). Never top-level.

---

### `src/lib/worker-pool.ts` (utility, WR-03 fix)

**Analog:** Self — `src/lib/worker-pool.ts`

**WR-03 fix — Comlink.transfer on dispatch** (replace line 49):
```typescript
// BEFORE (line 49):
worker.optimize(pending.job).then(...)
// AFTER — transfer input buffer (neuters pending.job.buffer on caller side — store rawBuffer first):
worker.optimize(Comlink.transfer(pending.job, [pending.job.buffer])).then(...)
```

**No other changes.** Pool class structure, singleton pattern, HMR cleanup (lines 64–80) are correct.

---

### `src/lib/stub-data.ts` (model, extend FileEntry)

**Analog:** Self — `src/lib/stub-data.ts`

**Existing FileEntry** (lines 10–21) — add new optional fields:
```typescript
// Add FileSettings interface (new, insert after SvgoPlugin)
export interface FileSettings {
  codec: Codec
  q: number
  method: number
  lossless: boolean
  resizeOn: boolean
  w: string
  h: string
  alg: string
  fit: string
  stripMeta: boolean
  keepIcc: boolean
  aggressive: boolean
  plugins: SvgoPlugin[]
  progressive?: boolean  // JPEG only — default true
}

// Extend FileEntry (lines 10–21) with:
export interface FileEntry {
  // ...existing fields unchanged...
  settings?: FileSettings        // per-file settings (D-01) — optional until initialized
  rawBuffer?: ArrayBuffer        // original file bytes; cache for live re-encode (D-05)
  encodedBuffer?: ArrayBuffer    // result of last encode
  error?: string                 // per-file error message (D-13)
}
```

**STUB_FILES** (lines 31–44) — settings not required for stubs; store initializer will call `initFileSettings` fallback on missing entries.

---

### `src/stores/files.ts` (store, CRUD — extend)

**Analog:** Self — `src/stores/files.ts`

**Existing setKey pattern** (lines 67–81) — copy for all new actions:
```typescript
// Existing pattern (lines 67–69):
export function selectFile(id: string): void {
  filesAtom.setKey('selectedId', id)
}
// Existing pattern (lines 71–73):
export function removeFile(id: string): void {
  filesAtom.setKey('entries', filesAtom.get().entries.filter((f) => f.id !== id))
}
```

**New actions to add** (follow same setKey pattern):
```typescript
export function setFileSettings<K extends keyof FileSettings>(
  id: string, key: K, value: FileSettings[K]
): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, settings: { ...e.settings!, [key]: value } } : e
  ))
}

export function setFileError(id: string, error: string | undefined): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, error } : e
  ))
}

export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, encodedBuffer, opt: optimizedSize, error: undefined } : e
  ))
}

export function setFileRawBuffer(id: string, rawBuffer: ArrayBuffer): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, rawBuffer } : e
  ))
}
```

**Import additions** at top: `import type { FileEntry, FileSettings, SortKey } from '@/lib/stub-data'`

---

### `src/stores/settings.ts` (store, refactor to defaults)

**Analog:** Self — `src/stores/settings.ts`

**Existing map + setKey actions** (lines 28–61) — all kept verbatim. `SettingsState` shape becomes the global defaults template.

**New export to add** (append after line 61):
```typescript
// D-02: "Apply to all" — push current global defaults onto every FileEntry.settings
export function applyToAll(): void {
  // Lazy import avoids circular dep: settings.ts → files.ts
  import('@/stores/files').then(({ filesAtom }) => {
    const defaults = settingsAtom.get()
    filesAtom.setKey('entries', filesAtom.get().entries.map(e => ({
      ...e,
      settings: { ...defaults }
    })))
  })
}
```

**CIRCULAR ESM GUARD comment** (line 2) — keep it; the lazy import pattern in `getPool` (worker-pool.ts line 71) is the established workaround for this project.

---

### `src/stores/runtime.ts` (store, CR-01 fix)

**Analog:** Self — `src/stores/runtime.ts`

**CR-01 fix — replace `setJobCounts`** (lines 55–62):
```typescript
// BEFORE (lines 55–62) — full-object spread causes read-modify-write race:
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.set({ ...runtimeAtom.get(), runningJobs: running, queuedJobs: queued, running: running > 0 || queued > 0 })
}
// AFTER — atomic setKey per field:
export function setJobCounts(running: number, queued: number): void {
  runtimeAtom.setKey('runningJobs', running)
  runtimeAtom.setKey('queuedJobs', queued)
  runtimeAtom.setKey('running', running > 0 || queued > 0)
}
```

**No other changes.**

---

### `src/hooks/useOptimize.ts` (hook, replace stubs)

**Analog:** Self — `src/hooks/useOptimize.ts`

**Existing structure** (lines 26–51) — keep `useStore(filesAtom)`, `toCodec()` helper, `Promise.allSettled` pattern.

**Replace the stub job construction** (lines 32–44):
```typescript
// BEFORE (lines 36–41):
return [{ codec, buffer: new ArrayBuffer(0), settings: {} } satisfies EncodeJob]

// AFTER — real File→ArrayBuffer bytes + typed settings:
const rawBuffer = entry.rawBuffer
if (!rawBuffer) return []  // file not yet read; skip
return [{
  codec,
  sourceFormat: entry.type as EncodeJob['sourceFormat'],
  buffer: rawBuffer.slice(0),  // slice(0) = copy so rawBuffer stays intact after Comlink.transfer
  settings: entry.settings ?? settingsAtom.get(),
} satisfies EncodeJob]
```

**Handle EncodeResult to store encoded bytes** — after `Promise.allSettled`, call `setFileResult(entry.id, result.buffer, result.optimizedSize)` on fulfilled results, `setFileError(entry.id, reason.message)` on rejections.

**File reading** — when entries are added (or before `runOptimize`), read each `File` object via `file.arrayBuffer()` and call `setFileRawBuffer(id, buffer)`. This gives entries their `rawBuffer` before jobs are dispatched.

---

### `src/hooks/useLiveEncode.ts` (hook, NEW — D-05/D-07)

**Analog:** `src/hooks/useOptimize.ts` (role-match, same pool dispatch pattern)

**Imports pattern** — copy from useOptimize.ts lines 1–6, add React hooks:
```typescript
import { useRef, useCallback } from 'react'
import { filesAtom } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { getPool } from '@/lib/worker-pool'
import * as Comlink from 'comlink'
import { toast } from 'sonner'
import { setFileResult, setFileError } from '@/stores/files'
import type { EncodeJob } from '@/workers/codec.worker'
```

**Debounce pattern** — use `useRef<ReturnType<typeof setTimeout> | null>(null)` + `clearTimeout` (no library, per RESEARCH.md "Don't Hand-Roll" table):
```typescript
export function useLiveEncode() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback((fileId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const entry = filesAtom.get().entries.find(e => e.id === fileId)
      if (!entry?.rawBuffer || !entry.settings) return
      const pool = getPool()
      try {
        const job: EncodeJob = {
          codec: entry.settings.codec,
          sourceFormat: entry.type as EncodeJob['sourceFormat'],
          buffer: entry.rawBuffer.slice(0),  // copy — rawBuffer must survive transfer
          settings: entry.settings,
        }
        const result = await pool.run(Comlink.transfer(job, [job.buffer]))
        setFileResult(fileId, result.buffer, result.optimizedSize)
      } catch (err) {
        setFileError(fileId, String(err))
        toast.error('Encode failed: ' + String(err))  // D-13 sonner toast
      }
    }, 300)  // 300ms — within D-07 range 250–350ms
  }, [])

  return { trigger }
}
```

---

### `src/components/panels/inspector/CodecPanel.tsx` (component, wire to per-file settings)

**Analog:** Self — `src/components/panels/inspector/CodecPanel.tsx`

**Current pattern** (lines 36–48) — reads from `settingsAtom` and `$selectedFile`:
```typescript
const settings = useStore(settingsAtom)
const selectedFile = useStore($selectedFile)
```

**Phase 9 change** — replace `settingsAtom` read with `selectedFile.settings`:
```typescript
// Read per-file settings (D-03)
const settings = selectedFile?.settings ?? useStore(settingsAtom)  // fallback to global defaults
```

**onChange handlers** — replace `setCodec(v)`, `setQuality(v)`, etc. with `setFileSettings(selectedFile.id, 'codec', v)`, `setFileSettings(selectedFile.id, 'q', v)`, etc. Then call `trigger(selectedFile.id)` from `useLiveEncode()` to debounce re-encode.

**PNG quality slider** — disable `<Slider>` when `settings.codec === 'PNG'` (Pitfall 4: quality has no effect on OxiPNG).

**Control-to-codec mapping** (from RESEARCH.md Pattern 2):
| Inspector Control | Codec option |
|---|---|
| `q` | `quality` for WebP/JPEG/AVIF; no-op for PNG |
| `method` | `method` (WebP), ignored (JPEG), inverted as `speed=6-method` (AVIF), `level` (PNG) |
| `lossless` | `lossless: 1/0` (WebP), `lossless: boolean` (AVIF), N/A (PNG/JPEG) |
| `progressive` | `progressive: boolean` (JPEG only) — add to `FileSettings` + toggle in CodecPanel |

---

### `src/components/panels/inspector/SvgoPanel.tsx` (component, wire plugin toggles)

**Analog:** `src/components/panels/inspector/CodecPanel.tsx`

**useStore pattern** — same `useStore($selectedFile)` + `useStore(filesAtom)` pattern as CodecPanel.

**Phase 9 change** — replace `togglePlugin(id)` from `settingsAtom` with `setFileSettings(selectedFile.id, 'plugins', updatedPlugins)` + `trigger(selectedFile.id)`.

---

### `src/components/panels/center/DeltaStrip.tsx` (component, show real encoded delta)

**Analog:** Self — `src/components/panels/center/DeltaStrip.tsx`

**Current pattern** (lines 36–46):
```typescript
const selectedFile = useStore($selectedFile)
const { codec, q, method } = useStore(settingsAtom)
const orig = selectedFile?.orig ?? null
const opt  = selectedFile?.opt  ?? null
```

**Phase 9 change** — derive values from per-file settings and real `encodedBuffer`:
```typescript
// D-03: read codec/q/method from the file's own settings, not global settingsAtom
const { codec, q, method } = selectedFile?.settings ?? useStore(settingsAtom)
// D-05: optimizedSize from last encode result
const opt = selectedFile?.encodedBuffer
  ? selectedFile.encodedBuffer.byteLength
  : selectedFile?.opt ?? null
```

**OPTIMIZED card sub-label** (line 57) — reads `selectedFile?.error` to show error state (D-13) if present.

---

### `src/components/panels/center/CompareStage.tsx` (component, show real encoded image)

**Analog:** Self — `src/components/panels/center/CompareStage.tsx`

**Current pattern** (lines 29–31) — layers are `bg-[var(--color-bg-2)]` / `bg-[var(--color-bg-3)]` placeholders (lines 162–169).

**Phase 9 change** — replace placeholder divs with `<img>` elements whose `src` is derived from `encodedBuffer` and `rawBuffer`:
```typescript
// Convert ArrayBuffer → object URL for <img> src
// Pattern: create in effect, revoke on cleanup (browser resource management)
useEffect(() => {
  if (!selectedFile?.rawBuffer) return
  const blob = new Blob([selectedFile.rawBuffer])
  const url = URL.createObjectURL(blob)
  setOrigSrc(url)
  return () => URL.revokeObjectURL(url)
}, [selectedFile?.rawBuffer])
```

**Split-handle drag** (lines 92–109) and **pan/zoom** (lines 60–89) — keep verbatim. Only the image layer content changes.

---

### `src/tests/codec-encoders.spec.ts` (test, NEW — Wave 0)

**Analog:** `src/tests/worker-pipeline.spec.ts`

**Test structure pattern** (lines 1–38 of worker-pipeline.spec.ts):
```typescript
import { test, expect } from '@playwright/test'

test.describe('Codec Encoders — ENC-01..06', () => {
  // Navigate once; inject test buffer; assert EncodeResult
  test('PNG via OxiPNG produces smaller output (ENC-01)', async ({ page }) => {
    await page.goto('/')
    // Inject a tiny real PNG buffer via page.evaluate → codec worker
    // Assert result.buffer.byteLength > 0 and result.optimizedSize < result.originalSize
  })
  // ... WebP, JPEG, AVIF, SVG, D-13 error cases
})
```

**PIPE-02 pattern** (lines 22–37) — `page.on('request', ...)` before `page.goto('/')` to assert AVIF WASM not fetched on load.

**PIPE-01 pattern** (lines 11–20) — `page.getByRole` + `expect(locator).toBeVisible()` for interactivity assertions.

---

### `src/tests/per-file-settings.spec.ts` (test, NEW — Wave 0)

**Analog:** `src/tests/worker-pipeline.spec.ts` + `src/tests/inspector-tabs.spec.ts`

Tests cover:
- D-01: each FileEntry has independent settings after setFileSettings
- D-02: applyToAll pushes global defaults to all entries
- D-03: inspector shows selected file's own settings (not global)

**Pattern:** `page.goto('/')` → select file → interact with inspector control → assert store state via `page.evaluate(() => window.__filesAtom?.get())` or by observing UI label changes.

---

## Shared Patterns

### nanostores `map` + `setKey` (all store actions)
**Source:** `src/stores/files.ts` lines 67–73, `src/stores/settings.ts` lines 44–61, `src/stores/runtime.ts` lines 30–46
**Apply to:** All new store actions in files.ts, settings.ts, runtime.ts
```typescript
// Canonical pattern — one setKey per key, never spread the whole object:
export function doSomething(value: T): void {
  atomName.setKey('fieldName', value)
}
// For entries array mutation:
atomName.setKey('entries', atomName.get().entries.map(e =>
  e.id === targetId ? { ...e, changedField: value } : e
))
```

### Circular ESM guard (lazy import for cross-store access)
**Source:** `src/lib/worker-pool.ts` lines 71–73
**Apply to:** `settings.ts` applyToAll (imports files.ts); do NOT create import cycles
```typescript
// Lazy import avoids circular dep:
import('@/stores/files').then(({ filesAtom }) => { ... })
```

### Dynamic import discipline (all worker codec branches)
**Source:** `src/workers/codec.worker.ts` lines 35–36
**Apply to:** Every `case` in the codec switch — all `await import('@jsquash/...')` and `await import('svgo/browser')` calls MUST be inside their case branch, never hoisted
```typescript
// CORRECT:
case 'WebP': {
  const { encode } = await import('@jsquash/webp')
  ...
}
// WRONG — hoist import to top of function or file:
const { encode } = await import('@jsquash/webp')  // breaks lazy-load budget
```

### D-13 Error handling (all codec branches)
**Source:** RESEARCH.md Pattern 4 + Pitfall 2
**Apply to:** Every codec case in codec.worker.ts; useLiveEncode.ts catch block
```typescript
// Worker side — catch per-codec errors, reject Promise (outer try/catch at lines 30–56 propagates)
// Hook side — catch pool.run() rejection:
} catch (err) {
  setFileError(fileId, String(err))
  toast.error('Encode failed: ' + String(err))
}
```

### sonner toast (D-13 notifications)
**Source:** RESEARCH.md Standard Stack; `sonner` already installed
**Apply to:** `useLiveEncode.ts`, `useOptimize.ts` error paths
```typescript
import { toast } from 'sonner'
toast.error('AVIF not supported in this browser')
toast.promise(encodePromise, { loading: 'Encoding…', success: 'Done', error: 'Failed' })
```

### `useStore` + `$selectedFile` (all inspector/center components)
**Source:** `src/components/panels/inspector/CodecPanel.tsx` lines 37–39, `src/components/panels/center/DeltaStrip.tsx` lines 36–38
**Apply to:** All inspector panels + CompareStage + DeltaStrip reads in Phase 9
```typescript
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
const selectedFile = useStore($selectedFile)
// Per-file settings: selectedFile?.settings (not settingsAtom) — D-03
```

### Comlink.transfer zero-copy pattern (WR-03)
**Source:** RESEARCH.md Pattern 4; worker-pool.ts line 49 (fix target)
**Apply to:** `worker-pool.ts` dispatch, `codec.worker.ts` return, `useLiveEncode.ts` pool.run call
```typescript
// Dispatch with transfer (pool):
worker.optimize(Comlink.transfer(pending.job, [pending.job.buffer]))
// Return with transfer (worker):
return Comlink.transfer({ buffer, originalSize, optimizedSize }, [buffer])
// Hook — always slice(0) before transfer to keep rawBuffer alive:
pool.run(Comlink.transfer(job, [job.buffer]))  // job.buffer = rawBuffer.slice(0)
```

---

## No Analog Found

All files have direct analogs in the codebase. No files require falling back to RESEARCH.md-only patterns.

| File | Note |
|------|------|
| `src/hooks/useLiveEncode.ts` | New file; closest analog is `useOptimize.ts` (role-match). Debounce + trigger pattern is documented in RESEARCH.md Pattern useLiveEncode. |

---

## Metadata

**Analog search scope:** `src/workers/`, `src/lib/`, `src/hooks/`, `src/stores/`, `src/components/panels/`, `src/tests/`
**Files read:** 14 source files
**Pattern extraction date:** 2026-05-26
