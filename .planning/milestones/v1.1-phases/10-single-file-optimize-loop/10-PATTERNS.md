# Phase 10: Single-File Optimize Loop - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 9 (3 new, 6 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/useIngest.ts` | hook | file-I/O + event-driven | `src/hooks/useOptimize.ts` | role-match (same hook layer, same store dispatch) |
| `src/stores/files.ts` | store | CRUD | itself (modify existing) | self |
| `src/lib/stub-data.ts` | utility/model | transform | itself (modify existing) | self |
| `src/components/panels/FilesPane.tsx` | component | event-driven | `src/components/shell/Toolbar.tsx` | role-match (same event-to-store-action pattern) |
| `src/components/shell/Toolbar.tsx` | component | request-response | itself (modify existing) | self |
| `src/tests/fixtures/ingest-helper.ts` | test fixture | batch | `src/tests/per-file-settings.spec.ts` (page.evaluate inject) | exact (same store-injection pattern) |
| `src/tests/ingest.spec.ts` | test | event-driven | `src/tests/inspector-tabs.spec.ts` | role-match (same goto + evaluate structure) |
| `src/tests/inspector-tabs.spec.ts` | test (update) | event-driven | itself | self |
| `src/tests/per-file-settings.spec.ts` | test (update) | CRUD | itself | self |

---

## Pattern Assignments

### `src/hooks/useIngest.ts` (hook, file-I/O + event-driven) — NEW

**Analog:** `src/hooks/useOptimize.ts`

**Imports pattern** (`src/hooks/useOptimize.ts` lines 1–8):
```typescript
import { useStore } from '@nanostores/react'
import { filesAtom, setFileResult, setFileError, setFileRawBuffer } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { getPool } from '@/lib/worker-pool'
import { toast } from 'sonner'
import type { EncodeJob } from '@/workers/codec.worker'
```

**useIngest imports pattern** (copy shape, adjust imports):
```typescript
import { filesAtom, setFileRawBuffer, selectFile } from '@/stores/files'
import { defaultFileSettings } from '@/lib/settings'
import { useOptimize } from '@/hooks/useOptimize'
import type { FileEntry } from '@/lib/settings'
```

**Core format-gate pattern** (`src/hooks/useOptimize.ts` lines 64–74 — `toCodec`/`toSourceFormat` guards):
```typescript
const ACCEPTED_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'avif'])
const ACCEPTED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif'])

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function isAccepted(file: File): boolean {
  const ext = getExt(file.name)
  return ACCEPTED_EXTS.has(ext) || ACCEPTED_MIMES.has(file.type)
}
```

**File→FileEntry mapping pattern** (mirrors `useOptimize.ts` lines 90–98 EncodeJob build; applies to new entry build):
```typescript
async function fileToEntry(file: File): Promise<FileEntry> {
  const id = crypto.randomUUID()
  const ext = getExt(file.name)
  const type = ext === 'jpg' ? 'jpg' : ext
  const rawBuffer = await file.arrayBuffer()
  const dim = await readDimensions(file, type)
  return {
    id,
    name: file.name,
    type,
    orig: file.size,       // D-08: truthful File.size
    opt: file.size,        // pending — setFileResult overwrites
    status: 'queued',
    target: type,
    dim,
    q: 82,
    createdAt: Date.now(), // Pitfall 2: required for queue-order sort after D-04
    settings: defaultFileSettings(type, 82),
    rawBuffer,
  }
}
```

**Dimension reading pattern** (SVG short-circuit + try/catch from RESEARCH.md §Pattern 4):
```typescript
async function readDimensions(file: File, type: string): Promise<string> {
  if (type === 'svg') return '—'
  try {
    const bitmap = await createImageBitmap(file)
    const dim = `${bitmap.width}×${bitmap.height}`
    bitmap.close()
    return dim
  } catch {
    return '—'
  }
}
```

**Core ingest dispatch pattern** (analog: `useOptimize.ts` lines 54–119 — append + iterate):
```typescript
export function useIngest() {
  const { runOptimize } = useOptimize()

  async function ingest(files: File[]): Promise<void> {
    const accepted = files.filter(isAccepted)  // D-06/D-07: silent skip
    if (accepted.length === 0) return

    const entries = await Promise.all(accepted.map(fileToEntry))

    // Append to store (setKey replaces full array; preserves insertion order)
    filesAtom.setKey('entries', [...filesAtom.get().entries, ...entries])
    // D-02: auto-select newest
    selectFile(entries[entries.length - 1].id)
    // Cache rawBuffers (useOptimize reads entry.rawBuffer)
    for (const entry of entries) {
      if (entry.rawBuffer) setFileRawBuffer(entry.id, entry.rawBuffer)
    }
    // D-03: auto-optimize all — runOptimize iterates filesAtom.get().entries
    await runOptimize()
  }

  async function openPicker(): Promise<void> {
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({ multiple: true })
        const files = await Promise.all(handles.map((h: FileSystemFileHandle) => h.getFile()))
        await ingest(files)
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') throw err
        // Pitfall 4: user cancelled — swallow AbortError
      }
    } else {
      inputRef.current?.click()  // Fallback: hidden <input type="file">
    }
  }

  return { ingest, openPicker }
}
```

