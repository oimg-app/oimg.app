# Phase 14: Installable PWA - Research

**Researched:** 2026-06-11
**Domain:** Progressive Web App — vite-plugin-pwa + Workbox + SW lifecycle + install prompt
**Confidence:** HIGH

---

## Summary

Phase 14 makes oimg.app installable as a desktop/mobile PWA with full offline functionality on second visit. The approach is locked by prior decisions: `vite-plugin-pwa@1.3.0` in `injectManifest` mode, hand-rolled `src/sw.ts` using Workbox primitives, with codec wasms cached at first-use (never precached). The existing prior research artifact (`.planning/research/v1.2-pwa.md`) is HIGH confidence and confirmed current.

There is one confirmed integration risk: Vite 7 with Rolldown and `virtual:pwa-register` resolution. The workaround is documented below. The COOP/COEP concern is NOT a landmine — Cloudflare Pages serves COOP/COEP headers at the HTTP layer before the SW intercepts, and the SW fetches from the same origin, so `crossOriginIsolated` is preserved. No header injection in the SW is needed.

**Primary recommendation:** Use `virtual:pwa-register` for SW registration (lazy-loaded via `requestIdleCallback`), hand-roll `src/sw.ts` with Workbox precache + CacheFirst wasm routing, add `oimg-logo-maskable-512.png` as the only new asset, and patch `_headers` + `vite.config.ts` as specified below.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PWA-01 | `manifest.webmanifest` via vite-plugin-pwa@1.3.0 (injectManifest) with specified schema | §Standard Stack, §manifest schema, §vite.config.ts pattern |
| PWA-02 | Hand-rolled `src/sw.ts` precaching app shell; runtime-caching wasm via CacheFirst; AVIF never precached | §Service Worker pattern, §sw.ts code example |
| PWA-03 | `beforeinstallprompt` deferred → StatusBar "Install" button; click invokes prompt; success hides button | §Install Prompt pattern, §useInstallPrompt code example |
| PWA-04 | Cloudflare `_headers` updated: `/sw.js no-cache`, `/manifest.webmanifest max-age=86400`; COOP/COEP preserved | §Cloudflare Headers |
| PWA-05 | SW skipWaiting + clientsClaim; "New version available" toast on SW takeover | §SW update lifecycle, §register-sw.ts pattern |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App shell precache manifest | Build-time (vite-plugin-pwa) | SW (runtime precacheAndRoute) | Plugin injects manifest at build; SW applies it at install |
| WASM runtime caching | Browser / SW | — | SW intercepts fetch, CacheFirst on `*.wasm` URL pattern |
| Install prompt capture | Browser / Client | StatusBar component | `beforeinstallprompt` is a window event; nanostores atom bridges to UI |
| Manifest delivery | CDN / Static | — | `manifest.webmanifest` is a static file served by Cloudflare Pages |
| SW update notification | SW → Client | sonner toast in App.tsx | SW posts message; `virtual:pwa-register` `onNeedRefresh` callback fires |
| COOP/COEP headers | CDN / Static (Cloudflare `_headers`) | Vite dev server headers | Already set at HTTP layer; SW does NOT need to re-inject them |
| `offlineReady` caps flag | Browser / Client (caps.ts) | runtimeAtom | Updated after SW install → precache complete via `onOfflineReady` callback |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite-plugin-pwa` | `1.3.0` [VERIFIED: npm registry] | Vite integration for Workbox + manifest + SW build | Official Vite PWA plugin; ships workbox-build + workbox-window as deps; supports Vite ^3–8 |
| `workbox-precaching` | `7.4.1` [VERIFIED: npm registry] | Precache manifest injection + routing in sw.ts | Bundled as transitive dep of workbox-build |
| `workbox-routing` | `7.4.1` [VERIFIED: npm registry] | Route matching for runtime cache strategies | Bundled as transitive dep |
| `workbox-strategies` | `7.4.1` [VERIFIED: npm registry] | CacheFirst / StaleWhileRevalidate strategies | Bundled as transitive dep |
| `workbox-expiration` | `7.4.1` [VERIFIED: npm registry] | Cache size + age eviction for runtime caches | Bundled as transitive dep |
| `workbox-cacheable-response` | `7.4.1` [VERIFIED: npm registry] | Filter cacheable responses (status 0 + 200 for WASM) | Required for opaque responses (CDN fetches) |

**All workbox-* packages are transitive dependencies of `workbox-build`, which ships with `vite-plugin-pwa`. No explicit install required except `vite-plugin-pwa` itself.**

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vite-pwa/assets-generator` | `1.0.2` [VERIFIED: npm registry] | Generate maskable PNG icons from source SVG | Wave 0: generate `oimg-logo-maskable-512.png` from `oimg-logo.svg` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `injectManifest` strategy | `generateSW` strategy | generateSW is zero-config but cannot express the "never precache *.wasm" rule or the custom runtime routing for `/squoosh-kit/` paths |
| `virtual:pwa-register` | Manual `navigator.serviceWorker.register()` | Manual gives more control but loses `onNeedRefresh` / `onOfflineReady` callbacks; not worth the complexity |

