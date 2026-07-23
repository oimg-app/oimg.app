# Phase 15 — Research

**Date:** 2026-06-12
**Goal:** Plan the wiring of Toolbar "From URL or paste" + document-level Cmd/Ctrl+V into the existing `useIngest.ingest()` single-pipeline seam.
**Confidence:** HIGH — browser API behavior and CORS limitations are physical browser constraints, not opinion. Most technical decisions are locked in CONTEXT.md (D-01..D-15) and the milestone artifact `.planning/research/v1.2-ingest.md`. This document extends them with code-shaped guidance the planner needs.

---

## TL;DR

- **One dispatcher, two surfaces.** Extract `pickFromClipboard()` into `src/lib/clipboard-ingest.ts`. Both the Toolbar menu onClick AND the document-level paste handler call the same function. Single source of truth for the decision tree.
- **`pickFromUrl(url)`** lives in `src/lib/url-ingest.ts`. Tries direct `fetch` (mode: cors); validates content-type; sanitizes URL-derived filename via existing `sanitizeBaseName`; returns a `File` or `null` (null on any failure). Never throws; emits its own toast on CORS.
- **`useClipboardIngest()`** lives in `src/hooks/useClipboardIngest.ts`. Mounts a `document.paste` listener inside `useEffect`. Mirrors `useWatchFolder` hook shape.
- **Toolbar wire-up** replaces the empty `addFromUrl()` stub. Delete the stub from `src/stores/files.ts:100`. Delete the import at `src/components/shell/Toolbar.tsx:22`.
- **No new deps.** All browser APIs (paste event, ClipboardEvent, fetch, URL, ClipboardItem, ClipboardItem.types). Bundle ≤ +1.5 KB initial gzip — well inside the 200 KB budget (197.97 KB after Phase 14).
- **Toast wording** uses sonner's `toast.success` / `toast.error` (matches `useExport` precedent), NOT `pushToast` (which is the runtime atom queue — orthogonal). Drafts finalized in §6.
- **CORS is non-negotiable physics.** No `<img crossorigin> + canvas.toBlob()` fallback — research-rejected because it silently re-encodes the image and loses format.

---

## 1. Integration Map — Concrete Signatures

### 1.1 `src/lib/url-ingest.ts` (NEW — task 15-01)

```ts
// Phase 15 — ING-01: URL → File dispatcher with CORS-honest failure messaging.
// Returns null on ANY failure (network, CORS, non-image MIME, oversized). Never throws.
// Emits its own toast on failure so callers can no-op gracefully.
import { toast } from 'sonner'
import { sanitizeBaseName } from '@/lib/filename'

const MAX_URL_BYTES = 100 * 1024 * 1024 // 100 MB hard cap

const EXT_FROM_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export async function pickFromUrl(url: string): Promise<File | null> {
  // Validate scheme — http/https only. Reject data:, blob:, file:, javascript:.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    toast.error('Invalid URL')
    return null
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    toast.error('Only http(s) URLs are supported')
    return null
  }

  let res: Response
  try {
    res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  } catch {
    // T-15-CORS: fetch threw — almost certainly CORS rejection or network error.
    // Zero-telemetry: do NOT console.log.
    toast.error('URL blocked by CORS — download and drop the file, or paste it directly.')
    return null
  }
  if (!res.ok) {
    toast.error(`URL fetch failed (${res.status})`)
    return null
  }

  const ct = (res.headers.get('content-type') ?? '').toLowerCase().split(';')[0].trim()
  if (!ct.startsWith('image/')) {
    toast.error('URL did not return an image')
    return null
  }

  // Size cap before draining the body
  const cl = Number(res.headers.get('content-length') ?? 0)
  if (cl > MAX_URL_BYTES) {
    toast.error('Image is too large (max 100 MB)')
    return null
  }

  let blob: Blob
  try {
    blob = await res.blob()
  } catch {
    toast.error('Failed to read image bytes')
    return null
  }
  if (blob.size > MAX_URL_BYTES) {
    toast.error('Image is too large (max 100 MB)')
    return null
  }

  const filename = deriveFilename(parsed, res, blob.type || ct)
  return new File([blob], filename, {
    type: blob.type || ct,
    lastModified: Date.now(),
  })
}

function deriveFilename(parsed: URL, res: Response, mime: string): string {
  // Priority 1: Content-Disposition filename
  const cd = res.headers.get('content-disposition') ?? ''
  const cdMatch = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
  if (cdMatch?.[1]) {
    try {
      return sanitizeBaseName(decodeURIComponent(cdMatch[1]))
    } catch {
      return sanitizeBaseName(cdMatch[1])
    }
  }

  // Priority 2: last path segment, percent-decoded
  const last = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
  if (last) {
    try {
      const decoded = decodeURIComponent(last)
      if (decoded.length > 0) return sanitizeBaseName(decoded)
    } catch {
      // malformed percent-encoding — fall through
    }
  }

  // Priority 3: timestamped fallback by MIME
  const ext = EXT_FROM_MIME[mime] ?? 'bin'
  return sanitizeBaseName(`pasted-image-${Date.now()}.${ext}`)
}
```

