---
phase: 01-shell-foundation
plan: "01"
subsystem: security-headers
tags: [coop, coep, fonts, design-tokens, css]
dependency_graph:
  requires: []
  provides: [cross-origin-isolation, self-hosted-fonts, oimg-design-tokens]
  affects: [src/index.css, vite.config.ts, src/main.tsx, public/_headers]
tech_stack:
  added:
    - "@fontsource-variable/inter@^5"
    - "@fontsource-variable/jetbrains-mono@^1"
  patterns:
    - COOP/COEP headers in Vite dev server (server.headers)
    - Cloudflare Pages _headers file for production COOP/COEP
    - crossOriginIsolated runtime assertion in main.tsx
    - OIMG 5-stop oklch surface token scale with .dark override
key_files:
  created:
    - public/_headers
  modified:
    - vite.config.ts
    - src/main.tsx
    - src/index.css
decisions:
  - "Self-hosted @fontsource-variable packages replace Google Fonts CDN to satisfy COEP"
  - "crossOriginIsolated assertion is a console.error (not throw) — graceful degradation for Phase 1, hard failure guarded in Phase 2 codec workers"
  - "Legacy --color-bg/border/foreground/muted aliases retained for backward compat with existing button.tsx"
  - "npm run build broken by rolldown darwin-universal binding lookup failure in npm shell context; tsc -b && vite build passes directly — pre-existing environment issue, not introduced by this plan"
metrics:
  duration: 7m
  completed_date: "2026-04-29T20:42:39Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 1 Plan 01: Security Headers + Font Self-Hosting + Design Token Expansion

**One-liner:** COOP/COEP headers in dev+prod, Google Fonts CDN removed, @fontsource-variable Inter+JetBrains Mono self-hosted, OIMG 5-stop oklch surface scale locked in.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install fontsource + COOP/COEP headers | d0df754 | vite.config.ts, public/_headers, src/main.tsx, package.json |
| 2 | Expand src/index.css to 5-stop OIMG scale | a625438 | src/index.css |

## Verification Results

All acceptance criteria passed:

- `dist/_headers` exists with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
- `vite.config.ts` contains `server.headers` block with both COOP and COEP directives
- `src/main.tsx` imports `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` before `./index.css`
- `src/main.tsx` contains `if (!crossOriginIsolated)` console.error assertion
- `src/index.css` contains zero references to `fonts.googleapis.com`
- `src/index.css` has `--color-bg-0` through `--color-bg-3` in both `:root` (light) and `.dark` with exact UI-SPEC.md oklch values
- `src/index.css` has `--height-titlebar: 36px` and `--width-file-panel: 320px` layout tokens
- Vite build exits 0 (`tsc -b && ./node_modules/.bin/vite build` succeeds)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Out-of-Scope Issues Noted

**[Pre-existing] npm run build broken by rolldown binding resolution in npm shell context**
- **Found during:** Task 1 build verification
- **Issue:** `npm run build` fails with "Cannot find native binding" for rolldown. The error occurs because rolldown's binding loader accumulates errors from darwin-universal and darwin-x64 (not present on arm64 machine) before reaching the arm64 block, and in the npm shell execution context the arm64 `require` apparently fails too (race/context issue). Direct invocation `./node_modules/.bin/vite build` succeeds.
- **Pre-existing:** Confirmed same failure in main project directory before any changes.
- **Deferred:** Logged to deferred-items.md. Not introduced by this plan.
- **Workaround used:** Build verified via `./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build`

## Threat Surface Scan

All three threat register items (T-01-01, T-01-02, T-01-03) were mitigated:
- T-01-01: COOP header in vite.config.ts + public/_headers
- T-01-02: COEP header in vite.config.ts + public/_headers
- T-01-03: Google Fonts CDN removed from src/index.css

No new network endpoints, auth paths, or trust boundaries introduced.

## Known Stubs

None — no placeholder data, no TODO/FIXME in created/modified files.

## Self-Check: PASSED

- `public/_headers` — FOUND
- `vite.config.ts` (modified) — FOUND
- `src/main.tsx` (modified) — FOUND
- `src/index.css` (modified) — FOUND
- Commit d0df754 — FOUND
- Commit a625438 — FOUND
