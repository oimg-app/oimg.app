---
status: gaps_found
phase: 15-from-url-or-paste
source:
  - 15-01-SUMMARY.md
  - 15-02-SUMMARY.md
  - 15-03-SUMMARY.md
  - 15-04-SUMMARY.md
  - 15-VERIFICATION.md
started: 2026-06-15T10:12:52Z
updated: 2026-06-15T16:10:00Z
---

## Current Test

number: 7
name: Cmd/Ctrl+V inside filter input — does NOT ingest (manual carry-forward #3)
expected: |
  Click into the FilesPane search/filter input (top-right of the queue
  header). Cmd+V (macOS) or Ctrl+V (Windows/Linux) to paste any text. The
  text appears in the filter input (browser default paste behavior); NO
  file ingest happens, no success toast surfaces, and no entry appears in
  the Files pane.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: `npm run dev` starts cleanly; the app loads at http://localhost:5174; the Toolbar's "Add files ▾ → From URL or paste" menu item is visible and clickable; no top-level paste handler error is logged when the page boots.
result: pass

### 2. Toolbar paste — image bytes
expected: Copy an image (a PNG/JPEG screenshot is fine — Cmd+Shift+4 on macOS) to the clipboard. Click `Add files ▾ → From URL or paste`. A new file appears in the Files pane, the success toast "Pasted image imported" surfaces bottom-right, and the popover closes.
result: fail
issue: |
  User report: "nothing happens" — no permission prompt, no toast, no file.
  Diagnosed via Playwright on the running dev server (see Gaps §G-15-01):
  - Toolbar React props.onClick is correctly wired to `pickFromClipboard({ ingest })`.
  - Direct invocation of pickFromClipboard via the same module path renders the toast as expected.
  - Real DOM click invocation: sonner toast.* IS called (toastLog confirms) but the `<li>` never renders.
  - Root cause hypothesis: synchronous `setOpen(null)` unmounts the Radix Popover at the same React commit boundary where the fire-and-forget Promise eventually fires `toast.*`. Race drops the render.
  - Secondary expectation gap: user expected an explicit permission request + active "paste image" UX. Current code relies on the browser's implicit prompt at first `navigator.clipboard.read()`; if the user previously denied for this origin, the call throws and we land on the bland "no image or image URL" fallback with no recovery path.
severity: high

### 3. Toolbar paste — image URL
expected: Copy a working image URL to the clipboard (any public CDN that returns `Access-Control-Allow-Origin: *`, e.g. `https://picsum.photos/200.jpg` or a wikimedia URL). Click `Add files ▾ → From URL or paste`. A file lands in the Files pane and a toast reads "Imported from URL: {host}" with the URL's host.
result: fail
issue: |
  User report: "nothing happens" on BOTH surfaces — Cmd/Ctrl+V paste of a URL AND clicking "From URL or paste". Both ingest channels are silent.
  Two compounding causes (see G-15-01 expanded scope):
    a) Toolbar onClick race (same as Test 2).
    b) Document paste handler: `processClipboardEvent` regex-gates plain-text on `/\.(png|jpe?g|webp|avif|gif|svg|heic|heif)(\?.*)?$/i`. Most real-world image URLs do NOT end in an image extension — e.g. `https://picsum.photos/200/300`, `https://images.unsplash.com/photo-xxx`, Google/CDN URLs with query strings — so the regex misses and the handler `break`s out + returns false silently (RESEARCH §6 P-12: silent by design).
  Net effect: user pastes a URL meant for the app, gets ZERO feedback that it was rejected.
severity: high

### 4. Toolbar paste — CORS-blocked URL (manual carry-forward #1)
expected: Copy a URL that you know is CORS-blocked from the browser (e.g. a Google Images result URL, or any image hosted on a site without ACAO). Click `From URL or paste`. The error toast reads exactly: "URL blocked by CORS — download and drop the file, or paste it directly." Then download that image and drop it onto the app — it ingests fine (recovery path works).
result: fail
issue: Same Toolbar race as G-15-01 — onClick fires, fall-through reaches `toast.error('URL blocked by CORS — …')`, but render is dropped by the Popover unmount race. No CORS toast surfaces.
severity: high

### 5. Toolbar paste — no image / no URL
expected: Copy plain text (e.g. "hello world") to the clipboard. Click `From URL or paste`. A friendly "Clipboard has no image or image URL" message appears (no console error, no scary toast).
result: skipped
note: Same Toolbar code path as Tests 2/3/4 — confirmed via Playwright that `toast.message('Clipboard has no image or image URL')` IS called but the render is dropped by the unmount race (G-15-01). Will re-run after the fix lands.

