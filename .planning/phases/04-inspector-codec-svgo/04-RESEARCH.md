# Phase 4: Inspector Pane — Codec + SVGO - Research

**Researched:** 2026-05-19
**Domain:** React inspector panel — nanostores settingsAtom, InspectorPane, CodecPanel, SvgoPanel, Shadcn Slider/Switch/Tabs, tab auto-switching
**Confidence:** HIGH

---

## Summary

Phase 4 implements the right-hand InspectorPane by wiring a new `settingsAtom` (STORE-02) and building three UI layers: the InspectorPane header + tab bar (INSP-01), CodecPanel (INSP-02 through INSP-05), and SvgoPanel (INSP-06). The full reference design is in `example-ui/panels.jsx`, which is already complete. The only unknowns are the exact TypeScript API for the already-generated Shadcn components and the tab auto-switching mechanism.

Key insight: STORE-02 (`src/stores/settings.ts`) must be created this phase. It exports all types and constants (`Codec`, `SvgoPlugin`, `CODECS`, `RESIZE_ALGS`, `FIT_MODES`) so that downstream components import from `stores/settings.ts`, not from `lib/stub-data.ts`. The circular ESM guard from Phase 3 stays intact: `ui.ts` must never import `settings.ts`.

Tab auto-switching (INSP-01: svg→'svgo', non-svg+'svgo'→'codec') is a `useEffect` inside `InspectorPane` that subscribes to `$selectedFile` from `filesAtom` and calls `setTab` from `ui.ts`. This is a component-level derived effect, not a store-level computed — keeping `ui.ts` import-free from the other stores.

**Primary recommendation:** Build in three waves: Wave 1 = `settingsAtom`; Wave 2 = InspectorPane shell + CodecPanel; Wave 3 = SvgoPanel + unit tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Codec/quality/resize/meta settings state | `src/stores/settings.ts` | — | New atom this phase; all panel components read/write it |
| SVGO plugin on/off state | `src/stores/settings.ts` | — | `plugins: SvgoPlugin[]` keyed by id in settingsAtom |
| Tab auto-switch (svg→svgo) | `InspectorPane` useEffect | `uiAtom.setTab` | Component reads `$selectedFile`, calls `setTab` — avoids ui.ts importing files.ts |
| InspectorPane tab state | `uiAtom.tab` | — | Already exists; setTab already exported from ui.ts |
| Segmented control (Fit/Alg/Palette/Subsample) | `InspectorPane` sub-components | Inline buttons | No Shadcn Seg component — build a small `SegControl` primitive |
| Slider (Quality/Effort) | Shadcn `Slider` | — | Already generated at `src/components/ui/slider.tsx` |
| Toggle (Lossless/ResizeOn/StripMeta/KeepIcc/Aggressive) | Shadcn `Switch` | — | Already generated at `src/components/ui/switch.tsx` |
| Tab bar | Shadcn `Tabs` / `TabsList` / `TabsTrigger` | — | Already generated at `src/components/ui/tabs.tsx` |
| Width/Height inputs | Shadcn `Input` | — | Already generated at `src/components/ui/input.tsx` |

---

## Project Constraints (from CLAUDE.md)

