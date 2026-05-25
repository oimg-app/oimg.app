# Phase 4: Inspector Pane — Codec + SVGO - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 8
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/stores/settings.ts` | store | CRUD | `src/stores/ui.ts` | exact |
| `src/tests/settings.test.ts` | test | batch | `src/tests/stores.test.ts` | exact |
| `src/components/panels/InspectorPane.tsx` | component | event-driven | `src/components/shell/Toolbar/Toolbar.tsx` | role-match |
| `src/components/panels/inspector/CodecPanel.tsx` | component | request-response | `src/components/shell/Toolbar/Toolbar.tsx` | role-match |
| `src/components/panels/inspector/SvgoPanel.tsx` | component | request-response | `src/components/panels/FilesPane.tsx` | role-match |
| `src/components/panels/inspector/Section.tsx` | utility component | — | `src/components/panels/FilesPane.tsx` (inline div pattern) | partial |
| `src/components/panels/inspector/SegControl.tsx` | utility component | — | `src/components/shell/Toolbar/Toolbar.tsx` lines 117–136 | exact |

---

## Pattern Assignments

### `src/stores/settings.ts` (store, CRUD)

**Analog:** `src/stores/ui.ts`

**Imports pattern** (lines 1–6):
```typescript
// Phase 04 — STORE-02: settingsAtom. Source: 04-XX-PLAN.md
// CIRCULAR ESM GUARD: settings.ts MUST NOT import ui.ts, files.ts, or runtime.ts
import { map } from 'nanostores'
import type { SvgoPlugin } from '@/lib/stub-data'
import { SVGO_PLUGINS } from '@/lib/stub-data'
```

**Atom declaration pattern** (from `src/stores/ui.ts` lines 24–35):
```typescript
export const settingsAtom = map<SettingsState>({
  codec: 'WebP',
  q: 82,
  method: 4,
  lossless: false,
  resizeOn: false,
  w: '1600',
  h: 'auto',
  alg: 'lanczos3',
  fit: 'contain',
  stripMeta: true,
  keepIcc: false,
  aggressive: false,
  plugins: SVGO_PLUGINS,
})
```

**Action pattern** (from `src/stores/ui.ts` lines 37–81 — each action calls `atomName.setKey()`):
```typescript
export function setCodec(c: Codec): void { settingsAtom.setKey('codec', c) }
export function setQuality(q: number): void { settingsAtom.setKey('q', q) }
export function togglePlugin(id: string): void {
  settingsAtom.setKey('plugins', settingsAtom.get().plugins.map(p =>
    p.id === id ? { ...p, on: !p.on } : p
  ))
}
```

**Constants re-export pattern** (keeps STORE-08: components import from stores, not stub-data):
```typescript
export { CODECS, RESIZE_ALGS, FIT_MODES } from '@/lib/stub-data'
export type { Codec, SvgoPlugin } from '@/lib/stub-data'
```

---

### `src/tests/settings.test.ts` (test, batch)

**Analog:** `src/tests/stores.test.ts`

**Header + assert harness** (lines 1–10):
```typescript
// Phase 04 Plan XX — Wave 0 Node unit tests for STORE-02.
// Run: node --experimental-strip-types src/tests/settings.test.ts
let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}
```

**Dynamic import + reset pattern** (from `src/tests/stores.test.ts` lines 13–31):
```typescript
try {
  const mod = await import('../stores/settings.ts')
  const DEFAULT_STATE = { codec: 'WebP', q: 82, /* ... */ }
  mod.settingsAtom.set({ ...DEFAULT_STATE })
  mod.setQuality(60)
  assert('setQuality(60) → q === 60', mod.settingsAtom.get().q === 60)
} catch (err) {
  if (err instanceof Error && (err.message.includes('settings.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: src/stores/settings.ts not yet shipped (expected).')
  } else { failed++; console.error('Unexpected error in STORE-02 block:', err) }
}
```

**Exit pattern** (from `src/tests/stores.test.ts` lines 220–221):
```typescript
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

---

### `src/components/panels/InspectorPane.tsx` (component, event-driven)

**Analog:** `src/components/shell/Toolbar/Toolbar.tsx` for the useStore pattern; also replaces the existing stub at `src/components/panels/InspectorPane.tsx` (lines 1–13).

**Imports pattern** (copy from Toolbar.tsx lines 1–9, adapted):
```typescript
// Phase 04 — INSP-01: InspectorPane shell + tab bar + tab auto-switch. Source: 04-XX-PLAN.md
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { uiAtom, setTab } from '@/stores/ui'
import { $selectedFile } from '@/stores/files'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CodecPanel } from './inspector/CodecPanel'
import { SvgoPanel } from './inspector/SvgoPanel'
```

**useStore read pattern** (from `src/components/shell/Toolbar/Toolbar.tsx` line 25):
```typescript
const { tab } = useStore(uiAtom)
const selectedFile = useStore($selectedFile)
```

**Tab auto-switch useEffect** (RESEARCH.md Pattern 2 — dep array critical):
```typescript
useEffect(() => {
  if (!selectedFile) return
  if (selectedFile.type === 'svg') {
    setTab('svgo')
  } else if (tab === 'svgo') {
    setTab('codec')
  }
}, [selectedFile?.id, selectedFile?.type])
// NOTE: Do NOT add `tab` to deps — causes infinite loop
```

**Controlled Tabs wiring** (from `src/components/ui/tabs.tsx` lines 7–23 — use value/onValueChange):
```typescript
<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
  <TabsList variant="line">
    <TabsTrigger value="codec">Codec</TabsTrigger>
    <TabsTrigger value="svgo">SVGO</TabsTrigger>
    <TabsTrigger value="output">Output</TabsTrigger>
    <TabsTrigger value="report">Report</TabsTrigger>
  </TabsList>
  <TabsContent value="codec"><CodecPanel /></TabsContent>
  <TabsContent value="svgo"><SvgoPanel /></TabsContent>
  <TabsContent value="output"><div className="p-3 text-xs text-[var(--color-fg-3)]">Output — Phase 6</div></TabsContent>
  <TabsContent value="report"><div className="p-3 text-xs text-[var(--color-fg-3)]">Report — Phase 6</div></TabsContent>
</Tabs>
```

---

### `src/components/panels/inspector/CodecPanel.tsx` (component, request-response)

**Analog:** `src/components/shell/Toolbar/Toolbar.tsx` (segmented controls, popover state, store reads)

**Imports pattern:**
```typescript
// Phase 04 — INSP-02 through INSP-05: CodecPanel sections. Source: 04-XX-PLAN.md
import { useStore } from '@nanostores/react'
import { settingsAtom, CODECS, RESIZE_ALGS, FIT_MODES,
         setCodec, setQuality, setMethod, setLossless,
         setResizeOn, setResizeDimensions, setFit, setAlg,
         setStripMeta, setKeepIcc } from '@/stores/settings'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Section } from './Section'
import { SegControl } from './SegControl'
```

**Slider value pattern** (from `src/components/ui/slider.tsx` — CRITICAL: value must be array):
```typescript
// CORRECT: value={[settings.q]}, onValueChange receives number[]
<Slider min={0} max={100} step={1}
  value={[settings.q]}
  onValueChange={([v]) => setQuality(v)}
  className="w-full"
/>
// WRONG: value={settings.q} — TypeScript error + broken thumb
```

**Switch pattern** (from `src/components/ui/switch.tsx` — uses Radix controlled props):
```typescript
<Switch
  checked={settings.lossless}
  onCheckedChange={setLossless}
  size="sm"
/>
```

**Codec engine badge map** (from RESEARCH.md Pattern 7):
```typescript
const CODEC_ENGINE: Record<string, string> = {
  AVIF: 'libavif', WebP: 'libwebp', JPEG: 'mozjpeg', PNG: 'oxipng', SVG: 'svgo',
}
```

---

### `src/components/panels/inspector/SvgoPanel.tsx` (component, request-response)

**Analog:** `src/components/panels/FilesPane.tsx` (list render + store read pattern)

**Imports pattern:**
```typescript
// Phase 04 — INSP-06: SvgoPanel with aggressive toggle + plugin grid. Source: 04-XX-PLAN.md
import { useStore } from '@nanostores/react'
import { settingsAtom, setAggressive, togglePlugin } from '@/stores/settings'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Section } from './Section'
```

**Store read + list map pattern** (from `src/components/panels/FilesPane.tsx` lines 19–22):
```typescript
const settings = useStore(settingsAtom)
// then:
{settings.plugins.map((p) => (
  <button key={p.id} onClick={() => togglePlugin(p.id)} ... />
))}
```

**Plugin grid layout** (from RESEARCH.md Pattern 6):
```typescript
<div className="grid grid-cols-2 gap-1">
  {settings.plugins.map((p) => (
    <button
      key={p.id}
      onClick={() => togglePlugin(p.id)}
      className={cn(
        'flex flex-col items-start px-1.5 py-1 rounded text-[10px] border transition-colors',
        p.on
          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-fg-0)]'
          : 'border-[var(--color-line)] bg-transparent text-[var(--color-fg-3)]'
      )}
    >
      <span className="font-mono leading-tight">{p.id}</span>
      <span className="text-[9px] text-[var(--color-fg-3)]">{p.saves}</span>
    </button>
  ))}
</div>
```

---

### `src/components/panels/inspector/Section.tsx` (utility component)

**Analog:** Inline div pattern from `src/components/panels/FilesPane.tsx` (border-b sections)

**Full component** (from RESEARCH.md Pattern 5 — port directly):
```typescript
// Phase 04 — shared Section wrapper for inspector panels. Source: 04-XX-PLAN.md
import { cn } from '@/lib/utils'
interface SectionProps {
  title: string
  badge?: { text: string; acc?: boolean }
  children: React.ReactNode
}
export function Section({ title, badge, children }: SectionProps) {
  return (
    <div className="border-b border-[var(--color-line)] px-3 py-2">
      <h3 className="flex items-center justify-between text-[10px] font-medium text-[var(--color-fg-2)] uppercase tracking-wider mb-2">
        <span>{title}</span>
        {badge && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono',
            badge.acc
              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-2)] text-[var(--color-fg-3)]'
          )}>{badge.text}</span>
        )}
      </h3>
      {children}
    </div>
  )
}
```

---

### `src/components/panels/inspector/SegControl.tsx` (utility component)

**Analog:** `src/components/shell/Toolbar/Toolbar.tsx` lines 117–136 (segmented view switcher using button group + aria-checked)

**Toolbar segmented control pattern** (lines 117–136 of Toolbar.tsx):
```typescript
// Toolbar uses: role="group", aria-label, role="radio", aria-checked per button
<div role="group" aria-label="Switch view"
     className="flex h-7 bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-[5px]">
  {(['Batch', 'Compare', 'Report'] as View[]).map((v, i) => (
    <button
      key={v} type="button" role="radio" aria-checked={view === v}
      onClick={() => setView(v)}
      className={cn(
        'px-3 text-xs rounded-[4px]',
        i > 0 && 'border-l border-[var(--color-line)]',
        view === v ? 'bg-[var(--color-bg-3)] text-[var(--color-fg-0)]' : 'text-[var(--color-fg-1)]'
      )}
    >{v}</button>
  ))}
</div>
```

**SegControl component** (from RESEARCH.md Pattern 4 — generalized version):
```typescript
// Phase 04 — shared SegControl for inspector panels. Source: 04-XX-PLAN.md
import { cn } from '@/lib/utils'
interface SegControlProps {
  options: readonly string[]
  value: string
  onChange: (v: string) => void
}
export function SegControl({ options, value, onChange }: SegControlProps) {
  return (
    <div role="group" className="flex rounded border border-[var(--color-line)] overflow-hidden">
      {options.map((o, i) => (
        <button
          key={o} type="button" role="radio" aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn(
            'flex-1 px-2 py-0.5 text-[11px] font-mono transition-colors',
            i > 0 && 'border-l border-[var(--color-line)]',
            o === value
              ? 'bg-[var(--color-accent)] text-black'
              : 'bg-[var(--color-bg-1)] text-[var(--color-fg-2)] hover:text-[var(--color-fg-0)]'
          )}
        >{o}</button>
      ))}
    </div>
  )
}
```

---

## Shared Patterns

### nanostores map + setKey action
**Source:** `src/stores/ui.ts` lines 24–81
**Apply to:** `settings.ts`
```typescript
// All state mutations go through atom.setKey('fieldName', value)
// Never mutate state directly
export const myAtom = map<MyState>({ ... })
export function setField(v: FieldType): void { myAtom.setKey('field', v) }
```

### useStore read in components
**Source:** `src/components/shell/Toolbar/Toolbar.tsx` line 25; `src/components/panels/FilesPane.tsx` lines 20–21
**Apply to:** InspectorPane, CodecPanel, SvgoPanel
```typescript
const { tab } = useStore(uiAtom)           // destructure specific keys
const files = useStore($filteredFiles)     // use whole value for computed atoms
```

### Phase attribution header comment
**Source:** All existing files (e.g., `src/stores/ui.ts` line 1, `src/stores/files.ts` line 1)
**Apply to:** ALL new files
```typescript
// Phase 04 — {REQ-ID}: {description}. Source: {PLAN-FILE}.md
```

### CSS design token variables
**Source:** `src/components/panels/FilesPane.tsx` (uses `var(--line)`, `var(--bg-1)`, `var(--fg-2)`)  
**Note:** InspectorPane stub (lines 8–9) uses `var(--color-line)` / `var(--color-bg-1)` — check which token prefix is live and use consistently. FilesPane uses the shorter form `var(--line)`.
**Apply to:** All inspector panel components — use Tailwind classes with CSS custom property references only, no hardcoded colors.

### Circular ESM guard
**Source:** `src/stores/ui.ts` lines 3–4 (comment) + `src/stores/files.ts` line 1
**Apply to:** `settings.ts` must carry the same guard comment:
```typescript
// CIRCULAR ESM GUARD: settings.ts MUST NOT import ui.ts, files.ts, or runtime.ts
```

---

## No Analog Found

No files in this phase are without analogs — all 8 files have close matches in the codebase.

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/panels/`, `src/components/shell/`, `src/tests/`, `src/components/ui/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-05-20
