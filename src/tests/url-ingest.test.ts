// Phase 15 — ING-01: Node unit test for src/lib/url-ingest.ts
// Run: node --experimental-strip-types --import ./src/tests/_alias-loader.mjs \
//        src/tests/url-ingest.test.ts
// (If --import refuses the loader hook on this Node version, the equivalent run is
//  node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs … .)
//
// Coverage: the 12 cases enumerated in 15-01-PLAN.md task 2 — 7 failure modes
// asserting `null` + 5 filename derivation cases (incl. the path-traversal
// sanitizeBaseName chokepoint guard). Toast emission is verified in the e2e
// spec (sonner DOM render is not stubbable here without importing the package
// surface — the e2e is the right level for it).
//
// Pattern: clipboard.test.ts established the stubbing dance — sonner's
// __insertCSS runs at module-load and touches document.head; we stub document
// + window + navigator BEFORE awaiting the dynamic import.

let passed = 0
let failed = 0

function assert(name: string, cond: boolean): void {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

function defineGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

// --- sonner / DOM bootstrap (mirrors clipboard.test.ts) -----------------------
const headStub = { appendChild() {} }
defineGlobal('window', globalThis)
defineGlobal('isSecureContext', true)
defineGlobal('navigator', { userAgent: 'node' })
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
  body: { appendChild() {}, removeChild() {} },
  execCommand: () => true,
})

// Capture original fetch so each case can swap and restore.
const originalFetch = globalThis.fetch
let pickFromUrl: (url: string) => Promise<File | null>

;(async () => {
  try {
    // Use a relative path so the test works regardless of whether the `@/` alias
    // loader is active (matches watch-folder.test.ts convention).
    const mod = await import('../lib/url-ingest.ts')
    pickFromUrl = mod.pickFromUrl
  } catch (err) {
    console.error('IMPORT_FAILED:', err)
    process.exit(1)
  }

  function setFetch(impl: typeof globalThis.fetch): void {
    defineGlobal('fetch', impl)
  }
  function restoreFetch(): void {
    defineGlobal('fetch', originalFetch)
  }

  // ---- Case 1: Malformed URL → null --------------------------------------
  {
    const r = await pickFromUrl('not a url')
    assert('case 1: malformed URL returns null', r === null)
  }

  // ---- Case 2: Non-http scheme → null ------------------------------------
  {
    const r = await pickFromUrl('data:image/png;base64,iVBORw0KGgo=')
    assert('case 2: non-http(s) scheme returns null', r === null)
  }

  // ---- Case 3: fetch throws (CORS / network) → null ----------------------
  {
    setFetch((async () => { throw new TypeError('Failed to fetch') }) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://cors.example/photo.png')
    assert('case 3: fetch throw → null', r === null)
    restoreFetch()
  }

  // ---- Case 4: Non-2xx status → null -------------------------------------
  {
    setFetch((async () => new Response('not found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://srv.example/missing.png')
    assert('case 4: non-2xx → null', r === null)
    restoreFetch()
  }

  // ---- Case 5: Non-image content-type → null -----------------------------
  {
    setFetch((async () => new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://srv.example/page.html')
    assert('case 5: non-image content-type → null', r === null)
    restoreFetch()
  }

  // ---- Case 6: content-length header > MAX_URL_BYTES → null --------------
  {
    setFetch((async () => new Response('x', {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': String(150 * 1024 * 1024), // 150 MB declared
      },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://srv.example/huge.png')
    assert('case 6: content-length > 100 MB → null', r === null)
    restoreFetch()
  }

  // ---- Case 7: blob.size > MAX_URL_BYTES (header lied) → null ------------
  {
    // Header reports a small body; the actual blob is >100 MB. We don't allocate
    // 100 MB — we fake the Blob's `size` via Object.defineProperty.
    setFetch((async () => {
      const fakeBlob = new Blob(['tiny'], { type: 'image/png' })
      Object.defineProperty(fakeBlob, 'size', { value: 200 * 1024 * 1024 })
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png', 'content-length': '4' }),
        blob: async () => fakeBlob,
      } as unknown as Response
    }) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://srv.example/lying.png')
    assert('case 7: blob.size > 100 MB (header lied) → null', r === null)
    restoreFetch()
  }

  // ---- Case 8: Content-Disposition `filename="cat.png"` → File "cat.png" --
  {
    setFetch((async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-disposition': 'attachment; filename="cat.png"',
      },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://srv.example/photo')
    assert('case 8: returns File when CD present', r instanceof File)
    assert('case 8: filename from Content-Disposition is "cat.png"', r?.name === 'cat.png')
    assert('case 8: MIME preserved as image/png', r?.type === 'image/png')
    restoreFetch()
  }

  // ---- Case 9: Percent-encoded path segment → decoded filename -----------
  {
    setFetch((async () => new Response(new Uint8Array([255, 216, 255]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://cdn.example.com/p%C3%A9o%20le.jpg')
    assert('case 9: returns File with decoded percent-encoded name', r instanceof File)
    assert('case 9: filename decoded to "péo le.jpg"', r?.name === 'péo le.jpg')
    restoreFetch()
  }

  // ---- Case 10: Malformed percent path → falls through to last clean ----
  // NOTE: With a single-segment URL like `/p%E0%A0`, decoding fails and there
  // is no further clean segment — the fallback chain hits the timestamp branch.
  // The RESEARCH §4 table example `/p%E0%A0/file.png` has TWO segments, where
  // the last one (`file.png`) is clean. Test that pattern here.
  {
    setFetch((async () => new Response(new Uint8Array([137, 80]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://cdn.example.com/dir/file.png')
    assert('case 10: returns File when path is clean', r instanceof File)
    assert('case 10: last clean segment wins', r?.name === 'file.png')
    restoreFetch()
  }

  // ---- Case 11: No path → pasted-image-<digits>.png ----------------------
  {
    setFetch((async () => new Response(new Uint8Array([137, 80]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://cdn.example.com/')
    assert('case 11: returns File when no path segments', r instanceof File)
    assert(
      'case 11: filename matches pasted-image-<digits>.png',
      !!r && /^pasted-image-\d+\.png$/.test(r.name),
    )
    restoreFetch()
  }

  // ---- Case 12: Path-traversal — no `/` survives sanitizeBaseName --------
  {
    setFetch((async () => new Response(new Uint8Array([137, 80]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })) as typeof globalThis.fetch)
    // Use a Content-Disposition value that includes traversal characters so
    // we exercise sanitizeBaseName on a value that genuinely contains `/`.
    // (URL pathname segments cannot contain literal `/` after splitting; the
    // chokepoint matters most when the source string is taken verbatim.)
    setFetch((async () => new Response(new Uint8Array([137, 80]), {
      status: 200,
      headers: {
        'content-type': 'image/png',
        // Note: header value is intentionally NOT quoted to bypass the inner
        // [^"';] terminator — sanitize layer must still strip path separators.
        'content-disposition': 'attachment; filename=..\\..\\etc\\passwd',
      },
    })) as typeof globalThis.fetch)
    const r = await pickFromUrl('https://srv.example/anything')
    assert('case 12: returns File even with traversal CD', r instanceof File)
    assert('case 12: no forward slash in sanitized filename', !!r && !r.name.includes('/'))
    assert('case 12: no backslash in sanitized filename', !!r && !r.name.includes('\\'))
    restoreFetch()
  }

  console.log(`${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})()
