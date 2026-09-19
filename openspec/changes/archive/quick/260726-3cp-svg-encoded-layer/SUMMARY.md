---
id: 260726-3cp
slug: svg-encoded-layer
status: complete
completed: 2026-07-26
commit: 05e3290
---

# Quick 260726-3cp — Fix CompareStage encoded layer for SVG source + raster output

## Root cause

During the 300ms `useLiveEncode` debounce after picking PNG on an SVG source:
- `settings.codec` flips to `PNG` synchronously
- `encodedBuffer` still holds the initial svgo-optimized SVG bytes (from ingest when codec was 'SVG')
- `CompareStage`'s encoded-layer effect re-runs with `isSvgOutput=false` + stale SVG bytes
- Feeds those bytes to `<img>`, which decode-fails → `onError` → `setEncodedSrc(null)`
- Placeholder shows. If the debounced re-encode ever silently fails, the placeholder is sticky forever (the "never shows" symptom).

Confirmed via code trace by the executor. Playwright MCP live reproduction was unavailable in the executor's session.

## Fix (Option A per plan)

Tag each `encodedBuffer` with the codec that produced it (`FileEntry.encodedCodec?: Codec`). CompareStage renders bytes only when `encodedCodec === settings.codec`, else placeholder. This gates against the transient stale-bytes render precisely without blanking raster→raster codec swaps unnecessarily.

## Files touched (5 files, +51 / −7)

- `src/lib/settings.ts` — optional `encodedCodec?: Codec` on `FileEntry`
- `src/stores/files.ts` — `setFileResult(id, buf, size, codec?)` writes through WR-02 `updateEntry` funnel; `metrics: undefined` invalidation preserved
- `src/hooks/useLiveEncode.ts` — passes resolved `codec` into `setFileResult`
- `src/hooks/useOptimize.ts` — passes `job.codec` into streaming `.then` handler
- `src/components/panels/center/CompareStage.tsx` — codec-mismatch gate in encoded-layer effect; deps widened to `[encodedBuffer, encodedCodec, settings.codec, isSvgOutput]`. Legacy entries (`encodedCodec === undefined`) skip the gate → keeps existing test fixtures rendering.

## Verification

- `./node_modules/.bin/vite build` → exit 0
- `node --experimental-strip-types … src/tests/stores.test.ts` → 76 passed / 0 failed
- Playwright `ssim-metric.spec.ts` + `butteraugli-metric.spec.ts` → 7 pass
- `output-panel-live.spec.ts` — 4 pre-existing failures reproduce on unmodified stashed tree; matches the "flaky `/src/…` `page.evaluate` dynamic-import" pattern in memory (`typecheck-and-test-gotchas`). Unrelated.

## Follow-ups

- 30-second live browser sanity-check recommended: drop SVG → pick PNG, WebP, JPEG → each shows brief placeholder gap then correct raster. AVIF first-pick may take longer (WASM lazy-load).
- Option B (invalidate on any settings.codec change) was intentionally NOT applied. Option A is strictly more precise; Option B would blank raster→raster codec swaps unnecessarily.
- Pre-existing `output-panel-live.spec.ts` flakiness belongs in a separate ticket if fixed.
