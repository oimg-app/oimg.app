# Phase 1: Shell + Foundation - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 14 new/modified files
**Analogs found:** 6 / 14 (8 are net-new with no codebase analog — use RESEARCH.md patterns)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/main.tsx` | config/entry | request-response | `src/main.tsx` (existing) | exact — modify in-place |
| `vite.config.ts` | config | request-response | `vite.config.ts` (existing) | exact — modify in-place |
| `public/_headers` | config | — | none | no analog |
| `src/index.css` | config/tokens | — | `src/index.css` (existing) | exact — modify in-place |
| `src/App.tsx` | component | request-response | `src/App.tsx` (existing) | exact — replace body |
| `src/hooks/useTheme.ts` | hook | event-driven | none | no analog |
| `src/types/index.ts` | utility | — | `example-ui/data.jsx` (shapes) | partial |
| `src/data/defaults.ts` | utility | — | `example-ui/data.jsx` | role-match |
| `src/components/icons/index.tsx` | component | — | `example-ui/icons.jsx` | role-match |
| `src/components/shell/AppShell.tsx` | component | request-response | `src/App.tsx` | partial |
| `src/components/shell/TitleBar.tsx` | component | event-driven | `example-ui/app.jsx` lines 40–200 | partial |
| `src/components/shell/Toolbar.tsx` | component | event-driven | `example-ui/app.jsx` | partial |
| `src/components/shell/StatusBar.tsx` | component | request-response | `example-ui/app.jsx` | partial |
| `src/components/panels/FilePanel.tsx` | component | request-response | `example-ui/panels.jsx` | role-match |
| `src/components/panels/DetailPanel.tsx` | component | request-response | `example-ui/panels.jsx` | role-match |
| `src/components/panels/TweaksPanel.tsx` | component | event-driven | `example-ui/tweaks-panel.jsx` | role-match |

---

## Pattern Assignments

### `src/main.tsx` (config/entry — modify in-place)

**Analog:** `src/main.tsx` (existing, lines 1–10)

**Existing pattern** (lines 1–10):
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Add before `./index.css` import** (RESEARCH.md Pattern 3):
```typescript
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
```

**Add after imports, before createRoot** (RESEARCH.md Code Examples):
```typescript
if (!crossOriginIsolated) {
  console.error(
    '[oimg] crossOriginIsolated is false. ' +
    'COOP/COEP headers are missing or a cross-origin resource is blocking COEP. ' +
    'Codec workers will not function in Phase 2+.'
  )
}
```

---

### `vite.config.ts` (config — modify in-place)

**Analog:** `vite.config.ts` (existing, lines 1–16)

**Existing pattern** (lines 1–16) — add `server.headers` block:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // ADD: COOP/COEP for crossOriginIsolated in dev (D-02)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

---

### `public/_headers` (config — create new)

**Analog:** none in codebase. Use RESEARCH.md Pattern 2.

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

Note: file lives at `public/_headers` so Vite copies it to `dist/_headers` on build.

---

### `src/index.css` (config/tokens — modify in-place)

**Analog:** `src/index.css` (existing, lines 1–80)

**Remove** line 5 (Google Fonts CDN — COEP violation):
```css
/* DELETE THIS LINE: */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap");
```

**Existing token pattern to preserve** (lines 10–80) — all `--color-*`, `--font-*`, `.dark {}` block, shadcn semantic aliases. Do not replace these; they are the live source of truth.

**Token convention** (lines 10–11):
```css
@custom-variant dark (&:is(.dark *));
```
This means `.dark` must be toggled on `<html>` (not a child element) for dark theme to apply to all descendants.

---

### `src/App.tsx` (component — replace body)

**Analog:** `src/App.tsx` (existing, lines 1–14) — currently a placeholder.

**Replace entire body with AppShell composition:**
```tsx
import { AppShell } from '@/components/shell/AppShell'
import { useTheme } from '@/hooks/useTheme'

