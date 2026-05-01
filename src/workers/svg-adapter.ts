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

// Plugins shipped enabled in SVGO v4 preset-default (subset of the 34-plugin
// preset that the curated 12-plugin UI surfaces). Enabling/disabling is done
// via `params.overrides[id] = false`, NOT by removing them from the plugins
// array, because preset-default is one composite plugin entry.
const PRESET_DEFAULT_PLUGINS = new Set([
  'removeComments',
  'removeMetadata',
  'removeUselessDefs',
  'removeUnusedNS',
  'cleanupIds',
  'cleanupNumericValues',
  'convertColors',
  'convertPathData',
  'mergePaths',
  'minifyStyles',
])

// Plugins NOT in preset-default (D-07 opt-in extras with foot-gun warnings).
// Included in the plugins array only when the user explicitly enables them.
const EXTRA_PLUGINS = new Set(['removeViewBox', 'removeDimensions'])

/**
 * Build the SVGO v4 config payload from the user-facing CodecSettingsSvg.
 * Exported for unit testing (src/tests/svg-adapter.unit.ts) and for Plan B's
 * D-06 N+1-pass live-savings benchmark.
 *
 * Returns `Parameters<typeof optimize>[1]` (i.e. `Config | undefined`) — the
 * exported type. SVGO's `PluginConfig` union accepts both bare plugin-name
 * strings (typed as `keyof BuiltinsWithOptionalParams`) and `{ name, params }`
 * objects. We type the extras array as the loose union and rely on SVGO's
 * runtime resolution to validate the names.
 */
export function buildSvgoConfig(settings: CodecSettingsSvg): Parameters<typeof optimize>[1] {
  const overrides: Record<string, boolean> = {}
  // The extra plugin names are validated against EXTRA_PLUGINS at build time;
  // SVGO accepts the bare-string form. Type as the SVGO PluginConfig union.
  type PluginConfig = NonNullable<Parameters<typeof optimize>[1]>['plugins'] extends
    (infer U)[] | undefined
    ? U
    : never
  const extraPlugins: PluginConfig[] = []

  for (const [id, enabled] of Object.entries(settings.plugins)) {
    if (PRESET_DEFAULT_PLUGINS.has(id)) {
      if (!enabled) overrides[id] = false
    } else if (EXTRA_PLUGINS.has(id)) {
      if (enabled) extraPlugins.push(id as PluginConfig)
    }
  }

  return {
    plugins: [
      { name: 'preset-default', params: { overrides } },
      ...extraPlugins,
    ],
  }
}

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
