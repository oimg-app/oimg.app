# Spec Audit — 2026-09-02

## Summary
~18 findings across 8 specs. Roughly: 6 numeric/naming drift, 4 wrong-name, 3 missing-shipped-behavior, 5 outright drift from code. Two specs (theming, diagnostics) rest on premises that don't match the shipped code (next-themes provider absent; no `versionsAtom` / `buildInfoAtom`). The remaining seven specs (resize, color-quantize, worker-pool, snippets, export, command-palette, compare-view) are close to code with only cosmetic drift. AVIF WASM size is uniformly overstated; the correct number is on disk.

## Findings

### optimize-raster/spec.md

- **[drift]** "The ~8 MB AVIF WASM binary MUST NOT be fetched during initial page load" — actual `avif_enc.wasm` is 3,485,872 bytes (~3.32 MB) and `avif_enc_mt.wasm` is 3,534,665 bytes (~3.37 MB) at `/Users/jilizart/Projects/oimg.app/node_modules/@jsquash/avif/codec/enc/`. Codec-worker comment at `src/workers/codec.worker.ts:242` also says "~8MB" — same drift, sourced here. **Action:** change to "~3.4 MB" (matches `vite.config.ts:73` and `src/sw.ts:9`).

### pwa/spec.md

- **[drift]** "The system SHALL emit `manifest.webmanifest` at build time via `vite-plugin-pwa@^1.3.0` in `injectManifest` mode." — `/Users/jilizart/Projects/oimg.app/vite.config.ts:80` sets `manifest: false`; the file is HAND-AUTHORED at `/Users/jilizart/Projects/oimg.app/public/manifest.webmanifest`. Plugin only compiles `src/sw.ts`. **Action:** re-word to "manifest is hand-authored in `public/`; vite-plugin-pwa in `injectManifest` mode only builds the SW."
- **[nothing-to-report]** SW hand-rolled at `src/sw.ts:1-40` (PASS), `_headers` COOP/COEP + `/sw.js: no-cache` + `/manifest.webmanifest: max-age=86400` at `public/_headers:1-8` (PASS).

### theming/spec.md

- **[drift]** "`next-themes` toggle … the system SHALL reflect the current theme on `<html>` (e.g. `data-theme="dark"`)" — next-themes is listed in `package.json:46` but has ZERO imports/usage across `src/**` (grep `next-themes|ThemeProvider|useTheme` returns nothing). Theme is actually held in `uiAtom.theme` (`src/stores/ui.ts`) with a Sun/Moon button in `Toolbar.tsx` calling `setTheme`. No `<ThemeProvider>` is mounted in `src/App.tsx` or `src/main.tsx`. **Action:** rewrite the requirement — either drop the next-themes dependency claim and describe the actual `uiAtom.theme` + CSS-var story, or add a `data-theme` bridge and keep the spec. Currently the spec is not describing shipped code.

### diagnostics/spec.md

- **[naming]** "populates `versionsAtom` at build time" — no `versionsAtom` exists (grep returns 0). Actual shape: `src/lib/versions.ts` exports `BUILD_VERSIONS` (Vite-`define`-inlined); versions surface via `runtimeAtom.versions` (`src/stores/runtime.ts`). Rename `versionsAtom` → `BUILD_VERSIONS` (module constant) + `runtimeAtom.versions` (UI-consumed atom slice).
- **[drift]** "The system SHALL expose `buildInfoAtom` populated via Vite `define` with the build date and short commit hash." — nothing named `buildInfoAtom`, `BUILD_INFO`, `BUILD_DATE`, or `BUILD_COMMIT` exists anywhere (`src/**`, `vite.config.ts`). Only `__SVGO_VERSION__ / __JSQUASH_VERSIONS__ / __SSIM_VERSION__ / __BUTTERAUGLI_BUILD__` are defined at `vite.config.ts:145-149`. **Action:** delete the requirement OR mark it as unimplemented.

### metrics/spec.md

