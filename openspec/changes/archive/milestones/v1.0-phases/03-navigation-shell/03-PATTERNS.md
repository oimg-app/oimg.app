# Phase 3: Navigation Shell - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/ui.ts` (modify) | store | event-driven | `src/stores/ui.ts` itself — fill stubs | exact |
| `src/stores/runtime.ts` (new) | store | event-driven | `src/stores/files.ts` | role-match |
| `src/stores/index.ts` (modify) | barrel | — | `src/stores/index.ts` itself | exact |
| `src/lib/commands.ts` (new) | utility/registry | transform | `src/lib/stub-data.ts` (static data shape) | role-match |
| `src/components/shell/AppShell/AppShell.tsx` (modify) | component/shell | event-driven | `src/components/shell/AppShell/AppShell.tsx` itself | exact |
| `src/components/shell/TitleBar/TitleBar.tsx` (new) | component | request-response | `src/components/panels/FilesPane.tsx` | role-match |
| `src/components/shell/Toolbar/Toolbar.tsx` (new) | component | request-response | `src/components/panels/FilesPane.tsx` | role-match |
| `src/components/shell/StatusBar/StatusBar.tsx` (new) | component | request-response | `src/components/file-row/FileRow.tsx` | role-match |
| `src/components/shell/CommandPalette/CommandPalette.tsx` (new) | component | event-driven | `src/components/file-row/FileRow.tsx` (keyboard events) | partial |
| `src/tests/navigation.spec.ts` (new) | test | — | `src/tests/foundation.spec.ts` | exact |
| `src/tests/stores.test.ts` (new) | test | — | `src/tests/stub-data.test.ts` | role-match |

---

## Pattern Assignments

### `src/stores/ui.ts` (store, event-driven) — fill @TODO stubs

**Analog:** `src/stores/files.ts` (same `map` + action pattern, already verified)

**Real action body pattern** (modeled after `setRowMenu` on line 34–36 of `ui.ts` and `setFilter`/`setSortBy` in `files.ts`):

```typescript
// Copy this exact body pattern for every @TODO stub:
export function setOpen(key: string | null): void {
  uiAtom.setKey('open', key)
}
export function setView(v: View): void {
  uiAtom.setKey('view', v)
}
export function setTab(t: Tab): void {
  uiAtom.setKey('tab', t)
}
export function setSplit(pct: number): void {
  uiAtom.setKey('split', pct)
}
export function setZoom(z: number): void {
  uiAtom.setKey('zoom', z)
}
export function openCmdk(): void {
  uiAtom.setKey('cmdkOpen', true)
  uiAtom.setKey('cmdkQ', '')
  uiAtom.setKey('cmdkSel', 0)
}
export function closeCmdk(): void {
  uiAtom.setKey('cmdkOpen', false)
}
export function setCmdkQuery(q: string): void {
  uiAtom.setKey('cmdkQ', q)
}
export function setCmdkSel(n: number): void {
  uiAtom.setKey('cmdkSel', n)
}
export function setTheme(t: 'dark' | 'light'): void {
  uiAtom.setKey('theme', t)
}
```

**$cmdFlat computed atom** — add after existing actions, using injection pattern to avoid circular ESM:

```typescript
// CIRCULAR ESM GUARD: do NOT import commands.ts here.
// Instead, use registerCommands() injection called from main.tsx.
import { computed } from 'nanostores'
import type { CommandItem } from '@/lib/commands'

let _allCommands: CommandItem[] = []
export function registerCommands(cmds: CommandItem[]): void {
  _allCommands = cmds
}
export const $cmdFlat = computed(uiAtom, (s) =>
  s.cmdkQ
    ? _allCommands.filter(i => i.label.toLowerCase().includes(s.cmdkQ.toLowerCase()))
    : _allCommands
)
```

---

### `src/stores/runtime.ts` (store, event-driven) — new file

**Analog:** `src/stores/files.ts` (lines 1–18: map import + interface + map() initializer)

**Imports pattern** (copy from `files.ts` lines 1–2):
```typescript
import { map } from 'nanostores'
```

**Core store pattern** (copy shape from `files.ts` lines 6–18):
```typescript
export interface Toast { id: string; msg: string; meta?: string }
interface RuntimeState { running: boolean; toasts: Toast[] }

export const runtimeAtom = map<RuntimeState>({ running: false, toasts: [] })
```

