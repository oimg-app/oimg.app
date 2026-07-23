# Phase 15: From URL or paste - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Source:** v1.2 REQUIREMENTS.md + .planning/research/v1.2-ingest.md + codebase scout (scope locked at milestone level; no separate discuss-phase needed)

<domain>
## Phase Boundary

Phase 15 wires the existing `addFromUrl` empty stub (`src/stores/files.ts:100`) to two real ingest channels, both flowing through the existing `useIngest.ingest()` seam (Phase 10 D-01 single-pipeline rule):

1. **Toolbar "From URL or paste"** (ING-01) — clicking the menu item reads the clipboard. If the clipboard holds image bytes → ingest. If it holds a plain-text image URL → fetch + ingest (with honest CORS-failure messaging). Anything else → a clear "no image" toast.
2. **Document-level Cmd/Ctrl+V** (ING-02) — pasting an image anywhere in the app (outside text inputs) ingests it through the same dispatcher.

The Watch folder quick task (260603-s2x) and the "From device" picker established the pattern: each ingest channel lives in a dedicated hook + lib dispatcher, routes through `useIngest.ingest()`, retires its empty stub. Phase 15 follows that pattern verbatim.

CORS is a HARD physical constraint here. Per v1.2-ingest.md TL;DR: there is **no real bypass** for byte access from a browser without a server. We try direct `fetch(url)`; on failure we surface a clear toast pointing users at drop-and-drop. We do NOT ship a `<img crossorigin> + canvas.toBlob()` fallback (research-rejected: silent re-encoding, format loss, tainted-canvas silent failure).

Requirements: **ING-01** (Toolbar "From URL or paste"), **ING-02** (document-level Cmd/Ctrl+V).

</domain>

<decisions>
## Implementation Decisions

### Clipboard API choice (ING-01, ING-02)
- **D-01:** Use the **document-level `paste` event** (`document.addEventListener('paste', e => e.clipboardData.items)`), NOT `navigator.clipboard.read()`. Research-confirmed: paste-event works in non-secure contexts, requires no permission prompt, exposes image MIME items via `DataTransferItem.getAsFile()`. The `navigator.clipboard.read()` permission UX is overkill for this use case.
- **D-02:** The Toolbar "From URL or paste" menu item triggers a programmatic clipboard read via a synthetic flow — it can't dispatch a paste event from JS (security model). Instead, the menu item uses `navigator.clipboard.read()` IF available (secure context + permission) AND falls back to `navigator.clipboard.readText()` for URL-only clipboard contents. If both are missing/denied, toast "Clipboard read needs HTTPS + permission — try Cmd/Ctrl+V instead." This is the ONLY place we use `navigator.clipboard` — the document paste handler is the primary surface.

