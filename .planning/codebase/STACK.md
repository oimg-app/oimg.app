# Technology Stack

**Analysis Date:** 2026-05-14

## Languages

**Primary:**
- TypeScript ^5.9 — all application code under `inspired/version-0/` and config files
- TSX — React components under `inspired/version-0/components/`

**Secondary:**
- HTML — single entry point `index.html`
- CSS — Tailwind v4 utility classes + CSS variables in `inspired/version-0/styles/`

## Runtime

**Environment:**
- Browser (WebAssembly + Web Workers + OffscreenCanvas) — 100% client-side, zero server
- Node.js (dev/build tooling only) — tested on v25.9.0; no version pin file present

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- React ^19.2 — UI rendering; uses `useTransition`, `useDeferredValue`
- Vite ^7.3 — build tool; ES module workers via `worker: { format: 'es' }` in `vite.config.ts`
- `@vitejs/plugin-react` ^5.2 — React Fast Refresh

**Styling:**
- Tailwind CSS ^4.1 — utility-first CSS; configured via `@tailwindcss/vite` plugin
- `tw-animate-css` ^1.4.0 — animation utilities
- `tailwind-merge` ^2.6.1 — conditional class merging
- `class-variance-authority` ^0.7.1 — variant-based component styling
- `clsx` ^2.1.1 — conditional className joining
- `next-themes` ^0.4.6 — dark/light theme switching

**UI Component Libraries:**
- `radix-ui` ^1.4.3 — headless primitives (tooltip, popover, slider, etc.)
- `@base-ui/react` ^1.4.1 — additional headless components
- shadcn (dev) ^4.7.0 — component generator; style: `radix-lyra`; config at `components.json`
- `cmdk` ^1.1.1 — command palette
- `react-resizable-panels` ^4.11.0 — resizable layout panels

**Testing:**
- Playwright ^1.59.1 — E2E tests; config at `playwright.config.ts`; runs against Chromium only
- Node `--experimental-strip-types` — lightweight unit tests in `src/tests/build.test.ts`

**Build/Dev:**
- Rolldown (Vite 7 default bundler)
- `@rollup/rollup-darwin-arm64` / `@rollup/rollup-darwin-x64` ^4.60 — optional platform bindings
- `scripts/ensure-rollup-binding.mjs` — postinstall guard for native Rollup bindings

## Key Dependencies

**WASM Image Codecs (jSquash):**
- `@jsquash/jpeg` ^1.6.0 — MozJPEG-based JPEG encode/decode
- `@jsquash/webp` ^1.5.0 — libwebp encode/decode
- `@jsquash/avif` ^2.1.1 — libavif encode/decode (lazy-loaded only; ~8 MB unpacked)
- `@jsquash/oxipng` ^2.3.0 — OxiPNG optimization (encode-only; requires `@jsquash/png` for decode first)
- `@jsquash/png` ^3.1.1 — rust-png decode → ImageData
- `@jsquash/resize` ^2.1.1 — image resize (hqx/triangle/lanczos3) for 1x/2x/3x variants
- All jSquash codecs are excluded from Vite dep bundling via `optimizeDeps.exclude` to preserve WASM URL resolution

**SVG:**
- `svgo` ^4.0.1 — SVG optimization; imported via `svgo/browser` ESM sub-export; pre-bundled via `optimizeDeps.include`

**State Management:**
- `nanostores` ^1.3.0 — lightweight atom/map stores; replaces Zustand from earlier phases
- `@nanostores/react` ^1.1.0 — React bindings for nanostores

**Worker Communication:**
- `comlink` ^4.4.2 — Promise/proxy wrapper over `postMessage`; used in `inspired/version-0/workers/pool.ts`

**UI Utilities:**
- `sonner` ^2.0.7 — toast notifications; promise-based API
- `dompurify` ^3.4.2 — SVG sanitization before render; pre-bundled via `optimizeDeps.include`
- `@phosphor-icons/react` ^2.1.10 — primary icon set (shadcn config: `"iconLibrary": "phosphor"`)
- `lucide-react` ^0.468.0 — secondary icon set

**Fonts:**
- `@fontsource-variable/inter` ^5.2.8
- `@fontsource-variable/jetbrains-mono` ^5.2.8
- `@fontsource-variable/geist` ^5.2.8

## Configuration

**Environment:**
- No `.env` files detected; no environment variables required (100% client-side)
- COOP/COEP headers required for `SharedArrayBuffer` (threading): set in both `vite.config.ts` server headers and `public/_headers` for Cloudflare Pages production

**Build:**
- `vite.config.ts` — Vite config with WASM asset handling, worker ES format, COOP/COEP headers
- `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` — project references; `moduleResolution: "bundler"`, strict mode, `@/*` alias maps to `./src/*`
- `components.json` — shadcn component generator config; style `radix-lyra`, CSS variables, phosphor icons
- `playwright.config.ts` — E2E test config; Chromium only; base URL `http://localhost:5173`

**Path Alias:**
- `@/*` → `./src/*` (configured in `vite.config.ts` resolve.alias and `tsconfig.app.json` paths)

## Platform Requirements

**Development:**
- Modern browser with WebAssembly, Web Workers, OffscreenCanvas (Chrome/Firefox/Safari/Edge last 2 stable)
- Node.js (any recent version for build tooling)

**Production:**
- Cloudflare Pages — free tier, edge CDN
- Requires `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` headers (set in `public/_headers`)
- No server-side runtime; purely static deployment

---

*Stack analysis: 2026-05-14*
