import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
  optimizeDeps: {
    include: ['svgo/browser', 'dompurify'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
