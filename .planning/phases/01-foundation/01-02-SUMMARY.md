---
phase: 01-foundation
plan: "02"
subsystem: css-tokens
tags: [foundation, css, tokens, tailwind-v4, wave-2]
dependency_graph:
  requires:
    - node_modules (Plan 01)
  provides:
    - src/index.css (Tailwind v4 @theme + :root light + .dark dark)
    - src/styles/legacy.css (stub)
    - src/lib/utils.ts (cn() helper)
  affects:
    - All downstream components using OIMG tokens and cn()
tech_stack:
  added: []
  patterns:
    - "Tailwind v4 CSS-only config: all tokens in @theme inline blocks, no tailwind.config.ts"
    - "Two @theme inline blocks: shadcn semantic forwards + OIMG-specific token extensions"
    - "oklch color space for all color tokens (light + dark)"
    - "cn() = twMerge(clsx(inputs)) pattern for class merging"
key_files:
  created:
    - src/index.css
    - src/styles/legacy.css
    - src/lib/utils.ts
  modified: []
decisions:
  - "Full shadcn semantic aliases (card, popover, secondary, muted, accent, destructive) added to both :root and .dark beyond the plan minimum — required for shadcn components to render correctly"
  - "src/index.css restored from git HEAD pattern verbatim per 01-PATTERNS.md guidance"
metrics:
  duration: "~10min"
  completed: "2026-05-14"
---

# Phase 1 Plan 2: CSS Tokens + Tailwind v4 Setup Summary

**One-liner:** Tailwind v4 @theme inline token layer with full oklch OIMG palette (light+dark), shadcn semantic aliases, layout dimension vars, and cn() helper — all sourced from git HEAD analog.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/styles/legacy.css stub and src/lib/utils.ts | 044fd1c | src/styles/legacy.css, src/lib/utils.ts |
| 2 | Write src/index.css with Tailwind v4 @theme + :root light + .dark dark | 6b39597 | src/index.css |

---

## Verification Results

- `grep -c '@theme inline' src/index.css` → 2 (meets ≥2 requirement)
- `grep -c 'oklch' src/index.css` → 36 oklch occurrences (meets ≥30 requirement)
- `oklch(0.165 0.008 250)` (dark bg-0) — present
- `oklch(0.62 0.18 145)` (light accent) — present
- `oklch(0.80 0.17 145)` (dark accent) — present
- `--height-titlebar: 36px` — present
- `--width-file-panel: 320px` — present
- `:root {}` and `.dark {}` blocks — both present
- `npm run build` CSS errors: none (only pre-existing TS2307 for stub-data.ts and format.ts not yet shipped — expected, Plan 03/04)
- `src/lib/utils.ts`: contains `clsx`, `twMerge`, `export function cn` — verified

---

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing] Full shadcn semantic aliases in both themes**
- **Found during:** Task 2
- **Issue:** Plan specified only the minimum shadcn aliases (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--border`, `--input`, `--ring`). The shadcn component set (17 components from Plan 03) requires `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground` to render correctly.
- **Fix:** Added all 12 missing shadcn semantic aliases to both `:root` and `.dark` blocks, mapped to corresponding OIMG tokens.
- **Files modified:** src/index.css
- **Commit:** 6b39597

---

## Known Stubs

None — all files are complete and functional for their stated purpose.

---

## Self-Check: PASSED

- src/index.css — FOUND
- src/styles/legacy.css — FOUND
- src/lib/utils.ts — FOUND
- Commit 044fd1c — found via git log
- Commit 6b39597 — found via git log
