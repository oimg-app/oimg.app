// Phase 2 test fixture — monkey-patches URL.createObjectURL / URL.revokeObjectURL
// with counters readable from the test runner via page.evaluate.
//
// Source: 02-RESEARCH.md VR-04 (line 730), Pitfall 3 (lines 558-563), 02-PATTERNS.md
// lines 380-391. Used by object-url.spec.ts.
//
// Loaded via `page.addInitScript({ path: '...' })` BEFORE app boots so the
// patch is in place by the time any component calls createObjectURL.
//
// IMPORTANT: this file runs as a page init script — it executes inside the
// browser page context, NOT inside Playwright's Node process. Therefore: no
// exports, no imports, just IIFE-style monkey-patching of the global URL
// object. Plan 02-04 deviation (Rule 3 — blocking issue): converted from .ts
// to .js because Playwright's addInitScript({ path }) injects raw file
// contents into a <script> tag and does NOT transpile TypeScript syntax —
// the original .ts version's type-cast expressions silently failed to parse,
// leaving __OIMG_URL_COUNTS__ undefined throughout the test.

(() => {
  const w = window
  w.__OIMG_URL_COUNTS__ = { created: 0, revoked: 0 }

  const origCreate = URL.createObjectURL.bind(URL)
  const origRevoke = URL.revokeObjectURL.bind(URL)

  URL.createObjectURL = function patchedCreateObjectURL(blob) {
    w.__OIMG_URL_COUNTS__.created += 1
    return origCreate(blob)
  }

  URL.revokeObjectURL = function patchedRevokeObjectURL(url) {
    w.__OIMG_URL_COUNTS__.revoked += 1
    return origRevoke(url)
  }
})()
