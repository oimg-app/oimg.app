---
phase: 12
plan: 05
subsystem: FileRow ContextMenu per-row items
tags: [phase-12, wave-2, file-row, context-menu, SNIP-01, D-12, D-13, D-15]
requires:
  - Plan 01 (copyToClipboard chokepoint + installClipboardMocks helper)
  - Plan 02 (buildDataUri SVG dispatch + buildPictureSnippet)
  - Plan 04 (useSnippets.copyPictureOne + copyDataUriOne per-file methods)
  - Phase 11 D-04 (Save as… ContextMenuItem analog at FileRow.tsx:138-145)
provides:
  - src/components/panels/files/FileRow.tsx — two ContextMenu siblings wired via useSnippets
  - src/tests/file-row-snippets.spec.ts — 4 e2e tests covering D-12, D-13, T-12-01
key-files:
  created:
    - src/tests/file-row-snippets.spec.ts
  modified:
    - src/components/panels/files/FileRow.tsx
decisions:
  - "D-12 per-row items wired as flat siblings to Save as… (sub-menu refactor deferred per CONTEXT.md Claude's Discretion lock)"
  - "D-13 disable-then-explain triple reused verbatim from Phase 11 Save as… analog"
  - "Label standardized to 'Copy data-URI' (hyphenated, matching CONTEXT.md D-12 wording — was 'Copy data URI' in Phase 2 placeholder)"
metrics:
  duration_minutes: ~15 (incl. env repair)
  completed_date: 2026-06-03
  tasks_completed: 2
  files_changed: 2
---

# Phase 12, Plan 05 — FileRow ContextMenu Copy <picture> + Copy data-URI siblings

**One-liner:** FileRow ContextMenu gains real `Copy <picture>` and `Copy data-URI` siblings to `Save as…`, both routing through `useSnippets()` → `copyToClipboard` chokepoint with D-13 disable-then-explain semantics.

**Status:** Complete
**Date:** 2026-06-03
**Commits:**
- `c9fb7d8` feat(12-05): wire FileRow ContextMenu Copy data-URI + Copy <picture>
- `11fdda2` test(12-05): e2e for FileRow Copy data-URI + Copy <picture>

## What Shipped

### `src/components/panels/files/FileRow.tsx` (modified)

- New import: `import { useSnippets } from '@/hooks/useSnippets'`
- New destructure inside `FileRow`: `const { copyPictureOne, copyDataUriOne } = useSnippets()`
- The two `@TODO Phase 3` Copy placeholder items at lines 146-153 are **replaced** with real wiring matching the Phase 11 `Save as…` shape verbatim:

```tsx
<ContextMenuItem
  disabled={file.status !== 'done'}
  title={file.status !== 'done' ? 'Optimize this file first' : undefined}
  onSelect={() => { void copyDataUriOne(file) }}
>
  <Copy size={14} />
  Copy data-URI
</ContextMenuItem>
<ContextMenuItem
  disabled={file.status !== 'done'}
  title={file.status !== 'done' ? 'Optimize this file first' : undefined}
  onSelect={() => { void copyPictureOne(file) }}
>
  <Code size={14} />
  {'Copy <picture>'}
</ContextMenuItem>
```

- `Save as…` block at lines 138-145 is **untouched** — Phase 11 EXP-01 wiring stays.
- No `navigator.clipboard` reference in the file (D-15 chokepoint — all writes route through `useSnippets` → `copyToClipboard`).
- Label standardization: `Copy data URI` → `Copy data-URI` (D-12 hyphenated form per 12-CONTEXT.md / 12-PATTERNS.md).
- Existing `@TODO Phase 3` stubs for **other** menu items (Re-optimize, Reveal in compare, Apply same settings to all) are out of scope for Plan 12-05 (which addresses SNIP-01 only) — they remain for future plans.

### `src/tests/file-row-snippets.spec.ts` (new — 4 tests)

| # | Decision | What it proves |
|---|----------|----------------|
| 1 | D-12 | Right-click row → click `Copy <picture>` → `window.__clipboardWrites[0]` contains `<picture>` AND `<source srcset="` |
| 2 | D-13 | Queued (non-done) row → both new items show `aria-disabled='true'` + `title='Optimize this file first'` |
| 3 | D-12 | Copy data-URI raster → captured text matches `/^data:image\/webp;base64,/` and does NOT contain `<img` (URI alone, no wrapper) |
| 4 | D-12 / T-12-01 | Copy data-URI SVG → captured text matches `/^data:image\/svg\+xml;charset=utf-8,/` — proves SVG dispatch reaches the per-file path (T-12-01 mitigation chain end-to-end) |

The `injectEntries` and `rightClickRow` helpers are carried verbatim from `src/tests/file-row-menu.spec.ts:34-81` per Plan 03 precedent. `installClipboardMocks(page, { mode: 'native' })` from Plan 01 captures every clipboard write into `window.__clipboardWrites`.

## Threat Mitigations

| Threat ID | Surface | Mitigation in this plan |
|-----------|---------|-------------------------|
| T-12-ZOMBIE-2 | `@TODO Phase 3 — pushToast('Copy …')` placeholders shipping in production | Both Copy placeholders replaced; `grep -c "pushToast..Copy" src/components/panels/files/FileRow.tsx` → 0 |
| T-12-A11Y | Disabled menuitem missing `aria-disabled` | Radix `ContextMenuItem disabled={…}` prop sets both `data-disabled` AND `aria-disabled`; Test 2 asserts `aria-disabled='true'` in the DOM |
| T-12-SVG-PATH (T-12-01 chain) | SVG bytes reaching per-row Copy data-URI through the URL-encoded path | Plan 04 `copyDataUriOne` calls `buildDataUri(file)` which dispatches on `file.target === 'svg'` (Plan 02 D-01); Test 4 asserts `data:image/svg+xml;charset=utf-8,` prefix (NOT base64) reaches the clipboard |

