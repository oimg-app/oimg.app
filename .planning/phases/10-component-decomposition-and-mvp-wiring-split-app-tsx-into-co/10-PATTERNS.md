# Phase 10: Component Decomposition and MVP Wiring — Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/panels/FilePanel/FilePanel.tsx` | component | CRUD + event-driven | `src/components/shell/AppShell/AppShell.tsx` | role-match (co-location pattern) |
| `src/components/panels/FilePanel/FilePanel.module.css` | config | — | `src/components/shell/AppShell/appShell.module.css` | exact |
| `src/hooks/useBatchOrchestrate.ts` | hook | event-driven + request-response | `src/stores/runtime.ts` `enqueuePreview` + `src/App.tsx` lines 296–810 | partial-match (logic extraction) |
| `src/hooks/useFilePicker.ts` | hook | file-I/O | `src/App.tsx` lines 177–215 (`formatFromFile`, `ingestDroppedFiles`) | exact (direct extraction) |
| `src/stores/settings.ts` (modify) | store | CRUD | `src/stores/settings.ts` lines 31–86 (existing slice pattern) | exact |
| `src/App.tsx` (modify — slim down) | component | request-response | `src/components/shell/AppShell/AppShell.tsx` | role-match (thin composition root) |

---

## Pattern Assignments

### `src/components/panels/FilePanel/FilePanel.tsx` (component, CRUD + event-driven)

**Analog:** `src/components/shell/AppShell/AppShell.tsx`

**Co-location + imports pattern** (`AppShell.tsx` lines 1–9):
```typescript
// ComponentName/ComponentName.tsx + ComponentName/ComponentName.module.css
import type { ReactNode } from 'react'
import s from './appShell.module.css'  // import from co-located .module.css
```

**Props shape pattern** (`AppShell.tsx` lines 11–17):
```typescript
interface AppShellProps {
  titleBar: ReactNode
  toolbar: ReactNode
  workArea: ReactNode
  statusBar: ReactNode
  overlays?: ReactNode
}
```
FilePanel's equivalent (from D-02):
```typescript
interface FilePanelProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onOptimize: () => void
  onCancel: () => void
}
```

**Narrow store selector pattern** (`App.tsx` lines 523–524):
```typescript
const filesById = useFilesStore((s) => s.byId)
const filesOrder = useFilesStore((s) => s.order)
// One selector per field — never select the whole store object
```

**Internal state (FilePanel-local UI only)** (`App.tsx` lines 233–235, 259–260):
```typescript
const [open, setOpen] = useState<string | null>(null)
const [rowMenu, setRowMenu] = useState<string | null>(null)
const [filterQuery, setFilterQuery] = useState<string>('')
const [sortBy, setSortBy] = useState<string>('queue order')
```

**PLACEHOLDER_FILE + SHELL_FILES pattern** (`App.tsx` lines 525–576 — moves INTO FilePanel per D-14):
```typescript
const PLACEHOLDER_FILE: MockFile = { id: 'placeholder', name: 'No file selected', ... }
const SHELL_FILES: MockFile[] = useMemo(() => {
  return filesOrder.flatMap((id) => {
    const entry = filesById[id]
    if (!entry) return []  // WR-02: stale-id guard
    ...
  })
}, [filesById, filesOrder])

const filteredFiles = useMemo(() => {
  const fq = filterQuery.trim().toLowerCase()
  if (!fq) return SHELL_FILES
  return SHELL_FILES.filter((f) => f.name.toLowerCase().includes(fq))
}, [SHELL_FILES, filterQuery])
```

**getState() in event handlers** (`App.tsx` lines 225–227):
```typescript
// Use getState() for write paths (event handlers), selectors only in render
const setSelectedId = (id: string) => useFilesStore.getState().setSelected(id)
```

**fileInputRef for hidden input** (`App.tsx` lines 589, 822–824):
```typescript
const fileInputRef = useRef<HTMLInputElement | null>(null)
// Delegated from onToolbarChange:
fileInputRef.current?.click()
```
After Phase 10, the hidden `<input ref={fileInputRef}>` mounts inside FilePanel alongside the dropzone; FilePanel calls `useFilePicker` which owns this ref.

---

### `src/components/panels/FilePanel/FilePanel.module.css` (config)

**Analog:** `src/components/shell/AppShell/appShell.module.css`

Pattern: CSS Module filename lowercased first letter (`appShell.module.css` not `AppShell.module.css`). Component imports via `import s from './filePanel.module.css'` and references via `s.className`.

---

### `src/hooks/useBatchOrchestrate.ts` (hook, event-driven + request-response)

