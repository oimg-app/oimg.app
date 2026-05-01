---
phase: 03-svg-pipeline
plan: C
subsystem: ui
tags: [svg, snippets, registry, clipboard, url-encoder, yoksel, react, zustand]

# Dependency graph
requires:
  - phase: 03-svg-pipeline
    plan: A
    provides: sanitize-svg pipeline (D-04 single source of truth — FileEntry.optimizedBlob is the sanitized blob), SnippetId union, FileEntryWithBlob shape
  - phase: 03-svg-pipeline
    plan: B
    provides: useSettingsStore.snippetTogglesByFileId + setSnippetToggle (D-13)
  - phase: 02-worker-harness-state
    provides: sonner Toaster (toast.error for clipboard failures), three-store architecture
provides:
  - SNIPPET_REGISTRY plain Record (5 entries — 2 SVG live + 3 raster stubs); applicableFormats filter is the contract Phase 5/6 plugs into without touching SnippetPanel
  - svg-snippets generators: ensureNamespace, encodeSvgForDataUri, generateInlineSvg, generateDataUri (yoksel D-15 verbatim — symbols regex line 15, encodeSVG lines 134-148)
  - SnippetPanel.tsx — registry-driven snippet renderer; replaces OutputPanel; per-snippet checkbox + WR-04 clipboard pattern + Section/code-row layout
  - 11 live yoksel unit-test cases for encodeSvgForDataUri / ensureNamespace / generateDataUri (replaces Wave 0 stub)
affects:
  - 03-D-PLAN (SnippetPanel + svg-snippets are now ready for SNIP-01/SNIP-03/SNIP-04 spec stub flips)
  - Phase 5/6 raster snippet plans (add SNIPPET_REGISTRY entries with applicableFormats including png/jpeg/webp/avif and real generate functions; do NOT touch SnippetPanel render)

# Tech tracking
tech-stack:
  added:
    - (none — Plan C is pure UI + lib code reuse; no new packages)
  patterns:
    - "Registry-driven panel render: Object.values(REGISTRY).filter(def => def.applicableFormats.includes(file.format)).map(def => <Section ...>) — single source of truth for which snippets are visible per format. NO switch(file.format). Phase 5/6 raster generators register entries; SnippetPanel.tsx untouched."
    - "Generator-as-data: registry entries carry the generate(svgText) function, not just config. Per-row code computed via def.generate(svgText) inside map. Stubs return null until the real implementation lands; SnippetPanel renders the generic 'Run Optimize to generate snippet' fallback."
    - "Sanitized-blob single source of truth (D-04): SnippetPanel reads file.optimizedBlob.text() and passes the string straight to generate functions. NO re-sanitization in the render layer — Plan A's main-thread DOMPurify already cleaned the blob before markDone wrote it. Threat T-V5-07 mitigated by construction."

key-files:
  created:
    - src/lib/svg-snippets.ts
    - src/lib/snippet-registry.ts
    - src/components/panels/SnippetPanel.tsx
  modified:
    - src/App.tsx (OutputPanel import + mount → SnippetPanel; passes filesById[selectedId] FileEntryWithBlob)
    - src/tests/svg-snippets.unit.ts (Wave 0 stub → 11 live yoksel cases)
  deleted:
    - src/components/panels/OutputPanel.tsx

key-decisions:
  - "SnippetPanel takes FileEntryWithBlob (not MockFile) because the snippet text comes from file.optimizedBlob — the MockFile view-model has no blob. App.tsx passes filesById[selectedId] (the canonical store entry) directly; selectedId='placeholder' resolves to undefined which maps to null and SnippetPanel renders nothing."
  - "Checkbox lives inside the .code-row alongside the copy button (single horizontal control row) rather than embedded in the Section <h3> title. Section.tsx accepts only string titles and emits its own h3, so re-shaping it would force a Section API change. The horizontal-row layout matches OutputPanel's spatial economy."
  - "Disabled snippet shows a single 'Disabled. Enable above to include in copy-all output.' italic line (replacing the <pre> entirely) rather than collapsing the Section. The Section header + checkbox stay visible so the user can re-enable without scrolling, and the row still occupies a predictable height."
  - "Unit-test import switched to .ts extension (not .js) — Node's --experimental-strip-types resolves the .ts file directly; the .js suffix in earlier draft would 404 because no .js artifact exists alongside svg-snippets.ts during dev."

patterns-established:
  - "Registry pattern for per-format generators (snippets): one Record mapping id → { applicableFormats, generate, label, badge, codeLabel } drives both visibility and content. The renderer is generic; the data is per-format. Phase 5/6 raster snippet plans extend by adding entries — never by modifying the panel."
  - "Sanitized blob → string → generator pipeline: useEffect with a cancellation flag reads file.optimizedBlob.text() on file/blob/status change. Cancellation handles fast file-switching without stale text bleeding into a new file's snippet."
  - "Per-snippet toggle UX: checkbox in the code-row, not in the Section header. Maintains a stable Section/h3 contract while keeping the toggle close to the body it gates (D-13)."

requirements-completed:
  - SNIP-01
  - SNIP-03
  - SNIP-04