### Toolbar "From URL or paste" flow (ING-01)
- **D-03:** Click handler dispatcher (`pickFromClipboard`) walks the clipboard contents in this order:
  1. Image bytes (`ClipboardItem` with MIME `image/*`) → convert to `File` → ingest via `useIngest.ingest([file])`. Toast: `"Pasted from clipboard: ${file.name || 'pasted-image.<ext>'}"`.
  2. Plain text (`text/plain`) — if it parses as an image URL → route to `pickFromUrl(url)`. Toast on success: `"Imported from URL: ${new URL(url).host}"`.
  3. Anything else (text that isn't a URL, no items, files-list with non-image MIMEs) → toast `"Clipboard has no image or image URL"`.
- **D-04:** Image URL detection uses **extension-based classification** ONLY in the first pass: a regex on `/\.(png|jpe?g|webp|avif|gif|svg|heic)(\?.*)?$/i`. Content-Type probing via HEAD request is NOT in scope — many image servers ignore HEAD or return wrong MIME, and the fetch path will reject non-image bytes downstream anyway.
- **D-05:** If multiple ClipboardItems present and one is an image, the image wins (skip text). This matches OS-clipboard "paste image" expectations.

### URL fetch dispatcher (ING-01)
- **D-06:** `pickFromUrl(url)` is a new lib at `src/lib/url-ingest.ts`. Try `fetch(url)` with the default `mode: 'cors'`. On success: read `response.blob()`, validate `blob.type.startsWith('image/')` (server may have lied via extension), wrap into a `File` via `new File([blob], filename, {type: blob.type})` where `filename` is derived from the URL's last path segment (decoded). Pass to `useIngest.ingest([file])`.
- **D-07:** On fetch failure (network error OR CORS rejection OR non-image MIME OR opaque response) → toast `"URL blocked by CORS — download and drop the file, or paste it directly."` Do NOT throw to caller; do NOT log to console (zero-telemetry constraint). Return `null` so the dispatcher can no-op gracefully.
- **D-08:** **NO `<img crossorigin>` + canvas fallback** (research-rejected per D-domain). Honest user messaging > silent re-encoding.
- **D-09:** **Filename derivation** from URL: decode percent-encoded path segment, strip query string, fall back to `pasted-image-<timestamp>.<ext>` if no path segment or empty name. Reuse Phase 11's `sanitizeBaseName` from `src/lib/filename.ts` (T-11-01 zip-slip mitigation) so URL-derived names can't break the ZIP export later.

### Document-level paste handler (ING-02)
- **D-10:** New hook `src/hooks/useClipboardIngest.ts` mounts a document-level `paste` event listener on app boot. Pattern mirrors `useWatchFolder` (Quick task 260603-s2x analog).
- **D-11:** **Inputs-elements guard**: if `e.target` is inside an `<input>`, `<textarea>`, or `[contenteditable]`, the handler returns early — the browser handles the paste normally. Reuses standard tag check:
  ```
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
  ```
- **D-12:** Outside text inputs, the handler walks `e.clipboardData.items` SAME as D-03 (image first, then URL string). Same dispatcher, same toasts. `e.preventDefault()` is called ONLY when we successfully consume an image OR a URL (so unrelated pastes outside text inputs don't trigger app-level handlers in the future).
- **D-13:** The hook is invoked once at app root (`App.tsx`). The cleanup `removeEventListener` runs on unmount.

### Stub deletion + Toolbar wire-up
- **D-14:** Delete `addFromUrl(): void {}` from `src/stores/files.ts:100` (Phase 11/12/13 + Quick task retirement precedent). Remove the import from `src/components/shell/Toolbar.tsx:22`.
- **D-15:** Toolbar's "From URL or paste" menu item's onClick becomes `() => { void pickFromClipboard(); setOpen(null) }`. The dispatcher itself doesn't return a Promise that callers await — it fires-and-forgets with toast feedback (same pattern as `useExport.exportOne` from Phase 11).

### Threat model
- **T-15-01 (LOW):** `pickFromUrl` fetches arbitrary user-supplied URLs. Risk is exfiltration (the user fetches their own private URL via the app) or SSRF-like behavior. Mitigation: zero-server constraint means there's no server-side fetch; the browser does the fetch with the user's cookies/credentials. This is essentially identical to the user pasting the URL into their browser address bar — no app-level escalation. Document the intent in the lib comment.
- **T-15-02 (LOW):** Clipboard contents may be malicious (an SVG with `<script>`). Mitigation: the existing useIngest pipeline runs SVG through DOMPurify (Phase 3 SVG pipeline) before downstream consumers. No new attack surface from clipboard ingest.
- **T-15-03 (LOW):** `paste` event handler runs on every paste anywhere outside text inputs — perf concern at the cost of one tagName check per event. Mitigation: the early-return path is a single string comparison; negligible cost.
- **T-15-04 (LOW):** URL filename from a malicious URL could contain path-traversal sequences (`../../etc/passwd`). Mitigation: Phase 11 `sanitizeBaseName` applied at D-09. Reused chokepoint.

### Claude's Discretion
- The exact toast wording for each failure mode (we have draft text in D-03/D-07). Match sonner's existing tone (concise, action-oriented).
- Whether the URL-extension regex covers HEIC (`.heic`) — research says yes (we already support HEIC decode from a recent quick task). Keep it.
- Whether the paste-event handler debounces against double-paste (Cmd+V twice in quick succession). Recommend: no — each paste produces independent clipboard contents; the user expects each paste to register.
- The lib organization: `src/lib/url-ingest.ts` (URL fetch + filename derivation) + `src/hooks/useClipboardIngest.ts` (document paste handler) + the Toolbar dispatcher inline OR a third lib `src/lib/clipboard-ingest.ts`. Recommend extracting `pickFromClipboard()` to `src/lib/clipboard-ingest.ts` so both surfaces (Toolbar onClick + document paste) call the same function.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 15 block) — Goal + 5 Success Criteria + ING-01, ING-02 mapping
- `.planning/REQUIREMENTS.md` — ING-01 + ING-02 verbatim text

### Research artifacts
- `.planning/research/v1.2-ingest.md` — paste-event API choice + CORS limitations + filename derivation pattern + the why-no-canvas-fallback rationale

### Project rules + stack
- `./CLAUDE.md` — TS strict, hooks/stores own logic, WCAG-AA, zero-server / zero-telemetry; PIPE-02 200 KB initial JS gzipped budget (197.97 KB after Phase 14 — Phase 15 must NOT push over)
- `.planning/PROJECT.md` — Current Milestone v1.2 + Constraints

### Carry-forward from prior phases / quick tasks
- `.planning/phases/10-single-file-optimize-loop/10-CONTEXT.md` — D-01 single ingest seam (`useIngest.ingest`)
- `.planning/quick/260603-s2x-watch-folder/260603-s2x-PLAN.md` — Watch folder analog: feature-detect lib + hook + Toolbar wire-up + stub retirement
- `.planning/phases/11-batch-optimize-export/11-CONTEXT.md` — T-11-01 sanitizeBaseName (reused for D-09 URL filename safety)

### Codebase intelligence
- `src/stores/files.ts:100` — `addFromUrl(): void {}` empty stub to retire (D-14)
- `src/components/shell/Toolbar.tsx:22, 155, 159` — existing "From URL or paste" menu item already wired to the empty stub; rewire to dispatcher (D-15)
- `src/hooks/useIngest.ts` — `ingest(files: File[])` is the single seam; `isAccepted` was exported during the Watch folder quick task
- `src/lib/filename.ts` — Phase 11 `sanitizeBaseName` (T-11-01) reused at D-09
- `src/App.tsx` — hosts the document-level paste handler hook invocation (D-13)
- `src/lib/clipboard.ts` — Phase 12 chokepoint (NOT used here — clipboard read is the inverse direction; this phase reads, that phase writes)

</canonical_refs>

<specifics>
## Specific Ideas

- **Honest CORS messaging** beats silent re-encoding. The toast in D-07 tells the user exactly what to do.
- **One dispatcher, two surfaces** (D-15 + D-12) — Toolbar onClick and document paste both call `pickFromClipboard()`. Single source of truth for the ingest decision tree.
- **Reuse, don't rebuild** — `sanitizeBaseName` from Phase 11, `useIngest.ingest()` from Phase 10, `isAccepted` exported from Phase 10's useIngest during the Watch folder quick task. Phase 15 adds the clipboard glue, nothing else.
- **No new deps** — every required browser API is built-in. Bundle budget held.

</specifics>

<deferred>
## Deferred Ideas

- **Content-Type HEAD probe before `fetch`** — would reduce wasted bandwidth on non-image URLs but adds latency and double-network on every URL paste. Defer; the existing blob.type check catches non-images post-fetch.
- **OCR-style "drop a screenshot, get text"** — out of scope; this phase is ingest only.
- **Drag-and-drop URL from another tab** — `dataTransfer.getData('text/uri-list')` is the path; defer to a follow-up to keep Phase 15 focused on the documented requirements ING-01 + ING-02.
- **Multi-file paste** — clipboard with multiple images. Possible (`e.clipboardData.items` is plural) but rare in practice; ship with single-image-first behavior, add multi later if dogfood demands.
- **Permission-prompt UX wrapper** — `navigator.clipboard.read()` permission UX is overkill for v1.2; the paste-event path covers all cases without it.
- **Cookie / credential warning toast on URL fetch** — over-engineered for v1.2; the user pasting a URL into the app is the same trust level as pasting it into their browser address bar.
- **History of recently-pasted URLs** — out of zero-telemetry concern.

</deferred>

---

*Phase: 15-from-url-or-paste*
*Context gathered: 2026-06-12*
