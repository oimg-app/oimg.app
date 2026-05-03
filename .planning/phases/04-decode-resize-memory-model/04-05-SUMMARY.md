---
phase: 04
plan: 04-05
subsystem: files-fanout-and-settings
tags: [phase-4, wave-2, files-store, settings-store, fan-out, density-variants, collision-dedup]
requires:
  - FileEntry.{sourceFamilyId,targetDensity,resizeOverride,preserveIcc} (Plan 04-01)
  - DEFAULT_RESIZE_SETTINGS (Plan 04-01)
  - applyDensitySuffix + deduplicateName (Plan 04-02)
  - sniffPngDimensions (Plan 04-02)
  - estimateJobBytes (Plan 04-02)
  - useRuntimeStore.markRename (Plan 04-04)
provides:
  - useFilesStore.addSourceWithVariants (drop-time fan-out, atomic)
  - useFilesStore.removeFamily (cascade-via-removeFile preserves URL revoke)
  - FileEntryWithBlob.byteEstimate (per-variant peak working-set hint)
  - useSettingsStore.resize.{alg} slice + setResize partial-merge action
affects:
  - Plan 04-06 (UI integration — drop intake calls addSourceWithVariants;
    TweaksPanel "Resize / Variants" reads resize.alg + writes via setResize)
  - Plan 04-07 (App.tsx startOptimize threads byteEstimate into PoolJob.byteEstimate
    when enqueuing the pool job)
  - raster.spec.ts tests #1 (density variants) + #6 (collision rename) flipped
    from test.fail() to live green
tech-stack-added: []
patterns:
  - "Atomic single-set() multi-entry push avoids Strict-Mode dev double-render
    partial-write artifacts"
  - "Cross-store call useRuntimeStore.getState().markRename(N) mirrors the
    existing useRuntimeStore.getState().revokeObjectURL(fileId) shape from
    files.ts"
  - "removeFamily LOOPS removeFile rather than bulk-deleting byId — preserves
    URL-revoke discipline (RESEARCH §5.2 explicit guidance)"
  - "Density-to-pixel-scale: parseInt(targetDensity) / parseInt(sourceDensity)
    — scalar arithmetic, no per-density lookup table"
  - "Non-PNG byteEstimate fallback: blob.size × 10 (compression ratio) × 4
    (RGBA) × 1.75 (WASM heap multiplier) — same units as estimateJobBytes so
    admission gate math stays consistent"
  - "Live store gate via __OIMG_STORES__ in raster.spec.ts complements
    pure-defaults emulation in settings-resize.test.ts (Plan 04-01 split-pattern)"
key-files-created:
  - src/tests/settings-resize.test.ts
key-files-modified:
  - src/stores/files.ts
  - src/stores/settings.ts
  - src/tests/raster.spec.ts
key-decisions:
  - "Phase 4 Plan 04-05: addSourceWithVariants is the ONLY drop-time fan-out
    surface — interactive editing of target set after drop is deferred to Phase 5
    per CONTEXT.md D-01/D-02 SCOPED amendment. The plan body's `targets:[]` no-op
    branch is documentation; production callers always pass a non-empty array."
  - "Phase 4 Plan 04-05: settings-resize live gate added to raster.spec.ts (not a
    new spec file) because the existing spec is the canonical Phase 4 store-driven
    E2E surface; adding a sibling spec would fragment phase coverage with no
    isolation benefit."
metrics:
  duration_minutes: 18
  tasks_completed: 2
  files_changed: 4
  commits: 4
  completed_date: "2026-05-03"
---

# Phase 4 Plan 04-05: Files fan-out + settings resize slice Summary

`useFilesStore` gained `addSourceWithVariants` (drop-time variant fan-out with
atomic push, byte-estimate seeding, and collision dedup) and `removeFamily`
(cascade-via-removeFile preserving URL revoke). `useSettingsStore` gained a
top-level `resize: { alg: ResizeAlg }` slice with `setResize` partial-merge
action. Two of seven `test.fail()` markers in `raster.spec.ts` flipped to live
green; the new settings-resize live gate joined them. Full Playwright suite
47/47.