# Metrics
duration: ~12min
completed: 2026-05-01
---

# Phase 03 Plan C: Snippet Infrastructure Summary

**SnippetPanel replaces OutputPanel as a generic, registry-driven snippet renderer. SNIPPET_REGISTRY (Record with 5 entries) and svg-snippets.ts (yoksel D-15 encoder verbatim) close SNIP-01/SNIP-03/SNIP-04 for SVG and lock the registry-extension contract Phase 5/6 raster generators plug into without touching the panel.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-01T11:10:00Z
- **Completed:** 2026-05-01T11:22:00Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 2
- **Files deleted:** 1

## Accomplishments

- `src/lib/svg-snippets.ts`: yoksel encoder ported verbatim from `inspired/url-encoder/src/js/script.js` (symbols regex line 15; encodeSVG lines 134-148). Exports `ensureNamespace`, `encodeSvgForDataUri`, `generateInlineSvg`, `generateDataUri`. Minimal-escape strategy preserved: `"` → `'`, whitespace collapsed, only the `\r\n%#()<>?[\]^{|}` set percent-encoded; spaces and UTF-8 (e.g. `★`) untouched.
- `src/lib/snippet-registry.ts`: `SNIPPET_REGISTRY` plain Record with 5 entries — 2 live SVG generators (`inline-svg`, `url-encoded-uri`) and 3 raster stubs (`picture`, `img-srcset`, `data-uri-base64`) whose `applicableFormats` exclude `'svg'` so SVG files render only the 2 live sections. Phase 5/6 plugs raster generators in by replacing the stub `generate: () => null` with real implementations.
- `src/components/panels/SnippetPanel.tsx`: registry-driven render via `Object.values(SNIPPET_REGISTRY).filter(def => def.applicableFormats.includes(file.format))`. NO `switch(file.format)`. Per-snippet checkbox lives in the code-row beside the copy button, wired to `useSettingsStore.snippetTogglesByFileId` (D-13). WR-04 clipboard pattern (await `navigator.clipboard.writeText` before `setCopied`; sonner toast on failure). Inline SVG section uses `max-height: 200px`; Data URI section uses `max-height: 140px`. Empty/processing state shows `// Run Optimize to generate snippet`; error state shows `// Snippet unavailable — see Report tab`; copy buttons disabled in both.
- `src/App.tsx`: `OutputPanel` import + mount replaced with `SnippetPanel`; passes `filesById[selectedId] ?? null` (canonical `FileEntryWithBlob` from the files store) so the panel reads the sanitized `optimizedBlob` directly.
- `src/components/panels/OutputPanel.tsx`: deleted (single source of truth).
- `src/tests/svg-snippets.unit.ts`: Wave 0 stub flipped to 11 live yoksel cases; all green via `node --experimental-strip-types`.
- Threat T-V5-07 (Tampering) mitigated by construction: SnippetPanel reads `file.optimizedBlob.text()` — Plan A's main-thread DOMPurify already cleaned the blob before `markDone` wrote it, so no re-sanitization is needed in the render layer.
- Full Playwright suite (37/37) green; production build clean (154.24 KB gzip initial, well under 200 KB budget); `npx tsc --noEmit` clean.

## Task Commits

1. **Task 1: svg-snippets.ts (yoksel encoder) + snippet-registry.ts (5 entries) + unit-test stub → 11 live cases** — `b6dc25f` (feat)
2. **Task 2: SnippetPanel.tsx replaces OutputPanel + App.tsx wiring + OutputPanel.tsx deletion** — `07618e6` (feat)

**Plan metadata:** _(filed in next commit alongside SUMMARY + STATE updates)_

## Files Created/Modified

### Created (3)

- `src/lib/svg-snippets.ts` — yoksel D-15 encoder (~50 LOC). Exports `ensureNamespace`, `encodeSvgForDataUri`, `generateInlineSvg`, `generateDataUri`. The `symbols` regex is verbatim from yoksel's `script.js` line 15.
- `src/lib/snippet-registry.ts` — `SNIPPET_REGISTRY: Record<SnippetId, SnippetDef>` (5 entries). Each entry: `id`, `label`, `badge`, `codeLabel`, `applicableFormats: FormatId[]`, `generate(svgText): string | null`. SVG entries (`inline-svg`, `url-encoded-uri`) have live generators; raster entries (`picture`, `img-srcset`, `data-uri-base64`) return `null` until Phase 5/6.
- `src/components/panels/SnippetPanel.tsx` — registry-driven panel (~180 LOC). Reads `file.optimizedBlob.text()` in a `useEffect` with cancellation flag; renders one `<Section>` per visible snippet; per-snippet checkbox + copy button + `<pre>` body; disabled state replaces `<pre>` with an italic explanation line.

### Modified (2)

- `src/App.tsx` — `OutputPanel` import + mount swapped for `SnippetPanel`; passes `filesById[selectedId] ?? null` so the panel reads the canonical `FileEntryWithBlob` (with `optimizedBlob`) instead of the `MockFile` view-model that was OK for the previous mock-data panel.
- `src/tests/svg-snippets.unit.ts` — Wave 0 console-log stub flipped to 11 live yoksel test cases. Run with `node --experimental-strip-types src/tests/svg-snippets.unit.ts`. All PASS.