**Action pattern** (copy body form from `files.ts` lines 64–78: `map.setKey()`):
```typescript
export function startRun(): void { runtimeAtom.setKey('running', true) }
export function stopRun(): void  { runtimeAtom.setKey('running', false) }
export function pushToast(msg: string, meta?: string): void {
  const id = String(Date.now() + Math.random())
  runtimeAtom.setKey('toasts', [...runtimeAtom.get().toasts, { id, msg, meta }])
}
export function dismissToast(id: string): void {
  runtimeAtom.setKey('toasts', runtimeAtom.get().toasts.filter(t => t.id !== id))
}
```

---

### `src/stores/index.ts` (barrel) — add runtime re-export

**Analog:** `src/stores/index.ts` (lines 1–2)

```typescript
// Current:
export * from './files'
export * from './ui'
// Add:
export * from './runtime'
```

---

### `src/lib/commands.ts` (utility/registry) — new file

**Analog:** `src/lib/stub-data.ts` (static typed data with interface + export const)

**Imports pattern** — import action functions only, not atoms (avoids circular ESM):
```typescript
import { setView, setTheme, openCmdk } from '@/stores/ui'
import { startRun } from '@/stores/runtime'
```

**Core data shape** (modeled on `stub-data.ts` exported interface + const pattern):
```typescript
export interface CommandItem {
  label: string
  meta?: string
  group: string
  do: () => void
}
export interface CommandGroup { group: string; items: CommandItem[] }

export const ALL_COMMANDS: CommandGroup[] = [
  { group: 'Actions', items: [
    { label: 'Add files',     meta: 'A', group: 'Actions', do: () => {} },
    { label: 'Optimize all',  meta: 'O', group: 'Actions', do: startRun },
  ]},
  { group: 'View', items: [
    { label: 'Batch view',   group: 'View', do: () => setView('Batch') },
    { label: 'Compare view', group: 'View', do: () => setView('Compare') },
    { label: 'Report view',  group: 'View', do: () => setView('Report') },
    { label: 'Light theme',  group: 'View', do: () => setTheme('light') },
    { label: 'Dark theme',   group: 'View', do: () => setTheme('dark') },
  ]},
  { group: 'Palette', items: [
    { label: 'Open command palette', meta: '⌘K', group: 'Palette', do: openCmdk },
  ]},
]
```

**In `main.tsx`** — call `registerCommands` after imports to complete the injection (add after `createRoot` call or before render):
```typescript
import { registerCommands } from '@/stores/ui'
import { ALL_COMMANDS } from '@/lib/commands'
// Flatten groups into items list:
registerCommands(ALL_COMMANDS.flatMap(g => g.items))
```

---

### `src/components/shell/AppShell/AppShell.tsx` (modify)

**Analog:** `src/components/shell/AppShell/AppShell.tsx` itself + `src/components/panels/FilesPane.tsx` (useStore pattern)

**Add imports** (copy useStore pattern from `FilesPane.tsx` lines 1–5):
```typescript
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { uiAtom, openCmdk, closeCmdk, setOpen } from '@/stores/ui'
import { TitleBar } from '@/components/shell/TitleBar/TitleBar'
import { Toolbar } from '@/components/shell/Toolbar/Toolbar'
import { StatusBar } from '@/components/shell/StatusBar/StatusBar'
import { CommandPalette } from '@/components/shell/CommandPalette/CommandPalette'
```

**data-theme effect** — add inside AppShell() before return:
```typescript
const { theme } = useStore(uiAtom)
useEffect(() => {
  document.documentElement.dataset.theme = theme
}, [theme])
```

**Global keyboard listener** — add inside AppShell() (cleanup is mandatory per Pitfall 3):
```typescript
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      openCmdk()
    }
    if (e.key === 'Escape') {
      closeCmdk()
      setOpen(null)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

**Updated JSX layout** — replace current `<div>` body (remove hardcoded `className="dark"` after SHELL-03):
```tsx
<div
  role="application"
  aria-label="OIMG Image Optimizer"
  className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-fg-0)]"
>
  <TitleBar />
  <Toolbar />
  <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
    {/* existing panels unchanged */}
  </ResizablePanelGroup>
  <StatusBar />
  <CommandPalette />
