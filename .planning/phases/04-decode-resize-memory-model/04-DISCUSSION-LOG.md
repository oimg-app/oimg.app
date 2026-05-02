# Phase 4: Decode + Resize + Memory Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 04-decode-resize-memory-model
**Areas discussed:** Density UI + 1:N adapter shape, Resize algorithm + exposure, Metadata stripping + ICC policy, Memory cap mechanism

---

## Density UI + 1:N adapter shape

### Q1: Source density picker location

| Option | Description | Selected |
|---|---|---|
| Per-file dropdown in file row | Each row gets `1x\|2x\|3x` selector | ✓ |
| Global default + per-file override | Global default in TweaksPanel; per-file override in row | |
| Filename auto-detect + manual override | Parse `@2x`/`-2x`/`_2x` from filename; per-file override | |
| All three stacked (filename → global → manual) | Stacked precedence | |

**User's choice:** Per-file dropdown in file row.

### Q2: Variant generation policy

| Option | Description | Selected |
|---|---|---|
| Always emit 1x + 2x + 3x | Three outputs regardless of source | |
| Emit only smaller densities (down-scale only) | Asymmetric counts based on source | |
| User picks target densities per file | Per-file checkboxes (source auto-checked + locked) | ✓ |
| Global toggle: 'Generate all 3 densities' on/off | Global advanced toggle, off by default | |

**User's choice:** Per-file checkboxes for target densities; source density auto-checked + locked.

### Q3: Filename suffix convention

| Option | Description | Selected |
|---|---|---|
| `name@1x.ext` / `name@2x.ext` / `name@3x.ext` | Apple-Retina + srcset standard | ✓ |
| `name-1x.ext` / `name-2x.ext` / `name-3x.ext` | Hyphenated form | |
| Only suffix non-1x (`name.ext` baseline) | Asymmetric naming | |
| User picks convention as global setting | Configurable | |

**User's choice:** `name@Nx.ext` for all variants.

### Q4: 1:N adapter contract

| Option | Description | Selected |
|---|---|---|
| Single job returns `output[]` with N blobs | One decode → N resize → N blobs in one postMessage | |
| Fan out as N parallel pool jobs | Each variant is its own job; triple decode cost | ✓ |
| Two-stage: decode job → N resize jobs | Shared ImageData via main-thread cache (rejected — violates D-12) | |
| Single job + internal worker fanout | Identical shape to (1); just clarifies internal fanout | |

**User's choice:** Fan out as N parallel pool jobs.
**Notes:** Reconciled in Area 4 Q4 — each variant becomes its own FileEntry with density-encoded id, so pool stays 1:1 with FileEntries (preserving Phase 2 D-04). Trade-off: ~3× decode cost; planner should benchmark against the 100ms/2MB budget.

---

## Resize algorithm + exposure

### Q1: Default algorithm

| Option | Description | Selected |
|---|---|---|
| lanczos3 | Best photo quality, slowest | ✓ |
| triangle (bilinear) | Fast, decent | |
| hqx | Pixel-art specialty | |
| Auto-pick by image size + format | Heuristic | |

**User's choice:** lanczos3.

### Q2: UI exposure

| Option | Description | Selected |
|---|---|---|
| Hidden — hardcoded for v1 | No setting at all | |
| Global setting in TweaksPanel | Single dropdown | |
| Per-format setting in CodecPanel | Per-format dropdowns | |
| Per-file override on top of global | Global default + detail-view override | ✓ |

**User's choice:** Per-file override on top of global default.

### Q3: Per-file override UI in Phase 4

| Option | Description | Selected |
|---|---|---|
| Phase 4 ships data shape only; UI deferred to Phase 5 | Cleanest scope split | ✓ |
| Phase 4 adds tiny per-row picker | Override visible in v1 | |
| Phase 4 adds right-click context menu | Hidden affordance | |
| Skip override entirely (walk back) | Global only | |

**User's choice:** Phase 4 ships data shape only; UI deferred to Phase 5 detail view.

---

## Metadata stripping + ICC policy

### Q1: Default metadata + ICC behavior

| Option | Description | Selected |
|---|---|---|
| Strip ALL (EXIF/XMP/IPTC + ICC) by default | Privacy-first | ✓ |
| Strip metadata + preserve ICC by default | Color fidelity | |
| Strip ALL + warning when ICC detected | Educational toast | |
| Format-aware (strip-all PNG/WebP, preserve-ICC JPEG/AVIF) | Opinionated | |