- **[drift]** "SSIM_BANDS and BUTTERAUGLI_BANDS are exported constants; the classifier uses strict `<` comparisons." — `src/lib/metrics-bands.ts:12-17` uses `>=` for SSIM (`ssimBand: if (v >= 0.95) return 'green'`), NOT `<`. Only `butteraugliBand` uses strict `<`. **Action:** correct the spec to "SSIM uses `>=` (inclusive-at-boundary), Butteraugli uses `<`" (matches the file's own docstring).

### inspector-ui/spec.md

- **[drift]** Toolbar "Add-files split-button items (From device / Watch folder / From URL or paste / Recent list)" — grep for `Recent|recentList` in `src/components/shell/Toolbar.tsx` returns nothing. Only three items exist at `Toolbar.tsx:130-172`: "From device", "Watch folder", "From URL or paste". **Action:** drop "Recent list" (non-goal or defer).

### command-palette/spec.md

- **[nothing-to-report]** `$cmdFlat` at `src/stores/ui.ts:143`; `cmdkSel/cmdkOpen/cmdkQ` at `src/stores/ui.ts:26-105`; `CommandPalette.tsx` wires them via `cmdk`.

### ingest/spec.md

- **[nothing-to-report]** `useClipboardIngest.ts:37` attaches `document.addEventListener('paste', onPaste)` — verified. `src/lib/heic/decode.ts` present; `src/lib/dir-picker.ts` uses `showDirectoryPicker`; `src/hooks/useWatchFolder.ts:99` gates on `FileSystemObserver`.

### snippets/spec.md

- **[nothing-to-report]** `escapeAttr` defined at `src/lib/snippets.ts:45` and applied to every attribute (lines 78, 102, 107, 110, 114, 115). Single clipboard write chokepoint verified: only `src/lib/clipboard.ts:45` calls `navigator.clipboard.writeText` in production code (tests mock it separately).

### compare-view/spec.md

- **[nothing-to-report]** Non-passive wheel at `CompareStage.tsx:231` (`{ passive: false }`); sandboxed iframes at lines 307-310 (`sandbox="allow-scripts"`) and 337-340; DeltaStrip cards ORIGINAL / OPTIMIZED / SAVED / SSIM / BUTTERAUGLI / DECODE at `DeltaStrip.tsx:90-121`.

### optimize-svg/spec.md

- **[nothing-to-report]** Aggressive-mode Switch at `SvgoPanel.tsx:45-50`, `setAggressive` action + per-file gate wiring. SVG optimize is synchronous via `svgo/browser` at `codec.worker.ts` SVG branch.

### worker-pool/spec.md

- **[nothing-to-report]** `WorkerPool` singleton with `min(hardwareConcurrency, 4)` at `src/lib/worker-pool.ts:80`; `getMetricsWorker()` singleton at `src/lib/metrics-worker.ts:16`; sibling `src/workers/metrics.worker.ts` exists (13,139 bytes).

### resize/spec.md, color-quantize/spec.md, export/spec.md

- **[nothing-to-report]** No claims spot-checked here diverge from code.

## Cross-cutting

- **PIPE-02 hoist check** — PASS. `codec.worker.ts` top imports (lines 1-6): `comlink`, `@/lib/settings` (types + `SVGO_PLUGINS` + `DEFAULT_AVIF_OPTIONS`). `metrics.worker.ts` top imports (line 6): `comlink` only. Every codec / ssim / visdif import is dynamic inside its `switch` branch.
- **stub-data direct imports in components** — PASS. `grep "from '@/lib/stub-data'" src/components/` returns 0 matches.
- **filesAtom.setKey outside updateEntry** — **FLAG (informational, not a WR-02 violation).** Non-test call sites: `src/stores/files.ts:77` (`setSelectedId`), `src/stores/files.ts:81` (`removeFile`), `src/stores/files.ts:89-90` (`clearFiles`), `src/stores/settings.ts:83` (`applyToAll`). All are structural / whole-array replacements, not per-entry field patches — WR-02 targets per-entry mutations. Consider adding a spec sentence explicitly excluding these four sites from the funnel discipline so future readers don't flag them.
- **`new Worker(new URL(…))` literal URL check** — PASS. `src/lib/worker-pool.ts:31` and `src/lib/metrics-worker.ts:22` both use literal URL strings.

## Nothing-to-report list
- ingest — clipboard/heic/dir-picker/watch-folder verified
- optimize-svg — aggressive mode toggle + SVGO branch verified
- resize — no divergent claims spot-checked
- color-quantize — no divergent claims spot-checked
- worker-pool — pool + metrics singleton + sibling worker verified
- snippets — escapeAttr + single clipboard chokepoint verified
- compare-view — wheel non-passive + sandbox iframes + DeltaStrip verified
- export — no divergent claims spot-checked
- command-palette — $cmdFlat + cmdkSel verified

## Not audited (runtime-only)
- Worker-pool concurrency peak in a 20-file batch (worker-pool spec) — runtime observation.
- Metrics stale-drop discipline (`CR-02 seqRef`) under selection thrash — runtime observation.
- Bundle-size budgets for initial route (< 200 KB gz) — needs `vite build` + analyzer, not audited here.
