// Phase 14 Plan 00 — Wave 0 Node unit test for PWA-01 manifest schema.
//
// Verifies that `public/manifest.webmanifest` (created in Plan 14-01) parses as
// valid JSON and carries the schema PWA-01 requires:
//   - name === "oimg.app — Image Optimizer"
//   - short_name === "oimg"
//   - display === "standalone"
//   - start_url present
//   - theme_color === "#5eb87a"  (matches index.html meta theme-color)
//   - icons[] contains an entry with purpose "maskable" referencing
//     oimg-logo-maskable-512.png (asset committed by this plan)
//   - name/short_name contain no "<" (no script injection at install time)
//
// Harness: mirrors src/tests/versions.test.ts — let passed/failed + assert +
//   process.exit. Run: node --experimental-strip-types src/tests/manifest.test.ts
//
// RED NOW: public/manifest.webmanifest does not yet exist; Plan 14-01 creates it.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = resolve(__dirname, '../../public/manifest.webmanifest')

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// ── Existence gate ──────────────────────────────────────────────────────────
// Plan 14-01 creates public/manifest.webmanifest. Until then this assert is
// RED — that is the Nyquist sampling target Wave 0 promises Waves 1/2.
assert('public/manifest.webmanifest exists', existsSync(MANIFEST_PATH))

if (!existsSync(MANIFEST_PATH)) {
  console.log(`${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

// ── Parse + schema ──────────────────────────────────────────────────────────
const raw = readFileSync(MANIFEST_PATH, 'utf8')
let m: Record<string, unknown> = {}
let parseOk = false
try {
  m = JSON.parse(raw) as Record<string, unknown>
  parseOk = true
} catch (err) {
  console.error(`FAIL: manifest.webmanifest is valid JSON — ${(err as Error).message}`)
  failed++
}
assert('manifest.webmanifest parses as JSON', parseOk)

// ── PWA-01 required fields ──────────────────────────────────────────────────
assert('name === "oimg.app — Image Optimizer"',
  m.name === 'oimg.app — Image Optimizer')
assert('short_name === "oimg"',
  m.short_name === 'oimg')
assert('display === "standalone"',
  m.display === 'standalone')
assert('start_url is a non-empty string',
  typeof m.start_url === 'string' && (m.start_url as string).length > 0)
assert('theme_color === "#5eb87a"',
  m.theme_color === '#5eb87a')

// ── Maskable icon presence ──────────────────────────────────────────────────
const icons = Array.isArray(m.icons) ? (m.icons as Array<Record<string, unknown>>) : []
const maskable = icons.find((ic) => {
  const purpose = typeof ic.purpose === 'string' ? ic.purpose : ''
  // purpose may be space-separated ("any maskable") — check token presence
  return purpose.split(/\s+/).includes('maskable')
})
assert('icons[] contains a purpose:"maskable" entry', !!maskable)
assert('maskable icon src references oimg-logo-maskable-512.png',
  !!maskable && typeof maskable.src === 'string'
    && (maskable.src as string).includes('oimg-logo-maskable-512.png'))

// ── Injection-resistance (no "<" tokens in user-facing strings) ─────────────
assert('name has no "<" token (no script injection)',
  typeof m.name === 'string' && !(m.name as string).includes('<'))
assert('short_name has no "<" token (no script injection)',
  typeof m.short_name === 'string' && !(m.short_name as string).includes('<'))

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
