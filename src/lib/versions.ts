// Phase 13 — DIA-01 (D-01/D-03): typed wrapper over Vite-injected version globals.
//
// Vite's `define` plugin (see vite.config.ts) inlines two globals into the
// bundle at build time: `__SVGO_VERSION__` (string) and `__JSQUASH_VERSIONS__`
// (object with six codec keys). Components, stores, and diagnostics surfaces
// read `BUILD_VERSIONS` from this module — NEVER the raw globals directly.
// That makes the Phase 16/17 SSIM + Butteraugli additions a single-file change.
//
// Safe-fallback rationale: outside Vite (Node `--experimental-strip-types`
// unit tests; VALIDATION.md Wave 0), the globals are `undefined` and a naked
// reference would throw a ReferenceError at module-init time. The
// `typeof X === 'string'` / `typeof X === 'object'` guards turn missing
// globals into a clean `'0.0.0'` fallback. The literal `'0.0.0'` is an
// invalid semver "unset" sentinel so test assertions can distinguish
// build-time-real-version from fallback unambiguously.
//
// Analog: `src/lib/save-blob.ts` — same "single module wraps an
// env-provided capability with TS types and a safe-fallback guard" pattern.

export type CodecKey = 'webp' | 'jpeg' | 'avif' | 'oxipng' | 'png' | 'resize'

export interface BuildVersions {
  svgo: string
  jsquash: Record<CodecKey, string>
  /** Phase 16 hook — populated when SSIM image-quality metric lands. */
  ssim?: string
  /** Phase 17 hook — populated when Butteraugli vendored build lands. */
  butteraugli?: { buildHash: string }
}

// Sentinel fallback used when the Vite-injected globals are absent
// (Node unit-test runtime). Build-time values always overwrite these.
const FALLBACK_JSQUASH: Record<CodecKey, string> = {
  webp: '0.0.0',
  jpeg: '0.0.0',
  avif: '0.0.0',
  oxipng: '0.0.0',
  png: '0.0.0',
  resize: '0.0.0',
}

export const BUILD_VERSIONS: BuildVersions = {
  svgo: typeof __SVGO_VERSION__ === 'string' ? __SVGO_VERSION__ : '0.0.0',
  jsquash:
    typeof __JSQUASH_VERSIONS__ === 'object' && __JSQUASH_VERSIONS__
      ? __JSQUASH_VERSIONS__
      : FALLBACK_JSQUASH,
  // ssim, butteraugli intentionally omitted — Phase 16/17 will populate.
}
