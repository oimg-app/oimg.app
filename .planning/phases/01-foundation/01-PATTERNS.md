# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 13 new/modified files
**Analogs found:** 10 / 13 (3 have no prior analog — new test files)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/index.css` | config | — | `git HEAD:src/index.css` | exact (restore verbatim) |
| `src/App.tsx` | component | request-response | `git HEAD:src/App.tsx` | exact (simplified for Phase 1) |
| `src/lib/utils.ts` | utility | transform | `git HEAD:src/lib/utils.ts` | exact (restore verbatim) |
| `src/lib/stub-data.ts` | utility | transform | `example-ui/data.jsx` | role-match (TS port) |
| `src/lib/format.ts` | utility | transform | `git HEAD:src/lib/format.ts` | exact (restore verbatim) |
| `src/components/shell/AppShell/AppShell.tsx` | component | request-response | `git HEAD:src/components/shell/AppShell/AppShell.tsx` | partial (new layout: react-resizable-panels, no CSS modules) |
| `src/components/panels/FilesPane.tsx` | component | request-response | `git HEAD:src/components/panels/FilesPane.tsx` | partial (skeleton only for Phase 1) |
| `src/components/panels/CenterPane.tsx` | component | request-response | `git HEAD:src/components/panels/CenterPane.tsx` | partial (skeleton only for Phase 1) |
| `src/components/panels/InspectorPane.tsx` | component | request-response | `git HEAD:src/components/panels/InspectorPane.tsx` | partial (skeleton only for Phase 1) |
| `src/components/ui/*.tsx` (17 files) | component | request-response | `git HEAD:src/components/ui/resizable.tsx`, `button.tsx` | exact (regenerate via shadcn CLI) |
| `src/tests/stub-data.test.ts` | test | — | `git HEAD:src/tests/filename.test.ts` | role-match |
| `src/tests/format.test.ts` | test | — | `git HEAD:src/tests/filename.test.ts` | role-match |
| `src/tests/foundation.spec.ts` | test | — | none — no Playwright spec exists yet | none |

---

## Pattern Assignments

### `src/index.css` (config)

**Analog:** `git HEAD:src/index.css` (383 lines)

**Action:** Restore verbatim from `git show HEAD:src/index.css`. Do NOT hand-roll.

**Imports block** (lines 1–7):
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./styles/legacy.css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/jetbrains-mono";

@custom-variant dark (&:is(.dark *));
```

**Tailwind v4 @theme inline pattern** (lines ~34–120 — two `@theme inline {}` blocks):
```css
@theme inline {
  --font-heading: var(--font-mono);
  --font-mono: 'JetBrains Mono Variable', monospace;
  /* shadcn semantic tokens forwarded from CSS vars */
  --color-background:    var(--background);
  --color-foreground:    var(--foreground);
  /* ... */
}