### 1.2 `src/lib/clipboard-ingest.ts` (NEW — task 15-02)

```ts
// Phase 15 — ING-01: shared clipboard dispatcher. Called by Toolbar onClick AND
// document.paste listener (useClipboardIngest). Walks clipboard contents in this
// order: image bytes → URL string → toast "no image" fallback.
//
// Two entry points:
//   pickFromClipboard()            — programmatic read (Toolbar onClick path)
//   processClipboardEvent(e, …)   — sync ClipboardEvent walk (paste handler path)
//
// Both route into useIngest.ingest() via the caller-supplied dispatcher so this
// lib does NOT import useIngest (hooks are React-bound; libs are not).
import { toast } from 'sonner'
import { pickFromUrl } from '@/lib/url-ingest'

// D-04: extension-based image URL detection (HEIC stays — quick task 260610-lby).
const IMAGE_URL_RE = /\.(png|jpe?g|webp|avif|gif|svg|heic|heif)(\?.*)?$/i

export interface ClipboardDispatcher {
  ingest(files: File[]): Promise<void>
}

/**
 * Programmatic clipboard read — used by the Toolbar onClick path.
 * Falls through to a "use Cmd/Ctrl+V instead" toast if the secure-context
 * permission UX is missing.
 */
export async function pickFromClipboard(d: ClipboardDispatcher): Promise<void> {
  // Feature-detect navigator.clipboard.read (Chrome/Edge secure context).
  const nc = (navigator as Navigator & { clipboard?: { read?: () => Promise<ClipboardItem[]>; readText?: () => Promise<string> } }).clipboard
  if (!nc?.read && !nc?.readText) {
    toast.error('Clipboard read needs HTTPS + permission — try Cmd/Ctrl+V instead.')
    return
  }

  // Try ClipboardItem.read() first (delivers image bytes).
  if (nc.read) {
    try {
      const items = await nc.read()
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const ext = imageType.split('/')[1]?.split('+')[0] ?? 'bin'
          const name = `pasted-image-${Date.now()}.${ext}`
          const file = new File([blob], name, { type: imageType })
          await d.ingest([file])
          toast.success(`Pasted from clipboard: ${file.name}`)
          return
        }
      }
    } catch {
      // permission denied OR no clipboard items — fall through to text path.
    }
  }

  // Fall back to text → URL routing.
  if (nc.readText) {
    let text = ''
    try {
      text = await nc.readText()
    } catch {
      toast.error('Clipboard read needs HTTPS + permission — try Cmd/Ctrl+V instead.')
      return
    }
    const trimmed = text.trim()
    if (trimmed && IMAGE_URL_RE.test(trimmed)) {
      const file = await pickFromUrl(trimmed)
      if (file) {
        await d.ingest([file])
        try {
          toast.success(`Imported from URL: ${new URL(trimmed).host}`)
        } catch {
          toast.success('Imported from URL')
        }
      }
      // pickFromUrl already toasted on failure — no double-toast.
      return
    }
  }

  toast.message('Clipboard has no image or image URL')
}

/**
 * Synchronous ClipboardEvent walk — used by document.paste handler.
 * Returns true if the event was consumed (caller should call e.preventDefault()).
 */
export async function processClipboardEvent(
  e: ClipboardEvent,
  d: ClipboardDispatcher,
): Promise<boolean> {
  const items = e.clipboardData?.items
  if (!items?.length) return false

  // D-05: image wins over text in same paste.
  const files: File[] = []
  let urlText: string | null = null

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) files.push(f)
    } else if (item.kind === 'string' && (item.type === 'text/plain' || item.type === 'text/uri-list')) {
      // getAsString is callback-based; wrap in a promise (only first text wins).
      if (urlText === null) {
        urlText = await new Promise<string>((resolve) => item.getAsString(resolve))
      }
    }
  }

  if (files.length > 0) {
    await d.ingest(files)
    toast.success(`Pasted from clipboard: ${files[0].name || 'pasted-image'}`)
    return true
  }

  const trimmed = urlText?.trim()
  if (trimmed && IMAGE_URL_RE.test(trimmed)) {
    const file = await pickFromUrl(trimmed)
    if (file) {
      await d.ingest([file])
      try {
        toast.success(`Imported from URL: ${new URL(trimmed).host}`)
      } catch {
        toast.success('Imported from URL')
      }
    }
    return true
  }

  // Nothing usable. Do NOT preventDefault (let browser handle uninterpreted text paste).
  // Do NOT toast either — paste events fire frequently; spurious toasts are noise.
  return false
}
```