export default function App() {
  const { theme, toggle } = useTheme()
  return <AppShell theme={theme} onThemeToggle={toggle} />
}
```

**Import convention from existing** (line 1):
```typescript
import { Button } from '@/components/ui/button'
// Pattern: named exports from @/components/ui/* always use @/ alias
```

---

### `src/hooks/useTheme.ts` (hook — create new)

**Analog:** none in codebase. Use RESEARCH.md Pattern 4 verbatim.

**Full pattern** (RESEARCH.md lines 237–261):
```typescript
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('oimg-theme') as Theme) ?? 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('oimg-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
```

**Key constraint:** `root.classList.add('dark')` targets `document.documentElement` — required because `src/index.css` line 10 uses `@custom-variant dark (&:is(.dark *))`.

---

### `src/types/index.ts` (utility — create new)

**Analog:** `example-ui/data.jsx` lines 3–16 (FILES array shape)

**TypeScript interfaces derived from prototype data shapes:**
```typescript
// Derived from example-ui/data.jsx FILES array
export type FileStatus = 'done' | 'processing' | 'queued' | 'error'
export type TargetCodec = 'svg' | 'png' | 'webp' | 'jpeg' | 'avif'
export type FileType = 'svg' | 'png' | 'jpg' | 'webp' | 'avif'

export interface FileEntry {
  id: string
  name: string
  type: FileType
  orig: number       // bytes
  opt: number | null // bytes, null if not processed
  status: FileStatus
  target: TargetCodec
  dim: string        // e.g. "2400×1600"
  q: number | null   // quality 0–100, null for SVG
  prog?: number      // 0–1 for processing status
}

export interface SvgoPlugin {
  id: string
  on: boolean
  saves: string  // e.g. "14.3%"
}
```

---

### `src/data/defaults.ts` (utility — create new)

**Analog:** `example-ui/data.jsx` (full file)

**Pattern — export named consts, no window globals** (contrast with prototype's `window.MOCK`):
```typescript
// src/data/defaults.ts
// Ported from example-ui/data.jsx — static mock data + utility functions
import type { FileEntry, SvgoPlugin } from '@/types'

export const MOCK_FILES: FileEntry[] = [
  { id: 'f1', name: 'hero-banner@2x.png', type: 'png', orig: 1842300, opt: 412800,
    status: 'done', target: 'webp', dim: '2400×1600', q: 82 },
  // ... (port all 12 entries from example-ui/data.jsx lines 3–16)
]

export const SVGO_PLUGINS: SvgoPlugin[] = [
  // ... (port from example-ui/data.jsx lines 18–41)
]

export const CODECS = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF'] as const
export const RESIZE_ALG = ['lanczos3', 'mitchell', 'catrom', 'triangle'] as const
export const FIT_MODES = ['cover', 'contain', 'fill'] as const

// Utility functions (no window globals — use module exports)
export function fmtBytes(b: number | null): string {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}

export function fmtPct(orig: number, opt: number | null): string {
  if (!orig || !opt) return '—'
  const saved = ((orig - opt) / orig) * 100
  return (saved >= 0 ? '−' : '+') + Math.abs(saved).toFixed(1) + '%'
}
```

---

### `src/components/icons/index.tsx` (component — create new)

**Analog:** `example-ui/icons.jsx` lines 1–8 (base `Ic` component)

**TypeScript port of prototype pattern** (from `example-ui/icons.jsx`):
```tsx
// src/components/icons/index.tsx
// Port of example-ui/icons.jsx — custom SVG icons, Lucide-style hairline

interface IcProps {
  d?: string
  paths?: React.ReactNode
  size?: number
  sw?: number
  className?: string
}

function Ic({ d, paths, size = 13, sw = 1.5, ...rest }: IcProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {paths ?? <path d={d} />}
    </svg>
  )
}

// Named icon exports (ported from example-ui/icons.jsx lines 10–end)
export const Icons = {
  Sun: (p: IcProps) => <Ic {...p} paths={<>...</>} />,
  Moon: (p: IcProps) => <Ic {...p} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  // ... (port all icons verbatim from example-ui/icons.jsx)
}
```

**Note:** `lucide-react` is registered in `components.json` and available for generic icons. Custom icons in `example-ui/icons.jsx` (Sun, Moon, Upload, etc.) must be ported as above — do not replace with lucide variants without visual comparison.

---

### `src/components/shell/AppShell.tsx` (component — create new)

**Analog:** `src/App.tsx` (structure), `example-ui/app.jsx` lines 40–120 (layout intent)

**Shell component pattern** — use landmark ARIA (RESEARCH.md Code Examples):
```tsx
// src/components/shell/AppShell.tsx
import { cn } from '@/lib/utils'

interface AppShellProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