- **Circular ESM guard:** `ui.ts` MUST NOT import from `files.ts`, `runtime.ts`, or **`settings.ts`** (Phase 4 adds this rule)
- **STORE-08:** Zero `useState` for data in components; only ephemeral hover/focus state allowed
- **Tailwind utility classes only** — no CSS modules, no inline styles
- **All files require phase/plan attribution header comment**
- **Components read data exclusively via `useStore(atom)` or exported constants from stores**
- **Tech stack:** React 19 + nanostores + `@nanostores/react` `useStore(atom)` pattern
- **Icon library:** `@phosphor-icons/react` — use established ICON-01 mapping

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-02 | `src/stores/settings.ts` — `settingsAtom` with full codec/resize/SVGO state + all actions + exported types (`Codec`, `SvgoPlugin`) and constants (`CODECS`, `RESIZE_ALGS`, `FIT_MODES`) | nanostores `map()` pattern, identical to files.ts and ui.ts; initial plugins from `SVGO_PLUGINS` in stub-data.ts |
| INSP-01 | `InspectorPane` header + tab bar; tab auto-switches on `$selectedFile.type` change (svg→'svgo', non-svg+'svgo'→'codec'); tab state in `uiAtom.tab` | Shadcn `Tabs`/`TabsList`/`TabsTrigger` already generated; useEffect subscribes to $selectedFile |
| INSP-02 | `CodecPanel` "Output format" section — codec selector buttons + lossless toggle | `CODECS` from settingsAtom; Shadcn `Switch` for lossless; inline buttons for codec seg |
| INSP-03 | `CodecPanel` "Parameters" section — quality Slider, effort Slider, PNG palette Seg, AVIF subsample Seg; section badge shows codec engine name | Shadcn `Slider`; custom `SegControl`; conditional render on `settingsAtom.codec` |
| INSP-04 | `CodecPanel` "Resize" section — resizeOn toggle + w/h inputs + Fit/Algorithm segs | Shadcn `Switch`, `Input`; custom `SegControl`; `FIT_MODES`, `RESIZE_ALGS` from settingsAtom |
| INSP-05 | `CodecPanel` "Metadata" section — stripMeta toggle + keepIcc toggle | Two Shadcn `Switch` components |
| INSP-06 | `SvgoPanel` — aggressive mode toggle + plugin grid (22 plugins from stub data) | `settingsAtom.plugins`; `togglePlugin(id)` action; CSS grid layout |
</phase_requirements>

---

## Standard Stack

### Core (already installed — verified from codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nanostores` | installed | `settingsAtom` map store | Project's chosen state primitive [VERIFIED: src/stores/ui.ts, files.ts] |
| `@nanostores/react` | installed | `useStore(atom)` hook in panels | Already used in FilesPane, FileRow [VERIFIED: codebase] |
| Shadcn `Slider` | generated | Quality (0-100) + Effort (0-6) sliders | Already at `src/components/ui/slider.tsx` [VERIFIED: filesystem] |
| Shadcn `Switch` | generated | All boolean toggles (lossless, resizeOn, stripMeta, keepIcc, aggressive) | Already at `src/components/ui/switch.tsx` [VERIFIED: filesystem] |
| Shadcn `Tabs` | generated | InspectorPane tab bar (Codec/SVGO/Output/Report) | Already at `src/components/ui/tabs.tsx` [VERIFIED: filesystem] |
| Shadcn `Input` | generated | Width/Height resize inputs | Already at `src/components/ui/input.tsx` [VERIFIED: filesystem] |
| `@phosphor-icons/react` | installed | Icons for pane header options button | ICON-01 mapping [VERIFIED: codebase] |

### Supporting (needs creation)

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `SegControl` (inline) | Segmented button group (Fit/Alg/Palette/Subsample) | No Shadcn equivalent — 5-10 LOC inline button group using Tailwind |
| `Section` (inline) | Panel section wrapper with title + optional badge | Port directly from `panels.jsx` Section component |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shadcn `Slider` (single thumb) | native `<input type="range">` | Shadcn Slider uses Radix `@radix-ui/react-slider` — a11y-correct, keyboard nav built in; worth the import |
| Custom `SegControl` | Shadcn `Tabs` (line variant) | Tabs are semantically correct for tab bars; for inline segs (Fit/Alg) a simple button group is lighter and matches panels.jsx pattern |

**Installation:** Nothing new to install — all dependencies are already present.

---

## Package Legitimacy Audit

No new packages installed this phase — all dependencies are already present in the project.

---

## Architecture Patterns

### System Architecture Diagram

```
InspectorPane (reads uiAtom.tab + $selectedFile)
  │
  ├─ useEffect: $selectedFile.type changes
  │     └─ type === 'svg'          ──► setTab('svgo')
  │     └─ type !== 'svg' AND tab === 'svgo' ──► setTab('codec')
  │
  ├─ TabsList (Codec | SVGO | Output | Report)
  │     └─ TabsTrigger click ──► setTab(t)
  │
  ├─ tab === 'codec' ──► CodecPanel (reads settingsAtom)
  │     ├─ Output format: codec selector buttons + Switch[lossless]
  │     ├─ Parameters: Slider[quality] + Slider[effort] + SegControl[palette/subsample]
  │     ├─ Resize: Switch[resizeOn] → Input[w] + Input[h] + SegControl[fit] + SegControl[alg]
  │     └─ Metadata: Switch[stripMeta] + Switch[keepIcc]
  │
  ├─ tab === 'svgo' ──► SvgoPanel (reads settingsAtom)
  │     ├─ SVGO preset: Switch[aggressive]
  │     └─ Plugins grid: settingsAtom.plugins.map(p => PluginChip[p.on, p.id, p.saves])
  │
  ├─ tab === 'output' ──► OutputPanel stub (Phase 6)
  └─ tab === 'report' ──► ReportPanel stub (Phase 6)

settingsAtom (src/stores/settings.ts)
  ├─ imports: nanostores/map, SVGO_PLUGINS from lib/stub-data
  ├─ exports: settingsAtom, all actions, Codec type, SvgoPlugin type
  └─ exports constants: CODECS, RESIZE_ALGS, FIT_MODES (re-export from stub-data)
```

