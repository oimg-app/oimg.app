---
phase: 15
plan: 02
subsystem: ingest
tags: [clipboard, paste, ingest, url, sonner]
dependency-graph:
  requires:
    - 15-01-SUMMARY (pickFromUrl, src/lib/url-ingest.ts)
  provides:
    - "src/lib/clipboard-ingest.ts: pickFromClipboard, processClipboardEvent, ClipboardDispatcher, IMAGE_URL_RE"
  affects: []
tech-stack:
  added: []
  patterns:
    - "ClipboardDispatcher interface (lib stays React-free; hooks own the sink)"
    - "Alias-loader sonner stub (mirrors url-ingest.test.ts)"
key-files:
  created:
    - src/lib/clipboard-ingest.ts
    - src/tests/clipboard-ingest.test.ts
  modified: []
decisions:
  - "Clipboard-mocks live inline in the unit test, not in tests/setup/clipboard-mocks.ts — no existing analog directory; avoid creating a new tree for 4 small helper factories."
  - "processClipboardEvent returns false silently on unrelated paste — toast spam in form inputs would be noise (CONTEXT D-03)."
metrics:
  duration: ~25 min
  completed: 2026-06-12
---

# Phase 15 Plan 02: Clipboard Ingest Dispatcher Summary

Shared lib seam (`src/lib/clipboard-ingest.ts`) that resolves clipboard content
— image bytes OR image URLs — into File[] and hands them to a caller-provided
`ClipboardDispatcher.ingest()`. Wraps both browser entry points: the
proactive Async Clipboard API (`pickFromClipboard`) and the reactive
`paste`-event walker (`processClipboardEvent`). Reuses the `pickFromUrl`
fetcher shipped in Plan 15-01 so URL branches go through the same security
gates (size cap, MIME sniff, host extraction).

## What Shipped

| Export                  | Purpose                                                 |
|-------------------------|---------------------------------------------------------|
| `pickFromClipboard(d)`  | Reads `navigator.clipboard.read`/`readText`; image bytes win, else text+URL match, else friendly "no image" toast. Capability-gates to an HTTPS hint if the API surface is missing. |
| `processClipboardEvent(e, d)` | Walks `e.clipboardData.items`; image/* files win, else first `text/plain` URL. Returns `boolean` so the caller can `preventDefault()` only on a handled paste. Silent on unrelated text. |
| `ClipboardDispatcher`   | `{ ingest(files: File[]): Promise<void> }` — minimal sink so the lib never imports React or hooks. |
| `IMAGE_URL_RE`          | `/\.(png|jpe?g|webp|avif|gif|svg|heic|heif)(\?.*)?$/i` pinned from CONTEXT D-05 / RESEARCH §2. |

## Commits

| Task | Description                                  | Commit  | Files                                   |
|------|----------------------------------------------|---------|-----------------------------------------|
| 1    | feat(15-02): add clipboard ingest dispatcher | 9bf94ed | src/lib/clipboard-ingest.ts             |
| 2    | test(15-02): cover clipboard ingest dispatcher | 0e5a5b5 | src/tests/clipboard-ingest.test.ts      |

## Verification

```bash
node --experimental-strip-types \
     --import ./src/tests/_alias-loader.mjs \
     src/tests/clipboard-ingest.test.ts
```

→ 16/16 pass: IMAGE_URL_RE coverage, capability gate (no surface, missing
readText), image-bytes branch, read() throws → text fallthrough, text URL
branch, no-URL text, paste-event single image file, multiple image files
(plural toast), paste-event text URL, plain text silent miss, empty event,
null `clipboardData`, P-11 "only first text/plain is inspected".

Project-wide `npx tsc -b` shows no new errors (`grep clipboard-ingest` →
empty); baseline 36 errors are pre-existing debt per CLAUDE.md.

## Decision Tree Faithfulness (CONTEXT D-03, D-05 + RESEARCH §1.2, §5)

- **Capability gate:** missing `clipboard.read` OR `clipboard.readText` → single
  `toast.error("Clipboard read needs HTTPS + permission — try Cmd/Ctrl+V instead.")`.
- **read() throws:** swallowed silently; the `readText()` branch is the natural retry
  (matches RESEARCH P-09 fallthrough discipline).
- **No usable text:** `toast.message("Clipboard has no image or image URL")` — `.message`
  level, not `.error`, because the user did nothing wrong.
- **Paste event w/ URL match but `pickFromUrl` fails:** returns `true` so the caller still
  preventDefaults the paste (clear intent), but does NOT add a second toast —
  `pickFromUrl` already surfaced the failure reason.
- **getAsString gotcha (P-11):** promisified via `new Promise(resolve =>
  item.getAsString(resolve))`. The loop `break`s after inspecting the first
  `text/plain`, so multiple text items in the same paste cannot leak through.

## Deviations from Plan

### Plan-allowed deferral

- **`tests/setup/clipboard-mocks.ts` not created.** The plan frontmatter suggested this
  location, but no `tests/setup/` directory exists and there is no Phase 12 write-direction
  analog to extend. The critical-constraints block of the execution prompt explicitly
  allowed inlining the read-direction mocks into the unit test instead. The four small
  factory helpers (`fakeClipboardItem`, `fakeStringItem`, `fakeFileItem`,
  `fakeClipboardEvent`, `setAsyncClipboard`, `setFetchStub`) live at the top of
  `src/tests/clipboard-ingest.test.ts`. If a future plan ships a write-direction analog,
  this read-direction code can be hoisted then.

### Auto-fixed Issues

None — execution followed RESEARCH §1.2 line by line.

## Threat Flags

Plan-15 threat model already lists `clipboard.read` + `paste` event surfaces; no new
surface was introduced. The HTTPS gate is enforced before the `read()`/`readText()` call,
so the dispatcher cannot leak permission-prompt errors into the UI. URL traffic continues
to flow through `pickFromUrl` (15-01), which carries the size cap + MIME sniff mitigations.

## Bundle Budget

Library is ~3.6 KB raw / ~0.7 KB gzip estimated (sonner is already in the bundle, no new
deps). Inside the 200 KB initial gzip ceiling.

## Known Stubs

None.

## Self-Check: PASSED

- `src/lib/clipboard-ingest.ts` — FOUND (149 lines, exports IMAGE_URL_RE,
  ClipboardDispatcher, pickFromClipboard, processClipboardEvent).
- `src/tests/clipboard-ingest.test.ts` — FOUND (passes 16/16 cases).
- Commit `9bf94ed` — FOUND in `git log`.
- Commit `0e5a5b5` — FOUND in `git log`.
- No changes to STATE.md, ROADMAP.md, REQUIREMENTS.md.
- No new entries in package.json dependencies / devDependencies.
