# Phase 02: Files Pane - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/files.ts` | store | CRUD + transform | RESEARCH.md Pattern 1+2 (no prior store exists) | research-only |
| `src/stores/ui.ts` | store | event-driven | RESEARCH.md Pattern 5 (no prior store exists) | research-only |
| `src/stores/index.ts` | barrel | — | `src/lib/stub-data.ts` (barrel re-export pattern) | partial |
| `src/components/file-row/FileRow.tsx` | component | request-response | `src/components/panels/FilesPane.tsx` (skeleton) + `example-ui/app.jsx` lines 421–470 | role-match |
| `src/components/panels/FilesPane.tsx` | component | CRUD | `src/components/shell/AppShell/AppShell.tsx` + `example-ui/app.jsx` lines 384–492 | role-match |

## Pattern Assignments

---

### `src/stores/files.ts` (store, CRUD + transform)

**Analog:** RESEARCH.md Patterns 1–2 (no existing store to copy from; this is the first store file)

**Attribution header pattern** — copy from `src/lib/format.ts` line 1:
```typescript
// Phase 01, Plan 04 — STORE-06
```
Apply as:
```typescript
// Phase 02 — STORE-01: filesAtom map + computed atoms + actions. Source: 02-PLAN-01.md
```

**Imports pattern** (model from `src/lib/stub-data.ts` lines 1–8 + nanostores API):
```typescript
import { map, computed } from 'nanostores'
import type { FileEntry, SortKey } from '@/lib/stub-data'
import { STUB_FILES } from '@/lib/stub-data'
```

**Store shape + actions pattern** (RESEARCH.md Pattern 1, lines 122–159):
```typescript
interface FilesState {
  entries: FileEntry[]
  selectedId: string | null
  filterQuery: string
  sortBy: SortKey
}

export const filesAtom = map<FilesState>({
  entries: STUB_FILES,
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})

// Actions: standalone exported functions (not methods)
export function selectFile(id: string) {
  filesAtom.setKey('selectedId', id)
}
export function removeFile(id: string) {
  filesAtom.setKey('entries', filesAtom.get().entries.filter(f => f.id !== id))
}
export function setFilter(q: string) {
  filesAtom.setKey('filterQuery', q)
}
export function setSortBy(s: SortKey) {
  filesAtom.setKey('sortBy', s)
}
```

**Computed atoms pattern** (RESEARCH.md Pattern 2, lines 163–181):
```typescript
export const $filteredFiles = computed(filesAtom, (s) => {
  const q = s.filterQuery.trim().toLowerCase()
  const list = q ? s.entries.filter(f => f.name.toLowerCase().includes(q)) : s.entries
  // sorting logic by s.sortBy
  return list
})

export const $selectedFile = computed(filesAtom, (s) =>
  s.entries.find(f => f.id === s.selectedId) ?? null
)

// PITFALL-02: use s.entries (full list), NOT $filteredFiles — totals are always from all entries
export const $totals = computed(filesAtom, (s) => {
  const orig = s.entries.reduce((a, f) => a + f.orig, 0)
  const opt  = s.entries.reduce((a, f) => a + f.opt,  0)
  return { orig, opt, saved: orig - opt, pct: orig > 0 ? ((orig - opt) / orig) * 100 : 0 }
})
```

---

### `src/stores/ui.ts` (store, event-driven)

**Analog:** RESEARCH.md Pattern 5 (no existing analog; first ui store)

**Attribution header:**
```typescript
// Phase 02 — STORE-03: uiAtom full shape with Phase 3 action stubs. Source: 02-PLAN-01.md
// CIRCULAR ESM GUARD: ui.ts MUST NOT import files.ts, runtime.ts, or settings.ts
```