**Installation:**

```bash
npm install -D vite-plugin-pwa
```

(workbox-* packages arrive as transitive deps)

For the maskable icon (one-time, not a runtime dep):

```bash
npx @vite-pwa/assets-generator --preset minimal --source public/oimg-logo.svg
```

Or create manually: 512×512 PNG with 10% safe-zone padding from `oimg-logo-1024.png`.

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `vite-plugin-pwa` | npm | ~4 yrs | Multi-million/mo | github.com/vite-pwa/vite-plugin-pwa | N/A (slopcheck unavailable) | Approved — official Vite PWA plugin, widely used [ASSUMED: slopcheck not run] |
| `workbox-precaching` | npm | ~7 yrs | Multi-million/mo | github.com/GoogleChrome/workbox | N/A | Approved — Google Chrome team [ASSUMED: slopcheck not run] |
| `workbox-window` | npm | ~5 yrs | Multi-million/mo | github.com/GoogleChrome/workbox | N/A | Approved [ASSUMED: slopcheck not run] |

**slopcheck was unavailable at research time.** All packages are well-established (Google Chrome team + antfu/vite-pwa team) with years of history. The planner should treat them as approved but can add a `checkpoint:human-verify` if the team requires it.

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User visits oimg.app (first time)
  │
  ▼
Cloudflare Pages CDN
  ├── Serves index.html + JS + CSS + fonts (COOP/COEP headers from _headers)
  └── Serves /sw.js (Cache-Control: no-cache), /manifest.webmanifest

Browser loads app shell
  │
  ├── main.tsx → probeCaps() → caps.offlineReady = false (no SW controller yet)
  │
  └── App.tsx useEffect → requestIdleCallback
        └── import('@/lib/register-sw') → registerSW({ onOfflineReady, onNeedRefresh })
              └── navigator.serviceWorker.register('/sw.js')
                    │
                    ▼
                  sw.js (compiled from src/sw.ts by vite-plugin-pwa)
                    ├── install: precacheAndRoute(self.__WB_MANIFEST) — app shell only
                    └── activate: clients.claim() → skipWaiting already done at install

User uses AVIF codec (first time)
  │
  Worker imports @jsquash/avif → fetch avif_enc-{hash}.wasm
    └── SW fetch handler intercepts → CacheFirst → CACHE MISS → fetch from network
          └── cache stores avif_enc-{hash}.wasm in 'oimg-codecs-v1'

Second visit (offline)
  │
  ├── SW serves index.html + JS + CSS from precache
  └── AVIF wasm served from 'oimg-codecs-v1' cache

SW update (new deploy)
  │
  New sw.js detected → installing → waiting
    └── onNeedRefresh() fires → sonner toast "New version ready — Reload"
          └── User clicks Reload → updateSW(true) → skipWaiting → clients.claim() → reload
```

### Recommended Project Structure

```
src/
├── sw.ts                    # Hand-rolled service worker (compiled by vite-plugin-pwa)
├── lib/
│   └── register-sw.ts       # SW registration + update/offline-ready callbacks
├── hooks/
│   └── useInstallPrompt.ts  # beforeinstallprompt capture + nanostores atom
└── stores/
    └── pwa.ts               # installPromptAtom + isInstalledAtom (nanostores)

