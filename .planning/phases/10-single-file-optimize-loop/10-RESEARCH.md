# Phase 10: Single-File Optimize Loop — Research

**Researched:** 2026-05-28
**Domain:** Browser file ingestion (drag-drop + File picker) wired into the Phase 9 encode pipeline
**Confidence:** HIGH (all core claims verified against codebase; no new external packages required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Wire BOTH the existing dropzone (FilesPane) AND the file picker ("Add files" + Toolbar "From device"). `addFromDevice`/`addFromUrl`/`addWatchFolder` are empty stubs — make them real for device/drop ingestion.
- **D-02:** When multiple files are dropped/selected, add ALL and auto-select the newest.
- **D-03:** All ingested files auto-optimize immediately on ingest using per-file default settings (Squoosh-style auto-optimize-on-load). Phase 11 boundary = explicit "Optimize all" with live progress.
- **D-04:** Remove seeded demo files entirely. `filesAtom` starts empty. Inspector shows "Select a file", Report empty.
- **D-05:** Test-fixture consequence — `navigation.spec.ts`, `backpressure.spec.ts`, `per-file-settings.spec.ts`, `inspector-tabs.spec.ts`, `output-panel.spec.ts` must be updated to ingest a real file fixture first.
- **D-06:** Accept only `png`, `jpg`/`jpeg`, `webp`, `svg`, `avif`. Gate via extension AND/OR MIME type.
- **D-07:** Unsupported files are silently skipped at ingest (no sonner toast). Encode failures still surface (Phase 9 D-13 path).
- **D-08:** `orig` = real `File.size`. `opt` = encoded result byteLength (Phase 9 `setFileResult` already writes this).
- **D-09:** Re-adjusting a setting re-optimizes via Phase 9 `useLiveEncode` (already wired for the selected file).
- **D-10:** Between ingest and first encode, entry shows real `orig = File.size` with `opt` pending (shimmer). Auto-optimize (D-03) makes this window brief.

### Claude's Discretion
- Exact dropzone event wiring and drop target bounds (whole FilesPane vs dedicated zone)
- Where ingestion logic lives — prefer `src/hooks/useIngest.ts` + thin store actions
- `File → FileEntry` mapping: id generation, `name`, `type` from extension, `dim` via `createImageBitmap`, initial `status`, `settings` via `defaultFileSettings`
- How auto-optimize-on-drop reuses `useOptimize` vs `useLiveEncode`
- Reading image dimensions for the `dim` field

### Deferred Ideas (OUT OF SCOPE)
- "From URL or paste" ingestion (Toolbar) — clipboard + client-side URL fetch, later phase
- "Watch folder" ingestion — File System Access API directory watching, later phase
- Explicit "Optimize all" batch with live per-file progress through worker pool — OPT-02 / Phase 11
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPT-01 | User drops a single file → sees real optimized output with accurate before/after byte sizes in the Report | Drag-drop wiring (§ Architecture Patterns), File→FileEntry mapping (§ File→FileEntry Mapping), auto-optimize dispatch (§ Auto-optimize Dispatch), truthful sizes (§ Truthful Sizes), test fixtures (§ Validation Architecture) |
</phase_requirements>

---

## Summary

Phase 10 wires real file ingestion into the encode pipeline that Phase 9 built. The scope is narrow: two entry points (drag-drop on FilesPane + `<input type="file">` / `showOpenFilePicker` behind the "Add files" / "From device" buttons), one shared ingest hook, and an empty initial store. No new external packages are required — the entire implementation uses Web Platform APIs (File, DataTransfer, createImageBitmap, FileReader) and the Phase 9 store actions and hooks that already exist.

The highest-risk area is **test-fixture migration (D-05)**. Five existing Playwright specs select files by stub name (`hero-banner@2x.png`); those assertions become dead after D-04 empties the store. The recommended fixture approach is a shared `ingestFile` Playwright helper that uses `page.evaluate` to push a real FileEntry with real bytes into `filesAtom` directly — this is fast, deterministic, and avoids the latency of full drag-drop simulation in tests.

The second design decision is **auto-optimize dispatch (D-03)**. `useOptimize` iterates `filesAtom.get().entries`, which means it will naturally pick up any newly appended entries. The cleanest wiring is to call `runOptimize()` from the ingest hook immediately after appending entries — no separate per-file dispatch loop is needed, and `useLiveEncode` continues to handle re-encode on settings change (success criterion #3 is already working from Phase 9).

**Primary recommendation:** Build `src/hooks/useIngest.ts` as the single ingest entry point that parses DataTransfer/FileList, filters formats (D-06/D-07), maps each File to a FileEntry with `orig = File.size`, appends to the store, and calls `runOptimize()`. Wire the FilesPane dropzone and both "Add files" / "From device" buttons to this hook. Empty `STUB_FILES` from `filesAtom`'s initial seed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag-drop event handling | Browser / Client (component) | — | DOM events live in the component; logic delegated to ingest hook |
| File picker (`<input>` / `showOpenFilePicker`) | Browser / Client (component) | — | UI trigger; actual mapping delegated to hook |
| File → FileEntry mapping + format gate | Hook (`useIngest`) | Store actions | Business logic; project rule: never inline in components |
| FileEntry append to store | Store (`filesAtom`) | — | Single source of truth; `updateEntry` / `setKey` pattern |
| Auto-optimize dispatch | Hook (`useOptimize`) | — | Already owns batch dispatch; call after ingest append |
| Re-encode on settings change | Hook (`useLiveEncode`) | — | Already wired for selected file; Phase 9 success criterion #3 |
| Before/after size display | Component (`DeltaStrip`, `ReportPanel`) | — | Already reads `entry.orig` / `entry.encodedBuffer.byteLength` |
| Test file injection | Playwright fixture (page.evaluate) | — | Bypasses UI for speed; injects a real FileEntry with real bytes |

---

## Standard Stack

### Core (no new installs — all already in package.json)

| API / Library | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Web Platform: `DataTransfer.files` / `DataTransfer.items` | Browser API | Access dropped files | The native surface for ondrop; no library needed |
| Web Platform: `<input type="file" multiple accept>` | Browser API | File picker fallback | Universal; works in all modern browsers without permission prompt |
| Web Platform: `window.showOpenFilePicker()` | Browser API | Enhanced file picker | Modern; returns `FileSystemFileHandle`; gated by `'showOpenFilePicker' in window` |
| Web Platform: `createImageBitmap(blob)` | Browser API | Read raster dimensions | Fast; off-main-thread capable; already available in target browsers |
| `nanostores` ^1.3.0 | Already installed | Store for FileEntry list | Project's locked state library |
| `useOptimize` (Phase 9) | Project hook | Auto-optimize dispatch | Already batch-dispatches entries; call after append |
| `useLiveEncode` (Phase 9) | Project hook | Re-encode on settings change | Already handles success criterion #3 |
| `defaultFileSettings(type, q)` (stub-data.ts) | Project utility | Per-file settings seed | Already produces complete FileSettings object per codec |
| `@playwright/test` ^1.59.1 | Already installed | Test fixture helpers | `page.evaluate` for store injection; `page.setInputFiles` for file input |

### No New Packages Required

This phase is purely a wiring phase. All needed APIs are either Web Platform built-ins or already-installed project code. The Package Legitimacy Audit section is omitted because no external packages are added.

---

## Architecture Patterns

### System Architecture Diagram

```
[User drops files / clicks Add files]
         |
         v
[FilesPane dropzone / <input type="file"> / showOpenFilePicker]
         |  (raw FileList / FileSystemFileHandle[])
         v
[useIngest hook]
  ├── format gate: extension + MIME → skip unsupported (D-06/D-07)
  ├── for each accepted File:
  │     id = crypto.randomUUID()
  │     name = file.name
  │     type = ext from file.name (lowercased)
  │     orig = File.size                  ← D-08: truthful
  │     opt = File.size                   ← pending (same as orig until encode)
  │     status = 'queued'
  │     dim = await readDimensions(file)  ← createImageBitmap for raster, '—' for SVG
  │     settings = defaultFileSettings(type, q=82)
  │     rawBuffer = await file.arrayBuffer()
  │     → setFileRawBuffer(id, rawBuffer)
  │
  ├── filesAtom.setKey('entries', [...current, ...newEntries])
  ├── selectFile(newEntries[newEntries.length - 1].id)   ← D-02: auto-select newest
  └── runOptimize()                                        ← D-03: auto-optimize all
         |
         v (Phase 9 path — unchanged)
[useOptimize → WorkerPool → codec workers → setFileResult(id, buffer, optimizedSize)]
         |
         v
[DeltaStrip: orig=File.size, opt=encodedBuffer.byteLength  ← D-08: truthful]
[ReportPanel: same entries, real bytes]
```

### Recommended Project Structure (additions only)

```
src/
├── hooks/
│   ├── useIngest.ts      ← NEW: single ingest entry point (format gate + FileEntry mapping + dispatch)
│   ├── useOptimize.ts    ← UNCHANGED (Phase 9)
│   └── useLiveEncode.ts  ← UNCHANGED (Phase 9)
├── stores/
│   └── files.ts          ← MODIFY: empty STUB_FILES seed, make addFromDevice real
├── lib/
│   └── stub-data.ts      ← MODIFY: move STUB_FILES out of initial filesAtom seed; keep for test fixtures
├── components/panels/
│   └── FilesPane.tsx     ← MODIFY: wire dropzone events + "Add files" button to useIngest
├── components/shell/
│   └── Toolbar.tsx       ← MODIFY: wire "From device" to useIngest trigger
└── tests/
    └── fixtures/
        └── ingest-helper.ts  ← NEW: shared Playwright helper that injects a real FileEntry
```

### Pattern 1: Drag-Drop Wiring (whole FilesPane as drop target)

**What:** Attach `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop` to the FilesPane root div. `preventDefault()` on `dragover` and `drop` is mandatory — without it the browser navigates away on drop.

**When to use:** Single drop zone for the entire pane; no nested zone confusion.

```tsx
// Source: MDN Web Docs — HTML Drag and Drop API [CITED: developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API]
const [dragActive, setDragActive] = useState(false)

function handleDragOver(e: React.DragEvent) {
  e.preventDefault()           // required — enables drop
  e.stopPropagation()
  setDragActive(true)
}

function handleDragLeave(e: React.DragEvent) {
  // Only clear if leaving the pane entirely (not a child element)
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    setDragActive(false)
  }
}

function handleDrop(e: React.DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  setDragActive(false)
  const files = Array.from(e.dataTransfer.files)
  ingest(files)
}
```

**Drag-active visual:** Toggle a CSS class on the root div — e.g., `border-[var(--color-accent)]` on `dragActive`. The existing dashed dropzone border makes this natural.

**dragenter count bug:** `dragenter` fires for each child element, so naive counting of enter/leave causes flicker. The recommended fix: check `e.relatedTarget` in `handleDragLeave` — only clear `dragActive` when the cursor leaves the root element itself (not a child).

### Pattern 2: File Picker (`<input>` + showOpenFilePicker fallback)

```tsx
// Source: MDN — showOpenFilePicker [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker]
// [ASSUMED] showOpenFilePicker is available in Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+
// All are within "last 2 stable" modern-browser target. Gated by feature detection.

async function pickFiles() {
  if ('showOpenFilePicker' in window) {
    const handles = await window.showOpenFilePicker({ multiple: true })
    const files = await Promise.all(handles.map((h) => h.getFile()))
    ingest(files)
  } else {
    // Fallback: programmatic click on hidden <input type="file">
    inputRef.current?.click()
  }
}
```

**Accept string for `<input>`:** `accept=".png,.jpg,.jpeg,.webp,.svg,.avif,image/png,image/jpeg,image/webp,image/svg+xml,image/avif"` — use both extensions and MIME types for broadest OS support.

### Pattern 3: File → FileEntry Mapping in useIngest

```ts
// [VERIFIED: codebase — defaultFileSettings, FileEntry, setFileRawBuffer already exist]
const ACCEPTED_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'avif'])
const ACCEPTED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif'])

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function isAccepted(file: File): boolean {
  const ext = getExt(file.name)
  return ACCEPTED_EXTS.has(ext) || ACCEPTED_MIMES.has(file.type)
}

async function fileToEntry(file: File): Promise<FileEntry> {
  const id = crypto.randomUUID()
  const ext = getExt(file.name)
  const type = ext === 'jpg' ? 'jpg' : ext  // normalize
  const rawBuffer = await file.arrayBuffer()
  const dim = await readDimensions(file, type)

  return {
    id,
    name: file.name,
    type,
    orig: file.size,       // D-08: truthful
    opt: file.size,        // pending — will be updated by setFileResult
    status: 'queued',
    target: type,          // default target = same as source
    dim,
    q: 82,
    settings: defaultFileSettings(type, 82),
    rawBuffer,
  }
}
```

### Pattern 4: Reading Image Dimensions

**Raster files (png, jpg, jpeg, webp, avif):** `createImageBitmap` is the recommended approach — it is non-blocking (returns a Promise), available in all modern browsers and workers, and avoids creating an `<img>` element. [CITED: developer.mozilla.org/en-US/docs/Web/API/createImageBitmap]

```ts
// Source: MDN — createImageBitmap
async function readDimensions(file: File, type: string): Promise<string> {
  if (type === 'svg') return '—'   // SVG has no intrinsic raster dims
  try {
    const bitmap = await createImageBitmap(file)
    const dim = `${bitmap.width}×${bitmap.height}`
    bitmap.close()   // free memory
    return dim
  } catch {
    return '—'       // decoding failed — return unknown, never block ingest
  }
}
```

**SVG:** Return `'—'` — SVG dimensions are in viewBox/width/height attributes. Parsing XML at ingest time is unnecessary overhead and the UI already renders `'—'` for missing dims.

### Pattern 5: Auto-Optimize Dispatch (D-03)

The cleanest approach is to call `runOptimize()` from `useOptimize` immediately after appending entries. `runOptimize` already iterates `filesAtom.get().entries`, so newly appended entries are included automatically. [VERIFIED: codebase — useOptimize.ts confirmed]

```ts
// Inside useIngest:
async function ingest(files: File[]): Promise<void> {
  const accepted = files.filter(isAccepted)   // D-06/D-07: silent-skip others
  if (accepted.length === 0) return

  const entries = await Promise.all(accepted.map(fileToEntry))

  // Append to store + auto-select newest
  filesAtom.setKey('entries', [...filesAtom.get().entries, ...entries])
  selectFile(entries[entries.length - 1].id)

  // Cache rawBuffers in store (useOptimize reads them from entry.rawBuffer)
  for (const entry of entries) {
    if (entry.rawBuffer) setFileRawBuffer(entry.id, entry.rawBuffer)
  }

  // D-03: auto-optimize all (runOptimize from useOptimize)
  await runOptimize()
}
```

**Why NOT `useLiveEncode` for ingest dispatch:** `useLiveEncode` is debounced and single-file — designed for the inspector's re-encode path (D-09). Using it for ingest would require calling it once per file with no clean way to batch. `useOptimize` already handles the batch and is the correct tool for ingest-triggered optimization.

**Phase 11 boundary:** The explicit "Optimize all" button in the Toolbar already calls `runOptimize()`. Phase 11 adds progress reporting and per-file status through the pool — NOT a new dispatch path.

### Pattern 6: Emptying the Seed (D-04)

**files.ts change:**
```ts
// Before (Phase 9):
export const filesAtom = map<FilesState>({
  entries: STUB_FILES,
  ...
})

// After (Phase 10):
export const filesAtom = map<FilesState>({
  entries: [],           // D-04: no seeded demos
  selectedId: null,
  filterQuery: '',
  sortBy: 'queue order',
})
```

**Sort order fix:** The `$filteredFiles` computed atom currently sorts by `STUB_FILES.findIndex` for 'queue order'. After removing STUB_FILES as the seed, 'queue order' must sort by insertion order (e.g., preserve the array order, which already reflects push order). Since `filesAtom.setKey` replaces the full array, insertion order is preserved naturally — remove the `STUB_FILES.findIndex` sort and replace with a no-op (return array as-is) or sort by a monotonic `createdAt` timestamp added to FileEntry.

**Simplest fix:** Add `createdAt: number` (Date.now()) to FileEntry at ingest; sort 'queue order' by `a.createdAt - b.createdAt`.

### Anti-Patterns to Avoid

- **Inline ingest logic in FilesPane/Toolbar:** Project rule: logic in hooks/stores, never in components. [VERIFIED: codebase — CLAUDE.md + memory/MEMORY.md]
- **Dispatching per-file `useLiveEncode` on ingest:** It's debounced and single-file; use `useOptimize` for the ingest batch.
- **Passing `Response` directly to jSquash `init()`:** Known issue — must pass ArrayBuffer (Phase 9 research documented this).
- **Not calling `e.preventDefault()` on `dragover`:** The drop event will not fire without it. [CITED: MDN HTML Drag and Drop API]
- **Using `dragenter` counter to track drag state:** Flickers on child elements. Use `relatedTarget` check in `dragleave` instead.
- **Blocking ingest on dimension read failure:** Wrap `createImageBitmap` in try/catch, return `'—'` on error — never throw.
- **Leaving STUB_FILES sort logic in `$filteredFiles`:** `STUB_FILES.findIndex` returns -1 for real entries, sorting them all to the front in the wrong order. Must replace with insertion-order sort after D-04.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File format detection | Custom MIME sniffer | Extension check + `file.type` (MIME) | Two-line gate; browser populates `file.type` correctly for all target formats |
| Image dimension reading | `<img>` load hack / FileReader | `createImageBitmap(file)` | Non-blocking, returns Promise, no DOM attachment needed |
| ID generation | Random string utility | `crypto.randomUUID()` | Cryptographically random, collision-free, Web Platform standard |
| File picker dialog | Custom modal | `showOpenFilePicker()` + `<input>` fallback | OS native; no package needed |
| Batch encode dispatch | New dispatch loop | `useOptimize()` (Phase 9) | Already iterates entries + handles allSettled error isolation |
| Re-encode on settings change | New debounce | `useLiveEncode()` (Phase 9) | Already 300ms debounced + CR-02 stale-result guard |

---

## Truthful Sizes (D-08)

**What already works:** `DeltaStrip` reads `selectedFile.encodedBuffer.byteLength` for the "after" size (Phase 9 Plan 04 wired this). `ReportPanel` reads `entry.opt` which is set by `setFileResult(id, buffer, optimizedSize)`. [VERIFIED: codebase — DeltaStrip.tsx, ReportPanel.tsx]

**What Phase 10 changes:** At FileEntry creation, set `orig = File.size`. Previously stubs had fabricated `orig` values. No changes to DeltaStrip or ReportPanel are required — they already derive from `entry.orig` and `entry.encodedBuffer.byteLength`.

**Pending state (D-10):** Between ingest and first encode, `opt` starts equal to `File.size` (no savings shown yet). DeltaStrip's shimmer (animate-pulse) triggers when `runtimeAtom.encodingFileId` is set — `useOptimize` should call `setEncodingFile(id)` per entry before dispatching (same pattern as `useLiveEncode`). Alternatively, setting `status: 'processing'` and shimmer-gating on status is cleaner and avoids per-file state in runtimeAtom. **Recommendation:** Set `status: 'processing'` at entry creation, update to `'done'` / `'error'` inside `setFileResult` / `setFileError`.

---

## Common Pitfalls

### Pitfall 1: dragenter/dragleave child-element flicker
**What goes wrong:** `dragenter` fires for every child element the cursor enters, firing `dragleave` for the parent — `dragActive` toggles rapidly.
**Why it happens:** Bubbling of drag events through the DOM.
**How to avoid:** In `handleDragLeave`, check `e.relatedTarget` — only clear `dragActive` if the new target is outside the root element (`!e.currentTarget.contains(e.relatedTarget as Node)`).
**Warning signs:** Dropzone border flickers while hovering over text/icons inside it.

### Pitfall 2: sort 'queue order' breaks after removing STUB_FILES seed
**What goes wrong:** `$filteredFiles` sorts by `STUB_FILES.findIndex(f => f.id === entry.id)` — returns -1 for all real entries, making insertion order unpredictable.
**Why it happens:** The sort was written assuming entries are always STUB_FILES members.
**How to avoid:** Add `createdAt: number` to FileEntry, set to `Date.now()` at ingest; sort 'queue order' by `a.createdAt - b.createdAt`.

### Pitfall 3: Forgetting `e.preventDefault()` on dragover
**What goes wrong:** The `drop` event never fires; the browser navigates to the dropped file's URL.
**How to avoid:** Always `e.preventDefault()` on both `dragover` and `drop`.

### Pitfall 4: `showOpenFilePicker` throws on cancel
**What goes wrong:** If the user opens the picker and presses Cancel, `showOpenFilePicker()` throws `AbortError` — an uncaught promise rejection.
**How to avoid:** Wrap in try/catch; ignore `AbortError`, re-throw others.

### Pitfall 5: rawBuffer already transferred on second runOptimize call
**What goes wrong:** `rawBuffer.slice(0)` in `useOptimize` sends a copy to the worker. The original `rawBuffer` in the store survives. But if `rawBuffer` is stored as the transferred ArrayBuffer (byteLength 0), re-encoding fails silently.
**How to avoid:** Always `slice(0)` before passing to `pool.run(job)`. Phase 9 already does this. Confirm `setFileRawBuffer` stores the original (not a transferred view). [VERIFIED: codebase — useOptimize.ts uses `rawBuffer.slice(0)` before dispatch]

### Pitfall 6: SVG width/height from `createImageBitmap` is browser-dependent
**What goes wrong:** `createImageBitmap` on an SVG with no explicit width/height may return 0×0 or throw in some browsers.
**How to avoid:** For SVG files, return `'—'` immediately without calling `createImageBitmap`. [ASSUMED — verified behavior across browsers is inconsistent]

### Pitfall 7: per-file-settings tests rely on `entries.length >= 2`
**What goes wrong:** `per-file-settings.spec.ts` calls `page.evaluate` and checks `if (entries.length < 2) return { error: 'Need at least 2 entries' }`. After D-04, entries start empty.
**How to avoid:** The shared fixture helper must inject at least 2 entries for this test.

---

## Test Fixture Strategy (D-05)

### Recommended Approach: `page.evaluate` store injection

Inject FileEntry objects directly into `filesAtom` via `page.evaluate`. This is:
- Fast (no UI interaction lag)
- Deterministic (exact entry shape control)
- Compatible with the existing `page.evaluate(() => import('/src/stores/files.ts'))` pattern already used in `per-file-settings.spec.ts`

```ts
// src/tests/fixtures/ingest-helper.ts
import type { Page } from '@playwright/test'

export async function ingestFixtureFiles(page: Page, count = 1): Promise<void> {
  await page.evaluate(async (n) => {
    const { filesAtom, setFileRawBuffer } = await import('/src/stores/files.ts')
    const { defaultFileSettings } = await import('/src/lib/stub-data.ts')
    // Tiny valid PNG bytes (base64 — same TINY_PNG_B64 from stub-data.ts)
    const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    function b64ToBuffer(b64: string): ArrayBuffer {
      const bin = atob(b64); const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      return buf.buffer as ArrayBuffer
    }
    const entries = Array.from({ length: n }, (_, i) => {
      const id = `fixture-${i}`
      const rawBuffer = b64ToBuffer(TINY_PNG_B64)
      return {
        id, name: `fixture-${i}.png`, type: 'png',
        orig: rawBuffer.byteLength, opt: rawBuffer.byteLength,
        status: 'done' as const, target: 'png', dim: '1×1',
        q: 82, createdAt: Date.now() + i,
        settings: defaultFileSettings('png', 82),
        rawBuffer,
      }
    })
    filesAtom.setKey('entries', entries)
    filesAtom.setKey('selectedId', entries[0].id)
    for (const e of entries) {
      if (e.rawBuffer) setFileRawBuffer(e.id, e.rawBuffer)
    }
  }, count)
}
```

**Alternative: `page.setInputFiles`** — Playwright's `setInputFiles` can set files on a hidden `<input type="file">`. This requires the input to exist in the DOM and is slightly more realistic, but triggers the full ingest pipeline including async `createImageBitmap` and `runOptimize`. For unit-level Playwright tests, the `page.evaluate` approach is simpler and faster.

### Specs to Update

| Spec | Currently relies on | Fix |
|------|--------------------|----|
| `navigation.spec.ts` — "Clicking Optimize all flips worker pip" | `runOptimize()` on STUB_FILES; works even without files | Low risk — may still pass without files if the button fires the event |
| `inspector-tabs.spec.ts` | `page.getByText('hero-banner@2x.png').click()` | Replace with `ingestFixtureFiles(page, 1)` before click |
| `output-panel.spec.ts` | `page.getByText('hero-banner@2x.png').click()` | Same |
| `per-file-settings.spec.ts` | `entries.length >= 2` guard | `ingestFixtureFiles(page, 2)` before evaluate |
| `backpressure.spec.ts` | Doesn't select a file; only clicks "Optimize all" | Low risk — likely passes without files |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright ^1.59.1 |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npm test -- --grep "OPT-01"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-01 / SC-1 | Drop a file → real optimized output appears | e2e (Playwright) | `npm test -- --grep "drop.*file.*optimized"` | ❌ Wave 0 |
| OPT-01 / SC-2 | Report shows accurate before/after bytes + savings % | e2e (Playwright) | `npm test -- --grep "Report.*bytes"` | ❌ Wave 0 |
| OPT-01 / SC-3 | Re-adjust setting → re-optimizes → updated sizes | e2e (Playwright) | `npm test -- --grep "settings change.*re-optimize"` | ❌ Wave 0 |
| D-04 | App starts empty (no stub files) | e2e (Playwright) | `npm test -- --grep "empty.*initial"` | ❌ Wave 0 |
| D-06/D-07 | Unsupported file silently skipped | e2e (Playwright) | `npm test -- --grep "silent.skip"` | ❌ Wave 0 |
| D-05 fix | inspector-tabs.spec selects real fixture file | e2e (Playwright) | `npm test -- inspector-tabs` | ✅ (needs update) |
| D-05 fix | per-file-settings.spec uses 2 fixture entries | e2e (Playwright) | `npm test -- per-file-settings` | ✅ (needs update) |

### Wave 0 Gaps

- [ ] `src/tests/fixtures/ingest-helper.ts` — shared `ingestFixtureFiles(page, n)` helper used by all D-05 migration specs
- [ ] `src/tests/ingest.spec.ts` — new spec covering OPT-01 success criteria 1/2/3 + D-04 empty start + D-06/D-07 silent skip
- [ ] Update `src/tests/inspector-tabs.spec.ts` — replace `hero-banner@2x.png` text lookup with `ingestFixtureFiles`
- [ ] Update `src/tests/output-panel.spec.ts` — same
- [ ] Update `src/tests/per-file-settings.spec.ts` — inject 2 fixture entries before evaluate

### Sampling Rate

- **Per task commit:** `npm test -- --grep "OPT-01|ingest|empty"` (ingest.spec.ts only)
- **Per wave merge:** `npm test` (full suite — verify D-05 migrations don't break existing specs)
- **Phase gate:** Full suite green before `/gsd:verify-work`

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes | Format gate in `useIngest` (ext + MIME check); `createImageBitmap` rejects malformed files at decode |
| V6 Cryptography | No | No crypto operations in this phase |
| V2 Authentication | No | Zero-server; all processing is local |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No server; no ACLs |

**Key security note:** All file processing is client-only — no bytes leave the browser (zero-server constraint). The format gate (D-06/D-07) is a UX filter, not a security boundary; `createImageBitmap` and the jSquash decoders are the actual malformed-input barriers. Malformed files that pass the extension check will fail at `createImageBitmap` or inside the codec worker — both throw safely and the Phase 9 D-13 error path surfaces these as per-file errors without crashing the app.

---

## Environment Availability

Phase 10 is pure browser/client-side code + test updates. No new external tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Playwright | Test suite | ✓ | ^1.59.1 | — |
| `crypto.randomUUID()` | FileEntry id generation | ✓ | Browser built-in (Chrome 92+, all modern) | `Math.random()` hex string |
| `createImageBitmap` | Dimension reading | ✓ | Browser built-in (all target browsers) | Return `'—'` on error |
| `showOpenFilePicker` | Enhanced file picker | ✓ (Chrome/Edge 86+) | Browser built-in | `<input type="file">` fallback |

---

## Open Questions

1. **`createdAt` field on FileEntry**
   - What we know: 'queue order' sort uses `STUB_FILES.findIndex` which breaks after D-04.
   - What's unclear: Whether to add `createdAt: number` to `FileEntry` type, or sort by array index (implicit push order).
   - Recommendation: Add `createdAt: Date.now()` at ingest — explicit, testable, forward-compatible with Phase 11 batch sorting. Add to `FileEntry` interface in `stub-data.ts`.

2. **Status transitions: 'queued' → 'processing' → 'done'/'error'**
   - What we know: `FileEntry.status` type is `'done' | 'processing' | 'queued' | 'error'`. `useOptimize` does not currently set status per entry.
   - What's unclear: Whether to set `status: 'processing'` before dispatch and `status: 'done'` in `setFileResult` — this enables the shimmer without needing `runtimeAtom.encodingFileId`.
   - Recommendation: Wire status transitions inside `useOptimize` (`updateEntry(id, () => ({ status: 'processing' }))` before dispatch; `setFileResult` sets `status: 'done'`).

3. **`addFromDevice` function signature change**
   - What we know: Currently `addFromDevice(): void` (no args). After Phase 10 it needs to accept a `FileList` or trigger the picker and ingest.
   - What's unclear: Whether to keep it as a store action that triggers the picker, or move the picker trigger entirely to the component/hook layer.
   - Recommendation: Keep `addFromDevice` as a store-level no-op or remove it; have the component call `useIngest`'s `openPicker()` directly. This avoids coupling store actions to UI-layer async picker flows.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `showOpenFilePicker` is available in Safari 15.2+ (within "last 2 stable") | Pattern 2: File Picker | If Safari support is narrower, more users hit the `<input>` fallback — functional but less native |
| A2 | SVG `createImageBitmap` behavior is inconsistent across browsers (returns 0×0 or throws) | Pitfall 6 | If it works consistently, we could show real SVG canvas dims; safe to return `'—'` either way |
| A3 | `backpressure.spec.ts` and `navigation.spec.ts` "Optimize all" tests pass without any files in the queue | Test Fixture Strategy | If `useOptimize` returns early on empty entries (which it does — for loop over empty array), these tests still pass |

**All core implementation claims are VERIFIED against the existing codebase.**

---

## Sources

### Primary (HIGH confidence)
- `src/stores/files.ts` — confirmed: `addFromDevice` stub, `STUB_FILES` seed, `updateEntry`, `setFileResult`, `setFileRawBuffer`, `setFileRawBuffer` signatures [VERIFIED: codebase]
- `src/hooks/useOptimize.ts` — confirmed: iterates `filesAtom.get().entries`, `rawBuffer.slice(0)` pattern, `setFileResult` dispatch [VERIFIED: codebase]
- `src/hooks/useLiveEncode.ts` — confirmed: 300ms debounce, single-file, CR-02 stale guard [VERIFIED: codebase]
- `src/lib/stub-data.ts` — confirmed: `defaultFileSettings`, `STUB_FILES`, `sampleBytesFor`, `FileEntry` interface [VERIFIED: codebase]
- `src/components/panels/FilesPane.tsx` — confirmed: dropzone markup exists, no handlers [VERIFIED: codebase]
- `src/components/shell/Toolbar.tsx` — confirmed: `addFromDevice()` called on button click (currently no-op) [VERIFIED: codebase]
- `src/components/panels/center/DeltaStrip.tsx` — confirmed: reads `encodedBuffer.byteLength` for opt [VERIFIED: codebase]
- `src/components/panels/inspector/ReportPanel.tsx` — confirmed: reads `entry.orig` and `entry.opt` [VERIFIED: codebase]
- MDN HTML Drag and Drop API [CITED: developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API]
- MDN createImageBitmap [CITED: developer.mozilla.org/en-US/docs/Web/API/createImageBitmap]
- MDN showOpenFilePicker [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker]

### Secondary (MEDIUM confidence)
- Squoosh auto-optimize-on-load pattern referenced in CONTEXT.md as explicit analog for D-03 [CITED: 10-CONTEXT.md specifics section]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all APIs are Web Platform built-ins already targeted
- Architecture: HIGH — confirmed against actual codebase code paths
- Pitfalls: HIGH for drag-drop quirks (well-documented Web Platform behavior); MEDIUM for SVG dimension cross-browser behavior

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable Web Platform APIs; no fast-moving dependencies)