</div>
```

Note: Audit `src/index.css` — if `.dark` class drives variables keep it until SHELL-03 CSS migration is confirmed; if `[data-theme=dark]` already drives all tokens, remove `className="dark"` in this step.

---

### `src/components/shell/TitleBar/TitleBar.tsx` (new, component, request-response)

**Analog:** `src/components/panels/FilesPane.tsx`

**Imports pattern** (copy from `FilesPane.tsx` lines 1–9, swap store + icon references):
```typescript
import { useStore } from '@nanostores/react'
import { MagnifyingGlass, Sun, Moon } from '@phosphor-icons/react'
import { uiAtom, setOpen, setView, setTheme, openCmdk } from '@/stores/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Kbd } from '@/components/ui/kbd'
```

**Store read pattern** (copy from `FilesPane.tsx` line 20: `useStore`):
```typescript
export function TitleBar() {
  const { open, theme } = useStore(uiAtom)
  // open === 'menu-codec' | 'menu-view' | 'menu-help' | null
```

**Popover controlled-by-store pattern** — key insight: `Popover` open state is driven by `uiAtom.open`, not local state (STORE-08):
```tsx
<Popover open={open === 'menu-codec'} onOpenChange={(o) => setOpen(o ? 'menu-codec' : null)}>
  <PopoverTrigger asChild>
    <button
      className="px-2 py-1 rounded text-xs text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg-0)]"
      style={{ borderRadius: '4px' }}
    >
      Codec
    </button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-auto p-2 bg-[var(--color-bg-2)] border-[var(--color-line)] rounded-[6px]">
    {/* menu items */}
  </PopoverContent>
</Popover>
```

**Menu item pattern** (copy from `FilesPane.tsx` lines 45–52: button + onClick → store action):
```tsx
<button
  className="w-full px-3 py-1.5 text-left text-xs text-[var(--color-fg-0)] hover:bg-[var(--color-bg-3)] rounded"
  onClick={() => { /* action stub */ }}
>
  Item label
  <Kbd className="ml-auto text-[11px] font-mono font-semibold">⌘O</Kbd>
</button>
```

**Chrome height** — outer div: `h-9` (36px), `bg-[var(--color-bg-1)]`, `border-b border-[var(--color-line)]`, `px-3 flex items-center justify-between`

---

### `src/components/shell/Toolbar/Toolbar.tsx` (new, component, request-response)

**Analog:** `src/components/panels/FilesPane.tsx`

**Imports pattern**:
```typescript
import { useStore } from '@nanostores/react'
import { Plus, Lightning, Export, ChevronDown, MagnifyingGlass, Sun, Moon, GearSix } from '@phosphor-icons/react'
import { uiAtom, setOpen, setView, setTheme } from '@/stores/ui'
import { filesAtom, setFilter } from '@/stores/files'
import { runtimeAtom, startRun } from '@/stores/runtime'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
```

**Multi-store read** — read from multiple atoms (copy pattern from `FileRow.tsx` lines 41–44 which reads both `uiAtom` and `filesAtom`):
```typescript
export function Toolbar() {
  const { open, view } = useStore(uiAtom)
  const { running } = useStore(runtimeAtom)
  const { filterQuery } = useStore(filesAtom)
```

**Primary (accent) button** — Optimize all:
```tsx
<button
  className="h-7 px-3 text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent rounded-[5px] hover:brightness-105"
  onClick={startRun}
>
  <Lightning size={13} />
  Optimize all
</button>
```

**Standard toolbar button** — copy for Add/Export/Auto non-primary:
```tsx
<button className="h-7 px-3 text-xs text-[var(--color-fg-0)] bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px] hover:bg-[var(--color-bg-3)] hover:border-[var(--color-line-strong)] flex items-center gap-1">
```

**Split button group pattern** — main action + popover chevron:
```tsx
<div className="flex items-center">
  <button className="h-7 px-3 text-xs bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-l-[5px] border-r-0 hover:bg-[var(--color-bg-3)]">
    Add files
  </button>
  <Popover open={open === 'tb-add'} onOpenChange={(o) => setOpen(o ? 'tb-add' : null)}>
    <PopoverTrigger asChild>
      <button className="h-7 px-1.5 bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-r-[5px] hover:bg-[var(--color-bg-3)]">
        <ChevronDown size={11} />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-2">
      {/* submenu items */}
    </PopoverContent>
  </Popover>
</div>
```

**Segmented control** — Batch/Compare/Report (drives `setView`):
```tsx
<div role="group" aria-label="Switch view" className="flex h-7 bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px]">
  {(['Batch', 'Compare', 'Report'] as const).map((v, i) => (
    <button
      key={v}
      role="radio"
      aria-checked={view === v}
      onClick={() => setView(v)}
      className={cn(
        'px-2 text-xs',
        i > 0 && 'border-l border-[var(--color-line)]',
        view === v ? 'bg-[var(--color-bg-3)] text-[var(--color-fg-0)]' : 'text-[var(--color-fg-1)]'
      )}
    >
      {v}
    </button>
  ))}
</div>
```

**Filter input** (copy input pattern; `setFilter` action from `files.ts`):
```tsx
<div className="flex items-center h-7 min-w-[220px] bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px] px-2 gap-2 focus-within:border-[var(--color-accent)]">
  <MagnifyingGlass size={12} className="text-[var(--color-fg-2)] shrink-0" />
  <input
    className="flex-1 bg-transparent text-xs text-[var(--color-fg-0)] placeholder:text-[var(--color-fg-2)] outline-none"
    placeholder="Filter files…"
    value={filterQuery}
    onChange={e => setFilter(e.target.value)}
  />
</div>
```

**Toolbar divider**:
```tsx
<div className="w-px h-[18px] bg-[var(--color-line)] mx-1" aria-hidden="true" />
```

**Chrome height** — outer div: `h-11` (44px), `bg-[var(--color-bg-1)]`, `border-b border-[var(--color-line)]`, `px-2 flex items-center gap-2`

---

### `src/components/shell/StatusBar/StatusBar.tsx` (new, component, request-response)

**Analog:** `src/components/panels/FilesPane.tsx` lines 84–97 (totals bar — small fixed strip, reads computed atoms, renders formatted values)

**Imports pattern**:
```typescript
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { $totals } from '@/stores/files'
import { fmtBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
```

**Store reads + computed**:
```typescript
export function StatusBar() {
  const { running } = useStore(runtimeAtom)
  const totals = useStore($totals)
```

**Worker pip pattern** (copy status dot from `FileRow.tsx` lines 65–71 and 125–127):
```tsx
<div
  className={cn('w-2 h-2 rounded-full', running ? 'bg-[var(--color-info)] motion-safe:animate-pulse' : 'bg-[var(--color-accent)]')}
  aria-label={`Worker status: ${running ? 'Running' : 'Idle'}`}
/>
<span>{running ? 'Running' : 'Idle'}</span>
```

**Version strings** — static, exact values per spec:
```tsx
<span className="font-mono text-[11px] font-semibold">SVGO 4.0.1</span>
<span className="font-mono text-[11px] font-semibold">@squoosh-kit/core 0.6.0</span>
<span>WASM ready · 312 KB</span>
```

**Totals from computed atom** (copy `$totals` pattern from `FilesPane.tsx` lines 21–22):
```tsx
<span>{totals.orig > 0 ? `${totals.entries?.length ?? 0} files` : '0 files'}</span>
<span>{fmtBytes(totals.orig)} → {fmtBytes(totals.opt)}</span>
```

Note: `$totals` does not expose `entries.length`. Read `filesAtom` directly for file count or add a `$fileCount` computed to `files.ts`.

**Chrome height** — outer div: `h-[22px]`, `bg-[var(--color-bg-1)]`, `border-t border-[var(--color-line)]`, `px-3 flex items-center gap-3 text-[11px] text-[var(--color-fg-2)]`

---

### `src/components/shell/CommandPalette/CommandPalette.tsx` (new, component, event-driven)

**Analog:** `src/components/ui/dialog.tsx` (Dialog wrapping pattern) + `src/components/file-row/FileRow.tsx` (keyboard event handling)

**Imports pattern**:
```typescript
import { useStore } from '@nanostores/react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { uiAtom, closeCmdk, setCmdkQuery, setCmdkSel } from '@/stores/ui'
import { $cmdFlat } from '@/stores/ui'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
```

**Store read + Dialog visibility** — Dialog `open` prop from store (STORE-08, no useState):
```typescript
export function CommandPalette() {
  const { cmdkOpen, cmdkQ, cmdkSel } = useStore(uiAtom)
  const cmdFlat = useStore($cmdFlat)
```

**Dialog controlled by store** (copy `open`/`onOpenChange` pattern from Popover usage in TitleBar):
```tsx
<Dialog open={cmdkOpen} onOpenChange={(o) => !o && closeCmdk()}>
  <DialogContent
    showCloseButton={false}
    className="w-[560px] max-h-[400px] p-0 bg-[var(--color-bg-1)] border-[var(--color-line)] rounded-[8px] overflow-hidden"
  >
```

**Search input with keyboard handler** — keyboard nav fires store actions (pattern from `app.jsx` lines 665–668):
```tsx
<input
  autoFocus
  aria-label="Search commands"
  placeholder="Search commands…"
  value={cmdkQ}
  className="w-full h-12 px-4 text-sm text-[var(--color-fg-0)] bg-transparent border-b border-[var(--color-line)] outline-none placeholder:text-[var(--color-fg-2)]"
  onChange={e => setCmdkQuery(e.target.value)}
  onKeyDown={e => {
    if (e.key === 'ArrowDown') { setCmdkSel(Math.min(cmdFlat.length - 1, cmdkSel + 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setCmdkSel(Math.max(0, cmdkSel - 1)); e.preventDefault() }
    if (e.key === 'Enter')     { cmdFlat[cmdkSel]?.do?.(); closeCmdk() }
    if (e.key === 'Escape')    { closeCmdk() }
  }}
/>
```

**Command list with groups** (ARIA: `role="listbox"` + `aria-activedescendant`):
```tsx
<ul
  role="listbox"
  aria-label="Commands"
  aria-activedescendant={`cmd-item-${cmdkSel}`}
  className="max-h-[320px] overflow-y-auto"
>
  {/* Render grouped — flatten index across groups for cmdkSel */}
  {cmdFlat.map((item, i) => (
    <li
      key={i}
      id={`cmd-item-${i}`}
      role="option"
      aria-selected={i === cmdkSel}
      className={cn(
        'px-4 py-2 text-[13px] text-[var(--color-fg-0)] cursor-default flex justify-between items-center hover:bg-[var(--color-bg-2)]',
        i === cmdkSel && 'bg-[var(--color-accent-dim)] border-l-2 border-[var(--color-accent)]'
      )}
      onClick={() => { item.do?.(); closeCmdk() }}
    >
      <span>{item.label}</span>
      {item.meta && <span className="font-mono text-[11px] font-semibold text-[var(--color-fg-2)]">{item.meta}</span>}
    </li>
  ))}
</ul>
```

**Footer**:
```tsx
<div className="h-8 px-4 flex items-center border-t border-[var(--color-line)] bg-[var(--color-bg-0)] text-[11px] text-[var(--color-fg-3)]">
  <Kbd>↑↓</Kbd> navigate · <Kbd>Enter</Kbd> select · <Kbd>Esc</Kbd> close
</div>
```

---

### `src/tests/navigation.spec.ts` (new, test)

**Analog:** `src/tests/foundation.spec.ts` (Playwright smoke test structure lines 1–30)

**Imports pattern** (copy from `foundation.spec.ts` lines 1–3):
```typescript
import { test, expect } from '@playwright/test'
```

**Test structure** (copy `test(name, async ({ page }) => { page.goto('/'); assertions })` pattern):
```typescript
test('TitleBar renders (NAV-01)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="titlebar"]')).toBeVisible()
})

test('Toolbar renders (NAV-02)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
})

test('StatusBar renders (NAV-03)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()
})

test('Meta+K opens CommandPalette (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.locator('[role="dialog"]')).toBeVisible()
})

test('Escape closes CommandPalette (NAV-04)', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="dialog"]')).not.toBeVisible()
})

