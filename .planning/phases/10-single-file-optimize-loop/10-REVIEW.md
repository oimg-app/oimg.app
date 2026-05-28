---
phase: 10-single-file-optimize-loop
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/hooks/useIngest.ts
  - src/hooks/useOptimize.ts
  - src/stores/files.ts
  - src/lib/stub-data.ts
  - src/components/panels/FilesPane.tsx
  - src/components/shell/Toolbar.tsx
  - src/tests/fixtures/ingest-helper.ts
  - src/tests/ingest.spec.ts
  - src/tests/inspector-tabs.spec.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: resolved
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 9
**Status:** resolved

> **Resolution (2026-05-28):** The three material / hard-constraint findings were fixed and
> re-verified (10-VERIFICATION.md `passed`): **WR-01** (status `processing→done/error` transition
> in `files.ts` + ingest.spec regression assertion), **WR-04** (operable + keyboard-accessible
> dropzone affordance, WCAG-AA), **WR-05** (`openPicker` synthesizes a transient input so the
> Toolbar entry point works in Firefox/Safari). Deferred as minor, non-blocking follow-ups:
> **WR-02** (`jpg→jpeg` normalization makes `toSourceFormat` `case 'jpg'` dead; STUB_FILES still
> uses `type:'jpg'`), **WR-03** (`rawBuffer` double-write in `useIngest`), and the 3 Info items
> (hardcoded SSIM/Butteraugli placeholders, "JXL" dropzone label). Full suite 53/53 green.

## Summary

Phase 10 correctly implements the single-file optimize loop. The format gate, File→FileEntry mapping, AbortError swallowing, stale-closure fix in `useOptimize`, and the Pitfall 1/2/3/4/6 mitigations documented in the research are all present. No code sends file bytes off-device; the privacy constraint is met.

Five warnings and three info items were found. None are blockers, but two warnings (WR-01, WR-02) can silently leave entries stuck in `'processing'` status and may surface as UI regressions in Phase 11 when status-gated rendering is tightened.

---

## Warnings

### WR-01: `setFileResult` and `setFileError` never update `FileEntry.status`

**File:** `src/stores/files.ts:126-128` and `122-124`

**Issue:** Both `setFileResult` and `setFileError` patch the entry but do not transition `status`. Entries created by `useIngest` start as `status: 'processing'`. After a successful encode, `setFileResult` writes `encodedBuffer`, `opt`, and clears `error` — but `status` remains `'processing'` forever. Similarly, `setFileError` records the error string but leaves `status: 'processing'` (it should become `'error'`). Any UI component that branches on `status` to show a shimmer, error badge, or "done" checkmark will display the wrong state indefinitely.

The research (RESEARCH.md, Open Question 2) explicitly resolved this: "Wire status transitions inside `useOptimize` (`updateEntry(id, () => ({ status: 'processing' }))` before dispatch; `setFileResult` sets `status: 'done'`)." The `setFileError` counterpart must also set `status: 'error'`.

**Fix:**
```ts
// src/stores/files.ts
export function setFileResult(id: string, encodedBuffer: ArrayBuffer, optimizedSize: number): void {
  updateEntry(id, () => ({ encodedBuffer, opt: optimizedSize, error: undefined, status: 'done' }))
}

export function setFileError(id: string, error: string | undefined): void {
  updateEntry(id, () => ({ error, status: error ? 'error' : 'done' }))
}
```

`useOptimize` should also set `status: 'processing'` before dispatching each job (currently it does not).

---

### WR-02: `jpg` type normalized to `jpeg` in `useIngest` but `toSourceFormat` in `useOptimize` still returns `'jpg'` for the `'jpg'` branch — dead code after normalization

**File:** `src/hooks/useIngest.ts:51` and `src/hooks/useOptimize.ts:39-41`