### Recommended Project Structure

```
src/
├── stores/
│   └── settings.ts            # STORE-02 (new this phase)
├── components/
│   └── panels/
│       ├── InspectorPane.tsx   # INSP-01: shell + tabs + tab auto-switch
│       ├── inspector/
│       │   ├── CodecPanel.tsx  # INSP-02 through INSP-05
│       │   ├── SvgoPanel.tsx   # INSP-06
│       │   ├── Section.tsx     # Shared section wrapper (title + badge)
│       │   └── SegControl.tsx  # Shared segmented button group
├── tests/
│   └── settings.test.ts        # Wave 0: settingsAtom unit tests
```

### Pattern 1: settingsAtom (nanostores map — same pattern as ui.ts and files.ts)

```typescript
// Source: src/stores/ui.ts (project convention)
// Phase 04 — STORE-02: settingsAtom
import { map } from 'nanostores'
import type { SvgoPlugin } from '@/lib/stub-data'
import { SVGO_PLUGINS } from '@/lib/stub-data'

export type Codec = 'SVG' | 'PNG' | 'WebP' | 'JPEG' | 'AVIF'

interface SettingsState {
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
}

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

export const CODECS = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF'] as const
export const RESIZE_ALGS = ['lanczos3', 'mitchell', 'catrom', 'triangle'] as const
export const FIT_MODES = ['cover', 'contain', 'fill'] as const

export function setCodec(c: Codec): void { settingsAtom.setKey('codec', c) }
export function setQuality(q: number): void { settingsAtom.setKey('q', q) }
export function setMethod(m: number): void { settingsAtom.setKey('method', m) }
export function setLossless(v: boolean): void { settingsAtom.setKey('lossless', v) }
export function setResizeOn(v: boolean): void { settingsAtom.setKey('resizeOn', v) }
export function setResizeDimensions(w: string, h: string): void {
  settingsAtom.setKey('w', w); settingsAtom.setKey('h', h)
}
export function setFit(f: string): void { settingsAtom.setKey('fit', f) }
export function setAlg(a: string): void { settingsAtom.setKey('alg', a) }
export function setStripMeta(v: boolean): void { settingsAtom.setKey('stripMeta', v) }
export function setKeepIcc(v: boolean): void { settingsAtom.setKey('keepIcc', v) }
export function setAggressive(v: boolean): void { settingsAtom.setKey('aggressive', v) }
export function togglePlugin(id: string): void {
  settingsAtom.setKey('plugins', settingsAtom.get().plugins.map(p =>
    p.id === id ? { ...p, on: !p.on } : p
  ))
}
```

### Pattern 2: Tab auto-switching useEffect in InspectorPane

```typescript
// Source: REQUIREMENTS.md INSP-01 spec + STORE-08 convention
// CIRCULAR ESM GUARD: InspectorPane imports from files.ts and ui.ts, NOT the reverse
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { uiAtom, setTab } from '@/stores/ui'

export function InspectorPane() {
  const { tab } = useStore(uiAtom)
  const selectedFile = useStore($selectedFile)

  // Tab auto-switch: svg file → 'svgo'; non-svg when svgo tab active → 'codec'
  useEffect(() => {
    if (!selectedFile) return
    if (selectedFile.type === 'svg') {
      setTab('svgo')
    } else if (tab === 'svgo') {
      setTab('codec')
    }
  }, [selectedFile?.id, selectedFile?.type])
  // ...
}
```

**Note:** The effect depends on `selectedFile?.id` and `selectedFile?.type` to avoid re-running on unrelated store changes. Do NOT depend on `tab` in the array — that would create an infinite loop when `setTab` is called inside the effect.

