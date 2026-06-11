// Phase 14 Plan 02 — PWA-02 + PWA-05
// Hand-rolled service worker built by vite-plugin-pwa in injectManifest mode.
// Compiled to dist/sw.js at build time; __WB_MANIFEST is injected by the
// plugin (see vite.config.ts → VitePWA injectManifest).
//
// Strategy summary (14-RESEARCH.md §Pattern 2):
//   1. Precache the app shell (HTML/JS/CSS/SVG/woff2) only — wasm is excluded
//      via globIgnores in vite.config.ts (T-14-WASM mitigation; AVIF's ~3.4 MB
//      wasm must never sit in precache).
//   2. CacheFirst for scripts + .wasm — content-addressed hashed filenames
//      make CacheFirst safe forever. AVIF's wasm enters the cache only on
//      first AVIF use (T-14-AVIF mitigation).
//   3. CacheFirst for /squoosh-kit/ static worker assets served from public/.
//   4. StaleWhileRevalidate for fonts.
//   5. install → skipWaiting; activate → clients.claim — pairs with PWA-05's
//      registerSW({ onNeedRefresh }) update flow in Plan 14-04.
//
// CRITICAL — T-14-COEP mitigation: this SW does NOT modify or inject COOP/COEP
// headers in any route handler. Cached Response objects already carry the
// headers from the original network response (Cloudflare _headers); the SW
// must preserve them so crossOriginIsolated remains true post-takeover and
// SharedArrayBuffer-backed jSquash MT codecs keep working offline.
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// TypeScript: in the SW context `self` is ServiceWorkerGlobalScope (not
// Window). Without this declaration tsc resolves self as Window and errors
// on self.__WB_MANIFEST / self.skipWaiting / self.clients.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// 1) App shell — manifest injected at build time by vite-plugin-pwa.
//    cleanupOutdatedCaches evicts precache entries from prior SW versions on
//    activate (T-14-POISON mitigation: stale-content protection).
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// 2) Codec WASM + script chunks — CacheFirst.
//    Hashed filenames are content-addressed, so CacheFirst is safe; a content
//    change produces a new URL. statuses:[0,200] permits opaque cross-origin
//    responses (status 0) AND normal 200s. ExpirationPlugin caps at 30 entries
//    / 90 days to prevent unbounded cache growth across long-lived installs.
registerRoute(
  ({ request, url }) =>
    request.destination === 'script' || url.pathname.endsWith('.wasm'),
  new CacheFirst({
    cacheName: 'oimg-codecs-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 90,
      }),
    ],
  }),
)

// 3) /squoosh-kit/ static worker assets served from public/.
registerRoute(
  ({ url }) => url.pathname.startsWith('/squoosh-kit/'),
  new CacheFirst({ cacheName: 'oimg-squooshkit-v1' }),
)

// 4) Fonts — StaleWhileRevalidate (Inter, JetBrains Mono if present).
registerRoute(
  ({ request }) => request.destination === 'font',
  new StaleWhileRevalidate({ cacheName: 'oimg-fonts-v1' }),
)

// 5) PWA-05: SW lifecycle update flow.
//    install → skipWaiting: new SW activates immediately (no "waiting" state).
//    activate → clients.claim: this SW takes control of open pages without
//    requiring a reload — pairs with onNeedRefresh toast in Plan 14-04.
self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
