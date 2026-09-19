# PWA Spec

## Purpose
Make oimg.app installable as a desktop/mobile PWA and fully offline-capable on the second visit. The install prompt is surfaced in the StatusBar on Chromium browsers; on Firefox and Safari, offline still works but the prompt is not shown (those browsers do not fire `beforeinstallprompt`).

## Requirements

### Requirement: Web app manifest
The system SHALL ship a hand-authored `manifest.webmanifest` at `public/manifest.webmanifest`. `vite-plugin-pwa@^1.3.0` runs in `injectManifest` mode with `manifest: false`, so the plugin compiles `src/sw.ts` but does NOT generate the manifest. The manifest SHALL declare: `name` "oimg.app — All-in-One Image Optimizer", `short_name` "oimg", `display: standalone`, `start_url`/`id` `/?source=pwa`, dark `background_color` matching the dark theme, brand `theme_color`, and icons — an SVG (`/oimg-logo.svg`), a 1024-px PNG, and a 512-px maskable PNG.

#### Scenario: Install prompt receives valid manifest
- **WHEN** a Chromium browser evaluates PWA install eligibility
- **THEN** the manifest passes: standalone display, required icon sizes present, valid start URL, maskable icon available

### Requirement: Hand-rolled service worker
The system SHALL ship `src/sw.ts` built through `injectManifest` with Workbox primitives (`workbox-precaching`, `workbox-routing`, `workbox-strategies`). The SW SHALL precache the app shell (index.html, initial JS, CSS, SVG logo, fonts) and runtime-cache codec WASMs via `CacheFirst`, keyed on URL.

#### Scenario: First visit — nothing cached
- **WHEN** a fresh user loads the app
- **THEN** the SW installs, precaches the app shell, and does NOT precache the AVIF ~3.4 MB WASM

#### Scenario: Second visit — offline
- **WHEN** the same user returns offline
- **THEN** the app shell loads from cache and all previously-used codecs are available

#### Scenario: First AVIF encode ever
- **WHEN** the user picks AVIF for the first time
- **THEN** the AVIF WASM is fetched, cached by the runtime CacheFirst rule, and served from cache on every subsequent AVIF encode

### Requirement: `beforeinstallprompt` capture
The system SHALL capture the `beforeinstallprompt` event in a `useInstallPrompt` hook and store the deferred prompt in a PWA store atom. The StatusBar SHALL surface a small "Install" button near the offline pip when a prompt is available; clicking it invokes the deferred prompt.

#### Scenario: Chrome / Edge
- **WHEN** the browser fires `beforeinstallprompt`
- **THEN** the Install button appears; a successful install hides the button

#### Scenario: Firefox / Safari
- **WHEN** the browser never fires `beforeinstallprompt`
- **THEN** the Install button never appears; offline-on-second-visit still works because the SW + manifest are independent of the prompt

### Requirement: Cloudflare Pages headers
The system SHALL configure `public/_headers` so `sw.js` is served with `Cache-Control: no-cache` and `manifest.webmanifest` with `Cache-Control: public, max-age=86400`. The existing COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) MUST be preserved so `crossOriginIsolated === true` for the codec worker's multithreaded WASMs.

### Requirement: SW version-bump flow
The system SHALL let the SW `skipWaiting` and `clientsClaim` itself so users receive the new bundle without a manual refresh. When a new SW takes over, a toast SHALL surface "New version available — reload?".

#### Scenario: Deployment lands while a user is idle in the tab
- **WHEN** a new SW installs and activates
- **THEN** the update toast appears; the user reloads and the new app shell is served

### Requirement: Registration is idle-scheduled
The system SHALL register the SW from `App.tsx` on an idle callback (via `src/lib/register-sw.ts`) so registration does not compete with first paint.

## Non-goals

- Precaching codec WASMs at first visit (AVIF's ~3.4 MB blob would blow the first-visit budget; caching is opportunistic).
- Firefox and Safari install prompts (upstream API is not available).
- Web Share Target API ("Share to oimg.app" from Photos/Files apps) — deferred to v1.3 as PWA-NEXT.
- App-badge / periodic-sync / push (no server, no notifications).
- iOS home-screen install automation (Safari iOS requires a user-driven "Add to Home Screen" flow; the manifest supports it but the app does not attempt to prompt).
- Update-download progress UI beyond the toast.