test('data-theme set on html (SHELL-03)', async ({ page }) => {
  await page.goto('/')
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  expect(theme).toMatch(/dark|light/)
})
```

---

### `src/tests/stores.test.ts` (new, test)

**Analog:** `src/tests/stub-data.test.ts` (Vitest unit test structure)

**Pattern** — copy Vitest import + `describe`/`it`/`expect` shape from `stub-data.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { uiAtom, setOpen, openCmdk, closeCmdk, setTheme } from '@/stores/ui'
import { runtimeAtom, startRun, stopRun } from '@/stores/runtime'
import { ALL_COMMANDS } from '@/lib/commands'

describe('uiAtom actions (STORE-03)', () => {
  beforeEach(() => uiAtom.set({ open: null, view: 'Batch', tab: 'codec', split: 50, zoom: 100, cmdkOpen: false, cmdkQ: '', cmdkSel: 0, rowMenu: null, theme: 'dark' }))

  it('setOpen updates open key', () => { setOpen('menu-codec'); expect(uiAtom.get().open).toBe('menu-codec') })
  it('openCmdk sets cmdkOpen=true and resets query', () => { openCmdk(); expect(uiAtom.get().cmdkOpen).toBe(true); expect(uiAtom.get().cmdkQ).toBe('') })
  it('closeCmdk sets cmdkOpen=false', () => { openCmdk(); closeCmdk(); expect(uiAtom.get().cmdkOpen).toBe(false) })
  it('setTheme updates theme key', () => { setTheme('light'); expect(uiAtom.get().theme).toBe('light') })
})

