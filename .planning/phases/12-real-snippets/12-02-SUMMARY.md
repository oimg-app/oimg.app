---
phase: 12
plan: 02
subsystem: lib/snippets
tags: [phase-12, wave-1, snippet-builders, escapeAttr, buildDataUri, T-12-01, T-12-02]
requires:
  - Phase 11 src/lib/filename.ts — renameExtension (used in <source srcset>)
provides:
  - src/lib/snippets.ts — buildDataUri (SVG → URL-encoded; raster → chunked base64)
  - src/lib/snippets.ts — escapeAttr (HTML-attribute injection mitigation for alt/src/srcset)
  - src/lib/snippets.ts — buildBase64Snippet, buildUrlEncodedSnippet, buildPictureSnippet (D-01..D-04 shapes)
---

# Phase 12, Plan 02 — Snippet Builders Refactor

**Status:** Complete
**Date:** 2026-06-03
**Commits:**
- `e9d5e65` refactor(12-02): buildDataUri dispatcher + chunked base64 + escapeAttr + D-03 shape
- `de7e91a` test(12-02): cover D-01 dispatch + D-03 shape + D-04 dim-omit + T-12-02 attr-escape

## What Shipped

### `buildDataUri(file)` shared dispatcher (D-01, D-02)
- **SVG path** — `TextDecoder('utf-8').decode(encodedBuffer)` → strip control chars (`\x00-\x1f\x7f`) → Yoksel-style minimal URL-encoding: `encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')` then re-unescape `( ) ! ~ *` for readability. Returns `data:image/svg+xml;charset=utf-8,${encoded}`.
- **Raster path** — chunked base64 in literal `0x8000` (32KB) windows over the Uint8Array. Avoids V8 call-stack blowup at ~125KB (`String.fromCharCode(...new Uint8Array(huge))` would throw). Returns `data:${mimeFor(target)};base64,${b64}`.
- Throws `Error('NO_ENCODED_BUFFER')` when `encodedBuffer == null`.

### `escapeAttr(value)` HTML-attribute sanitiser (T-12-02 mitigation)
- Order-correct entity replacement: `&` → `&amp;` first, then `<`, `>`, `"`, `'`.
- Applied to every interpolation into `alt`, `src`, `srcset` inside `buildBase64Snippet` and `buildPictureSnippet`.
- Defends against filenames like `"><script>alert(1)</script>` breaking out of attribute context.

### Per-snippet builders (D-03, D-04)
- **`buildBase64Snippet`** — wraps `buildDataUri` in `<img src="…" alt="${escapeAttr(file.name)}"${widthAttr}${heightAttr}>`. width/height come from `parseDim(file.dim)` and are **omitted entirely** if empty (no `width=""`).
- **`buildUrlEncodedSnippet`** — wraps `buildDataUri` in `background-image: url("…");`. Fix for the pre-existing bug that always returned base64.
- **`buildPictureSnippet`** — branches per D-03/D-04:
  - `target === 'svg'` → bare `<img>` (no `<picture>` wrapper)
  - `target === file.type` (source format kept) → bare `<img>` (no `<picture>`, no `<source>`)
  - Else (raster target ≠ source) → `<picture>\n  <source srcset="…" type="image/${ext}">\n  <img src="…" alt="…" width="…" height="…">\n</picture>` — 2-space indent, **no `loading`/`decoding` attrs**.

## Threat Mitigations

| Threat | Severity | Surface | Mitigation |
|--------|----------|---------|------------|
| T-12-01 (SVG XSS via mistaken base64 path) | MEDIUM | `buildDataUri` SVG branch | SVG always routes through URL-encoded path; the base64 branch is never reached for `target === 'svg'`. Browsers do NOT execute scripts in URL-encoded SVG in CSS `url()` or `<img src>` contexts. |
| T-12-02 (HTML-attr injection via file.name) | MEDIUM | `<img alt>`, `<img src>`, `<source srcset>` | `escapeAttr` applied to every attribute interpolation. Unit-tested with `"`, `<`, `>`, `&`, `'` adversarial inputs. |

## Test Results

`node --experimental-strip-types --experimental-loader=./src/tests/_alias-loader.mjs src/tests/snippets.test.ts` → **all pass** (VALIDATION.md row 12-02-snippets now ✅ green).

Coverage:
- D-01 dispatch (SVG → URL-encoded, raster → base64)
- D-03 shape (all four `buildPictureSnippet` branches)
- D-04 dim omission when `parseDim(file.dim)` returns empty
- T-12-02 attr-escape with adversarial filenames
- D-02 chunked base64 with ≥1MB synthetic Uint8Array (no throw, correct length ≈ 4/3 × byteLength)
- Error path: `buildDataUri` rejects when `encodedBuffer == null`

## Carry-Forward

- **Plan 03 (OutputPanel):** `buildBase64Snippet`, `buildUrlEncodedSnippet`, `buildPictureSnippet` signatures are now Promise-returning and consume real `encodedBuffer`. useEffect deps must include `file?.encodedBuffer` for D-05 live refresh.
- **Plan 04 (Toolbar bulk):** `useSnippets` will call `buildDataUri` (for Copy data URIs — one per line) and `buildPictureSnippet` (for Copy `<picture>` — one block per done file separated by blank lines). Both already handle the dispatch logic — Plan 04 only orchestrates and concatenates.
- **Plan 05 (FileRow row menu):** Two ContextMenuItem siblings call the same `useSnippets` methods on a single file.
- All four downstream plans **MUST** use `copyToClipboard` from Plan 01 — never call `navigator.clipboard.writeText` directly (D-15 chokepoint contract).

## Files

- `/Users/jilizart/Projects/oimg.app/src/lib/snippets.ts` — refactored
- `/Users/jilizart/Projects/oimg.app/src/tests/snippets.test.ts` — expanded coverage
- `/Users/jilizart/Projects/oimg.app/.planning/phases/12-real-snippets/12-VALIDATION.md` — task row 12-02-snippets marked ✅ green