### Pattern 3: Shadcn Slider usage (already generated)

```typescript
// Source: src/components/ui/slider.tsx (verified)
// Slider requires value as array; onValueChange receives array
<Slider
  min={0} max={100} step={1}
  value={[settings.q]}
  onValueChange={([v]) => setQuality(v)}
  className="w-full"
/>
```

**Critical:** The generated Shadcn Slider wraps Radix `SliderPrimitive.Root`. `value` must be `number[]`, not `number`. `onValueChange` receives `number[]`.

### Pattern 4: SegControl (custom segmented buttons — no Shadcn equivalent)

```typescript
// Inline pattern from panels.jsx, ported to Tailwind
function SegControl({ options, value, onChange }: {
  options: readonly string[],
  value: string,
  onChange: (v: string) => void
}) {
  return (
    <div className="flex rounded border border-[var(--color-line)] overflow-hidden">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            'flex-1 px-2 py-0.5 text-[11px] font-mono transition-colors',
            o === value
              ? 'bg-[var(--color-accent)] text-black'
              : 'bg-[var(--color-bg-1)] text-[var(--color-fg-2)] hover:text-[var(--color-fg-0)]'
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
```

### Pattern 5: Section wrapper component

```typescript
// Ported from panels.jsx Section component
function Section({ title, badge, children }: {
  title: string
  badge?: { text: string; acc?: boolean }
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-[var(--color-line)] px-3 py-2">
      <h3 className="flex items-center justify-between text-[10px] font-medium text-[var(--color-fg-2)] uppercase tracking-wider mb-2">
        <span>{title}</span>
        {badge && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono',
            badge.acc ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'bg-[var(--color-bg-2)] text-[var(--color-fg-3)]'
          )}>
            {badge.text}
          </span>
        )}
      </h3>
      {children}
    </div>
  )
}
```

### Pattern 6: Plugin grid (SvgoPanel)

