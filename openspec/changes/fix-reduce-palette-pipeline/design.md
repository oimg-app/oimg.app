## Context

See proposal.md — Why, for the reproduction and the three defects. The facts that shape the approach:

- `@squoosh-kit/imagequant@0.2.4` exports only its wrapper (`.` and `./imagequant.worker.js`). The Emscripten glue (`dist/wasm/imagequant/imagequant.js`, built with `ENVIRONMENT_IS_WORKER=true`) and `imagequant.wasm` are not in the `exports` map, so Vite cannot import them by package path.
- `@squoosh-kit/vite-plugin` already copies each package's browser files and `wasm/` directory to `public/squoosh-kit/<pkg>/` on `buildStart` (dev and build). The production build therefore already ships `/squoosh-kit/imagequant/wasm/imagequant/imagequant.{js,wasm}`; the bundled wrapper just never looks there.
- The wrapper's `client` bridge lazily runs a module initializer on the first `quantize()` that assigns `self.onmessage`. `metrics.worker.ts` documents the identical behavior in `@squoosh-kit/visdif` and works around it by nulling `self.onmessage` after each call.
- The codec worker handles one job at a time per worker (`WorkerPool` dispatches only to idle workers).
- `public/_headers` applies COOP/COEP to `/*`, and `src/sw.ts` already has a CacheFirst route for `/squoosh-kit/`.

## Goals / Non-Goals

**Goals:**
- Reduce palette works in the production build and in dev through one code path.
- No job can leave a codec worker in a state where later jobs fail.
- A bad worker reply is a per-file error, never an uncaught `TypeError` or an aborted batch.

**Non-Goals:**
- Changing which codecs quantization applies to, or the palette UI's shape (see Open Questions).
- Touching the metrics worker's visdif workaround, which works.
- Replacing `@squoosh-kit/imagequant` with another quantizer.

## Decisions

### D1 — Load the Emscripten factory directly from `/squoosh-kit/…`, drop the wrapper

`getQuantizer()` in `codec.worker.ts` becomes: dynamic-import the glue by runtime URL (`import.meta.env.BASE_URL + 'squoosh-kit/imagequant/wasm/imagequant/imagequant.js'`, with `/* @vite-ignore */`), call its default export with an explicit `locateFile` returning the sibling `imagequant.wasm` URL, cache the resolved module, and call `module.quantize(data, width, height, numColors, dither)`. The returned pixels are copied into a fresh `Uint8ClampedArray` before building the `ImageData`, so the result can never alias WASM memory that a later call reuses.

Why: it removes both production defects at the source. There is no wrapper to mis-resolve URLs and nothing that assigns `self.onmessage`. It is also less code than today's wrapper plus a workaround. The import stays inside `getQuantizer()` (PIPE-02), and a runtime URL keeps the glue out of the bundle graph entirely.

Alternatives considered:
- **Keep the wrapper, port the metrics-worker workaround** (null `self.onmessage` after each call) **and import the wrapper itself from `/squoosh-kit/imagequant/index.browser.mjs`** so its relative `./wasm/…` lookup resolves. Matches existing precedent and keeps the spec wording, but needs two workarounds for one library, still depends on the wrapper's internal init timing, and keeps its console logging. This is the fallback if D1 hits an unexpected problem with the glue.
- **Vite `resolve.alias` to the deep `dist/wasm/…` paths plus a `?url` import for the WASM.** Gives hashed, bundled assets, but needs two aliases that bypass the package's `exports` map and breaks on any upstream layout change at build time rather than being caught by a simple asset check.
- **Copy the glue and WASM into `src/`.** Vendoring a binary for no gain; the plugin already publishes them.

### D2 — Clamp in the worker; fix the two UI sources of bad values

The worker is the single point every job passes through, so the clamp lives in `maybeReduceColors`: `numColors = min(256, max(2, round(Number(v)) || 256))`, `dither = min(1, max(0, Number(v)))` with a non-finite fallback of 1. This follows the existing WR-04/WR-05 clamps in the same file. The slider `min` moves from 1 to 2 so the UI cannot display a value the encoder will not use, and `setDithering` is corrected to write `dithering`.

Alternative: validate in the store actions only. Rejected: per-file settings, apply-to-all, and any future persisted settings would each need the same guard.

### D3 — Validate the reply in `WorkerPool._drain`

Before `pending.resolve(result)`, check that `result?.buffer instanceof ArrayBuffer`; otherwise `pending.reject(new Error('Invalid worker result'))`. Both hooks already convert a rejection into `setFileError` + toast, so no hook changes are needed, and the batch path stops throwing inside its `.then` destructure.

After D1 nothing in the codebase should produce a malformed reply. The guard stays because the pool is the boundary between two threads and the cost is one line; this exact failure has now happened in both workers.

### D4 — Honest AVIF error label

The AVIF branch's catch currently rewrites every error, including decode, resize, and color-reduction failures, to "AVIF not supported in this browser". Change the prefix to "AVIF encode failed" so the underlying message decides what the user reads. No behavior change beyond the string.

### D5 — Tests

- **e2e (`src/tests/*.spec.ts`, dev server):** ingest an SVG fixture, select it, pick PNG → enable Reduce palette → expect an encoded result; set Colors to minimum → expect 2 and a result; switch to JPEG, then AVIF → expect results; disable Reduce palette → expect a result. Reuse the `_helpers` (ingest, inspector, encode). This covers the hijack regression in dev, where the URL bug does not occur.
- **Node unit test:** the clamp, extracted as a small pure function so it can run under `--experimental-strip-types`.
- **Bundle check (`npm run test:bundle`):** assert `dist/squoosh-kit/imagequant/wasm/imagequant/imagequant.js` and `.wasm` exist, and that no file under `dist/assets/` contains the wrapper's `createImagequantQuantizer` export. This is the only automated guard for the production-only URL defect.
- **Manual, production build:** `pnpm preview`, then the SVG → PNG/JPEG/AVIF + palette walk-through with the network panel open.

## Risks / Trade-offs

- [The glue is loaded from an unhashed `public/` path, so a browser or the service worker could serve a stale copy after a dependency bump] → The package is pinned at `0.2.4` and both files change together; the SW route for `/squoosh-kit/` is the only long-lived cache. If the pin is ever bumped, bump the SW cache name for that route in the same change.
- [Vite's dev server could refuse or transform a runtime import of a `public/` JS file] → The plugin registers its own `/squoosh-kit` middleware in dev; task 2.3 verifies dev explicitly. If it fails, switch to the documented fallback (wrapper + disarm).
- [Calling the Emscripten factory directly skips the wrapper's input validation] → D2's clamp covers the option ranges; the pixel buffer is always an `ImageData` produced by our own decode/resize step.
- [The glue's `quantize` signature could differ from its `.d.ts`] → Task 2.1 confirms it against the wrapper's call site (`a.quantize(i, s, t, c, u)`), which matches.
- [If the plugin stops copying assets, quantization fails at runtime only] → The bundle check in D5 fails the build first.

## Migration Plan

Ship as a normal deploy (`pnpm run deploy`). No stored data or settings shape changes. Rollback is a redeploy of the previous build; the previous build's behavior is the bug described in the proposal.

## Open Questions

- The `color-quantize` spec requires quantization to be skipped for non-PNG output and describes a three-mode PNG palette selector; the shipped code applies it to every raster codec behind one switch. This change preserves the shipped behavior and does not edit those two requirements. Reconciling spec and code (in either direction) is a separate change and does not affect any task here.
