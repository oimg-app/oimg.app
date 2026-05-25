---
phase: 07-polish
plan: 02
subsystem: shell / theming / a11y
tags: [theme, fouc, focus-visible, wcag-aa, store-08, types]
requires:
  - "index.html <head>"
  - "src/index.css @theme tokens (--color-accent)"
  - "src/lib/stub-data (FileEntry, SortKey type defs)"
provides:
  - "Synchronous FOUC-prevention inline script (html.dark + data-theme set before paint)"
  - "Global :focus-visible outline ring (WCAG AA) using var(--color-accent)"
  - "src/stores/files.ts re-exports FileEntry + SortKey types (store-barrel convention)"
affects:
  - "FileRow.tsx and FilesPane.tsx now source types from @/stores/files"
tech-stack:
  added: []
  patterns:
    - "Classic inline <script> in index.html for pre-paint theme application"
    - "Global :focus-visible (outline) coexists with shadcn focus-visible:ring-2 (box-shadow)"
    - "Components import types from store barrels, not lib internals (STORE-08)"
key-files:
  created:
    - ".planning/phases/07-polish/07-02-SUMMARY.md"
  modified:
    - "index.html"
    - "src/index.css"
    - "src/stores/files.ts"
    - "src/components/file-row/FileRow.tsx"
    - "src/components/panels/FilesPane.tsx"
decisions:
  - "Did NOT touch AppShell.tsx data-theme useEffect — consolidated into concurrent plan 07-01 Task 2 to avoid parallel write conflict"
  - "Global focus ring uses outline (not box-shadow) so it never conflicts with shadcn ring utilities"
  - "Inline script only READS localStorage; persistence writes deferred to Phase 8"
metrics:
  duration: ~10m
  completed: 2026-05-23
requirements:
  - SHELL-02
---

# Phase 7 Plan 02: Theme FOUC fix + global focus rings + STORE-08 type redirect Summary

Eliminated the dark-default white flash with a synchronous pre-paint inline script in `index.html`, added a global WCAG AA `:focus-visible` outline ring keyed to `--color-accent`, and redirected `FileEntry`/`SortKey` type imports in two components from `@/lib/stub-data` to the `@/stores/files` barrel (STORE-08 convention).

## What Was Built

### Task 1 — FOUC fix (index.html)
Added a classic (non-module) inline `<script>` in `<head>`, before `<title>`. It reads `localStorage.getItem('oimg-theme')` (default `'dark'`), toggles `html.dark`, and sets `data-theme`, all synchronously before first paint. A `try/catch` falls back to dark for private-mode/blocked-storage safety. The static `class="dark"` on `<html>` is retained as the no-JS fallback.

Per plan instructions, `AppShell.tsx`'s `data-theme` useEffect extension is owned by concurrent plan 07-01 Task 2 and was deliberately NOT touched here to avoid a parallel write conflict.

### Task 2 — Global focus ring (src/index.css)
Added a base-layer `:focus-visible` rule (`outline: 2px solid var(--color-accent); outline-offset: 2px;`) after the `.dark` block. Uses `outline` so it coexists with shadcn's `focus-visible:ring-2` (box-shadow). CSS custom properties cascade into Radix portals, so the ring color resolves there too. No `:focus` (non-visible) rule and no `outline: none` reset were added.

### Task 3 — Type import redirect + store-barrel re-export
- `src/stores/files.ts`: added `export type { FileEntry, SortKey }` with a STORE-08 attribution comment, immediately after the existing `import type` from stub-data (internal import unchanged — still needed for the definitions).
- `src/components/file-row/FileRow.tsx`: `FileEntry` import redirected `@/lib/stub-data` → `@/stores/files`.
- `src/components/panels/FilesPane.tsx`: `SortKey` import redirected `@/lib/stub-data` → `@/stores/files`.
These are type-only imports erased at build time — zero runtime change.

## Verification

- `npx tsc -b --noEmit` → compiles cleanly (no errors).
- `grep -c focus-visible src/index.css` → `1` (the new rule).
- `grep -n stub-data` on FileRow.tsx + FilesPane.tsx → no matches (exit 1) — both type imports successfully redirected.

## Deviations from Plan

None — plan executed exactly as written. (AppShell.tsx was intentionally not touched, per the plan's explicit instruction to leave it for concurrent plan 07-01.)

## Known Stubs

None introduced by this plan. Pre-existing add-file/export stubs in `src/stores/files.ts` are out of scope and untouched.

## Threat Flags

None — no new security surface. Inline script is read-only on a non-sensitive localStorage key (matches threat register dispositions T-07-02 / T-07-03, both `accept`).

## Outstanding: Commits Blocked

All file edits are complete and verified, but `git commit` was denied by the environment permission system on every attempt. The per-task atomic commits and final metadata commit could NOT be created. Working tree currently holds the changes UNSTAGED:

- `index.html` (Task 1)
- `src/index.css` (Task 2)
- `src/stores/files.ts`, `src/components/file-row/FileRow.tsx`, `src/components/panels/FilesPane.tsx` (Task 3)
- this SUMMARY.md (new)

Suggested commits once permission is granted:
1. `feat(07-02): fix theme FOUC via index.html inline script` — `index.html`
2. `feat(07-02): add global focus-visible ring to index.css` — `src/index.css`
3. `feat(07-02): redirect type imports to store barrel (STORE-08)` — `src/stores/files.ts`, `src/components/file-row/FileRow.tsx`, `src/components/panels/FilesPane.tsx`
4. `docs(07-02): complete theme FOUC + focus rings plan` — this SUMMARY + STATE/ROADMAP

## Self-Check: PARTIAL

- All modified source files present in working tree (verified via `git status --short`): PASSED
- tsc + grep verification gates: PASSED
- Per-task commits exist: FAILED — git commit denied by environment permission system (no commit hashes available)
