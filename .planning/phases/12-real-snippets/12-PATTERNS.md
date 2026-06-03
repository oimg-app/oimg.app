# Phase 12: Real Snippets — Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 11 (5 create + 6 modify)
**Analogs found:** 11 / 11

> Pattern source for the planner. Every file in the Phase 12 scope has a concrete analog with line-numbered excerpts. No file is left without a model.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/clipboard.ts` *(new)* | lib | dispatcher / side-effectful | `src/lib/save-blob.ts` | exact-role (write-API dispatcher with feature-detect + fallback + toast) |
| `src/lib/snippets.ts` *(modify)* | lib | pure builder (Promise<string>) | `src/lib/filename.ts` + existing `src/lib/snippets.ts:buildBase64Snippet` | exact (same file is its own model for the Base64 path; filename.ts for pure-helper conventions) |
| `src/hooks/useSnippets.ts` *(new — Claude's Discretion)* | hook | orchestrator (store→builder→clipboard→toast) | `src/hooks/useExport.ts` | exact (bulk-iterate `filesAtom.get().entries`, filter `done`, build, deliver, toast) |
| `src/components/panels/inspector/OutputPanel.tsx` *(modify)* | component | UI (per-file derive + copy) | existing `OutputPanel.tsx` + `src/components/panels/files/FileRow.tsx` STATUS_DOT lookup | exact (mutate Snippet effect deps; mirror per-status lookup table from FileRow) |
| `src/components/shell/Toolbar.tsx` *(modify)* | component | UI (wire menu → hook) | `src/components/shell/Toolbar.tsx` "All as ZIP" / "Save individually" (Phase 11 D-13) | exact (same file is the model; replicate disable-then-explain trio per item) |
| `src/components/panels/files/FileRow.tsx` *(modify)* | component | UI (wire ContextMenuItem → hook) | `src/components/panels/files/FileRow.tsx` `Save as…` item | exact (same file; two new siblings) |
| `src/stores/files.ts` *(modify)* | store | mutating action (re-export only) | existing `exportCopyHtml` / `exportCopyDataUris` / `exportManifestJson` stubs at lines 93-95 | exact (delete stubs; Toolbar binds the new hook directly per Phase 11 precedent) |
| `src/tests/setup/clipboard-mocks.ts` *(new)* | test mock | shared e2e setup | `src/tests/setup/save-file-mocks.ts` | exact (single Playwright `addInitScript` exporting `installClipboardMocks(page, {mode})`) |
| `src/tests/clipboard.test.ts` *(new)* | test | node --experimental-strip-types unit | `src/tests/snippets.test.ts` (Phase 6) + `src/tests/filename.test.ts` | exact (same `let passed; let failed; assert(name, cond)` pattern) |
| `src/tests/output-panel-live.spec.ts` *(new)* | test | Playwright e2e | `src/tests/file-row-menu.spec.ts` `injectEntries` + `src/tests/export-single.spec.ts` `injectDoneFile` | exact (page.evaluate → import `/src/stores/files.ts` → set entries) |
| `src/tests/toolbar-snippets.spec.ts` *(new)* | test | Playwright e2e | `src/tests/export-disabled.spec.ts` (Toolbar disable-then-explain) + `src/tests/file-row-menu.spec.ts` | exact (assert `aria-disabled` + `title` + onClick effect) |
| `src/tests/file-row-snippets.spec.ts` *(new)* | test | Playwright e2e | `src/tests/file-row-menu.spec.ts` | exact (same file is the literal model; add two `menuitem` assertions) |

---

## Pattern Assignments

### `src/lib/clipboard.ts` *(new)* — D-14 / D-15

**Analog:** `src/lib/save-blob.ts` (Phase 11 EXP-01 dispatcher).

**Header comment pattern** (`save-blob.ts:1-15`):
```ts
// Phase 12 — D-14/D-15: copyToClipboard chokepoint — navigator.clipboard.writeText →
// hidden-textarea+execCommand fallback → sonner toast on every call.
// Source: 12-CONTEXT.md D-14/D-15.
// Analog: src/lib/save-blob.ts (Phase 11 EXP-01 dispatcher — feature-detect, silent
// fallback, no throw to caller).
//
// Contract:
//   - Feature-detect window.isSecureContext === true AND 'clipboard' in navigator
//     AND typeof navigator.clipboard.writeText === 'function' before invoking native API.
//   - On rejection / missing API / non-secure: fallback to a positioned-offscreen <textarea>
//     + select() + document.execCommand('copy'), then remove the node.
//   - Toast on every call — success: `${label} copied`; failure (both paths fail):
//     'Copy failed — try again'. Uses sonner `toast.success` / `toast.error`.
//   - NEVER throws to caller — returns { ok, method } for the caller to ignore.
//
// Zero-telemetry: no console.error, no analytics.
```

**Feature-detect + try-native pattern** (mirrors `save-blob.ts:42-86`):
```ts
import { toast } from 'sonner'

