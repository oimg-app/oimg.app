/**
 * SVG Adapter — Phase 3 (Plan 03-A)
 * Source: 03-RESEARCH.md §Pattern 1 (SVGO v4 browser ESM) — verified against
 * svgo@4.0.1 plugins/preset-default.js (34 plugins, no removeViewBox/Dimensions).
 *
 * Pipeline (worker side): ArrayBuffer → TextDecoder → SVGO optimize() →
 *   TextEncoder → ArrayBuffer.
 *
 * IMPORTANT: DOMPurify is NOT called here. Standard Web Workers lack `document`
 * and DOMPurify checks `window.document.nodeType` at module init (purify.ts
 * lines 132-138, verified empirically by Plan A's no-document probe →
 * isSupported=false, sanitize=undefined). Sanitization runs on the main thread
 * in src/lib/sanitize-svg.ts, called from the pool onDone callback in App.tsx
 * via useFilesStore.markDone. D-01 is still satisfied: DOMPurify runs
 * post-SVGO before bytes reach preview / snippet / ZIP.
 *
 * D-07 plugin handling:
 *   - Plugins IN preset-default → enabled by default; user toggle to off ⇒
 *     emit `overrides[id] = false` to disable selectively.
 *   - Plugins NOT in preset-default (removeViewBox, removeDimensions) →
 *     disabled by default; user toggle to on ⇒ append the plugin id to the
 *     plugins array.
 */
import { optimize } from 'svgo/browser'
import type { AdapterMeta } from './types'
import { AdapterError } from './types'
import type { CodecSettingsSvg } from '../types/index'
// buildSvgoConfig was extracted to svg-config.ts (Plan 03-D) so the unit
// tests can import it without evaluating the `svgo/browser` package — that
// path only resolves inside the Vite browser bundle, not under Node's
// --experimental-strip-types runner. Re-exported here so callers that
// historically imported buildSvgoConfig from svg-adapter (App.tsx D-06
// live-savings benchmark) keep working without churn.
import { buildSvgoConfig } from './svg-config.ts'
export { buildSvgoConfig }

export async function run(
  input: ArrayBuffer,
  settings: unknown,
): Promise<{ output: ArrayBuffer; meta: AdapterMeta }> {
  const svgString = new TextDecoder().decode(input)

  let optimized: string
  try {
    // SVGO v4 optimize() is synchronous and returns { data: string }; it
    // throws on malformed SVG (Pitfall 4 in 03-RESEARCH.md). Wrap in try/catch
    // and rethrow as AdapterError(format, 'process', message) per Phase 2 D-04.
    const result = optimize(svgString, buildSvgoConfig(settings as CodecSettingsSvg))
    optimized = result.data
  } catch (err) {
    throw new AdapterError('svg', 'process', err instanceof Error ? err.message : String(err))
  }

  // TextEncoder.encode().buffer is the underlying ArrayBuffer — Comlink can
  // transfer it zero-copy back to main thread (worker.ts wraps with
  // Comlink.transfer()).
  const encoded = new TextEncoder().encode(optimized)
  // Defensive copy: the encoded Uint8Array's buffer may be larger than
  // byteLength (over-allocated). slice() returns a fresh ArrayBuffer sized
  // exactly to the output bytes — safe for Comlink.transfer.
  const output = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)

  return {
    output,
    meta: {
      // unchanged is best-effort: equal byte length doesn't guarantee identical
      // content, but this is enough signal for the file-row "no savings"
      // indicator. sanitizedCount is NOT set here — DOMPurify runs on the
      // main thread (D-01).
      unchanged: output.byteLength === input.byteLength,
      codecVersion: 'svgo@4',
    },
  }
}