```typescript
// From panels.jsx SvgoPanel — grid layout for 22 plugins
// Use CSS grid 2 columns; each chip shows: checkbox visual, plugin id, saves%
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

### Pattern 7: Codec engine badge map

```typescript
// From panels.jsx CodecPanel — badge shows codec engine name
const CODEC_ENGINE: Record<string, string> = {
  AVIF: 'libavif',
  WebP: 'libwebp',
  JPEG: 'mozjpeg',
  PNG: 'oxipng',
  SVG: 'svgo',
}
```

### Anti-Patterns to Avoid

- **Importing `SVGO_PLUGINS`, `CODECS`, `RESIZE_ALGS`, or `FIT_MODES` from `lib/stub-data.ts` in components:** These must be re-exported from `stores/settings.ts`. Components import from the store, not stub-data (STORE-08).
- **Importing `settings.ts` from `ui.ts`:** Circular ESM guard — would break the entire store cycle. The tab auto-switch effect lives in `InspectorPane`, not in `ui.ts`.
- **Passing `value={settings.q}` to Shadcn Slider:** The Shadcn Slider expects `value={[settings.q]}` (array). Passing a number will cause a type error and broken rendering.
- **Using `tab` in the useEffect dependency array for auto-switching:** Causes infinite loop. Depend only on `selectedFile?.id` and `selectedFile?.type`.
- **Making `OutputPanel`/`ReportPanel` functional this phase:** They are Phase 6. Render stub placeholders ("Output — coming in Phase 6") that still occupy the tab.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible slider | Custom range input | Shadcn `Slider` (Radix) | Keyboard nav, ARIA attrs, touch support included |
| Toggle/switch | Custom div with onClick | Shadcn `Switch` (Radix) | ARIA role="switch", keyboard Space/Enter, focus ring |
| Tab bar | Custom button row with active state | Shadcn `Tabs`/`TabsList`/`TabsTrigger` | Radix handles ARIA tablist/tab/tabpanel roles, roving focus |
| Segmented control | Import a new library | 8-line inline `SegControl` helper | Too small to justify a dep; panels.jsx already shows the pattern |

---

## Common Pitfalls

### Pitfall 1: Shadcn Slider value type mismatch
**What goes wrong:** `<Slider value={settings.q} />` passes a number; Radix expects `number[]`. Renders but breaks thumb positioning; TypeScript will catch at compile time if strict.
**Why it happens:** panels.jsx Slider is a custom component accepting `value: number`; Shadcn's wraps Radix which always uses arrays for multi-thumb support.
**How to avoid:** Always pass `value={[settings.q]}` and destructure in `onValueChange={([v]) => setQuality(v)}`.
**Warning signs:** TypeScript error on `value` prop; slider thumb stuck at min.

### Pitfall 2: Circular ESM at import time
**What goes wrong:** Adding `import { $selectedFile } from '@/stores/files'` inside `ui.ts` or `settings.ts` creates a runtime cycle that Vite resolves as `undefined` at module init, breaking all derived atoms.
**Why it happens:** The tab auto-switch logic feels like it belongs in a store, but it requires reading two stores.
**How to avoid:** Tab auto-switch is a component `useEffect` in `InspectorPane` — reads `$selectedFile` and calls `setTab`. `ui.ts` stays import-free from other stores.
**Warning signs:** `uiAtom` or `settingsAtom` is `undefined` at startup; Vite circular dependency warning in dev console.

### Pitfall 3: useEffect infinite loop on tab auto-switch
**What goes wrong:** Including `tab` in the effect dependency array causes: effect runs → setTab('svgo') → tab changes → effect runs again → loop.
**Why it happens:** Natural instinct to include all referenced values in the dep array.
**How to avoid:** The effect only needs to re-run when the *selected file changes*. Read `tab` outside the effect for the guard condition; don't include it in deps.
**Warning signs:** React DevTools shows repeated renders; tab flickers.

### Pitfall 4: Constants imported from stub-data in components
**What goes wrong:** `import { CODECS } from '@/lib/stub-data'` in a component violates STORE-08 (the convention that components don't import stub-data directly).
**Why it happens:** `CODECS` exists in stub-data.ts — it's tempting to import it directly.
**How to avoid:** `settings.ts` re-exports `CODECS`, `RESIZE_ALGS`, `FIT_MODES`. Components import from `@/stores/settings`.
**Warning signs:** Phase 7 STORE-08 audit fails; Phase 7 grep finds stub-data imports in component files.

### Pitfall 5: OutputPanel/ReportPanel stubs omitted entirely
**What goes wrong:** `uiAtom.tab` can be `'output'` or `'report'` from Phase 3 commands. If InspectorPane renders nothing for these tabs, the pane goes blank and looks broken.
**Why it happens:** These are Phase 6 requirements; easy to skip.
**How to avoid:** Render a `<div className="p-3 text-xs text-[var(--color-fg-3)]">Output — Phase 6</div>` placeholder for each unimplemented tab.

---

## Runtime State Inventory

Step 2.5 SKIPPED — this is a greenfield phase (new store + new components, no rename/refactor/migration).

---

## Environment Availability

Step 2.6 SKIPPED — no external dependencies beyond the project's own already-installed packages. All Shadcn components, nanostores, and icon library are already present and verified in the codebase.

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node `--experimental-strip-types` (TypeScript native, no Jest/Vitest) |
| Config file | none — run directly with node flag |
| Quick run command | `node --experimental-strip-types src/tests/settings.test.ts` |
| Full suite command | `node --experimental-strip-types src/tests/stores.test.ts && node --experimental-strip-types src/tests/settings.test.ts && node --experimental-strip-types src/tests/stub-data.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-02 | settingsAtom defaults, all actions, togglePlugin | unit | `node --experimental-strip-types src/tests/settings.test.ts` | ❌ Wave 0 |
| INSP-01 | Tab auto-switch: svg file → 'svgo' tab | unit (store) | `node --experimental-strip-types src/tests/settings.test.ts` | ❌ Wave 0 |
| INSP-02 | Codec selector buttons + lossless toggle renders | visual/manual | playwright `npm run test:e2e` | ❌ manual |
| INSP-03 | Sliders + conditional PNG/AVIF sections | visual/manual | playwright `npm run test:e2e` | ❌ manual |
| INSP-04 | Resize section toggle show/hide | visual/manual | playwright `npm run test:e2e` | ❌ manual |
| INSP-05 | Metadata toggles | visual/manual | playwright `npm run test:e2e` | ❌ manual |
| INSP-06 | SvgoPanel 22 plugins grid, toggle state | visual/manual | playwright `npm run test:e2e` | ❌ manual |

### Sampling Rate

