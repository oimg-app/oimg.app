/**
 * SVGO config builder — extracted from svg-adapter.ts so the buildSvgoConfig
 * pure function can be unit-tested without pulling in the worker-only
 * `svgo/browser` import (which evaluates at module load and only resolves
 * inside Vite's browser bundle, not Node).
 *
 * Source: 03-RESEARCH.md §Pattern 1 (SVGO v4 browser ESM) — verified against
 * svgo@4.0.1 plugins/preset-default.js (34 plugins, no removeViewBox /
 * removeDimensions in the default).
 *
 * D-07 plugin handling:
 *   - Plugins IN preset-default → enabled by default; user toggle to off ⇒
 *     emit `overrides[id] = false` to disable selectively.
 *   - Plugins NOT in preset-default (removeViewBox, removeDimensions) →
 *     disabled by default; user toggle to on ⇒ append the plugin id to the
 *     plugins array.
 */
import type { CodecSettingsSvg } from '../types/index.ts'

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

// Loose, structural shape of the SVGO config — matches the runtime shape
// SVGO v4 accepts without forcing this module to import the browser bundle.
export interface SvgoConfigShape {
  plugins: Array<
    | string
    | {
        name: string
        params?: { overrides?: Record<string, boolean> }
      }
  >
}

/**
 * Build the SVGO v4 config payload from the user-facing CodecSettingsSvg.
 * Pure — no side effects, no SVGO import — so it round-trips cleanly through
 * Node's --experimental-strip-types unit-test runner.
 */
export function buildSvgoConfig(settings: CodecSettingsSvg): SvgoConfigShape {
  const overrides: Record<string, boolean> = {}
  const extraPlugins: string[] = []

  for (const [id, enabled] of Object.entries(settings.plugins)) {
    if (PRESET_DEFAULT_PLUGINS.has(id)) {
      if (!enabled) overrides[id] = false
    } else if (EXTRA_PLUGINS.has(id)) {
      if (enabled) extraPlugins.push(id)
    }
  }

  return {
    plugins: [{ name: 'preset-default', params: { overrides } }, ...extraPlugins],
  }
}