export type CopyKind = 'snippet' | 'manifest' | 'data-uri'

export interface CopyResult {
  ok: boolean
  method: 'native' | 'execCommand' | 'failed'
}

export async function copyToClipboard(
  text: string,
  kind: CopyKind,
  label: string,
): Promise<CopyResult> {
  const canUseNative =
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    'clipboard' in navigator &&
    typeof navigator.clipboard?.writeText === 'function'

  if (canUseNative) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
      return { ok: true, method: 'native' }
    } catch {
      // Fall through to execCommand path — do NOT toast yet.
    }
  }

  // Fallback: positioned-offscreen <textarea> + execCommand('copy').
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.width = '1px'
  ta.style.height = '1px'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(ta)
  }

  if (ok) {
    toast.success(`${label} copied`)
    return { ok: true, method: 'execCommand' }
  }
  toast.error('Copy failed — try again')
  return { ok: false, method: 'failed' }
}
```

**Notes:**
- Mirror `save-blob.ts:80-85` AbortError swallow shape — but here the equivalent is "native rejection → fallback try, not user-cancel".
- `kind` parameter is unused in v1 (kept for future analytics off-ramp per D-14 last sentence). Don't add a `void kind` — TypeScript "unused param" is fine on exported function.
- Toaster mount lives in `src/App.tsx:12` (Phase 11) — `toast.success` / `toast.error` are wired.

---

### `src/lib/snippets.ts` *(modify)* — D-01 / D-02 / D-03 / D-04

**Analog (Base64 path — keep verbatim):** existing `src/lib/snippets.ts:44-57`. Already uses real `file.encodedBuffer` via FileReader. **Do NOT regress this.**

**Refactor target:** extract `buildDataUri(file): Promise<string>` that dispatches by `file.target === 'svg'`. Then:
- `buildBase64Snippet` → wraps `buildDataUri` in `<img src="${uri}" alt="${name}"${w}${h}>` (existing shape).
- `buildUrlEncodedSnippet` → wraps in `background-image: url("${uri}");`.
- `buildPictureSnippet` → kind-aware shape per D-03.

**Pure-helper conventions analog** (`src/lib/filename.ts:14-19`):
```ts
/** D-05: replace final extension on a filename. Idempotent if equal. Case-insensitive on incoming ext. */
export function renameExtension(originalName: string, targetExt: string): string {
  const ext = targetExt.toLowerCase()
  const dot = originalName.lastIndexOf('.')
  const base = dot === -1 ? originalName : originalName.slice(0, dot)
  return `${base}.${ext}`
}
```
Mirror: small JSDoc block citing the decision ID (D-01/D-03), single-responsibility, no side effects, no toast.

**Chunked-base64 raster path** (D-02 — call-stack blowup mitigation):
```ts
// D-02: chunked base64 — String.fromCharCode(...new Uint8Array(huge)) blows V8 call
// stack at ~125KB. 32KB (0x8000) window is the standard browser-safe slice size.
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const CHUNK = 0x8000 // 32KB
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  return btoa(binary)
}