### 6. Document Cmd/Ctrl+V — image paste
expected: With the app focused but NOT inside any text input, copy an image to the clipboard and press Cmd+V (macOS) or Ctrl+V (Windows/Linux). The image ingests into the Files pane and the success toast "Pasted image imported" surfaces — same behavior as Test 2 via Toolbar.
result: fail
issue: |
  Works (file does ingest), but timing is wrong: toast fires AFTER the worker pool finishes optimizing — not immediately on accept. Root cause:
  ```ts
  await dispatcher.ingest(imageFiles)   // useIngest.ingest awaits runOptimize() — the full optimize pipeline
  toast.success('Pasted image imported')
  ```
  User-visible delay: from instantaneous (~10ms) feedback they expect, to seconds (or longer on large files). Same anti-pattern affects URL branch + the Toolbar pickFromClipboard (T-15-02 surface). Captured as G-15-02.
severity: medium

### 7. Cmd/Ctrl+V inside filter input — does NOT ingest (manual carry-forward #3)
expected: Click into the FilesPane search/filter input. Cmd+V to paste any text. The text appears in the filter input (browser default paste behavior); NO file ingest happens, no success toast surfaces, and no entry appears in the Files pane.
result: skipped
note: Skipped at user request after Tests 2–4 + 6 surfaced the dominant gaps (G-15-01, G-15-02). Input-elements guard is unit-tested in 15-03 e2e Case C — re-verify after fixes land.

### 8. Safari Cmd+V image paste (manual carry-forward #2, optional)
expected: In Safari, copy an image from Preview or a screenshot (Cmd+Shift+4 then immediately Cmd+V). The document paste handler picks it up; the file lands in Files pane with the success toast. (Optional — only run if you have Safari handy.)
result: skipped
note: Skipped at user request — re-verify after G-15-01/G-15-02 fixes land.

## Summary

total: 8
passed: 1
issues: 4
pending: 0
skipped: 3
skipped: 0

## Gaps

### G-15-01 — Both ingest surfaces silently no-op on real-world clipboard contents

**Surfaces from:** Test 2 (Toolbar image bytes), Test 3 (Toolbar URL + Cmd/Ctrl+V URL).
**Severity:** high — the flagship menu item and the document-level paste both produce zero user feedback on real-world inputs.

