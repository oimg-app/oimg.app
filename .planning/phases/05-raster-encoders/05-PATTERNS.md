# Phase 5: Raster Encoders - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 19 (8 new, 11 modified)
**Analogs found:** 19 / 19

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/workers/jpeg-adapter.ts` | worker-adapter | request-response | `src/workers/png-adapter.ts` | exact |
| `src/workers/webp-adapter.ts` | worker-adapter | request-response | `src/workers/png-adapter.ts` | exact |
| `src/workers/avif-adapter.ts` | worker-adapter | request-response | `src/workers/png-adapter.ts` | exact |
| `src/workers/jpeg-config.ts` | utility | transform | `src/workers/png-config.ts` | exact |
| `src/workers/webp-config.ts` | utility | transform | `src/workers/png-config.ts` | exact |
| `src/workers/avif-config.ts` | utility | transform | `src/workers/png-config.ts` | exact |
| `src/lib/icc.ts` | utility | transform | none — new capability | no analog |
| `src/components/panels/PngPanel.tsx` | component | request-response | `src/components/panels/SvgoPanel.tsx` | role-match |
| `src/components/panels/JpegPanel.tsx` | component | request-response | `src/components/panels/SvgoPanel.tsx` | role-match |
| `src/components/panels/WebpPanel.tsx` | component | request-response | `src/components/panels/SvgoPanel.tsx` | role-match |
| `src/components/panels/AvifPanel.tsx` | component | request-response | `src/components/panels/SvgoPanel.tsx` | role-match |
| `src/workers/png-adapter.ts` | worker-adapter | request-response | self (upgrade) | exact |
| `src/workers/worker.ts` | worker | request-response | self (upgrade) | exact |
| `src/stores/settings.ts` | store | CRUD | self (extend) | exact |
| `src/stores/files.ts` | store | CRUD | self (extend) | exact |
| `src/types/index.ts` | model | — | self (extend) | exact |
| `src/components/panels/InspectorPane.tsx` | component | request-response | self (restructure) | exact |
| `src/components/panels/CenterPane.tsx` | component | request-response | self (upgrade) | exact |
| `src/hooks/useBatchOrchestrate.ts` | hook | event-driven | `src/stores/runtime.ts` (enqueuePreview) | role-match |

---

## Pattern Assignments

### `src/workers/jpeg-adapter.ts`, `src/workers/webp-adapter.ts`, `src/workers/avif-adapter.ts` (worker-adapter, request-response)

**Analog:** `src/workers/png-adapter.ts`

**Imports pattern** (png-adapter.ts lines 25–30):
```typescript
import { decode, encode } from '@jsquash/png'
import resize from '@jsquash/resize'
import type { AdapterMeta } from './types.ts'
import { AdapterError } from './types.ts'
import type { PngResizeSettings } from './png-config.ts'
import { buildPngResizeSettings } from './png-config.ts'
```

For raster adapters, replace with format-specific imports:
```typescript
// jpeg-adapter.ts
import type { AdapterMeta } from './types.ts'
import { AdapterError } from './types.ts'
import type { CodecSettingsJpeg } from '../types/index.ts'

