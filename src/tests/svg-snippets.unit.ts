// Unit tests for encodeSvgForDataUri and generateDataUri (yoksel, D-15)
// Run: node --experimental-strip-types src/tests/svg-snippets.unit.ts

import { encodeSvgForDataUri, ensureNamespace, generateDataUri } from '../lib/svg-snippets.ts'

let passed = 0; let failed = 0
function assert(desc: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`  PASS: ${desc}`)
    passed++
  } else {
    console.error(`  FAIL: ${desc}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

// yoksel test cases from RESEARCH.md §Pattern 3
assert('<svg> encodes < and >', encodeSvgForDataUri('<svg>'), '%3Csvg%3E')
assert('fill="#f00" — " → \', # → %23', encodeSvgForDataUri('fill="#f00"'), "fill='%23f00'")
assert('xmlns=... — colon left alone', encodeSvgForDataUri('xmlns="http://www.w3.org/2000/svg"'), "xmlns='http://www.w3.org/2000/svg'")
assert('UTF-8 star left unchanged', encodeSvgForDataUri('★'), '★')
assert('newline encoded', encodeSvgForDataUri('\n'), '%0A')

// generateDataUri wraps in url(...)
const uri = generateDataUri('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>')
assert('generateDataUri starts with url("data:image/svg+xml,', uri.startsWith('url("data:image/svg+xml,'), true)
assert('generateDataUri ends with ")', uri.endsWith('")'), true)
assert('generateDataUri: no unencoded <', !uri.includes('<'), true)
assert('generateDataUri: no unencoded "  (only outer url quotes)', uri.split('url("data:image/svg+xml,')[1].split('")')[0].includes('"'), false)

// ensureNamespace
assert('ensureNamespace: adds xmlns when missing', ensureNamespace('<svg>').includes('http://www.w3.org/2000/svg'), true)
assert('ensureNamespace: no-op when xmlns present', ensureNamespace('<svg xmlns="http://www.w3.org/2000/svg">'), '<svg xmlns="http://www.w3.org/2000/svg">')

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