public/
├── manifest.webmanifest     # Static manifest (manifest: false in plugin; hand-authored)
├── oimg-logo.svg            # Existing
├── oimg-logo-1024.png       # Existing
└── oimg-logo-maskable-512.png  # NEW — must be created for PWA-01

```

### Pattern 1: vite.config.ts — VitePWA injectManifest plugin config

**What:** Add `VitePWA()` plugin to the existing plugins array in `vite.config.ts`.

**When to use:** Always in this phase. `manifest: false` because `public/manifest.webmanifest` is hand-authored.

```typescript
// Source: vite-pwa-org.netlify.app/guide/inject-manifest.html + v1.2-pwa.md research
import { VitePWA } from 'vite-plugin-pwa'

// Inside defineConfig({ plugins: [ ... ] })
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'prompt',         // NOT autoUpdate — we show a toast and let user decide
  injectRegister: false,          // manual registration so lazy-load works
  manifest: false,                // hand-authored public/manifest.webmanifest
  devOptions: { enabled: false }, // MUST be false — SW breaks Vite HMR + crossOriginIsolated dev
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    globIgnores: ['**/node_modules/**', '**/*.wasm', '**/codec.worker-*.js'],
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024, // 2 MB ceiling
  },
}),
```

**Vite 7 / Rolldown gotcha:** `virtual:pwa-register` may fail to resolve in Rolldown builds at Vite 7.2.8 (known issue, upstream tracked). If build fails with "failed to resolve import ... virtual:pwa-register", add to vite.config.ts:

```typescript
experimental: {
  enableNativePlugin: 'resolver', // or false — disables Rolldown native plugin for this
},
```

`[ASSUMED]` — this workaround was reported for 7.2.8; may not be needed with the exact version pinned in package.json (`^7.3`). Test at build time.

### Pattern 2: src/sw.ts — Hand-rolled service worker

```typescript
// Source: v1.2-pwa.md research + workbox docs
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// 1) App shell — injected at build time by vite-plugin-pwa
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// 2) Codec WASM — CacheFirst (hashed filenames are content-addressed; safe forever)
registerRoute(
  ({ request }) => request.destination === 'script' || request.url.endsWith('.wasm'),
  new CacheFirst({
    cacheName: 'oimg-codecs-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 }),
    ],
  }),
)

// 3) /squoosh-kit/ static worker assets served from public/
registerRoute(
  ({ url }) => url.pathname.startsWith('/squoosh-kit/'),
  new CacheFirst({ cacheName: 'oimg-squooshkit-v1' }),
)

// 4) Fonts
registerRoute(
  ({ request }) => request.destination === 'font',
  new StaleWhileRevalidate({ cacheName: 'oimg-fonts-v1' }),
)

// 5) SW lifecycle — update flow
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
```

**AVIF safety:** Because `globIgnores: ['**/*.wasm']` excludes all wasm from precache, AVIF's ~8 MB wasm is never precached. It enters `oimg-codecs-v1` only when the user first selects AVIF output.

**TypeScript note:** Add `"webworker"` to `tsconfig.json` `lib` array is NOT needed — the `/// <reference lib="webworker" />` directive handles it locally. The `ServiceWorkerGlobalScope` declaration is required to satisfy TypeScript's type checker in the sw.ts context.

### Pattern 3: src/lib/register-sw.ts — SW registration + update toast

```typescript
// Source: v1.2-pwa.md + vite-pwa-org.netlify.app/guide/inject-manifest.html
import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'
import { setCaps } from '@/stores/runtime'
import { probeCaps } from '@/lib/caps'

export function bootstrapSW(): void {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    onNeedRefresh() {
      // PWA-05: SW update toast — user can defer or reload
      toast('New version available', {
        action: { label: 'Reload', onClick: () => updateSW(true) },
        duration: Infinity,
        id: 'sw-update',
      })
    },
    onOfflineReady() {
      // DIA-03 / PWA-02: update offlineReady cap now that precache is complete
      setCaps({ ...probeCaps(), offlineReady: true })
      toast.success('Ready to work offline', { duration: 3000 })
    },
  })
}
```

App.tsx wires this after first mount via `requestIdleCallback` (keeps register-sw out of initial chunk):