**No error toast on format rejection** (D-07): `isAccepted` returns false and `ingest` returns early — no `toast.error`. Encode failures still use `toast.error` (Phase 9 D-13 path in `useOptimize.ts` lines 113–115).

---

### `src/stores/files.ts` (store, CRUD) — MODIFY

**Analog:** itself

**Seed removal pattern** (`src/stores/files.ts` lines 17–22 — replace STUB_FILES with `[]`):
```typescript
// BEFORE (Phase 9):
export const filesAtom = map<FilesState>({
  entries: STUB_FILES,
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})

// AFTER (Phase 10 — D-04):
export const filesAtom = map<FilesState>({
  entries: [],           // D-04: start empty; no seeded demos
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})
```

**queue-order sort fix** (`src/stores/files.ts` lines 29–35 — replace STUB_FILES.findIndex with createdAt):
```typescript
// BEFORE:
case 'queue order':
  result = result.slice().sort((a, b) => {
    const ai = STUB_FILES.findIndex((f) => f.id === a.id)
    const bi = STUB_FILES.findIndex((f) => f.id === b.id)
    return ai - bi
  })

// AFTER (Pitfall 2: STUB_FILES.findIndex returns -1 for all real entries):
case 'queue order':
  result = result.slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
```

**updateEntry pattern** (`src/stores/files.ts` lines 104–108 — reuse for new store actions):
```typescript
function updateEntry(id: string, patch: (e: FileEntry) => Partial<FileEntry>): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, ...patch(e) } : e
  ))
}
```

**selectFile pattern** (`src/stores/files.ts` line 68–70 — already exists; exported for useIngest):
```typescript
export function selectFile(id: string): void {
  filesAtom.setKey('selectedId', id)
}
```

**addFromDevice stub replacement** (`src/stores/files.ts` lines 85–87 — convert stub to no-op or remove; picker trigger moves to useIngest):
```typescript
// Remove or keep as no-op — component layer calls useIngest().openPicker() directly
// Recommendation: keep stub signature but have component bypass it via hook
export function addFromDevice(): void {}  // no-op; useIngest.openPicker() is the real path
```

---

### `src/lib/stub-data.ts` (utility/model) — MODIFY

**Analog:** itself

**FileEntry interface — add `createdAt`** (`src/lib/stub-data.ts` lines 10–25 — add field):
```typescript
export interface FileEntry {
  id: string
  name: string
  type: string
  orig: number
  opt: number
  status: FileStatus
  target: string
  dim: string
  q: number | null
  createdAt?: number     // NEW: Date.now() at ingest; required for D-04 queue-order sort fix
  prog?: number
  settings?: FileSettings
  rawBuffer?: ArrayBuffer
  encodedBuffer?: ArrayBuffer
  error?: string
}
```

**STUB_FILES kept as test fixture** (lines 169–192 — retain but no longer seed `filesAtom`):
- `STUB_FILES` export stays in `stub-data.ts` for use by `ingest-helper.ts` test fixture
- `STUB_FILES_SEED` and `sampleBytesFor` stay; `b64ToArrayBuffer` stays (reused in fixture)
- `TINY_PNG_B64` constant (line 135) is directly referenced in the test fixture helper

**defaultFileSettings pattern** (`src/lib/stub-data.ts` lines 110–127 — unchanged; used by useIngest):
```typescript
export function defaultFileSettings(type: string, q: number | null): FileSettings {
  return {
    codec: codecForType(type),
    q: q ?? 82,
    method: 4,
    lossless: false,
    // ... full settings object
    plugins: SVGO_PLUGINS.map((p) => ({ ...p })),
    progressive: true,
  }
}
```

---

### `src/components/panels/FilesPane.tsx` (component, event-driven) — MODIFY

**Analog:** `src/components/shell/Toolbar.tsx` (event → store-action pattern)

