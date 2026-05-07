# External Integrations

**Analysis Date:** 2026-05-07

## APIs & External Services

This app is intentionally zero-server and zero-telemetry. **No external API calls are made at runtime.** All processing is client-side. The integrations below are build-time or codec-level WASM bundles, not network APIs.

## Data Storage

**Databases:**
- None in production — all state is in-memory (Zustand stores)
- Persistence: Phase 7 deferred — `IndexedDB` + `idb-keyval` planned for named presets

**File Storage:**
- Browser `Blob` + `URL.createObjectURL()` — object URL cache managed in `src/stores/runtime.ts` (`urlCache: Map<string, string>`)
- No cloud storage; files never leave the browser

**Caching:**
- Object URL cache: `useRuntimeStore.urlCache` (Map, in-memory, lifecycle-managed per file)
- No service worker / browser cache layer for file data

## Authentication & Identity

**Auth Provider:**
- None — no login, no accounts, no user identity

## Codec Libraries (WASM, bundled)

These run entirely inside Web Workers — no network calls, no remote endpoints.

**Active (Phase 1–4):**
- `svgo` ^4.0.1 — SVG optimization, browser ESM build (`svgo/browser`), runs in worker
  - Import: `import { optimize } from 'svgo/browser'` in `src/workers/svg-adapter.ts`
- `@jsquash/png` ^3.1.1 — PNG decode + encode (WASM), runs in worker
  - Import: `import { decode, encode } from '@jsquash/png'` in `src/workers/png-adapter.ts`
- `@jsquash/resize` ^2.1.1 — ImageData resize (WASM), runs in worker
  - Import: `import resize from '@jsquash/resize'` in `src/workers/png-adapter.ts`
- `dompurify` ^3.4.2 — SVG XSS sanitization, runs on **main thread** only
  - Import: `import DOMPurify from 'dompurify'` in `src/lib/sanitize-svg.ts`

**Planned (Phase 5+):**
- `@jsquash/jpeg` — JPEG encode/decode (MozJPEG-based) — Phase 5
- `@jsquash/webp` — WebP encode/decode — Phase 5
- `@jsquash/avif` — AVIF encode/decode — Phase 5+ (lazy-load only, ~2 MB gzipped)
- `@jsquash/oxipng` — OxiPNG lossless optimization — Phase 5

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, no Datadog, no remote error reporting (privacy non-negotiable)

**Analytics:**
- None — zero telemetry, by design

**Logs:**
- `console.error` only, in adapter error paths and `enqueuePreview` catch blocks
- Dev-only: `crossOriginIsolated` check in `src/main.tsx` logs a warning if COOP/COEP missing

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages — free tier, edge CDN, custom domain `oimg.app`
- Requires COOP/COEP headers (`same-origin` / `require-corp`) for SharedArrayBuffer
- CI configuration: not found in repository root (Cloudflare Pages auto-deploys from git)

**CI Pipeline:**
- No `.github/workflows/` CI config in the main source tree
- Playwright tests run locally; `npm test` launches the dev server then runs specs

## Environment Configuration

**Required env vars:**
- None — zero-server app has no backend secrets

**Secrets location:**
- None — no secrets, no credentials, no API keys

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs Used (key platform integrations)

- `Worker` / `URL.createObjectURL(new URL(..., import.meta.url))` — Web Workers
- `Comlink` — postMessage proxy (`src/workers/pool.ts`)
- `navigator.hardwareConcurrency` — pool size (capped at 4)
- `navigator.deviceMemory` — memory budget (`src/lib/memory-budget.ts`)
- `crypto.randomUUID()` — stable file IDs
- `URL.createObjectURL` / `URL.revokeObjectURL` — thumbnail/preview URLs
- `crossOriginIsolated` — guards codec worker startup check in `src/main.tsx`
- `AbortController` / `AbortSignal` — batch cancel signaling in `WorkerPool`

---

*Integration audit: 2026-05-07*
