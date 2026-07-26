---
id: 260726-3cp
slug: svg-encoded-layer
title: Fix CompareStage encoded layer when SVG source + raster output codec selected
type: quick-fix
created: 2026-07-26
---

## Problem

When a user drops an SVG file and picks PNG (or WebP/JPEG/AVIF) in the Inspector Codec dropdown, the Center CompareStage's encoded layer never shows the raster output. User only sees the SVG variant.

## Investigation Starting Point

The pipeline should work:
1. `CodecPanel.handleSetCodec('PNG')` → `setFileSettings(id, 'codec', 'PNG')` + `useLiveEncode.trigger(id)`
2. `useLiveEncode` (300ms debounce) → sees `sourceFormat='svg' && codec !== 'SVG'` → `rasterizeSvgToPng(rawBuffer)` → dispatches raster encode job → worker returns PNG bytes → `setFileResult(id, buffer, size)`
3. `setFileResult` writes `encodedBuffer` via WR-02 `updateEntry` funnel + resets `metrics: undefined`
4. `CompareStage` encoded-layer effect keys on `[selectedFile?.encodedBuffer, isSvgOutput]` → new buffer + `isSvgOutput=false` → creates blob URL → `<img src={encodedSrc}>` renders raster

**Strong hypothesis (transient stale state):**

Between step 1 and step 3 there is a ≥300ms window where:
- `settings.codec === 'PNG'` (immediate)
- `encodedBuffer` still holds the **old svgo-optimized SVG bytes** (from initial ingest when codec was 'SVG')
- `isSvgOutput` has already flipped to `false`
- Encoded-layer effect fires with the STALE SVG bytes + raster render branch → creates `new Blob([svgBytes])` (no MIME) → `<img src={blobUrl}>`
- `<img>` may fail to decode SVG bytes as raster → `onError={() => setEncodedSrc(null)}` fires → placeholder shows
- If the debounced re-encode fires successfully 300ms later, encodedBuffer updates → PNG shows
- If the re-encode errors (rasterization / worker crash / etc.), user is stuck on the placeholder forever

## Investigation Tasks

Before fixing, verify the hypothesis with actual reproduction:

1. **Start dev server** (`npm run dev`, port 5174) and load the app in a browser via Playwright MCP.
2. **Drop an SVG file** (any real one — `test-icon.svg` fixture or generate one).
3. **Pick PNG in Inspector.**
4. **Observe:**
   - Does the encoded layer flash blank/placeholder then update? (transient hypothesis correct — 300ms + fix by masking during re-encode)
   - Does it stay stuck on placeholder forever? (re-encode is silently failing — need to instrument, likely rasterization or worker error)
   - Does it stay stuck showing the SVG (as if isSvgOutput logic is inverted)? (CompareStage keying bug — check `isSvgOutput` derivation)
5. Open DevTools Console — look for errors from useLiveEncode, rasterizeSvgToPng, or `<img>` decode failures.

## Fix (once verified)

**Most likely fix (transient stale state):** In `setFileSettings` (or the CodecPanel `handleSetCodec` handler), when the codec key changes AND the new codec doesn't match the codec that produced the current encodedBuffer, invalidate `encodedBuffer + opt` synchronously so the encoded layer immediately shows a "encoding…" placeholder rather than the stale bytes.

Options for detecting "codec that produced encodedBuffer":
- **Option A (schema addition, cleanest):** Add `encodedCodec?: Codec` field to `FileEntry`. `setFileResult` writes it alongside `encodedBuffer`. CompareStage encoded-layer effect renders placeholder when `encodedCodec !== settings.codec` (mismatch = re-encode pending).
- **Option B (invalidate on setting change):** `setFileSettings(id, 'codec', v)` clears `encodedBuffer` immediately. Simpler but blanks display for any codec change (including WebP→JPEG where both are raster and the transient wrong-render doesn't actually occur).

Prefer **Option A** — it captures the invariant precisely (encoded layer shows current bytes only when they were produced by the currently-selected codec). Option A also fixes any similar future mismatch (e.g. changing SVG-source's quality slider that happens to be interpreted differently).

**Files likely to touch (minimal set):**
- `src/lib/settings.ts` — add `encodedCodec?: Codec` to `FileEntry`
- `src/stores/files.ts` — `setFileResult(id, buffer, size, codec)` signature + write via updateEntry
- `src/hooks/useOptimize.ts` and `src/hooks/useLiveEncode.ts` — pass `codec` into `setFileResult(...)` calls (the codec they dispatched with)
- `src/components/panels/center/CompareStage.tsx` — encoded-layer effect: gate on `encodedCodec === settings.codec`; if mismatch, show placeholder (same visual as no-encoded-yet state)

**Do NOT touch:**
- Phase 16/17 metrics wiring (`useMetricsAuto`, metrics.worker, ReportPanel)
- Bundle-budget tests
- `rasterizeSvgToPng` internals (it's fine per Phase 15 lesson)

## Acceptance

- User drops SVG → picks PNG → CompareStage encoded layer shows PNG within ~300ms (with brief placeholder gap during re-encode)
- User picks WebP → placeholder gap, then WebP appears
- User picks JPEG → same
- User picks AVIF → same (may take longer for AVIF WASM load, first time)
- No regression on: raster→raster codec swap (PNG→WebP), SVG→SVG (svgo re-run), SVG source with SVG output codec (still shows optimized SVG in iframe)
- `./node_modules/.bin/vite build` exits 0
- Any existing Playwright specs still pass (`ssim-metric.spec.ts`, `butteraugli-metric.spec.ts`, `output-panel-live.spec.ts`)

## Commit style

- Multiple atomic commits OK per touched file if the diff is substantial; otherwise one `fix(quick-260726-3cp): ...` commit
- Include `Task: 260726-3cp` and `Plan: .planning/quick/260726-3cp-svg-encoded-layer/PLAN.md` fields

## Deliverables

- Fix committed and green under `vite build` + Playwright regression
- `SUMMARY.md` in the same directory with: root cause confirmed vs. hypothesis, actual fix applied, files touched, follow-ups (if any)
