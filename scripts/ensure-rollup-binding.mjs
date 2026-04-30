#!/usr/bin/env node
// Workaround for npm CLI bug #4828 + macOS Apple Silicon arch detection mismatch.
//
// Symptom: On Apple Silicon machines where `node` is a universal binary but
// npm's spawned child process runs under x86_64 (Rosetta), Vite/Rollup's
// native binding loader sees `process.arch === 'x64'` and tries to load
// `@rollup/rollup-darwin-x64`, which npm refuses to install on arm64 hosts
// (because of optionalDependencies CPU filtering).
//
// Fix: explicitly install both arm64 AND x64 bindings post-install. They are
// each ~5MB and only one is loaded at runtime per process.
//
// References:
//   - https://github.com/npm/cli/issues/4828
//   - .planning/phases/01-shell-foundation/deferred-items.md (phase 01 plan 04 fix)

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

if (process.platform !== 'darwin') {
  // Only macOS Apple Silicon needs this workaround.
  process.exit(0)
}

const xPath = join(repoRoot, 'node_modules', '@rollup', 'rollup-darwin-x64')
const aPath = join(repoRoot, 'node_modules', '@rollup', 'rollup-darwin-arm64')

const need = []
if (!existsSync(xPath)) need.push('@rollup/rollup-darwin-x64')
if (!existsSync(aPath)) need.push('@rollup/rollup-darwin-arm64')

if (need.length === 0) {
  process.exit(0)
}

console.log(`[ensure-rollup-binding] installing missing native bindings: ${need.join(', ')}`)
try {
  // Use execFileSync (no shell) — only literal binding package names are passed.
  execFileSync(
    'npm',
    ['install', '--no-save', '--ignore-scripts', '--cpu=x64', ...need],
    { cwd: repoRoot, stdio: 'inherit' },
  )
} catch (err) {
  console.error('[ensure-rollup-binding] failed to install bindings:', err.message)
  process.exit(1)
}
