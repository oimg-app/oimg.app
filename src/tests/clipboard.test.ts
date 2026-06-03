// Phase 12 — D-14/D-15 clipboard chokepoint unit test
// Run: node --experimental-strip-types src/tests/clipboard.test.ts
//
// Pattern: matches Phase 6 src/tests/snippets.test.ts shape (let passed; let failed;
// assert). No vitest — pure node --experimental-strip-types runner.
//
// Coverage: native-path happy path only. Toast emission is verified in the e2e
// specs (Plans 03/04/05); this unit asserts the navigator wiring and method tag.

let passed = 0
let failed = 0

function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

;(async () => {
  // Stub globals BEFORE importing the module under test.
  // Node 22+ exposes `navigator` as a read-only getter on globalThis, so we must
  // redefine it via Object.defineProperty rather than direct assignment.
  const writes: string[] = []
  function defineGlobal(name: string, value: unknown): void {
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
    })
  }

  defineGlobal('window', globalThis)
  defineGlobal('isSecureContext', true)
  ;(globalThis as unknown as { window: { isSecureContext: boolean } }).window.isSecureContext = true
  defineGlobal('navigator', {
    clipboard: {
      writeText: async (t: string) => { writes.push(t) },
    },
  })
  // Document stub — sonner runs __insertCSS at module-load and calls
  // document.getElementsByTagName('head'); also touches createElement('style').
  // Provide enough surface to absorb both side effects.
  const headStub = {
    appendChild() {},
  }
  defineGlobal('document', {
    createElement: (tag?: string) => {
      if (tag === 'style') {
        return { textContent: '', setAttribute() {}, appendChild() {} }
      }
      return {
        value: '',
        setAttribute() {},
        style: {} as Record<string, string>,
        select() {},
      }
    },
    getElementsByTagName: (name: string) => (name === 'head' ? [headStub] : []),
    createTextNode: (data: string) => ({ data, nodeValue: data }),
    head: headStub,
    body: {
      appendChild() {},
      removeChild() {},
    },
    execCommand: () => true,
  })

  let copyToClipboard: ((text: string, kind: string, label: string) => Promise<{ ok: boolean; method: string }>) | undefined
  try {
    const mod = await import('../lib/clipboard.ts')
    copyToClipboard = mod.copyToClipboard as typeof copyToClipboard
  } catch (err) {
    console.error('IMPORT_FAILED:', err)
    process.exit(1)
  }

  assert('copyToClipboard is exported as a function', typeof copyToClipboard === 'function')

  const result = await copyToClipboard!('hello', 'snippet', 'Base64').catch(() => null)

  assert('copyToClipboard returns a result object', result !== null)
  assert('native path resolves ok=true', result?.ok === true)
  assert('native path method=native', result?.method === 'native')
  assert('native path wrote "hello"', writes[0] === 'hello')

  console.log(`${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})()
