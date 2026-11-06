# Glossary

Domain vocabulary for oimg.app. Module names in code follow these terms; architecture reviews
(`/improve-codebase-architecture`) read this file first.

## Files and settings

- **FileEntry** — one ingested asset: `id`, `name`, `type` (source extension, lowercase), sizes,
  `status`, `target` (output extension), `settings`, `rawBuffer`, `encodedBuffer`, `encodedCodec`,
  `metrics`. Lives in `filesAtom`; every per-entry write goes through `updateEntry`.
- **FileSettings** — the complete set of encode parameters (codec, quality, effort, resize,
  palette, SVGO plugins, AVIF knobs). One shape for both per-file settings and the global
  defaults (`settingsAtom`). Seeded by `defaultFileSettings(type, q)`.
- **Global defaults** — `settingsAtom`, a `FileSettings` edited when no file is selected and
  copied onto every entry by **applyToAll**.
- **editSetting** — the one settings writer (`stores/settings.ts`): per-file (+ live re-encode)
  when a `fileId` is given, global otherwise.
- **target** — lowercase output extension on a FileEntry; kept in step with `settings.codec` by
  `setFileSettings` and `applyToAll`.

## Formats and codecs

- **Codec** — an output engine: `SVG | PNG | WebP | JPEG | AVIF` (mixed case, `lib/constants.ts`).
- **SourceFormat** — an accepted input extension: `png jpeg jpg webp avif svg heic heif`.
  HEIC/HEIF are **decode-only** (no Codec of their own; fall back to JPEG output).
- **Format registry** — `lib/formats.ts`: the single table of ext ↔ MIME ↔ Codec ↔ SourceFormat
  facts. Ingest gate, picker accept map, filename MIME, snippets, URL paste and both workers'
  input guards all derive from it.

## Encoding pipeline

- **EncodeJob** — `{ codec, sourceFormat, buffer, settings }` sent to the codec worker;
  **EncodeResult** — `{ buffer, originalSize, optimizedSize }` back.
- **prepareJob / encodeEntry** — `lib/encode-entry.ts`: FileEntry → EncodeJob → WorkerPool.
  The only place the "settings.codec wins" rule and the SVG pre-rasterize step live.
- **Rasterize** — main-thread SVG → canvas → PNG/Blob (`lib/svg-raster.ts`). Required because
  workers cannot decode SVG; the worker then receives PNG bytes.
- **Live encode** — `lib/live-encode.ts`: debounced (300 ms) single-file re-encode with a
  monotonic token so stale results never land. **Optimize all** (`runOptimize`) is the batch
  policy: skip done entries, stream results back per file.
- **WorkerPool** — bounded (≤4) Comlink queue over `codec.worker.ts`; `onDispatch` fires when a
  job leaves the queue.
- **decodeImage** — `workers/decode.ts`: the shared SourceFormat → ImageData switch for both
  workers (codec imports stay inside branches — PIPE-02).

## Metrics, preview, export

- **MetricJob / computeMetrics** — raw + encoded buffers → `{ ssim, butteraugli }` in one
  round-trip (`metrics.worker.ts`); `null` marks a failed metric, `undefined` a pending one.
- **Preview source** — `lib/preview.ts`: bytes + kind → `{ src, isFrame, revoke }` for the
  compare stage (SVG → sandboxed iframe data URI, HEIC → decoded canvas, raster → object URL).
- **Export item** — `lib/export-items.ts`: an exportable entry's `{ name, blob, ext, mime }`,
  derived from the codec that produced the bytes (`encodedCodec`). Single save, bulk save and
  ZIP all consume the same list.
- **ClipboardDispatcher** — `{ ingest(files) }` sink that `lib/clipboard-ingest.ts` writes into.