**Issue:** `useIngest.fileToEntry` normalizes `ext === 'jpg'` → `type = 'jpeg'` before appending to the store. This means no `FileEntry` in the store ever has `type === 'jpg'` after Phase 10. However `toSourceFormat` in `useOptimize` has an explicit `case 'jpg': return 'jpg'` branch (line 39-40). The branch is now unreachable for entries ingested through `useIngest`. Entries injected by test fixtures (`ingest-helper.ts`) also use `type: 'png'`, so this path is never exercised. The dead branch is not itself a bug — but it means the codec worker receives `sourceFormat: 'jpeg'` for a type it was previously passing `'jpg'` for, and the two values must both be valid in the worker's `decodeSource` switch. If the worker only handles `'jpeg'` (not `'jpg'`), JPEG files ingested before Phase 10 that were stored as `type: 'jpg'` (e.g., from a future persistence layer, a copy-paste from an old store snapshot, or STUB_FILES entries with `type: 'jpg'`) will silently be skipped with `null` from `toCodec`/`toSourceFormat`.

**Fix:** Document the normalization contract explicitly and remove the dead `'jpg'` case from `toSourceFormat`, OR keep the `'jpg'` case and accept the dead code, but ensure the worker's `decodeSource` handles both. Verify the worker's switch covers `'jpg'`. Either way, add a comment coupling the two switch statements.

---

### WR-03: `rawBuffer` is stored in `FileEntry` then immediately written again via `setFileRawBuffer` — double-write with no guarantee of atomicity

**File:** `src/hooks/useIngest.ts:95-103`

**Issue:** `fileToEntry` returns a `FileEntry` that includes `rawBuffer` as a field. The entry is appended to the store at line 95 (with `rawBuffer` inside it). Then lines 101-103 loop over the same entries and call `setFileRawBuffer(entry.id, entry.rawBuffer)`, which calls `updateEntry` to write `rawBuffer` again into the already-appended entry. Between the `setKey` at line 95 and the `setFileRawBuffer` loop, the atom is in a state where the entries have `rawBuffer` from the initial append. The subsequent `setFileRawBuffer` calls are therefore redundant no-ops that add nanostores `setKey` overhead proportional to entry count.

More critically: if `runOptimize()` at line 107 reads the atom before the `setFileRawBuffer` loop completes (the loop is synchronous, but `Promise.all` at line 92 is async and `runOptimize` is called after `await`), `rawBuffer` is already present in the entries from the initial `setKey`, so this works today. However the duplicate write creates confusing ownership and the comment "Cache rawBuffer in store so useOptimize can slice(0)" implies this is the primary storage path — it is not; the initial `setKey` already did it. Future refactors may remove the initial `rawBuffer` from the `FileEntry` append and rely solely on `setFileRawBuffer`, or vice versa, leading to a race.

**Fix:** Remove `rawBuffer` from the `FileEntry` object returned by `fileToEntry` and let `setFileRawBuffer` be the sole write path, OR remove the `setFileRawBuffer` loop and rely on the fact that `rawBuffer` is included in the initial entry. Document which path is authoritative.

---

### WR-04: `FilesPane` dropzone `div` (lines 114-118) says "or click to browse" but has no `onClick` handler

**File:** `src/components/panels/FilesPane.tsx:114-118`

**Issue:** The inner dropzone `<div>` at line 114 renders the text "or click to browse · max 200 files" and the format label "SVG · PNG · JPEG · WEBP · AVIF · JXL". Users will naturally click this area expecting to open the file picker. The outer pane div at line 57 carries the drag handlers, but neither the outer div nor the inner dropzone div has an `onClick` that calls `openPicker`. The only way to open the picker from `FilesPane` is the small `+` button in the header (line 93-99). This breaks the WCAG-AA requirement that interactive UI elements be operable — a large clickable affordance that does nothing is a usability defect. It also contradicts the label.

**Fix:**
```tsx
<div
  className="m-3 p-[14px] border border-dashed ..."
  onClick={() => openPicker(() => inputRef.current?.click())}
  role="button"
  tabIndex={0}
  aria-label="Browse files to optimize"
  onKeyDown={(e) => e.key === 'Enter' && openPicker(() => inputRef.current?.click())}
>
```

