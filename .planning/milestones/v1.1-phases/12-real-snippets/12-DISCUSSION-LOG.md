# Phase 12: Real Snippets — Discussion Log

**Date:** 2026-06-03
**Areas selected:** URL-encoded vs Base64 dispatch · `<picture>` snippet shape · Refresh + selection triggers · Toolbar bulk copy actions · FileRow context-menu items (Copy <picture>, Copy data-URI)

---

## Area 1 — URL-encoded data-URI section

**Question:** How should it handle raster vs SVG?

**Options presented:**
1. SVG-only, hide for raster (Recommended)
2. SVG-only, disable for raster with tooltip
3. Always emit — base64 fallback for raster

**Selected:** Always emit — base64 fallback for raster.

**Lock:** D-01 — dispatch by source kind. SVG → true URL-encoded. Raster → base64 wrapped in `url("data:…")`. Section label stays `Data URI · URL-encoded`.

---

## Area 2 — `<picture>` snippet shape

**Question:** Attributes and structure?

**Options presented:**
1. Source + fallback img + a11y attrs (Recommended) — width/height/loading/decoding
2. Same as Recommended but no loading/decoding attrs
3. Just `<picture><source><img>` with alt only

**Selected:** Same as Recommended but no `loading`/`decoding` attrs.

**Lock:** D-03 + D-04 — `<source srcset>` + `<img alt width height>`. SVG target → bare `<img>` no `<picture>`. target === source → bare `<img>` no `<picture>`. Width/height omitted entirely when `file.dim` unparseable.

---

## Area 3 — Refresh + selection triggers

**Question:** When does the snippet re-render?

**Options presented:**
1. Selection + every encodedBuffer change; skeleton during processing (Recommended)
2. Selection only; show stale until next done
3. Selection + done transitions only; empty during processing

**Selected:** Selection + every encodedBuffer change; skeleton during processing.

**Lock:** D-05 + D-06 + D-07 — useEffect deps `[file?.id, file?.encodedBuffer, file?.target]`. Per-status: done → real, processing → skeleton (copy disabled), queued → "Optimize this file first" placeholder, error → disabled with error message. No `snippetsAtom` — derived live in the component.

---

## Area 4 — Toolbar bulk copy actions

**Question:** Three Toolbar stubs (Copy `<picture>`, Copy as data URIs, Manifest JSON) — scope?

**Options presented:**
1. Wire all three this phase (Recommended)
2. Wire only Manifest JSON; defer the other two
3. Defer all three

**Selected:** All three — with user clarifications:
- Copy `<picture>` → clipboard-write a `<picture>` snippet using the same per-file template as the Output panel
- Copy as data URI → clipboard-write a string ready to paste into `<img src="">` (base64 for raster, URL-encoded for SVG)

**Follow-up — Manifest JSON scope (separate question):**
- Wire this phase — JSON array `{ filename, target, originalSize, optimizedSize, quality }` ✓ SELECTED
- Defer to follow-up

**Locks:** D-08 (operate on `$hasDone` set, disable-then-explain), D-09 (`<picture>` block per done file, blank-line separator, same builder as Output panel), D-10 (one data URI per line, ready for `<img src>` paste, base64/URL-encoded per D-01), D-11 (JSON array pretty-printed with the five fields).

---

## Area 5 — FileRow context-menu items (Copy `<picture>`, Copy data-URI)

**Question:** Add Copy `<picture>` + Copy data-URI to the per-row menu?

**Options presented:**
1. Add both items, disabled when `status !== 'done'` (Recommended)
2. Add Copy data-URI only
3. Defer both

**Selected:** Add both items, disabled when `status !== 'done'`.

**Lock:** D-12 + D-13 — two new ContextMenuItem entries alongside existing `Save as…`. Disable + tooltip when row's status not done. Both call the same clipboard helper as the Output panel + Toolbar bulk. WCAG-AA keyboard support inherits from Radix (Phase 11 D-04 verified).

---

## Area 6 (auto-locked) — Clipboard write strategy

**Question:** When `navigator.clipboard` fails?

**Options presented:**
1. Try navigator.clipboard, fall back to textarea + execCommand, toast on both paths (Recommended)
2. navigator.clipboard only, error toast on failure

**Selected:** Try navigator.clipboard, fall back to textarea + execCommand, toast on both paths.

**Lock:** D-14 + D-15 — `copyToClipboard(text, kind, label)` helper in `src/lib/clipboard.ts`. Single chokepoint for every snippet/manifest/data-URI write. Toast on every call. Feature-detect `window.isSecureContext` AND `'clipboard' in navigator`. Returns `{ ok, method }` but callers ignore (zero-telemetry).

---

## Scope-creep parked → `<deferred>` in CONTEXT.md

- 1×/2×/3× density variants (VAR-01 future milestone)
- Multi-format `<picture>` fallback chain (one target per file today)
- Snippet customization toggles
- Inline SVG snippet
- Manifest JSON in the ZIP
- Snippet localization
- Telemetry on copy success/method

---

*End of discussion log.*
