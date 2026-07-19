# Phase 11: Batch Optimize + Export — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 14 (8 new, 6 modified) + 4 test files + package.json
**Analogs found:** 14 / 14 (every new file has a strong same-project analog)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/output-filename.ts` (new) | utility / lib | pure transform | `src/lib/format.ts` | role-match (pure utility module) |
| `src/lib/save-file.ts` (new) | utility / lib | browser-API dispatcher | `src/hooks/useIngest.ts` (openPicker WR-05 dispatcher) | exact (FS Access API + fallback pattern) |
| `src/lib/build-zip.ts` (new) | utility / lib | async transform (Blob out) | `src/lib/snippets.ts` (async builders returning text) | role-match (async builder) |
| `src/hooks/useExport.ts` (new) | hook | orchestrator (store read → side effects) | `src/hooks/useOptimize.ts` | exact (same shape: read filesAtom, do work, toast on outcome) |
| `src/components/panels/files/FileRowMenu.tsx` (new, or extend FileRow) | component | UI / event wiring | existing ContextMenu inside `src/components/panels/files/FileRow.tsx` | exact (already a `ContextMenu` in the row) |
| `src/tests/batch-progress.spec.ts` (new) | test (e2e) | playwright | `src/tests/backpressure.spec.ts` + `src/tests/worker-pipeline.spec.ts` | exact |
| `src/tests/export-single.spec.ts` (new) | test (e2e) | playwright + download event | `src/tests/backpressure.spec.ts` (Optimize-all click) | role-match |
| `src/tests/export-zip.spec.ts` (new) | test (e2e) | playwright + download | `src/tests/backpressure.spec.ts` | role-match |
| `src/tests/output-filename.test.ts` (new) | test (unit, node) | pure assertion | `src/tests/format.test.ts` | exact (`node --experimental-strip-types` runner pattern) |
| `src/hooks/useOptimize.ts` (modify) | hook | orchestrator | itself (refactor in place) | self |
| `src/stores/files.ts` (modify) | store | mutating action | self — empty `exportAsZip` / `exportIndividually` stubs already present | self |
| `src/components/panels/files/FileRow.tsx` (modify) | component | UI / event wiring | self — already has `ContextMenu` with stub `Save as…` ContextMenuItem | self |
| `src/components/shell/StatusBar.tsx` (modify) | component | derived view (read-only) | `src/components/shell/BackpressureIndicator.tsx` (role=status + aria-live) | exact (a11y idiom) |
| `src/components/shell/Toolbar.tsx` (modify) | component | UI / event wiring | self — already wires `exportAsZip` / `exportIndividually` onClick | self |
| `src/components/panels/inspector/ReportPanel.tsx` (modify) | component | UI / event wiring | `src/components/panels/inspector/OutputPanel.tsx` (Button + copy pattern) | role-match |
| `src/main.tsx` (modify) | config | test-only window bridge | existing `registerCommands` boot init in `src/main.tsx` | self |
| `package.json` (modify) | config | manifest | self | self |

## Pattern Assignments

### `src/lib/output-filename.ts` (utility, pure transform)

**Analog:** `src/lib/format.ts` (zero-dep pure-function lib module — same shape, same testing approach).

**Imports / module-top pattern** (from `src/lib/format.ts:1-3`):
```typescript
// Byte / percentage formatters — ported from example-ui/data.jsx with zero-savings guard (returns '').
// Phase 01, Plan 04 — STORE-06
```
Single source-comment line + the phase tag. No imports. Just named `export function` declarations.

**Pure-function export shape** (from `src/lib/format.ts:4-9`):
```typescript
export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}
```
Copy this shape (top-level `export function`, no class). New helpers per RESEARCH §Code Examples: `renameExtension`, `collisionSuffix`, `timestampedZipName`, `mimeFor`, `sanitizeBaseName` (Security §V5 — strip `/`, `\`, `\0` before zip insertion).

**Why this analog:** Only other zero-dep pure-string-helper module in the codebase. Same project rule (utilities live in `src/lib`, never inline).

---

### `src/lib/save-file.ts` (utility, browser-API dispatcher)

**Analog:** `src/hooks/useIngest.ts` `openPicker()` (lines 121-171). This is the canonical "FS Access API native path + fallback" pattern in this project — Phase 10 WR-05.

**Feature-detect + secure-context gate + AbortError swallow** (from `src/hooks/useIngest.ts:122-146`):
```typescript
async function openPicker(fallbackTrigger?: () => void): Promise<void> {
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await (window as { showOpenFilePicker: (opts: object) => Promise<FileSystemFileHandle[]> })
        .showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Images',
              accept: {
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
                // ... MIME → ext[] dict — RESEARCH Pitfall: NOT the other way around
              },
            },
          ],
        })
      const files = await Promise.all(handles.map((h) => h.getFile()))
      await ingest(files)
    } catch (err) {
      // Pitfall 4: swallow AbortError (user cancelled picker) — re-throw everything else
      if ((err as DOMException).name !== 'AbortError') throw err
    }
  } else if (fallbackTrigger) {
    fallbackTrigger()
  }