**Analog:** `src/App.tsx` lines 296–810 + `src/stores/runtime.ts` `enqueuePreview`

**Pool singleton init pattern** (`App.tsx` lines 311–341):
```typescript
const pool = useMemo(() => getWorkerPool({
  onStarted: (jobId) => {
    if (isAuxiliaryJob(jobId)) return  // prefix discrimination
    useRuntimeStore.getState().markStarted(jobId)
  },
  onDone: (jobId) => {
    if (isAuxiliaryJob(jobId)) return
    useRuntimeStore.getState().markDone(jobId)
  },
  onError: (jobId, err) => {
    if (isAuxiliaryJob(jobId)) return
    const msg = err instanceof Error ? err.message : String(err)
    useRuntimeStore.getState().markError(jobId, msg)
  },
  onThrottle: () => {
    const r = useRuntimeStore.getState()
    const wasFired = r.throttleToastFiredThisBatch
    r.markThrottle()
    if (!wasFired) {
      toast.info('Pacing batch for memory', { description: '...' })
    }
  },
}), [])

// Auxiliary-job prefix discrimination (must preserve):
const isAuxiliaryJob = (jobId: string) =>
  jobId.startsWith('preview-') || jobId.startsWith('savings-')
```

**Batch-completion subscriber** (`App.tsx` lines 380–450):
```typescript
useEffect(() => {
  const unsub = useRuntimeStore.subscribe(
    (s) => ({ doneCount: s.doneCount, errorCount: s.errorCount, totalJobs: s.totalJobs, running: s.running }),
    (curr, prev) => {
      if (curr.doneCount !== prev.doneCount && ...) {
        if (isQuartileBoundary(curr.doneCount, curr.totalJobs)) {
          announce(`${curr.doneCount} of ${curr.totalJobs} files complete`)
        }
      }
      if (prev.running && !curr.running && curr.totalJobs > 0) {
        useRuntimeStore.getState().setThrottleActive(false)
        const finished = curr.doneCount + curr.errorCount === curr.totalJobs
        if (!finished) return
        // ... toast + announce
        // queueMicrotask before reading file state (Plan 03-D fix — Rule 1):
        queueMicrotask(() => {
          const filesNow = useFilesStore.getState()
          const completedSvgIds = filesNow.order.filter((id) => {
            const f = filesNow.byId[id]
            return f && f.format === 'svg' && f.status === 'done' && f.optimizedBlob
          })
          if (completedSvgIds.length > 0) {
            void computePluginSavings(completedSvgIds)
          }
        })
      }
    },
  )
  return unsub
}, [])
```

**cancelBatch pattern** (`App.tsx` lines 803–809):
```typescript
const cancelBatch = () => {
  const inFlightCount = useRuntimeStore.getState().inFlight.size
  pool.cancel()                           // pool FIRST (trips AbortController)
  useRuntimeStore.getState().cancelBatch() // store SECOND
  announce('Batch canceled')
  toast(`Batch canceled`, { description: `${inFlightCount} files were processing` })
}
```

**startOptimize pattern** (`App.tsx` lines 650–795):
```typescript
const startOptimize = () => {
  const filesState = useFilesStore.getState()
  const fileIds = filesState.order.filter((id) => {
    const f = filesState.byId[id]
    return f && (f.status === 'idle' || f.status === 'queued' || f.status === 'error')
  })
  if (fileIds.length === 0) return
  useRuntimeStore.getState().startBatch(fileIds)
  announce(`Optimizing ${fileIds.length} files`)
  for (const fileId of fileIds) {
    // ... build PoolJob, route SVG/PNG/stub by adapterFormat
    pool.enqueue(job)
      .then(async (result) => {
        if (!useFilesStore.getState().byId[fileId]) return // eviction guard
        // isSvg: TextDecoder → sanitizeSvg → markDone
        // hasPngFanoutShape: Blob → markDone
        // stub: Blob → markDone
      })
      .catch((err) => {
        const isAbort = err instanceof DOMException && err.name === 'AbortError'
        if (isAbort) return
        useFilesStore.getState().setStatus(fileId, 'error')
      })
  }
}
```

**computePluginSavings** (`App.tsx` lines 79–171) — stays private to `useBatchOrchestrate.ts` per D-05:
```typescript
const SAVINGS_TIMEOUT_MS = 5000
async function computePluginSavings(fileIds: string[]): Promise<void> {
  // ... 5s wall-time cap via Promise.race([...savingsPromise, timeoutPromise])
  // Job ids carry 'savings-' prefix → isAuxiliaryJob() skips runtime bookkeeping
  // WR-08: check timedOut BEFORE enqueuing AND after each await inside .map()
}
```