### 1.3 `src/hooks/useClipboardIngest.ts` (NEW — task 15-03)

```ts
// Phase 15 — ING-02: document-level Cmd/Ctrl+V handler. Mirrors useWatchFolder shape
// (Quick task 260603-s2x). Mounts the listener inside useEffect; cleans up on unmount.
import { useEffect } from 'react'
import { useIngest } from '@/hooks/useIngest'
import { processClipboardEvent } from '@/lib/clipboard-ingest'

export function useClipboardIngest(): void {
  const { ingest } = useIngest()

  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      // D-11: input-elements early return.
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      const consumed = await processClipboardEvent(e, { ingest })
      // D-12: preventDefault ONLY when we consumed the event.
      if (consumed) e.preventDefault()
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [ingest])
}
```

### 1.4 Toolbar wire-up (task 15-04)

`src/components/shell/Toolbar.tsx`:
- Line 22: delete `addFromUrl,` import.
- Lines 153-156: replace the onClick body. Inside the Toolbar component body, derive a dispatcher: `const { ingest } = useIngest()` is already available (line 28). The "From URL or paste" button's onClick becomes:
  ```tsx
  onClick={() => {
    void pickFromClipboard({ ingest })
    setOpen(null)
  }}
  ```
- Add import: `import { pickFromClipboard } from '@/lib/clipboard-ingest'`

`src/stores/files.ts`:
- Line 100: delete `export function addFromUrl(): void {}`.

`src/App.tsx`:
- Add `useClipboardIngest()` call inside the existing functional component body (NOT inside the SW useEffect):
  ```tsx
  import { useClipboardIngest } from '@/hooks/useClipboardIngest'
  …
  export default function App() {
    useClipboardIngest() // Phase 15 — ING-02: document-level Cmd/Ctrl+V handler.
    useEffect(() => { /* existing SW bootstrap */ }, [])
    …
  }
  ```

---

## 2. Image URL Detection Regex (D-04)

```ts
const IMAGE_URL_RE = /\.(png|jpe?g|webp|avif|gif|svg|heic|heif)(\?.*)?$/i
```