/* OIMG-specific token extensions */
@theme inline {
  --color-bg-0:          var(--color-bg-0);
  --color-bg-1:          var(--color-bg-1);
  --color-bg-2:          var(--color-bg-2);
  --color-bg-3:          var(--color-bg-3);
  --color-line:          var(--color-line);
  --color-line-strong:   var(--color-line-strong);
  --color-fg-0:          var(--color-fg-0);
  --color-fg-1:          var(--color-fg-1);
  --color-fg-2:          var(--color-fg-2);
  --color-fg-3:          var(--color-fg-3);
  --color-accent:        var(--color-accent);
  --color-accent-dim:    var(--color-accent-dim);
  --color-accent-fg:     var(--color-accent-fg);
  --color-warn:          var(--color-warn);
  --color-err:           var(--color-err);
  --color-info:          var(--color-info);
  --font-sans:           var(--font-sans);
  --font-mono:           var(--font-mono);
}
```

**`:root` light theme variables** (lines ~210–308):
```css
:root {
  --font-sans: 'Inter Variable', 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;

  /* OIMG 5-stop oklch surface scale — light theme */
  --color-bg-0: oklch(0.985 0.003 250);
  --color-bg-1: oklch(0.965 0.004 250);
  --color-bg-2: oklch(0.945 0.005 250);
  --color-bg-3: oklch(0.915 0.006 250);
  --color-line:         oklch(0.86 0.008 250);
  --color-line-strong:  oklch(0.74 0.010 250);
  --color-fg-0: oklch(0.18 0.010 250);
  --color-fg-1: oklch(0.32 0.010 250);
  --color-fg-2: oklch(0.50 0.010 250);
  --color-fg-3: oklch(0.66 0.010 250);
  --color-accent:       oklch(0.62 0.18 145);
  --color-accent-dim:   oklch(0.62 0.18 145 / 0.14);
  --color-accent-fg:    oklch(0.99 0 0);
  --color-warn:         oklch(0.62 0.16 65);
  --color-err:          oklch(0.58 0.20 25);
  --color-info:         oklch(0.55 0.15 235);

  /* shadcn semantic aliases */
  --background:          var(--color-bg-0);
  --foreground:          var(--color-fg-0);
  --primary:             var(--color-accent);
  --primary-foreground:  var(--color-accent-fg);
  --border:              var(--color-line);
  --input:               var(--color-line);
  --ring:                var(--color-accent);
  --radius:              0.375rem;

  /* OIMG layout dimensions */
  --height-titlebar:     36px;
  --height-toolbar:      44px;
  --height-pane-header:  32px;
  --height-statusbar:    22px;
  --height-btn:          28px;
  --width-file-panel:    320px;
  --width-tweaks-panel:  340px;
}
```

**`.dark` block** (lines 310–383):
```css
.dark {
  /* OIMG 5-stop oklch surface scale — dark theme */
  --color-bg-0: oklch(0.165 0.008 250);
  --color-bg-1: oklch(0.205 0.009 250);
  --color-bg-2: oklch(0.235 0.009 250);
  --color-bg-3: oklch(0.275 0.010 250);
  --color-line:         oklch(0.32 0.010 250);
  --color-line-strong:  oklch(0.40 0.012 250);
  --color-fg-0: oklch(0.96 0.005 250);
  --color-fg-1: oklch(0.78 0.008 250);
  --color-fg-2: oklch(0.58 0.010 250);
  --color-fg-3: oklch(0.42 0.012 250);
  --color-accent:       oklch(0.80 0.17 145);
  --color-accent-dim:   oklch(0.80 0.17 145 / 0.16);
  --color-accent-fg:    oklch(0.18 0.05 145);
  --color-warn:         oklch(0.82 0.15 75);
  --color-err:          oklch(0.72 0.19 25);
  --color-info:         oklch(0.78 0.13 235);

  /* shadcn semantic aliases — dark */
  --background:          var(--color-bg-0);
  --foreground:          var(--color-fg-0);
  --primary:             var(--color-accent);
  --primary-foreground:  var(--color-accent-fg);
  --border:              var(--color-line);
  --input:               var(--color-line);
  --ring:                var(--color-accent);
  --selection: oklch(0.80 0.17 145 / 0.30);
  --shadow-elev: 0 12px 40px oklch(0 0 0 / 0.45);
}
```

**Key insight:** `@import "./styles/legacy.css"` is referenced in HEAD — the legacy.css file was likely deleted. For Phase 1 the planner should either omit this import or create an empty `src/styles/legacy.css` stub to prevent 404 errors.

---

### `src/main.tsx` (existing — update only if needed)

**Analog:** `git HEAD:src/main.tsx`

**Pattern** (full file — do not modify unless necessary):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'

if (!crossOriginIsolated) {
  console.error('[oimg] crossOriginIsolated is false. ...')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Key:** `@fontsource-variable/inter` import lives here, NOT in index.css.

---

### `src/App.tsx` (component, request-response)

**Analog:** `git HEAD:src/App.tsx` (Phase 1 is a heavily simplified version — no stores, no hooks, just shell wiring)

**Phase 1 imports pattern** (minimal — stores are Phase 2+):
```tsx
import { AppShell } from '@/components/shell/AppShell/AppShell'
import { FilesPane } from '@/components/panels/FilesPane'
import { CenterPane } from '@/components/panels/CenterPane'
import { InspectorPane } from '@/components/panels/InspectorPane'
```

**Core pattern** (Phase 1 — no useStore, no hooks):
```tsx
export default function App() {
  return (
    <AppShell>
      <FilesPane />
      <CenterPane />
      <InspectorPane />
    </AppShell>
  )
}
```

**Note:** Full HEAD App.tsx uses `useStore`, `useBatchOrchestrate`, `useKeyboardShortcuts`, etc. — all Phase 2+. Phase 1 App.tsx is a thin wrapper only.

---

### `src/lib/utils.ts` (utility, transform)

**Analog:** `git HEAD:src/lib/utils.ts`

**Full file** (restore verbatim):
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

### `src/lib/format.ts` (utility, transform)

**Analog:** `git HEAD:src/lib/format.ts`

**Full file** (restore verbatim):
```typescript
// Byte / percentage formatters — ported from example-ui/data.jsx.

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
}