**Drag-drop wiring pattern** (Toolbar.tsx lines 39–43 as button-click analog; dragover/drop from RESEARCH.md §Pattern 1):
```tsx
// Add to FilesPane root div:
const [dragActive, setDragActive] = useState(false)
const inputRef = useRef<HTMLInputElement>(null)
const { ingest, openPicker } = useIngest()

function handleDragOver(e: React.DragEvent) {
  e.preventDefault()    // Pitfall 3: required — enables drop
  e.stopPropagation()
  setDragActive(true)
}

function handleDragLeave(e: React.DragEvent) {
  // Pitfall 1: only clear when cursor leaves root (not a child element)
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    setDragActive(false)
  }
}

function handleDrop(e: React.DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  setDragActive(false)
  ingest(Array.from(e.dataTransfer.files))
}
```

**Root div with drag-active class pattern** (Toolbar.tsx lines 33–36 as structural analog):
```tsx
<div
  data-testid="files-pane"
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={cn(
    "h-full flex flex-col border-r border-[var(--line)] bg-[var(--bg-1)]",
    dragActive && "border-[var(--color-accent)] bg-[var(--bg-2)]"
  )}
>
```

**"Add files" button wiring** (`src/components/panels/FilesPane.tsx` lines 57–63 — replace TODO):
```tsx
<button
  className="w-[22px] h-[22px] grid place-items-center ..."
  aria-label="Add files"
  onClick={() => openPicker()}  // replaces @TODO
>
  <Plus size={13} />
</button>
{/* Hidden file input for fallback picker */}
<input
  ref={inputRef}
  type="file"
  multiple
  accept=".png,.jpg,.jpeg,.webp,.svg,.avif,image/png,image/jpeg,image/webp,image/svg+xml,image/avif"
  className="hidden"
  onChange={(e) => e.target.files && ingest(Array.from(e.target.files))}
/>
```

**Empty first-run state** (FilesPane.tsx lines 75–81 — add conditional empty state alongside file list):
```tsx
{files.length === 0 && (
  <div className="flex-1 flex items-center justify-center text-[var(--fg-2)] text-xs">
    Select a file
  </div>
)}
```

---

### `src/components/shell/Toolbar.tsx` (component, request-response) — MODIFY

**Analog:** itself

**"From device" button wiring** (`src/components/shell/Toolbar.tsx` lines 62–63 — replace `addFromDevice()` call):
```tsx
// BEFORE:
<button ... onClick={() => { addFromDevice(); setOpen(null) }}>From device</button>

// AFTER: openPicker comes from useIngest at top of component
const { openPicker } = useIngest()
<button ... onClick={() => { openPicker(); setOpen(null) }}>From device</button>
```

**"Add files" primary button** (`src/components/shell/Toolbar.tsx` lines 39–43):
```tsx
// BEFORE:
onClick={() => { addFromDevice(); setOpen(null) }}

// AFTER:
onClick={() => { openPicker(); setOpen(null) }}
```

---

### `src/tests/fixtures/ingest-helper.ts` (test fixture) — NEW

**Analog:** `src/tests/per-file-settings.spec.ts` lines 11–45 (page.evaluate store injection)

**Imports pattern** (per-file-settings.spec.ts lines 4, 11 — same framework):
```typescript
import type { Page } from '@playwright/test'
```

**Store injection pattern** (per-file-settings.spec.ts lines 11–45 — exact analog):
```typescript
export async function ingestFixtureFiles(page: Page, count = 1): Promise<void> {
  await page.evaluate(async (n) => {
    const { filesAtom, setFileRawBuffer, selectFile } = await import('/src/stores/files.ts')
    const { defaultFileSettings } = await import('/src/lib/stub-data.ts')
    // TINY_PNG_B64 from stub-data.ts lines 135-137 (reuse same base64)
    const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    function b64ToBuffer(b64: string): ArrayBuffer {
      const bin = atob(b64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      return buf.buffer as ArrayBuffer
    }
    const entries = Array.from({ length: n }, (_, i) => {
      const id = `fixture-${i}`
      const rawBuffer = b64ToBuffer(TINY_PNG_B64)
      return {
        id, name: `fixture-${i}.png`, type: 'png',
        orig: rawBuffer.byteLength, opt: rawBuffer.byteLength,
        status: 'done' as const, target: 'png', dim: '1×1',
        q: 82, createdAt: Date.now() + i,
        settings: defaultFileSettings('png', 82),
        rawBuffer,
      }
    })
    filesAtom.setKey('entries', entries)
    filesAtom.setKey('selectedId', entries[0].id)
    for (const e of entries) {
      if (e.rawBuffer) setFileRawBuffer(e.id, e.rawBuffer)
    }
  }, count)
}
```

---

### `src/tests/ingest.spec.ts` (test, event-driven) — NEW

**Analog:** `src/tests/inspector-tabs.spec.ts` (same goto + page.evaluate + getByTestId structure)