```typescript
// In App.tsx, top-level useEffect
useEffect(() => {
  const id = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback(() => void import('@/lib/register-sw').then(m => m.bootstrapSW()))
    : setTimeout(() => void import('@/lib/register-sw').then(m => m.bootstrapSW()), 2000)
  return () => typeof id === 'number' ? clearTimeout(id) : cancelIdleCallback(id)
}, [])
```

### Pattern 4: useInstallPrompt + StatusBar Install button

```typescript
// src/hooks/useInstallPrompt.ts
// Source: MDN beforeinstallprompt + v1.2-pwa.md
import { useEffect } from 'react'
import { atom } from 'nanostores'
import { useStore } from '@nanostores/react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const $installPrompt = atom<BeforeInstallPromptEvent | null>(null)
export const $isInstalled = atom<boolean>(
  typeof window !== 'undefined' &&
  window.matchMedia?.('(display-mode: standalone)').matches
)

export function useInstallPrompt() {
  const event = useStore($installPrompt)
  const installed = useStore($isInstalled)

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault()
      $installPrompt.set(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      $isInstalled.set(true)
      $installPrompt.set(null)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall(): Promise<boolean> {
    if (!event) return false
    await event.prompt()
    const { outcome } = await event.userChoice
    $installPrompt.set(null)
    return outcome === 'accepted'
  }

  return { canInstall: !!event && !installed, installed, promptInstall }
}
```

StatusBar integration — inline in `StatusBar.tsx` near the offline pip:

```tsx
// In StatusBar.tsx (after existing caps.offlineReady block)
const { canInstall, promptInstall } = useInstallPrompt()

{canInstall && (
  <>
    <span aria-hidden="true">·</span>
    <button
      onClick={() => void promptInstall()}
      className="text-[11px] text-[var(--color-accent)] underline underline-offset-2"
    >
      Install
    </button>
  </>
)}
```

**Convention note:** Per STORE-08, `useInstallPrompt` stores state in nanostores atoms (`$installPrompt`, `$isInstalled`), not `useState`. The hook is a thin bridge between the window event and the atoms.

### Pattern 5: manifest.webmanifest

Static file at `public/manifest.webmanifest` (NOT generated by the plugin; `manifest: false` in config):

```json
{
  "name": "oimg.app — Image Optimizer",
  "short_name": "oimg",
  "description": "Batch-optimize SVG/PNG/WebP/JPEG/AVIF in your browser. Nothing leaves your machine.",
  "id": "/?source=pwa",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone"],
  "theme_color": "#0f1410",
  "background_color": "#0f1410",
  "lang": "en",
  "categories": ["productivity", "utilities"],
  "icons": [
    { "src": "/oimg-logo.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "/oimg-logo-1024.png", "sizes": "1024x1024", "type": "image/png", "purpose": "any" },
    { "src": "/oimg-logo-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**theme_color is `#0f1410` (dark bg), NOT `#5eb87a`.** The `index.html` meta theme-color `#5eb87a` controls browser chrome accent on mobile; the manifest `theme_color` should be the app background per PWA-01's "background_color matching dark theme". Both can be set independently. `index.html` must also add `<link rel="manifest" href="/manifest.webmanifest" />`.

**REQUIREMENT CHECK (PWA-01):** The requirement says `theme_color: #5eb87a`. Research shows this is the accent/green for the browser chrome accent. Both values are valid choices. The planner should use `#5eb87a` for `theme_color` to match PWA-01 verbatim, and `#0f1410` for `background_color`.

### Pattern 6: Cloudflare `_headers` update

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/sw.js
  Cache-Control: max-age=0, must-revalidate

/manifest.webmanifest
  Cache-Control: public, max-age=86400