**Reproduction (Playwright, dev server http://localhost:5174):**
1. Wrap `toast.*` on the SAME sonner module instance the app uses (`/node_modules/.vite/deps/sonner.js?v=def31b4f`).
2. Click `Add files options` → `From URL or paste`.
3. Observe: `toast.message('Clipboard has no image or image URL')` is logged in the wrapper, but the `<section aria-label="Notifications">` stays empty — `notifLi: 0`.
4. Call the same `props.onClick()` synthetically (bypass DOM dispatch) → `notifLi: 1`, toast `Clipboard has no image or image URL` renders correctly.

**Root cause hypothesis:** synchronous `setOpen(null)` in the onClick body unmounts the Radix Popover at the same React commit boundary the fire-and-forget Promise eventually resolves on. The toast register call is dispatched into sonner but the render is dropped.

**Secondary gap — permission UX:** user expected an explicit permission prompt + active "paste image" flow. The current implementation relies on the browser's implicit prompt at first `navigator.clipboard.read()` call. If denied, the call throws, the catch swallows, readText also throws, and the user lands on `"Clipboard has no image or image URL"` with no recovery hint.

**Proposed fix (15-05-PLAN.md candidate):**

1. **Toolbar click ordering** — `src/components/shell/Toolbar.tsx`:
   ```ts
   onClick={() => {
     setOpen(null)
     requestAnimationFrame(() => void pickFromClipboard({ ingest }))
   }}
   ```
   Let the popover unmount commit settle before sonner queues.

2. **Permission probe + recovery toast** — `src/lib/clipboard-ingest.ts`, before `clip.read()`:
   - `navigator.permissions.query({ name: 'clipboard-read' as PermissionName })` (feature-detect — Safari lacks it).
   - On `'denied'`: `"Clipboard read is blocked for this site — enable it in the address-bar lock icon, or use Cmd/Ctrl+V to paste."`

3. **Broaden URL detection on BOTH surfaces** — `src/lib/clipboard-ingest.ts`:
   - Replace the extension-only `IMAGE_URL_RE` gate with a two-tier check: (a) text parses as `new URL(...)` with `http(s):` protocol → treat as a candidate URL, (b) extension OR Content-Type sniff via `pickFromUrl` decides image-ness. Drop the regex-only gate.
   - Effect: `https://picsum.photos/200/300`, `https://images.unsplash.com/photo-xxx`, signed CDN URLs without `.jpg`/`.png` suffix now reach `pickFromUrl`, which already validates `Content-Type` post-fetch.

4. **Surface URL-rejection feedback on document Cmd/Ctrl+V** — `src/lib/clipboard-ingest.ts` `processClipboardEvent`:
   - When the pasted text IS a valid http(s) URL but `pickFromUrl` returns null (CORS / non-image / 4xx), `pickFromUrl` already toasts the reason. Currently the handler returns true so the paste is consumed but the user sees feedback.
   - When the pasted text is NOT a URL at all (e.g. `consent.cookiebot.com` bare host), keep current silent-return-false behavior (CONTEXT P-12).
   - The two-tier check above auto-fixes this: bare hosts fail `new URL` so we keep silent; real URLs that just don't end in `.jpg` now flow through `pickFromUrl` and get a toast.

5. **Regression specs** — `src/tests/toolbar-paste.spec.ts` + `src/tests/paste-ingest.spec.ts`:
   - **Real browser permission**: `context.grantPermissions(['clipboard-read', 'clipboard-write'])`, copy a PNG via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`, click `From URL or paste`, assert success toast renders AND `filesAtom.entries.length === 1`. Existing e2e mocked clipboard at the page-init layer — the unmount race never triggered.
   - **URL without extension**: copy `https://picsum.photos/200/300` (or `page.route` mock the host to return PNG bytes with `Content-Type: image/png`), paste via Cmd+V, assert ingest + "Imported from URL: …" toast.

**Files touched:** `src/components/shell/Toolbar.tsx`, `src/lib/clipboard-ingest.ts`, `src/tests/toolbar-paste.spec.ts`, `src/tests/paste-ingest.spec.ts`.

**Threat refs:** none new — fix sits inside existing T-15-02 surface. The two-tier URL check still passes through `sanitizeBaseName` (T-15-04) and `pickFromUrl` (T-15-01 credentials-omit).

---

### G-15-02 — Pasted-image toast fires AFTER worker pool completes, not on accept

**Surfaces from:** Test 6 (Document Cmd/Ctrl+V image paste — works but feedback is late).
**Severity:** medium — UX bug; users see "no feedback" until optimization completes (seconds for large files).

**Root cause:** Both branches in both functions await `dispatcher.ingest(...)` before calling `toast.success(...)`:

```ts
// processClipboardEvent — image bytes branch
await dispatcher.ingest(imageFiles)   // useIngest.ingest awaits runOptimize() — the full optimize pipeline
toast.success('Pasted image imported')
```

`useIngest.ingest` (`src/hooks/useIngest.ts:130`) ends with `await runOptimize()` which awaits the worker-pool batch — anywhere from ~100ms to multiple seconds depending on file size and codec.

**Affected call sites in `src/lib/clipboard-ingest.ts`:**
- `pickFromClipboard` image-bytes branch — line ~70
- `pickFromClipboard` URL branch — line ~87
- `processClipboardEvent` image-files branch — line ~130
- `processClipboardEvent` URL branch — line ~149

**Proposed fix:** fire `toast.success(...)` BEFORE the `await dispatcher.ingest(...)`. The toast acknowledges *accept*; the optimize result surfaces via the existing file-row status indicators (DeltaStrip shimmer + status badges from Phase 9/10). Pattern:

```ts
toast.success('Pasted image imported')
void dispatcher.ingest(imageFiles)
return true
```

Dropping the `await` is safe: `useIngest.ingest` already routes downstream errors through `setFileError` + the existing toast pipeline (Phase 9 D-13). A try/catch around the orphaned promise is not needed for production behavior, but a `.catch(() => {})` keeps the unhandled-rejection log clean.

**Regression spec:** in `paste-ingest.spec.ts`, after dispatching the synthetic paste event, assert the success toast appears within ~50ms — BEFORE any worker pool activity completes. Use a deliberately slow synthetic encode (e.g. point at a huge fake PNG via the existing mock) and confirm the toast still renders immediately.

**Files touched:** `src/lib/clipboard-ingest.ts`, `src/tests/paste-ingest.spec.ts`, `src/tests/toolbar-paste.spec.ts`.

**Threat refs:** none — pure UX timing fix.
