# Phase 9: Codec Encoders - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 9-Codec Encoders
**Areas discussed:** Output format model, Live re-encode behavior, SVG engine location, Resize & metadata scope

---

## Output format model

| Option | Description | Selected |
|--------|-------------|----------|
| Global, convert-any | One format for the whole batch; any source re-encodes to it | |
| Per-file format override | Each file can target its own format | ✓ |
| Optimize-in-place only | Keep each file's original format, just shrink | |

**User's choice:** Per-file format override.
**Follow-up — per-file scope:** Full per-file settings (format + quality/effort/lossless/resize), global panel = default for new files + "Apply to all" bulk action. (Rejected: only-format-per-file.)
**Notes:** Squoosh-per-image model. Format is a real conversion (decode → re-encode to target).

---

## Live re-encode behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit "Optimize all" run | Encode on button click; settings mark files stale | |
| Hybrid: live selected file, explicit batch | Live for inspected file, explicit for batch | |
| Fully live (Squoosh-style) | Every change re-encodes its file | ✓ (then scoped) |

**User's choice:** Fully live — then scoped via follow-up.
**Follow-up — live scope:** Live for the **edited/inspected file** (debounced); the **global panel re-encodes the batch only on "Apply to all."** (Rejected: live re-encode of the entire batch on every global change.)
**Notes:** Live delta shown via existing CompareStage/DeltaStrip. decode-once caching suggested for perf (Claude's discretion).

---

## SVG engine location

| Option | Description | Selected |
|--------|-------------|----------|
| Worker + curated toggles | svgo in worker, SvgoPanel curated plugins over preset-default | ✓ |
| Main thread + curated toggles | svgo on main thread (already bundled), jank risk | |
| Worker + full preset-default | Worker, expose all preset-default plugins | |

**User's choice:** Worker + curated toggles.
**Notes:** Resolves the Phase 8 deferred question. svgo lazy-loads into the worker chunk like raster codecs.

---

## Resize & metadata scope

| Option | Description | Selected |
|--------|-------------|----------|
| Wire single resize + strip ON | Wire resizeOn/w/h/alg/fit; strip-metadata default on | ✓ |
| Defer resize, metadata only | Don't wire resize this phase | |
| Wire resize + strip OFF | Wire resize, default to preserving metadata | |

**User's choice:** Wire single-image resize + strip-metadata default ON, keepIcc opt-in.
**Notes:** Density variants (1×/2×/3×) stay deferred to a future milestone per PROJECT.md.

---

## Encode failure / unsupported handling

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file error state + toast | Error badge + sonner toast, keep original bytes fallback, batch continues | ✓ |
| Toast only | Toast on failure, file unmarked | |
| Silent fallback to original | Keep original silently, no indicator | |

**User's choice:** Per-file error state + toast, original bytes kept as fallback.
**Notes:** Covers AVIF-on-old-Safari and general encode errors. Batch continues on per-file failure.

---

## Claude's Discretion

- Physical home of per-file settings (extend filesAtom vs separate per-file settings map).
- Debounce interval for live re-encode (~250–350ms).
- decode-once caching across re-encodes.
- Exact per-codec jSquash encoder option mapping.

## Deferred Ideas

- 1×/2×/3× density variants (`@jsquash/resize` multi-scale) — future milestone.
- Batch ZIP export (jszip) — separate phase.
- Output snippets wired to real encoded bytes (SNIP-01) — separate requirement.
- Fully-live batch re-encode on global changes — rejected in favor of per-file-live + apply-to-all.
