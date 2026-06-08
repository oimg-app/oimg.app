import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import squooshVitePlugin from '@squoosh-kit/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    squooshVitePlugin(path.resolve('node_modules/@squoosh-kit'))
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
    ],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