## Verification

| Check | Result |
|-------|--------|
| `tsc -b` (project-relative, excluding pre-existing baseline noise) | clean |
| `playwright test src/tests/file-row-snippets.spec.ts --reporter=dot` | **4 passed** in 2.6m |
| `grep -c "@TODO Phase 3 — pushToast..Copy" src/components/panels/files/FileRow.tsx` | 0 (both Copy zombies purged) |
| `grep -c "useSnippets" src/components/panels/files/FileRow.tsx` | 2 (import + destructure) |
| `grep -c "Copy data-URI" src/components/panels/files/FileRow.tsx` | 1 (D-12 standardized) |
| `grep -c "Copy <picture>" src/components/panels/files/FileRow.tsx` | 1 (D-12 standardized) |
| `grep -c "file.status !== 'done'" src/components/panels/files/FileRow.tsx` | 3 (Save as… + 2 new items × disabled triple) |
| `grep -c "navigator.clipboard" src/components/panels/files/FileRow.tsx` | 0 (D-15 chokepoint — all writes route through useSnippets) |

## Deviations from Plan

### [Rule 3 — Blocking Issue] Env repair: missing `@esbuild/darwin-arm64` platform binary

- **Found during:** Task 2 verification (`playwright test`)
- **Issue:** `node_modules/@esbuild/` contained only `darwin-x64`, breaking vite dev server startup ("@esbuild/darwin-arm64 not present"). Same npm-cli-issues/4828 family as the existing rollup `ensure-rollup-binding.mjs` workaround.
- **Fix:** Followed the project precedent established in `scripts/ensure-rollup-binding.mjs` line 38: `npm install --no-save --ignore-scripts --cpu=arm64 @esbuild/darwin-arm64@<installed-esbuild-version>`. Used `--no-save` (no `package.json` change) and `--ignore-scripts` (no postinstall surprises). Package is an official scoped `@esbuild/*` binary listed in esbuild's own `optionalDependencies`.
- **Rationale for proceeding without checkpoint:** This is a transient platform-binary mismatch (already-resolved dep tree), not a new package addition. The project already has a precedent fix (`ensure-rollup-binding.mjs`) for the equivalent rollup case — I applied the same pattern to esbuild.
- **Files modified:** None (no `package.json` or `pnpm-lock.yaml` change).
- **Follow-up suggested:** Add esbuild to `scripts/ensure-rollup-binding.mjs` (rename to `ensure-native-bindings.mjs`) so this isn't manual next time. Out of scope for Plan 12-05.

### [Rule 3 — Recovery] `pnpm install --frozen-lockfile` after accidental npm install side-effect

- **Found during:** Task 2 env repair
- **Issue:** Initial attempt used `npm install --no-save @esbuild/darwin-arm64@...` (without `--ignore-scripts`); npm's install-resolution wiped pnpm-managed `node_modules/.bin/` entries because npm doesn't understand pnpm's symlink-based store layout (`node_modules/` dropped from ~1000 entries to 87).
- **Fix:** `pnpm install --frozen-lockfile` restored the dep tree to lockfile state in ~5s. Then re-attempted the platform-binary install with the safe `--ignore-scripts --cpu=arm64` flags per project precedent.
- **Files modified:** None.

## Acceptance Criteria Status

- [x] FileRow imports `useSnippets` from `@/hooks/useSnippets`
- [x] `const { copyPictureOne, copyDataUriOne } = useSnippets()` present
- [x] `void copyPictureOne(file)` AND `void copyDataUriOne(file)` invocation patterns present
- [x] Literal label `Copy data-URI` present (D-12 standardization)
- [x] Literal `{'Copy <picture>'}` JSX label present
- [x] No `pushToast..Copy` strings remain (0 matches)
- [x] Both new items carry the disable-then-explain triple
- [x] `tsc -b` clean (excl. pre-existing baseline noise — same as prior plans)
- [x] `Save as…` block untouched (Phase 11 `exportOne(file)` onSelect intact)
- [x] e2e file imports `installClipboardMocks` from `./setup/clipboard-mocks`
- [x] e2e file contains `getByRole('menuitem', { name: /^Copy <picture>$/ })` AND `/^Copy data-URI$/`
- [x] e2e file asserts `aria-disabled='true'` AND `title='Optimize this file first'`
- [x] e2e file contains `/^data:image\/webp;base64,/` (Test 3) AND `/^data:image\/svg\+xml;charset=utf-8,/` (Test 4)
- [x] e2e file contains `expect(text).not.toContain('<img')` (Test 3 URI-alone lock)
- [x] All four e2e tests pass

## Carry-Forward

**None.** Plan 12-05 is the final implementation plan in Phase 12. SNIP-01 is now satisfied across all 5 surfaces:
- Output panel × 3 sections (Plans 02 + 03)
- Toolbar × 3 bulk items (Plan 04)
- FileRow × 2 per-row items (this plan)

Next: Phase 12 verification (`/gsd:verify-phase`) — exercise VALIDATION.md and confirm `12-05-filerow` row flips ⬜ → ✅.

## Self-Check: PASSED

- FileRow.tsx exists and contains `useSnippets`, `copyPictureOne`, `copyDataUriOne`, `Copy data-URI`, `Copy <picture>`: confirmed by grep.
- file-row-snippets.spec.ts exists: confirmed by `git status` (committed in `11fdda2`).
- Commits `c9fb7d8` and `11fdda2` present in `git log --oneline`: confirmed.
- Playwright run: `4 passed (2.6m)` — confirmed.