```

The `/*` block covers all routes including `/sw.js` for COOP/COEP. The per-path `/sw.js` block overrides Cache-Control only. This structure preserves cross-origin isolation for SharedArrayBuffer while ensuring the SW is always fresh.

### Anti-Patterns to Avoid

- **Enabling devOptions:** `devOptions: { enabled: true }` registers a real SW in development and breaks HMR + `crossOriginIsolated` because the dev SW may serve responses without the COOP/COEP headers that the dev server injects. Always `enabled: false`.
- **Precaching codec wasm in globPatterns:** `'**/*.wasm'` in `globPatterns` would pull AVIF's ~8 MB wasm into the precache on first visit. Confirm `globIgnores: ['**/*.wasm']` is present.
- **SW registration in main.tsx synchronously:** Registering before React renders blocks the main thread. Always defer via `requestIdleCallback` or `setTimeout`.
- **Using `registerType: 'autoUpdate'`:** Auto-update skips user consent and can reload mid-encode. Use `registerType: 'prompt'` with a toast.
- **Missing `declare const self: ServiceWorkerGlobalScope`:** Without this, TypeScript resolves `self` as `Window` and errors on SW-specific APIs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Precache manifest generation | Custom Vite plugin that enumerates dist/ | `vite-plugin-pwa` injectManifest | Content hashes, revision tracking, glob exclusion, workbox injection |
| SW update detection | Manual SW version polling | `virtual:pwa-register` `onNeedRefresh` callback | workbox-window handles waiting→active lifecycle correctly |
| Cache expiration for wasm | Manual cache.keys() + date math | `ExpirationPlugin` from workbox-expiration | Edge cases: quota exceeded, entry count, atomic eviction |
| Opaque response caching | Manual status check | `CacheableResponsePlugin({ statuses: [0, 200] })` | Opaque responses (status 0) must be explicitly opt-in; hand-rolled check is error-prone |
| Install prompt state | `useState` in a component | nanostores atom + `useInstallPrompt` hook | Follows STORE-08 convention; atom survives component unmount |

**Key insight:** Workbox's value is handling the edge cases in SW caching that trip up hand-rolled implementations: quota exceeded → graceful fallback, opaque response caching → explicit opt-in, cache versioning → automatic cleanup.

---

## Critical Integration Risk: COOP/COEP + Service Worker

**Risk assessed as: RESOLVED — no action required in SW.**

The flow is:

1. Cloudflare Pages `_headers` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all responses via the `/*` wildcard.
2. The browser evaluates COOP/COEP headers from the server response **before** the document is loaded and before the SW is established on first visit.
3. On subsequent visits, the SW intercepts navigation requests. The SW's `precacheAndRoute` serves `index.html` from the Workbox precache. The precached response was originally fetched **from Cloudflare with the COOP/COEP headers already attached** — those headers travel with the cached response object.
4. Therefore, `crossOriginIsolated` is preserved on cached serving.

**The SW does NOT need to add COOP/COEP headers.** The headers are on the cached `Response` objects stored by Workbox because they were present when originally fetched.

**Caveat:** This only holds if the original network fetch includes the headers (verified: Cloudflare `_headers` applies to `/*`). Do NOT remove the `/*` block from `_headers` or narrow it to skip `/sw.js`.

---

## Critical Integration Risk: Vite 7 + Rolldown + virtual:pwa-register

**Risk assessed as: LOW — has a known workaround.**

`vite-plugin-pwa@1.3.0` explicitly lists `vite: '^7.0.0'` as a supported peer. The known failure mode is Rolldown failing to resolve `virtual:pwa-register/react` in Vite 7.2.x. Since the app uses `virtual:pwa-register` (not the React variant), the risk is lower. If it occurs, the workaround is:

```typescript
// vite.config.ts
experimental: {
  enableNativePlugin: 'resolver',
},
```

Test with `npm run build` immediately after adding VitePWA to the plugins array.

---

## Critical Integration Risk: Module Workers + SW WASM Resolution

**Risk assessed as: RESOLVED by CacheFirst route pattern.**

The codec workers use `worker.format: 'es'` (ES module workers). They dynamically import WASM via `new URL('./avif_enc.wasm', import.meta.url)`. At build time, Vite hashes WASM files to `/assets/avif_enc-{hash}.wasm`. The SW's `CacheFirst` route matches on `request.destination === 'script' || request.url.endsWith('.wasm')`, which catches both JS codec chunks and WASM fetches regardless of hash. The `/squoosh-kit/` route catches the `public/squoosh-kit/` worker assets (which have stable un-hashed paths). No special URL normalization needed.

