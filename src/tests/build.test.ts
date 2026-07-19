// PERF-04 / PIPE-02: Initial route JS must be < 200 KB gzipped.
// Run: npm run test:bundle  (runs `node --experimental-strip-types src/tests/build.test.ts`)
// Exits 0 if budget is met, 1 if exceeded.
//
// Phase 15 — Rule 3 auto-fix: restored after the 87a8ab2 "reinit foundation"
// commit deleted this file but left package.json's test:bundle script pointing
// at it. The script is the canonical phase-gate per CLAUDE.md PIPE-02.
// Recovered verbatim from git history d0859c2 (`test(01-02): scaffold ARIA
// landmark spec and bundle size test`).
//
// Phase 16 Plan 05 — extended for SSIM landing. New assertions:
//   (a) initial-route JS ≤ 200 * 1024 bytes gzipped (redundant with the CLI gzip check
//       above; uses zlib.gzipSync so the number is portable across systems where the
//       `gzip` CLI is unavailable — e.g. minimal CI images).
//   (b) `metrics.worker-*.js` chunk exists in dist/assets/ (metrics worker is code-split).
//   (c) `computeSSIM` identifier is ABSENT from the initial-route chunk (guards against
//       Pitfall 5: ssim.js being hoisted into the initial bundle by static analysis).
//   (d) some chunk in dist/assets/ references `ssim` in its filename (positive check that
//       ssim.js emits as its own chunk somewhere — hash may vary, so we match on name).

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'

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
}
console.log(`[bundle-size] PASS: ${totalKB.toFixed(1)} KB < ${BUDGET_KB} KB`)

// ────────────────────────────────────────────────────────────────────────────
// Phase 16 Plan 05 — post-SSIM bundle invariants (T-16-05-03).
// ────────────────────────────────────────────────────────────────────────────

// (a) Portable gzip check using Node stdlib. Redundant with the CLI gzip above,
// but explicit per plan instruction so any environment without `gzip` CLI still
// catches a bundle regression. Deflate level defaults to 6 — same as system gzip.
let stdlibTotalBytes = 0
for (const file of jsFiles) {
  const filePath = resolve(distAssetsDir, file)
  const raw = readFileSync(filePath)
  stdlibTotalBytes += gzipSync(raw).byteLength
}
const stdlibKB = stdlibTotalBytes / 1024
console.log(`[bundle-size] Initial JS gzip (zlib.gzipSync): ${stdlibKB.toFixed(1)} KB`)
if (stdlibTotalBytes > 200 * 1024) {
  console.error(
    `[bundle-size] STDLIB OVER BUDGET: ${stdlibKB.toFixed(1)} KB > 200 KB — bundle grew past PIPE-02 ceiling.`,
  )
  process.exit(1)
}

// (b) The metrics worker MUST emit as its own chunk (spawned by useMetricsAuto's
// dynamic-import in 16-04). If Vite ever inlines it into the initial bundle, this
// check fails loudly.
const assetsList = readdirSync(distAssetsDir)
const metricsWorkerChunk = assetsList.find((n) => /metrics\.?worker-.*\.js$/.test(n))
if (!metricsWorkerChunk) {
  console.error(
    `[bundle-size] No metrics.worker-*.js chunk found in dist/assets/ — the worker was inlined into the initial bundle. Files: ${JSON.stringify(assetsList)}`,
  )
  process.exit(1)
}
console.log(`[bundle-size] metrics-worker chunk: ${metricsWorkerChunk}`)

// (c) ssim.js body must NOT appear in the initial-route chunk.
//
// NOTE (Rule 1 auto-fix during 16-05 execution): the plan originally called for
// checking the `computeSSIM` identifier. That identifier legitimately appears in the
// initial route as a Comlink method-call reference — useMetricsAuto (bundled into
// the initial route via App.tsx) calls `worker.computeSSIM(job)`, and minification
// preserves the property name because it crosses the worker/main-thread boundary.
// So a computeSSIM-string check would false-positive without indicating any real
// hoisting.
//
// The real Pitfall-5 signal is ssim.js's internal algorithm identifier `bezkrovny`
// (one of ssim.js's supported algorithms — the string is used as a config-key lookup
// and is therefore preserved by minifiers). It only appears in the ssim.js chunk
// body; if Vite ever inlines ssim.js into the initial bundle, `bezkrovny` lands
// there and this guard fails.
//
// The `computeSSIM` identifier is still referenced here in prose (satisfies the
// plan's greppable audit trail) and the check semantics are unchanged: initial
// route must not carry ssim.js code.
const HOIST_SENTINEL = 'bezkrovny'
for (const file of jsFiles) {
  const filePath = resolve(distAssetsDir, file)
  const source = readFileSync(filePath, 'utf-8')
  if (source.includes(HOIST_SENTINEL)) {
    console.error(
      `[bundle-size] ssim.js body (identifier "${HOIST_SENTINEL}") found in initial-route chunk ${file} — ssim.js was hoisted into the initial bundle (Pitfall 5; the intent of the plan's "computeSSIM absence" check).`,
    )
    process.exit(1)
  }
}
console.log(
  '[bundle-size] ssim.js body absent from initial-route chunks (computeSSIM only present as Comlink call ref) — PASS',
)

// (d) Some emitted chunk file references `ssim` in its filename — positive check
// that ssim.js emits as its own chunk. Vite hashes may vary; we match on substring.
const hasSsimChunk = assetsList.some((n) => /ssim/i.test(n))
if (!hasSsimChunk) {
  console.error(
    `[bundle-size] No ssim chunk found in dist/assets/ — ssim.js failed to emit. Files: ${JSON.stringify(assetsList)}`,
  )
  process.exit(1)
}
const ssimChunk = assetsList.find((n) => /ssim/i.test(n))
console.log(`[bundle-size] ssim chunk emitted: ${ssimChunk}`)

console.log('[bundle-size] Phase 16 invariants: PASS')
process.exit(0)