---

### WR-05: `Toolbar` calls `openPicker()` without a `fallbackTrigger` — `<input>` fallback silently no-ops in non-`showOpenFilePicker` browsers

**File:** `src/components/shell/Toolbar.tsx:45` and `65`

**Issue:** Both the "Add files" button (line 45) and the "From device" menu item (line 65) call `openPicker()` with no argument. In `useIngest.openPicker`, when `showOpenFilePicker` is unavailable, the fallback path is `fallbackTrigger?.()` — which is a no-op if `fallbackTrigger` is `undefined`. In any browser where `showOpenFilePicker` is not present (Firefox < 111, some Safari versions), clicking either button silently does nothing. The `FilesPane` correctly passes `() => inputRef.current?.click()` as the fallback (line 96), but `Toolbar` does not own an `<input>` element and passes nothing.

**Fix:** Either (a) have `Toolbar` also manage a hidden `<input>` and pass its click trigger, or (b) expose a standalone `openPickerWithInput` function from `useIngest` that always uses a programmatically created transient `<input>` element when `showOpenFilePicker` is absent:
```ts
// Inside useIngest, fallback path:
} else {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.multiple = true; inp.accept = ACCEPT
  inp.onchange = (ev) => {
    const files = Array.from((ev.target as HTMLInputElement).files ?? [])
    void ingest(files)
  }
  inp.click()
}
```
This avoids the Toolbar needing to own DOM for picker state.

---

## Info

### IN-01: `FilesPane` format label includes "JXL" which is not in the format gate

**File:** `src/components/panels/FilesPane.tsx:117`

**Issue:** The dropzone label reads "SVG · PNG · JPEG · WEBP · AVIF · **JXL**". JXL (JPEG XL) is not in `ACCEPTED_EXTS` or `ACCEPTED_MIMES` in `useIngest`. A user who drops a `.jxl` file will see it silently skipped (D-07), which contradicts the displayed label. This is a UX lie, not a security issue.

**Fix:** Remove "JXL" from the label or add JXL to the format gate when codec support is added.

---

### IN-02: `ingest-helper.ts` injects entries with `status: 'done'` and identical `orig`/`opt` — tests never validate pending → done transition

**File:** `src/tests/fixtures/ingest-helper.ts:38`

**Issue:** Fixture entries are created with `status: 'done'` and `opt === orig`. Tests that use `ingestFixtureFiles` bypass the `'processing'` → `'done'` status transition and the `opt < orig` savings display. This means no test validates that `setFileResult` actually updates `status` to `'done'` (which, per WR-01 above, it currently does not). The fixture masks the WR-01 bug from automated tests.

**Fix:** Add at least one test in `ingest.spec.ts` that uses real `setInputFiles` ingestion and asserts `entry.status === 'done'` after encoding completes, rather than relying on injected `status: 'done'`.

---

### IN-03: STUB_FILES entries in `stub-data.ts` have `type: 'jpg'` but normalization in `useIngest` would produce `type: 'jpeg'` — inconsistency visible via `STUB_FILES` export

**File:** `src/lib/stub-data.ts:173,179,180`

**Issue:** `STUB_FILES` (exported for test fixtures) contains entries with `type: 'jpg'`. `useIngest` normalizes all ingested JPEGs to `type: 'jpeg'`. Any test or future code that mixes `STUB_FILES` entries with store-ingested entries and queries by `type === 'jpeg'` will get inconsistent results. The `codecForType` function in `stub-data.ts` handles `'jpg'` as a separate case (line 98-99), so codec dispatch works for `STUB_FILES`. The concern is type-string comparison in tests or future filters.

**Fix:** Normalize `STUB_FILES` entries to use `type: 'jpeg'` instead of `type: 'jpg'`, or document that `STUB_FILES` intentionally uses the un-normalized form to test the legacy path.

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