```

**Copy three things verbatim:**
1. The `'showSaveFilePicker' in window` feature-detect cast through `(window as { showSaveFilePicker: ... })` — TS lib.dom doesn't ship the type yet.
2. The `AbortError` silent-swallow in `catch` (user cancel is NOT an error).
3. The `accept` dict's `MIME → string[]` direction (RESEARCH §Pattern 2 gotcha).

**Differences from analog:**
- Add `window.isSecureContext === true` to the gate (RESEARCH §Pattern 2 — `showSaveFilePicker` requires it; `showOpenFilePicker` is more lenient).
- Pass `forceFallback?: boolean` opt for the D-06 bulk path (RESEARCH §Pattern 2 SaveOptions interface).
- Fallback path = `saveAs` from `file-saver` (RESEARCH §Pattern 2), NOT the synthesized hidden input from `useIngest`. Different direction (save vs open).

**Why this analog:** Same project's existing feature-detect-and-fallback pattern. Phase 10 verified this shape works cross-browser.

---

### `src/lib/build-zip.ts` (utility, async transform)

**Analog:** `src/lib/snippets.ts` (async builders that return content; called from components/hooks).

**Async-builder export shape** (from `src/components/panels/inspector/OutputPanel.tsx:9`):
```typescript
import { buildBase64Snippet, buildUrlEncodedSnippet, buildPictureSnippet } from '@/lib/snippets'
```
Copy: top-level `export async function buildZip(entries: FileEntry[]): Promise<Blob>` returning a single `Blob`. No React, no store reads inside — caller passes in `entries`. Matches the `snippets.ts` discipline.

**Internals to implement (per RESEARCH §Pattern 3, verbatim):**
```typescript
import JSZip from 'jszip'
const zip = new JSZip()
const used = new Set<string>()
for (const e of entries) {
  const name = collisionSuffix(renameExtension(e.name, e.target), used)
  used.add(name)
  zip.file(name, e.encodedBuffer!)
}
const blob = await zip.generateAsync({
  type: 'blob',
  streamFiles: true,                       // Pitfall 6 — required
  compression: 'DEFLATE',
  compressionOptions: { level: 1 },        // already-compressed inputs
})
return blob
```

**Why this analog:** `snippets.ts` is the project's pattern for "async pure function takes an entry, returns text/bytes". `buildZip` is the same shape with `Blob` output.

---

### `src/hooks/useExport.ts` (hook, orchestrator)

**Analog:** `src/hooks/useOptimize.ts` (closest behavioural analog: reads `filesAtom.get()`, does async work, toasts on outcome).

**Imports pattern** (from `src/hooks/useOptimize.ts:1-8`):
```typescript
// Phase 08 — PIPE-04: useOptimize — bridge filesAtom → WorkerPool. Source: 08-02-PLAN.md
// Phase 09 — Plan 03: Real-bytes dispatch + rawBuffer caching + setFileResult/setFileError (D-04/D-13)
import { useStore } from '@nanostores/react'
import { filesAtom, setFileResult, setFileError, setFileRawBuffer } from '@/stores/files'
import { settingsAtom } from '@/stores/settings'
import { getPool } from '@/lib/worker-pool'
import { toast } from 'sonner'
import type { EncodeJob } from '@/workers/codec.worker'
```
Copy the header-comment style, `@/stores/files` + `sonner` imports, and the hook's overall shape.

**Hook shape — read live store, do async work, return imperative functions** (from `src/hooks/useOptimize.ts:54-126`):
```typescript
export function useOptimize() {
  // useStore subscription kept for components that useOptimize for reactive UI (e.g. progress).
  // runOptimize reads filesAtom.get() directly to avoid stale-closure bug
  useStore(filesAtom)

  async function runOptimize(): Promise<void> {
    // Always read the live atom value — not the stale useStore snapshot
    const { entries } = filesAtom.get()
    // ... work ...
  }

  return { runOptimize }
}
```
**Critical pattern: `filesAtom.get()` directly, NOT the useStore snapshot.** The stale-closure rationale on lines 56-59 applies identically to `useExport` (auto-optimize + auto-export sequences cannot wait for re-render).

**`toast.error` on per-file failure** (from `src/hooks/useOptimize.ts:120`):
```typescript
toast.error('Encode failed: ' + name)
```
Use `toast.success(...)` and `toast.error(...)` from `sonner` — already a dep. Match the inline-concatenation phrasing.

**Returned API:** `{ exportOne, exportZip, exportIndividually }` (RESEARCH §Code Examples) — three async functions, just like `useOptimize` returns `{ runOptimize }`.

**Why this analog:** Identical "hook owns business logic, components only wire" project rule (CLAUDE.md §Conventions, memory `architecture_file_business_logic.md`). Same toast idiom. Same `filesAtom.get()` discipline.

---

### `src/hooks/useOptimize.ts` (MODIFY — streaming refactor, D-03)

**Self-modify. Current code to replace** (lines 107-122):
```typescript
// allSettled: per-file failure never aborts the batch (D-13 / T-9-FB)
const settled = await Promise.allSettled(pairs.map(([, , job]) => pool.run(job)))