**Return shape** (D-05):
```typescript
return { startOptimize, cancelBatch, running }
```

---

### `src/hooks/useFilePicker.ts` (hook, file-I/O)

**Analog:** `src/App.tsx` lines 177–215 + lines 586–590 (direct extraction)

**formatFromFile helper** (`App.tsx` lines 177–186):
```typescript
function formatFromFile(f: File): FormatId | null {
  const mime = (f.type || '').toLowerCase()
  const ext = (f.name.toLowerCase().split('.').pop() ?? '')
  if (mime === 'image/png' || ext === 'png') return 'png'
  if (mime === 'image/svg+xml' || ext === 'svg') return 'svg'
  if (mime === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (mime === 'image/webp' || ext === 'webp') return 'webp'
  if (mime === 'image/avif' || ext === 'avif') return 'avif'
  return null
}
```

**ingestDroppedFiles helper** (`App.tsx` lines 188–215):
```typescript
async function ingestDroppedFiles(files: FileList | File[]): Promise<void> {
  const list = Array.from(files)
  let skipped = 0
  let skippedNames: string[] = []
  for (const f of list) {
    const format = formatFromFile(f)
    if (!format) { skipped++; if (skippedNames.length < 3) skippedNames.push(f.name); continue }
    await useFilesStore.getState().addSourceWithVariants({
      sourceBlob: f, sourceDensity: '1x', name: f.name, format, targets: ['1x'],
    })
  }
  if (skipped > 0) {
    toast.info(`${skipped} unsupported file${skipped === 1 ? '' : 's'} skipped (${skippedNames.join(', ')}${tail})`)
  }
}
```

**fileInputRef and pick trigger** (`App.tsx` lines 589, 822–824):
```typescript
const fileInputRef = useRef<HTMLInputElement | null>(null)
// handleFilePick: fileInputRef.current?.click()
// hidden input onChange: (e) => { if (e.target.files) ingestDroppedFiles(e.target.files) }
```

**Return shape** (D-06):
```typescript
return { fileInputRef, handleFilePick, handleDrop, handleDragOver, handleDragLeave }
```

---

### `src/stores/settings.ts` — add `codec` slice (modify)

**Analog:** `src/stores/settings.ts` lines 31–86 (existing codec slice pattern)

**Existing slice shape to mirror** (`settings.ts` lines 31–55):
```typescript
interface SettingsState {
  svg: CodecSettingsSvg
  png: CodecSettingsPng
  // ... one field per codec
  resize: { alg: ResizeAlg }  // ← shape pattern for the new `codec` slice

  setSvg: (next: Partial<CodecSettingsSvg>) => void
  // ... one setter per slice
  setResize: (next: Partial<{ alg: ResizeAlg }>) => void
}
```

**New `codec` slice to add** (D-09):
```typescript
// Add to interface SettingsState:
codec: CodecSettings  // { label: CodecLabel; quality: number; method: number; lossless: boolean }
setCodec: (patch: Partial<CodecSettings>) => void
```

**New type to add to `src/types/index.ts`**:
```typescript
export interface CodecSettings {
  label: CodecLabel   // default: 'WebP'
  quality: number     // default: 82
  method: number      // default: 4
  lossless: boolean   // default: false
}
```

**Store action pattern** (`settings.ts` lines 68–84):
```typescript
setSvg: (next) => set((s) => ({ svg: { ...s.svg, ...next } })),
// ... same spread-merge pattern for every setter:
setCodec: (patch) => set((s) => ({ codec: { ...s.codec, ...patch } })),
```

**Default constant** — add to `src/data/defaults.ts` following the existing pattern:
```typescript
export const DEFAULT_CODEC_SETTINGS: CodecSettings = {
  label: 'WebP',
  quality: 82,
  method: 4,
  lossless: false,
}
```

**setCodecFromMenu migration** (D-12): after D-09, `setCodecFromMenu` in App.tsx changes from:
```typescript
setCodec(c)  // local useState
```
to:
```typescript
useSettingsStore.getState().setCodec({ label: c })  // getState() in event handler
```

---

### `src/App.tsx` (modify — slim to ≤ 300 lines)

**Analog:** `src/components/shell/AppShell/AppShell.tsx` (thin composition root)

**Pattern: imports only what it assembles** (`AppShell.tsx` lines 8–9):
```typescript
import type { ReactNode } from 'react'
import s from './appShell.module.css'
// No business logic — only slot assembly
```