// Lazy-init slot — null until first job. Dynamic import keeps AVIF WASM
// out of the initial bundle (SC-5). All four formats use same pattern for consistency.
type JpegModule = typeof import('@jsquash/jpeg')
let jpegMod: JpegModule | null = null
async function getJpeg(): Promise<JpegModule> {
  if (!jpegMod) jpegMod = await import('@jsquash/jpeg')
  return jpegMod
}
```

**Core adapter pattern** (png-adapter.ts lines 37–95):
```typescript
export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const opts = settings as CodecSettingsJpeg   // cast to format-specific type
  const { decode, encode } = await getJpeg()   // lazy-init on first call

  let decoded: ImageData
  try {
    decoded = await decode(input)
  } catch (err) {
    throw new AdapterError(
      'jpeg',
      'decode',
      err instanceof Error ? err.message : String(err),
    )
  }

  let encoded: ArrayBuffer
  try {
    encoded = await encode(decoded, {
      quality: opts.quality,
      progressive: opts.progressive,
    })
  } catch (err) {
    throw new AdapterError(
      'jpeg',
      'encode',
      err instanceof Error ? err.message : String(err),
    )
  }

  return {
    output: encoded,
    meta: { codecVersion: 'jpeg@1.6.0' },
  }
}
```

**AdapterError pattern** (src/workers/types.ts lines 55–64):
```typescript
export class AdapterError extends Error {
  constructor(
    public format: string,
    public phase: 'decode' | 'process' | 'encode',
    message: string
  ) {
    super(`[${format}:${phase}] ${message}`)
    this.name = 'AdapterError'
  }
}
```

**OxiPNG upgrade to png-adapter.ts** — add after the `@jsquash/png` encode step:
```typescript
// Lazy-init slot for oxipng (same pattern as other adapters)
type OxipngModule = typeof import('@jsquash/oxipng')
let oxipngMod: OxipngModule | null = null
async function getOxipng(): Promise<OxipngModule> {
  if (!oxipngMod) oxipngMod = await import('@jsquash/oxipng')
  return oxipngMod
}

// After encode(resized) → pngBytes:
// CRITICAL: oxipng receives PNG bytes (ArrayBuffer), NOT ImageData.
const { optimise } = await getOxipng()   // verify export name after install
const optimized = await optimise(pngBytes, { level: opts.level })
// Return optimized as output instead of pngBytes
```

---

### `src/workers/jpeg-config.ts`, `src/workers/webp-config.ts`, `src/workers/avif-config.ts` (utility, transform)

**Analog:** `src/workers/png-config.ts`

**Full pattern** (png-config.ts lines 1–39):
```typescript
// Extracted into own module so unit tests can import without evaluating
// @jsquash/* packages — those only resolve inside Vite browser bundle,
// not under Node's --experimental-strip-types runner.
// Mirrors Phase 3 svg-config.ts pattern.

import type { CodecSettingsJpeg } from '../types/index.ts'

export interface JpegEncodeSettings {
  quality: number
  progressive: boolean
  // chroma?: number  — add only if @jsquash/jpeg README confirms the option
}

export function buildJpegSettings(args: {
  globalJpeg: CodecSettingsJpeg
  fileOverride?: Partial<CodecSettingsJpeg>
}): JpegEncodeSettings {
  const merged = { ...args.globalJpeg, ...args.fileOverride }
  return {
    quality: merged.quality,
    progressive: merged.progressive,
  }
}
```

Per-file override merge pattern is the responsibility of the config builder (not the adapter). Resolution order: `fileOverride ?? globalSlice`.

---

### `src/components/panels/PngPanel.tsx`, `JpegPanel.tsx`, `WebpPanel.tsx`, `AvifPanel.tsx` (component, request-response)

**Analog:** `src/components/panels/SvgoPanel.tsx`

**Imports pattern** (SvgoPanel.tsx lines 16–18):
```typescript
import { Section } from '@/components/ui/Section';
import { Toggle } from '@/components/ui/Toggle';
// For sliders, also import:
// import { Slider } from '@radix-ui/react-slider'  (already in package.json)
```

**Props pattern** (SvgoPanel.tsx lines 46–60):
```typescript
// Each raster panel receives resolved (merged global+override) settings
// and a setter that writes ONLY to the perFile slice (not the global slice).
interface JpegPanelProps {
  settings: CodecSettingsJpeg
  onChange: (patch: Partial<CodecSettingsJpeg>) => void
}

export function JpegPanel({ settings, onChange }: JpegPanelProps) {
  // ...
}
```

**Section + Toggle pattern** (SvgoPanel.tsx lines 152–176):
```typescript
// Use Section component for each logical group; Toggle for booleans
<Section title="Quality" badge={{ text: String(settings.quality), acc: true }}>
  {/* Radix Slider for quality 0–100 */}
</Section>
<Section title="Encoding">
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
    <span style={{ fontSize: 11.5, color: 'var(--fg-2)', flex: 1 }}>Progressive</span>
    <Toggle value={settings.progressive} onChange={(v) => onChange({ progressive: v })} />
  </div>
