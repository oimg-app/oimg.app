# ROADMAP: oimg.app

## Milestones

- ✅ **v1.0 — UI Port** — Phases 1–7 (shipped 2026-05-25) — full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Real Optimization Pipeline** — Phases 8–12 + quick task 260603-s2x (shipped 2026-06-03) — full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 — Polish, Diagnostics, PWA + Quality Metrics** — Phases 13–17 (active) — installable PWA, real SSIM + Butteraugli metrics, real diagnostic values, URL/paste ingest, queue hygiene

## Phases

<details>
<summary>✅ v1.0 UI Port (Phases 1–7) — SHIPPED 2026-05-25 (Executed)</summary>

- [x] Phase 1: Foundation (5/5 plans)
- [x] Phase 2: Files Pane (2/2 plans)
- [x] Phase 3: Navigation Shell (3/3 plans)
- [x] Phase 4: Inspector — Codec + SVGO (4/4 plans)
- [x] Phase 5: Center Pane (2/2 plans)
- [x] Phase 6: Inspector — Output + Report (3/3 plans)
- [x] Phase 7: Polish (3/3 plans)

Shipped as **Executed** — all 22 plans built + summarized; formal phase verification skipped (see `MILESTONES.md` → Known Gaps and `STATE.md` → Deferred Items). Full phase detail, success criteria, and requirements map preserved in the archive.

</details>

<details>
<summary>✅ v1.1 Real Optimization Pipeline (Phases 8–12) — SHIPPED 2026-06-03 (audit: tech_debt)</summary>

- [x] Phase 8: Worker Pipeline Foundation (3/3 plans) — PIPE-01..04
- [x] Phase 9: Codec Encoders (4/4 plans) — ENC-01..06
- [x] Phase 10: Single-File Optimize Loop (4/4 plans) — OPT-01
- [x] Phase 11: Batch Optimize + Export (9/9 plans) — OPT-02, EXP-01, EXP-02
- [x] Phase 12: Real Snippets (5/5 plans) — SNIP-01
- [x] Quick task 260603-s2x: Watch folder (showDirectoryPicker + FileSystemObserver)

15/15 requirements satisfied. Bundle 194.88 KB gzipped (under 200 KB PIPE-02 budget). 4 Phase 12 paste-into-real-browser dogfood checks deferred to follow-up (see `milestones/v1.1-ROADMAP.md` and `v1.1-MILESTONE-AUDIT.md`).

</details>

### 🚧 v1.2 Polish, Diagnostics, PWA + Quality Metrics (Phases 13–17)

- [x] **Phase 13: Diagnostics + Clear Queue** — versionsAtom + capability detection + live StatusBar footer + Settings Diagnostics tab + clearFiles() action — DIA-01..04, CLR-01
- [ ] **Phase 14: Installable PWA** — vite-plugin-pwa (injectManifest) + hand-rolled sw.ts + manifest.webmanifest + beforeinstallprompt + offline-derived footer — PWA-01..05
- [ ] **Phase 15: From URL or paste** — clipboard read + paste-event handler + addFromUrl wire-up + CORS-honest failure messaging — ING-01, ING-02
- [ ] **Phase 16: SSIM Quality Metric** — ssim.js@3.5.0 integration + metrics worker hook + Report panel banded display — MTR-01, MTR-03 (SSIM half)
- [ ] **Phase 17: Butteraugli Quality Metric** — hand-built Emscripten wasm of libjxl butteraugli + Report panel integration alongside SSIM — MTR-02, MTR-03 (Butteraugli half)

## Phase Details

### Phase 13: Diagnostics + Clear Queue