### Deleted (1)

- `src/components/panels/OutputPanel.tsx` — replaced by `SnippetPanel.tsx`. The file's WR-04 clipboard pattern and Section/code-row layout were ported verbatim into the new component.

## Decisions Made

- **`SnippetPanel` takes `FileEntryWithBlob | null` (not `MockFile`)** — the canonical store shape that carries `optimizedBlob`. App.tsx passes `filesById[selectedId] ?? null`; the placeholder pseudo-id resolves to `undefined` → `null` → panel renders nothing, which is correct for "no file selected."
- **Checkbox lives in the code-row, not the Section header** — `Section.tsx` accepts only string titles. Reshaping it to take a `ReactNode` would create cross-cutting churn for one consumer. The horizontal control row (checkbox · label · copy button) preserves Section's API and reads naturally as "configure this snippet, then copy it."
- **Disabled snippet swaps `<pre>` for an explanation line** — keeps the Section header + toggle visible (so users can re-enable without scrolling) and gives the row a predictable height. Beats fully collapsing the Section, which would surprise users who don't see why the section disappeared.
- **Unit-test import uses `.ts` extension, not `.js`** — Node's `--experimental-strip-types` resolves `.ts` directly; importing `.js` would 404 because no compiled artifact exists during `node --experimental-strip-types` runs. The mismatch was caught during the first test execution and corrected before commit.

## Deviations from Plan

None — both tasks executed exactly as written in 03-C-PLAN.md. The plan's prescribed code was lifted verbatim into the files (with one small adjustment for the `.ts` import extension noted above, which the plan also wrote correctly in its final draft).

## Issues Encountered

- The plan's draft unit test imported from `'../lib/svg-snippets.js'` — Node's `--experimental-strip-types` runner resolves source `.ts` files directly and does NOT need the `.js` suffix that bundlers translate. Switched to `'../lib/svg-snippets.ts'` and the test ran clean. (This is a 1-line idiomatic difference from the plan; logged here for transparency, not as a deviation.)

## User Setup Required

None. Plan C is pure UI + lib code; no environment, dependency, or service changes.

## Next Phase Readiness

- **Plan 03-D (test corpus):** ready. The OPT-01 / SNIP-01 / SNIP-03 / SNIP-04 stubs in `src/tests/svg-pipeline.spec.ts` can flip from `test.fail()` to live tests using:
  - `Object.values(SNIPPET_REGISTRY)` for registry-shape assertions.
  - The rendered Section titles ("Inline SVG", "Data URI · URL-encoded") for visibility checks.
  - `useSettingsStore.getState().snippetTogglesByFileId` for D-13 checkbox-state assertions.
  - The XSS-fixture round-trip pattern from Plan A: drop fixture → optimize → assert generated snippet text contains no `<script>`, `on*`, `javascript:`, `data:` attributes.
- **Phase 5/6 (raster snippets):** the registry-extension contract is locked. Adding `picture`, `img-srcset`, `data-uri-base64` real generators requires only:
  1. Replace each entry's `generate: () => null` with a real function `(file) => string | null`.
  2. Optionally widen the `generate` signature in `SnippetDef` (e.g., to take the full file plus density variants for `<picture>`).
  3. The SnippetPanel rendering layer requires NO changes — `applicableFormats` already excludes `'svg'` for those entries, and includes `'png' | 'jpeg' | 'webp' | 'avif'`.

## Self-Check: PASSED

- All 3 created files exist on disk (`test -f` verified).
- `src/components/panels/OutputPanel.tsx` no longer exists (`test ! -f` verified).
- Both task commits exist in git log: `b6dc25f` (Task 1) and `07618e6` (Task 2).
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds; 154.24 KB gzip initial bundle (well under 200 KB budget).
- `npx playwright test` — 37/37 green.
- Acceptance greps:
  - `grep "const symbols = /\[\\\\r\\\\n%#" src/lib/svg-snippets.ts` → matches (yoksel verbatim).
  - `grep "applicableFormats" src/lib/snippet-registry.ts` → 8 matches (all 5 entries + interface + comment + critical contract).
  - `grep "switch.*format" src/components/panels/SnippetPanel.tsx` (excluding comments) → 0 matches.
  - `grep "SNIPPET_REGISTRY" src/components/panels/SnippetPanel.tsx` → 3 matches (import + filter + comment).
  - `grep "SnippetPanel" src/App.tsx` → 2 matches (import + mount).
  - `grep "OutputPanel" src/App.tsx` (excluding comments) → 0 matches.
- 11/11 yoksel unit-test cases pass (`node --experimental-strip-types src/tests/svg-snippets.unit.ts`).
- Threat T-V5-07 mitigation: SnippetPanel reads `file.optimizedBlob.text()` — the sanitized blob from Plan A — and passes it to generators. NO re-sanitization needed.

---

*Phase: 03-svg-pipeline*
*Completed: 2026-05-01*
