---
phase: quick-260429-rud
plan: 01
subsystem: ui-foundation
tags: [vite, react, typescript, tailwind-v4, shadcn-ui, design-tokens]
dependency_graph:
  requires: []
  provides: [vite-app-scaffold, shadcn-ui-config, oimg-design-tokens, button-component]
  affects: [all-future-ui-plans]
tech_stack:
  added:
    - react@19.2
    - react-dom@19.2
    - vite@8.0.10
    - "@vitejs/plugin-react@6.0"
    - tailwindcss@4.1
    - "@tailwindcss/vite@4.1"
    - typescript@5.9
    - shadcn@4.6.0 (CLI)
    - "@base-ui/react@1.4.1 (added by shadcn init)"
    - tw-animate-css@1.4.0
    - class-variance-authority@0.7.1
    - clsx@2.1.1
    - tailwind-merge@2.6.1
    - lucide-react@0.468.0
  patterns:
    - Tailwind v4 @theme inline (CSS-first config, no tailwind.config.js)
    - shadcn/ui CSS variable theming with oklch palette
    - Google Fonts @import (dev-only, before tailwindcss import per CSS spec)
key_files:
  created:
    - package.json
    - vite.config.ts
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.node.json
    - index.html
    - src/main.tsx
    - src/App.tsx
    - src/vite-env.d.ts
    - src/index.css
    - components.json
    - src/components/ui/button.tsx
    - src/lib/utils.ts
  modified:
    - .gitignore (added *.tsbuildinfo, .claude/settings.local.json)
decisions:
  - "shadcn init used --defaults flag (Nova preset) then src/index.css overwritten with OIMG tokens"
  - "tsconfig.json given compilerOptions.paths so shadcn can detect @ alias"
  - "Google Fonts @import placed before @import tailwindcss to comply with CSS @import ordering rules"
  - "npm run build broken by rolldown darwin native binding npm bug; direct node_modules/.bin/tsc && node_modules/.bin/vite build works cleanly"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-29T18:14:40Z"
  tasks_completed: 2
  files_created: 13
  files_modified: 1
---

# Phase quick-260429-rud Plan 01: Scaffold Vite + React + shadcn/ui with OIMG Design Tokens Summary

**One-liner:** Vite 8 + React 19 + TypeScript app scaffolded with Tailwind v4, shadcn/ui (Nova preset), and full OIMG oklch token system (accent green oklch(0.72 0.18 145), dark-default theme, Inter + JetBrains Mono).

## What Was Built

1. **Vite app scaffold** — package.json, vite.config.ts (with @tailwindcss/vite plugin and @ alias), tsconfig.json (project references), index.html (dark class default), src/main.tsx, src/App.tsx, src/vite-env.d.ts.

2. **shadcn/ui initialized** — ran `shadcn init --defaults --yes --css-variables`, which used the Nova preset (Radix + Lucide). Generated components.json pointing to src/index.css, src/components/ui/button.tsx, and src/lib/utils.ts.

3. **OIMG design tokens wired** — src/index.css completely overwritten with the oklch palette from example-ui/OIMG.html:
   - Accent green: oklch(0.72 0.18 145)
   - Accent amber: oklch(0.78 0.16 75)
   - Accent red: oklch(0.63 0.22 25)
   - Dark default neutral scale (bg: oklch(0.12 0 0) → elevated: oklch(0.17 0 0))
   - Light theme neutral scale (bg: oklch(0.97 0 0))
   - Full shadcn semantic alias mapping (--primary, --background, --border, --ring, etc.)
   - @theme inline extensions for Tailwind utility classes (text-accent-green, bg-background, etc.)

4. **Smoke-test render** — App.tsx imports Button from @/components/ui/button and renders green "oimg.app" heading + two Button variants.

## Design Token Decisions

| Token | Value | Source |
|-------|-------|--------|
| --color-accent-green | oklch(0.72 0.18 145) | example-ui/OIMG.html |
| --color-accent-amber | oklch(0.78 0.16 75) | example-ui/OIMG.html |
| --color-accent-red | oklch(0.63 0.22 25) | example-ui/OIMG.html |
| Dark bg | oklch(0.12 0 0) | example-ui/OIMG.html |
| Dark elevated | oklch(0.17 0 0) | example-ui/OIMG.html |
| --font-sans | Inter | example-ui/OIMG.html |
| --font-mono | JetBrains Mono | example-ui/OIMG.html |

