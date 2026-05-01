/**
 * Main-thread SVG sanitization helper — Phase 3 (Plan 03-A)
 * Source: 03-RESEARCH.md §Pattern 2 (DOMPurify SVG profile) — verified against
 * dompurify@3.4.2 src/purify.ts (USE_PROFILES.svg + svgFilters; removed[]
 * resets at start of each sanitize() call on line 1629).
 *
 * Why main thread:
 *   DOMPurify checks `window.document.nodeType` at module init (purify.ts
 *   lines 132-138). Standard Web Workers lack `document`, so DOMPurify
 *   reports `isSupported = false` and `sanitize` is undefined inside a
 *   worker (verified empirically by Plan A's no-document probe). Therefore
 *   the SVG adapter (worker) does SVGO only and this helper runs on the
 *   main thread, called from the pool onDone callback in App.tsx before
 *   useFilesStore.markDone writes the optimized blob.
 *
 * D-01 is still satisfied: DOMPurify runs post-SVGO before bytes reach
 * preview / snippet / ZIP — the ordering is logical (the pipeline) not
 * physical (which thread).
 *
 * D-02: USE_PROFILES: { svg: true, svgFilters: true } — battle-tested SVG
 * allow-list including filter elements (feGaussianBlur etc.).
 *
 * D-04: When `unsafe` is true, the helper skips DOMPurify and returns the
 * input verbatim with sanitizedCount = 0. Wired to
 * useSettingsStore.svg.unsafeExport (Plan B adds the SvgoPanel toggle).
 */
import DOMPurify from 'dompurify'

export interface SanitizeResult {
  clean: string
  sanitizedCount: number
}

export function sanitizeSvg(svgString: string, unsafe: boolean): SanitizeResult {
  if (unsafe) {
    return { clean: svgString, sanitizedCount: 0 }
  }
  // CRITICAL (Pitfall 5): DOMPurify.removed resets to [] at the start of
  // each sanitize() call (purify.ts line 1629), then is populated as the
  // sanitizer walks the DOM. Read .length immediately after the call on the
  // same synchronous tick — do NOT await or yield between sanitize() and
  // the .length read.
  const clean = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
  })
  const sanitizedCount = DOMPurify.removed.length
  return { clean, sanitizedCount }
}