**Goal**: Replace hardcoded version badges and "Offline-ready" stub text with live diagnostic values. Add Settings Diagnostics tab. Land `clearFiles()` action with Toolbar + FilesPane affordances.
**Depends on**: Phase 12 (v1.1)
**Requirements**: DIA-01, DIA-02, DIA-03, DIA-04, CLR-01
**Success Criteria** (what must be TRUE):

  1. `versionsAtom` is populated at build time via Vite `define` and contains live svgo + per-codec jSquash versions + ssim.js version (Butteraugli build hash added in Phase 17)
  2. App boot detects SIMD, threads, `crossOriginIsolated`, and `hardwareConcurrency` and caches them in the atom under `caps`
  3. StatusBar's previously-hardcoded version badge text reads live from the atom; the footer "Offline-ready" segment renders only when SW is registered AND precache is complete (placeholder until Phase 14 — for now derives from `'serviceWorker' in navigator && navigator.serviceWorker.controller != null`)
  4. Settings popover gains a "Diagnostics" tab rendering the full versions + caps surface with a copy-to-clipboard button routed through the Phase 12 `copyToClipboard` chokepoint
  5. `clearFiles()` action exists in `src/stores/files.ts`; Toolbar overflow menu item + FilesPane header X icon both call it; both disable-then-explain when queue is empty (Phase 11 D-13 pattern)

**Plans**: 8 plans

Plans:
**Wave 1**