- **Extensions covered:** png, jpg, jpeg, webp, avif, gif, svg, heic, heif.
- **HEIC/HEIF stay** — quick task 260610-lby added HEIC decode-only input support; URL-detect parity.
- **Query string tolerated** — `?cache=123` after extension.
- **First-pass classification only.** Content-Type HEAD probe explicitly out of scope (D-04 deferred); the fetch path's blob.type check catches bait URLs downstream.

---

## 3. Inputs-Elements Guard (D-11)

```ts
const target = e.target as HTMLElement | null
const tag = target?.tagName?.toLowerCase()
if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
```

Verified against the only text inputs in the app:
- `src/components/shell/Toolbar.tsx` filter input — `<input type="text">`.
- Search field in FilesPane — same.
- shadcn `Input` components in Settings popover — render as `<input>`.

No Shadow DOM components in the codebase — the simple `e.target.tagName` check covers all real cases. `e.composedPath()` not needed.

---

## 4. Filename Derivation Algorithm

Priority order:

1. **Content-Disposition `filename=`** — try `decodeURIComponent`, fall back to raw on `URIError`. Pass through `sanitizeBaseName`.
2. **Last URL path segment** — split on `/`, drop empties, take the last segment. `decodeURIComponent` inside try/catch. Pass through `sanitizeBaseName`.
3. **Timestamped fallback** — `pasted-image-${Date.now()}.${extFromMime}`. Pass through `sanitizeBaseName`.

Test cases:

| URL | Expected filename |
|---|---|
| `https://cdn.example.com/photo.png` | `photo.png` |
| `https://cdn.example.com/p%C3%A9o%20le.jpg` | `péo le.jpg` (decoded) |
| `https://cdn.example.com/p%E0%A0/file.png` | `file.png` (decode fails for path; last segment is clean) |
| `https://cdn.example.com/img?key=abc` (CD: `attachment; filename="cat.png"`) | `cat.png` |
| `https://cdn.example.com/` (no path) | `pasted-image-<ts>.png` (from MIME) |
| `https://cdn.example.com/../../etc/passwd` | `..__..__etc_passwd` (sanitizeBaseName replaces `/` and `\`) |

Sanity: `sanitizeBaseName` from `src/lib/filename.ts:54` replaces `/`, `\`, and NUL with `_`. Zip-slip mitigation reused (T-15-04).

---

## 5. Toast Wording (Finalized)

Use sonner directly via `import { toast } from 'sonner'`. Matches `useExport.ts` precedent (lines 38, 55, 76). Do NOT use `pushToast` (the runtime atom queue is for status-bar messages, not user feedback).

| Surface | Method | Text |
|---|---|---|
| Image bytes ingested (Toolbar or paste) | `toast.success` | `Pasted from clipboard: ${name}` |
| URL ingested | `toast.success` | `Imported from URL: ${host}` (graceful `Imported from URL` on `new URL` throw) |
| CORS / network failure | `toast.error` | `URL blocked by CORS — download and drop the file, or paste it directly.` |
| HTTP non-2xx | `toast.error` | `URL fetch failed (${status})` |
| Non-image content-type | `toast.error` | `URL did not return an image` |
| Oversized (>100 MB) | `toast.error` | `Image is too large (max 100 MB)` |
| Invalid URL scheme | `toast.error` | `Only http(s) URLs are supported` |
| Malformed URL | `toast.error` | `Invalid URL` |
| Permission denied / not secure | `toast.error` | `Clipboard read needs HTTPS + permission — try Cmd/Ctrl+V instead.` |
| Clipboard has nothing usable (Toolbar path only) | `toast.message` | `Clipboard has no image or image URL` |
| Paste event with no usable content | (no toast) | Silent — paste events fire frequently; spurious toasts are noise. |

---

## 6. Pitfalls + Edge Cases

| # | Pitfall | Mitigation |
|---|---|---|
| P-01 | `navigator.clipboard.read` unavailable (insecure context / older browsers) | Feature-detect; fall back to `readText`; if both missing, error toast pointing user at Cmd/Ctrl+V. |
| P-02 | `navigator.clipboard.read` rejects with NotAllowedError (permission denied) | Catch; fall through to `readText` path. |
| P-03 | `ClipboardEvent.clipboardData` is null on some Safari edge cases | `e.clipboardData?.items` optional-chain check at the top of `processClipboardEvent`. |
| P-04 | Shadow DOM components in tree (would break `e.target.tagName` check) | None in this codebase. Keep D-11 simple. |
| P-05 | `fetch` failure mode varies (`TypeError` for CORS, `AbortError` for cancel, etc.) | One `catch` block — any throw means CORS or network; one toast. |
| P-06 | `blob.type` empty for servers that don't set Content-Type on the response body | Fall back to the response's Content-Type header (already split at `;` and trimmed). |
| P-07 | `fetch` with redirect to a tainted origin | `mode: 'cors'` enforces; redirects beyond ACAO scope fail same as direct fetch — same toast. |
| P-08 | `decodeURIComponent` throws `URIError` on malformed percent-encoding | try/catch around every `decodeURIComponent` call. |
| P-09 | Multi-image paste (multiple ClipboardItems / multiple `e.clipboardData.items`) | Take the first image only — matches Watch folder precedent (snapshot ingest); multi-image left for follow-up (CONTEXT deferred §). |
| P-10 | `useEffect` cleanup omitted → listener leaks on hot reload | Cleanup function in `useClipboardIngest` removes the listener. |
| P-11 | `getAsString` callback invoked synchronously vs asynchronously varies by browser | Wrap in `await new Promise<string>(r => item.getAsString(r))` — Chrome calls synchronously, Firefox asynchronously; await handles both. |
| P-12 | `Cmd+V` inside the FilesPane filter input fires document `paste` after the input's own | D-11 early-return prevents double-handle. Confirmed by VALIDATION.md manual test row. |
| P-13 | `pickFromClipboard` returns a Promise but the Toolbar caller doesn't await | `void pickFromClipboard(...)` in the onClick — fire-and-forget with toast feedback matches `useExport.exportOne` precedent. |
| P-14 | Codec gate (`useIngest.isAccepted`) rejects the file silently | Existing format gate already silent-drops unsupported (Phase 10 D-06/D-07). Ingest success toast will lie if the gate drops the file. Mitigation: keep the existing pattern — the Files pane shows the file appearing or not. (Same risk as Watch folder path; accepted.) |
| P-15 | iOS Safari has limited paste event support | Mobile is best-effort, not a v1.2 requirement. Don't gate on it. |
| P-16 | The `useIngest.ingest()` auto-optimize trigger fires on every clipboard add | Same behavior as device picker + watch folder — accepted. |

---

## 7. No-New-Deps Confirmation

All APIs are built-in browser primitives:

| API | MDN status |
|---|---|
| `document.addEventListener('paste', …)` | Stable everywhere |
| `ClipboardEvent.clipboardData.items` | Stable everywhere except iOS Safari edge cases |
| `DataTransferItem.getAsFile()` / `getAsString()` | Stable everywhere |
| `navigator.clipboard.read()` | Chrome 76+, Safari 13.1+, Firefox 127+ |
| `navigator.clipboard.readText()` | Same |
| `fetch(url, { mode: 'cors', credentials: 'omit' })` | Stable everywhere |
| `URL` constructor | Stable everywhere |
| `File` constructor | Stable everywhere |
| `Blob` / `Response.blob()` | Stable everywhere |

No npm additions. `package.json` is not modified.

---

## 8. Bundle Impact

| File | Estimated initial gzip |
|---|---|
| `src/lib/url-ingest.ts` | ~0.5 KB |
| `src/lib/clipboard-ingest.ts` | ~0.7 KB |
| `src/hooks/useClipboardIngest.ts` | ~0.2 KB |
| Toolbar wire-up delta | ~0.1 KB |
| **Total Phase 15 addition** | **~1.5 KB** |

Pre-phase budget: 197.97 KB (post Phase 14, per CONTEXT). Headroom to 200 KB ceiling: 2.03 KB. **Phase 15 fits within budget.** Bundle-budget test (`npm run test:bundle`) will catch any regression.

---

## 9. Validation Architecture

Per VALIDATION.md, four tasks across two waves. This section maps each task to test design.

### Task 15-01-url-ingest (Wave 1, requirement ING-01)

- **Test type:** Node unit + Playwright e2e.
- **Unit test (`src/tests/url-ingest.test.ts`):** stub global `fetch`; assert:
  - Returns `File` on 2xx + `image/png` content-type.
  - Returns `null` on `fetch` throw (CORS sim) — confirms no rethrow.
  - Returns `null` on non-2xx, non-image MIME, oversized (mock `content-length`).
  - Filename derivation: 6 cases from §4 table.
  - `sanitizeBaseName` applied (path-traversal URL → safe name).
- **e2e (`src/tests/url-ingest.spec.ts`):** intercept `fetch` via `page.route('https://cors-test.example/*', …)` to return a tiny PNG; trigger via `page.evaluate(() => import('/src/lib/url-ingest').then(m => m.pickFromUrl(url)))`. Assert the file lands in `filesAtom.entries`.
- **Mocks needed:** `fetch` stub helper. Reuse Phase 11's `tests/setup/fetch-mocks.ts` if it exists; otherwise inline.
- **Feedback latency:** ~2s unit, ~15s e2e.

### Task 15-02-clipboard-ingest (Wave 1, requirement ING-01)

- **Test type:** Node unit.
- **Unit test (`src/tests/clipboard-ingest.test.ts`):**
  - Mock `navigator.clipboard.read` to return `[{ types: ['image/png'], getType: () => blob }]` → assert `ingest` called with one `File`.
  - Mock `navigator.clipboard.read` to throw, `readText` to return an image URL → assert routing into `pickFromUrl`.
  - Mock both unavailable → assert toast error fired.
  - `IMAGE_URL_RE` regex unit coverage (positive + negative cases).
  - `processClipboardEvent`: synthetic `ClipboardEvent` with `clipboardData.items` carrying a `File` → assert dispatch + `preventDefault`-ready return value `true`.
  - `processClipboardEvent`: with only `text/plain` non-URL text → assert returns `false`, no dispatch.
- **Mocks needed:** `navigator.clipboard` shim — add to `tests/setup/clipboard-mocks.ts` (Phase 12 chokepoint write-direction mocks already there; add read-direction siblings in Wave 0 of this phase).
- **Feedback latency:** ~2s.

### Task 15-03-paste-hook (Wave 2, requirement ING-02)

- **Test type:** Playwright e2e.
- **e2e (`src/tests/paste-ingest.spec.ts`):**
  - Programmatic paste injection via `page.evaluate` dispatching a `ClipboardEvent('paste')` with a synthetic `DataTransfer` carrying an image File.
  - Assert: file appears in `filesAtom.entries` AND `toast.success` text "Pasted from clipboard" is visible (via `page.getByText(...)`).
  - Click into the filter input first, dispatch the same paste event with target=input → assert NO file lands (D-11 guard).
  - Dispatch paste with a `text/plain` image URL → assert URL flow fires (intercept fetch as in 15-01).
- **Mocks needed:** Playwright `page.route` for the URL flow path. ClipboardEvent dispatch helper.
- **Feedback latency:** ~20s.

### Task 15-04-toolbar-wire (Wave 2, requirement ING-01)

- **Test type:** Playwright e2e.
- **e2e (`src/tests/toolbar-paste.spec.ts`):**
  - Stub `navigator.clipboard.read` via `page.addInitScript` to return a tiny image blob.
  - Click Toolbar `Add files ▾` → click `From URL or paste`.
  - Assert: file appears in `filesAtom.entries`, success toast visible, popover closed (`Popover` content not in DOM).
  - Negative: stub `navigator.clipboard.read` to throw NotAllowedError + `readText` to return empty string → assert toast "Clipboard has no image or image URL".
  - **Source-level grep:** assert `addFromUrl` no longer exists in `src/stores/files.ts` and is not imported in `src/components/shell/Toolbar.tsx`. (Static check in the spec file via fs.read or a separate Node unit.)
- **Mocks needed:** `navigator.clipboard.read` / `readText` shim injected via `page.addInitScript`.
- **Feedback latency:** ~15s.

### Wave 0 (mock setup)

If `tests/setup/clipboard-mocks.ts` doesn't have read-direction helpers, add them as a Wave 0 task OR fold into task 15-02 setup. Recommend: fold into 15-02 (smaller scope; the only consumer is 15-02 + 15-04).

### Sampling continuity

- 15-01 Unit (~2s) → 15-02 Unit (~2s) → 15-03 e2e (~20s) → 15-04 e2e (~15s).
- No 3 consecutive tasks without an automated verify. Max latency ~20s. Meets VALIDATION.md sampling rate.

### Manual-only checks (from VALIDATION.md)

Already enumerated in VALIDATION.md §Manual-Only Verifications:
1. Real CORS-blocked URL (third-party server variance).
2. Safari paste behavior (ClipboardEvent variance from Chrome).
3. Cmd/Ctrl+V inside FilesPane filter input regression check.

No new manual checks added by this research.

---

## 10. Threat Model Carry-Forward (T-15-01..T-15-04)

| Threat | Status |
|---|---|
| T-15-01 (LOW): `pickFromUrl` fetches arbitrary URLs — exfiltration / SSRF analog | No change. Browser is the user agent; equivalent to address-bar paste. `credentials: 'omit'` reduces accidental cookie leak. |
| T-15-02 (LOW): malicious SVG in clipboard | useIngest pipeline already runs SVG through DOMPurify (Phase 3 carry-forward). No new attack surface. |
| T-15-03 (LOW): paste event handler runs on every paste outside text inputs | Single string-comparison early-return is negligible. Confirmed P-12 also benign. |
| T-15-04 (LOW): URL filename with path-traversal | `sanitizeBaseName` applied (T-11-01 chokepoint reused). Verified at every filename source in §4. |

---

## 11. Open Questions for Planner

1. **Wave 0 — add read-direction mocks to `tests/setup/clipboard-mocks.ts` as its own task, OR fold into 15-02?** Recommend fold into 15-02 (lower overhead, single consumer chain).
2. **`pickFromClipboard` dispatcher interface — `ClipboardDispatcher` (current `{ ingest }`) vs raw `(files: File[]) => Promise<void>`?** Recommend the typed interface — leaves room for future dispatcher fields (e.g. a `toastPrefix` for context).
3. **Should the URL fetch path also feature-detect `AbortController` for a timeout?** Recommend no — browsers already time fetches out around the OS network stack. Adding our own controller is overkill for v1.2; defer to a follow-up if real users hit hangs.

---

## 12. Sources

- CONTEXT.md (locked decisions D-01..D-15)
- `.planning/research/v1.2-ingest.md` (milestone research — TL;DR, API choice, CORS reality, bundle budget)
- `src/hooks/useIngest.ts` (single seam + exported `isAccepted`)
- `src/hooks/useWatchFolder.ts` (analog hook shape — Quick 260603-s2x)
- `src/lib/filename.ts:54` (`sanitizeBaseName` chokepoint, T-11-01)
- `src/hooks/useExport.ts` (sonner `toast.success` / `toast.error` precedent)
- MDN: ClipboardEvent, Clipboard API, Fetch CORS modes (HIGH confidence)

---

## RESEARCH COMPLETE