- **Per task commit:** `node --experimental-strip-types src/tests/settings.test.ts`
- **Per wave merge:** full suite (stores + settings + stub-data tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/tests/settings.test.ts` — covers STORE-02 (settingsAtom defaults + all actions + togglePlugin)

---

## Security Domain

This phase is entirely client-side UI state management with no authentication, network calls, external data ingestion, or cryptographic operations. No ASVS categories apply. Input validation for width/height fields (`w`, `h` stored as strings) is in-scope for a future audit but is not a security concern here — values only affect local rendering.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 3 is complete — `uiAtom.setTab`, `$selectedFile`, `filesAtom` all exist as documented | Standard Stack | If Phase 3 is not complete, InspectorPane cannot wire tab auto-switch. Verify Phase 3 completion before starting Phase 4. |
| A2 | `SVGO_PLUGINS` in stub-data.ts has exactly 22 entries | Standard Stack | Count verified from live read of stub-data.ts: 22 entries [VERIFIED: codebase] |
| A3 | Shadcn `Tabs` uses `value`/`onValueChange` props (controlled mode) identical to Radix TabsPrimitive | Architecture Patterns | [VERIFIED: src/components/ui/tabs.tsx live read] — uses `TabsPrimitive.Root` which takes value/onValueChange |

**All other claims in this document are VERIFIED from codebase live reads.**

---

## Open Questions

1. **Does Phase 3 need to be verified-complete before Phase 4 starts?**
   - What we know: Phase 3 is listed as "EXECUTING" in STATE.md; `ui.ts`, `runtime.ts`, and `commands.ts` are already present in the codebase
   - What's unclear: Whether NAV-01 through NAV-04 (TitleBar, Toolbar, StatusBar, CommandPalette) are functionally complete or still stub
   - Recommendation: Phase 4 only needs `uiAtom.setTab`, `$selectedFile`, and `filesAtom` — all of which exist. Phase 4 can proceed regardless of NAV-01–04 status.

2. **Should `CODECS`, `RESIZE_ALGS`, `FIT_MODES` stay in `stub-data.ts` or move entirely to `settings.ts`?**
   - What we know: They currently live in `stub-data.ts` (STORE-05, Phase 1); REQUIREMENTS.md STORE-02 says they should be "constants exported" from `settings.ts`
   - What's unclear: Whether to delete from stub-data or re-export
   - Recommendation: Re-export from `settings.ts` (`export { CODECS, RESIZE_ALGS, FIT_MODES } from '@/lib/stub-data'`). Do NOT delete from stub-data — that breaks STORE-05 traceability. Components import from `stores/settings`, not stub-data.

---

## Sources

### Primary (HIGH confidence)

- `src/stores/ui.ts` (live read) — nanostores map pattern, CIRCULAR ESM GUARD comment, Tab type definition
- `src/stores/files.ts` (live read) — $selectedFile computed atom pattern
- `src/lib/stub-data.ts` (live read) — SVGO_PLUGINS (22 entries verified), CODECS, RESIZE_ALGS, FIT_MODES constants
- `example-ui/panels.jsx` (live read) — Section, Slider, Seg, Toggle, CodecPanel, SvgoPanel reference implementations
- `src/components/ui/slider.tsx` (live read) — Shadcn Slider API: `value: number[]`, `onValueChange: (vals: number[]) => void`
- `src/components/ui/switch.tsx` (live read) — Shadcn Switch API: Radix SwitchPrimitive.Root props
- `src/components/ui/tabs.tsx` (live read) — Shadcn Tabs API: TabsList, TabsTrigger, TabsContent; `value`/`onValueChange` controlled
- `.planning/REQUIREMENTS.md` (live read) — STORE-02, INSP-01 through INSP-06 specifications
- `.planning/STATE.md` (live read) — Circular ESM guard convention, STORE-08 zero-useState rule

### Secondary (MEDIUM confidence)

- `.planning/phases/03-navigation-shell/03-RESEARCH.md` (live read) — nanostores pattern confirmation, STORE-08 enforcement approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified in filesystem; all stores verified in codebase
- Architecture: HIGH — reference implementation in panels.jsx is complete; tab auto-switch pattern is unambiguous
- Pitfalls: HIGH — Slider array value is a known Radix gotcha; ESM guard is documented in ui.ts; dep array loop is a React fundamental

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable — no fast-moving external deps)