**Spec structure pattern** (inspector-tabs.spec.ts lines 1–9):
```typescript
import { test, expect } from '@playwright/test'

test.describe('ingest — OPT-01 SC-1/2/3 + D-04 + D-06/D-07', () => {
  test('D-04: app starts empty — no seeded demo files', async ({ page }) => {
    await page.goto('/')
    const count = await page.evaluate(async () => {
      const { filesAtom } = await import('/src/stores/files.ts')
      return filesAtom.get().entries.length
    })
    expect(count).toBe(0)
  })

  test('OPT-01 SC-1: drop a file → entry appears in queue', async ({ page }) => {
    // Use page.setInputFiles on the hidden file input OR ingestFixtureFiles
  })
})
```

**page.evaluate store read pattern** (per-file-settings.spec.ts lines 33–44 — exact shape):
```typescript
const result = await page.evaluate(async () => {
  const { filesAtom } = await import('/src/stores/files.ts')
  return filesAtom.get().entries.length
})
```

---

### Existing tests — D-05 migration pattern

**Replace stub-file text selectors** (inspector-tabs.spec.ts lines 14–17 and per-file-settings.spec.ts line 109):

```typescript
// BEFORE (inspector-tabs.spec.ts line 14):
await page.getByText('hero-banner@2x.png').click()

// AFTER:
import { ingestFixtureFiles } from './fixtures/ingest-helper'
// At top of each test that needs files:
await ingestFixtureFiles(page, 1)
await page.getByText('fixture-0.png').click()
```

**Replace entries.length guard** (per-file-settings.spec.ts line 20):
```typescript
// BEFORE:
if (entries.length < 2) return { error: 'Need at least 2 entries' }

// AFTER (add ingestFixtureFiles(page, 2) before page.evaluate — guard still useful as safety):
// Call ingestFixtureFiles(page, 2) before evaluate; guard can remain as assertion
```

---

## Shared Patterns

### nanostores setKey pattern
**Source:** `src/stores/files.ts` lines 68–73
**Apply to:** All store mutations in `useIngest`, store seed removal
```typescript
filesAtom.setKey('entries', [...filesAtom.get().entries, ...newEntries])
filesAtom.setKey('selectedId', entries[entries.length - 1].id)
```

### updateEntry helper
**Source:** `src/stores/files.ts` lines 104–108
**Apply to:** Any new per-entry field additions (e.g., `status` transitions in `setFileResult`/`setFileError` if wired)
```typescript
function updateEntry(id: string, patch: (e: FileEntry) => Partial<FileEntry>): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id ? { ...e, ...patch(e) } : e
  ))
}
```

### rawBuffer slice(0) before dispatch
**Source:** `src/hooks/useOptimize.ts` line 93
**Apply to:** `useIngest` — store the original `rawBuffer` in the entry; `useOptimize` already slices before transfer
```typescript
buffer: rawBuffer.slice(0),  // copy so cached rawBuffer survives Comlink.transfer
```

### toast.error on encode failure only (NOT on format rejection)
**Source:** `src/hooks/useOptimize.ts` lines 113–115
**Apply to:** `useIngest` — D-07 silent skip has no toast; encode errors still toast via `useOptimize`
```typescript
toast.error('Encode failed: ' + name)  // only on pool rejection
```

### page.evaluate import pattern for tests
**Source:** `src/tests/per-file-settings.spec.ts` lines 12–14
**Apply to:** All D-05 test migrations and new `ingest.spec.ts`
```typescript
const { filesAtom } = await import('/src/stores/files.ts')
const { defaultFileSettings } = await import('/src/lib/stub-data.ts')
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Anti-Patterns (documented in RESEARCH.md — must NOT appear in plan actions)

| Anti-Pattern | Correct Pattern |
|---|---|
| Inline ingest logic in FilesPane/Toolbar | Logic in `useIngest` hook only |
| `dragenter` counter for drag-active state | `relatedTarget` check in `dragleave` (Pitfall 1) |
| Missing `e.preventDefault()` on dragover | Always `preventDefault()` on both `dragover` and `drop` (Pitfall 3) |
| Uncaught `showOpenFilePicker` AbortError | try/catch, ignore `AbortError` only (Pitfall 4) |
| `useLiveEncode` for ingest batch dispatch | `useOptimize().runOptimize()` for ingest (useLiveEncode is single-file, debounced) |
| `STUB_FILES.findIndex` in queue-order sort | Sort by `createdAt` (Pitfall 2) |
| `createImageBitmap` on SVG | Return `'—'` for SVG immediately (Pitfall 6) |

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/stores/`, `src/lib/`, `src/components/panels/`, `src/components/shell/`, `src/tests/`
**Files read:** 7 source files, 2 test specs
**Pattern extraction date:** 2026-05-28