function mimeForTarget(target: string): string {
  const t = target.toLowerCase()
  if (t === 'svg') return 'image/svg+xml'
  if (t === 'jpg' || t === 'jpeg') return 'image/jpeg'
  return `image/${t}`
}
```

**SVG URL-encoded path** (D-01 — Yoksel-style minimal-unescape):
```ts
// D-01: Yoksel-style minimal-encoding for SVG data URIs.
// Reference: https://yoksel.github.io/url-encoder
// `encodeURIComponent` over-escapes; restore ( ) ! ~ * ' for shorter, paste-friendly URIs.
function buildSvgDataUri(buf: ArrayBuffer): string {
  // Sanitize control chars first (keeps the snippet valid CSS).
  const svgText = new TextDecoder('utf-8').decode(buf).replace(/[ -]/g, '')
  const encoded = encodeURIComponent(svgText)
    .replace(/'/g, '%27')   // ' must stay encoded for url("…") quoting safety
    .replace(/"/g, '%22')   // " ditto
    .replace(/%20/g, ' ')   // back-unescape spaces (Yoksel minimal-encoding)
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}
```

**`buildDataUri` dispatcher** (Claude's Discretion in CONTEXT.md):
```ts
/** D-01 dispatcher: SVG → URL-encoded UTF-8; raster → chunked base64. */
export async function buildDataUri(file: FileEntry): Promise<string> {
  if (!file.encodedBuffer) {
    throw new Error('buildDataUri: file.encodedBuffer is undefined')
  }
  if (file.target.toLowerCase() === 'svg') {
    return buildSvgDataUri(file.encodedBuffer)
  }
  const b64 = bufferToBase64(file.encodedBuffer)
  return `data:${mimeForTarget(file.target)};base64,${b64}`
}
```

**`buildPictureSnippet` D-03/D-04 shape** (replaces existing lines 79-92):
```ts
/** D-03/D-04: per-file <picture> snippet. */
export function buildPictureSnippet(file: FileEntry): string {
  const { w, h } = parseDim(file.dim)
  const widthAttr = w ? ` width="${w}"` : ''  // D-04: omit when empty
  const heightAttr = h ? ` height="${h}"` : ''
  const alt = escapeAttr(file.name)            // T-12-02: HTML attr injection via file.name
  const targetName = renameExtension(file.name, file.target)  // Phase 11 helper

  // D-03: SVG → bare <img>; raster target === source → bare <img>; else <picture>.
  if (file.target.toLowerCase() === 'svg') {
    return `<img src="${targetName}" alt="${alt}"${widthAttr}${heightAttr}>`
  }
  if (file.target.toLowerCase() === file.type.toLowerCase()) {
    return `<img src="${file.name}" alt="${alt}"${widthAttr}${heightAttr}>`
  }
  return [
    '<picture>',
    `  <source srcset="${targetName}" type="${mimeForTarget(file.target)}">`,
    `  <img src="${file.name}" alt="${alt}"${widthAttr}${heightAttr}>`,
    '</picture>',
  ].join('\n')
}

// T-12-02: minimal HTML-attr escape for filenames containing "/&/</>.
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
```

**Pitfall:** the existing `buildBase64Snippet` does NOT escape `alt`. Phase 12 must close that hole as part of the refactor (`assert: snippets reject "><script>` test case).

---

### `src/hooks/useSnippets.ts` *(new)* — D-09 / D-10 / D-11 / D-12

**Analog:** `src/hooks/useExport.ts` (full file — same shape).

**Header + structure** (`useExport.ts:1-20, 40-44`):
```ts
// Phase 12 — D-09/D-10/D-11/D-12: useSnippets — Toolbar bulk + FileRow per-row
// snippet/manifest copy orchestrator. Routes everything through copyToClipboard (D-15).
// Source: 12-CONTEXT.md D-09..D-13.
// Analog: src/hooks/useExport.ts (same shape — filesAtom.get() inside each method
// body to avoid stale-closure capture per useOptimize discipline).
import { useStore } from '@nanostores/react'
import { filesAtom } from '@/stores/files'
import type { FileEntry } from '@/stores/files'
import { copyToClipboard } from '@/lib/clipboard'
import {
  buildPictureSnippet,
  buildDataUri,
} from '@/lib/snippets'
import { renameExtension } from '@/lib/filename'

export function useSnippets() {
  useStore(filesAtom)  // reactive subscription for $hasDone-aware re-renders

  async function copyPictureBulk(): Promise<void> {
    const { entries } = filesAtom.get()
    const done = entries.filter((e) => e.status === 'done' && e.encodedBuffer != null)
    if (done.length === 0) return  // D-08 guard belt-and-suspenders
    const blocks = done.map((f) => buildPictureSnippet(f))
    const text = blocks.join('\n\n')
    await copyToClipboard(text, 'snippet', `<picture> for ${done.length} files`)
  }

  async function copyDataUrisBulk(): Promise<void> {
    const { entries } = filesAtom.get()
    const done = entries.filter((e) => e.status === 'done' && e.encodedBuffer != null)
    if (done.length === 0) return
    const uris = await Promise.all(done.map((f) => buildDataUri(f)))
    const text = uris.join('\n')
    await copyToClipboard(text, 'data-uri', `Data URIs for ${done.length} files`)
  }

  async function copyManifestJson(): Promise<void> {
    const { entries } = filesAtom.get()
    const done = entries.filter((e) => e.status === 'done')
    if (done.length === 0) return
    const manifest = done.map((f) => ({
      filename: renameExtension(f.name, f.target),   // D-11: ZIP-matching name
      target: f.target,
      originalSize: f.orig,
      optimizedSize: f.opt,
      quality: f.q ?? null,
    }))
    const text = JSON.stringify(manifest, null, 2)
    await copyToClipboard(text, 'manifest', `Manifest for ${done.length} files`)
  }

  async function copyPictureOne(file: FileEntry): Promise<void> {
    if (file.status !== 'done' || !file.encodedBuffer) return
    const text = buildPictureSnippet(file)
    await copyToClipboard(text, 'snippet', `<picture> for ${file.name}`)
  }

  async function copyDataUriOne(file: FileEntry): Promise<void> {
    if (file.status !== 'done' || !file.encodedBuffer) return
    const text = await buildDataUri(file)
    await copyToClipboard(text, 'data-uri', `Data URI for ${file.name}`)
  }

  return { copyPictureBulk, copyDataUrisBulk, copyManifestJson, copyPictureOne, copyDataUriOne }
}
```

**Stale-closure trap reminder** (`useExport.ts:42-44`): "exportZip / exportIndividually MUST read filesAtom.get() inside their bodies". Same rule here.

---

### `src/components/panels/inspector/OutputPanel.tsx` *(modify)* — D-05 / D-06 / D-07

**Analog 1 (effect-dep fix — D-05):** existing `OutputPanel.tsx:47-50`:
```ts
useEffect(() => {
  builder(file).then(setText)
}, [file])  // BUG: misses encodedBuffer change
```
**Replace with:**
```ts
useEffect(() => {
  builder(file).then(setText)
  // D-05: re-run when bytes change (live-encode push) or target swap.
}, [file?.id, file?.encodedBuffer, file?.target])
```

**Analog 2 (per-status lookup — D-06):** `FileRow.tsx:67-72` STATUS_DOT lookup table:
```ts
const STATUS_DOT: Record<string, string> = {
  queued:     'bg-[var(--fg-3)]',
  processing: 'bg-[var(--info)] animate-pulse',
  done:       'bg-[var(--primary)]',
  error:      'bg-[var(--err)]',
}
```
**Mirror in OutputPanel** as a per-section state table:
```ts
// D-06: per-status presentation inside each <Section>.
function SectionBody({ file, builder, sectionId, onCopy, isCopied, ariaLabel }: SectionBodyProps) {
  if (file.status === 'queued') {
    return <p className="text-[12px] text-[var(--color-fg-3)]">Optimize this file first</p>
  }
  if (file.status === 'error') {
    return <p className="text-[12px] text-[var(--color-err)]">{file.error ?? 'Encoding failed'}</p>
  }
  if (file.status === 'processing' || !file.encodedBuffer) {
    return (
      <div className="h-[60px] rounded-md bg-[var(--color-bg-2)] animate-pulse" aria-label="Encoding in progress" />
    )
  }
  // done + encodedBuffer present → real snippet (existing pre block)
  return <Snippet ... />
}
```

**Analog 3 (clipboard call site — D-15):** existing `OutputPanel.tsx:101-109`:
```ts
async function handleCopy(sectionId: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)  // D-15 violation
    setCopied(sectionId)
    setTimeout(() => setCopied(null), 1500)
  } catch {
    pushToast('Clipboard unavailable — check browser permissions')
  }
}
```
**Replace with:**
```ts
import { copyToClipboard } from '@/lib/clipboard'

async function handleCopy(sectionId: string, text: string, label: string) {
  const { ok } = await copyToClipboard(text, 'snippet', label)
  if (ok) {
    setCopied(sectionId)
    setTimeout(() => setCopied(null), 1500)
  }
  // Failure toast already raised by copyToClipboard — do not double-toast.
}
```

**Section title used as label** — pass `title` through the existing SECTIONS map so the toast reads "Data URI · Base64 copied" not generic "Snippet copied".

---

### `src/components/shell/Toolbar.tsx` *(modify)* — D-08

**Analog:** the existing "All as ZIP" / "Save individually" trio in `Toolbar.tsx:117-131` (Phase 11 D-13).

**Disable-then-explain pattern** (`Toolbar.tsx:117-123`):
```tsx
<button
  type="button"
  className={cn(menuItemClass, !hasDone && 'opacity-50 cursor-not-allowed')}
  onClick={() => { void exportZip(); setOpen(null) }}
  disabled={!hasDone}
  aria-disabled={!hasDone}
  title={disabledTitle}
>All as ZIP</button>
```

**Replace the three current bulk-snippet buttons** at `Toolbar.tsx:132-134`:
```tsx
{/* Current — call empty stubs in the store */}
<button type="button" className={menuItemClass} onClick={() => { exportCopyHtml(); setOpen(null) }}>{'Copy <picture> HTML'}</button>
<button type="button" className={menuItemClass} onClick={() => { exportCopyDataUris(); setOpen(null) }}>Copy as data URIs</button>
<button type="button" className={menuItemClass} onClick={() => { exportManifestJson(); setOpen(null) }}>Manifest JSON</button>
```
**With (mirroring lines 117-131):**
```tsx
const { copyPictureBulk, copyDataUrisBulk, copyManifestJson } = useSnippets()
// ...
<button
  type="button"
  className={cn(menuItemClass, !hasDone && 'opacity-50 cursor-not-allowed')}
  onClick={() => { void copyPictureBulk(); setOpen(null) }}
  disabled={!hasDone}
  aria-disabled={!hasDone}
  title={disabledTitle}
>{'Copy <picture> HTML'}</button>
<button
  type="button"
  className={cn(menuItemClass, !hasDone && 'opacity-50 cursor-not-allowed')}
  onClick={() => { void copyDataUrisBulk(); setOpen(null) }}
  disabled={!hasDone}
  aria-disabled={!hasDone}
  title={disabledTitle}
>Copy as data URIs</button>
<button
  type="button"
  className={cn(menuItemClass, !hasDone && 'opacity-50 cursor-not-allowed')}
  onClick={() => { void copyManifestJson(); setOpen(null) }}
  disabled={!hasDone}
  aria-disabled={!hasDone}
  title={disabledTitle}
>Manifest JSON</button>
```
Also remove the imports of `exportCopyHtml`, `exportCopyDataUris`, `exportManifestJson` from `@/stores/files` at line 7 — replaced by the hook destructure.

---

### `src/components/panels/files/FileRow.tsx` *(modify)* — D-12 / D-13

**Analog:** existing `Save as…` item at `FileRow.tsx:138-145`:
```tsx
<ContextMenuItem
  disabled={file.status !== 'done'}
  title={file.status !== 'done' ? 'Optimize this file first' : undefined}
  onSelect={() => { void exportOne(file) }}
>
  <DownloadSimple size={14} />
  Save as…
</ContextMenuItem>
```

**Replace** the two placeholder items at `FileRow.tsx:146-153`:
```tsx
{/* Current — placeholders */}
<ContextMenuItem onSelect={() => { /* @TODO Phase 3 — pushToast('Copy data URI') */ }}>
  <Copy size={14} />
  Copy data URI
</ContextMenuItem>
<ContextMenuItem onSelect={() => { /* @TODO Phase 3 — pushToast('Copy <picture>') */ }}>
  <Code size={14} />
  {'Copy <picture>'}
</ContextMenuItem>
```
**With** (siblings after `Save as…`, flat menu per CONTEXT.md Claude's Discretion):
```tsx
const { copyDataUriOne, copyPictureOne } = useSnippets()
// ...
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

**Icon imports already present** at `FileRow.tsx:4-13` (Copy, Code). No new icon needed.

---

### `src/stores/files.ts` *(modify)* — D-09 / D-10 / D-11 stub deletion

**Analog:** the comment block at `files.ts:89-95` that already retired `exportAsZip` / `exportIndividually`:
```ts
// Export — All as ZIP + Save individually wired through useExport() hook (Phase 11 Plan 05).
// The empty `exportAsZip` / `exportIndividually` stubs were retired here so Toolbar binds to
// the hook directly per CLAUDE.md "business logic in hooks, not stores when React lifecycle
// is needed". The three remaining stubs below are Phase 12 placeholders.
export function exportCopyHtml(): void {}
export function exportCopyDataUris(): void {}
export function exportManifestJson(): void {}
```
**Replace lines 89-95 with** (mirroring the prior retirement comment):
```ts
// Phase 12 — D-09/D-10/D-11: Copy <picture> HTML / data URIs / Manifest JSON
// wired through useSnippets() hook. Same precedent as Phase 11 retirement: Toolbar binds
// the hook directly; the empty stubs are deleted to prevent regression imports.
```

**Note:** `$hasDone` at `files.ts:65-66` is reused verbatim by Toolbar bulk items per D-08. No store change needed there.

---

### `src/tests/setup/clipboard-mocks.ts` *(new — Wave 0)*

**Analog:** `src/tests/setup/save-file-mocks.ts` end-to-end.

**Shape (mirroring lines 45-136):**
```ts
// Phase 12 Wave 0 — shared clipboard mocks for D-14/D-15 chokepoint.
// Captures both code paths:
//   1. navigator.clipboard.writeText — recorded into window.__clipboardWrites
//   2. document.execCommand('copy') over textarea — recorded into window.__execCopyCalls
//
// Consumed by:
//   - src/tests/clipboard.test.ts (unit) — happy path + fallback fork
//   - src/tests/output-panel-live.spec.ts (e2e)
//   - src/tests/toolbar-snippets.spec.ts (e2e)
//   - src/tests/file-row-snippets.spec.ts (e2e)
//
// Mode reference:
//   - 'native'      : navigator.clipboard.writeText resolves; execCommand never reached.
//   - 'fallback'    : navigator.clipboard is deleted; execCommand path is the only available.
//   - 'fail-both'   : native rejects + execCommand returns false (D-14 failure toast).
import type { Page } from '@playwright/test'

export type ClipboardMockMode = 'native' | 'fallback' | 'fail-both'

export interface ClipboardMockGlobals {
  __clipboardWrites?: string[]
  __execCopyCalls?: string[]
  __clipboardMocksInstalled?: boolean
}

export async function installClipboardMocks(
  page: Page,
  opts: { mode?: ClipboardMockMode } = {},
): Promise<void> {
  const mode = opts.mode ?? 'native'
  await page.addInitScript(({ mode: m }: { mode: ClipboardMockMode }) => {
    type Win = Window & ClipboardMockGlobals & {
      __originalExecCommand?: typeof document.execCommand
    }
    const w = window as unknown as Win
    w.__clipboardWrites = []
    w.__execCopyCalls = []
    w.__clipboardMocksInstalled = true

    if (m === 'fallback' || m === 'fail-both') {
      // Force the fallback path by deleting / nullifying clipboard API.
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    } else {
      // 'native' mode — stub writeText to record + resolve.
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (w.__clipboardWrites ?? (w.__clipboardWrites = [])).push(text)
          },
        },
        configurable: true,
      })
    }

    // execCommand spy (always installed; selects-and-records the active textarea).
    w.__originalExecCommand = document.execCommand
    document.execCommand = function patched(cmd: string): boolean {
      if (cmd === 'copy') {
        const ta = document.activeElement as HTMLTextAreaElement | null
        if (ta && 'value' in ta) {
          (w.__execCopyCalls ?? (w.__execCopyCalls = [])).push(ta.value)
        }
        return m === 'fail-both' ? false : true
      }
      return w.__originalExecCommand!.call(document, cmd)
    } as typeof document.execCommand
  }, { mode })
}
```

**Cleanup contract (per VALIDATION.md Wave-0 note):** if `save-file-mocks.ts` clobbers `document.execCommand` in any spec, isolate via `beforeEach`/`afterEach`. The mode is `addInitScript`-based so it persists per page — pair with `page.close()` between describes when both mocks coexist.

---

### `src/tests/clipboard.test.ts` *(new — unit)*

**Analog:** `src/tests/snippets.test.ts:1-106` literally — same `let passed; let failed; assert(name, cond)` pattern.

**Header + shape:**
```ts
// Phase 12 — D-14/D-15 clipboard chokepoint unit test
// Run: node --experimental-strip-types src/tests/clipboard.test.ts

