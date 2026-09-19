---
phase: 14-installable-pwa
plan: 05
subsystem: deployment/edge-headers
tags: [cloudflare-pages, pwa, headers, coop, coep, service-worker, cache-control]
requires: [14-01]
provides: [edge-headers-pwa-04]
affects: [public/_headers]
tech_stack_added: []
patterns: [cloudflare-pages-_headers, append-don-not-replace]
files_created: []
files_modified:
  - public/_headers
decisions:
  - "Used literal 'Cache-Control: no-cache' for /sw.js (PWA-04 verbatim — NOT 'max-age=0, must-revalidate'). PWA-04 requirement is exact-string."
  - "Kept /* COOP/COEP block broad (did NOT exclude /sw.js) so cached responses retain crossOriginIsolated (T-14-COEP mitigation)."
  - "Append-only edit — existing 3 lines preserved verbatim, 6 lines added below."
metrics:
  duration_minutes: 2
  tasks_completed: 1
  tasks_total: 2
  files_touched: 1
  completed_date: 2026-06-11
---

# Phase 14 Plan 05: Cloudflare Pages `_headers` PWA-04 Patch Summary

**One-liner:** Append `/sw.js` literal `Cache-Control: no-cache` and `/manifest.webmanifest` 24h cache rules to `public/_headers` while preserving the existing `/*` COOP/COEP wildcard required for `crossOriginIsolated` / MT codecs.

## What Was Built

Task 1 patched `public/_headers` from 3 lines to 9 lines. The existing `/*` block (COOP `same-origin` + COEP `require-corp`) is byte-for-byte preserved at the top of the file. Two new blocks appended below:

- `/sw.js` → `Cache-Control: no-cache` (literal PWA-04 verbatim string; required so the SW update lifecycle in plan 14-06 / PWA-05 can detect new SW bytes on each navigation).
- `/manifest.webmanifest` → `Cache-Control: public, max-age=86400` (24h cache; manifest is small and changes rarely).

No source code was touched. No build config changed. The edit is a pure edge-header policy change.

## Files Modified

- `public/_headers` — +6 lines appended below preserved COOP/COEP `/*` block.

## Verification

Automated grep (PASS):
```
grep -q "Cross-Origin-Embedder-Policy: require-corp" public/_headers
grep -q "Cross-Origin-Opener-Policy: same-origin" public/_headers
grep -q "/sw.js" public/_headers
grep -q "Cache-Control: no-cache" public/_headers
grep -q "Cache-Control: public, max-age=86400" public/_headers
```

Final file content:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: public, max-age=86400
```

## Commits

| Task | Commit  | Message                                                          |
| ---- | ------- | ---------------------------------------------------------------- |
| 1    | a75bfae | chore(14-05): add /sw.js no-cache + manifest max-age to _headers |

## Pending Checkpoint (Task 2)

Task 2 is `checkpoint:human-verify` with `gate="blocking"`. It cannot be auto-approved because the headers are only verifiable on a Cloudflare Pages preview deploy (local `npm run preview` does not apply `_headers` the same way the edge does). Human must:

1. Push to a preview branch / open a Pages preview deploy.
2. `curl -I <preview-url>/sw.js` → expect `Cache-Control: no-cache`.
3. `curl -I <preview-url>/manifest.webmanifest` → expect `Cache-Control: public, max-age=86400`.
4. `curl -I <preview-url>/` → expect both COOP `same-origin` + COEP `require-corp`.
5. In DevTools on the deployed page: confirm `crossOriginIsolated === true`, then run one OxiPNG MT optimize (proves SharedArrayBuffer / MT codecs still work with SW active).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new surface introduced. T-14-COEP, T-14-HDR, T-14-STALESW from the plan's threat model are addressed by the file content shown above. No threat_flag rows.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `public/_headers` contains all 5 required strings (COOP, COEP, /sw.js, Cache-Control: no-cache, max-age=86400).
- FOUND: commit `a75bfae` exists in `git log`.
- FOUND: `.planning/phases/14-installable-pwa/14-05-SUMMARY.md` created.
