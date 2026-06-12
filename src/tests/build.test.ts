// PERF-04 / PIPE-02: Initial route JS must be < 200 KB gzipped.
// Run: npm run test:bundle  (runs `node --experimental-strip-types src/tests/build.test.ts`)
// Exits 0 if budget is met, 1 if exceeded.
//
// Phase 15 — Rule 3 auto-fix: restored after the 87a8ab2 "reinit foundation"
// commit deleted this file but left package.json's test:bundle script pointing
// at it. The script is the canonical phase-gate per CLAUDE.md PIPE-02.
// Recovered verbatim from git history d0859c2 (`test(01-02): scaffold ARIA
// landmark spec and bundle size test`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distDir = resolve(__dirname, '../../dist')
const distAssetsDir = resolve(distDir, 'assets')

// Initial route = the entry chunk(s) directly referenced by dist/index.html
// (every script[src] AND every modulepreload link[href]). Lazy-loaded codec
// chunks (jSquash WASM glue, svgo.browser, libheif-bundle, register-sw,
// workbox) are EXCLUDED from the budget — only the synchronous critical path
// counts against the 200 KB ceiling per PIPE-02.
//
// Phase 15 — Rule 3 auto-fix refinement: the prior naïve "sum every *.js"
// implementation conflated all code-split chunks with the initial route and
// produced false-over-budget readings. This implementation extracts the
// HTML-referenced entry chunks (the only ones that block first paint).
let html: string
try {
  html = readFileSync(resolve(distDir, 'index.html'), 'utf8')
} catch {
  console.warn('[bundle-size] dist/index.html not found — run npm run build first. Skipping.')
  process.exit(0)
}

// <script type="module" src="/assets/index-XXXX.js"> AND
// <link rel="modulepreload" href="/assets/index-YYYY.js">
const entryRefs = new Set<string>()
const scriptSrcRe = /<script[^>]+src="\/assets\/([^"]+\.js)"/g
const preloadHrefRe = /<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g
for (const m of html.matchAll(scriptSrcRe)) entryRefs.add(m[1])
for (const m of html.matchAll(preloadHrefRe)) entryRefs.add(m[1])

if (entryRefs.size === 0) {
  console.error('[bundle-size] No entry JS chunk found in dist/index.html — aborting.')
  process.exit(1)
}

const jsFiles = Array.from(entryRefs)
let totalGzipBytes = 0
for (const file of jsFiles) {
  const filePath = resolve(distAssetsDir, file)
  // spawnSync avoids shell injection: args are hardcoded paths, not user input
  const result = spawnSync('gzip', ['-c', filePath], { maxBuffer: 50 * 1024 * 1024 })
  if (result.status === 0 && result.stdout) {
    totalGzipBytes += (result.stdout as Buffer).length
  }
}
console.log(`[bundle-size] Initial route JS chunks: ${jsFiles.join(', ')}`)

const totalKB = totalGzipBytes / 1024
const BUDGET_KB = 200

console.log(
  `[bundle-size] Initial JS gzip total: ${totalKB.toFixed(1)} KB (budget: ${BUDGET_KB} KB)`
)

if (totalKB >= BUDGET_KB) {
  console.error(`[bundle-size] OVER BUDGET: ${totalKB.toFixed(1)} KB >= ${BUDGET_KB} KB`)
  process.exit(1)
} else {
  console.log(`[bundle-size] PASS: ${totalKB.toFixed(1)} KB < ${BUDGET_KB} KB`)
  process.exit(0)
}
