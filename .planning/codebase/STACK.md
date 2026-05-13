# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- TypeScript 5.9 — all source files under `src/`

**Secondary:**
- CSS (CSS Modules) — co-located `*.module.css` files per component, plus `src/index.css` and `src/styles/`

## Runtime

**Environment:**
- Browser-only (no Node server). Requires `crossOriginIsolated = true` for SharedArrayBuffer / threaded WASM; COOP + COEP headers set in `vite.config.ts` dev server and must be replicated on Cloudflare Pages.

**Package Manager:**
- npm — `package-lock.json` present (committed)

## Frameworks

**Core:**
- React 19.2 — UI layer; `useTransition` / `useDeferredValue` available for non-blocking codec work
- Vite 7.3 — dev server + build (ES module workers via `worker: { format: 'es' }`); path alias `@` → `src/`

**UI Primitives:**
- `@base-ui/react` ^1.4.1 — headless Popover, Tooltip, Slider, Toggle, Seg components in `src/components/ui/`
- `lucide-react` ^0.468.0 — icon set
- `next-themes` ^0.4.6 — theme (dark/light) switching
- `tw-animate-css` ^1.4.0 — animation utilities

**Styling:**
- Tailwind CSS 4.1 (via `@tailwindcss/vite` plugin) + CSS Modules per component
- `clsx` + `tailwind-merge` + `class-variance-authority` — className composition utilities
- Fonts: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@fontsource-variable/geist`

**Build/Dev:**
- `@vitejs/plugin-react` ^5.2 — React Fast Refresh
- TypeScript compiler (`tsc -b`) runs before `vite build`
- `shadcn` ^4.6.0 (devDep) — component scaffolding CLI; config at `components.json`

## Key Dependencies

**WASM Codecs (jSquash):**
- `@jsquash/jpeg` ^1.6.0 — MozJPEG encode/decode; the JPEG package IS MozJPEG (no separate `@jsquash/mozjpeg`); adapter at `src/workers/jpeg-adapter.ts`
- `@jsquash/webp` ^1.5.0 — libwebp encode/decode; adapter at `src/workers/webp-adapter.ts`
- `@jsquash/avif` ^2.1.1 — libavif encode/decode; ~8.4 MB unpacked; lazy-loaded only when user picks AVIF; adapter at `src/workers/avif-adapter.ts`
- `@jsquash/png` ^3.1.1 — rust-png decode (feeds into oxipng resize pipeline); adapter at `src/workers/png-adapter.ts`
- `@jsquash/oxipng` ^2.3.0 — OxiPNG lossless optimizer; encode-only; input must be PNG bytes, NOT ImageData; lazy-loaded inside `png-adapter.ts`
- `@jsquash/resize` ^2.1.1 — hqx/lanczos3/mitchell/catrom resize for density variants

**SVG:**
- `svgo` ^4.0.1 — SVG optimizer; imported as `svgo/browser` ESM build inside the worker (`src/workers/svg-adapter.ts`); pre-bundled via `optimizeDeps.include`
- `dompurify` ^3.4.2 — XSS sanitization post-SVGO; requires `document`, runs on main thread only (`src/lib/sanitize-svg.ts`); pre-bundled via `optimizeDeps.include`

**State:**
- `zustand` ^5.0.12 with `subscribeWithSelector` middleware — three sliced stores exported from `src/stores/`

**Worker Communication:**
- `comlink` ^4.4.2 — wraps `postMessage` in Promise/proxy API; pool singleton at `src/workers/pool.ts`

**Toasts:**
- `sonner` ^2.0.7 — promise-aware toast notifications; component at `src/components/ui/sonner.tsx`

**Testing:**
- `@playwright/test` ^1.59.1 — all tests (e2e + integration + unit-style) in `src/tests/`; config at `playwright.config.ts`

**Misc:**
- `@rollup/rollup-darwin-arm64`, `@rollup/rollup-darwin-x64` — optional native Rollup bindings
- `scripts/ensure-rollup-binding.mjs` — postinstall hook ensures correct native Rollup binding

## Configuration

**Environment:**
- No `.env` secrets files — zero-server, zero-telemetry design
- COOP/COEP headers required at hosting: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`
- `crossOriginIsolated` check in `src/main.tsx` logs error on startup if headers missing

**Build:**
- `vite.config.ts` — plugins, `worker: { format: 'es' }`, `@` alias, `optimizeDeps.include: ['svgo/browser', 'dompurify']`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript project references
- `components.json` — shadcn CLI component configuration

## Platform Requirements

**Development:**
- Node.js (for Vite + TypeScript tooling)
- macOS arm64 or x64 — Rollup optional native bindings declared

**Production:**
- Cloudflare Pages — static CDN; must set COOP/COEP response headers
- No server-side runtime — 100% static bundle

---

*Stack analysis: 2026-05-12*
