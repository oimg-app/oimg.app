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
// WR-06: detect the case where a double-quoted attribute value contains
// a literal apostrophe — yoksel's blanket `"` → `'` swap would close
// the attribute prematurely there. Walk every `="..."` attribute and
// check the inside.
function hasApostropheInDoubleQuotedAttr(svgString: string): boolean {
  const dqAttr = /="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = dqAttr.exec(svgString)) !== null) {
    if (match[1].includes("'")) return true
  }
  return false
}

export function encodeSvgForDataUri(svgString: string): string {
  // WR-06: detect apostrophe-in-double-quoted-attr conflict up-front.
  // Note: `%22` substitution must happen AFTER the symbols-regex pass
  // because the symbols regex includes `%` and would re-encode the `%`
  // of `%22` to `%25` (double-encoding). Use a placeholder during the
  // symbols pass and substitute at the end.
  const useFallback = hasApostropheInDoubleQuotedAttr(svgString)
  let data = useFallback
    ? svgString // leave " literal — encoded below in the final pass
    : svgString.replace(/"/g, "'")
  data = data.replace(/>\s{1,}</g, '><')            // collapse whitespace between tags
  data = data.replace(/\s{2,}/g, ' ')               // collapse runs of whitespace
  data = data.replace(symbols, encodeURIComponent)  // encode only the problematic chars
  // Final pass: in the fallback path, encode the remaining literal `"`
  // as `%22` (the symbols regex did not touch them). Order matters —
  // doing this BEFORE the symbols pass would double-encode `%`.
  if (useFallback) data = data.replace(/"/g, '%22')
  return data
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