describe('runtimeAtom (STORE-04)', () => {
  it('startRun sets running=true', () => { startRun(); expect(runtimeAtom.get().running).toBe(true) })
  it('stopRun sets running=false', () => { startRun(); stopRun(); expect(runtimeAtom.get().running).toBe(false) })
})

describe('ALL_COMMANDS (STORE-07)', () => {
  it('is non-empty', () => { expect(ALL_COMMANDS.length).toBeGreaterThan(0) })
  it('every item has label and do function', () => {
    ALL_COMMANDS.flatMap(g => g.items).forEach(item => {
      expect(typeof item.label).toBe('string')
      expect(typeof item.do).toBe('function')
    })
  })
})
```

---

## Shared Patterns

### nanostores `useStore` read pattern
**Source:** `src/components/panels/FilesPane.tsx` lines 1–4, 20–21
**Apply to:** TitleBar, Toolbar, StatusBar, CommandPalette
```typescript
import { useStore } from '@nanostores/react'
import { uiAtom } from '@/stores/ui'
// Inside component:
const { open, theme } = useStore(uiAtom)
```

### nanostores `map.setKey()` action pattern
**Source:** `src/stores/files.ts` lines 64–78
**Apply to:** All new store actions in `ui.ts` and `runtime.ts`
```typescript
export function actionName(value: T): void {
  atomName.setKey('key', value)
}
```

### Popover controlled by store (no local useState)
**Source:** `src/components/panels/FilesPane.tsx` lines 34–56 (Popover uncontrolled), extended by STORE-08 convention
**Apply to:** TitleBar menus, Toolbar split-buttons, Toolbar settings popover
```tsx
<Popover open={open === 'key-name'} onOpenChange={(o) => setOpen(o ? 'key-name' : null)}>
```

### CSS variable token usage
**Source:** `src/components/panels/FilesPane.tsx` lines 27–97; `src/components/file-row/FileRow.tsx`
**Apply to:** All new shell components
```tsx
// Pattern: bg-[var(--color-bg-1)] text-[var(--color-fg-0)] border-[var(--color-line)]
// Note: existing Phase 1/2 components use short aliases (--bg-1, --fg-0, --line)
// Phase 3 components SHOULD use full tokens (--color-bg-1, --color-fg-0, --color-line)
// matching the UI-SPEC exactly. Audit index.css to confirm alias mapping.
```

### Phosphor icon usage
**Source:** `src/components/file-row/FileRow.tsx` lines 3–13; `src/components/panels/FilesPane.tsx` lines 3–4
**Apply to:** All new components
```typescript
import { IconName } from '@phosphor-icons/react'
// Use: <IconName size={13} />  (toolbar icons: 13px; titlebar: 14px; cmdpalette: 16px)
```

### `cn()` conditional className
**Source:** `src/components/file-row/FileRow.tsx` lines 7, 77–82, 100–102
**Apply to:** All components with conditional styles
```typescript
import { cn } from '@/lib/utils'
className={cn('base-classes', condition && 'conditional-class')}
```

### `useEffect` with cleanup
**Source:** Research pattern (mandatory per Pitfall 3); shape from React standard
**Apply to:** AppShell keyboard listener
```typescript
useEffect(() => {
  function handler(e: KeyboardEvent) { /* ... */ }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### Playwright smoke test shape
**Source:** `src/tests/foundation.spec.ts` lines 1–30
**Apply to:** `src/tests/navigation.spec.ts`
```typescript
test('description (REQ-ID)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('selector')).toBeVisible()
})
```

---

## No Analog Found

All files have analogs. No entries.

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/tests/`, `src/lib/`
**Files scanned:** 11 source files read directly
**Pattern extraction date:** 2026-05-17
