// Phase 11 Plan 00 — Wave 0 dependency-pin assertion.
// Asserts the CLAUDE.md-locked Phase 11 stack is present at the correct semver:
//   - dependencies.jszip            ~ ^3.10
//   - dependencies['file-saver']    ~ ^2.0
//   - devDependencies['@types/file-saver'] ~ ^2.0
// Run: node --experimental-strip-types src/tests/deps.test.ts
// Harness mirrors src/tests/format.test.ts (passed/failed counters, process.exit on red).

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

let passed = 0
let failed = 0
function assert(name: string, cond: boolean): void {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  // Resolve package.json relative to this file (src/tests/deps.test.ts → ../../package.json)
  const here = dirname(fileURLToPath(import.meta.url))
  const pkgPath = resolve(here, '../../package.json')
  const raw = await readFile(pkgPath, 'utf8')
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  const deps = pkg.dependencies ?? {}
  const devDeps = pkg.devDependencies ?? {}

  const jszip = deps['jszip']
  const fileSaver = deps['file-saver']
  const typesFileSaver = devDeps['@types/file-saver']

  assert('dependencies.jszip is pinned to ^3.10', typeof jszip === 'string' && jszip.startsWith('^3.10'))
  assert("dependencies['file-saver'] is pinned to ^2.0", typeof fileSaver === 'string' && fileSaver.startsWith('^2.0'))
  assert("devDependencies['@types/file-saver'] is pinned to ^2.0", typeof typesFileSaver === 'string' && typesFileSaver.startsWith('^2.0'))
} catch (err) {
  failed++
  console.error('Unexpected error:', err)
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
