---
phase: 15
plan: 05
subsystem: ingest
tags: [gap-closure, G-15-01, G-15-02, toolbar, clipboard, permission-probe, two-tier-url, toast-ordering, bundle-gate]
gap_closure: true
dependency-graph:
  requires:
    - 15-01-SUMMARY (src/lib/url-ingest.ts — pickFromUrl(File|null) contract; Content-Type validation)
    - 15-02-SUMMARY (src/lib/clipboard-ingest.ts — original pickFromClipboard + processClipboardEvent)
    - 15-03-SUMMARY (src/hooks/useClipboardIngest.ts — consumer of processClipboardEvent boolean)
    - 15-04-SUMMARY (src/components/shell/Toolbar.tsx — Toolbar onClick wire-up)
  provides:
    - "src/lib/clipboard-ingest.ts :: isHttpUrl(text) — two-tier URL gate (replaces IMAGE_URL_RE)"
    - "src/lib/clipboard-ingest.ts :: pickFromClipboard with clipboard-read permission probe + denied recovery toast"
    - "src/lib/clipboard-ingest.ts :: toast.success/error/message BEFORE dispatcher.ingest (4 call sites)"
    - "src/components/shell/Toolbar.tsx :: setOpen(null) → requestAnimationFrame → dispatcher (Popover-unmount race fix)"
  affects:
    - src/tests/clipboard-ingest.test.ts (25 cases — was 16; +ordering + permission probe + isHttpUrl)
    - src/tests/toolbar-paste.spec.ts (+ real-permission happy path + permission-denied recovery)
    - src/tests/paste-ingest.spec.ts (+ URL-without-extension via page.route)
tech-stack:
  added: []
  patterns:
    - "Promise-with-no-await + .catch(() => {}) — fire-and-forget dispatcher.ingest so toast fires on accept, downstream errors surface via setFileError (Phase 9 D-13)"
    - "navigator.permissions?.query?.({ name: 'clipboard-read' as PermissionName }) feature-detect — Safari rejects unknown name, swallow into capability-gate fallthrough"
    - "requestAnimationFrame defer between React state-flush and fire-and-forget async — sidesteps Popover-unmount commit boundary that was dropping sonner renders"
    - "Two-tier URL gate: new URL(text) protocol check (cheap, sync) + pickFromUrl Content-Type validation (authoritative, async, with credentials: 'omit')"
key-files:
  modified:
    - src/lib/clipboard-ingest.ts
    - src/components/shell/Toolbar.tsx
    - src/tests/clipboard-ingest.test.ts
    - src/tests/toolbar-paste.spec.ts
    - src/tests/paste-ingest.spec.ts
gaps_closed:
  - id: G-15-01
    surface: Tests 2, 3, 4 (Toolbar) + Test 3 Cmd/Ctrl+V URL path
    closures:
      - "(a) Toolbar onClick reorder: setOpen(null) runs synchronously, requestAnimationFrame defers pickFromClipboard until after the Popover unmount commit settles"
      - "(b) Two-tier URL gate: dropped IMAGE_URL_RE; isHttpUrl(text) now accepts any http(s) URL — https://picsum.photos/200/300 flows through pickFromUrl which validates Content-Type post-fetch"
      - "Permission probe: navigator.permissions.query({ name: 'clipboard-read' }) — on 'denied' state, surface 'Clipboard read is blocked for this site — enable it in the address-bar lock icon, or use Cmd/Ctrl+V to paste.' + return early (no read attempt)"
  - id: G-15-02
    surface: Test 6 (Cmd/Ctrl+V image bytes — feedback was AFTER worker pool completed)
    closures:
      - "All 4 call sites (pickFromClipboard image + URL, processClipboardEvent image + URL) reordered: toast.success(...) BEFORE void dispatcher.ingest(...).catch(() => {})"
      - "Downstream optimize errors still surface via setFileError + the Phase 9 D-13 toast pipeline; no error swallowing in production paths"
decisions:
  - "Drop the export of IMAGE_URL_RE entirely — replaced by isHttpUrl(text). Export isHttpUrl for unit-test coverage; downstream consumers (useClipboardIngest, Toolbar) never imported the regex so no consumer changes needed"
  - "Permission probe sits BEFORE the existing capability gate so denied users see an actionable hint instead of triggering the implicit Chrome prompt path (which they've already denied)"
  - "Fire-and-forget dispatcher: void dispatcher.ingest(...).catch(() => {}). The .catch is intentional — silences unhandled-rejection logs without swallowing user-visible errors (useIngest already routes failures through setFileError)"
  - "requestAnimationFrame chosen over queueMicrotask: rAF runs AFTER the browser layout flush, which guarantees the Popover unmount has fully committed. Microtask would run BEFORE the Popover unmount, reproducing the original race"
  - "Bare-host strings (consent.cookiebot.com) intentionally remain silent on Cmd/Ctrl+V — new URL('consent.cookiebot.com') throws, isHttpUrl returns false, processClipboardEvent returns false silently (CONTEXT D-12 silent-on-unrelated-paste preserved)"
