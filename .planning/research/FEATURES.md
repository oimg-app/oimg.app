# Feature Research — oimg.app

**Domain:** Browser-based batch image optimizer with developer-snippet output
**Researched:** 2026-04-29
**Confidence:** HIGH (scope is locked by PROJECT.md; references Squoosh, SVGOMG, url-encoder, jSquash)

## Executive Summary

oimg.app sits at the intersection of three reference tools (Squoosh, SVGOMG, url-encoder) but none of them solve the **frontend developer's full pipeline**: drop a folder of source assets → configure once → walk away with optimized files **plus paste-ready markup snippets**. The unified workflow IS the moat. Table stakes are well-trodden (codecs, presets, before/after, ZIP, drag-and-drop). The differentiators all live in the snippet-generation layer and the **mixed-density batch model** — features that no single competitor ships.

A ruthless MVP is: SVG + PNG + WebP optimization, mixed 1x/2x/3x source-density model, ZIP export, four snippet types (`<picture>`+srcset, `<img srcset>`, CSS `background-image` data URI, inline `<svg>`), Squoosh-style accordion settings, IndexedDB-persisted named presets, and zero outbound requests. Everything else is cuttable.

---

## Feature Landscape

### Table Stakes (Users Leave If Missing)

Features any 2026 image-optimization tool must ship, evidenced by Squoosh + SVGOMG + ImageOptim + jSquash demos all sharing them. Missing any of these = "amateur tool, going back to Squoosh."

| # | Feature | Why Expected | Complexity | User-Story Mapping | Confidence |
|---|---------|--------------|------------|--------------------|--------|
| TS-1 | **Drag-and-drop + multi-file picker** | Universal in every reference tool | S | Core — "drops a folder" | HIGH |
| TS-2 | **Format support: SVG, PNG, JPEG, WebP, AVIF** | The 5 formats devs actually ship in 2026; missing AVIF reads as outdated | M (codecs already chosen: SVGO + jSquash) | Core | HIGH |
| TS-3 | **Quality slider + lossless toggle per raster codec** | Squoosh standard; expected affordance | S | Core — "configures settings once" | HIGH |
| TS-4 | **SVGO plugin toggle list with preset-default baseline** | SVGOMG's exact UX; SVG devs expect per-plugin control | M | Core for SVG users | HIGH |
| TS-5 | **Before/after byte size + percent delta** | Universal; the user's reason for using the tool | S | Core — proves value | HIGH |
| TS-6 | **Side-by-side / split-slider preview (per-file detail view)** | Squoosh's signature UX; lets devs verify "lossy is OK here" | M | Core — quality assurance loop | HIGH |
| TS-7 | **Thumbnail in file list** | Required to keep a 30-file batch sane | S | Core — batch UX | HIGH |
| TS-8 | **Per-file progress + overall progress** | WASM is slow enough that no progress = "is it stuck?" | S | Core — batch UX | HIGH |
| TS-9 | **Single-file download AND ZIP-all download** | Both modes appear in every batch tool; either alone is friction | S (jszip) | Core — "downloads results" | HIGH |
| TS-10 | **Settings persistence (last-used + named presets)** | Devs run the same job repeatedly; re-clicking 12 toggles every session = abandoned | M (IndexedDB) | Core — "configures once" | HIGH |
| TS-11 | **Dark + light theme** | 2026 baseline; dark default for dev tools | S | General | HIGH |
| TS-12 | **Keyboard navigation + ARIA + WCAG AA** | Accessibility is table-stakes in 2026 dev tools, not optional | M | General | HIGH |
| TS-13 | **Graceful per-file error handling (one bad file ≠ whole batch fails)** | Users will drop weird inputs (corrupt PNGs, SVG with `<script>`, 50MB files); per-file isolation is mandatory | M | Core — batch resilience | HIGH |
| TS-14 | **Resize on export (width/height + algorithm)** | Squoosh has Lanczos/Catrom/Mitchell/Triangle; assumed | M | Core — variant generation depends on resize | HIGH |
| TS-15 | **Metadata stripping (EXIF/XMP/IPTC) with ICC-keep toggle** | Squoosh ships it; SEO/perf devs assume it | S–M | General | HIGH |
| TS-16 | **Original file untouched in browser** | "I don't want this tool overwriting my source" — critical implicit expectation | S (architecture) | General — trust | HIGH |
| TS-17 | **Drag-to-reorder file list / remove individual files** | Batch UX hygiene; SVGOMG and ImageOptim both support it | S | Core — batch UX | MEDIUM |
| TS-18 | **Copy-to-clipboard with ack feedback** | Every snippet/data-URI tool has it; the visual "copied!" confirmation is half the UX | S | Core — snippet flow | HIGH |