for (let i = 0; i < settled.length; i++) {
  const [id, name] = pairs[i]
  const outcome = settled[i]
  if (outcome.status === 'fulfilled') {
    const { buffer, optimizedSize } = outcome.value
    setFileResult(id, buffer, optimizedSize)
  } else {
    const reason = String((outcome as PromiseRejectedResult).reason)
    setFileError(id, reason)
    toast.error('Encode failed: ' + name)
  }
}
```

**Replace with the per-promise streaming write-back shape from RESEARCH §Pattern 1:**
```typescript
const promises = pairs.map(([id, name, job]) =>
  pool.run(job).then(
    ({ buffer, optimizedSize }) => setFileResult(id, buffer, optimizedSize),
    (err) => {
      setFileError(id, String(err))
      toast.error('Encode failed: ' + name)
    },
  )
)
await Promise.all(promises)
```

**Also add D-11 filter just before building `pairs`** (currently the loop iterates ALL entries — lines 70-105):
```typescript
for (const entry of entries) {
  if (entry.status === 'done') continue   // D-11: skip already-optimized
  // ... existing toCodec / toSourceFormat / rawBuffer / job construction unchanged ...
}
```

**Preservation contract (RESEARCH §Pattern 1 + §Pitfall 1):** All N promises must be created in a single `.map(...)` synchronously THEN awaited as `Promise.all`. Do NOT `await pool.run(job)` inside the loop — that serializes to concurrency = 1 and defeats `WorkerPool._drain()`. SC-4 e2e test will catch this regression.

---

### `src/stores/files.ts` (MODIFY — wire export stubs)

**Self-modify. Current empty stubs** (lines 86-91):
```typescript
// Export stubs — real handlers wired in v2
export function exportAsZip(): void {}
export function exportIndividually(): void {}
export function exportCopyHtml(): void {}
export function exportCopyDataUris(): void {}
export function exportManifestJson(): void {}
```

**Pattern to follow:** Keep the export-function names + signatures (Toolbar binds to them on line 7 of `Toolbar.tsx`); replace bodies with calls into the hook-owned logic. But `useExport` is a React hook, not a callable from a non-component module. **Resolution per CONTEXT §Integration Points: move the wiring into the Toolbar component** — replace these store-level stubs by binding the Toolbar buttons directly to `useExport().exportZip` / `.exportIndividually`. Leave the deferred stubs (`exportCopyHtml`, `exportCopyDataUris`, `exportManifestJson`) untouched (Phase 12).

**Add a derived atom for D-13 disable selector** (per RESEARCH §Pattern 5):
```typescript
// Already-present derived atom pattern in this file — copy this shape from src/stores/files.ts:25-53
import { computed } from 'nanostores'
export const $hasDone = computed(filesAtom, (s) =>
  s.entries.some(e => e.status === 'done')
)
```
The `computed(filesAtom, ...)` form is already used 3× in this file ($filteredFiles, $selectedFile, $totals) — match it.

---

### `src/components/panels/files/FileRow.tsx` (MODIFY — wire ContextMenu "Save as…")

**Self-modify. Existing stub to wire** (lines 136-139):
```typescript
<ContextMenuItem onSelect={() => { /* @TODO Phase 3 — pushToast('Save as') */ }}>
  <DownloadSimple size={14} />
  Save as…
