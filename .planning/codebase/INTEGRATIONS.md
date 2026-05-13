# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**None** — oimg.app is 100% client-side. No external API calls, no analytics, no remote feature flags, no error tracking SaaS. Non-negotiable privacy constraint.

## Data Storage

**Databases:**
- None (in-memory only). Phase 7 plans IndexedDB persistence via `idb-keyval` (not yet implemented). Zustand stores are in-memory and reset on page reload.

**File Storage:**
- Browser Object URLs (`URL.createObjectURL`) — managed via `useRuntimeStore.urlCache` (`src/stores/runtime.ts`). Revoked on file removal via `revokeObjectURL`.
- ZIP output — generated in-browser via jszip (not yet fully wired; planned for batch download).

**Caching:**
- None (no service worker, no HTTP cache layer beyond Cloudflare CDN for static assets).

## Authentication & Identity

**Auth Provider:**
- None — no user accounts, no login.

## Monitoring & Observability

**Error Tracking:**
- None (zero-telemetry by design). Errors log to `console.error` only (e.g., `[startOptimize]`, `[enqueuePreview]` prefixed messages in `src/hooks/useBatchOrchestrate.ts`).

**Logs:**
- `console.error` / `console.warn` in dev; silent in production paths.

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages — static CDN with WASM-friendly headers. COOP/COEP response headers must be configured at the Pages project level.

**CI Pipeline:**
- Not detected (no `.github/workflows/` in the application repo; `inspired/squoosh/` submodule has its own workflows but is reference material only).

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## WASM Codec Loading

**Pattern:** Lazy dynamic import inside the worker, not at module init.

- `avif-adapter.ts` — `import('@jsquash/avif')` on first use (lazy, ~2 MB gzipped; only when user picks AVIF)
- `oxipng` inside `png-adapter.ts` — `import('@jsquash/oxipng')` on first use via `getOxipng()` helper
- All other codecs (`jpeg`, `webp`, `png`, `resize`) — imported at top of their adapter modules; still isolated inside the worker bundle

**Worker spawn pattern** (`src/workers/pool.ts`):
```typescript
new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
```
Static literal path so Vite can statically analyze and code-split.

## Environment Configuration

**Required browser capabilities:**
- `crossOriginIsolated === true` (COOP + COEP headers)
- WebAssembly support
- Web Workers (module type)
- `URL.createObjectURL` / `URL.revokeObjectURL`
- `crypto.randomUUID`

**Feature detection** (inline, no external lib):
```typescript
if (!crossOriginIsolated) { console.error(...) } // src/main.tsx
```

## Font Loading

- `@fontsource-variable/inter` — Inter Variable, imported in `src/main.tsx`
- `@fontsource-variable/jetbrains-mono` — JetBrains Mono Variable, imported in `src/main.tsx`
- `@fontsource-variable/geist` — Geist Variable (available, not imported in main.tsx yet)
- All fonts are bundled as npm packages — no external CDN calls

---

*Integration audit: 2026-05-12*