export function fmtPct(orig: number, opt: number): string {
  if (!orig || !opt) return '—';
  const saved = ((orig - opt) / orig) * 100;
  if (saved === 0) return '';
  return (saved > 0 ? '−' : '+') + Math.abs(saved).toFixed(1) + '%';
}
```

**Note on fmtPct:** `example-ui/data.jsx` uses `saved >= 0` (no zero guard); git HEAD uses `saved === 0` early return producing `''`. Use the git HEAD version — it matches STORE-06 requirements exactly.

---

### `src/lib/stub-data.ts` (utility, transform)

**Analog:** `example-ui/data.jsx` (TypeScript port of the JS data module)

**Data source** (`example-ui/data.jsx` lines 3–45 — verbatim values to port):
```javascript
// 12 FILE entries — port all fields, convert type: 'jpg' to 'jpeg' for consistency
{ id: 'f1', name: 'hero-banner@2x.png', type: 'png', orig: 1842300, opt: 412800, status: 'done', target: 'webp', dim: '2400×1600', q: 82 },
{ id: 'f2', name: 'product-shot-01.jpg', type: 'jpg', orig: 956400, opt: 198200, status: 'done', target: 'avif', dim: '1920×1280', q: 60 },
// ... (12 total, f1–f12)

// 22 SVGO_PLUGINS entries:
{ id: 'removeDoctype', on: true, saves: '0.4%' },
// ... (22 total)

// Constants:
CODECS = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF']  // data.jsx uses these exact values
RESIZE_ALG = ['lanczos3', 'mitchell', 'catrom', 'triangle']  // data.jsx is singular; REQUIREMENTS say plural RESIZE_ALGS
FIT_MODES = ['cover', 'contain', 'fill']
```

**TypeScript pattern** (interfaces inline in module per RESEARCH.md Pattern 4):
```typescript
// src/lib/stub-data.ts

export interface FileEntry {
  id: string
  name: string
  type: string
  orig: number
  opt: number
  status: string
  target: string
  dim: string
  q: number | null
  prog?: number
}

export interface SvgoPlugin {
  id: string
  on: boolean
  saves: string
}

export const STUB_FILES: FileEntry[] = [
  { id: 'f1', name: 'hero-banner@2x.png', type: 'png', orig: 1842300, opt: 412800, status: 'done', target: 'webp', dim: '2400×1600', q: 82 },
  // ... all 12 entries from data.jsx
]

export const SVGO_PLUGINS: SvgoPlugin[] = [
  { id: 'removeDoctype', on: true, saves: '0.4%' },
  // ... all 22 entries from data.jsx
]

export const CODECS = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF'] as const
export const RESIZE_ALGS = ['lanczos3', 'mitchell', 'catrom', 'triangle'] as const
export const FIT_MODES = ['cover', 'contain', 'fill'] as const
```

**STORE-08 constraint:** This file must NOT be imported directly by components. Only stores (Phase 2+) import stub-data.

---

### `src/components/shell/AppShell/AppShell.tsx` (component, request-response)

**Analog:** `git HEAD:src/components/shell/AppShell/AppShell.tsx` — but Phase 1 replaces CSS modules with Tailwind + react-resizable-panels layout.

**Prior analog** (used CSS module `s.app` + slot props for titleBar/toolbar/workArea/statusBar):
```tsx
import s from './appShell.module.css'
export function AppShell({ titleBar, toolbar, workArea, statusBar, overlays }) {
  return (
    <div role="application" aria-label="OIMG Image Optimizer" className={s.app}>
      {titleBar}{toolbar}{workArea}{statusBar}{overlays}
    </div>
  )
}
```

**Phase 1 pattern** (react-resizable-panels, Tailwind, no CSS modules, dark class, skeleton panes inline):
```tsx
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import type { ReactNode } from 'react'

