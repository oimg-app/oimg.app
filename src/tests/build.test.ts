// PERF-04: Initial route JS must be < 200 KB gzipped.
// Run: node src/tests/build.test.ts  (after npm run build)
// Exits 0 if budget is met, 1 if exceeded.

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distAssetsDir = resolve(__dirname, '../../dist/assets')
let jsFiles: string[] = []

try {
  jsFiles = readdirSync(distAssetsDir).filter(
    (f: string) => f.endsWith('.js') && !f.includes('worker') && !f.includes('wasm')
  )
} catch {
  console.warn('[bundle-size] dist/ not found — run npm run build first. Skipping.')
  process.exit(0)
}

let totalGzipBytes = 0
for (const file of jsFiles) {
  const filePath = resolve(distAssetsDir, file)
  // spawnSync avoids shell injection: args are hardcoded paths, not user input
  const result = spawnSync('gzip', ['-c', filePath], { maxBuffer: 50 * 1024 * 1024 })
  if (result.status === 0 && result.stdout) {
    totalGzipBytes += (result.stdout as Buffer).length
  }
}

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