let passed = 0
let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) passed++; else { failed++; console.error(`FAIL: ${name}`) }
}

;(async () => {
  // Stub globals BEFORE importing the module under test.
  const writes: string[] = []
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).window.isSecureContext = true
  ;(globalThis as any).navigator = {
    clipboard: { writeText: async (t: string) => { writes.push(t) } },
  }
  ;(globalThis as any).document = {
    createElement: () => ({ value: '', setAttribute() {}, style: {}, select() {} }),
    body: { appendChild() {}, removeChild() {} },
  }
  // Stub sonner (intercept toast.success/error to log without barfing).
  ;(globalThis as any).__sonnerCalls = [] as string[]

  const { copyToClipboard } = await import('../lib/clipboard.ts')
  const result = await copyToClipboard('hello', 'snippet', 'Base64')
  assert('native path resolves ok=true', result.ok === true)
  assert('native path method=native', result.method === 'native')
  assert('native path wrote "hello"', writes[0] === 'hello')

  console.log(`${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})()
```

**Note:** Sonner stubbing is the awkward bit. Simplest path: have `clipboard.ts` re-export the sonner `toast` import via `@/stores/runtime`'s pushToast OR keep the direct sonner import but in unit-test, register a `vi.mock`-equivalent shim — since this is `node --experimental-strip-types` (no Vitest in this file), use a `globalThis.toast` shim and ensure `clipboard.ts` imports through a path that resolves to a side-effect-free re-export. Recommend: planner decide between (a) module-rewrite import to a `toast()` from `@/stores/runtime` (already in the codebase, see `src/components/panels/inspector/OutputPanel.tsx:7`) or (b) full Vitest mock infra. The CONTEXT.md says "Phase 12 needs no new deps" → go with (a): import `toast` from `'sonner'` but accept that the unit test only exercises the navigator/textarea wiring; the toast call is best verified in the e2e specs.

---

### `src/tests/output-panel-live.spec.ts` *(new — e2e)*

**Analog 1 (inject pattern):** `src/tests/file-row-menu.spec.ts:34-72` `injectEntries`. Reuse verbatim.
**Analog 2 (latch deterministic state):** `export-single.spec.ts:86-90`:
```ts
await page.waitForFunction(
  () => (window as unknown as { __savedFiles?: Array<{ name: string }> }).__savedFiles?.length === 1,
  undefined,
  { timeout: 5000 },
)
```
**Pattern for live-encode re-render (D-05):**
```ts
test('Output panel re-renders snippet when encodedBuffer changes (D-05)', async ({ page }) => {
  await installClipboardMocks(page, { mode: 'native' })
  await page.goto('/')
  await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp' }])
  await page.getByRole('button', { name: /output/i }).click()

  const initial = await page.locator('[data-testid="output-panel"] pre').first().textContent()
  expect(initial).toContain('data:image/webp;base64,')

  // Mutate encodedBuffer in-place.
  await page.evaluate(async () => {
    const { filesAtom } = await import(/* @vite-ignore */ '/src/stores/files.ts')
    const newBuf = new Uint8Array([89, 89, 89]).buffer
    const entries = filesAtom.get().entries.map(e => e.id === 'f1' ? { ...e, encodedBuffer: newBuf } : e)
    filesAtom.setKey('entries', entries)
  })

  await page.waitForFunction(() => {
    const txt = document.querySelector('[data-testid="output-panel"] pre')?.textContent ?? ''
    return txt.includes('WVlZ')   // base64 of [89,89,89] = "WVlZ"
  }, undefined, { timeout: 3000 })
})
```

---

### `src/tests/toolbar-snippets.spec.ts` *(new — e2e)*

**Analog 1:** `src/tests/export-disabled.spec.ts` (Phase 11 D-13 disable-then-explain).
**Analog 2:** `src/tests/file-row-menu.spec.ts:154-167` aria-disabled + title assertions:
```ts
const saveAs = page.getByRole('menuitem', { name: /^Save as…$/ })
await expect(saveAs).toBeVisible()
await expect(saveAs).toHaveAttribute('aria-disabled', 'true')
await expect(saveAs).toHaveAttribute('title', 'Optimize this file first')
```

**Pattern: assert clipboard write happened**
```ts
await page.getByRole('button', { name: /^Copy <picture> HTML$/ }).click()
await page.waitForFunction(() =>
  (window as any).__clipboardWrites?.length === 1,
)
const text = await page.evaluate(() => (window as any).__clipboardWrites[0])
expect(text).toContain('<picture>')
expect(text).toContain('<source srcset="')
```

---

### `src/tests/file-row-snippets.spec.ts` *(new — e2e)*

**Analog:** `src/tests/file-row-menu.spec.ts` end-to-end — literal copy of the `injectEntries` helper + `rightClickRow` helper. Add two new tests:

```ts
test('Copy <picture> menuitem invokes useSnippets.copyPictureOne', async ({ page }) => {
  await installClipboardMocks(page, { mode: 'native' })
  await page.goto('/')
  await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp' }])
  await rightClickRow(page, 'hero.png')

  const item = page.getByRole('menuitem', { name: /^Copy <picture>$/ })
  await expect(item).toBeVisible()
  await item.click()

  await page.waitForFunction(() => (window as any).__clipboardWrites?.length === 1)
  const text = await page.evaluate(() => (window as any).__clipboardWrites[0])
  expect(text).toContain('<picture>')
})

test('Copy data-URI menuitem disabled when status !== done (D-13)', async ({ page }) => {
  await installClipboardMocks(page, { mode: 'native' })
  await page.goto('/')
  await injectEntries(page, [{ id: 'f1', name: 'hero.png', target: 'webp', status: 'queued' }])
  await rightClickRow(page, 'hero.png')

  const item = page.getByRole('menuitem', { name: /^Copy data-URI$/ })
  await expect(item).toHaveAttribute('aria-disabled', 'true')
  await expect(item).toHaveAttribute('title', 'Optimize this file first')
})
```

---

## Shared Patterns

### Disable-then-explain (D-08, D-13)
**Source:** `src/components/shell/Toolbar.tsx:117-123` + `src/components/panels/files/FileRow.tsx:138-145`.
**Apply to:** Toolbar bulk items × 3 (D-08), FileRow row items × 2 (D-13).
**Triple:**
```tsx
disabled={!hasDone}              // or {file.status !== 'done'}
aria-disabled={!hasDone}
title={!hasDone ? 'Optimize at least one file first' : undefined}  // FileRow: 'Optimize this file first'
```

### `filesAtom.get()` inside async hook bodies (stale-closure trap)
**Source:** `src/hooks/useExport.ts:42-44` doc comment + lines 58, 89.
**Apply to:** Every async method in `useSnippets.ts`. Never destructure `entries` at hook-top.

### Sonner toast surface
**Source:** `src/hooks/useExport.ts:17` + `src/hooks/useOptimize.ts:7`.
**Apply to:** `src/lib/clipboard.ts` only. All other surfaces let the chokepoint toast (D-14 last sentence "do NOT throw to caller").
```ts
import { toast } from 'sonner'
toast.success(`${label} copied`)
toast.error('Copy failed — try again')
```

### Effect deps include `file?.encodedBuffer`
**Source:** D-05 in CONTEXT.md; previous bug at `OutputPanel.tsx:50`.
**Apply to:** Any other effect that derives from a file's bytes — at present only OutputPanel.

### Test entry injection via `page.evaluate` + `/src/...` import URLs
**Source:** `src/tests/file-row-menu.spec.ts:34-72`; `src/tests/export-single.spec.ts:26-64`.
**Apply to:** all three new e2e specs. Note from MEMORY: `/src/...` imports inside `page.evaluate` are an accepted Vite-dev pattern.

### Phase 6 `let passed; let failed; assert(name, cond)` unit test shape
**Source:** `src/tests/snippets.test.ts` end-to-end.
**Apply to:** `src/tests/clipboard.test.ts`. No Vitest framework — pure `node --experimental-strip-types`.

---

## No Analog Found

(None — every Phase 12 file has at least a role-match analog already in the tree. The single discretion point is the `useSnippets.ts` vs extending `useExport.ts` question; CONTEXT.md recommends the new hook to keep `useExport`'s download/ZIP focus clean, and the analog `useExport.ts` shape is literally the template for the new hook.)

---

## Metadata

**Analog search scope:** `src/lib`, `src/hooks`, `src/stores`, `src/components/{shell,panels}`, `src/tests`, `src/tests/setup`.
**Files scanned (Read):** 12 source files + 4 test files.
**Files scanned (grep/ls):** 30+.
**Pattern extraction date:** 2026-06-03.
