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
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