**Dev mode:** `devOptions: { enabled: false }` means in dev the SW is not registered, codec workers fetch WASM directly from `node_modules/.vite/deps/`, and there is no SW interference.

---

## Common Pitfalls

### Pitfall 1: AVIF wasm enters precache via globPatterns

**What goes wrong:** If `globPatterns` is `['**/*.{js,css,html,svg,woff2,wasm}']` or globIgnores omits `*.wasm`, Workbox tries to precache `avif_enc-{hash}.wasm` (~8 MB unpacked). The `maximumFileSizeToCacheInBytes` ceiling catches it but logs a warning; if the ceiling is raised, the first-visit download spikes to 10+ MB.
**Why it happens:** `globPatterns` eagerly matches build output; wasm files appear in `dist/assets/`.
**How to avoid:** `globIgnores: ['**/*.wasm']` is non-negotiable.
**Warning signs:** Build output logs "skipping large file" or precache manifest includes `.wasm` entries.

### Pitfall 2: SW registered synchronously in main.tsx

**What goes wrong:** SW registration during the main thread render competes with React's first paint. On slow connections it measurably delays TTI.
**Why it happens:** Developers inline `navigator.serviceWorker.register()` at module top-level.
**How to avoid:** `requestIdleCallback` in a `useEffect` in App.tsx; dynamic import of `register-sw.ts`.
**Warning signs:** Lighthouse TTI score decreases after PWA addition.

### Pitfall 3: `registerType: 'autoUpdate'` discards encode-in-progress work

**What goes wrong:** On a new SW deploy, `autoUpdate` calls `skipWaiting` immediately, forcing a page reload. If the user is mid-encode, their queue and results are lost.
**Why it happens:** `autoUpdate` is the default recommendation for most apps but wrong for long-running compute.
**How to avoid:** Use `registerType: 'prompt'` + the toast-with-action pattern (Pattern 3).
**Warning signs:** Users report losing encode results on update.

### Pitfall 4: offlineReady cap never updates

**What goes wrong:** Phase 13 seeded `offlineReady` from `navigator.serviceWorker.controller != null`. After Phase 14, the cap should update to `true` only after `onOfflineReady` fires. If `setCaps` is not called inside `onOfflineReady`, the StatusBar "Offline-ready" pill never appears even though the app IS offline-ready.
**Why it happens:** The Phase 13 placeholder is a one-shot boot-time probe; it doesn't react to async SW events.
**How to avoid:** In `register-sw.ts` `onOfflineReady`, call `setCaps({ ...probeCaps(), offlineReady: true })`. `probeCaps()` at that point will return `true` for `navigator.serviceWorker.controller != null` because the SW is now active.

### Pitfall 5: `manifest.webmanifest` missing from `<head>`

**What goes wrong:** Browser does not find the manifest → install prompt never fires → Lighthouse PWA audit fails → `beforeinstallprompt` never fires.
**Why it happens:** `manifest: false` in plugin config means the plugin does NOT inject the `<link rel="manifest">` tag into `index.html`. It must be added manually.
**How to avoid:** Add `<link rel="manifest" href="/manifest.webmanifest" />` to `index.html` `<head>`.

### Pitfall 6: Maskable icon missing

**What goes wrong:** Chrome Android install prompt shows a poorly-cropped logo with white border artifacts. Lighthouse flags "Icons do not have a maskable icon".
**Why it happens:** `oimg-logo-1024.png` has `"purpose": "any"` but no `"maskable"` icon.
**How to avoid:** Create `oimg-logo-maskable-512.png` — 512×512 with the logo occupying the inner ~80% (safe zone) and a solid `#0f1410` background filling the outer 20%. Add to manifest icons array with `"purpose": "maskable"`.

---

## Code Examples

### TypeScript type for `self.__WB_MANIFEST`

```typescript
// src/types/pwa.d.ts  (or add to existing globals.d.ts)
// Source: [CITED: vite-pwa-org.netlify.app/guide/inject-manifest.html]
declare module 'workbox-precaching' {
  export interface ManifestEntry {
    integrity?: string
    revision: string | null
    url: string
  }
}

// The injected manifest — typed by workbox-precaching exports
// vite-plugin-pwa injects it at build time into this global
declare const __WB_MANIFEST: Array<import('workbox-precaching').ManifestEntry>
```

