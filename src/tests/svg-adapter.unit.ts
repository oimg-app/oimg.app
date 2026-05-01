// Unit tests for buildSvgoConfig (svg-adapter.ts).
// Run: node --experimental-strip-types src/tests/svg-adapter.unit.ts
// Requires Node 22+ for --experimental-strip-types.
//
// Plan 03-D Wave 4: replaces the Wave 0 stub with live assertions on the
// preset-default override / extra-plugin contract documented in
// 03-RESEARCH.md §Critical Contradiction (removeViewBox + removeDimensions
// are NOT in SVGO v4 preset-default and must be opted in by appending
// the bare plugin id to the plugins array, NOT by an `overrides` entry).

// Imports the pure svg-config module (extracted from svg-adapter.ts in
// Plan 03-D) — svg-adapter itself eagerly evaluates `svgo/browser`, which
// only resolves inside the Vite browser bundle. The svg-config module is
// dependency-free so it strips and runs cleanly under Node 22+'s
// --experimental-strip-types runner.
import { buildSvgoConfig } from '../workers/svg-config.ts'

let passed = 0
let failed = 0
function assert(desc: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  PASS: ${desc}`)
    passed++
  } else {
    console.error(
      `  FAIL: ${desc}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    )
    failed++
  }
}
function assertDeep(desc: string, actual: unknown, check: (v: unknown) => boolean) {
  if (check(actual)) {
    console.log(`  PASS: ${desc}`)
    passed++
  } else {
    console.error(`  FAIL: ${desc}\n    actual: ${JSON.stringify(actual)}`)
    failed++
  }
}

const allOnSettings = {
  preset: 'default' as const,
  plugins: {
    removeComments: true,
    removeMetadata: true,
    removeUselessDefs: true,
    removeUnusedNS: true,
    cleanupIds: true,
    cleanupNumericValues: true,
    convertColors: true,
    convertPathData: true,
    mergePaths: true,
    minifyStyles: true,
    removeViewBox: false,
    removeDimensions: false,
  },
}

// Test 1: All preset-default plugins on (and the two extras off) →
// overrides is empty, plugins array contains exactly the preset-default entry.
{
  const config = buildSvgoConfig(allOnSettings)
  const presetPlugin = (config as any).plugins?.[0]
  assert(
    'all preset-default on → overrides is empty object',
    presetPlugin?.params?.overrides,
    {},
  )
  assertDeep(
    'all preset-default on → no extra plugins beyond preset-default',
    (config as any).plugins?.length,
    (n) => n === 1,
  )
}

// Test 2: Disable cleanupIds (preset-default plugin) → appears in overrides as false.
{
  const cfg = buildSvgoConfig({
    ...allOnSettings,
    plugins: { ...allOnSettings.plugins, cleanupIds: false },
  })
  assert(
    'cleanupIds off → overrides.cleanupIds === false',
    (cfg as any).plugins?.[0]?.params?.overrides?.cleanupIds,
    false,
  )
}

// Test 3: Enable removeViewBox (NOT in preset-default) → appears as extra plugin string.
{
  const cfg = buildSvgoConfig({
    ...allOnSettings,
    plugins: { ...allOnSettings.plugins, removeViewBox: true },
  })
  const extras = (cfg as any).plugins?.slice(1) ?? []
  assert(
    'removeViewBox on → extra plugin entry "removeViewBox"',
    extras.includes('removeViewBox'),
    true,
  )
}

// Test 4: Disable removeViewBox (NOT in preset-default) → does NOT appear as extra plugin
// (verifies RESEARCH §Critical Contradiction — extras default OFF).
{
  const cfg = buildSvgoConfig(allOnSettings) // removeViewBox: false
  const extras = (cfg as any).plugins?.slice(1) ?? []
  assert(
    'removeViewBox off → not in extra plugins',
    extras.includes('removeViewBox'),
    false,
  )
  // It also must NOT pollute overrides (extras don't go through the overrides path).
  const overrides = (cfg as any).plugins?.[0]?.params?.overrides ?? {}
  assert(
    'removeViewBox off → not in preset overrides',
    Object.prototype.hasOwnProperty.call(overrides, 'removeViewBox'),
    false,
  )
}

// Test 5: Enable removeDimensions → appears as extra plugin.
{
  const cfg = buildSvgoConfig({
    ...allOnSettings,
    plugins: { ...allOnSettings.plugins, removeDimensions: true },
  })
  const extras = (cfg as any).plugins?.slice(1) ?? []
  assert(
    'removeDimensions on → extra plugin entry "removeDimensions"',
    extras.includes('removeDimensions'),
    true,
  )
}

// Test 6: Multiple preset-default plugins off → all appear in overrides.
{
  const cfg = buildSvgoConfig({
    ...allOnSettings,
    plugins: {
      ...allOnSettings.plugins,
      cleanupIds: false,
      convertColors: false,
      mergePaths: false,
    },
  })
  const overrides = (cfg as any).plugins?.[0]?.params?.overrides
  assert('cleanupIds, convertColors, mergePaths all in overrides when off', overrides, {
    cleanupIds: false,
    convertColors: false,
    mergePaths: false,
  })
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
