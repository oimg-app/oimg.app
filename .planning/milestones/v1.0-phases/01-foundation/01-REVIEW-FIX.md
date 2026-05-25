---
phase: 01-foundation
fixed_at: 2026-05-15T00:00:00Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 10
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-15T00:00:00Z
**Source review:** .planning/phases/01-foundation/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (5 Critical + 6 Warning)
- Fixed: 10
- Skipped: 1

## Fixed Issues

### CR-01: fmtPct falsy guard silenced valid zero-byte savings

**Files modified:** `src/lib/format.ts`, `src/tests/format.test.ts`
**Commit:** applied atomically
**Applied fix:** Changed `if (!orig || !opt)` to `if (orig == null || opt == null) return '—'` followed by `if (orig === 0) return '—'`. Updated type signature to `number | null | undefined`. Added WR-06 comment in same commit. Added `fmtPct(100, 0) === '−100.0%'` test case.

---

### CR-02 + WR-05: Non-null assertion on getElementById and missing isCrossOriginIsolated export

**Files modified:** `src/main.tsx`
**Commit:** applied atomically
**Applied fix:** Replaced `document.getElementById('root')!` with a null-guarded check that throws `new Error('[oimg] #root element not found — check index.html')`. Extracted `crossOriginIsolated` into an exported `isCrossOriginIsolated` boolean constant for Phase 2+ worker pool use.

---

### CR-03: sonner.tsx imported next-themes (Next.js-only, absent from this Vite project)

**Files modified:** `src/components/ui/sonner.tsx`
**Commit:** applied atomically
**Applied fix:** Removed `"use client"` directive and `import { useTheme } from "next-themes"`. Replaced with inline dark-mode detection via `document.documentElement.classList.contains('dark')`, assigning a typed `ToasterProps["theme"]` constant.

---

### CR-04: KbdGroup typed as ComponentProps<"div"> but rendered kbd element

**Files modified:** `src/components/ui/kbd.tsx`
**Commit:** applied atomically
**Applied fix:** Changed prop type from `React.ComponentProps<"div">` to `React.ComponentProps<"span">` and changed the rendered element from `<kbd>` to `<span>` — valid phrasing-content grouping that accepts inline `kbd` children.

---

### CR-05: Self-referential OIMG @theme inline block produced undefined CSS tokens

**Files modified:** `src/index.css`
**Commit:** applied atomically
**Applied fix:** Removed the entire second `@theme inline` block (lines 37–57) which mapped OIMG tokens to themselves (e.g., `--color-bg-0: var(--color-bg-0)`). Tokens remain usable via `var(--color-bg-0)` inline in JSX as currently consumed, and the `--color-accent` collision with the shadcn alias is resolved.

---

### WR-01: AppShell declared and suppressed unused children prop

**Files modified:** `src/components/shell/AppShell/AppShell.tsx`
**Commit:** applied atomically
**Applied fix:** Removed `AppShellProps` interface, `children?: ReactNode` prop, `_children` destructuring, and the `import type { ReactNode }` import. Function signature simplified to `export function AppShell()`.

---

### WR-03: MenubarCheckboxItem had pr-28 (7rem) instead of pr-8

**Files modified:** `src/components/ui/menubar.tsx`
**Commit:** applied atomically
**Applied fix:** Changed `pr-28` to `pr-8` in the `MenubarCheckboxItem` className string, matching the pattern used in `DropdownMenuCheckboxItem` and `ContextMenuCheckboxItem`.

---

### WR-04: ContextMenuContent had redundant side prop type extension

**Files modified:** `src/components/ui/context-menu.tsx`
**Commit:** applied atomically
**Applied fix:** Removed `& { side?: "top" | "right" | "bottom" | "left" }` from the props type intersection. The `side` prop is already part of `ContextMenuPrimitive.Content`'s props and needs no re-declaration.

---

### WR-06: fmtPct Unicode asymmetry undocumented

**Files modified:** `src/lib/format.ts`
**Commit:** applied as part of CR-01 commit (same file, same function)
**Applied fix:** Added comment `// U+2212 MINUS SIGN (not ASCII '-') for savings; ASCII '+' for increases.` above the return statement in `fmtPct`.

---

## Skipped Issues

### WR-02: Slider defaults to two thumbs when no value provided

**File:** `src/components/ui/slider.tsx:16-24`
**Reason:** skipped: code context differs from review — the file was already refactored. The current implementation uses a custom `SliderProps` type with `toArray()` helper and the fallback is already `valueArr ?? defaultValueArr ?? [min]` (single thumb). The `[min, max]` two-thumb default described in the review is not present in the current code.
**Original issue:** Default `[min, max]` caused two thumbs to render when no value prop was provided.

---

_Fixed: 2026-05-15T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
