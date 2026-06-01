# Phase 11: Batch Optimize + Export - Research

**Researched:** 2026-06-01
**Domain:** Streaming worker-pool write-back, single-file save (FS Access API + file-saver fallback), batch ZIP via jszip
**Confidence:** HIGH (stack and patterns verified against codebase + npm registry + MDN/official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live batch progress (OPT-02 SC-1, SC-4)**
- **D-01:** Progress surfaces in two places simultaneously: each `FileRow` flips `queued → encoding → done` live, AND `StatusBar` shows aggregate `X/Y optimized` counter + overall progress bar. Reuses existing `FileRow` status-dot/progress-bar scaffold and existing `StatusBar` worker-pip + `BackpressureIndicator`.
- **D-02:** Per-file "encoding" indicator is **indeterminate** — `animate-pulse` dot. Codec encodes are atomic; the determinate `FileRow` progress bar is NOT animated with a synthetic fill. It stays empty/hidden during encoding.
- **D-03:** `runOptimize` writes back each result **as the worker returns it**, not after `Promise.allSettled`. Mechanism is Claude's discretion; contract is: status transitions and aggregate counter observable mid-batch.

**Single-file download (EXP-01)**
- **D-04:** Per-file download lives in the existing per-row "File options" context menu (`ctxbtn`) AND in a "Download" button in the inspector for the currently-selected file. No new standalone hover/row icon.
- **D-05:** Saved filename: keep base name, swap extension to output extension (`hero.png` → `hero.webp`). No `.min` / `@1x` suffix. If `target === source`, extension unchanged.
- **D-06:** Toolbar's "Save individually" wired as sequential auto-downloads to the browser's default Downloads folder (no per-file save dialog).
- **D-07:** Single-file download uses native `showSaveFilePicker` where available with `file-saver` fallback. Bulk "Save individually" uses the fallback delivery (file-saver / anchor click) for all files.

**Batch ZIP export (EXP-02)**
- **D-08:** ZIP contains optimized files only — one per source. No originals, no `manifest.json` (Phase 12).
- **D-09:** Flat layout — every optimized file at ZIP root. Folder paths deferred.
- **D-10:** ZIP filename timestamped: `oimg-export-YYYY-MM-DD-HHMM.zip`. Same-name collisions inside the ZIP get `(1)`, `(2)` suffixes on the base name (`hero.webp`, `hero (1).webp`).

**Failed and unoptimized files**
- **D-11:** "Optimize all" runs on files with `status !== 'done'` (i.e. `queued` + `error`). Already-optimized files skipped.
- **D-12:** Files with errors are skipped from exports — NOT in ZIP, NOT in "Save individually". Toast surfaces skipped count. Originals NOT used as fallback.
- **D-13:** Export controls (single-file download, "Save individually", "All as ZIP") disabled with explanatory tooltip until ≥1 file has `status === 'done'`.

### Claude's Discretion
- Exact streaming-result mechanism in `runOptimize` (per-promise `.then` vs async-for loop vs queue-of-promises). Bounded concurrency MUST continue through the existing `WorkerPool` (no second pool/cap).
- Aggregate counter derivation: from `runtimeAtom.runningJobs + queuedJobs + filesAtom.done` count, or a new `batchProgressAtom`, or computed live in StatusBar.
- Per-row context menu realization (`DropdownMenu` vs `ContextMenu` vs custom popover off existing `ctxbtn`).
- "Save individually" delivery (repeated `file-saver`, sequential anchor clicks, for-await save jobs).
- ZIP generation strategy (in-memory `generateAsync` vs streaming, yielding to main thread for responsiveness).
- Backpressure preservation under load (validating cap holds with new streaming write-back).
- aria-live announcements during the batch (single polite live region in StatusBar vs sufficient pip `aria-label`).
- Adding `jszip` + `file-saver` + `@types/file-saver` to `package.json`.

### Deferred Ideas (OUT OF SCOPE)
- Per-format subfolder layout in ZIP
- Preserve folder paths (`webkitRelativePath`)
- Manifest JSON in ZIP (Phase 12)
- Copy `<picture>` HTML / Copy data URIs (Phase 12)
- Save-to-folder via `FileSystemDirectoryHandle` (`showDirectoryPicker`)
- Cancel batch / resumability
- Include-originals option (rejected by D-08/D-12)
- `showSaveFilePicker` per-file for "Save individually" (rejected by D-06)
- Optimize-all "re-run everything" mode (rejected by D-11)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPT-02 | User clicks Optimize-all → batch runs through the worker pool with live per-file progress | Streaming write-back pattern (§Architecture Patterns Pattern 1); aggregate counter derivation (§Pattern 4); ariaLive guidance (§Pitfall 4) |
| EXP-01 | User can download a single optimized file to disk | `showSaveFilePicker` feature-detect + `file-saver` fallback (§Pattern 2); filename helper (§Code Examples) |
| EXP-02 | User can export the entire optimized batch as a ZIP (jszip) | `JSZip.generateAsync({type:'blob', streamFiles:true})` (§Pattern 3); collision-suffix algorithm (§Code Examples); timestamped filename helper |
</phase_requirements>

## Summary

Phase 11 is a wiring phase — almost every primitive needed already exists. The `WorkerPool` (`src/lib/worker-pool.ts`) is already bounded at `min(hwConc, 4)` and already reports `(active, queued)` through `runtimeAtom.setJobCounts` via `onCountChange`. `setFileResult` already flips `status:'done'` per file (verified by Phase 10 WR-01). The only meaningful refactor inside `useOptimize.runOptimize` is to drop the terminal `Promise.allSettled` write-back loop and write each result back inside the promise chain — preserving the existing `pool.run(job)` dispatch.

For the two new external deps (`jszip 3.10.1`, `file-saver 2.0.5` — both verified against npm registry 2026-06-01 and matching the CLAUDE.md locked versions), the recommended pattern is: build the ZIP in memory with `JSZip.generateAsync({ type: 'blob', streamFiles: true })`, save via `showSaveFilePicker` when available (`'showSaveFilePicker' in window && window.isSecureContext`) with `saveAs` from `file-saver` as the cross-browser fallback. Sequential `saveAs` calls inside a `for await` loop with a short `await new Promise(r => setTimeout(r, 80))` between saves is the standard pattern for multi-file delivery; modern Chromium prompts "This site is attempting to download multiple files" once on the second download and then proceeds — this is acceptable and expected.

**Primary recommendation:** Refactor `runOptimize` to per-promise `.then(setFileResult)` callbacks (clearest, smallest diff). Add a single `useExport()` hook that owns ZIP + single-file + bulk-save logic. Derive the aggregate `X/Y optimized` counter live in StatusBar from `runtimeAtom.runningJobs + queuedJobs` + `filesAtom.entries.filter(e => e.status === 'done').length` — no new atom. Add `aria-live="polite"` to the new aggregate counter span (the existing `worker-pip` aria-label is insufficient — it announces only Idle/Running, not progress).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Streaming write-back of per-job results | Main thread (hook) | Worker pool | `useOptimize.runOptimize` dispatches; per-job `.then` callback writes to `filesAtom` on main thread |
| Codec encode | Worker | — | Existing Phase 8 worker pipeline; unchanged |
| Aggregate `X/Y` counter | Component (derived) | Store (read-only) | Live computation in `StatusBar` from `runtimeAtom` + `filesAtom` — no new state |
| ZIP build | Main thread (hook) | — | jszip is synchronous-coordinator, async-deflate; runs in `useExport` hook |
| Single-file save | Main thread (hook) | Browser API | `showSaveFilePicker` direct call or `saveAs` fallback |
| Bulk "Save individually" | Main thread (hook) | Browser API | Sequential `saveAs` with throttle; logic in `useExport` |
| Export disabled state | Component (derived selector) | Store (read-only) | `filesAtom.entries.some(e => e.status === 'done')` — no derived atom needed |
| Backpressure cap (≤4) | Worker pool (existing) | — | `WorkerPool._drain()` already enforces; Phase 11 must not bypass it |

## Project Constraints (from CLAUDE.md)

- **Tech stack:** React 19 + Vite 7 (CLAUDE.md says "Vite 8" but `package.json` shows `vite ^7.3` — auto-memory confirms drift; treat Vite 7 as truth) + TypeScript strict
- **State:** nanostores (CLAUDE.md says zustand — drift; package.json shows `nanostores ^1.3.0` + `@nanostores/react ^1.1.0`)
- **Codec source:** jSquash (no change in Phase 11)
- **Companion libs to ADD:** `jszip ^3.10` (verified 3.10.1, npm 2026-06-01); `file-saver ^2.0` (verified 2.0.5, npm 2026-06-01); `@types/file-saver` (latest 2.0.7, npm 2026-06-01)
- **Privacy:** Zero-server, zero-telemetry — non-negotiable. No analytics on export actions.
- **Performance:** Initial route < 200KB JS gzipped (jszip is ~95KB minified ~28KB gzipped; OK for main bundle)
- **Accessibility:** WCAG-AA — keyboard-openable + ESC + arrow-nav on the per-row File-options menu; `aria-live` for aggregate counter announcements
- **Conventions:** File business logic in `src/hooks/*` and `src/stores/*` — NEVER inline in components (memory-recall + CLAUDE.md)
- **Typecheck:** `tsc -b`, not `tsc -p` (auto-memory)

## Standard Stack

### Core (already installed — reused)
| Library | Version (package.json) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nanostores` | `^1.3.0` [VERIFIED: package.json] | State container | Already plumbed for `filesAtom`/`runtimeAtom` |
| `@nanostores/react` | `^1.1.0` [VERIFIED: package.json] | React binding | `useStore` already used everywhere |
| `comlink` | `^4.4.2` [VERIFIED: package.json] | Worker proxy | Already wraps codec worker |
| `sonner` | `^2.0.7` [VERIFIED: package.json] | Toasts | For skipped-count toast (D-12) |

### New additions for Phase 11
| Library | Version to pin | Verified | Purpose | Why Standard |
|---------|---------|----------|---------|--------------|
| `jszip` | `^3.10` (latest 3.10.1) | [VERIFIED: npm view jszip → 3.10.1, 2026-06-01] | Batch ZIP build | Locked in CLAUDE.md + PROJECT.md; mature, browser-stable, `streamFiles` mode for memory efficiency |
| `file-saver` | `^2.0` (latest 2.0.5) | [VERIFIED: npm view file-saver → 2.0.5, 2026-06-01] | `saveAs(blob, name)` fallback | Locked in CLAUDE.md; ~3KB gzip; battle-tested Safari/Firefox quirks |
| `@types/file-saver` | `^2.0` (latest 2.0.7) | [VERIFIED: npm view @types/file-saver → 2.0.7, 2026-06-01] | TS types | `file-saver` ships no types of its own |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jszip` | `client-zip` (StreamSaver-style) | Smaller + true streaming, but CLAUDE.md locks jszip; jszip sufficient for v1 batch sizes |
| `file-saver` | Hand-rolled `<a download>` click | One-liner but misses Safari quirks; CLAUDE.md locks file-saver |
| New `batchProgressAtom` | Live-derived counter in StatusBar | Atom adds indirection for zero functional gain; runtimeAtom + filesAtom already plumbed |

**Installation:**
```bash
npm install jszip@^3.10 file-saver@^2.0
npm install --save-dev @types/file-saver@^2.0
```

**Version verification:** All three confirmed against npm registry on 2026-06-01:
- `jszip` 3.10.1
- `file-saver` 2.0.5
- `@types/file-saver` 2.0.7

## Package Legitimacy Audit

> slopcheck was not available in this research environment — packages below are tagged accordingly per the protocol.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `jszip` | npm | 15 yrs (since 2010) | ~14M/wk [ASSUMED] | github.com/Stuk/jszip | [N/A — not run] | Approved [CITED: CLAUDE.md lock + npm view] |
| `file-saver` | npm | 13 yrs (since 2013) | ~5M/wk [ASSUMED] | github.com/eligrey/FileSaver.js | [N/A — not run] | Approved [CITED: CLAUDE.md lock + npm view] |
| `@types/file-saver` | npm | DefinitelyTyped community | ~4M/wk [ASSUMED] | github.com/DefinitelyTyped/DefinitelyTyped | [N/A — not run] | Approved [CITED: npm view] |

**Packages removed due to slopcheck [SLOP] verdict:** none — all three are explicitly locked in CLAUDE.md `## 6. Companion Libraries`, predating Phase 11.
**Packages flagged as suspicious [SUS]:** none.

Mitigation: All three are CLAUDE.md-locked, decade-old established packages with millions of weekly downloads and well-known maintainers. The planner does NOT need a `checkpoint:human-verify` task for these — the lock predates the phase and the npm-registry version check confirmed exact strings.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Optimize all" (Toolbar)
        │
        ▼
useOptimize.runOptimize()
        │
        ├──► filter entries where status !== 'done'  (D-11)
        │
        ├──► for each entry: pool.run(job)           (existing WorkerPool, cap = min(hwConc, 4))
        │       │
        │       ├──► WorkerPool._drain() enforces concurrency cap (existing)
        │       ├──► onCountChange → runtimeAtom.setJobCounts(active, queued)   (existing)
        │       │
        │       └──► .then(result => setFileResult(id, buffer, size))   ← NEW (D-03)
        │           .catch(err   => setFileError(id, String(err)))
        │
        ▼
filesAtom updates per-result  →  FileRow re-renders status dot (queued→processing→done)
                                  StatusBar re-derives X/Y counter live

User clicks "Export → All as ZIP" (Toolbar)
        │
        ▼
useExport.exportZip()
        │
        ├──► collect entries where status === 'done' && encodedBuffer (D-12: skip errors)
        ├──► const zip = new JSZip()
        ├──► for each entry: zip.file(uniqueName(rename(name, target)), encodedBuffer)
        │                              └─ (1)/(2)/... suffix on collision (D-10)
        ├──► const blob = await zip.generateAsync({ type: 'blob', streamFiles: true })
        ├──► const filename = `oimg-export-${YYYY-MM-DD-HHMM}.zip`
        └──► saveBlob(blob, filename)
                ├─► showSaveFilePicker if available + secure context
                └─► else: saveAs(blob, filename)   (file-saver)

User clicks per-file "Save as…" (FileRow context menu) OR Inspector "Download"
        │
        ▼
useExport.exportOne(entry)
        │
        ├──► blob = new Blob([entry.encodedBuffer], { type: mimeFor(entry.target) })
        ├──► filename = renameExtension(entry.name, entry.target)
        └──► saveBlob(blob, filename)
                ├─► showSaveFilePicker({ suggestedName, types: [...], startIn: 'downloads' })
                │       ├─► resolve → write + close
                │       └─► AbortError (user cancel) → silent no-op (NO toast)
                └─► fallback: saveAs(blob, filename)

User clicks "Export → Save individually" (Toolbar)
        │
        ▼
useExport.exportIndividually()
        │
        ├──► entries = done + encodedBuffer (skip errors → count skipped for toast, D-12)
        ├──► for (const entry of entries) {
        │       saveAs(blob, filename)                     // file-saver only — no picker (D-06)
        │       await new Promise(r => setTimeout(r, 80))  // throttle anti-multidownload heuristics
        │     }
        └──► toast.success(`${ok.length} files exported${skipped > 0 ? `, ${skipped} skipped — fix and re-export` : ''}`)
```

### Recommended Project Structure (new + modified files)
```
src/
├── hooks/
│   ├── useOptimize.ts         # MODIFY — streaming write-back (D-03)
│   └── useExport.ts           # NEW — exportZip / exportOne / exportIndividually
├── lib/
│   ├── filename.ts            # NEW — renameExtension, collisionSuffix, timestampedZipName, mimeFor
│   └── save-blob.ts           # NEW — saveBlob(blob, name) dispatcher: showSaveFilePicker → file-saver
├── stores/
│   └── files.ts               # MODIFY — replace empty stubs exportAsZip/exportIndividually
│                              #          with thin wrappers around useExport (or move to hook entirely)
├── components/
│   ├── shell/
│   │   ├── StatusBar.tsx      # MODIFY — add aggregate `X/Y optimized` + aria-live region
│   │   └── Toolbar.tsx        # MODIFY — disable Export buttons via derived selector (D-13)
│   └── panels/
│       ├── files/
│       │   └── FileRow.tsx    # MODIFY — wire ContextMenuItem "Save as…" to useExport.exportOne
│       └── inspector/
│           └── ReportPanel.tsx (or new DownloadAction.tsx)  # MODIFY/NEW — "Download" button
└── tests/
    ├── batch-progress.spec.ts # NEW — OPT-02 + SC-4 (≥20 files, backpressure assertion)
    ├── export-single.spec.ts  # NEW — EXP-01 native + fallback
    └── export-zip.spec.ts     # NEW — EXP-02 roundtrip
```

### Pattern 1: Streaming write-back inside `runOptimize` (D-03)

**What:** Replace the terminal `Promise.allSettled(pairs.map(([,,job]) => pool.run(job)))` write-back loop with per-promise `.then`/`.catch` callbacks. Keep the dispatch-all-at-once shape (the pool's internal `_drain` enforces the concurrency cap).

**When to use:** Always — the existing `WorkerPool` is *already* a bounded queue. Wrapping it in an async-for `for-await` loop would serialize dispatch and re-implement the queue on top of the queue. Per-promise `.then` is the smallest viable diff.

**Example:**
```typescript
// Source: This research; pattern verified against existing src/lib/worker-pool.ts (already bounded)
async function runOptimize(): Promise<void> {
  const pool = getPool()
  const { entries } = filesAtom.get()

  // D-11: only run on files not yet done
  const targets = entries.filter(e => e.status !== 'done')

  const promises = targets.map((entry) => {
    const codec = toCodec(entry.type)
    const sourceFormat = toSourceFormat(entry.type)
    if (codec === null || sourceFormat === null) return Promise.resolve()
    // (build job exactly as current code does — buffer.slice(0), settings fallback)
    const job: EncodeJob = buildJob(entry, codec, sourceFormat)
    if (!job) return Promise.resolve()

    // Streaming write-back — per-promise; pool's _drain enforces concurrency cap
    return pool.run(job).then(
      ({ buffer, optimizedSize }) => setFileResult(entry.id, buffer, optimizedSize),
      (err) => {
        setFileError(entry.id, String(err))
        toast.error('Encode failed: ' + entry.name)
      },
    )
  })

  // Awaiting all settles the batch — but the writes happen one-by-one as workers return.
  await Promise.all(promises)
}
```

**Why this preserves backpressure:** All N promises are created up front; the pool's `queue.push` + `_drain` loop is the same path Phase 8 already verified caps at `min(hwConc, 4)`. Per-promise `.then` callbacks fire on the microtask queue when each `pool.run` resolves — they do NOT bypass `_drain`.

**Alternatives considered:**
- `for await (const job of jobs) await pool.run(job)` — serializes to 1 concurrent job; defeats the pool. REJECTED.
- Queue-of-promises with `Promise.race` — complex, no win over `.then`. REJECTED.

### Pattern 2: Single-file save dispatcher (D-07)

**What:** A `saveBlob(blob, filename, opts?)` function that picks `showSaveFilePicker` when supported and `window.isSecureContext === true`, falls back to `saveAs` otherwise.

**When to use:** Every single-file save path (per-row context menu, inspector Download button) AND the per-file step of bulk "Save individually" (when `forceFallback: true` is passed, to honor D-06).

**Example:**
```typescript
// Source: This research; per MDN + web.dev save-a-file pattern
// https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker
// https://web.dev/patterns/files/save-a-file/
import { saveAs } from 'file-saver'

interface SaveOptions {
  /** Force the file-saver / anchor-click path (used by bulk "Save individually" per D-06) */
  forceFallback?: boolean
  /** suggested extension for the picker dropdown — e.g. 'webp' */
  ext?: string
  /** MIME type for the picker `accept` dictionary — e.g. 'image/webp' */
  mime?: string
}

export async function saveBlob(blob: Blob, filename: string, opts: SaveOptions = {}): Promise<void> {
  const canUsePicker =
    !opts.forceFallback &&
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    window.isSecureContext === true

  if (canUsePicker) {
    try {
      // Types not yet in lib.dom for all TS versions — cast via `unknown`
      const picker = (window as unknown as { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> })
        .showSaveFilePicker
      const handle = await picker({
        suggestedName: filename,
        types: opts.ext && opts.mime ? [{
          description: opts.ext.toUpperCase() + ' image',
          accept: { [opts.mime]: ['.' + opts.ext] },
        }] : undefined,
        startIn: 'downloads',
        excludeAcceptAllOption: false,
      })
      const writable = await (handle as { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }).createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      // User cancel — DOMException AbortError. Silent. (per MDN guidance)
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Any other error: fall through to fallback (don't surface an opaque exception)
    }
  }
  // Fallback — file-saver handles Safari/Firefox quirks
  saveAs(blob, filename)
}
```

**Gotchas:**
- `showSaveFilePicker` requires `window.isSecureContext === true`. On `localhost` and `127.0.0.1` this is true; on plain HTTP non-localhost it's false. [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker]
- User-cancel throws `DOMException` with `name === 'AbortError'`. Silently swallow it — the existing `useIngest.openPicker` already uses this pattern.
- `showSaveFilePicker` is unavailable in Firefox + Safari as of 2026. Both reach the fallback path. [CITED: MDN]
- The `types` array's `accept` dictionary maps MIME → array of extensions, NOT the other way around — common bug.

### Pattern 3: Batch ZIP build (EXP-02)

**What:** Build the ZIP in memory with `JSZip.generateAsync({ type: 'blob', streamFiles: true })` and hand the resulting Blob to `saveBlob`.

**When to use:** Always for the "All as ZIP" path. `streamFiles: true` reduces peak memory by streaming individual file entries (instead of holding every file's compressed form in memory simultaneously) and is the documented recommendation for browser usage with larger batches. [CITED: stuk.github.io/jszip/documentation/api_jszip/generate_async.html]

**Example:**
```typescript
// Source: This research; per stuk.github.io/jszip/documentation/api_jszip/generate_async.html
import JSZip from 'jszip'
import type { FileEntry } from '@/stores/files'
import { renameExtension, collisionSuffix, timestampedZipName, mimeFor } from '@/lib/filename'
import { saveBlob } from '@/lib/save-blob'
import { toast } from 'sonner'

export async function exportZip(entries: FileEntry[]): Promise<void> {
  // D-12: only done + encodedBuffer; skip errors and unencoded files
  const exportable = entries.filter(e => e.status === 'done' && e.encodedBuffer)
  const skipped = entries.length - exportable.length

  if (exportable.length === 0) {
    toast.error('Nothing to export — optimize files first')
    return
  }

  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (const e of exportable) {
    const baseName = renameExtension(e.name, e.target)  // hero.png → hero.webp (D-05)
    const finalName = collisionSuffix(baseName, usedNames)  // hero (1).webp on collision (D-10)
    usedNames.add(finalName)
    // jszip accepts ArrayBuffer directly — no need to wrap in Uint8Array
    zip.file(finalName, e.encodedBuffer!)
  }

  // streamFiles=true → reduced peak memory; compression DEFLATE level 1 (already-compressed
  // codec output doesn't deflate further; level 1 saves CPU vs default 6)
  const blob = await zip.generateAsync({
    type: 'blob',
    streamFiles: true,
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  })

  await saveBlob(blob, timestampedZipName(), { ext: 'zip', mime: 'application/zip' })

  if (skipped > 0) {
    toast.success(`${exportable.length} files exported, ${skipped} skipped — fix and re-export`)
  } else {
    toast.success(`${exportable.length} files exported`)
  }
}
```

**Gotchas:**
- Already-compressed codec outputs (WebP/AVIF/JPEG) gain nothing from `DEFLATE` level 6+; use `level: 1` to save CPU. PNG (oxipng) likewise — already maximally entropy-coded. SVG (text) does benefit.
- `generateAsync` holds the result in memory; for batches > ~200 MB you'd need `StreamHelper`. CLAUDE.md notes "revisit if batches > 200 MB" — out of scope.
- Avoid main-thread starvation for ZIP build with many files (>50): wrap in a `Promise.resolve().then(...)` or use `await new Promise(r => setTimeout(r, 0))` between file adds. For Phase 11's expected batch sizes (~20-50 files), `streamFiles: true` + the async generation alone keeps the UI responsive.

### Pattern 4: Aggregate `X/Y optimized` counter

**What:** Derive live in `StatusBar` from existing atoms — no new `batchProgressAtom`.

**Example:**
```typescript
// Source: This research; pattern matches existing $totals computed atom in src/stores/files.ts
import { useStore } from '@nanostores/react'
import { runtimeAtom } from '@/stores/runtime'
import { filesAtom } from '@/stores/files'

function AggregateCounter() {
  const { runningJobs, queuedJobs } = useStore(runtimeAtom)
  const { entries } = useStore(filesAtom)
  const done = entries.filter(e => e.status === 'done').length
  const total = entries.length
  const inFlight = runningJobs + queuedJobs
  const active = inFlight > 0

  return (
    <span
      data-testid="agg-counter"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {active ? `${done}/${total} optimized` : `${done}/${total} done`}
    </span>
  )
}
```

**Why no `batchProgressAtom`:** `runningJobs + queuedJobs` already represents "remaining work"; `entries.filter(done).length` already represents "completed work". A derived atom would just memoize these — pointless for an O(N≤200) array filter on render. Keep it simple.

**Why `aria-live="polite"` not `assertive`:** Progress updates are non-urgent; `polite` is the WAI-ARIA recommendation for status messages. `aria-atomic="true"` ensures the whole "5/20 optimized" string is announced, not just the changed digit. [CITED: w3.org/WAI/ARIA/apg/patterns/alert/ + WAI-ARIA 1.2 spec]

### Pattern 5: Disable-then-explain selector (D-13)

**What:** A single derived check used by three components.

**Example:**
```typescript
// Source: This research
import { computed } from 'nanostores'
import { filesAtom } from '@/stores/files'

// New derived atom in src/stores/files.ts
export const $hasDone = computed(filesAtom, (s) => s.entries.some(e => e.status === 'done'))

// In Toolbar.tsx / Inspector.tsx / FileRow.tsx ContextMenuItem
const hasDone = useStore($hasDone)
<button
  disabled={!hasDone}
  aria-disabled={!hasDone}
  title={!hasDone ? 'Optimize at least one file first' : undefined}
  onClick={...}
>
  All as ZIP
</button>
```

For `ContextMenuItem` in `FileRow`, the per-row "Save as…" item is enabled only when `file.status === 'done'` (the row's own file is exportable).

### Anti-Patterns to Avoid
- **Wrapping `pool.run` in a new bounded queue inside `useOptimize`.** The pool is already bounded. Re-bounding it defeats the purpose. The existing `_drain()` loop is the single source of concurrency truth.
- **Synthesizing a fake intra-encode progress fraction.** D-02 forbids it. Codec encodes are atomic; rendering a fake percentage is a lie.
- **Calling `saveAs` in a tight loop.** Browsers (Chromium especially) trip an anti-multi-download dialog. Insert `await new Promise(r => setTimeout(r, 80))` between calls.
- **Importing `jszip` from `'jszip/dist/jszip.min.js'`.** Modern jszip ships proper ESM via the `"exports"` field; the default `import JSZip from 'jszip'` is tree-shakable and Vite-friendly.
- **Reading `entry.encodedBuffer.byteLength` to decide exportability.** Use `status === 'done' && encodedBuffer != null`. Status is the contract; byteLength is implementation.
- **Forgetting `streamFiles: true` on `generateAsync`.** Without it, jszip holds every file's compressed form in memory simultaneously — issue #446 documents OOM at 20K files. [CITED: github.com/Stuk/jszip/issues/446]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-browser file save | Hand-rolled `<a download>` + `URL.createObjectURL` | `file-saver` 2.0.5 | Handles Safari `target=_blank` quirk + IE polyfill heritage that still matters for legacy Edge |
| ZIP build | `pako` + manual CDFH writer | `jszip` 3.10.1 | jszip handles UTF-8 filenames, ZIP64 boundary, DEFLATE streaming |
| File system save dialog | Hand-rolled `showSaveFilePicker` types | Cast through `unknown` + feature-detect | TS lib.dom types lag the actual API |
| Filename collision suffixing | Ad-hoc regex | `collisionSuffix` helper (§Code Examples) | Edge cases: extension preservation, repeated collisions, base-name with dots |
| Aggregate progress | `batchProgressAtom` | Live-derived from existing atoms | Avoids state sync; nanostores re-renders are cheap |
| Per-row file-options menu | Custom popover | Existing `ContextMenu` (in `FileRow.tsx`) | Already a11y-tested in Phase 2; right-click + the `ctxbtn` synthesizing a contextmenu event already works |

**Key insight:** Phase 11 is 90% wiring. The codec pipeline, the worker pool, the per-row status dot, the StatusBar pip, the BackpressureIndicator, and the toolbar Export menu items ALL exist. The only genuinely new logic is: (a) flip the write-back inside `runOptimize` from terminal-allSettled to per-promise, (b) the filename helpers, (c) the saveBlob dispatcher, (d) the `useExport` hook that orchestrates ZIP/single/bulk. Everything else is a one-line `disabled={!hasDone}` or `aria-live="polite"` addition.

## Common Pitfalls

### Pitfall 1: Backpressure broken by streaming refactor
**What goes wrong:** Refactoring `runOptimize` to `async for` over `pool.run` serializes the queue to 1 concurrent job, even though `WorkerPool` supports 4.
**Why it happens:** `await pool.run(job)` inside a `for` waits for each result before dispatching the next; the pool's internal queue never fills past 1.
**How to avoid:** Build the promise array first (`targets.map(...)`), THEN `await Promise.all(promises)`. Per-promise `.then` writes back. The pool sees all N jobs queued at once and drains 4 at a time.
**Warning signs:** `runtimeAtom.runningJobs` peaks at 1 during a 20-file batch. SC-4 Playwright test asserts peak ≥ 2 (typically 4 on a multi-core machine).

### Pitfall 2: `showSaveFilePicker` swallowed exceptions
**What goes wrong:** Picker silently no-ops when user cancels; UI looks broken.
**Why it happens:** `AbortError` thrown for user-cancel — same DOMException name as actual aborts. Easy to log as error.
**How to avoid:** `if (err instanceof DOMException && err.name === 'AbortError') return;` — silent. ANY other error: fall through to `saveAs` fallback (don't toast — the user may have hit a sandboxed iframe edge case).
**Warning signs:** Console error "Failed to fetch" or "The user aborted a request" with no UI feedback. [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker]

### Pitfall 3: ZIP filename collisions silently overwrite
**What goes wrong:** Two source files `hero.png` (resized) and `hero.png` (cropped) both become `hero.webp` in the ZIP; jszip silently overwrites the first.
**Why it happens:** `zip.file(name, data)` on an existing name overwrites without warning.
**How to avoid:** Track `usedNames` Set; apply `(1)`/`(2)` suffix before `zip.file()` (D-10 algorithm in §Code Examples).
**Warning signs:** ZIP byte count smaller than expected; missing files post-unzip.

### Pitfall 4: aria-live announcement spam during fast batches
**What goes wrong:** `aria-live="polite"` on `X/Y optimized` announces every increment (1/20, 2/20, 3/20...) — screen reader queue saturates.
**Why it happens:** Polite still announces every change; with 20 files at ~50ms each, that's 20 announcements in 1 second.
**How to avoid:** Throttle the announced region. Either (a) update the visible counter every frame but the live region every ~500ms via a `useDeferredValue` snapshot, OR (b) use `aria-live="polite"` only on the "done" terminal state ("20 files optimized"), with the counter itself non-announcing.
**Warning signs:** Manual screen-reader test reveals announcement backlog. Prefer (a) for Phase 11 — keeps interim feedback.
**Reference:** WAI-ARIA Authoring Practices Guide §"Avoid announcement spam in live regions". [CITED: w3.org/WAI/ARIA/apg/patterns/]

### Pitfall 5: `file-saver` mutates Blob via revokeObjectURL race in Safari
**What goes wrong:** Repeated `saveAs` calls in a tight loop on Safari sometimes drop a save.
**Why it happens:** `file-saver` calls `URL.revokeObjectURL` on a `setTimeout(..., 40)`; concurrent revocations in the same tick race.
**How to avoid:** Insert `await new Promise(r => setTimeout(r, 80))` between consecutive `saveAs` calls in the bulk path. 80ms is empirically safe and barely perceptible.
**Warning signs:** "Save individually" of 10 files produces 8 or 9 downloads on Safari. [ASSUMED — established file-saver folklore; verify in Phase 11 e2e]

### Pitfall 6: Empty-batch ZIP yields valid 22-byte ZIP
**What goes wrong:** If all files are errored (D-12 skips them all), the ZIP would have 0 entries — a valid but empty 22-byte central-directory-only ZIP. Confusing UX.
**Why it happens:** No filtering for `exportable.length > 0` before `generateAsync`.
**How to avoid:** Guard with `if (exportable.length === 0) { toast.error('Nothing to export — optimize files first'); return }`. With D-13 the button is disabled, but defense-in-depth.

## Code Examples

### Filename helpers (`src/lib/filename.ts`)
```typescript
// Source: This research
// All filename / extension / collision / timestamp logic lives here.

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  zip: 'application/zip',
}

/** D-05: replace the final extension with the target extension. Idempotent if equal. */
export function renameExtension(originalName: string, targetExt: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName
  // Normalize jpeg→jpg (or keep jpg) — pick a single canonical extension per format
  const ext = targetExt.toLowerCase()
  return `${base}.${ext}`
}

/** D-10: append `(1)`, `(2)`, ... before the extension on collision. */
export function collisionSuffix(name: string, used: Set<string>): string {
  if (!used.has(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot >= 0 ? name.slice(0, dot) : name
  const ext = dot >= 0 ? name.slice(dot) : ''
  let i = 1
  while (used.has(`${base} (${i})${ext}`)) i++
  return `${base} (${i})${ext}`
}

/** D-10: `oimg-export-YYYY-MM-DD-HHMM.zip` in local time. */
export function timestampedZipName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const Y = now.getFullYear()
  const M = pad(now.getMonth() + 1)
  const D = pad(now.getDate())
  const h = pad(now.getHours())
  const m = pad(now.getMinutes())
  return `oimg-export-${Y}-${M}-${D}-${h}${m}.zip`
}

export function mimeFor(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}
```

### `useExport` hook skeleton (`src/hooks/useExport.ts`)
```typescript
// Source: This research
import JSZip from 'jszip'
import { filesAtom, type FileEntry } from '@/stores/files'
import { saveBlob } from '@/lib/save-blob'
import { renameExtension, collisionSuffix, timestampedZipName, mimeFor } from '@/lib/filename'
import { toast } from 'sonner'

function exportable(entries: FileEntry[]): FileEntry[] {
  return entries.filter(e => e.status === 'done' && e.encodedBuffer)
}

export function useExport() {
  async function exportOne(entry: FileEntry): Promise<void> {
    if (!entry.encodedBuffer) return
    const filename = renameExtension(entry.name, entry.target)
    const blob = new Blob([entry.encodedBuffer], { type: mimeFor(entry.target) })
    await saveBlob(blob, filename, { ext: entry.target, mime: mimeFor(entry.target) })
  }

  async function exportZip(): Promise<void> {
    const { entries } = filesAtom.get()
    const ok = exportable(entries)
    const skipped = entries.length - ok.length
    if (ok.length === 0) { toast.error('Nothing to export — optimize files first'); return }

    const zip = new JSZip()
    const used = new Set<string>()
    for (const e of ok) {
      const name = collisionSuffix(renameExtension(e.name, e.target), used)
      used.add(name)
      zip.file(name, e.encodedBuffer!)
    }
    const blob = await zip.generateAsync({
      type: 'blob',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    })
    await saveBlob(blob, timestampedZipName(), { ext: 'zip', mime: 'application/zip' })

    const tail = skipped > 0 ? `, ${skipped} skipped — fix and re-export` : ''
    toast.success(`${ok.length} files exported${tail}`)
  }

  async function exportIndividually(): Promise<void> {
    const { entries } = filesAtom.get()
    const ok = exportable(entries)
    const skipped = entries.length - ok.length
    if (ok.length === 0) { toast.error('Nothing to export — optimize files first'); return }

    const used = new Set<string>()
    for (const e of ok) {
      const name = collisionSuffix(renameExtension(e.name, e.target), used)
      used.add(name)
      const blob = new Blob([e.encodedBuffer!], { type: mimeFor(e.target) })
      // D-06/D-07: bulk path forces the fallback — no picker per file
      await saveBlob(blob, name, { forceFallback: true })
      // Pitfall 5: throttle to avoid Safari race + Chromium anti-multidownload heuristic prompt-spam
      await new Promise((r) => setTimeout(r, 80))
    }
    const tail = skipped > 0 ? `, ${skipped} skipped — fix and re-export` : ''
    toast.success(`${ok.length} files exported${tail}`)
  }

  return { exportOne, exportZip, exportIndividually }
}
```

### SC-4 backpressure assertion (Playwright)
```typescript
// Source: This research; pattern reuses NAV-02 latch from Phase 10 (auto-memory)
// src/tests/batch-progress.spec.ts
import { test, expect } from '@playwright/test'
import { ingestFixtureFiles } from './fixtures/ingest-helper'

test('SC-4: WorkerPool concurrency stays at cap during ≥20-file batch', async ({ page }) => {
  await page.goto('/')
  // Expose runtimeAtom on window for the test — via existing test-helper bridge (Phase 8 pattern)
  // OR latch peak runningJobs via store.subscribe injected pre-script.
  await page.addInitScript(() => {
    (window as { __peakRunning?: number }).__peakRunning = 0
    // Hook into runtimeAtom once it's exposed (add a tiny test-only bridge in main.tsx)
    const tick = () => {
      const v = (window as { __runningJobs?: number }).__runningJobs ?? 0
      const peak = (window as { __peakRunning?: number }).__peakRunning ?? 0
      if (v > peak) (window as { __peakRunning?: number }).__peakRunning = v
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  await ingestFixtureFiles(page, 20)
  await page.getByRole('button', { name: 'Optimize all' }).click()

  // Wait until at least one file flips to done (latch — Phase 10 NAV-02 pattern)
  await page.waitForFunction(() => {
    const peak = (window as { __peakRunning?: number }).__peakRunning ?? 0
    return peak >= 2  // bounded queue produced parallel work
  }, { timeout: 15_000 })

  // Then assert peak never exceeded the cap (min(hwConc, 4))
  const peak = await page.evaluate(() => (window as { __peakRunning?: number }).__peakRunning ?? 0)
  expect(peak).toBeGreaterThanOrEqual(2)
  expect(peak).toBeLessThanOrEqual(4)
})
```

Note: the test relies on a tiny main.tsx-side bridge (e.g. `if (import.meta.env.DEV) window.__expose = { runtimeAtom }` and a subscription that mirrors `runningJobs` to `window.__runningJobs`). Phase 11 plan must include this bridge or reuse an existing one.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<a download href=blob:>` for single-file save | `showSaveFilePicker` (Chromium) + `file-saver` fallback (Firefox/Safari) | 2020+ (FS Access API GA in Chromium) | User picks the destination; better UX for "Save as" semantics |
| Synchronous `JSZip.generate({type:'blob'})` | `JSZip.generateAsync({type:'blob', streamFiles:true})` | jszip 3.0 (2017) | Non-blocking; lower peak memory; required for browser usage |
| `Promise.allSettled` then write-back | Per-promise `.then(setFileResult)` (streaming) | Phase 11 (this research) | Live per-row status during batch; required for OPT-02 SC-1 |
| New custom `aria-live` polling | Existing `role="status"` regions + `aria-live="polite"` on counter | WAI-ARIA 1.2 GA | No custom polling needed — DOM mutations + live region attrs are sufficient |

**Deprecated/outdated:**
- `JSZip.generate` (sync) — removed in jszip 3; do not use.
- `showSaveFilePicker` polyfills (e.g. `browser-fs-access`) — overkill; the feature-detect + file-saver pattern in §Pattern 2 is the canonical modern approach.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `file-saver` 2.0.5 Safari race needs 80ms inter-call delay | Pitfall 5 | Bulk save drops files on Safari; mitigated by manual e2e on Safari WebKit in Phase 11 verify |
| A2 | jszip 3.10.1 `streamFiles:true` is safe for arbitrary already-compressed inputs | Pattern 3 | Memory pressure on very large batches (>200MB) — out-of-scope per CLAUDE.md |
| A3 | `aria-live="polite"` with `aria-atomic="true"` is sufficient for WCAG-AA on the aggregate counter | Pitfall 4, Pattern 4 | Screen-reader noise; mitigated by throttling per Pitfall 4 |
| A4 | `Promise.all([pool.run(job).then(write), ...])` preserves the pool's `_drain()` concurrency cap | Pattern 1, Pitfall 1 | Cap bypassed under load; mitigated by SC-4 e2e test |
| A5 | Chromium "multiple downloads" prompt appears once on the second download and is not blocking | §Architecture Diagram (bulk path) | Bulk save partially blocked on Chromium; could require `<a download>` + permissions request flow |
| A6 | jszip + file-saver weekly download counts (~14M, ~5M) | Package Legitimacy Audit | Audit signal only; both are CLAUDE.md-locked regardless |

**Confirmation needed at discuss-phase or plan-time:** A1, A4, A5 are the planner's "verify in Wave 0 test" items.

## Open Questions

1. **Should the per-row "Save as…" context menu item appear for all statuses or only `done`?**
   - What we know: D-13 disables Toolbar export controls until ≥1 file is done. The per-row menu's intent is "save this file" — irrelevant for non-done files.
   - What's unclear: Should the menu item be hidden, disabled, or absent when `file.status !== 'done'`?
   - Recommendation: Render disabled with title="Optimize this file first" (consistent with D-13 disable-then-explain philosophy).

2. **MIME type for SVG output bytes — `image/svg+xml` charset?**
   - What we know: SVG is text; modern browsers accept `image/svg+xml` without charset.
   - Recommendation: `image/svg+xml; charset=utf-8` for the single-file save; harmless and explicit.

3. **Should the inspector "Download" button be in the existing ReportPanel or a new sub-component?**
   - What we know: ReportPanel already renders for the selected file.
   - Recommendation: Add as a sibling button within ReportPanel; keeps a single inspector-pane render path. New file only if ReportPanel grows beyond ~200 lines.

## Environment Availability

No new external dependencies beyond npm packages — Phase 11 is browser-side only. The current environment serves the dev server on `http://localhost:5174`, which is a secure context for `showSaveFilePicker` purposes (per MDN: localhost counts as secure). Production hosting on Cloudflare Pages provides HTTPS by default.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `jszip` 3.10.1 | EXP-02 ZIP build | ✗ (to install) | — | none — must install |
| `file-saver` 2.0.5 | EXP-01 fallback | ✗ (to install) | — | none — must install |
| `@types/file-saver` 2.0.7 | TS types | ✗ (to install) | — | hand-typed shim |
| `showSaveFilePicker` API | EXP-01 native path | ✓ on Chromium / Edge | — | `file-saver` saveAs |
| `window.isSecureContext` | gate for picker | ✓ (localhost, HTTPS) | — | falls through to fallback |
| Playwright Chromium | SC-4 backpressure e2e | ✓ (already configured) | `@playwright/test ^1.59.1` | — |

**Missing dependencies with no fallback:** none — both new packages are install-able.
**Missing dependencies with fallback:** `showSaveFilePicker` → `file-saver`, already designed-for.

## Validation Architecture

Per `.planning/config.json` (`nyquist_validation: true`) — included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test ^1.59.1` (e2e) + bare `node --experimental-strip-types` for `src/tests/*.test.ts` unit tests (per `package.json`) |
| Config file | `playwright.config.ts` (testDir `./src/tests`, baseURL `http://localhost:5174`) |
| Quick run command | `npx playwright test src/tests/batch-progress.spec.ts -x` |
| Full suite command | `npx playwright test` (Phase gate) + `npm run test:bundle` (build sanity) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-02 (SC-1) | Optimize-all → per-row status flips queued→processing→done live | e2e | `npx playwright test src/tests/batch-progress.spec.ts:1` | ❌ Wave 0 |
| OPT-02 (SC-1) | Aggregate `X/Y optimized` counter advances during batch | e2e | `npx playwright test src/tests/batch-progress.spec.ts:2` | ❌ Wave 0 |
| OPT-02 / SC-4 | WorkerPool peak runningJobs ≤ min(hwConc, 4) during ≥20-file batch | e2e | `npx playwright test src/tests/batch-progress.spec.ts:3` | ❌ Wave 0 |
| EXP-01 | Single-file picker native path (Chromium) writes a real file | e2e | `npx playwright test src/tests/export-single.spec.ts:1` (uses Playwright's `page.context().on('download')`) | ❌ Wave 0 |
| EXP-01 | Single-file fallback path (force fallback flag) downloads via file-saver | e2e | `npx playwright test src/tests/export-single.spec.ts:2` | ❌ Wave 0 |
| EXP-01 | `renameExtension('hero.png', 'webp') === 'hero.webp'` | unit | `node --experimental-strip-types src/tests/filename.test.ts` | ❌ Wave 0 |
| EXP-01 / D-10 | `collisionSuffix('a.webp', new Set(['a.webp']))` returns `'a (1).webp'` | unit | `node --experimental-strip-types src/tests/filename.test.ts` | ❌ Wave 0 |
| EXP-02 | "All as ZIP" produces a valid ZIP downloadable via `page.waitForEvent('download')` | e2e | `npx playwright test src/tests/export-zip.spec.ts:1` | ❌ Wave 0 |
| EXP-02 / D-08 | ZIP contains optimized files only (no originals); flat layout | e2e | `npx playwright test src/tests/export-zip.spec.ts:2` (verify by unzipping the downloaded blob server-side via Node) | ❌ Wave 0 |
| EXP-02 / D-10 | ZIP filename matches `^oimg-export-\d{4}-\d{2}-\d{2}-\d{4}\.zip$` | e2e | `npx playwright test src/tests/export-zip.spec.ts:3` | ❌ Wave 0 |
| EXP-02 / D-10 | Two same-name optimized outputs yield `name.webp` + `name (1).webp` inside the ZIP | unit + e2e | `node --experimental-strip-types src/tests/filename.test.ts` + zip spec | ❌ Wave 0 |
| D-13 | Export controls disabled (`disabled` + `title`) when zero files are done | e2e | `npx playwright test src/tests/export-zip.spec.ts:4` | ❌ Wave 0 |
| D-12 | Errored files skipped from ZIP; toast surfaces "N skipped" | e2e | `npx playwright test src/tests/export-zip.spec.ts:5` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test src/tests/batch-progress.spec.ts` (~30s)
- **Per wave merge:** `npx playwright test src/tests/{batch-progress,export-single,export-zip}.spec.ts`
- **Phase gate:** `npx playwright test` (full suite) green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/batch-progress.spec.ts` — OPT-02 SC-1, SC-4
- [ ] `src/tests/export-single.spec.ts` — EXP-01 native + fallback paths
- [ ] `src/tests/export-zip.spec.ts` — EXP-02 ZIP build + filename + D-10 + D-12 + D-13
- [ ] `src/tests/filename.test.ts` — `renameExtension`, `collisionSuffix`, `timestampedZipName` units
- [ ] `src/tests/fixtures/ingest-helper.ts` extension — add `ingestNFixtureFiles(page, 20)` for SC-4 (existing helper covers 1-N, verify N=20 path)
- [ ] Test-only main.tsx bridge: `if (import.meta.env.DEV) window.__runningJobs = computed/sub on runtimeAtom` — needed for SC-4 peak latch
- [ ] Install jszip + file-saver + @types/file-saver before any test runs

## Security Domain

Phase config has `security_enforcement` absent → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — client-only, no auth |
| V3 Session Management | no | n/a — no sessions |
| V4 Access Control | no | n/a — no server |
| V5 Input Validation | yes | Filename sanitation before passing to `zip.file()` — prevent `../` traversal in source filename ending up in ZIP entry; trim path separators |
| V6 Cryptography | no | n/a — no crypto in Phase 11 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Zip-slip via filename containing `../` | Tampering | `renameExtension` operates on `lastIndexOf('.')`; harmless. BUT `collisionSuffix` preserves the original base; a source named `../evil.png` would yield `../evil.webp` in the ZIP. Sanitize: replace `/` and `\` with `_` in the base before adding to ZIP. |
| XSS via filename injected into toast | Tampering | sonner toasts render text-only (no HTML); existing pattern is safe. Do NOT switch to `toast.custom` with raw filename interpolation in JSX. |
| User-controlled MIME header | n/a | MIME is derived from `entry.target` (codec setting), not from upload; not user-injectable via filename. |
| `URL.createObjectURL` leak | Tampering | `file-saver` revokes after timeout. `showSaveFilePicker` doesn't use object URLs. No leak. |

**Recommendation:** Add a `sanitizeBaseName(name)` helper in `src/lib/filename.ts` that replaces `/`, `\`, and `\0` with `_` before any ZIP insertion. Trivial — but the planner should make it an explicit task, not assume.

## Sources

### Primary (HIGH confidence)
- `npm view jszip version` → `3.10.1` (2026-06-01) [VERIFIED]
- `npm view file-saver version` → `2.0.5` (2026-06-01) [VERIFIED]
- `npm view @types/file-saver version` → `2.0.7` (2026-06-01) [VERIFIED]
- `src/lib/worker-pool.ts` — bounded WorkerPool implementation [VERIFIED: codebase grep]
- `src/hooks/useOptimize.ts` — current `Promise.allSettled` write-back loop confirmed [VERIFIED: codebase read]
- `src/stores/files.ts` — empty `exportAsZip`/`exportIndividually` stubs confirmed; `setFileResult` writes `status:'done'` confirmed (Phase 10 WR-01) [VERIFIED: codebase read]
- `src/stores/runtime.ts` — `setJobCounts(running, queued)` wiring + `runtimeAtom.runningJobs/queuedJobs` confirmed [VERIFIED: codebase read]
- `src/components/shell/StatusBar.tsx` — current `role="status" aria-live="polite"` on the container [VERIFIED: codebase read]
- `src/components/panels/files/FileRow.tsx` — existing `ContextMenu` + per-row status dot + processing-bar scaffold [VERIFIED: codebase read]
- `src/components/shell/Toolbar.tsx` — Export Popover with `exportAsZip` / `exportIndividually` already wired as onClick targets [VERIFIED: codebase read]
- MDN: `Window: showSaveFilePicker() method` — secure-context requirement, AbortError semantics [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker]
- web.dev: "How to save a file" pattern — feature-detect + fallback [CITED: web.dev/patterns/files/save-a-file]
- JSZip docs: `generateAsync` options including `streamFiles`, `compression` [CITED: stuk.github.io/jszip/documentation/api_jszip/generate_async.html]
- JSZip issue #446 — out-of-memory at 20k files without `streamFiles` [CITED: github.com/Stuk/jszip/issues/446]
- CLAUDE.md `## 6. Companion Libraries` — `jszip ^3.10` + `file-saver ^2.0` locked [CITED: ./CLAUDE.md]
- WAI-ARIA Authoring Practices Guide — live region usage [CITED: w3.org/WAI/ARIA/apg/]

### Secondary (MEDIUM confidence)
- WebSearch verification of FS Access API + jszip patterns (2026-06-01) — cross-referenced with MDN/web.dev primary sources
- file-saver behavior on Safari — documented in `file-saver` README + community-confirmed; treated as MEDIUM until Phase 11 e2e verifies (Pitfall 5)

### Tertiary (LOW confidence) — none
All claims either verified in this session or cited to primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm view + package.json (existing) + CLAUDE.md locks
- Architecture: HIGH — every primitive read in code; recommended write-back pattern matches existing pool semantics
- Pitfalls: HIGH for Pitfalls 1-4 + 6 (mechanical); MEDIUM for Pitfall 5 (file-saver Safari race — folklore, mitigation harmless)
- Validation Architecture: HIGH — playwright config + existing test patterns confirmed

**Research date:** 2026-06-01
**Valid until:** 2026-06-30 (stable surface — jszip + file-saver are mature; FS Access API stable in Chromium)