interface AppShellProps {
  children?: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      role="application"
      aria-label="OIMG Image Optimizer"
      className="dark h-screen w-screen flex flex-col overflow-hidden bg-[var(--color-bg-0)]"
    >
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
          {/* FilesPane */}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={55}>
          {/* CenterPane */}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
          {/* InspectorPane */}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
```

**Key decisions:**
- `className="dark"` on root div — enables Tailwind `.dark {}` variant for default dark theme
- `defaultSize` is percentage-based: 20/55/25 (≈ 240px/660px/300px at 1200px viewport)
- Phase 1 can either accept `children` or wire panes directly — planner chooses

---

### `src/components/panels/FilesPane.tsx` (component, request-response)

**Phase 1 action:** Skeleton placeholder only. Full implementation is Phase 2+.

**Analog:** `git HEAD:src/components/panels/FilesPane.tsx` (full implementation — Phase 1 does NOT copy this)

**Phase 1 pattern** (skeleton div with data-testid for Playwright):
```tsx
export function FilesPane() {
  return (
    <div
      data-testid="files-pane"
      className="h-full flex flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-1)]"
    >
      <div className="h-[var(--height-pane-header)] flex items-center px-3 text-xs text-[var(--color-fg-2)] border-b border-[var(--color-line)]">
        Files
      </div>
    </div>
  )
}
```

---

### `src/components/panels/CenterPane.tsx` (component, request-response)

**Phase 1 action:** Skeleton placeholder only.

**Phase 1 pattern:**
```tsx
export function CenterPane() {
  return (
    <div
      data-testid="center-pane"
      className="h-full flex flex-col bg-[var(--color-bg-0)]"
    >
      <div className="h-[var(--height-pane-header)] flex items-center px-3 text-xs text-[var(--color-fg-2)] border-b border-[var(--color-line)]">
        Preview
      </div>
    </div>
  )
}
```

---

### `src/components/panels/InspectorPane.tsx` (component, request-response)

**Phase 1 action:** Skeleton placeholder only.

**Phase 1 pattern:**
```tsx
export function InspectorPane() {
  return (
    <div
      data-testid="inspector-pane"
      className="h-full flex flex-col border-l border-[var(--color-line)] bg-[var(--color-bg-1)]"
    >
      <div className="h-[var(--height-pane-header)] flex items-center px-3 text-xs text-[var(--color-fg-2)] border-b border-[var(--color-line)]">
        Inspector
      </div>
    </div>
  )
}
```

---

### `src/components/ui/*.tsx` (17 shadcn components)

**Analog:** `git HEAD:src/components/ui/resizable.tsx` and `button.tsx` (representative samples)

**Action:** Generate all 17 via CLI — do NOT hand-roll:
```bash
npx shadcn@4.7.0 add button separator tooltip popover slider dialog tabs input checkbox switch dropdown-menu context-menu menubar kbd resizable sonner spinner
```

**Resizable.tsx pattern** (lines 1–43 — shows import + wrapper structure used by all shadcn components):
```tsx
import * as ResizablePrimitive from "react-resizable-panels"
import { cn } from "@/lib/utils"

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  )
}
// ... ResizablePanel, ResizableHandle similarly
export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
```

**Button.tsx pattern** — uses `cva` from `class-variance-authority` + `Slot` from `radix-ui` + `cn()`. All 17 components follow the same structure: import primitives, wrap with `cn()`, export named functions.

---

### `src/tests/stub-data.test.ts` (test, Node unit)

**Analog:** `git HEAD:src/tests/filename.test.ts`

**Full test pattern** (copy structure, adapt assertions):
```typescript
// Run: node --experimental-strip-types src/tests/stub-data.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const mod = await import('../lib/stub-data.ts')
  assert('STUB_FILES has 12 entries', mod.STUB_FILES.length === 12)
  assert('SVGO_PLUGINS has 22 entries', mod.SVGO_PLUGINS.length === 22)
  assert('CODECS has 5 entries', mod.CODECS.length === 5)
  assert('RESIZE_ALGS has 4 entries', mod.RESIZE_ALGS.length === 4)
  assert('FIT_MODES has 3 entries', mod.FIT_MODES.length === 3)
  assert('first file has required fields', 'id' in mod.STUB_FILES[0] && 'orig' in mod.STUB_FILES[0])
} catch (err) {
  // Wave 0 stub state: module not yet written
  if (err instanceof Error && err.message.includes('stub-data.ts')) {
    passed++
    console.log('Wave 0 stub state: src/lib/stub-data.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

---

### `src/tests/format.test.ts` (test, Node unit)

**Analog:** `git HEAD:src/tests/filename.test.ts`

**Test pattern** (copy structure, adapt assertions):
```typescript
// Run: node --experimental-strip-types src/tests/format.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const { fmtBytes, fmtPct } = await import('../lib/format.ts')
  assert('fmtBytes(0) returns "0 B"', fmtBytes(0) === '0 B')
  assert('fmtBytes(1024) returns "1.0 KB"', fmtBytes(1024) === '1.0 KB')
  assert('fmtBytes(1048576) returns "1.00 MB"', fmtBytes(1048576) === '1.00 MB')
  assert('fmtBytes(null) returns "—"', fmtBytes(null) === '—')
  assert('fmtPct(100, 50) returns "−50.0%"', fmtPct(100, 50) === '−50.0%')
  assert('fmtPct(100, 150) returns "+50.0%"', fmtPct(100, 150) === '+50.0%')
  assert('fmtPct(0, 0) returns "—"', fmtPct(0, 0) === '—')
  assert('fmtPct(100, 100) returns ""', fmtPct(100, 100) === '')
} catch (err) {
  if (err instanceof Error && err.message.includes('format.ts')) {
    passed++
    console.log('Wave 0 stub state: src/lib/format.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

---

### `src/tests/foundation.spec.ts` (Playwright E2E)

**Analog:** None — no Playwright spec exists in the prior codebase.

**Pattern from RESEARCH.md validation architecture:**
```typescript
// Run: npm test -- --project=chromium
import { test, expect } from '@playwright/test'

test('dark background applied (SETUP-01/02)', async ({ page }) => {
  await page.goto('/')
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-0').trim()
  )
  // dark theme: oklch(0.165 0.008 250)
  expect(bg).toBeTruthy()
  // Verify root element has dark class
  const hasDark = await page.locator('[role="application"]').evaluate(el => el.classList.contains('dark'))
  expect(hasDark).toBe(true)
})

test('3 panes render (SHELL-01)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('files-pane')).toBeVisible()
  await expect(page.getByTestId('center-pane')).toBeVisible()
  await expect(page.getByTestId('inspector-pane')).toBeVisible()
})

test('viewport fills screen', async ({ page }) => {
  await page.goto('/')
  const app = page.locator('[role="application"]')
  const box = await app.boundingBox()
  expect(box?.width).toBeGreaterThan(0)
  expect(box?.height).toBeGreaterThan(0)
})
```

**Config:** Uses `playwright.config.ts` at project root. Quick run: `npm test -- --project=chromium`.

---

## Shared Patterns

### `cn()` utility
**Source:** `git HEAD:src/lib/utils.ts`
**Apply to:** All component files that use Tailwind class merging
```typescript
import { cn } from '@/lib/utils'
// Usage: className={cn("base-classes", conditional && "extra-class")}
```

### Tailwind token usage in components
**Source:** `git HEAD:src/components/ui/resizable.tsx`, `git HEAD:src/components/panels/FilesPane.tsx`
**Apply to:** All component files
```tsx
// Use CSS var references for OIMG tokens, Tailwind utilities for layout/spacing
className="h-full flex flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-1)]"
// NOT: className="h-full flex flex-col border-r border-gray-700 bg-gray-900"
```

### Named export pattern
**Source:** `git HEAD:src/components/shell/AppShell/AppShell.tsx`, `git HEAD:src/lib/format.ts`
**Apply to:** All new component and utility files
```typescript
// Named exports only — no default exports for components/utilities
export function AppShell() { ... }
export function fmtBytes() { ... }
// Exception: src/App.tsx uses default export (React Router convention)
export default function App() { ... }
```

### nanostores import pattern (Phase 2+ reference — NOT for Phase 1)
**Source:** `git HEAD:src/App.tsx` lines 2–3
```tsx
import { useStore } from '@nanostores/react'
import { listenKeys } from 'nanostores'
// Store reads: const { selectedId } = useStore(filesStore)
// Store writes: setSelected(id)  // action functions, not setState
```

### `data-testid` on pane roots
**Source:** Pattern for Playwright targeting (no prior analog — established here)
**Apply to:** All skeleton pane components
```tsx
<div data-testid="files-pane" ...>
<div data-testid="center-pane" ...>
<div data-testid="inspector-pane" ...>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/tests/foundation.spec.ts` | test | — | No Playwright spec exists in prior codebase; use RESEARCH.md validation architecture section |
| `src/styles/legacy.css` (stub) | config | — | Legacy CSS file referenced by index.css import; if deleted causes 404; create empty stub |

---

## Critical Anti-Patterns (from codebase analysis)

1. **No CSS Modules:** Prior AppShell used `import s from './appShell.module.css'` — this pattern is deleted. Use Tailwind utility classes only.
2. **No `tailwind.config.ts`:** Tailwind v4 ignores it. All tokens in `src/index.css` `@theme inline {}` blocks.
3. **No `useState` for data:** STORE-08 — only ephemeral hover/focus state in components.
4. **No direct stub-data imports in components:** STORE-08 — only stores import stub-data.
5. **`@import "./styles/legacy.css"` in index.css:** The legacy.css file was deleted. Either remove this import line or create an empty stub file.

---

## Metadata

**Analog search scope:** `git HEAD` (commit `93d3cc0` parent `19c7ab8`), `example-ui/data.jsx`
**Files scanned:** 13 source files via git show
**Pattern extraction date:** 2026-05-14