**Full shape + stubs pattern** (RESEARCH.md Pattern 5, lines 239–287):
```typescript
import { map } from 'nanostores'
// Types sourced inline — never from other store modules (circular ESM guard)

export type View = 'Batch' | 'Compare' | 'Report'
export type Tab  = 'codec' | 'svgo' | 'output' | 'report'

interface UiState {
  open: string | null
  view: View
  tab: Tab
  split: number
  zoom: number
  cmdkOpen: boolean
  cmdkQ: string
  cmdkSel: number
  rowMenu: string | null
  theme: 'dark' | 'light'
}

export const uiAtom = map<UiState>({
  open: null,
  view: 'Batch',
  tab: 'codec',
  split: 50,
  zoom: 100,
  cmdkOpen: false,
  cmdkQ: '',
  cmdkSel: 0,
  rowMenu: null,
  theme: 'dark',
})

// Phase 2 active actions
export function setRowMenu(id: string | null) { uiAtom.setKey('rowMenu', id) }

// Phase 3 actions — stubbed
export function setOpen(key: string | null) { /* @TODO Phase 3 */ }
export function setView(v: View)             { /* @TODO Phase 3 */ }
export function setTab(t: Tab)               { /* @TODO Phase 3 */ }
export function setSplit(pct: number)        { /* @TODO Phase 3 */ }
export function setZoom(z: number)           { /* @TODO Phase 3 */ }
export function openCmdk()                   { /* @TODO Phase 3 */ }
export function closeCmdk()                  { /* @TODO Phase 3 */ }
export function setCmdkQuery(q: string)      { /* @TODO Phase 3 */ }
export function setCmdkSel(n: number)        { /* @TODO Phase 3 */ }
export function setTheme(t: 'dark'|'light')  { /* @TODO Phase 3 */ }
```

---

### `src/stores/index.ts` (barrel, —)

**Analog:** `src/lib/stub-data.ts` (barrel re-export style — multiple named exports from one file)

**Pattern** — re-export everything from both stores:
```typescript
// Phase 02 — Store barrel. Source: 02-PLAN-01.md
export * from './files'
export * from './ui'
```

---

### `src/components/file-row/FileRow.tsx` (component, request-response)

**Analog:** `example-ui/app.jsx` lines 421–470 (file row + context menu logic); `src/components/ui/context-menu.tsx` (shadcn exports)

**Attribution header:**
```typescript
// Phase 02 — FILES-03 + FILES-04: FileRow with ContextMenu (D-02). Source: 02-PLAN-02.md
```

**Imports pattern** (derived from `src/components/shell/AppShell/AppShell.tsx` lines 1–9 + ContextMenu exports):
```typescript
import { useRef } from 'react'
import { useStore } from '@nanostores/react'
import { DotsThreeVertical } from '@phosphor-icons/react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { fmtBytes, fmtPct } from '@/lib/format'
import { uiAtom, setRowMenu } from '@/stores/ui'
import { selectFile, removeFile } from '@/stores/files'
import type { FileEntry } from '@/lib/stub-data'
```

**Format badge color map pattern** (RESEARCH.md Pattern 6):
```typescript
// PITFALL-05: STUB_FILES uses type:'jpg' not 'jpeg' — key on 'jpg'
const BADGE_CLASS: Record<string, string> = {
  svg:  'bg-[repeating-linear-gradient(45deg,var(--color-bg-2)_0_4px,var(--color-bg-3)_4px_5px)] text-[var(--accent)]',
  png:  'bg-[linear-gradient(135deg,oklch(0.55_0.12_250)_0%,oklch(0.45_0.10_280)_100%)] text-[oklch(0.95_0_0)]',
  jpg:  'bg-[linear-gradient(135deg,oklch(0.65_0.13_60)_0%,oklch(0.55_0.15_30)_100%)] text-[oklch(0.95_0_0)]',
  webp: 'bg-[linear-gradient(135deg,oklch(0.60_0.14_195)_0%,oklch(0.50_0.12_220)_100%)] text-[oklch(0.95_0_0)]',
  avif: 'bg-[linear-gradient(135deg,oklch(0.60_0.14_320)_0%,oklch(0.45_0.12_290)_100%)] text-[oklch(0.95_0_0)]',
}
```

