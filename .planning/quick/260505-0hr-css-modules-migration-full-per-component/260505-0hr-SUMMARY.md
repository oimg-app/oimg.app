---
phase: 260505-0hr-css-modules-migration-full-per-component
plan: 01
status: PARTIAL — 1 of 18 commits complete
completed: 2026-05-05
---

# Phase 260505-0hr Plan 01: CSS Modules Migration Summary (PARTIAL)

## One-liner

Bootstrap commit for CSS Modules migration landed: `index.css` body extracted into `src/styles/legacy.css` shim while `index.css` keeps Tailwind imports + tokens + base + ::selection + .num/.mono.

## Commits

| #   | Hash      | Message                                                          | Status |
| --- | --------- | ---------------------------------------------------------------- | ------ |
| 1   | `b34275a` | refactor(0hr): bootstrap CSS Modules — extract legacy.css shim   | DONE   |
| 2   | —         | refactor(0hr): add shared CSS Modules primitives                 | TODO   |
| 3   | —         | refactor(0hr): migrate AppShell to CSS Modules                   | TODO   |
| 4   | —         | refactor(0hr): migrate TitleBar to CSS Modules                   | TODO   |
| 5   | —         | refactor(0hr): migrate Toolbar to CSS Modules                    | TODO   |
| 6   | —         | refactor(0hr): migrate StatusBar to CSS Modules                  | TODO   |
| 7   | —         | refactor(0hr): migrate CommandPalette to CSS Modules             | TODO   |
| 8   | —         | refactor(0hr): migrate Popover to CSS Modules                    | TODO   |
| 9   | —         | refactor(0hr): migrate ContextMenu to CSS Modules                | TODO   |
| 10  | —         | refactor(0hr): migrate CodecPanel to CSS Modules                 | TODO   |
| 11  | —         | refactor(0hr): migrate SvgoPanel to CSS Modules                  | TODO   |
| 12  | —         | refactor(0hr): migrate SnippetPanel to CSS Modules               | TODO   |
| 13  | —         | refactor(0hr): migrate ReportPanel to CSS Modules                | TODO   |
| 14  | —         | refactor(0hr): migrate TweaksPanel to CSS Modules                | TODO   |
| 15  | —         | refactor(0hr): extract QueuePane + ingest.ts + useShellFiles     | TODO   |
| 16  | —         | refactor(0hr): extract ComparePane + usePreviewUrls              | TODO   |
| 17  | —         | refactor(0hr): extract InspectorPane                             | TODO   |
| 18  | —         | refactor(0hr): remove legacy.css                                 | TODO   |

## What Task 1 changed

- Created `src/styles/legacy.css` (291 lines) holding the entire pre-existing `index.css` ruleset verbatim (all WHY comments preserved — D-03 file-row sanitized badge, Phase 2 plan 02-04 reduced-motion guard, ported-from-example-ui markers).
- Trimmed `src/index.css` from 512 lines to 219 lines. Now contains only:
  - `@import "tailwindcss"` + `@import "tw-animate-css"` + `@import "./styles/legacy.css"` (cascade order preserved)
  - `@custom-variant dark`
  - `@layer base { :root + .dark token vars (light + dark themes), @theme inline, body/html base, OIMG legacy aliases, ::selection, .mono, .num }`
- Verified: `npx tsc --noEmit` passes.

## Verification gates passed

- [x] `npx tsc --noEmit -p tsconfig.json` exits 0.

## Verification gates NOT yet run

- [ ] `npm run build` (deferred to Task 18 per plan)
- [ ] Dev-server golden-path smoke test (was not executed — plan calls for it after commits 1, 15, 16, 17, 18 but executor agent has no browser access; this is a user manual verification step)

## Deviations from PLAN.md

None. Task 1 executed exactly per spec.

## Why execution stopped at Task 1

This plan calls for 18 atomic commits restructuring 1382-line `App.tsx` + 512-line `index.css` across ~15 components, with directory moves, hook extraction, MockFile/PLACEHOLDER_FILE removal, cross-component class boundary handling (ContextMenu hover-reveal), and per-component verification. A single executor agent session cannot reliably complete all 18 commits without risk of corrupted intermediate state — each per-component migration requires reading the component, identifying every className touch-point, mapping kebab-case → camelCase keys, deciding which classes compose from primitives vs stay private, deleting the corresponding rules from `legacy.css`, and rerunning `tsc` between every step.

Recommended next steps:
1. Resume execution starting from Task 2 (primitives.module.css) in a follow-up session — the dirty work of kebab→camelCase mapping is mechanical and well-specified.
2. Manually verify Task 1 visual parity in dev (`npm run dev`, drop a file, optimize, compare-stage swap) before continuing — Task 1's cascade reorganization is the riskiest single step because Tailwind's `@import "tailwindcss"` ordering vs `@import "./styles/legacy.css"` could in principle matter for utility precedence. If anything looks off visually, the most likely fix is reordering `@import "./styles/legacy.css"` to AFTER `@layer base { ... }` rather than alongside the Tailwind imports.

## Files

**Created:**
- `src/styles/legacy.css` (291 lines)
- `.planning/quick/260505-0hr-css-modules-migration-full-per-component/260505-0hr-SUMMARY.md` (this file)

**Modified:**
- `src/index.css` (512 → 219 lines)

**Untouched but planned for future commits:**
- `src/components/{shell,panels,ui,file-row}/*.tsx` — flat files, will move into `<Name>/<Name>.tsx` directories with co-located `*.module.css` (Tasks 3–14).
- `src/App.tsx` (1382 lines) — will shrink dramatically when QueuePane/ComparePane/InspectorPane extracted (Tasks 15–17).
- `src/lib/ingest.ts`, `src/hooks/usePreviewUrls.ts`, `src/hooks/useShellFiles.ts` — currently exist as untracked files in worktree (orchestrator note); will be authored fresh per plan during Tasks 15–16.

## Self-Check: PASSED

- `src/styles/legacy.css` exists: FOUND
- `src/index.css` reduced: FOUND (219 lines, contains tailwindcss + legacy.css imports, tokens, base, ::selection, .num/.mono only)
- Commit `b34275a` exists: FOUND
- `npx tsc --noEmit` exits 0: PASS