## What Shipped

### Task 1 — `addSourceWithVariants` + `removeFamily` (commit `2f35ea9`)

**`src/stores/files.ts` interface extension:**

```typescript
export interface FileEntryWithBlob extends FileEntry {
  sourceBlob: Blob
  optimizedBlob: Blob | null
  /** Phase 4 D-11(b) — peak working-set estimate for this variant. */
  byteEstimate?: number
}

interface FilesState {
  // ... existing actions unchanged ...
  addSourceWithVariants: (args: {
    sourceBlob: Blob
    sourceDensity: SourceDensity
    name: string
    format: FormatId
    targets: SourceDensity[]
  }) => Promise<void>
  removeFamily: (sourceFamilyId: string) => void
}
```

**Action behavior:**

- `addSourceWithVariants({sourceBlob: <800x600 PNG>, sourceDensity:'2x',
  name:'logo.png', format:'png', targets:['1x','2x','3x']})` materializes 3
  entries with shared `sourceFamilyId = sourceUuid`, ids
  `${sourceUuid}-1x|2x|3x`, names `logo@1x.png` / `logo@2x.png` /
  `logo@3x.png`, and per-variant `targetDensity`.
- Pre-decode PNG dimension sniff runs ONCE per source via `sniffPngDimensions`
  (24-byte read from Plan 04-02), then `estimateJobBytes(srcW, srcH, tgtW,
  tgtH)` per target with `tgtScale = parseInt(tgt) / parseInt(sourceDensity)`.
- Non-PNG sources (svg/jpeg/webp/avif) get the heuristic `Math.ceil(blob.size
  × 10 × 4 × 1.75)` per RESEARCH §2.2(a). Same 4×1.75 multiplier as
  `estimateJobBytes` so admission gate math stays unit-consistent.
- Collision dedup: `applyDensitySuffix` runs FIRST per target (D-16), then
  `deduplicateName` against the live `byId` name set + the in-batch running
  set. A second drop of `logo.png` with the same targets emits `logo (2)@1x.png`
  / `logo (2)@2x.png` / `logo (2)@3x.png` and increments
  `useRuntimeStore.renameCountThisBatch` by 3 via
  `useRuntimeStore.getState().markRename(3)`.
- All variant pushes happen in a single `set()` call to avoid Strict-Mode dev
  double-render partial-write artifacts.
- `targets.length === 0` short-circuits — no entries pushed, no rename count
  increment.
- `removeFamily(sourceFamilyId)` snapshots variant ids first (because
  `removeFile` mutates `byId`), then loops `useFilesStore.getState()
  .removeFile(id)` per variant — preserves the per-id URL revoke + snippet
  toggle cleanup discipline from Phase 2 + Phase 3 (RESEARCH §5.2).

**Existing actions** (`addFile`, `removeFile`, `markDone`, `clear`,
`setSelected`, `setStatus`, `setSourceDensity`) are byte-identical to
pre-Plan-04-05 — verified by diffing only the additive lines.

### Task 2 — `resize` slice + `setResize` (commit `00bdc1f`)

**`src/stores/settings.ts` extension:**

```typescript
interface SettingsState {
  // ... existing slices unchanged ...
  resize: { alg: ResizeAlg }
  // ... existing setters unchanged ...
  setResize: (next: Partial<{ alg: ResizeAlg }>) => void
}

// In create() body:
resize: DEFAULT_RESIZE_SETTINGS,
setResize: (next) => set((s) => ({ resize: { ...s.resize, ...next } })),
```

**Behavior:**

- Initial `useSettingsStore.getState().resize.alg === 'lanczos3'` (D-05
  default).
- `setResize({alg:'mitchell'})` flips to `'mitchell'`.
- `setResize({})` is a no-op (partial-merge with empty object preserves
  existing alg) — same shape as `setSvg`/`setPng`/etc.