**Core component pattern** — ContextMenu + programmatic ctxbtn trigger (RESEARCH.md Pattern 4):
```typescript
// PITFALL-01: Attach ref to ContextMenuTrigger directly (it accepts ref) — no asChild+forwardRef needed
export function FileRow({ file }: { file: FileEntry }) {
  const { rowMenu } = useStore(uiAtom)
  const rowRef = useRef<HTMLElement>(null)

  function handleCtxBtn(e: React.MouseEvent) {
    e.stopPropagation()
    rowRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
      })
    )
  }

  const savingsPct = file.orig > 0 ? ((file.orig - file.opt) / file.orig) * 100 : 0

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={rowRef}
        onClick={() => selectFile(file.id)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none',
          'border-b border-[var(--color-line)]',
          // selected state — analog: example-ui/app.jsx line 423
          rowMenu === file.id && 'has-menu bg-[var(--color-bg-2)]'
        )}
      >
        {/* Format badge — analog: example-ui/app.jsx line 427 */}
        <div className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-mono font-bold uppercase', BADGE_CLASS[file.type] ?? '')}>
          {file.type.slice(0, 3)}
        </div>

        {/* File meta — analog: example-ui/app.jsx lines 428–438 */}
        <div className="flex-1 min-w-0">
          <div className="truncate text-xs">{file.name}</div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--color-fg-2)]">
            <span>{fmtBytes(file.orig)}</span>
            <span>→</span>
            <span>{fmtBytes(file.opt)}</span>
            <span className={cn(savingsPct < 30 ? 'text-[var(--warn)]' : 'text-[var(--accent)]')}>
              {fmtPct(file.orig, file.opt)}
            </span>
          </div>
          {file.status === 'processing' && (
            <div className="mt-0.5 h-0.5 w-full bg-[var(--color-bg-3)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${(file.prog ?? 0) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Actions — analog: example-ui/app.jsx lines 440–445 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button className="ctxbtn opacity-0 group-hover:opacity-100" onClick={handleCtxBtn} aria-label="Row menu">
            <DotsThreeVertical size={12} />
          </button>
          <div className={cn('size-2 rounded-full', {
            'bg-[var(--accent)]': file.status === 'done',
            'bg-yellow-400': file.status === 'processing',
            'bg-[var(--color-fg-3)]': file.status === 'queued',
            'bg-red-500': file.status === 'error',
          })} title={file.status} />
        </div>
      </ContextMenuTrigger>

      {/* Context menu — analog: example-ui/app.jsx lines 447–469, D-01 */}
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => { /* pushToast stub */ }}>Re-optimize</ContextMenuItem>
        <ContextMenuItem onSelect={() => { /* pushToast stub */ }}>Save as…</ContextMenuItem>
        <ContextMenuItem onSelect={() => { /* pushToast stub */ }}>Copy data URI</ContextMenuItem>
        <ContextMenuItem onSelect={() => { /* pushToast stub */ }}>Copy &lt;picture&gt;</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => { /* pushToast stub */ }}>Reveal in compare</ContextMenuItem>
        <ContextMenuItem onSelect={() => { /* pushToast stub */ }}>Apply same settings to all</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => removeFile(file.id)}>
          Remove from queue
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

---

### `src/components/panels/FilesPane.tsx` (component, CRUD)

**Analog:** `src/components/shell/AppShell/AppShell.tsx` (pane layout pattern) + `example-ui/app.jsx` lines 384–492 (full FilesPane markup)

**Attribution header:**
```typescript
// Phase 02 — FILES-01 through FILES-05: FilesPane full body. Source: 02-PLAN-02.md
```

**Imports pattern** (model from AppShell.tsx lines 1–9):
```typescript
import { useStore } from '@nanostores/react'
import { FunnelIcon, PlusIcon } from '@phosphor-icons/react'
import { $filteredFiles, $totals } from '@/stores/files'
import { fmtBytes } from '@/lib/format'
import { FileRow } from '@/components/file-row/FileRow'
```

**Core pane structure pattern** (analog: `src/components/panels/FilesPane.tsx` lines 4–12 for shell, `example-ui/app.jsx` lines 384–492 for body):
```typescript
export function FilesPane() {
  const files = useStore($filteredFiles)    // FILES-01 count, FILES-03 list
  const totals = useStore($totals)          // FILES-05 totals bar

  return (
    <div data-testid="files-pane"
         className="h-full flex flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-1)]">

      {/* FILES-01: Pane header — analog: example-ui/app.jsx lines 387–411 */}
      <div className="h-[var(--height-pane-header)] flex items-center justify-between px-3
                      text-xs text-[var(--color-fg-2)] border-b border-[var(--color-line)] shrink-0">
        <span>Queue · {files.length} files</span>
        <div className="flex items-center gap-1">
          {/* Sort popover trigger — Popover from shadcn */}
          <button className="iconbtn" title="Sort"><FunnelIcon size={12} /></button>
          <button className="iconbtn" title="Add" onClick={() => { /* pushToast stub */ }}>
            <PlusIcon size={12} />
          </button>
        </div>
      </div>

      {/* FILES-02: Dropzone — analog: example-ui/app.jsx lines 413–417 */}
      <div className="dropzone flex flex-col items-center justify-center gap-1 py-4 px-3
                      border-b border-dashed border-[var(--color-line)] text-[var(--color-fg-3)] shrink-0">
        <span className="text-sm font-medium">Drop images to optimize</span>
        <span className="text-xs">or click to browse · max 200 files</span>
        <div className="text-[10px] text-[var(--color-fg-3)] mt-0.5">SVG · PNG · JPEG · WEBP · AVIF</div>
      </div>

      {/* FILES-03: File list — analog: example-ui/app.jsx lines 419–473 */}
      <div className="flex-1 overflow-y-auto">
        {files.map(f => <FileRow key={f.id} file={f} />)}
      </div>

      {/* FILES-05: Totals bar — analog: example-ui/app.jsx lines 475–492 */}
      <div className="grid grid-cols-4 border-t border-[var(--color-line)] shrink-0">
        {[
          { lbl: 'Total before', val: fmtBytes(totals.orig) },
          { lbl: 'Total after',  val: fmtBytes(totals.opt) },
          { lbl: 'Saved',        val: `−${fmtBytes(totals.saved)}` },
          { lbl: 'Compression',  val: `${totals.pct.toFixed(1)}%` },
        ].map(({ lbl, val }) => (
          <div key={lbl} className="flex flex-col items-center py-2 px-1 text-center">
            <span className="text-[9px] text-[var(--color-fg-3)] uppercase tracking-wide">{lbl}</span>
            <span className="text-xs font-mono text-[var(--accent)]">{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Shared Patterns

### Attribution Header
**Source:** `src/lib/format.ts` line 1, `src/lib/stub-data.ts` lines 1–2, `src/components/panels/FilesPane.tsx` line 1
**Apply to:** Every new file in this phase
```typescript
// Phase 02 — [description]. Source: [plan doc]
```

### `cn()` for conditional className
**Source:** `src/lib/utils.ts` lines 1–6; used in every existing component
**Apply to:** `FileRow.tsx`, `FilesPane.tsx`
```typescript
import { cn } from '@/lib/utils'
// Usage: className={cn('base-class', condition && 'conditional-class')}
```

### useStore subscription (no useState for data)
**Source:** RESEARCH.md Pattern 3; enforced by CONTEXT.md and CLAUDE.md
**Apply to:** `FileRow.tsx`, `FilesPane.tsx`
```typescript
import { useStore } from '@nanostores/react'
const files = useStore($filteredFiles)  // NOT useState
```

### ContextMenuTrigger ref attachment (Pitfall-01 guard)
**Source:** RESEARCH.md Pitfall 1; `src/components/ui/context-menu.tsx` line 13–24
**Apply to:** `FileRow.tsx`
```typescript
// Attach ref to ContextMenuTrigger directly — it accepts a ref prop.
// Do NOT use asChild + plain div + forwardRef (ref won't merge).
const rowRef = useRef<HTMLElement>(null)
<ContextMenuTrigger ref={rowRef} ...>
```

### Tailwind CSS variable arbitrary values
**Source:** `src/components/panels/FilesPane.tsx` lines 6–10; `src/components/shell/AppShell/AppShell.tsx` lines 12–15
**Apply to:** All component files
```typescript
// Pattern: bg-[var(--color-bg-1)], text-[var(--color-fg-2)], border-[var(--color-line)]
// NOT: inline styles, CSS modules, hardcoded colors
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/stores/files.ts` | store | CRUD | No existing nanostores store in codebase — use RESEARCH.md Pattern 1+2 verbatim |
| `src/stores/ui.ts` | store | event-driven | No existing nanostores store in codebase — use RESEARCH.md Pattern 5 verbatim |

## Metadata

**Analog search scope:** `src/` (all .tsx/.ts files), `example-ui/app.jsx`, `example-ui/OIMG.html`
**Files scanned:** 10 source files + 2 example-ui files
**Pattern extraction date:** 2026-05-17