- [x] 13-00-PLAN.md — Wave 0: ambient `src/types/globals.d.ts` declarations for Vite `define` globals (DIA-01)
- [x] 13-01-PLAN.md — Wave 1: vite.config.ts `define` injection + `src/lib/versions.ts` typed wrapper + Node unit (DIA-01)
- [x] 13-02-PLAN.md — Wave 1: `src/lib/caps.ts` runtime capability probe + Node unit (DIA-02)
- [x] 13-03-PLAN.md — Wave 1: runtimeAtom reshape (drop legacy strings, add versions+caps) + main.tsx pre-render probe + StatusBar wiring + e2e (DIA-01/DIA-02/DIA-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-04-PLAN.md — Wave 2: `clearFiles()` action + `$queueEmpty` computed atom in `src/stores/files.ts` + Node unit (CLR-01)
- [x] 13-05-PLAN.md — Wave 2: Toolbar Settings popover Clear all button + T-13-03 warning toast + Playwright e2e (CLR-01)
- [x] 13-06-PLAN.md — Wave 2: FilesPane header XCircle icon + T-13-03 warning toast + Playwright e2e (CLR-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-07-PLAN.md — Wave 3: Settings popover Radix Tabs (General + Diagnostics) + Copy diagnostics via Phase 12 chokepoint + e2e (DIA-04)

**UI hint**: yes

### Phase 14: Installable PWA

**Goal**: Make oimg.app installable as a desktop/mobile PWA with full offline functionality on second visit. Codec wasms cached on first use, not first load.
**Depends on**: Phase 13 (uses `versionsAtom` for "Updated to vX" toast on SW upgrade)
**Requirements**: PWA-01, PWA-02, PWA-03, PWA-04, PWA-05
**Success Criteria** (what must be TRUE):

  1. `manifest.webmanifest` is emitted via `vite-plugin-pwa@1.3.0` (injectManifest mode) with the documented schema (name, short_name, icons referencing `/oimg-logo.svg` + `/oimg-logo-1024.png` + new `/oimg-logo-maskable-512.png`, theme_color `#5eb87a`, background_color matching dark theme, display "standalone", start_url "/")
  2. Hand-rolled `src/sw.ts` precaches the app shell (index.html, JS, CSS, SVG logo) and runtime-caches codec wasm files via Workbox `CacheFirst` — AVIF's 3.4 MB wasm does NOT enter the precache; verified by Lighthouse PWA audit
  3. `beforeinstallprompt` is deferred and the StatusBar surfaces an "Install" button near the offline pip; click invokes the deferred prompt; install success hides the button
  4. Cloudflare Pages `_headers` updated with `/sw.js: Cache-Control: no-cache` and `/manifest.webmanifest: Cache-Control: public, max-age=86400`, with existing COOP/COEP preserved
  5. SW handles its own version-bump skipWaiting + clientsClaim and surfaces "New version available — reload?" toast when a new SW takes over
  6. Phase 13's "Offline-ready" footer derivation now sees a real SW + precache state and shows green when offline-functional

**Plans**: TBD
**UI hint**: yes

### Phase 15: From URL or paste

**Goal**: Wire the Toolbar "From URL or paste" menu item to a real clipboard-paste + URL-fetch dispatcher, with document-level paste-event support and honest CORS-failure messaging.
**Depends on**: Phase 12 (uses `copyToClipboard` chokepoint pattern; reuses sonner Toaster)
**Requirements**: ING-01, ING-02
**Success Criteria** (what must be TRUE):

  1. Toolbar "From URL or paste" reads `navigator.clipboard.read()` (with paste-event fallback in non-secure contexts) — image bytes go to `useIngest.ingest()`; toast "Pasted from clipboard: {name}"
  2. Plain-text image URL in clipboard → direct `fetch(url)`; on success ingest, toast "Imported from URL: {host}"; on CORS failure toast "URL blocked by CORS — download and drop the file, or paste it directly."
  3. Non-image clipboard contents → toast "Clipboard has no image or image URL" (no error log)
  4. Document-level Cmd/Ctrl+V handler on `<App />` ingests any pasted image through the same dispatcher
  5. The empty `addFromUrl` stub in `src/stores/files.ts` is deleted (Phase 11/12/quick-task retirement precedent)

**Plans**: TBD
**UI hint**: yes

### Phase 16: SSIM Quality Metric

**Goal**: Land real perceptual quality measurement using SSIM via `ssim.js@3.5.0`. Computed for the selected file post-`done` in a lazy-loaded chunk. Banded green/yellow/red display in Report panel.
**Depends on**: Phase 13 (uses `versionsAtom` for `ssim.js` version surfacing)
**Requirements**: MTR-01, MTR-03 (SSIM half)
**Success Criteria** (what must be TRUE):

  1. `ssim.js@3.5.0` installed and integrated; runs in the codec worker (or sibling metrics worker)
  2. SSIM auto-computes for the currently-selected file when its `status === 'done'`; result cached on `FileEntry.metrics.ssim`; refreshes on re-encode via Phase 9 `useLiveEncode` trigger
  3. Lazy-loaded via dynamic import — does NOT enter the initial JS chunk; bundle budget remains ≤ 200 KB gzipped initial
  4. Report panel renders the SSIM score with banded coloring: green ≥ 0.95, yellow ≥ 0.85, red < 0.85; thresholds are documented constants

**Plans**: TBD
**UI hint**: yes

### Phase 17: Butteraugli Quality Metric

**Goal**: Land real perceptual quality measurement using a hand-built wasm Butteraugli comparator (from Google libjxl). Lazy-loaded; runs alongside SSIM in the metrics worker.
**Depends on**: Phase 16 (extends the Phase 16 metrics-worker integration + Report panel banded-display pattern)
**Requirements**: MTR-02, MTR-03 (Butteraugli half)
**Success Criteria** (what must be TRUE):

  1. Butteraugli is compiled via Emscripten from Google libjxl's butteraugli comparator into `public/squoosh-kit/butteraugli/butteraugli.wasm` + a thin JS wrapper; build documented in a top-level script
  2. The wasm is loaded via dynamic import in the metrics worker; same trigger rules as SSIM (selected file, post-`done`, refresh on re-encode); result cached on `FileEntry.metrics.butteraugli`
  3. Report panel renders the Butteraugli score alongside SSIM with banded coloring: green < 1.5, yellow < 3.0, red ≥ 3.0 (lower is better); thresholds are documented constants
  4. Initial bundle budget (200 KB gzipped) is preserved — Butteraugli wasm does NOT enter the initial chunk; verified at build time
  5. `versionsAtom.butteraugli.buildHash` reflects the wasm artifact hash (so the Diagnostics tab can show which build is loaded)

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 13. Diagnostics + Clear Queue | v1.2 | 7/8 | In Progress|  |
| 14. Installable PWA | v1.2 | 0/? | Not started | - |
| 15. From URL or paste | v1.2 | 0/? | Not started | - |
| 16. SSIM Quality Metric | v1.2 | 0/? | Not started | - |
| 17. Butteraugli Quality Metric | v1.2 | 0/? | Not started | - |

---

*Active milestone: v1.2 — Real-quality + transparency + installable. Next: `/gsd:plan-phase 13`.*
*Last archived: 2026-06-05 via /gsd:complete-milestone v1.1*