**User's choice:** Strip ALL by default.

### Q2: ICC toggle location

| Option | Description | Selected |
|---|---|---|
| Global TweaksPanel only | Single global toggle | |
| Per-file detail view (Phase 5) | Phase 4 ships data shape only | |
| Global + per-file override (data shape only in Phase 4) | Both | ✓ |
| Per-format setting in CodecPanel (JPEG/AVIF only) | Format-aware | |

**User's choice:** Global TweaksPanel toggle (off by default) + per-file override data shape; per-file UI deferred to Phase 5.

### Q3: Stripping implementation method

| Option | Description | Selected |
|---|---|---|
| Trust decode/encode roundtrip — no explicit code | Simplest | ✓ |
| Explicitly verify + assert metadata absent | Test boilerplate only | |
| Active strip pass (parse chunks before re-encode) | Most defensible, biggest surface | |
| Trust roundtrip + ICC-explicit threading | Two-track | |

**User's choice:** Trust the decode/encode roundtrip.
**Notes:** ICC preservation when toggle = on still requires explicit ICC threading via jSquash decode/encode options. Planner research item: discover the exact `iccProfile` (or equivalent) option signatures across `@jsquash/png|jpeg|webp|avif`.

---

## Memory cap mechanism

### Q1: Cap enforcement strategy

| Option | Description | Selected |
|---|---|---|
| Soft backpressure: pause queue intake near budget | Pace queue feeding | |
| Hard reject when over budget | Strict, can mis-reject fitting batches | |
| Pre-flight warning + user choice | Modal before batch starts | |
| Discard ImageData immediately + soft backpressure | Stacked defense | ✓ |

**User's choice:** Stacked defense — discard ImageData ASAP + soft backpressure.

### Q2: Memory budget threshold

| Option | Description | Selected |
|---|---|---|
| Hard 600MB constant | Fixed | |
| Dynamic: `0.75 × deviceMemory × 1024`, capped at 600MB | Device-aware | ✓ |
| User-configurable in TweaksPanel | Power-user setting | |
| Conservative 400MB (50% ceiling) | Wider safety margin | |

**User's choice:** Dynamic deviceMemory-based formula, capped at 600MB. Fallback for Safari/Firefox: assume 4GB → cap at 600MB.

### Q3: Backpressure visibility

| Option | Description | Selected |
|---|---|---|
| Silent — no UI surface | Invisible | |
| StatusBar indicator | Persistent badge | |
| Toast on first throttle | One-time educational | |
| Both StatusBar + first-throttle toast | Stacked | ✓ |

**User's choice:** StatusBar indicator + first-throttle toast per batch.

### Q4: Object URL keying for variants

| Option | Description | Selected |
|---|---|---|
| urlCache keyed by `(fileId, density)` | Composite key | |
| urlCache keyed by Blob identity (Map<Blob, string>) | Decoupled | |
| Per-variant FileEntry with density in id; Phase 2 urlCache shape unchanged | Conflict requires reconcile | |
| Reconcile D-04 — FileEntry IS per-variant, density in id | Cleanest | ✓ |

**User's choice:** Reconcile D-04 — each density variant is its own FileEntry. Pool stays 1:1 with FileEntries; urlCache stays Phase 2 shape.

---

## Claude's Discretion

- File row UI grouping for N FileEntries per source (parent/nested vs flat-with-pill vs collapsed)
- Exact location of "Resize / Variants" section in TweaksPanel
- Whether settings live in `useSettingsStore.global` or new `resize`/`metadata` slices
- Exact byte-estimate formula for the admission gate (decode-multiplier safety margin)
- Per-file source-density dropdown affordance (permanent vs hover/expand)
- Worker-side ImageData disposal mechanism (null assignment vs ArrayBuffer detach)
- Field naming: `resizeOverride` vs `resizeAlg` on FileEntry
- StatusBar backpressure indicator visual

## Deferred Ideas

- Single decode → N resize fanout inside one adapter job (output[] return shape)
- Per-file UI for resize algorithm + ICC override
- Format-aware metadata defaults (PNG strip-all, JPEG preserve-ICC)
- User-configurable memory budget
- Filename suffix as user-configurable global setting
- Active metadata-strip-pass implementation
- WeakMap-keyed urlCache