</ContextMenuItem>
```

**Pattern: replace `onSelect` body with hook-bound call.** Above the return, near the existing `useStore` calls (lines 42-43):
```typescript
const { exportOne } = useExport()
```
Then:
```typescript
<ContextMenuItem
  disabled={file.status !== 'done'}
  onSelect={() => { void exportOne(file) }}
>
  <DownloadSimple size={14} />
  Save as…
</ContextMenuItem>
```

**Note on D-04 vs "new menu component":** the file plan list mentions `FileRowMenu.tsx`, but the **existing `ContextMenu` inside `FileRow.tsx`** (lines 73-163) already implements the D-04 pattern — Radix `ContextMenu` from `@/components/ui/context-menu` with full keyboard a11y (ESC + arrow nav inherited from Radix). The `ctxbtn` (lines 117-123) already synthesizes a contextmenu event on click via `dispatchEvent(new MouseEvent('contextmenu', ...))` (lines 53-63). **Recommendation: do not extract a new file** — wire the existing stub. If the planner wants a separate file for organization, lift `<ContextMenuContent>...</ContextMenuContent>` into `FileRowMenu.tsx` and `import { FileRowMenu } from './FileRowMenu'`. Either is fine; the simpler wire-in-place is preferred (matches Phase 10's "do not over-extract" precedent).

---

### `src/components/shell/StatusBar.tsx` (MODIFY — add aggregate counter + aria-live)

**Self-modify. Current structure** (lines 8-46) already has the container with `role="status" aria-live="polite"` (lines 14-19) AND already reads `useStore(filesAtom)` (line 11) AND already reads `useStore(runtimeAtom)` (line 9). Add the aggregate counter inline.

**a11y idiom analog:** `src/components/shell/BackpressureIndicator.tsx` (lines 6-20) shows the canonical `role="status" aria-live="polite"` pattern with **conditional `aria-label`** that disappears when idle (line 13: `aria-label={running ? 'Optimization running' : undefined}`). Apply the same idiom: announce only when the counter is interesting.

**Pattern to add** (RESEARCH §Pattern 4 verbatim):
```typescript
const { runningJobs, queuedJobs } = useStore(runtimeAtom)
const { entries } = useStore(filesAtom)
const done = entries.filter(e => e.status === 'done').length
const total = entries.length
const active = runningJobs + queuedJobs > 0
// Insert after the existing worker-pip spans, before the version spans:
<span
  data-testid="agg-counter"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="font-mono text-[11px]"
>
  {total > 0 ? `${done}/${total} optimized` : ''}
</span>
```

**Pitfall 4 mitigation:** the surrounding container already has `aria-live="polite"` (line 17). Two live regions in one container will compete. **Either** remove the outer `aria-live` (move it down only to the agg-counter), **or** keep the outer and rely on `aria-atomic` for the counter alone. RESEARCH recommends throttling via `useDeferredValue` if announcement spam appears in screen-reader tests.

---

### `src/components/shell/Toolbar.tsx` (MODIFY — wire export + D-13 disable)

**Self-modify. Current bindings** (lines 7-9, 88-114):
```typescript
import { filesAtom, setFilter, addWatchFolder, addFromUrl, exportAsZip, exportIndividually, ... } from '@/stores/files'
// ...
onClick={() => { exportAsZip(); setOpen(null) }}
onClick={() => { exportIndividually(); setOpen(null) }}
```

**Pattern: replace store-imports with hook**:
```typescript
// Remove exportAsZip / exportIndividually from the @/stores/files import
import { useExport } from '@/hooks/useExport'
import { $hasDone } from '@/stores/files'
// ...
const { exportZip, exportIndividually } = useExport()
const hasDone = useStore($hasDone)
```

**D-13 disable pattern** (per RESEARCH §Pattern 5):
```typescript
<button
  type="button"
  disabled={!hasDone}
  aria-disabled={!hasDone}
  title={!hasDone ? 'Optimize at least one file first' : undefined}
  className={cn(tbtnClass, 'rounded-r-none border-r-0', !hasDone && 'opacity-50 cursor-not-allowed')}
  onClick={() => { void exportZip(); setOpen(null) }}