Actually, vite-plugin-pwa ships its own `client.d.ts` that declares `virtual:pwa-register`. The `__WB_MANIFEST` type comes from `workbox-precaching`'s own types. No manual declaration needed beyond the `declare const self: ServiceWorkerGlobalScope` line in sw.ts.

### virtual:pwa-register type ambient (if needed)

If TypeScript cannot resolve `virtual:pwa-register`, add to `src/vite-env.d.ts` or a new `src/types/pwa.d.ts`:

```typescript
// Source: [CITED: vite-plugin-pwa source types]
declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegistrationError?: (error: unknown) => void
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@squoosh/lib` + custom SW | jSquash + vite-plugin-pwa | 2023 (squoosh archived) | vite-plugin-pwa is the standard for Vite projects |
| workbox-webpack-plugin | vite-plugin-pwa (wraps workbox-build) | 2022+ | Vite-native; no webpack config |
| `generateSW` (magic config) | `injectManifest` (hand-rolled sw.ts) | Always an option; best for complex apps | More control over caching rules |
| Workbox 6 | Workbox 7.4.1 | 2024 | Node 16+ required; no breaking API changes for precache/routing/strategies |

**Deprecated/outdated:**

- `workbox-precaching`'s `precache()` (without route): replaced by `precacheAndRoute()` which both precaches and sets up routing in one call.
- `self.__precacheManifest`: old Workbox 4/5 injection point. Current injection point is `self.__WB_MANIFEST`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rolldown native plugin workaround (`experimental.enableNativePlugin`) resolves virtual:pwa-register build failure in Vite 7.2.x | Integration Risk #2 | Build fails; need to pin to Vite 7.3+ or use `false` instead of `'resolver'` |
| A2 | `oimg-logo-maskable-512.png` does not yet exist and must be created | Standard Stack, Pitfall 6 | If it exists, Wave 0 asset creation task is unnecessary |
| A3 | `theme_color` in manifest.webmanifest should be `#5eb87a` per PWA-01 verbatim (not `#0f1410`) | Pattern 5 | Minor: affects browser chrome accent color on mobile, not functionality |
| A4 | slopcheck was unavailable; all workbox-* packages assumed legitimate based on Google Chrome team provenance | Package Legitimacy Audit | Negligible: these are among the most downloaded packages on npm |

---

## Open Questions

1. **Does `oimg-logo-maskable-512.png` need to be machine-generated or manually created?**
   - What we know: The file does not exist in `public/`. vite-plugin-pwa's assets-generator can derive it from the SVG.
   - What's unclear: Whether the design satisfies safe-zone padding requirements.
   - Recommendation: Wave 0 task generates it via `@vite-pwa/assets-generator` and commits the result. Manual review before final commit.

2. **Should `$installPrompt` / `$isInstalled` atoms live in `src/stores/pwa.ts` (new file) or inside the hook?**
   - What we know: STORE-08 says zero `useState` for data; atoms go in stores. The hook is in `src/hooks/`.
   - What's unclear: The team hasn't established a pattern for atoms used by only one hook.
   - Recommendation: Define atoms in `src/stores/pwa.ts` (follow nanostores convention); import in the hook. Follows the `watchedFolderAtom` precedent in `runtime.ts` — small atoms co-located with runtime state.

3. **Should `virtual:pwa-register` registration happen in App.tsx or a new layout-level component?**
   - What we know: `App.tsx` is the entry React component; it already has `useEffect` hooks.
   - Recommendation: Add directly to `App.tsx` to minimize file count, consistent with Phase 13's `setCaps(probeCaps())` in main.tsx.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vite-plugin-pwa build | ✓ | via project | — |