</Section>
```

**ARIA / keyboard pattern** (SvgoPanel.tsx lines 108–115) — for interactive controls:
```typescript
role="button"
aria-pressed={value}
aria-label="Progressive JPEG encoding"
tabIndex={0}
onKeyDown={(e) => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
}}
```

**Format indicator pill** — add at top of each panel, auto-detected from FileEntry.format:
```typescript
// Use existing .pill.acc CSS class from the app's style system
<span className="pill acc" style={{ fontSize: 10, textTransform: 'uppercase' }}>
  {format}
</span>
```

---

### `src/workers/worker.ts` (upgrade — replace throw stubs)

**Analog:** self — current file lines 16–38

**Current stub pattern** (worker.ts lines 29–37):
```typescript
jpeg: () => {
  throw new Error('jpeg adapter not yet implemented (Phase 5)')
},
```

**Replacement pattern** — static literal paths, Vite can statically analyze:
```typescript
const ADAPTERS: Record<AdapterFormat, () => Promise<{ run: ... }>> = {
  stub: () => import('./stub-adapter'),
  svg:  () => import('./svg-adapter'),
  png:  () => import('./png-adapter'),
  jpeg: () => import('./jpeg-adapter'),   // static path — Vite code-splits
  webp: () => import('./webp-adapter'),
  avif: () => import('./avif-adapter'),   // separate chunk — SC-5 lazy-load
}
```

**DO NOT use template literals** — `import(\`./\${format}-adapter\`)` causes 404 in prod (verified: worker.ts comment lines 14–16).

**Zero-copy transfer** (worker.ts line 45):
```typescript
return Comlink.transfer({ output, meta }, [output])
```

---

### `src/stores/settings.ts` (extend — add perFile slice)

**Analog:** self — existing `snippetTogglesByFileId` pattern (lines 51, 89–98)

**Pattern to copy for perFile slice** (settings.ts lines 51, 89–98):
```typescript
// Existing pattern (reference):
snippetTogglesByFileId: Record<string, Record<string, boolean>>
setSnippetToggle: (fileId: string, snippetId: string, value: boolean) =>
  set((s) => ({
    snippetTogglesByFileId: {
      ...s.snippetTogglesByFileId,
      [fileId]: { ...s.snippetTogglesByFileId[fileId], [snippetId]: value },
    },
  })),

// New perFile slice follows same shape:
perFile: Record<string, Partial<CodecSettings>>   // keyed by FileEntry.id
setPerFileCodec: (fileId: string, patch: Partial<CodecSettings>) => void
clearPerFile: (fileId: string) => void
```

**Existing format-slice setter pattern** (settings.ts lines 83–86):
```typescript
setPng: (next) => set((s) => ({ png: { ...s.png, ...next } })),
setJpeg: (next) => set((s) => ({ jpeg: { ...s.jpeg, ...next } })),
// perFile setter follows same spread-merge pattern
```

**CRITICAL:** Codec panel components MUST call `setPerFileCodec(fileId, patch)`, NOT `setJpeg(patch)` / `setPng(patch)`. Writing to global slice triggers full-batch re-optimize (Pitfall 4 in RESEARCH.md).

---

### `src/stores/files.ts` (extend — add targetDensities, mark dead code)

**Analog:** self — existing `setSourceDensity` action pattern (lines 130–135)

**Pattern for new setTargetDensities action** (files.ts lines 130–135):
```typescript
// Existing analog:
setSourceDensity: (fileId, sourceDensity) =>
  set((s) => {
    const prev = s.byId[fileId]
    if (!prev) return {}
    return { byId: { ...s.byId, [fileId]: { ...prev, sourceDensity } } }
  }),

// New action follows same shape:
setTargetDensities: (fileId, targetDensities) =>
  set((s) => {
    const prev = s.byId[fileId]
    if (!prev) return {}
    return { byId: { ...s.byId, [fileId]: { ...prev, targetDensities } } }
  }),
```

**Dead code marking pattern for addSourceWithVariants / removeFamily** — add JSDoc deprecation marker:
```typescript
/** @deprecated Phase 5 D-11: superseded by single-FileEntry model.
 *  Call addFile() instead. Do not remove until Playwright specs are updated.
 *  See 05-CONTEXT.md D-11. */
addSourceWithVariants: async (args) => { ... }
```

---

### `src/components/panels/InspectorPane.tsx` (restructure — Codec|Snippets tabs)

**Analog:** self — existing tab pattern (lines 12, 25–26, 84–96)

**Current tab type** (line 12):
```typescript
type Tab = 'codec' | 'svgo' | 'output' | 'report'
```

**Phase 5 replacement:**
```typescript
type Tab = 'codec' | 'snippets'
```

**Current tab render pattern** (lines 84–96) — replace format condition block:
```typescript
// Current: switches between 'svgo' / 'codec' by file.type
// Phase 5: single 'codec' tab, format-aware routing inside:

function CodecTabContent({ format }: { format: string | undefined }) {
  if (!format) return <p style={{ fontSize: 12, color: 'var(--fg-3)', padding: '16px 12px' }}>Select a file to see codec settings.</p>
  if (format === 'svg')  return <SvgoPanel ... />
  if (format === 'png')  return <PngPanel ... />
  if (format === 'jpeg') return <JpegPanel ... />
  if (format === 'webp') return <WebpPanel ... />
  if (format === 'avif') return <AvifPanel ... />
  return null
}
```

**Tab button pattern** (lines 84–91) — reduce to two tabs:
```typescript
<div className="tabs" role="tablist" aria-label="Inspector">
  <button role="tab" aria-selected={tab === 'codec'} aria-controls="inspector-panel"
    id="inspector-tab-codec" className={tab === 'codec' ? 'on' : ''}
    onClick={() => setTab('codec')}>Codec</button>
  <button role="tab" aria-selected={tab === 'snippets'} aria-controls="inspector-panel"
    id="inspector-tab-snippets" className={tab === 'snippets' ? 'on' : ''}
    onClick={() => setTab('snippets')}>Snippets</button>
</div>
```

**selectedEntry access pattern** — read from filesStore directly (lines 36–37):
```typescript
const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)
const format = selectedEntry?.format
```

---

### `src/components/panels/CenterPane.tsx` (upgrade — real FileEntry, clean delta strip)

**Analog:** self — blob URL lifecycle (lines 23–30) is already correct; do not modify.

**Blob URL lifecycle pattern** (lines 23–30) — keep exactly as-is:
```typescript
const [previewUrls, setPreviewUrls] = useState<{ orig: string | null; opt: string | null }>({ orig: null, opt: null })
useEffect(() => {
  if (!selectedEntry) { setPreviewUrls({ orig: null, opt: null }); return }
  const origUrl = URL.createObjectURL(selectedEntry.sourceBlob)
  const optUrl = selectedEntry.optimizedBlob ? URL.createObjectURL(selectedEntry.optimizedBlob) : null
  setPreviewUrls({ orig: origUrl, opt: optUrl })
  return () => { URL.revokeObjectURL(origUrl); if (optUrl) URL.revokeObjectURL(optUrl) }
}, [selectedEntry?.id, selectedEntry?.sourceBlob, selectedEntry?.optimizedBlob])
```

**Props change** — replace `file: MockFile` with:
```typescript
// Remove: file prop entirely
// CenterPane reads selectedEntry directly from useFilesStore (already wired line 21)
// If no selectedEntry, render empty state (current behavior — D-07)
```

**Delta strip cleanup** (lines 78–86) — remove SSIM/Butteraugli/Decode rows, wire real sizes:
```typescript
// Remove these three delta rows (lines 83–85 — all hardcoded mocks per D-08):
// <div className="delta"><span className="l">SSIM</span>...
// <div className="delta"><span className="l">Butteraugli</span>...
// <div className="delta"><span className="l">Decode</span>...

// Keep and wire these three to real FileEntry data:
const origSize = selectedEntry?.sourceBlob.size ?? 0
const optSize  = selectedEntry?.optimizedBlob?.size ?? origSize
<div className="delta"><span className="l">Original</span><span className="v">{fmtBytes(origSize)}</span></div>
<div className="delta"><span className="l">Optimized</span><span className="v">{fmtBytes(optSize)}</span></div>
<div className="delta savings"><span className="l">Saved</span><span className="v">−{fmtBytes(origSize - optSize)}</span><span className="sub">{fmtPct(origSize, optSize)} smaller</span></div>
```

---

### `src/hooks/useBatchOrchestrate.ts` (extend — per-file override merge)

**Analog:** `src/stores/runtime.ts` enqueuePreview (lines 258–299)

**enqueuePreview reads settings** (runtime.ts lines 280–290):
```typescript
const fileEntry = useFilesStore.getState().byId[fileId]
if (!fileEntry || fileEntry.format !== 'svg' || !fileEntry.sourceBlob) return

const svgSettings = useSettingsStore.getState().svg
const job: PoolJob = {
  id: jobId,
  fileId,
  format: 'svg',
  settings: svgSettings,
  blob: fileEntry.sourceBlob,
}
```

**Phase 5 format-aware extension** — add raster branch with per-file override merge:
```typescript
// Replace format-specific hardcoding with format-aware dispatch:
const format = fileEntry.format
const globalSettings = useSettingsStore.getState()[format]   // svg | png | jpeg | webp | avif
const perFileOverride = useSettingsStore.getState().perFile[fileId] ?? {}
const mergedSettings = { ...globalSettings, ...perFileOverride }

const job: PoolJob = {
  id: jobId,
  fileId,
  format,
  settings: mergedSettings,
  blob: fileEntry.sourceBlob,
}
```

**preview- prefix pattern** (runtime.ts line 277) — raster preview jobs must use same prefix:
```typescript
const jobId = `preview-${crypto.randomUUID()}`
// This prefix is recognized by isAuxiliaryJob (useBatchOrchestrate.ts) to
// skip batch progress counting. Verify isAuxiliaryJob includes 'preview-' prefix.
```

---

## Shared Patterns

### AdapterError (all adapter files)
**Source:** `src/workers/types.ts` lines 55–64
**Apply to:** `jpeg-adapter.ts`, `webp-adapter.ts`, `avif-adapter.ts`, upgraded `png-adapter.ts`
```typescript
throw new AdapterError('jpeg', 'decode', err instanceof Error ? err.message : String(err))
throw new AdapterError('jpeg', 'encode', err instanceof Error ? err.message : String(err))
```

### Comlink.transfer zero-copy (all adapters)
**Source:** `src/workers/worker.ts` line 45
**Apply to:** All adapter `run()` return sites (no change needed — the return goes through `runJob` in worker.ts which wraps with `Comlink.transfer`)
```typescript
return Comlink.transfer({ output, meta }, [output])
```

### Zustand subscribeWithSelector pattern (all stores)
**Source:** `src/stores/settings.ts` line 71, `src/stores/files.ts` line 65
**Apply to:** Any new Zustand store slice (not a new store — extend existing)
```typescript
export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector((set) => ({ ... })),
)
```

### Section + Toggle UI primitives (all codec panel components)
**Source:** `src/components/panels/SvgoPanel.tsx` lines 16–17, 152–176
**Apply to:** `PngPanel.tsx`, `JpegPanel.tsx`, `WebpPanel.tsx`, `AvifPanel.tsx`
```typescript
import { Section } from '@/components/ui/Section';
import { Toggle } from '@/components/ui/Toggle';
```

### fmtBytes / fmtPct (CenterPane delta strip)
**Source:** `src/components/panels/CenterPane.tsx` line 4 (already imported)
**Apply to:** Delta strip real-size wiring (no new import needed)
```typescript
import { fmtBytes, fmtPct } from '@/lib/format'
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/icc.ts` | utility | transform | No ICC chunk parsing exists in the codebase. PNG iCCP + JPEG APP2 byte-level surgery is net-new. RESEARCH.md §ICC Preservation section has the byte-level structure; no npm dependency — pure ArrayBuffer/DataView operations. |

---

## Metadata

**Analog search scope:** `src/workers/`, `src/stores/`, `src/components/panels/`, `src/hooks/`
**Files read for pattern extraction:** 11 (png-adapter, svg-adapter, worker, SvgoPanel, InspectorPane, CenterPane, settings store, files store, runtime store excerpt, png-config, types)
**Pattern extraction date:** 2026-05-07
