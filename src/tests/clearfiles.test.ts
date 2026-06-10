// Phase 13 — CLR-01 / D-13: clearFiles() + $queueEmpty Node unit
// Asserts: clearFiles() drops entries + selectedId in one transaction (two atomic setKey calls),
// leaves filterQuery + sortBy untouched, and the store does NOT import from runtime/sonner (purity).
// Run: node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs \
//        src/tests/clearfiles.test.ts

import { readFile } from 'node:fs/promises'
import type { FileEntry, FileSettings } from '../lib/settings'

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

// Minimal FileSettings stub — fields not under test
const TEST_SETTINGS: FileSettings = {} as FileSettings

function mkEntry(id: string, name: string): FileEntry {
  return {
    id,
    name,
    type: 'image/png',
    orig: 1000,
    opt: 800,
    status: 'queued',
    target: 'webp',
    dim: '100x100',
    q: 75,
    createdAt: Date.now(),
    settings: TEST_SETTINGS,
  }
}

try {
  const mod = await import('../stores/files.ts')
  const { filesAtom, clearFiles, $queueEmpty } = mod

  function setSeed(entries: FileEntry[], selectedId: string | null, filterQuery = '', sortBy: 'queue order' | 'name' | 'file size' | 'savings %' | 'format' = 'queue order') {
    filesAtom.set({ entries, selectedId, filterQuery, sortBy })
  }

  // (1) seed 3 entries + selectedId='x'; clearFiles() empties entries + nulls selectedId
  setSeed([mkEntry('a', 'a.png'), mkEntry('b', 'b.png'), mkEntry('x', 'x.png')], 'x')
  clearFiles()
  assert('clearFiles() → entries.length === 0', filesAtom.get().entries.length === 0)
  assert('clearFiles() → selectedId === null', filesAtom.get().selectedId === null)

  // (2) seed empty → $queueEmpty === true
  setSeed([], null)
  assert('$queueEmpty.get() === true when entries empty', $queueEmpty.get() === true)

  // (3) seed 1 entry → $queueEmpty === false
  setSeed([mkEntry('a', 'a.png')], null)
  assert('$queueEmpty.get() === false when entries non-empty', $queueEmpty.get() === false)

  // (3b) after clearFiles() $queueEmpty flips back to true
  clearFiles()
  assert('$queueEmpty.get() === true after clearFiles()', $queueEmpty.get() === true)

  // (4) clearFiles() does NOT touch filterQuery or sortBy (proves no whole-state clobber)
  setSeed([mkEntry('a', 'a.png')], 'a', 'abc', 'name')
  clearFiles()
  assert('clearFiles() preserves filterQuery', filesAtom.get().filterQuery === 'abc')
  assert('clearFiles() preserves sortBy', filesAtom.get().sortBy === 'name')

  // (5) Import-shape purity check — the store file must NOT import from runtime/sonner
  const src = await readFile('src/stores/files.ts', 'utf-8')
  assert('files.ts does NOT import from @/stores/runtime', !src.includes("from '@/stores/runtime'"))
  assert('files.ts does NOT import from ./runtime', !src.includes("from './runtime'"))
  assert("files.ts does NOT import { toast } from 'sonner'", !src.includes("from 'sonner'"))
  assert('files.ts does NOT import pushToast', !src.includes('pushToast'))
} catch (err) {
  failed++
  console.error('FAIL: import or test setup threw:', err)
}

console.log(`clearfiles.test: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
