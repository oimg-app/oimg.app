// Quick 260603-s2x — Node unit test for src/lib/dir-picker.ts
// Run: node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs \
//        src/tests/watch-folder.test.ts
//
// Three cases:
//   1. showDirectoryPicker missing → returns null + emits toast.
//   2. showDirectoryPicker rejects with AbortError → returns null SILENTLY (no toast).
//   3. showDirectoryPicker resolves → returns the mock handle (no toast).

let passed = 0
let failed = 0
function assert(name: string, cond: boolean): void {
  if (cond) { passed++ } else { failed++; console.error(`FAIL: ${name}`) }
}

// Minimal Window shim — pickDirectory checks `'showDirectoryPicker' in window`
// + `window.isSecureContext`, then awaits the picker.
interface FakeWindow {
  isSecureContext: boolean
  showDirectoryPicker?: (opts: { mode: string; startIn?: string }) => Promise<unknown>
}

// Shared toast capture — pushToast pushes onto runtimeAtom.toasts; we read counts.
async function readToasts(): Promise<unknown[]> {
  const { runtimeAtom } = await import('../stores/runtime.ts')
  return runtimeAtom.get().toasts
}

async function resetToasts(): Promise<void> {
  const { runtimeAtom } = await import('../stores/runtime.ts')
  runtimeAtom.setKey('toasts', [])
}

// Node's globalThis lacks DOMException in older runtimes; polyfill if missing
// (Node 18+ ships it; this is defensive).
if (typeof (globalThis as { DOMException?: unknown }).DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    constructor(message: string, name: string) {
      super(message)
      this.name = name
    }
  }
  ;(globalThis as { DOMException: unknown }).DOMException = DOMExceptionPolyfill
}

try {
  // Test 1: missing API → toast + null.
  ;(globalThis as { window?: FakeWindow }).window = {
    isSecureContext: true,
    // showDirectoryPicker intentionally absent
  }
  await resetToasts()
  const { pickDirectory } = await import('../lib/dir-picker.ts')
  const r1 = await pickDirectory()
  assert('Test 1: returns null when API missing', r1 === null)
  const toasts1 = await readToasts()
  assert('Test 1: emits exactly one toast on missing API', toasts1.length === 1)

  // Test 2: AbortError → null silently.
  await resetToasts()
  const abortErr = new (globalThis as { DOMException: new (m: string, n: string) => Error }).DOMException(
    'User cancelled',
    'AbortError',
  )
  ;(globalThis as { window: FakeWindow }).window = {
    isSecureContext: true,
    showDirectoryPicker: () => Promise.reject(abortErr),
  }
  const r2 = await pickDirectory()
  assert('Test 2: returns null on AbortError', r2 === null)
  const toasts2 = await readToasts()
  assert('Test 2: AbortError emits zero toasts (silent)', toasts2.length === 0)

  // Test 3: resolves → returns the handle.
  await resetToasts()
  const fakeHandle = { name: 'Pictures', kind: 'directory' as const } as unknown as FileSystemDirectoryHandle
  ;(globalThis as { window: FakeWindow }).window = {
    isSecureContext: true,
    showDirectoryPicker: () => Promise.resolve(fakeHandle),
  }
  const r3 = await pickDirectory()
  assert('Test 3: returns the mock handle', r3 === fakeHandle)
  const toasts3 = await readToasts()
  assert('Test 3: success path emits zero toasts', toasts3.length === 0)
} catch (err) {
  failed++
  console.error('Unexpected error:', err)
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