**App.tsx residual shape** (D-13): imports + hook calls + thin JSX:
```typescript
export default function App() {
  const { theme, setTheme } = useTheme()
  const { startOptimize, cancelBatch, running } = useBatchOrchestrate({ setCmdkOpen })
  // narrow store selectors (view-routing UI state stays in App):
  const [tab, setTab] = useState<Tab>('codec')
  const [split, setSplit] = useState<number>(50)
  const [view, setView] = useState<View>('Batch')
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)
  // previewUrls stays (D-08):
  const selectedEntry = useFilesStore((s) => s.selectedId ? s.byId[s.selectedId] : undefined)
  const [previewUrls, setPreviewUrls] = useState<{ orig: string | null; opt: string | null }>({ orig: null, opt: null })
  useEffect(() => { /* create/revoke object URLs for compare stage */ }, [selectedEntry?.id, ...])
  // totals stays (D-15):
  const totals = useMemo(() => { /* orig/opt/saved/pct from store */ }, [filesById, filesOrder])
  // cmdGroups wired to real actions (D-13):
  const cmdGroups: CmdGroup[] = [...]
  return (
    <AppShell
      titleBar={<TitleBar ... />}
      toolbar={<Toolbar ... />}
      workArea={
        <main className="work">
          <FilePanel selectedId={selectedId} onSelect={setSelectedId} onOptimize={startOptimize} onCancel={cancelBatch} />
          {/* right pane panels unchanged */}
        </main>
      }
      statusBar={<StatusBar running={running} {...totals} ... />}
      overlays={<><CommandPalette ... /><Toaster /></>}
    />
  )
}
```

---

## Shared Patterns

### Zustand store selectors (narrow — one per field)
**Source:** `src/App.tsx` lines 225–226, 258, 266–267; `src/stores/files.ts` lines 65–66
**Apply to:** FilePanel, useBatchOrchestrate, useFilePicker, App.tsx residual
```typescript
// Render path: selector per field
const filesById = useFilesStore((s) => s.byId)
const running = useRuntimeStore((s) => s.running)
// Write path: getState() in event handlers / hooks
useFilesStore.getState().setSelected(id)
useRuntimeStore.getState().startBatch(fileIds)
```

### subscribeWithSelector for cross-store subscriptions
**Source:** `src/App.tsx` lines 381–449; `src/stores/runtime.ts` lines 102–103
**Apply to:** `useBatchOrchestrate` (batch-completion subscriber, rename-toast subscriber)
```typescript
const unsub = useRuntimeStore.subscribe(
  (s) => ({ doneCount: s.doneCount, running: s.running, totalJobs: s.totalJobs, errorCount: s.errorCount }),
  (curr, prev) => { /* react to transitions */ },
)
return unsub  // cleanup in useEffect return
```

### Auxiliary-job prefix discrimination
**Source:** `src/App.tsx` lines 309–310
**Apply to:** `useBatchOrchestrate` pool callbacks
```typescript
const isAuxiliaryJob = (jobId: string) =>
  jobId.startsWith('preview-') || jobId.startsWith('savings-')
```

### queueMicrotask before reading file state post-batch
**Source:** `src/App.tsx` lines 436–445 (Plan 03-D fix)
**Apply to:** `useBatchOrchestrate` batch-completion subscriber
```typescript
queueMicrotask(() => {
  const filesNow = useFilesStore.getState()
  const completedSvgIds = filesNow.order.filter((id) => {
    const f = filesNow.byId[id]
    return f && f.format === 'svg' && f.status === 'done' && f.optimizedBlob
  })
  if (completedSvgIds.length > 0) void computePluginSavings(completedSvgIds)
})
```

### sonner toast pattern
**Source:** `src/App.tsx` lines 290–294
**Apply to:** useBatchOrchestrate, useFilePicker
```typescript
import { toast } from 'sonner'
toast.success('...')
toast.info('...', { description: '...' })
toast.error('...')
toast.promise(promise, { loading: '...', success: '...', error: '...' })
```

### CSS Module co-location
**Source:** `src/components/shell/AppShell/appShell.module.css` (filename lowercase-first)
**Apply to:** `FilePanel.module.css`
```typescript
// import as `s` aliasing the module
import s from './filePanel.module.css'
// usage: className={s.pane}
```

---

## No Analog Found

None — all Phase 10 files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/App.tsx`, `src/components/shell/`, `src/hooks/`, `src/stores/`, `src/workers/pool.ts`, `src/types/index.ts`, `src/data/defaults.ts`
**Files scanned:** 10
**Pattern extraction date:** 2026-05-06