### Differentiators (The Moat)

Features no single reference tool ships together. **All of these are P1 for v1** because they ARE the reason oimg.app exists. Squoosh has snippets but no batch. SVGOMG has SVG only. url-encoder has data URI only. None do mixed-density variant generation.

| # | Feature | Value Proposition | Complexity | User-Story Mapping | Confidence |
|---|---------|-------------------|------------|--------------------|--------|
| D-1 | **Mixed 1x/2x/3x source-density per file** (user marks each file's source density; app generates the missing variants by up/down-scaling) | Real folders contain mixed-density sources (logo@1x.svg next to hero@2x.png next to icon@3x.png). No reference tool models this. Solves the "which one is the source?" problem. | M (resize pipeline + density tag in file model) | **Core differentiator** — locked in PROJECT.md | HIGH |
| D-2 | **`<picture>` + srcset snippet generation reflecting actual outputs** (e.g., `<source type="image/avif">` + `<source type="image/webp">` + `<img>` PNG fallback, with `srcset="… 1x, … 2x, … 3x"`) | The "I just spent 10 minutes generating files; now I have to hand-write the markup" gap nobody fills | M (template + filename ↔ snippet sync) | **Core differentiator** | HIGH |
| D-3 | **`<img srcset>` snippet (without `<picture>`)** for the simpler case where format negotiation isn't needed | Devs frequently want the lighter form; offering both shows we understand the workflow | S (subset of D-2) | **Core differentiator** | HIGH |
| D-4 | **CSS `background-image` data URI snippet** with URL-encoding for SVG and Base64 for raster, plus a **size warning at >32KB** (or >4KB for inline-critical-CSS use) | Closes the url-encoder gap *and* warns devs when they're about to embed something that bloats their stylesheet | S (encoding) + S (heuristic) | **Core differentiator** | HIGH |
| D-5 | **Inline `<svg>` snippet (raw markup, post-SVGO)** | The optimized SVG, ready to paste into JSX or an HTML template — no "decode this base64" step | S (just the optimized SVG string) | **Core differentiator** | HIGH |
| D-6 | **Per-file snippet customization via checkboxes** (each file: "include `<picture>`?", "include data URI?", "include inline SVG?") with the snippet panel reacting in realtime | One file might need `<picture>`, another just data URI; the checkbox model lets devs cherry-pick | M | **Core differentiator** | HIGH |
| D-7 | **Global vs per-file settings model** (configure once, override per-file when needed) | Without it, batch-of-30 means 30 trips through every panel. Override-when-needed is the only ergonomic answer. | M (settings inheritance + override-detection UI) | **Core differentiator** | HIGH |
| D-8 | **ZIP export with structured filenames** (`logo@1x.webp`, `logo@2x.webp`, `logo@3x.webp`, `logo.png` fallback, `hero@2x.avif`) | Filenames must be predictable so generated `<picture>` snippets work without manual editing — they're a cohesive system, not two separate features | S (templating after pipeline runs) | **Core differentiator** — depends on D-2/D-3 | HIGH |
| D-9 | **Snippet ↔ filename ↔ density triple sync** (changing density updates filename and srcset; changing format updates snippet `type=` and filename extension) | The thing that makes the four snippet types feel like one coherent system instead of four widgets | M (single source of truth in state) | **Core differentiator** | HIGH |
| D-10 | **Zero outbound requests after WASM bundle load** (verifiable in Network tab; messaged on the landing page) | Privacy IS a marketing claim vs Squoosh's GA; "nothing leaves your browser" written on the homepage | S (architecture; just don't add fetches) | **Brand differentiator** | HIGH |
| D-11 | **Lazy codec loading** (don't ship AVIF/MozJPEG WASM if user only uses SVG+PNG) | First-paint ≤200KB JS as in PROJECT.md constraints; perceptible vs Squoosh's heavy initial load | M (Vite dynamic imports per codec) | General — performance | HIGH |
| D-12 | **Web Worker pool for codec runs (non-blocking UI)** | Squoosh has it; matching it is competitive baseline. Marked differentiator vs simpler tools that block the main thread. | M | General — performance | HIGH |
| D-13 | **File list view as default, click-to-detail-view** (not 4 tabs, not Squoosh's single-file mode) | Architectural — the layout itself encodes "this is a batch tool" while Squoosh encodes "this is a single-image tool" | M (routing + state) | **Core differentiator** — locked in PROJECT.md | HIGH |
| D-14 | **Aggressive SVGO mode with butteraugli-style fidelity warning when distortion >10%** (per ARCH.md §2.2.2) | Power-SVG-users want one toggle for "go further but warn me"; uniquely valuable for icon/logo work | M (extra SVGO plugins + visual diff metric) | Power user — v1 nice-to-have | MEDIUM |

### Power-User / Nice-to-Have (Cuttable for v1)

Real value for the dev audience but cuttable without breaking the user story. All are clearly v1.x or v2 candidates.

| # | Feature | Value | Complexity | Why Defer |
|---|---------|-------|------------|-----------|
| PU-1 | **Aggregated multi-file CSS export** (one `.css` file with all background-image data URIs as `--asset-name: url(...)` custom properties) | Bulk-paste convenience for design-system folders | M | Already deferred in PROJECT.md; per-file copy works for v1 |
| PU-2 | **SVG sprite generation** (combine multiple SVGs into one `<symbol>`-based sprite) | Icon-system devs love this; complements the per-file snippet model | M–L | Adds a whole new output mode + sprite-symbol-id UX; v1 punts |
| PU-3 | **Configuration export/import (`.svgorc`, `oimg.config.json`)** | Lets devs check a config into a repo for reproducible runs | S–M | Solves a real CI use case but the named-preset feature already covers session-to-session continuity |
| PU-4 | **File-size budget checks** ("warn if any output > 50KB" / "fail if total > 200KB") | Useful for perf-budget-conscious teams | S | Niche; can be added once budgets are validated as a real ask |
| PU-5 | **Subresource Integrity (SRI) hash output** (sha256/sha384 alongside snippets) | Security-minded teams who serve assets cross-origin | S | Niche — fewer than 5% of dev workflows |
| PU-6 | **Drop folders (preserve directory structure in ZIP output)** | Power users with `assets/icons/`, `assets/hero/` directory layouts | M (FileSystem Access API + relative path tracking) | Browser support uneven; flat ZIP is fine for MVP |
| PU-7 | **Comparison side-by-side mode for multiple codec settings** (Squoosh-style A/B between two output configs at once) | Helps tuning; Squoosh has it | M | Nice-to-have; users can iterate by changing settings |
| PU-8 | **Color quantization to PNG-8 via libimagequant/pngquant** | Real wins on flat-color PNGs (logos, UI screenshots) | M (extra WASM module) | OxiPNG already wins big on lossless; PNG-8 is a v1.x add |
| PU-9 | **CLI / programmatic API for CI** (e.g., `npx oimg .`) | Devs want one config that works locally and in CI | L (separate Node distribution) | Whole new codebase + release pipeline; explicitly out of scope for the browser-tool MVP |
| PU-10 | **Real-time per-file optimization** (re-encode on every settings change like Squoosh) vs **explicit "Optimize" button** | Squoosh does real-time; great UX but expensive at batch scale | M (debouncing + cancellation) | Pick "explicit Optimize" for batch v1; real-time per-file in detail view is an upgrade |
| PU-11 | **Preset library (community-shared SVGO/codec presets)** | Discoverability; "what does Tailwind use?" | M | Requires shareable preset JSON + hosting; defer until traffic |
| PU-12 | **Butteraugli auto-target mode** | Squoosh's clever feature; finds smallest size at given perceptual quality | L (extra encoder pass) | Already deferred in PROJECT.md; experimental and slow |
| PU-13 | **JPEG XL support** | Future-proofing | M | Already deferred; codec ecosystem still maturing |
| PU-14 | **Animated GIF/WebM/MP4 transcoding** | Ad-hoc dev need | L | Already excluded — out of "image" scope |
| PU-15 | **History panel (last N sessions)** | Re-export a previous batch | M (IndexedDB) | Conflicts with the privacy stance — explicitly excluded in PROJECT.md |

### Anti-Features (Explicit "Not Building" with Reason)

Things to deliberately refuse, with the reason and the redirect.

| # | Anti-Feature | Why Tempting | Why Wrong | What to Do Instead |
|---|--------------|--------------|-----------|--------------------|
| AF-1 | **Image editing (crop, rotate, filters, color adjust)** | Users will request it; "if it has the image, why not edit it?" | Editor scope is unbounded (every Photoshop feature ever). Optimizer + editor = neither done well. Photopea, Squoosh, Figma already win editing. | Resize is the only "edit" op. For everything else, crop in Figma/source then drop here. |
| AF-2 | **Cloud sync / accounts / login** | "Save my presets to the cloud" | Breaks the zero-server promise that IS the brand. Adds auth, infra, pricing. | Named presets in IndexedDB. Export/import preset JSON for cross-machine sync. |
| AF-3 | **Telemetry / analytics (PostHog, GA, Sentry, Plausible)** | Product analytics is "table stakes" elsewhere | Squoosh's GA is the *exact* point of difference. Any tracking erodes the privacy moat. The tool is small enough to ship without metrics. | Zero. Period. (Optional fully-local stats, no network, can be considered post-v1.) |
| AF-4 | **Animated GIF → MP4/WebM transcoding** | Common dev need; lots of demand | Out of "image" scope; brings ffmpeg.wasm, audio handling, frame extraction, codec licensing. Different product. | Recommend ezgif/HandBrake/ffmpeg in docs FAQ. |
| AF-5 | **Generic file converter (PDF→PNG, HEIC→JPEG, RAW→anything)** | "While we have all these codecs, why not?" | Each new format = new codec, new UX, new edge cases. Distracts from the dev-batch-snippet workflow. | Recommend dedicated tools. We optimize the 5 formats devs ship. |
| AF-6 | **Image CDN / dynamic resizing service** | "Run our optimizer on a server for `/og-image?w=1200`" | That's Imgix/Cloudinary/Vercel Image. Also breaks zero-server. | Stay client-only. Suggest Cloudflare Images for CDN needs. |
| AF-7 | **Reinventing SVGO or jSquash** | "We could do better than upstream" | Maintaining a fork eats the project. SVGO + jSquash are Pareto-optimal. | Integrate; contribute upstream when bugs found. |
| AF-8 | **Built-in error tracking SaaS (Sentry, Bugsnag, etc.)** | Dev hygiene | Sends data off-machine. Users will spot it in DevTools and lose trust. | console.error + a "Report bug" link to GitHub Issues with manual repro steps. |
| AF-9 | **AI features (auto-describe, smart-crop, generate-alt-text via LLM)** | Trendy in 2026 | Requires server inference (privacy violation) or huge in-browser model (perf violation). | Skip. Devs write their own alt text. |
| AF-10 | **Multi-step image pipelines (filter chains, conditional logic)** | Photoshop-action-like workflows | Optimizer with workflow engine = neither. Bloats UX. | Single global config + per-file overrides. That's the model. |
| AF-11 | **In-browser file watching ("auto-reoptimize when file changes on disk")** | Fancy | FS Access API permissions are awkward; users don't expect a web app to surveil their disk. | A clear "Optimize" button. |
| AF-12 | **Server-side preset sharing / comments / community features** | Engagement | Backend, moderation, hosting, abuse vectors. We are a tool, not a community. | Export preset JSON; users share via GitHub gists if they want to. |

---

## Feature Dependencies

```
TS-2 (codec support)
    ├── TS-3 (quality slider per raster codec)
    ├── TS-4 (SVGO plugin toggles for SVG)
    ├── TS-14 (resize)
    │   └── D-1 (mixed-density variant generation)
    │       ├── D-2 (<picture> + srcset snippet)
    │       │   ├── D-3 (<img srcset> snippet — subset of D-2)
    │       │   └── D-9 (snippet ↔ filename ↔ density sync)
    │       │       └── D-8 (structured ZIP filenames)
    │       └── TS-9 (ZIP export, with structured names)
    └── D-12 (Web Worker pool — wraps every codec)

D-7 (global vs per-file settings) ──enables──> D-6 (per-file snippet checkboxes)
D-1 (density model)               ──drives───> D-9 (the sync engine)
TS-10 (named presets)             ──extends──> D-7 (global settings)
TS-13 (per-file error isolation)  ──required-by──> all batch operations
D-4 (CSS data URI snippet)        ──depends-on──> URL-encoder logic + 32KB heuristic
D-5 (inline <svg> snippet)        ──depends-on──> SVGO output (no extra encoding)
D-11 (lazy codec loading)         ──conflicts-with──> "ship one big bundle" simplicity
TS-6 (split-slider preview)       ──extends──> TS-5 (size delta) — adds visual delta
PU-2 (SVG sprite gen)             ──conflicts-with──> per-file model — sprites are inherently aggregate
```

### Dependency Notes

- **D-1 (mixed density) is the linchpin.** Without it, D-2/D-3/D-8/D-9 collapse into "single-density export." It's the feature that ties the four snippet types into a coherent system.
- **D-9 (snippet ↔ filename ↔ density sync)** is invisible-but-load-bearing. If it breaks, generated `<picture>` snippets reference filenames that don't match the ZIP output → users hit broken images in production. This deserves its own integration tests.
- **TS-13 (per-file error isolation) blocks every batch operation.** Get this wrong, and a single corrupt SVG kills a 30-file run.
- **D-7 (global vs per-file settings)** is required for D-6 to make sense — you can't "override globally-defined snippet settings per file" without the inheritance model.
- **PU-2 (SVG sprites) conflicts with the per-file output model.** A sprite is one output from many inputs; it doesn't fit the per-file-snippet-row UI cleanly. v2.
- **TS-10 (named presets) extends D-7** — presets are saved bundles of global settings.

---

## MVP Definition

### v1 Launch (P1 — must ship)

The minimum that delivers the locked user story end-to-end:

- [ ] TS-1, TS-2 (SVG, PNG, WebP minimum; JPEG + AVIF strongly recommended), TS-3, TS-4, TS-5, TS-6, TS-7, TS-8, TS-9, TS-10 (last-used + named), TS-11, TS-12, TS-13, TS-14, TS-15, TS-16, TS-18 — all table stakes
- [ ] **D-1 mixed-density model** — the locked differentiator
- [ ] **D-2, D-3, D-4, D-5** — all four snippet types (the user story explicitly lists them)
- [ ] **D-6 per-file snippet checkboxes**
- [ ] **D-7 global + per-file settings**
- [ ] **D-8 structured ZIP filenames** (without this, D-2/D-3 snippets are useless)
- [ ] **D-9 sync engine** (the snippet ↔ filename ↔ density single source of truth)
- [ ] **D-10 zero outbound requests** (architectural — free if you just don't add fetches)
- [ ] **D-12 Web Worker pool** (matches Squoosh; required for non-blocking 30-file batches)
- [ ] **D-13 file-list-default + click-to-detail-view** (the architectural shape of the app)

### v1.x (P2 — add after v1 ships and gets usage)

- [ ] D-11 lazy codec loading (perf polish — once bundle audit is done)
- [ ] D-14 aggressive SVGO mode with fidelity warning
- [ ] PU-1 aggregated multi-file CSS export (when users ask)
- [ ] PU-3 configuration export/import (`.oimgrc.json`)
- [ ] PU-4 file-size budget checks
- [ ] PU-7 codec-comparison A/B mode in detail view
- [ ] PU-8 PNG-8 quantization
- [ ] PU-10 real-time re-encode in detail view (debounced)
- [ ] TS-17 reorder/remove file list (if not already in v1)

### v2+ (P3 — defer until product-market fit)

- [ ] PU-2 SVG sprite generation
- [ ] PU-5 SRI hashes
- [ ] PU-6 directory-preserving folder uploads
- [ ] PU-9 CLI/Node distribution for CI
- [ ] PU-11 community preset library
- [ ] PU-12 butteraugli auto-target
- [ ] PU-13 JPEG XL
- [ ] PWA / offline shell (already deferred in PROJECT.md)
- [ ] i18n beyond English (already deferred in PROJECT.md)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-1 drag-and-drop multi-file | HIGH | LOW | P1 |
| TS-2 5-format codec support | HIGH | MEDIUM (codecs chosen) | P1 |
| TS-3 quality + lossless toggle | HIGH | LOW | P1 |
| TS-4 SVGO plugin toggles | HIGH | MEDIUM | P1 |
| TS-5 byte/percent delta | HIGH | LOW | P1 |
| TS-6 split-slider preview | HIGH | MEDIUM | P1 |
| TS-9 individual + ZIP download | HIGH | LOW | P1 |
| TS-10 named preset persistence | HIGH | MEDIUM | P1 |
| TS-13 per-file error isolation | HIGH | MEDIUM | P1 |
| TS-14 resize on export | HIGH | MEDIUM | P1 |
| TS-15 metadata stripping | MEDIUM | LOW | P1 |
| D-1 mixed-density model | HIGH | MEDIUM | **P1 (moat)** |
| D-2 `<picture>` + srcset snippet | HIGH | MEDIUM | **P1 (moat)** |
| D-3 `<img srcset>` snippet | HIGH | LOW (subset of D-2) | **P1 (moat)** |
| D-4 CSS data URI + size warning | HIGH | LOW | **P1 (moat)** |
| D-5 inline `<svg>` snippet | HIGH | LOW | **P1 (moat)** |
| D-6 per-file snippet checkboxes | HIGH | MEDIUM | **P1 (moat)** |
| D-7 global + per-file settings | HIGH | MEDIUM | **P1 (moat)** |
| D-8 structured ZIP filenames | HIGH | LOW | **P1 (moat)** |
| D-9 sync engine | HIGH | MEDIUM | **P1 (moat)** |
| D-10 zero outbound | HIGH | LOW (architectural) | **P1 (moat)** |
| D-12 Web Worker pool | HIGH | MEDIUM | P1 |
| D-13 file-list + detail-view layout | HIGH | MEDIUM | P1 |
| D-11 lazy codec loading | MEDIUM | MEDIUM | P2 |
| D-14 aggressive SVGO | MEDIUM | MEDIUM | P2 |
| PU-1 aggregated CSS export | MEDIUM | MEDIUM | P2 |
| PU-3 config export/import | MEDIUM | LOW–MEDIUM | P2 |
| PU-4 size budgets | MEDIUM | LOW | P2 |
| PU-7 A/B compare in detail | MEDIUM | MEDIUM | P2 |
| PU-8 PNG-8 quantization | MEDIUM | MEDIUM | P2 |
| PU-10 real-time re-encode | MEDIUM | MEDIUM | P2 |
| PU-2 SVG sprites | MEDIUM | HIGH | P3 |
| PU-5 SRI hashes | LOW | LOW | P3 |
| PU-6 folder upload preserving paths | LOW–MEDIUM | MEDIUM | P3 |
| PU-9 CLI/Node distribution | MEDIUM | HIGH | P3 |
| PU-11 community presets | LOW | MEDIUM | P3 |
| PU-12 butteraugli auto-target | LOW | HIGH | P3 |
| PU-13 JPEG XL | LOW (in 2026) | MEDIUM | P3 |

**Priority key:**
- **P1 (moat)** — must ship in v1; this is what makes oimg.app exist
- **P1** — table-stakes must ship in v1
- **P2** — strong v1.x candidate
- **P3** — defer until validation

---

## Competitor Feature Analysis

| Feature | Squoosh | SVGOMG | url-encoder | jSquash demo | **oimg.app** |
|---------|---------|--------|-------------|--------------|--------------|
| Multi-file batch | ❌ single-file only | ❌ single-file only | ❌ | ❌ | ✅ — primary mode |
| 5 raster formats (PNG/JPEG/WebP/AVIF + lossless PNG) | ✅ | n/a | ❌ | ✅ (per codec demo) | ✅ |
| SVG optimization | ❌ | ✅ (the ref) | ❌ | ❌ | ✅ |
| Data URI / Base64 export | ⚠️ partial | ❌ | ✅ (the ref) | ❌ | ✅ — both Base64 + URL-encoded |
| `<picture>` + srcset snippet | ❌ | ❌ | ❌ | ❌ | ✅ — **unique** |
| `<img srcset>` snippet | ❌ | ❌ | ❌ | ❌ | ✅ — **unique** |
| CSS `background-image` data URI w/ size warning | ❌ | ❌ | ⚠️ no warning | ❌ | ✅ — **unique** |
| Inline `<svg>` snippet (post-optimization) | n/a | ⚠️ "show source" | ❌ | n/a | ✅ — first-class output |
| Mixed 1x/2x/3x source-density model | ❌ | n/a | ❌ | ❌ | ✅ — **unique** |
| ZIP export with structured filenames | ❌ | ❌ | ❌ | ❌ | ✅ — **unique** |
| Side-by-side / split-slider preview | ✅ (signature) | ❌ | ❌ | ❌ | ✅ |
| Per-codec quality + advanced params | ✅ | n/a | n/a | ✅ | ✅ |
| SVGO per-plugin toggles | n/a | ✅ | n/a | n/a | ✅ |
| Resize with multiple algorithms | ✅ | n/a | ❌ | ❌ | ✅ |
| Metadata stripping | ✅ | implicit | ❌ | varies | ✅ |
| Telemetry / GA | ❌ has Google Analytics | ⚠️ unclear | ❌ | n/a | ✅ — **explicitly none** |
| Zero outbound requests after load | ⚠️ no (GA pings) | varies | ✅ | ✅ | ✅ — **enforced + advertised** |
| Web Worker pool | ✅ | ⚠️ limited | n/a | varies | ✅ |
| Lazy codec loading | ⚠️ partial | n/a | n/a | ✅ | ✅ |
| Named user presets | ❌ | ⚠️ partial (only plugin set, not full config) | ❌ | ❌ | ✅ |
| Dark + light theme | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |

### What devs hate in existing tools (friction points → our design responses)

| Friction in Existing Tool | Our Response |
|---------------------------|--------------|
| **Squoosh: single-file only** — drop 30 files, get 30 tab-switches | TS-1 + D-13: file list IS the default; single-file is a click-to-detail |
| **Squoosh: GA telemetry** — privacy-conscious devs notice | D-10 + AF-3: zero outbound, advertised |
| **Squoosh: no snippet generation** — "now hand-write your `<picture>`" | D-2 through D-5 + D-9 — the entire snippet output layer |
| **SVGOMG: no batch** — drop 30 SVGs, get 30 manual exports | TS-1 + ZIP output |
| **SVGOMG: no raster formats** — devs use one tool for SVG, another for PNG | TS-2 covers all 5 formats in one tool |
| **url-encoder: no actual optimization** — encodes the unoptimized SVG | We optimize *before* encoding; data URI reflects the SVGO output |
| **url-encoder: no size warning** — devs paste 50KB SVGs into CSS | D-4: 32KB warning threshold |
| **No tool: density variants** — devs make 1x/2x/3x by hand in Figma/PS | D-1: mark source density, app generates the rest |
| **No tool: filenames synced to snippet** — manual rename = broken `<picture>`| D-8 + D-9: structured names AND snippet sync |
| **All tools: presets per session only** — re-toggle 12 plugins each time | TS-10: named, persisted presets |
| **All tools: drop one bad file, lose the batch** | TS-13: per-file error isolation |

---

## Sources

- `/Users/jilizart/Projects/oimg.app/.planning/PROJECT.md` — locked user story, scope, decisions, constraints
- `/Users/jilizart/Projects/oimg.app/ARCH.md` — Russian original spec (functional requirements §2.2, optimization techniques §7 — adaptive images, lazy loading, Core Web Vitals tie-ins)
- `/Users/jilizart/Projects/oimg.app/ARCH_.md` — Russian alternative spec (full optimization-techniques table §4, UI three-column layout §5, security §6, validation criteria §8)
- `/Users/jilizart/Projects/oimg.app/example-ui/panels.jsx` — designed components: `CodecPanel`, `SvgoPanel`, `OutputPanel` (Base64 + URL-encoded + responsive `<picture>`), `ReportPanel` (totals + format breakdown)
- `/Users/jilizart/Projects/oimg.app/example-ui/tweaks-panel.jsx` — control vocabulary (Slider, Toggle, Radio, Number, Color) — implicitly the design language for settings UIs
- Squoosh (Google Chrome Labs) — reference for codec WASM glue and split-slider; archived `@squoosh/lib` 2023
- SVGOMG — reference for SVGO plugin toggle UX and accordion settings
- yoksel's url-encoder — reference for URL-encoded SVG data URI generation
- jSquash (`@jsquash/{webp,avif,oxipng,mozjpeg,jpeg,png}`) — modern per-codec replacement for archived `@squoosh/lib`
- SVGO v3+ ESM browser bundle — direct in-browser SVG optimization, no Node shims

---

*Feature research for: browser-based batch image optimizer with developer-snippet output*
*Researched: 2026-04-29*
