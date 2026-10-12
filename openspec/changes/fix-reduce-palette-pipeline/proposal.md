## Why

On production (oimg.app), turning on **Reduce palette** fails and then breaks every later encode handled by the same worker, so a user who imports an SVG and converts it to PNG/JPEG/AVIF ends up with a dead inspector ("Encode failed: TypeError: Cannot read properties of undefined (reading 'buffer')"). Reproduced against the deployed build `codec.worker-r8y7V9Yj.js` on 2026-10-11:

| Step (fresh worker, PNG source) | Result |
|---|---|
| AVIF / JPEG / PNG encode, palette off | OK |
| SVG → PNG / JPEG / WebP / AVIF through the UI, palette off | OK (AVIF 610 B) |
| PNG encode, palette on (64 colors) | `Failed to fetch dynamically imported module: https://oimg.app/wasm/imagequant/imagequant.js` |
| Any encode on that worker afterwards, palette off | Worker replies `{ok:false, error:"Unknown message type: APPLY"}` → main thread reads `undefined.buffer` |

Three independent defects, all in the palette path:

1. **Quantizer WASM is unreachable in the production bundle.** The `@squoosh-kit/imagequant` wrapper is bundled into `/assets/index.browser-*.js` and resolves its glue relative to that chunk (`/assets/wasm/…`, then `/wasm/…`). The files are actually deployed at `/squoosh-kit/imagequant/wasm/imagequant/`. Dev works only because the wrapper is served unbundled from `node_modules`.
2. **The wrapper hijacks the codec worker's message channel.** On its first `quantize()` call it assigns `self.onmessage`, which answers every later Comlink request with a malformed reply. Comlink resolves the call with `undefined`. This is why the app "stops working", and why AVIF (and every other codec) appears broken after the palette switch was touched. The same hazard was already found and fixed for `@squoosh-kit/visdif` in `metrics.worker.ts`; it was never ported to the codec worker.
3. **Out-of-range `numColors`.** The Colors slider allows `1`, libimagequant accepts 2–256, so the job throws `RangeError: numColors must be in the range 2-256, got 1`. Separately, the global `setDithering` action writes its value into the `colors` key, which also produces `colors: 1` (or a fraction).

AVIF itself is not broken: it encodes correctly in production (including from an SVG source) until a palette job has poisoned the worker.

## What Changes

- Load the libimagequant module in-thread in the codec worker from its deployed same-origin location, without the squoosh-kit wrapper, so it works identically in dev and in the production build and never touches the worker's message channel.
- Clamp palette parameters before quantizing (`numColors` to an integer 2–256, `dither` to 0–1); raise the Colors slider minimum to 2; fix `setDithering` to write the `dithering` key.
- Make the worker pool reject a job whose reply is not a well-formed encode result, so a bad reply becomes a normal per-file error instead of a `TypeError` in the hook (and, in batch optimize, instead of an aborted batch).
- Stop labelling every failure inside the AVIF branch as "AVIF not supported in this browser"; that label hid the real cause here.
- Add regression coverage: palette on → encode succeeds; palette on then off → later encodes still succeed; SVG source → PNG/JPEG/AVIF with palette on; a build check that the quantizer assets ship at the path the worker loads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `color-quantize`: palette parameters are clamped to the valid range; the WASM loading requirement changes from "squoosh-kit `client` mode" to "in-thread, loadable from the production build, no interference with the worker's message channel"; a failed quantize must not affect later jobs.
- `worker-pool`: a malformed worker reply must reject that job only.

## Impact

- **Code**: `src/workers/codec.worker.ts` (quantizer loader, clamp, AVIF error label), `src/lib/worker-pool.ts` (reply guard), `src/stores/settings.ts` (`setDithering` key), `src/components/panels/inspector/CodecPanel.tsx` (slider `min`), `src/tests/` (new e2e + bundle check).
- **Dependencies**: none added or removed. `@squoosh-kit/imagequant` stays as the source of the WASM binary and glue; only its JS wrapper stops being imported. `@squoosh-kit/vite-plugin` keeps copying the assets to `public/squoosh-kit/`.
- **Bundle**: the wrapper chunk (`index.browser-*.js`, ~13 KB) leaves the worker graph. Initial route unaffected.
- **Privacy / hosting**: unchanged. Assets stay same-origin under `/squoosh-kit/`, already covered by the COOP/COEP `_headers` rule and the service worker's CacheFirst route.
- **Out of scope**: the `color-quantize` spec says quantization is PNG-only and has three palette modes, while the shipped code applies it to every raster codec behind a single switch. This change does not alter that behavior either way (see design.md, Open Questions). The svgo "not part of preset-default" console warnings are also untouched.
