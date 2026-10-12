## 1. Regression tests first

- [x] 1.1 Add an e2e spec `src/tests/reduce-palette.spec.ts` (tag comments `// change:fix-reduce-palette-pipeline`) that ingests an SVG fixture, picks PNG, enables Reduce palette, and expects an encoded result; then disables Reduce palette and expects another encoded result. Verify it fails on current `main` with the "reading 'buffer'" error on the second encode.
- [x] 1.2 Extend the spec: with Reduce palette on, switch output to JPEG and then AVIF and expect an encoded result for each; drag Colors to its minimum and expect the readout `2` plus an encoded result. Verify the Colors-minimum case fails on current `main` with the `numColors` range error.
- [x] 1.3 Add a Node unit test `src/tests/palette-clamp.test.ts` for the clamp helper covering 1, 0, 300, 12.5, NaN, `'abc'` → values inside 2–256, and dither -1, 2, NaN → values inside 0–1. Verify it fails until 3.1 lands (helper missing).

## 2. Quantizer loading (color-quantize: In-thread quantizer loading)

- [x] 2.1 In `src/workers/codec.worker.ts`, replace `getQuantizer()`'s `import('@squoosh-kit/imagequant')` + `createImagequantQuantizer('client')` with a runtime-URL dynamic import of `squoosh-kit/imagequant/wasm/imagequant/imagequant.js` under `import.meta.env.BASE_URL`, calling the factory with an explicit `locateFile` for `imagequant.wasm` and caching the module (design D1). Keep the import inside the function (PIPE-02). Verify `grep -n "createImagequantQuantizer" src/` returns nothing.
- [x] 2.2 Copy the quantizer's returned pixels into a new `Uint8ClampedArray` before constructing the `ImageData`, and replace the stale wrapper comment block with a short note on why the wrapper is not used. Verify with `tsc -b` showing no new errors versus baseline in this file.
- [x] 2.3 Run the dev server, encode a PNG with Reduce palette on, and verify in the network panel that `imagequant.js` and `imagequant.wasm` load with 200 from `/squoosh-kit/imagequant/wasm/imagequant/` and that neither is requested while Reduce palette is off. If dev refuses the runtime import, switch to the documented fallback in design D1 and record that in the change.

## 3. Parameter range (color-quantize: `numColors` and `dither` parameters)

- [x] 3.1 Add the clamp helper next to the other worker clamps and use it in `maybeReduceColors` (design D2). Verify task 1.3's unit test passes.
- [x] 3.2 Change the Colors slider in `src/components/panels/inspector/CodecPanel.tsx` from `min={1}` to `min={2}`. Verify the Colors-minimum e2e case from 1.2 passes.
- [x] 3.3 Fix `setDithering` in `src/stores/settings.ts` to write the `dithering` key. Verify by calling `setDithering(0.5)` in a unit or e2e check and asserting `settingsAtom.get().colors` is unchanged and `dithering` is `0.5`.

## 4. Failure isolation (worker-pool: Malformed worker replies reject the job)

- [x] 4.1 In `src/lib/worker-pool.ts` `_drain`, reject the pending job with `Error('Invalid worker result')` when the reply has no `ArrayBuffer` `buffer`, and still release the worker (design D3). Verify with an e2e or unit check that stubs a worker reply of `undefined` and asserts the job rejects with that message and the pool's active count returns to 0.
- [x] 4.2 Change the AVIF branch's catch prefix in `codec.worker.ts` from "AVIF not supported in this browser" to "AVIF encode failed" (design D4), and update any test that asserts the old string. Verify `grep -rn "not supported in this browser" src/` shows only the HEIC message.

## 5. Build guard and end-to-end verification

- [x] 5.1 Extend the `npm run test:bundle` check to assert `dist/squoosh-kit/imagequant/wasm/imagequant/imagequant.js` and `imagequant.wasm` exist and that no `dist/assets/*.js` contains `createImagequantQuantizer`. Verify by running `npm run build && npm run test:bundle`.
- [x] 5.2 Run `npm test` and the Node unit tests; verify the specs from group 1 pass and the suite has no new failures against the pre-change baseline.
- [x] 5.3 Run `pnpm preview` (production build) and walk the reported path: import an SVG → PNG, JPEG, AVIF with Reduce palette on, then off, across enough files to touch all four workers. Verify every step produces an encoded result, the console has no `[maybeReduceColors]` errors, and no request goes to `/wasm/imagequant/` or `/assets/wasm/`.
- [ ] 5.4 After deploy, repeat 5.3's walk-through once on oimg.app and verify the same outcome.
