# Phase 5: Raster Encoders - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 05-raster-encoders
**Areas discussed:** Codec settings panel, Split slider detail view, AVIF scope, Density editing

---

## Codec Settings Panel

| Option | Description | Selected |
|--------|-------------|----------|
| InspectorPane — format-aware | Shows only selected file's format controls; matches SvgoPanel pattern | ✓ |
| Global accordion — all formats visible | Persistent panel shows all four format sections always | |

**User's choice:** Format-aware InspectorPane

---

| Option | Description | Selected |
|--------|-------------|----------|
| Global only in Phase 5 | All files of a format share the same codec settings | |
| Per-file overrides in Phase 5 | Per-file override UI active; tweak settings for individual files | ✓ |

**User's choice:** Per-file overrides active in Phase 5

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tab switching: Codec \| Snippets | InspectorPane gets two tabs; selecting a file auto-shows Codec | ✓ |
| Stacked sections in one scroll | Codec panel + snippets stacked vertically with a divider | |

**User's choice:** Codec \| Snippets tabs

---

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced live re-optimize | 200 ms debounce + pool cancel-and-restart (same as Phase 3 SVG) | ✓ |
| Manual re-optimize (Optimize button) | Setting changes staged; user clicks Run to apply | |

**User's choice:** Debounced live re-optimize (200 ms)

---

## Split Slider / Detail View

| Option | Description | Selected |
|--------|-------------|----------|
| Click file row → CenterPane activates | Clicking a file populates CenterPane with split slider | ✓ |
| Dedicated Compare button per row | Each row has a compare icon to open split view | |

**User's choice:** Click file row → CenterPane activates

---

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical drag handle (left=original, right=optimized) | Classic Squoosh approach; @radix-ui/react-slider available | ✓ |
| Toggle button (A/B flip) | Simpler toggle between original and optimized | |

**User's choice:** Vertical drag handle

---

| Option | Description | Selected |
|--------|-------------|----------|
| Drop-zone prompt ("Select a file to preview") | Empty state guidance | |
| Blank / empty | No additional UI | |
| Check current implementation | Show slider shell without images (current behavior) | ✓ |

**User's choice:** Show slider shell without files (freeform — check current implementation)
**Notes:** User confirmed current CenterPane behavior when no file selected is correct — slider frame renders with no background images.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remove SSIM/Butteraugli, keep real stats | Original/Optimized/Saved real data; drop mocks | ✓ |
| Keep all fields, still mock | Leave full delta strip with hardcoded values | |

**User's choice:** Remove mock fields; keep real stats only

---

## AVIF Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include AVIF with lazy load | Dynamic import on first AVIF file; SC-5 compliance | ✓ |
| Defer AVIF to Phase 8 | Phase 5 ships PNG + JPEG + WebP only | |

**User's choice:** Include AVIF in Phase 5

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: static map + lazy init flag | ADAPTERS map stays static; avif entry triggers one-time dynamic import | |
| All codecs lazy-init on first call | Every format uses lazy-init pattern consistently | ✓ |

**User's choice:** All codecs lazy-init on first call (consistent pattern)

---

## Density Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Wire interactive density editing in Phase 5 | Re-fan-out variants on density change | |
| Keep drop-time-only | No change from Phase 4 behavior | |
| InspectorPane density controls (freeform) | Density checkboxes in Inspector; export-scope only | ✓ |

**User's choice (freeform):** "User can select density manually in inspector panel, current file treats as 3x and user can check-toggle 1x 2x 3x"
**Clarification follow-up:** Asked whether density checkboxes trigger re-optimize or are export-scope selectors.
**User clarification:** "density checkboxes only tells that you can download multiple files dont do anything in files or file row and resize only when user wants to download all variants"
**Further clarification:** Asked whether Phase 5 keeps Phase 4 N-FileEntries fan-out or moves to single-FileEntry model.
**User clarification:** "single FileEntry variants generated on export"

**Notes:** This is a significant architectural revision from Phase 4. `addSourceWithVariants` fan-out is superseded. Single FileEntry per source. Density checkboxes = export-scope selectors. Actual resize deferred to Phase 7.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Codec tab — below format settings | Density section below format controls in Codec tab | ✓ |
| Separate Export tab | InspectorPane gets 3 tabs: Codec \| Export \| Snippets | |

**User's choice:** Density checkboxes in Codec tab, below format settings

---

## Claude's Discretion

- Exact per-format codec controls UI layout (slider vs. number input for quality)
- Whether per-file codec settings live in `FileEntry.codecOverride` or a separate `useSettingsStore.perFile` slice
- Visual design of the Codec tab format indicator
- Source density selector placement in InspectorPane
- Scope of Phase 4 fan-out machinery cleanup

## Deferred Ideas

- OxiPNG MT (multi-thread) build — Phase 8 performance pass
- SSIM / Butteraugli quality metrics — Phase 8
- Decode-time estimate in delta strip — Phase 8
- Format-aware ICC defaults — v2
- ICC for WebP / AVIF (if LOC estimate too high) — Phase 8 fallback