- `global.preserveIccProfile` and all other slices are byte-identical to
  pre-Plan-04-05.

Per RESEARCH Open Question 5 + PATTERNS.md lines 488-504: extending `global`
for ICC (already there from Plan 04-01) but adding a NEW top-level `resize`
slice for the algorithm — ICC and resize are conceptually orthogonal, and
co-locating them would muddy the TweaksPanel section split.

## Empirically-Verified Test Cases

### raster.spec.ts (Playwright, live store via `__OIMG_STORES__`)

| # | Test name | Pre-04-05 | Post-04-05 |
|---|-----------|-----------|-----------|
| 1 | density variants — source 2x emits @1x/@2x/@3x FileEntries | test.fail() | LIVE PASS |
| - | removeFamily cascades through removeFile preserving URL revoke | (new) | LIVE PASS |
| - | settings resize slice — defaults lanczos3 + setResize partial merge | (new) | LIVE PASS |
| 6 | collision rename — duplicate @Nx names auto-suffix (2) | test.fail() | LIVE PASS |

`grep -E "^\s*test\.fail\(" src/tests/raster.spec.ts | wc -l` returns **5**
(was 7 before this plan; tests #1 and #6 flipped). Plans 04-03 already shipped
the iCCP-strip path (test #7) and Plans 04-04 already shipped the throttle
toast (test #4) — those flips are documented in their respective summaries.

### settings-resize.test.ts (node --experimental-strip-types, pure-defaults)

3 assertions: DEFAULT_RESIZE_SETTINGS.alg === 'lanczos3', merge contract flips
alg, no-op merge preserves alg.

### Acceptance criteria grep audit

| Check | Result |
|---|---|
| `grep -c "addSourceWithVariants" src/stores/files.ts` | 4 (≥2 required) |
| `grep -c "removeFamily" src/stores/files.ts` | 2 (≥2) |
| `grep -c "byteEstimate" src/stores/files.ts` | 8 (≥3) |
| `grep -cE "applyDensitySuffix\|deduplicateName" src/stores/files.ts` | 6 (≥2) |
| `grep -c "markRename" src/stores/files.ts` | 2 (1 cross-store call + 1 doc) |
| `grep -c "sniffPngDimensions" src/stores/files.ts` | 3 (1 import + 2 doc) |
| `grep -c "DEFAULT_RESIZE_SETTINGS" src/stores/settings.ts` | 2 (import + seed) |
| `grep -c "setResize" src/stores/settings.ts` | 2 (interface + body) |
| `grep -c "resize:" src/stores/settings.ts` | 3 (interface + seed + setter) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Plan-body inline node verifier cannot resolve `@/`
Vite alias under bare-node**

- **Found during:** Task 1 + Task 2 verification design
- **Issue:** The plan's `<verify>` block specified
  `node --experimental-strip-types -e "import('./src/stores/files.ts')..."`
  and similar for settings.ts. Both modules import from `@/types`, `@/data/defaults`,
  `@/lib/filename`, etc. — Vite-only path aliases that bare-node has no
  resolver for. Same precedent established by Plans 04-01 (settings-icc.test.ts),
  04-02 (filename.ts uses relative `../types/index.ts`), and 04-03 (png-adapter
  local-only `.ts` extensions).
- **Fix:** Used the dual-path verification model already established in
  Phase 4:
  - **Live store gate:** flipped `raster.spec.ts` test #1 (density variants) +
    test #6 (collision rename) from `test.fail()` to live + added a new
    `removeFamily` Playwright test + added a new `settings resize slice`
    Playwright test that exercises `useSettingsStore` end-to-end through
    `__OIMG_STORES__`.
  - **Pure-defaults contract gate:** added `src/tests/settings-resize.test.ts`
    that imports `DEFAULT_RESIZE_SETTINGS` directly + emulates the merge
    logic, mirroring `settings-icc.test.ts` exactly.
- **Files modified:** `src/tests/raster.spec.ts`,
  `src/tests/settings-resize.test.ts` (new)
- **Commits:** `2b8db93` (RED Task 1), `a365ab9` (RED Task 2)
- **Precedent:** This is the third Phase 4 plan to apply this pattern. The
  STATE.md Decisions section already documents the Plan 04-01 + 04-02 + 04-03
  iterations of the same workaround. A Phase 5 follow-up will be needed to
  decide whether `tsx`/`vite-node` should replace bare-node strip-types as
  the default unit-test runner — out of scope for Plan 04-05.

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx playwright test` (full suite) | 47 passed, 0 failed |
| `npx playwright test raster.spec.ts -g "density variants\|removeFamily\|collision rename\|settings resize"` | 4 passed, 0 failed |
| `node --experimental-strip-types src/tests/filename.test.ts` | 6 passed, 0 failed |
| `node --experimental-strip-types src/tests/settings-icc.test.ts` | 3 passed, 0 failed |
| `node --experimental-strip-types src/tests/settings-resize.test.ts` | 3 passed, 0 failed |
| `node --experimental-strip-types src/tests/icc.test.ts` | WASM-fallback OK (Plan 04-03 documented behavior) |

## Closure Hooks for Later Plans

| Plan | Hook |
|---|---|
| 04-06 (UI integration) | Drop intake reads source density + targets from per-row UI controls and calls `useFilesStore.getState().addSourceWithVariants(...)` once per dropped source. TweaksPanel "Resize / Variants" section reads `useSettingsStore((s) => s.resize.alg)` and writes via `setResize({alg})`. The single-toast Sonner notification reads `useRuntimeStore((r) => r.renameCountThisBatch)` after batch start. |
| 04-07 (App wiring + UAT) | `App.tsx` startOptimize loop already iterates `filesState.order` — N FileEntries per source means N pool jobs without changing the loop. Thread `entry.byteEstimate` into `PoolJob.byteEstimate` when constructing the job (Plan 04-04 admission gate consumes it). Source-density edit on existing FileEntry is a NO-OP per CONTEXT.md D-01/D-02 SCOPED amendment (Phase 5 owns interactive re-fan-out). |
| 04-06 raster.spec.ts test #3 (URL leak gate) | `removeFamily` cascade preserves the per-id URL-revoke loop; the existing `instrument-blob-urls.js` will gate the 20-file batch URL leak count when Plan 04-07 ships the App-level wiring. |

## Threat Surface Scan

No new threat-relevant surface introduced beyond the plan's threat register
(T-04-05-01..06). Verified:

- No new network endpoints (zero-server stance preserved).
- No new file-access patterns (sourceBlob is the same trust boundary as
  Phase 2's `addFile`).
- No schema changes at trust boundaries (FileEntry shape was already
  extended in Plan 04-01; only an internal `byteEstimate` hint was added,
  and per T-04-05-06 it stays internal — never surfaced in UI/snippets/ZIP).
- No new auth paths.

The render-path filename-XSS surface (T-04-05-01) is mitigated by React's JSX
text auto-escaping at FilePanel render time — same posture as pre-Plan-04-05
since `addFile` already accepted user-supplied names.

## Self-Check: PASSED

- Files modified exist:
  - `src/stores/files.ts` FOUND (addSourceWithVariants + removeFamily +
    byteEstimate field present)
  - `src/stores/settings.ts` FOUND (resize slice + setResize action +
    DEFAULT_RESIZE_SETTINGS import present)
  - `src/tests/raster.spec.ts` FOUND (3 new live tests + 2 stub flips)
- Files created exist:
  - `src/tests/settings-resize.test.ts` FOUND (3 assertions, 1.6 KB)
- Commits exist:
  - `2b8db93` FOUND (RED Task 1: raster.spec.ts test flips)
  - `2f35ea9` FOUND (GREEN Task 1: addSourceWithVariants + removeFamily)
  - `a365ab9` FOUND (RED Task 2: resize slice contract tests)
  - `00bdc1f` FOUND (GREEN Task 2: resize slice + setResize)
