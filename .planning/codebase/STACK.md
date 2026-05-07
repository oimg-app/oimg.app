# Technology Stack

**Analysis Date:** 2026-05-07

## Languages

**Primary:**
- TypeScript 5.9 — all source files under `src/`
- CSS (CSS Modules + Tailwind v4) — component-scoped styles in `*.module.css`

**Secondary:**
- JavaScript — `scripts/ensure-rollup-binding.mjs` (postinstall helper)

## Runtime

**Environment:**
- Browser (no Node.js server) — 100% client-side, zero-server
- Requires: WebAssembly + Web Workers + crossOriginIsolated (COOP/COEP headers)

**Package Manager:**
- npm — `package-lock.json` present (lockfile committed)

## Frameworks

**Core:**
- React 19.2 — UI framework; `StrictMode` wrapper in `src/main.tsx`
- Vite 7.3 — build and dev server; `vite.config.ts` at repo root

**UI Components:**
- `@base-ui/react` ^1.4.1 — accessible primitives (Popover, Slider, Tooltip, Seg, Toggle, Switch)
- 'components.json' - shadcn components 
- `lucide-react` ^0.468.0 — icon set

**Styling:**
- Tailwind CSS 4.1 (via `@tailwindcss/vite` plugin) — utility classes
- CSS Modules — co-located `*.module.css` files for shell components
- `class-variance-authority` ^0.7.1 + `clsx` ^2.1.1 + `tailwind-merge` ^2.6.1 — variant/conditional class helpers
- `tw-animate-css` ^1.4.0 — Tailwind animation utilities

**Testing:**
- Playwright 1.59.1 — E2E and integration tests (`*.spec.ts` in `src/tests/`)
- Node `--experimental-strip-types` — runs unit/logic `.test.ts` files directly (no Jest/Vitest)

**Build/Dev:**
- `@vitejs/plugin-react` ^5.2 — React Fast Refresh
- `typescript` ^5.9 — `tsc -b && vite build`
- Vite workers configured as ES modules (`worker.format: 'es'`)

## Key Dependencies

**Critical:**

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^5.0.12 | Global state — three sliced stores: files, settings, runtime |
| `comlink` | ^4.4.2 | Worker proxy — wraps `postMessage` in Promise/proxy API |
| `svgo` | ^4.0.1 | SVG optimizer — browser ESM build (`svgo/browser`) |
| `dompurify` | ^3.4.2 | SVG XSS sanitization — main-thread only (requires `document`) |
| `@jsquash/png` | ^3.1.1 | PNG decode + encode (WASM, inside worker) |
| `@jsquash/resize` | ^2.1.1 | Image resize (WASM, inside worker — lanczos3/mitchell/catrom/triangle) |
| `sonner` | ^2.0.7 | Toast notifications — `toast.promise()` for async flows |

**Infrastructure:**

| Package | Version | Purpose |
|---------|---------|---------|
| `next-themes` | ^0.4.6 | Dark/light theme management |
| `@fontsource-variable/inter` | ^5.2.8 | Inter variable font |
| `@fontsource-variable/jetbrains-mono` | ^5.2.8 | JetBrains Mono variable font |
| `@fontsource-variable/geist` | ^5.2.8 | Geist variable font |
| `shadcn` | ^4.6.0 (devDep) | UI component scaffold CLI |

**Not yet in use (planned):**
- `@jsquash/jpeg` — JPEG encoding (Phase 5)
- `@jsquash/webp` — WebP encoding (Phase 5)
- `@jsquash/avif` — AVIF encoding (Phase 5+, lazy-load only)
- `@jsquash/oxipng` — OxiPNG optimization (Phase 5)
- `jszip` — batch ZIP export (Phase 5+)

## Configuration

**Environment:**
- No `.env` file required for local dev — all processing is client-side
- `crossOriginIsolated` required at runtime; dev server sets COOP/COEP headers in `vite.config.ts`
- `import.meta.env.DEV` gates test affordances (e.g. `__OIMG_SLOW_MS__`)

**Path Alias:**
- `@` → `src/` (configured in `vite.config.ts` via `resolve.alias`)

**Build:**
- `tsconfig.json` at repo root; `tsc -b && vite build`
- Workers build as ES modules (`worker.format: 'es'` in `vite.config.ts`)
- `optimizeDeps.include: ['svgo/browser', 'dompurify']` for dev pre-bundling

**Postinstall:**
- `scripts/ensure-rollup-binding.mjs` — ensures correct Rollup native binding on Darwin x64

## Platform Requirements

**Development:**
- Node.js (for Vite dev server and build)
- Chrome required for Playwright tests (Chromium only in `playwright.config.ts`)
- `crossOriginIsolated = true` required for codec workers

**Production:**
- Cloudflare Pages — free tier, edge CDN
- Must serve COOP (`same-origin`) + COEP (`require-corp`) headers for SharedArrayBuffer/worker support
- Target: modern browsers (Chrome, Firefox, Safari, Edge — last 2 stable)

---

*Stack analysis: 2026-05-07*