>
  <Export size={12} />
  Export
</button>
```
Apply the same `disabled`/`title` to "All as ZIP" and "Save individually" menu items inside the Popover (lines 108-109).

**Why this analog:** Toolbar already follows the "import action from store, call onClick" pattern. The swap is just changing the source — hook instead of store.

---

### `src/components/panels/inspector/ReportPanel.tsx` (MODIFY — add Download button)

**Analog for the button:** `src/components/panels/inspector/OutputPanel.tsx` (uses `import { Button } from '@/components/ui/button'` + icon import + onClick → action).

**Pattern from `OutputPanel.tsx:1-12`:**
```typescript
import { Copy } from '@phosphor-icons/react'
import { $selectedFile } from '@/stores/files'
import { pushToast } from '@/stores/runtime'
import { Button } from '@/components/ui/button'
```

**ReportPanel adds** (near the top of its render, gated on selected file existing and `status === 'done'`):
```typescript
import { useStore } from '@nanostores/react'
import { $selectedFile } from '@/stores/files'
import { DownloadSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useExport } from '@/hooks/useExport'

// inside ReportPanel:
const selected = useStore($selectedFile)
const { exportOne } = useExport()
// ...
{selected && selected.status === 'done' && (
  <Button
    onClick={() => { void exportOne(selected) }}
    aria-label="Download optimized file"
  >
    <DownloadSimple size={14} />
    Download
  </Button>
)}
```

RESEARCH §Open Question 3: add inside `ReportPanel.tsx`, not a new file (kept under ~200 LOC).

---

### `src/main.tsx` (MODIFY — test-only window bridge for SC-4)

**Existing init pattern** (lines 19-21):
```typescript
// Inject ALL_COMMANDS into ui.ts before first render so $cmdFlat is populated immediately.
registerCommands(ALL_COMMANDS.flatMap(g => g.items))
```

**Add a gated bridge** (per RESEARCH §Code Examples — test-only):
```typescript
if (import.meta.env.MODE === 'test' || import.meta.env.DEV) {
  // Test-only: mirror runtimeAtom.runningJobs onto window for SC-4 backpressure peak latch.
  void import('@/stores/runtime').then(({ runtimeAtom }) => {
    runtimeAtom.subscribe((s) => {
      ;(window as { __runningJobs?: number; __peakRunning?: number }).__runningJobs = s.runningJobs
      const prev = (window as { __peakRunning?: number }).__peakRunning ?? 0
      if (s.runningJobs > prev) (window as { __peakRunning?: number }).__peakRunning = s.runningJobs
    })
  })
}
```

**Pattern match:** the existing `registerCommands(...)` init line is the same kind of "boot-time side effect" — small, idempotent, runs once before first render. Gate with `import.meta.env.MODE === 'test'` so production never ships it (CLAUDE.md zero-telemetry constraint).

---

### `src/tests/output-filename.test.ts` (NEW — unit test)

**Analog:** `src/tests/format.test.ts` (verbatim runner pattern).

**Full test harness from `src/tests/format.test.ts:1-35`:**
```typescript
// Phase 01 Plan 01 — Wave 0 Node unit test for format module
// Run: node --experimental-strip-types src/tests/format.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) { passed++ }
  else { failed++; console.error(`FAIL: ${name}`) }
}