| npm | package install | ✓ | via project | — |
| Chromium (Playwright) | PWA e2e tests | ✓ | via `@playwright/test` | — |
| Lighthouse CLI | PWA audit | [ASSUMED] not probed | — | `npx lighthouse` one-time manual check |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test src/tests/pwa.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PWA-01 | manifest.webmanifest has correct name/icons/theme_color | unit (node) | `node --experimental-strip-types src/tests/manifest.test.ts` | ❌ Wave 0 |
| PWA-02 | SW precaches app shell; wasm NOT in precache; CacheFirst fires on wasm fetch | e2e (Playwright + SW interception) | `npx playwright test src/tests/pwa.spec.ts` | ❌ Wave 0 |
| PWA-03 | Install button renders when `beforeinstallprompt` fires; hidden when not | e2e (Playwright addInitScript) | `npx playwright test src/tests/pwa.spec.ts` | ❌ Wave 0 |
| PWA-04 | `/sw.js` served with `no-cache`; `/manifest.webmanifest` served with `max-age=86400` | manual/smoke (curl against preview) | manual | — |
| PWA-05 | Toast appears when SW updates | e2e (SW message injection) | `npx playwright test src/tests/pwa.spec.ts` | ❌ Wave 0 |

**Playwright service worker testing note:** Playwright 1.59 supports `page.waitForEvent('serviceworker')` and `context.serviceWorkers()`. For offline testing, use `page.context().setOffline(true)`. For `beforeinstallprompt` simulation, use `page.addInitScript()` to fire a synthetic event.

### Sampling Rate

- **Per task commit:** `npx playwright test src/tests/foundation.spec.ts` (smoke — confirms app still loads)
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green + manual Lighthouse PWA audit (score ≥ 80) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/tests/pwa.spec.ts` — covers PWA-02 (offline load), PWA-03 (install button), PWA-05 (update toast)
- [ ] `src/tests/manifest.test.ts` — covers PWA-01 (node test: JSON parse + field assertions)
- [ ] `public/oimg-logo-maskable-512.png` — required asset; must exist before the manifest is valid
- [ ] `src/types/pwa.d.ts` — `virtual:pwa-register` ambient type (if not shipped by vite-plugin-pwa)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | SW only caches app-own responses |
| V6 Cryptography | no | — |

**PWA-specific security notes:**
- SW must be served from the same origin. Cloudflare Pages serves from root. No cross-origin SW risk.
- `injectManifest` injects a content-hash manifest — integrity protected. No extra CSP changes needed.
- COOP/COEP headers must not be weakened. The `_headers` pattern in Pattern 6 preserves them at the `/*` level.

---

## Sources

### Primary (HIGH confidence)

- `npm view vite-plugin-pwa version` — 1.3.0, confirmed current [VERIFIED: npm registry]
- `npm view workbox-window version` — 7.4.1, published 2026-05-04 [VERIFIED: npm registry]
- `npm view workbox-precaching version` — 7.4.1 [VERIFIED: npm registry]
- `npm view vite-plugin-pwa peerDependencies` — confirms vite `^7.0.0` supported [VERIFIED: npm registry]
- `.planning/research/v1.2-pwa.md` — prior research with HIGH confidence, verified npm versions at time of writing

### Secondary (MEDIUM confidence)

- [vite-pwa-org.netlify.app/guide/inject-manifest.html](https://vite-pwa-org.netlify.app/guide/inject-manifest.html) — injectManifest configuration
- [vite-pwa-org.netlify.app/workbox/inject-manifest.html](https://vite-pwa-org.netlify.app/workbox/inject-manifest.html) — Workbox integration docs
- [developer.chrome.com/docs/workbox/modules/workbox-window](https://developer.chrome.com/docs/workbox/modules/workbox-window) — workbox-window lifecycle events
- [web.dev/articles/coop-coep](https://web.dev/articles/coop-coep) — COOP/COEP and SW interaction
- GitHub issue vitejs/rolldown-vite #526 — Vite 7.2.8 virtual:pwa-register resolution failure

### Tertiary (LOW confidence)

- Rolldown `experimental.enableNativePlugin` workaround — reported in community discussions; not verified against exact Vite 7.3.x used in this project

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — npm registry confirmed all versions
- Architecture: HIGH — based on vite-pwa official docs + prior research + codebase analysis
- Pitfalls: HIGH — derived from actual codebase constraints (AVIF size, STORE-08, COOP/COEP)
- Vite 7 Rolldown risk: MEDIUM — confirmed issue exists, workaround reported but not personally tested

**Research date:** 2026-06-11
**Valid until:** 2026-08-11 (stable domain; Workbox 7 is current; vite-plugin-pwa 1.3.0 is latest)