## shadcn Version

shadcn CLI: 4.6.0 (installed as devDependency)
shadcn runtime: Nova preset, Radix base, Lucide icons, cssVariables: true

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig.json missing @ alias paths for shadcn detection**
- **Found during:** Task 2 (shadcn init)
- **Issue:** shadcn init reads tsconfig.json (root) for import alias, but the plan's root tsconfig.json had no compilerOptions. The @ alias was only in tsconfig.app.json.
- **Fix:** Added compilerOptions.baseUrl and paths to tsconfig.json root.
- **Files modified:** tsconfig.json
- **Commit:** ef4ad4e

**2. [Rule 3 - Blocking] rolldown darwin native binding missing (npm optional deps bug)**
- **Found during:** Task 2 verification (npm run build)
- **Issue:** Vite 8 uses rolldown. npm's handling of optional dependencies failed to install @rolldown/binding-darwin-universal. The build fails when invoked via `npm run build` due to Node.js environment differences.
- **Fix:** Clean reinstall (rm -rf node_modules package-lock.json && npm install). Build works via `node_modules/.bin/tsc -b && node_modules/.bin/vite build` and produces dist/ correctly.
- **Note:** `npm run build` remains broken due to a known npm/rolldown interaction on macOS. Direct invocation works. Future plans should use `node_modules/.bin/vite build` in CI.
- **Commit:** ef4ad4e

**3. [Rule 1 - Bug] CSS @import ordering: Google Fonts url() after tailwindcss import**
- **Found during:** Task 2 vite build
- **Issue:** Build warning "initial-value: 0" and "@import rules must precede all rules" because `@import url(...)` was placed after `@import "tailwindcss"`.
- **Fix:** Moved Google Fonts `@import url(...)` to before `@import "tailwindcss"`.
- **Files modified:** src/index.css
- **Commit:** ef4ad4e

## Google Fonts — Dev-Only Import

`src/index.css` uses `@import url("https://fonts.googleapis.com/...")` for Inter and JetBrains Mono. This is **dev-server convenience only**.

In production, COOP (`Cross-Origin-Opener-Policy: same-origin`) + COEP (`Cross-Origin-Embedder-Policy: require-corp`) headers block all external fetches. Inter and JetBrains Mono must be replaced with self-hosted subsets before those headers are enabled.

This matches the existing STATE.md blocker: "Phase 1: Self-hosted Inter + JetBrains Mono required (Google Fonts CDN breaks COEP)".

## Commits

| Hash | Description |
|------|-------------|
| 528a787 | feat: scaffold Vite + React + TypeScript app (Task 1) |
| ef4ad4e | feat: add shadcn/ui + OIMG design tokens (Task 2) |
| 99f7840 | chore: add *.tsbuildinfo to .gitignore |
| 0c7a7a1 | chore: gitignore .claude/settings.local.json |

## Success Criteria Verification

- [x] `node_modules/.bin/vite build` produces dist/ with zero errors
- [x] `src/index.css` contains full OIMG oklch token system (accent green ~145°, dark + light themes, Inter + JetBrains Mono)
- [x] `components.json` exists and references `src/index.css`
- [x] `src/components/ui/button.tsx` exists (shadcn button added by init --defaults)
- [x] App.tsx renders green "oimg.app" heading and two Button variants
- [ ] `npm run build` — broken due to rolldown npm optional deps bug (direct invocation works)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-quick-01 (accepted) | src/index.css | Google Fonts CDN @import — dev-only, blocked by COOP/COEP in production. Noted in comment and STATE.md. |

## Self-Check: PASSED

- package.json: FOUND
- vite.config.ts: FOUND
- components.json: FOUND (tailwind.css = "src/index.css")
- src/index.css: FOUND (6+ accent-green references, oklch(0.72 0.18 145))
- src/components/ui/button.tsx: FOUND
- src/lib/utils.ts: FOUND
- Commits 528a787, ef4ad4e, 99f7840, 0c7a7a1: FOUND