try {
  const { fmtBytes, fmtPct } = await import('../lib/format.ts')
  assert('fmtBytes(0) returns "0 B"', fmtBytes(0) === '0 B')
  // ... more asserts ...
} catch (err) {
  if (err instanceof Error && (err.message.includes('format.ts') || (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')) {
    passed++
    console.log('Wave 0 stub state: src/lib/format.ts not yet shipped (expected).')
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
```

**Copy this harness verbatim.** Replace the imports and asserts with the Phase 11 filename helpers (per RESEARCH §Validation Architecture):
- `renameExtension('hero.png', 'webp') === 'hero.webp'`
- `collisionSuffix('a.webp', new Set(['a.webp'])) === 'a (1).webp'`
- `timestampedZipName(new Date('2026-06-01T12:34:00')).match(/^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/)`
- `sanitizeBaseName('../evil.png') === '__evil.png'` (Security §V5)

---

### `src/tests/batch-progress.spec.ts` (NEW — e2e)

**Analog:** `src/tests/backpressure.spec.ts` + RESEARCH §Code Examples (SC-4 backpressure assertion).

**Imports + fixture-ingest pattern** (from `src/tests/backpressure.spec.ts:1-5`):
```typescript
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

test.describe('Batch Progress — OPT-02', () => {
  test('per-row status flips queued→processing→done live (SC-1)', async ({ page }) => {
    await page.goto('/')
    await ingestFixtureFiles(page, 20)
    await page.getByRole('button', { name: 'Optimize all' }).click()
    // ...
  })
})
```

**SC-4 backpressure peak latch** — verbatim from RESEARCH §Code Examples (lines 656-690), depends on the `src/main.tsx` window bridge from this same plan. Pattern: `page.addInitScript` installs an rAF-driven peak tracker, then `page.waitForFunction` polls until peak ≥ 2, then `expect(peak).toBeLessThanOrEqual(4)`.

**Per-row status assertion:** existing FileRow uses `aria-label={`Status: ${file.status}`}` (line 126 of FileRow.tsx). Use:
```typescript
await expect(page.locator('[aria-label^="Status:"]').first()).toHaveAttribute('aria-label', /Status: done/)
```

---

### `src/tests/export-single.spec.ts` (NEW — e2e)

**Analog:** `src/tests/backpressure.spec.ts` (Optimize-all click pattern) + Playwright `page.waitForEvent('download')`.

**Imports pattern** copy verbatim from backpressure.spec.ts lines 1-5.

**Download capture pattern (Playwright idiom):**
```typescript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Download optimized file' }).click(),
])
expect(download.suggestedFilename()).toBe('fixture-0.png')  // D-05: ext-swap; PNG→PNG keeps .png
```

---

### `src/tests/export-zip.spec.ts` (NEW — e2e)

**Analog:** Same as above. Add ZIP-content unzip via `fflate` or Node's `node:zlib` — RESEARCH §Validation Architecture says "verify by unzipping the downloaded blob server-side via Node".

**Pattern for D-13 disabled assertion:** Playwright's `toBeDisabled()`:
```typescript
await expect(page.getByRole('button', { name: 'All as ZIP' })).toBeDisabled()
```

---

### `package.json` (MODIFY — add deps)

**Pattern:** insert into `dependencies` alphabetically. CLAUDE.md-locked versions:
```json
"file-saver": "^2.0.5",
"jszip": "^3.10.1",
```
And into `devDependencies`:
```json
"@types/file-saver": "^2.0.7",
```

## Shared Patterns

### Authentication / Authorization
**N/A** — client-only app, zero-server, zero-auth (CLAUDE.md §Constraints, RESEARCH §Security Domain V2-V4).

### Error Handling (toast-based)
**Source:** `src/hooks/useOptimize.ts:120` and `src/components/panels/InspectorPane.tsx:7,25` (already uses `sonner`).
**Apply to:** All `useExport` paths.

Pattern:
```typescript
import { toast } from 'sonner'
toast.success('20 files exported')
toast.error('Encode failed: ' + name)
toast.success(`${ok.length} files exported, ${skipped} skipped — fix and re-export`)
```
Never `toast.custom` with raw filename interpolation in JSX (RESEARCH §Security XSS mitigation — sonner's default text-only render is safe).

### Store Access Discipline
**Source:** `src/hooks/useOptimize.ts:56-64` (comment explains the rule).
**Apply to:** `useExport` and any other hook spawned by ingest/auto-paths.

Pattern: **Always `filesAtom.get()` directly inside async functions, never the `useStore` snapshot.** The `useStore` call inside the hook is kept ONLY to drive re-renders for any UI bindings the caller component does. Reads inside `async function` bodies use `.get()` to avoid stale-closure on synchronous chained calls (auto-optimize → auto-export sequences).

### Filename Sanitization (Security §V5)
**Source:** New helper in `src/lib/output-filename.ts` per RESEARCH §Security.
**Apply to:** Every code path that calls `zip.file(name, ...)` and every `saveBlob(blob, name, ...)` call.

```typescript
export function sanitizeBaseName(name: string): string {
  return name.replace(/[/\\\0]/g, '_')
}
```
Compose with `renameExtension`: `sanitizeBaseName(renameExtension(e.name, e.target))`. Prevents zip-slip from a source file literally named `../evil.png`.

### Live Region Accessibility
**Source:** `src/components/shell/BackpressureIndicator.tsx:11-13` + `src/components/shell/StatusBar.tsx:15-17`.
**Apply to:** Any new live-announcing region (aggregate counter, ZIP-build progress if added later).

Pattern:
```typescript
<element
  role="status"
  aria-live="polite"
  aria-atomic="true"      // optional but recommended for short status strings
  aria-label={active ? 'human-readable summary' : undefined}
/>
```
Use `polite`, not `assertive` (WAI-ARIA APG — progress is non-urgent). RESEARCH §Pitfall 4 documents the announcement-spam mitigation if it appears in screen-reader tests.

### `nanostores` `computed` Derivation
**Source:** `src/stores/files.ts:25-63` ($filteredFiles, $selectedFile, $totals).
**Apply to:** `$hasDone` for D-13.

Pattern:
```typescript
import { computed } from 'nanostores'
export const $hasDone = computed(filesAtom, (s) => s.entries.some(e => e.status === 'done'))
```
Components consume via `useStore($hasDone)`. **Do not** create a `batchProgressAtom` (RESEARCH §Pattern 4 — pointless memoization).

### Hook + Store Discipline (project rule)
**Source:** `./CLAUDE.md` §Conventions, memory `architecture_file_business_logic.md`, Phase 10 D-03 / WR-01.
**Apply to:** All Phase 11 new code.

Rule: **business logic in `src/hooks/*` and `src/stores/*`, never inline in components.** Components only wire DOM events to hook-returned callables. Verified across the codebase:
- `useIngest.openPicker` / `useIngest.ingest` (hook owns FS Access + format gate + mapping).
- `useOptimize.runOptimize` (hook owns worker dispatch + write-back).
- `useLiveEncode` (hook owns debounced re-encode).
- `Toolbar.tsx` line 76 binds `onClick={runOptimize}` — no logic inside `onClick`.
- `FilesPane`/`FileRow` only call `selectFile`, `removeFile`, etc. from the store.

Phase 11 must continue this:
- `useExport` (hook) owns ZIP build, single-save dispatch, bulk-save throttle.
- `src/lib/save-file.ts` (lib) owns the FS Access API feature-detect + AbortError swallow + fallback.
- Components (Toolbar, FileRow, ReportPanel) call into the hook; their `onClick` bodies are one-liners.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | — | — | Every Phase 11 file has a strong same-project analog. |

## Metadata

**Analog search scope:**
- `src/hooks/` (3 files), `src/lib/` (6 files), `src/stores/` (5 files)
- `src/components/shell/`, `src/components/panels/`, `src/components/ui/`
- `src/tests/` + `src/tests/fixtures/`
- `src/main.tsx`

**Files scanned (Read):** 14 source files + 1 README-level (CONTEXT.md, RESEARCH.md, package.json).

**Pattern extraction date:** 2026-06-01

**Key project rules confirmed (from CLAUDE.md + auto-memory + Phase 10 verification):**
1. File business logic lives in `src/hooks/*` and `src/stores/*`, never inline in components — `architecture_file_business_logic.md`. Phase 11 honors this: `useExport` hook + thin component wiring.
2. Real stack: nanostores + Vite 7 (not zustand/Vite 8 — CLAUDE.md drift documented in `claude-md-stack-drift.md`).
3. Typecheck via `tsc -b`, not `tsc -p`.
4. `import.meta.env.MODE === 'test'` is the correct gate for test-only main.tsx side effects (matches the existing `import.meta.hot` HMR pattern in `worker-pool.ts:78`).
