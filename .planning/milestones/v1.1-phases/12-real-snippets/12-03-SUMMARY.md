---
phase: 12
plan: 03
subsystem: inspector / output-panel
tags: [phase-12, wave-2, output-panel, live-refresh, SNIP-01]
requires:
  - 12-01 (copyToClipboard chokepoint + setup/clipboard-mocks)
  - 12-02 (Promise-returning snippet builders consuming real bytes)
provides:
  - "OutputPanel wired to live encodedBuffer mutations (D-05)"
  - "Per-status presentation (queued/processing/error/done) per D-06"
  - "Output panel funnels every Copy through the chokepoint (D-15)"
affects:
  - "Plans 12-04 + 12-05 reuse the same chokepoint label convention (section title as label arg)"
tech_stack:
  added: []
  patterns:
    - "disable-then-explain triple (disabled + aria-disabled + title) — Phase 11 D-13 reused"
    - "cancellation guard inside useEffect builder.then() to dodge setState-after-unmount"
    - "deterministic e2e latches via page.waitForFunction over text substring"
key_files:
  modified:
    - src/components/panels/inspector/OutputPanel.tsx
  created:
    - src/tests/output-panel-live.spec.ts
decisions:
  - "D-05: useEffect dep array literally lists [file?.id, file?.encodedBuffer, file?.target, file?.status, builder] — covers live-encode push, target swap, and status flip during re-encode."
  - "D-06: four ordered branches inside the section body — queued → 'Optimize this file first' placeholder; error → file.error message in --color-err; processing OR !encodedBuffer → animate-pulse skeleton with aria-label='Encoding in progress'; done + bytes → real <pre> snippet."
  - "D-07: no snippetsAtom, no caching. Re-derive on every reactive trigger (matches StatusBar derivation pattern from Phase 11 D-01)."
  - "D-15: copyToClipboard(text, 'snippet', sectionTitle) is the single chokepoint. Section title doubles as the toast label, producing 'Data URI · Base64 copied' etc."
  - "T-12-DOUBLE mitigation: local handler only sets the `copied` flash on ok === true; failure toast is owned by the chokepoint (no double-toast)."
  - "T-12-RACE mitigation: clear stale `text` state when status is not done OR bytes are missing — prevents the previous file's snippet bytes from flashing during a target swap."
metrics:
  duration: "~12 min"
  completed: "2026-06-03"
  tasks_completed: 2
  files_modified: 1
  files_created: 1
---

# Phase 12 Plan 03: OutputPanel live refresh + per-status states + chokepoint reroute Summary

**One-liner:** Output panel now reacts to live `encodedBuffer` pushes, renders four distinct per-status states (queued/processing/error/done), and funnels every Copy click through the Plan 01 `copyToClipboard` chokepoint with the section title as the toast label.

## Tasks Completed

| # | Task | Type | Files | Commit |
|---|------|------|-------|--------|
| 1 | Wire OutputPanel — D-05 dep fix + D-06 per-status + D-15 chokepoint reroute | feat | `src/components/panels/inspector/OutputPanel.tsx` | `41108fe` |
| 2 | e2e for D-05 live refresh + D-06 per-status + D-15 chokepoint capture | test | `src/tests/output-panel-live.spec.ts` | `1e89c4f` |

## Changes Shipped

### `src/components/panels/inspector/OutputPanel.tsx` (modified)

- **D-05 dep array** — replaced `useEffect(() => …, [file])` with `useEffect(() => …, [file?.id, file?.encodedBuffer, file?.target, file?.status, builder])`. Phase 9's `useLiveEncode` pushes new bytes mid-edit; the snippet text now refreshes without re-selecting the file. `builder` is included because the SECTIONS map binds three different builders per section.
- **D-06 per-status branches** — body resolution inside `<Snippet>` now follows the locked order: `'queued'` → grey placeholder, `'error'` → error message in `--color-err`, `'processing' || !encodedBuffer` → 60px skeleton with `animate-pulse` + `aria-label="Encoding in progress"`, else `'done'` + bytes → existing `<pre>` block.
- **Disable-then-explain triple on Copy** — `disabled + aria-disabled + title`. The `title` resolves to the matching per-status string (`'Optimize this file first'` / `'Encoding in progress'` / `'Encoding failed'`).
- **D-15 reroute** — `import { copyToClipboard } from '@/lib/clipboard'`. The new `handleCopy(sectionId, text, label)` signature passes the section's `title` through. Local failure toast removed (`pushToast` import dropped) — the chokepoint owns the failure surface (T-12-DOUBLE).
- **Cancellation guard** — `let cancelled = false; return () => { cancelled = true }` around the Promise-returning builder so a rapid file/buffer swap can't race a stale `setText`.
- **Stale-text clear** — when status is not 'done' or bytes are missing, the effect calls `setText('')` so the previous file's snippet bytes never flash during the re-encode window (T-12-RACE).

### `src/tests/output-panel-live.spec.ts` (new)

