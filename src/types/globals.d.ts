// Phase 13 — Wave 0 (DIA-01): ambient declarations for Vite `define` injected globals.
// These are inlined as literal expressions at build time per vite.config.ts.
// Consumed via the typed wrapper at src/lib/versions.ts — components/stores read
// BUILD_VERSIONS, NOT these raw globals directly.
// Tests and non-Vite runtimes (Node `--experimental-strip-types` unit tests) must
// safe-fallback via `typeof X === 'string'` checks — see src/lib/versions.ts.
// Analog: src/vite-env.d.ts (single-purpose ambient `.d.ts`, zero-runtime).

declare const __SVGO_VERSION__: string
declare const __JSQUASH_VERSIONS__: {
  webp: string
  jpeg: string
  avif: string
  oxipng: string
  png: string
  resize: string
}
// Phase 16/17 — append:
// declare const __SSIM_VERSION__: string
// declare const __BUTTERAUGLI_BUILD__: string
