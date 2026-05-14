---
phase: 01-foundation
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - src/App.tsx
  - src/components/panels/CenterPane.tsx
  - src/components/panels/FilesPane.tsx
  - src/components/panels/InspectorPane.tsx
  - src/components/shell/AppShell/AppShell.tsx
  - src/components/ui/button.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/context-menu.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/components/ui/input.tsx
  - src/components/ui/kbd.tsx
  - src/components/ui/menubar.tsx
  - src/components/ui/popover.tsx
  - src/components/ui/resizable.tsx
  - src/components/ui/separator.tsx
  - src/components/ui/slider.tsx
  - src/components/ui/sonner.tsx
  - src/components/ui/spinner.tsx
  - src/components/ui/switch.tsx
  - src/components/ui/tabs.tsx
  - src/components/ui/tooltip.tsx
  - src/index.css
  - src/lib/format.ts
  - src/lib/stub-data.ts
  - src/lib/utils.ts
  - src/main.tsx
  - src/styles/legacy.css
  - src/tests/format.test.ts
  - src/tests/foundation.spec.ts
  - src/tests/stub-data.test.ts
findings:
  critical: 5
  warning: 6
  info: 4
  total: 15
status: fixed
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 01 establishes the project skeleton: Vite/React/TS setup, UI primitives (Radix-based), design tokens, lib utilities, and stub data. The foundation is largely coherent but contains several correctness bugs and one hard dependency on `next-themes` that is incompatible with the stated tech stack. The most critical issues are: a broken null-guard in `fmtPct` that silences valid savings, an unchecked DOM access that crashes if `#root` is missing, a wrong semantic element in `KbdGroup`, a `next-themes` dependency injected into a zero-server Vite app, and self-referential CSS token declarations that produce undefined values.

---

## Critical Issues

### CR-01: `fmtPct` falsy guard silently returns dash for any zero-size input or output

**File:** `src/lib/format.ts:12`
**Issue:** `if (!orig || !opt)` treats `orig === 0` OR `opt === 0` as sentinel "missing" values and returns `'—'`. A legitimately-optimized file could have `opt = 0` bytes (empty SVG edge case), and more practically any non-zero `orig` paired with `opt = 0` incorrectly hides the saving result. The null intent is already covered by `fmtBytes` using `== null`. The test on line 19 (`fmtPct(0, 0) returns "—"`) passes, but `fmtPct(100, 0)` also silently returns `'—'` — a 100% saving — which is a logic error.
**Fix:**
```ts
export function fmtPct(orig: number | null | undefined, opt: number | null | undefined): string {
  if (orig == null || opt == null) return '—'
  if (orig === 0) return '—'
  const saved = ((orig - opt) / orig) * 100
  if (saved === 0) return ''
  return (saved > 0 ? '−' : '+') + Math.abs(saved).toFixed(1) + '%'
}
```

---

### CR-02: Unchecked non-null assertion on `getElementById('root')` crashes with blank screen on missing element

