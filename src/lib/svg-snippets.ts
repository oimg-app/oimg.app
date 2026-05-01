/**
 * SVG snippet generators — Phase 3
 * Source: 03-RESEARCH.md §Pattern 3 (yoksel URL-encoder, D-15)
 * D-15: Mirror yoksel's minimal-escape strategy verbatim.
 * inspired/url-encoder/src/js/script.js lines 15 + 134-148
 */

// The symbols regex from yoksel (line 15 verbatim) — ONLY these characters are percent-encoded
const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g

/**
 * Ensures the SVG has an xmlns declaration (SVGO may strip it).
 * yoksel's addNameSpace() equivalent.
 */
export function ensureNamespace(svg: string): string {
  if (!svg.includes('http://www.w3.org/2000/svg')) {
    return svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'")
  }
  return svg
}

/**
 * URL-encodes an SVG string for use in CSS data URI.
 * Implements yoksel's minimal-escape: only encode characters that break URL/CSS contexts.
 * Full percent-encoding (encodeURIComponent on entire string) doubles the output size.
 *
 * D-15: " → ', whitespace collapsed, only symbols regex chars percent-encoded.
 * Spaces and UTF-8 characters (e.g. ★) are left as-is.
 */
export function encodeSvgForDataUri(svgString: string): string {
  let data = svgString.replace(/"/g, "'")          // " → ' (avoids encoding in CSS url("..."))
  data = data.replace(/>\s{1,}</g, '><')            // collapse whitespace between tags
  data = data.replace(/\s{2,}/g, ' ')               // collapse runs of whitespace
  return data.replace(symbols, encodeURIComponent)  // encode only the problematic chars
}

/**
 * Generates the inline SVG snippet (Section 1 of SnippetPanel).
 * Returns the sanitized SVG markup verbatim.
 * D-14: ID-collision handling deferred to Phase 6.
 */
export function generateInlineSvg(svgText: string): string {
  return ensureNamespace(svgText)
}

/**
 * Generates the CSS background-image data URI snippet (Section 2 of SnippetPanel).
 * Output: url("data:image/svg+xml,${encoded}")
 * D-15: yoksel minimal-escape encoding.
 */
export function generateDataUri(svgText: string): string {
  const withNamespace = ensureNamespace(svgText)
  const encoded = encodeSvgForDataUri(withNamespace)
  return `url("data:image/svg+xml,${encoded}")`
}