export function AppShell({ theme, onThemeToggle }: AppShellProps) {
  return (
    <div
      className={cn('app-grid', 'h-screen overflow-hidden')}
      role="application"
      aria-label="OIMG Image Optimizer"
    >
      <header role="banner">
        <TitleBar onThemeToggle={onThemeToggle} theme={theme} />
      </header>
      <nav role="toolbar" aria-label="Actions">
        <Toolbar />
      </nav>
      <main role="main" className="flex overflow-hidden">
        <section aria-label="File list"><FilePanel /></section>
        <section aria-label="File detail"><DetailPanel /></section>
      </main>
      <aside role="complementary" aria-label="Settings">
        <TweaksPanel />
      </aside>
      <footer role="contentinfo">
        <StatusBar />
      </footer>
    </div>
  )
}
```

**`cn()` import pattern** (from `src/lib/utils.ts` lines 1–6):
```typescript
import { cn } from '@/lib/utils'
// Usage: cn('base-classes', conditionalClass && 'conditional', className)
```

---

### `src/components/shell/TitleBar.tsx` (component — create new)

**Analog:** `example-ui/app.jsx` (TitleBar section, ~lines 120–180)

**shadcn Button import pattern** (from `src/components/ui/button.tsx` lines 43–58):
```tsx
import { Button } from '@/components/ui/button'
// Theme toggle button — icon size variant:
<Button variant="ghost" size="icon" onClick={onThemeToggle} aria-label="Toggle theme">
  {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
</Button>
```

**cva/variant pattern** (from `button.tsx` lines 6–41) — if creating new variant components:
```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
// Define variants with cva(), spread VariantProps into component props
```

---

### `src/components/panels/FilePanel.tsx`, `DetailPanel.tsx`, `TweaksPanel.tsx`

**Analog:** `example-ui/panels.jsx` and `example-ui/tweaks-panel.jsx`

**shadcn primitives to use** (do NOT hand-roll — RESEARCH.md "Don't Hand-Roll" table):
- Accordion: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'`
- Slider: `import { Slider } from '@/components/ui/slider'`
- Checkbox: `import { Checkbox } from '@/components/ui/checkbox'`
- Popover: `import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'`
- Tooltip: `import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'`
- Select: `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'`
- Switch: `import { Switch } from '@/components/ui/switch'`

**Replace prototype's hand-rolled equivalents with shadcn** — the prototype's `Popover`, `Tooltip`, and accordion are custom-built (RESEARCH.md "Don't Hand-Roll" rationale). The `TweaksPanel` accordion in `example-ui/tweaks-panel.jsx` must become shadcn `<Accordion>`.

---

## Shared Patterns

### cn() Utility
**Source:** `src/lib/utils.ts` lines 1–6
**Apply to:** All component files
```typescript
import { cn } from '@/lib/utils'
// cn() merges clsx + tailwind-merge — always use for conditional className composition
```

### Component Prop Interface Convention
**Source:** `src/components/ui/button.tsx` lines 43–48
**Apply to:** All shell and panel components
```typescript
// Named function (not arrow), typed props interface, named export
function ComponentName({ prop1, prop2, ...props }: ComponentNameProps) { ... }
export { ComponentName }
```

### shadcn Import Path Convention
**Source:** `src/components/ui/button.tsx` line 4, `src/App.tsx` line 1
**Apply to:** All files importing shadcn components
```typescript
import { ComponentName } from '@/components/ui/component-name'
// Always use @/ alias; never relative paths for ui components
```

### Tailwind Token Usage
**Source:** `src/index.css` lines 12–80, `src/App.tsx` lines 5–8
**Apply to:** All components
```tsx
// Use semantic CSS variable names as Tailwind utilities
className="bg-background text-foreground border-border"
// Use accent color via CSS var (not Tailwind class — not exposed as utility yet)
style={{ color: 'var(--color-accent-green)' }}
```

### Dark Theme Selector Constraint
**Source:** `src/index.css` line 10
```css
@custom-variant dark (&:is(.dark *));
```
**Apply to:** `useTheme.ts`, `AppShell.tsx`
The `.dark` class MUST be on `document.documentElement` (`<html>`). Applying it to any child element will not trigger the dark variant.

---

## No Analog Found

Files with no close match in the codebase (use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `public/_headers` | config | — | No Cloudflare Pages config exists yet |
| `src/hooks/useTheme.ts` | hook | event-driven | No hooks exist in codebase yet |
| `src/types/index.ts` | utility | — | No TypeScript interfaces in project yet |

---

## Metadata

**Analog search scope:** `src/`, `example-ui/`
**Files scanned:** 10 (main.tsx, App.tsx, vite.config.ts, index.css, lib/utils.ts, components.json, components/ui/button.tsx, example-ui/app.jsx, example-ui/icons.jsx, example-ui/data.jsx)
**Pattern extraction date:** 2026-04-29

**Critical warnings for planner:**
1. `src/components/ui/button.tsx` imports from `@base-ui/react/button` — NOT from Radix. The RESEARCH.md flags `@base-ui/react` as not in the locked stack. Planner must decide: keep or replace `button.tsx` with proper shadcn Radix version before adding more components.
2. Google Fonts CDN `@import` at `src/index.css` line 5 must be removed in the same task that adds fontsource imports — never merge with CDN still present.
3. `public/_headers` placement is critical: must be in `public/` (not repo root) for Vite to copy it to `dist/`.