**File:** `src/main.tsx:16`
**Issue:** `createRoot(document.getElementById('root')!)` uses the TypeScript non-null assertion `!`. If the element is missing (wrong HTML template, SSR pre-render mismatch, browser extension that strips the DOM), React throws a runtime exception producing a completely blank screen with no recovery path. This is the single entry point for the entire app.
**Fix:**
```ts
const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[oimg] #root element not found — check index.html')
}
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---

### CR-03: `sonner.tsx` imports `next-themes` — a Next.js-only package absent from this Vite project

**File:** `src/components/ui/sonner.tsx:3`
**Issue:** `import { useTheme } from "next-themes"` requires a `ThemeProvider` ancestor that is never mounted in this app. At runtime `useTheme()` returns `undefined` and the Toaster always falls back to `"system"` mode, ignoring the `.dark` class applied by `AppShell`. Additionally, `next-themes` is not listed in `package.json` (this is a pure Vite/React project with no Next.js runtime), so the import will cause a build error unless the package was accidentally installed.
**Fix:** Remove `next-themes`. Derive dark mode from the document class:
```ts
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  const theme: ToasterProps["theme"] = isDark ? "dark" : "light"

  return <Sonner theme={theme} ... />
}
```

---

### CR-04: `KbdGroup` renders a `<kbd>` element but is typed as `React.ComponentProps<"div">` — broken type contract

**File:** `src/components/ui/kbd.tsx:16-24`
**Issue:** `KbdGroup` is typed as `React.ComponentProps<"div">` (a block-level element) but renders `<kbd>` (phrasing content). TypeScript will accept any `div` prop and forward it to `<kbd>`, which can produce invalid HTML and broken ARIA. Any caller passing `role`, `onClick`, or layout props intended for a `div` will silently attach them to a phrasing element.
**Fix:** Change the rendered element to `<span>` (valid phrasing-content grouping element, accepts inline `kbd` children) and align the prop type:
```ts
function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}
```

---

### CR-05: CSS custom property self-references in `@theme inline` produce undefined values for OIMG tokens

**File:** `src/index.css:39-57`
**Issue:** The second `@theme inline` block maps OIMG tokens to themselves, e.g., `--color-bg-0: var(--color-bg-0)`. These are circular self-references. At Tailwind parse time this registers the token with an empty/undefined resolved value. The `--color-accent` name also collides with the shadcn semantic alias `--color-accent` defined on line 49 of the first `@theme inline` block (which maps to `var(--accent)`, the dim accent), creating two conflicting definitions under the same token name. Any Tailwind shorthand utility resolving via the theme system for these tokens will produce nothing.
**Fix:** Remove the entire OIMG self-reference `@theme inline` block. The tokens are already usable via `var(--color-bg-0)` inline in JSX, which is how they are currently consumed. Rename the OIMG green accent token to avoid collision with shadcn's `--color-accent` alias (e.g., use `--color-brand`).

---

## Warnings

### WR-01: `AppShell` declares and suppresses an unused `children` prop

**File:** `src/components/shell/AppShell/AppShell.tsx:12-16`
**Issue:** `AppShellProps` declares `children?: ReactNode`, destructured as `_children` to suppress the lint warning. This adds dead surface area to the component's public API with no current or documented future use.
**Fix:** Remove the prop entirely until it is needed:
```ts
export function AppShell() {
```

---

### WR-02: `Slider` defaults to two thumbs (`[min, max]`) when no value is provided

**File:** `src/components/ui/slider.tsx:16-24`
**Issue:** When neither `value` nor `defaultValue` is provided, the memo returns `[min, max]`, causing the component to render two thumbs (a range slider) by default. A standard single-value slider should render one thumb. This incorrect default will cause every `<Slider />` usage without explicit values to behave as a range slider.
**Fix:**
```ts
const _values = React.useMemo(
  () =>
    Array.isArray(value)
      ? value
      : Array.isArray(defaultValue)
        ? defaultValue
        : [min],   // single thumb, not [min, max]
  [value, defaultValue, min]
)
```

---

### WR-03: `MenubarCheckboxItem` has `pr-28` (7rem right padding) — likely a typo for `pr-8`

**File:** `src/components/ui/menubar.tsx:125`
**Issue:** The className contains `pr-28` (7rem). Every equivalent component (`DropdownMenuCheckboxItem`, `ContextMenuCheckboxItem`) uses `pr-8` (2rem). This will render checkbox items in the Menubar with excessively wide right padding, pushing the indicator icon off-screen or making the item unusably wide.
**Fix:** Change `pr-28` to `pr-8` in the className string on line 125.

---

### WR-04: `ContextMenuContent` extends props type with a redundant `side` prop declaration

**File:** `src/components/ui/context-menu.tsx:62-64`
**Issue:** The type `{ side?: "top" | "right" | "bottom" | "left" }` is added explicitly but `side` is already part of `ContextMenuPrimitive.Content`'s props. The prop is not destructured, so it silently falls into `...props` and gets forwarded anyway. The redundant declaration is misleading — it implies this component does something special with `side` when it does not.
**Fix:** Remove the redundant type extension; the Radix type already covers it.

---

### WR-05: `crossOriginIsolated` check does not expose a flag for future worker pool code to read

**File:** `src/main.tsx:8-14`
**Issue:** The check logs to `console.error` but does not persist the result. Phase 2+ codec workers will use `SharedArrayBuffer` (requires `crossOriginIsolated`). Without a persistent flag, the worker pool cannot gracefully degrade or surface a user-facing error — it will throw a cryptic `SecurityError` at runtime.
**Fix:** Export the boolean so Phase 2 worker code can import it:
```ts
export const isCrossOriginIsolated: boolean = crossOriginIsolated
if (!isCrossOriginIsolated) {
  console.error('[oimg] crossOriginIsolated is false ...')
}
```

---

### WR-06: `fmtPct` uses Unicode MINUS SIGN (U+2212) for savings but ASCII `+` for size increases — undocumented asymmetry

**File:** `src/lib/format.ts:14-15`
**Issue:** Line 14 uses `'−'` (U+2212 MINUS SIGN), not the ASCII hyphen-minus `'-'`. The test on line 17 (`'−50.0%'`) uses the same Unicode character. Any developer who writes a string comparison using `'-'` (ASCII) will get a silent false negative. The asymmetry is intentional (typographically correct) but is nowhere documented.
**Fix:** Add a comment above the return:
```ts
// U+2212 MINUS SIGN (not ASCII '-') for savings; ASCII '+' for increases.
return (saved > 0 ? '−' : '+') + Math.abs(saved).toFixed(1) + '%'
```

---

## Info

### IN-01: `"use client"` directives in multiple UI components are no-ops in a Vite SPA

**File:** `src/components/ui/checkbox.tsx:1`, `src/components/ui/dropdown-menu.tsx:1`, `src/components/ui/menubar.tsx:1`, `src/components/ui/slider.tsx:1`, `src/components/ui/sonner.tsx:1`, `src/components/ui/tooltip.tsx:1`
**Issue:** `"use client"` is a Next.js App Router directive. In this Vite/React SPA it is a no-op string expression statement but misleads contributors about the runtime environment.
**Fix:** Remove all `"use client"` directives.

---

### IN-02: `PopoverTitle` is typed as `React.ComponentProps<"h2">` but renders a `<div>`

**File:** `src/components/ui/popover.tsx:56-64`
**Issue:** The function signature declares `ComponentProps<"h2">` but the JSX renders `<div>`. This mismatches the type contract and produces a non-heading element where a heading is expected (ARIA `labelledby` references, heading hierarchy).
**Fix:**
```ts
function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 data-slot="popover-title" className={cn("text-sm font-medium", className)} {...props} />
  )
}
```

---

### IN-03: `ResizablePanelGroup` receives `orientation` prop but `react-resizable-panels` uses `direction`

**File:** `src/components/shell/AppShell/AppShell.tsx:23`
**Issue:** `orientation="horizontal"` is passed to `ResizablePanelGroup`, but the `react-resizable-panels` `Group` API uses `direction` (not `orientation`). The prop is spread through and silently ignored; the group falls back to the library's default direction. The layout may appear correct by coincidence (default is horizontal) but this is incorrect usage and will break if vertical orientation is needed.
**Fix:**
```tsx
<ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
```

---

### IN-04: `stub-data.test.ts` uses magic number `22` for SVGO plugin count with no explanatory comment

**File:** `src/tests/stub-data.test.ts:14`
**Issue:** `mod.SVGO_PLUGINS.length === 22` is a brittle assertion. If a plugin is added or removed, the test fails with no context on why 22 is the expected count.
**Fix:** Add a comment: `// 22 = SVGO_PLUGINS as of Phase 01 stub (see stub-data.ts)`.

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
