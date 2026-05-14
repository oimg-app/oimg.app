# External Integrations

**Analysis Date:** 2026-05-14

## APIs & External Services

**None.** This application is 100% client-side with zero external API calls at runtime. All processing happens in the browser using WebAssembly. No analytics, no error tracking SaaS, no remote feature flags — non-negotiable by design.

## Data Storage

**Databases:**
- None — no remote database
- Browser `localStorage` — used by `inspired/version-0/hooks/useTheme.ts` for theme persistence (dark/light preference)
- IndexedDB — planned for settings persistence (referenced in store comments as "Phase 7 wires IndexedDB"); not yet implemented

**File Storage:**
- Local filesystem only — files are read via browser File API, processed in-memory, and downloaded via browser's native save dialog
- No cloud storage; no file uploads to any server

**Caching:**
- None — no service worker, no HTTP cache layer beyond browser defaults

## Authentication & Identity

**Auth Provider:**
- None — the application requires no login, account, or session

## Monitoring & Observability

**Error Tracking:**
- None — intentional; zero telemetry is a core constraint

**Logs:**
- Browser `console` only (development); no log aggregation service

**Analytics:**
- None — zero-telemetry by design

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages — static deployment; custom domain `oimg.app`
- Required production headers in `public/_headers`:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
  These headers enable `SharedArrayBuffer` for WASM threading (OxiPNG MT, AVIF MT)

**CI Pipeline:**
- Not detected — no `.github/workflows/`, `.circleci/`, or similar config in the project root

## Environment Configuration

**Required env vars:**
- None — the application has no environment variables; confirmed by absence of any `.env*` files and purely client-side architecture

**Secrets location:**
- Not applicable — no secrets exist in this architecture

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs Used (Internal — Not External Services)

These are browser-native capabilities, not third-party services, but are worth noting as integration points:

- **File System Access API** — `showSaveFilePicker` (with `file-saver` fallback for Safari/Firefox)
- **Web Workers** — codec processing via `inspired/version-0/workers/worker.ts` and pool in `inspired/version-0/workers/pool.ts`
- **WebAssembly** — all jSquash codecs (`@jsquash/*`) run as WASM modules inside Web Workers
- **OffscreenCanvas** — image rendering in worker threads
- **SharedArrayBuffer** — required for OxiPNG MT and AVIF MT builds; gated behind COOP/COEP headers
- **Comlink** (`comlink` ^4.4.2) — `postMessage` proxy between main thread and worker pool

## npm Registry

All packages are sourced from the public npm registry. No private registries, GitHub Packages, or internal package feeds detected.

---

*Integration audit: 2026-05-14*