Four tests under `test.describe('OutputPanel — D-05 live refresh + D-06 per-status + D-15 chokepoint')`:

1. **D-05 SC-3** — drops a done file, asserts the initial snippet contains `data:image/webp;base64,AQID` (base64 of [1,2,3]), then mutates `encodedBuffer` in-place via `filesAtom.setKey('entries', …)` and latches on the snippet containing `WVlZ` (base64 of [89,89,89]). No re-selection between mutation and assertion.
2. **D-06 processing** — injects `status: 'processing'`, asserts three skeleton divs with `aria-label="Encoding in progress"` and that the Base64 Copy button carries `aria-disabled="true"` + `title="Encoding in progress"`.
3. **D-06 queued** — injects `status: 'queued'`, asserts the 'Optimize this file first' placeholder is rendered in all three sections and the Copy button is disabled-then-explained.
4. **D-15 chokepoint** — drops a done file, installs `installClipboardMocks(page, { mode: 'native' })`, clicks the Base64 Copy button, latches on `window.__clipboardWrites.length === 1`, and asserts the captured text starts with `<img src="data:image/webp;base64,`.

`injectEntries` is copied verbatim from `src/tests/file-row-menu.spec.ts:34-72` (project precedent — spec files copy helpers; no shared util). `page.evaluate` imports through the `/src/stores/files.ts` Vite-dev path (accepted pattern per MEMORY).

## Deviations from Plan

None. Plan executed exactly as written. The `file?.status` and `builder` entries in the dep array beyond the three required by D-05 (`file?.id, file?.encodedBuffer, file?.target`) are belt-and-suspenders — the plan's acceptance criteria require at least the three named keys and a status flip ALSO needs to re-trigger the cancellation/clear path (T-12-RACE). Adding them does not violate the literal-substring acceptance check (it still passes).

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` (focused on changed files) | clean |
| `npx playwright test src/tests/output-panel-live.spec.ts --reporter=dot` | PASS (4/4) in 154.9s |
| `grep -c "navigator.clipboard" src/components/panels/inspector/OutputPanel.tsx` | 0 |
| `grep -c "file?.encodedBuffer" src/components/panels/inspector/OutputPanel.tsx` | 2 (effect dep + status gate) |
| `grep -c "copyToClipboard" src/components/panels/inspector/OutputPanel.tsx` | 2 (import + call site) |
| `grep -c "animate-pulse" src/components/panels/inspector/OutputPanel.tsx` | 1 |
| `grep -c "'Optimize this file first'"` | ≥ 2 (placeholder + tooltip) |
| `grep -c "'Encoding in progress'"` | ≥ 2 (aria-label + tooltip) |

## Threat Mitigations

| Threat | Status | Mitigation |
|---|---|---|
| **T-12-03** — clipboard throws in non-secure context | mitigated | reroute hands failure handling to Plan 01 chokepoint (silent textarea+execCommand fallback + 'Copy failed' toast) |
| **T-12-STALE** — pasting old bytes after re-optimize | mitigated | D-05 dep array literally includes `file?.encodedBuffer`; Test 1 latches the live-refresh transition |
| **T-12-RACE** — previous file's bytes flash during target swap | mitigated | D-06 processing branch + `setText('')` clear inside the effect when status ≠ 'done' or bytes are missing |
| **T-12-DOUBLE** — double clipboard-failure toast | mitigated | `handleCopy` only flashes local `copied` on `ok === true`; failure path is silent — chokepoint owns the surface |

## Carry-Forward for Plans 04 / 05

- **Section-title-as-label convention:** Plans 04 (Toolbar bulk) and 05 (FileRow per-row) should reuse the same convention — pass the user-visible label as `copyToClipboard`'s third arg so the toast reads naturally (`'Manifest JSON copied'`, `'Copied <picture> for hero.png'`).
- **No double-toast contract (T-12-DOUBLE):** any new copy handler MUST NOT toast on its own failure path — the chokepoint already did. Branch on `ok === true` only for *success-side* state (flash indicator, dismiss menu, etc.).
- **`injectEntries` precedent:** Plans 04/05 specs should copy the `injectEntries` helper from `file-row-menu.spec.ts:34-72` verbatim. A shared util has not been extracted yet (project rule: spec files copy helpers).
- **`installClipboardMocks` mode selection:** Test 4 here covered the `'native'` path only. Plans 04/05 should add `'fallback'` + `'fail-both'` coverage for the bulk surfaces, since Toolbar/FileRow are the larger blast radius if execCommand fails (D-14 last sentence).

## Self-Check: PASSED

- `src/components/panels/inspector/OutputPanel.tsx` exists (modified) — verified via git log
- `src/tests/output-panel-live.spec.ts` exists (new) — verified via git log
- Commits `41108fe`, `1e89c4f` exist on `main` — verified via `git log --oneline -3`
- VALIDATION.md row 12-03-output flipped ⬜ → ✅
