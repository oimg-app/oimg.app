import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import squooshVitePlugin from '@squoosh-kit/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

// @squoosh-kit/imagequant's client-mode loader fetches WASM via
// `./wasm/imagequant/imagequant.wasm` relative to the served index.browser.mjs URL —
// which resolves to /node_modules/@squoosh-kit/imagequant/dist/wasm/imagequant/imagequant.wasm.
// Vite's dev server SPA fallback returns index.html for that path, so the wasm binary
// arrives as HTML and WebAssembly.instantiate() fails with "expected magic word ..., found 3c 21 64 6f".
// This tiny middleware serves any .wasm/.js file under a /node_modules/@squoosh-kit/*/dist path
// straight from disk with the correct MIME type.
function serveSquooshKitNodeModuleWasm(): Plugin {
  return {
    name: 'serve-squoosh-kit-node-module-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        const match = url.match(/^\/node_modules\/(@squoosh-kit\/[^/]+\/dist\/.+\.(?:wasm|js|mjs))(?:\?.*)?$/)
        if (!match) return next()
        const fullPath = path.resolve('node_modules', match[1])
        if (!fs.existsSync(fullPath)) return next()
        const body = fs.readFileSync(fullPath)
        const ct = fullPath.endsWith('.wasm')
          ? 'application/wasm'
          : 'application/javascript'
        res.setHeader('Content-Type', ct)
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Content-Length', body.length.toString())
        res.end(body)
      })
    },
  }
}

// Phase 13 — DIA-01 (D-01/D-02): build-time version injection.
// Security (T-13-02 mitigation): only reads `node_modules/<pkg>/package.json`
// version fields — never env vars and never filesystem paths.
// Versions are inlined as literal expressions into the bundle via Vite's
// `define` plugin (see below). Consumers read `BUILD_VERSIONS` from
// `src/lib/versions.ts` — NOT these raw globals.
function readVer(pkg: string): string {
  const pkgPath = path.resolve(`node_modules/${pkg}/package.json`)
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version as string
}

const VERSIONS = {
  svgo: readVer('svgo'),
  jsquash: {
    webp: readVer('@jsquash/webp'),
    jpeg: readVer('@jsquash/jpeg'),
    avif: readVer('@jsquash/avif'),
    oxipng: readVer('@jsquash/oxipng'),
    png: readVer('@jsquash/png'),
    resize: readVer('@jsquash/resize'),
  },
  // Phase 16 — append: ssim: readVer('ssim.js')
  // Phase 17 — append: butteraugli build hash (read from vendored artefact)
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    squooshVitePlugin(path.resolve('node_modules/@squoosh-kit')),
    serveSquooshKitNodeModuleWasm(),
    // Phase 14 — PWA-01: vite-plugin-pwa in injectManifest mode.
    // - manifest: false → hand-authored public/manifest.webmanifest (theme_color
    //   "#5eb87a" is PWA-01 verbatim, chosen over the RESEARCH alternative).
    // - devOptions.enabled: false → SW must NOT register in dev (breaks HMR +
    //   crossOriginIsolated for jSquash codecs).
    // - injectManifest.globIgnores: '**/*.wasm' is MANDATORY — AVIF wasm
    //   (~3.4 MB) must be runtime-cached, never precached.
    // - src/sw.ts is owned by Plan 14-02 (not yet present here).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: [
          '**/node_modules/**',
          '**/*.wasm',
          '**/codec.worker-*.js',
          '**/avif_enc*.wasm',
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Phase 2 plan 02-04 — workers MUST emit as ES modules so dynamic imports
  // (e.g. `import('./stub-adapter')` inside src/workers/worker.ts ADAPTERS map)
  // can be code-split. Default 'iife' format breaks code-splitting builds.
  // Pairs with `new Worker(new URL(...), { type: 'module' })` in pool.ts.
  worker: {
    format: 'es',
  },
  // Phase 3 plan 03-A — svgo + dompurify are large ESM packages with many
  // sub-modules. Without `optimizeDeps.include`, Vite serves them as raw ESM
  // in dev mode and the worker's first dynamic-import of svg-adapter stalls
  // for tens of seconds (svgo ships ~200 plugin source files). Pre-bundling
  // them collapses the import graph to a single chunk for both the main
  // thread and worker thread.
  // Serve .wasm files as binary assets — Vite must not try to bundle them.
  // Without this, @jsquash/* codec packages resolve their .wasm via
  // new URL("squoosh_png_bg.wasm", import.meta.url) inside the Vite dep
  // bundle, but the resulting URL (/node_modules/.vite/deps/squoosh_png_bg.wasm)
  // has no file on disk. Vite then serves the SPA HTML fallback, causing
  // "expected magic word 00 61 73 6d, found 3c 21 64 6f" errors in the worker.
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    include: ['svgo/browser', 'dompurify'],
    // Exclude jSquash codecs from dep bundling — they embed WASM via URL
    // resolution that breaks when esbuild flattens them into the dep bundle.
    // Serving them as raw ESM lets the browser fetch the WASM from its
    // original node_modules path where Vite can proxy it correctly.
    exclude: [
      '@jsquash/png', '@jsquash/jpeg', '@jsquash/webp',
      '@jsquash/avif', '@jsquash/oxipng', '@jsquash/resize',
      // Quick 260610-lby: heic-decode wraps libheif-js (WASM/asm.js) — same treatment as
      // @jsquash/* to prevent esbuild from flattening its WASM URL resolution.
      'heic-decode', 'libheif-js',
    ],
  },
  // Phase 13 — DIA-01: build-time version injection.
  // T-13-02 mitigation: ONLY `node_modules/<pkg>/package.json` version fields
  // are injected — NO env vars, NO filesystem paths. Each literal is
  // wrapped in `JSON.stringify(...)` per PATTERNS finding #3: bare values
  // inject as JS expressions (e.g. `4.0.1` → broken token), JSON-stringified
  // values inject as proper string/object literals.
  define: {
    __SVGO_VERSION__: JSON.stringify(VERSIONS.svgo),
    __JSQUASH_VERSIONS__: JSON.stringify(VERSIONS.jsquash),
    // Phase 16 — append: __SSIM_VERSION__: JSON.stringify(VERSIONS.ssim),
    // Phase 17 — append: __BUTTERAUGLI_BUILD__: JSON.stringify(VERSIONS.butteraugli),
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