metrics:
  duration: ~14 min subagent + ~3 min orchestrator close-out
  completed_date: 2026-06-17
  tasks_total: 7
  tasks_completed: 7
  files_modified: 5
  unit_tests_before: 16
  unit_tests_after: 25
  e2e_tests_added: 3
  initial_route_gzip_kb: 194.9
  bundle_budget_kb: 200.0
verification:
  unit: "node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/clipboard-ingest.test.ts — 25/25 pass"
  unit_url_ingest: "node --experimental-strip-types --import ./src/tests/_alias-loader.mjs src/tests/url-ingest.test.ts — 19/19 pass (no regression)"
  e2e: "npx playwright test src/tests/url-ingest.spec.ts src/tests/paste-ingest.spec.ts src/tests/toolbar-paste.spec.ts — 11 cases pass including the 3 new G-15-01/G-15-01(b) regressions"
  bundle: "npm run test:bundle — PASS: 194.9 KB < 200 KB"
follow_up:
  - "Manual re-verification (3 carry-forward checks from VALIDATION.md) — re-run via /gsd:verify-work 15 to flip the human_needed status to passed"
  - "Tests 5 (Toolbar plain text), 7 (filter-input guard), 8 (Safari) were skipped during the gap-finding UAT — re-verify post-merge"
deviations:
  - "Subagent socket dropped after the final test run but before writing SUMMARY.md (same pattern as Phase 14-04, 15-01, 15-03). Orchestrator wrote this SUMMARY inline from the committed task-by-task evidence (commits 0f0ae34..f21b5ae) — all task acceptance criteria verified via grep and test runs prior to writing."
---

# Plan 15-05 — Gap closure summary

## Outcome

Both UAT gaps closed. Six task commits landed (`0f0ae34..f21b5ae`); the orchestrator wrote this SUMMARY after the executor's socket dropped. All success criteria verified post-hoc via grep + test runs:

- `src/lib/clipboard-ingest.ts`: 4 × `void dispatcher.ingest(...).catch(() => {})`, 0 × `await dispatcher.ingest`, 0 × `IMAGE_URL_RE`, 1 × `Clipboard read is blocked` toast.
- `src/components/shell/Toolbar.tsx`: 1 × `requestAnimationFrame(() => void pickFromClipboard({ ingest }))`.
- Unit tests: 25/25 pass (was 16).
- e2e: 11 cases pass across `url-ingest.spec.ts`, `paste-ingest.spec.ts`, `toolbar-paste.spec.ts`.
- Bundle: 194.9 KB / 200 KB (unchanged from post-Phase-15 baseline).

## Task-by-task

| # | Task | Commit | Result |
|---|------|--------|--------|
| 1 | Toolbar onClick reorder (G-15-01a) | `0f0ae34` | setOpen → rAF → dispatcher |
| 2 | Toast-before-await (G-15-02) | `5be8d71` | 4 call sites flipped |
| 3 | Two-tier URL gate (G-15-01b) | `e6ea180` | IMAGE_URL_RE → isHttpUrl |
| 4 | Permission probe (G-15-01) | `7eba4f3` | denied → recovery toast |
| 5 | Unit-test contract update | `555d098` | 16 → 25 cases |
| 6 | Playwright regressions | `f21b5ae` | 3 new e2e cases |
| 7 | Bundle gate + Phase 15 re-run | (verification) | 194.9 KB; all tests green |

## Production code shape (after)

**`src/lib/clipboard-ingest.ts`** call-site shape (×4):
```ts
toast.success(<msg>)
void dispatcher.ingest(<files>).catch(() => {})
return <retval?>
```

**`src/lib/clipboard-ingest.ts`** URL gate (×2 call sites):
```ts
function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}
```

**`src/lib/clipboard-ingest.ts`** permission probe (top of `pickFromClipboard`):
```ts
try {
  const perm = await navigator.permissions?.query?.({ name: 'clipboard-read' as PermissionName })
  if (perm && perm.state === 'denied') {
    toast.error('Clipboard read is blocked for this site — enable it in the address-bar lock icon, or use Cmd/Ctrl+V to paste.')
    return
  }
} catch { /* Safari unknown-permission rejection — fall through */ }
```

**`src/components/shell/Toolbar.tsx`** onClick:
```tsx
onClick={() => {
  setOpen(null)
  requestAnimationFrame(() => void pickFromClipboard({ ingest }))
}}
```

## What re-verification should observe

Running `/gsd:verify-work 15` again on a real browser should now flip:
- Test 2 (Toolbar image bytes) → success toast appears within ~50ms on click.
- Test 3 (Toolbar URL + Cmd/Ctrl+V URL) → URLs without `.jpg`/`.png` extension flow through; toast surfaces immediately on accept.
- Test 4 (Toolbar CORS-blocked URL) → "URL blocked by CORS" toast surfaces.
- Test 6 (Cmd/Ctrl+V image bytes) → toast within ~50ms (not after optimize completes).
- New surface: clipboard-read permission denied → "Clipboard read is blocked for this site — enable it in the address-bar lock icon, or use Cmd/Ctrl+V to paste."

Skipped manual checks (Tests 5, 7, 8) — re-run after merge to flip `15-VERIFICATION.md` from `human_needed` → `passed`.
