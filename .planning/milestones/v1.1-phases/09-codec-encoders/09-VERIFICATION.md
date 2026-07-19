---
phase: 09-codec-encoders
verified: 2026-05-26T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 9: Codec Encoders Verification Report

**Phase Goal:** Every codec in the locked jSquash + svgo surface has a worker-side adapter, and the inspector's controls actually shape the encoded bytes.
**Verified:** 2026-05-26
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PNG run through OxiPNG produces real, smaller-byte output | VERIFIED | `codec.worker.ts` lines 80–90: WR-02 guard + `@jsquash/oxipng` `optimise()` + `Comlink.transfer` return. Test `codec-encoders.spec.ts:30` asserts `byteLength > 0` and `optimizedSize <= originalSize`. |
| 2 | WebP, JPEG, AVIF each produce valid encoded output with format-specific controls applied | VERIFIED | Worker lines 93–148: each case has WR-02 guard + `decodeSource` + `maybeResize` + codec-specific `encode()` with settings fields mapped (quality, method, lossless, progressive, speed). AVIF lazy-imports `@jsquash/avif` inside its own case only. Tests ENC-02/03/04 all assert `byteLength > 0`. |
| 3 | SVG run through svgo v4 (preset-default + overrides) shrinks with plugin toggles reflected | VERIFIED | Worker lines 150–175: `await import('svgo/browser')`, TextDecoder, `overrides` built from `job.settings.plugins` (disabled plugins → `false`), `optimize()` called, result `byteLength` checked. Test ENC-05 asserts output contains `<svg` and `outputLength <= inputLength`. |
| 4 | Changing an inspector setting measurably changes the encoded output | VERIFIED | `CodecPanel.tsx`: every control calls `setFileSettings(selectedFile.id, key, value)` then `trigger(selectedFile.id)`. `useLiveEncode.ts`: 300ms debounce fires pool job with updated settings. Test ENC-06 encodes WebP at q=90 vs q=10 and asserts `highByteLength > lowByteLength`. |
| 5 | Each file owns independent FileSettings; editing one does not mutate another | VERIFIED | `files.ts` `setFileSettings` uses `entries.map(e => e.id === id ? {...e, settings:{...e.settings!, [key]:value}} : e)` — creates new objects, leaves siblings unchanged. `per-file-settings.spec.ts` covers D-01/D-02/D-03. |
| 6 | All 6 ENC requirements satisfied with passing Playwright tests (48/48) | VERIFIED | REQUIREMENTS.md marks ENC-01..06 as Complete for Phase 9. Orchestrator confirms 48/48 Playwright tests pass on Chromium including 7 codec-encoder tests. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/workers/codec.worker.ts` | Real PNG/WebP/JPEG/AVIF/SVG adapters | VERIFIED | All 5 cases implemented; no stub throws; decodeSource + maybeResize helpers present; WR-02/WR-03 applied in every case |
| `src/hooks/useOptimize.ts` | Real-bytes dispatch + setFileResult/setFileError | VERIFIED | No `new ArrayBuffer(0)`; uses `rawBuffer.slice(0)` + `Comlink.transfer`; `setFileResult`/`setFileError` routing present |
| `src/hooks/useLiveEncode.ts` | Debounced single-file re-encode (D-05/D-07) | VERIFIED | `useRef` + `clearTimeout` + `setTimeout(..., 300)`; `setEncodingFile` before/after dispatch; slice(0) copy |
| `src/stores/files.ts` | setFileSettings, setFileError, setFileResult, setFileRawBuffer | VERIFIED | All 4 actions exported; typed `<K extends keyof FileSettings>`; atomic `setKey('entries', ...map)` |
| `src/stores/settings.ts` | applyToAll via lazy import | VERIFIED | `import('@/stores/files').then(...)` pattern; no top-level circular dep |
| `src/stores/runtime.ts` | encodingFileId + setEncodingFile; CR-01 atomic setJobCounts | VERIFIED | `encodingFileId: string | null` in RuntimeState; `setEncodingFile` uses `setKey`; `setJobCounts` uses 3 atomic `setKey` calls, no `runtimeAtom.set(` spread |
| `src/lib/stub-data.ts` | FileSettings interface + FileEntry extension + initFileSettings + real seed bytes | VERIFIED | `FileSettings` has 13 fields + optional `progressive`; FileEntry has 4 optional fields; `initFileSettings` shallow-copies; STUB_FILES seeded with real ArrayBuffers via `sampleBytesFor()` |
| `src/components/panels/inspector/CodecPanel.tsx` | Per-file settings wiring + useLiveEncode + PNG/JPEG rules | VERIFIED | Reads `selectedFile?.settings ?? globalSettings`; all handlers call `setFileSettings` + `trigger`; Quality Slider `disabled={isPng}`; JPEG Progressive `<Switch>` conditionally rendered |
| `src/components/panels/inspector/SvgoPanel.tsx` | Per-file plugin toggle + re-encode trigger | VERIFIED | `handleTogglePlugin` calls `setFileSettings(id, 'plugins', updatedPlugins)` + `trigger` |
| `src/components/panels/InspectorPane.tsx` | Context label (D-03) + Apply-to-all button (D-02) | VERIFIED | `aria-live="polite"` label; `"currently editing"` text; Apply button with correct `aria-label`; hidden when `entries.length < 2`; calls `applyToAll()` |
| `src/components/panels/center/DeltaStrip.tsx` | Real encoded size + shimmer + (fallback) | VERIFIED | Reads `selectedFile?.encodedBuffer.byteLength`; `isEncoding` drives `animate-pulse` + `"···"`; `hasError` renders `(fallback)` |
| `src/components/panels/center/CompareStage.tsx` | Real images via object URLs | VERIFIED | Two `useEffect`s creating `URL.createObjectURL` + `URL.revokeObjectURL` cleanup; `<img>` elements for orig/encoded layers |
| `src/tests/codec-encoders.spec.ts` | ENC-01..06 + D-13 tests | VERIFIED | 7 tests present; each dispatches a real EncodeJob through `getPool()`; asserts on actual `byteLength`/XML structure |
| `src/tests/per-file-settings.spec.ts` | D-01/D-02/D-03 tests | VERIFIED | `test.describe('per-file settings — D-01/D-02/D-03', ...)` block with 3+ tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `codec.worker.ts decodeSource` | `@jsquash/{png,jpeg,webp,avif} decode` | `await import` inside switch | WIRED | Lines 31–51: each branch dynamic-imports its own codec |
| `codec.worker.ts SVG case` | `svgo/browser optimize` | `await import('svgo/browser')` | WIRED | Line 154: inside SVG case only |
| `worker-pool.ts dispatch` | `worker.optimize` | `Comlink.transfer(pending.job, [pending.job.buffer])` | WIRED | Line 49 confirmed |
| `CodecPanel onChange` | `setFileSettings + trigger` | per-control handler | WIRED | Every handler checks `selectedFile` and calls both |
| `InspectorPane Apply-to-all` | `applyToAll()` | onClick | WIRED | `handleApplyToAll` calls `applyToAll()` then `toast.message` |
| `DeltaStrip` | `selectedFile.encodedBuffer` | `useStore($selectedFile)` | WIRED | Line 53: `selectedFile?.encodedBuffer.byteLength` |
| `settings.ts applyToAll` | `filesAtom` | lazy `import('@/stores/files')` | WIRED | Line 66 of settings.ts |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `DeltaStrip.tsx` | `opt` (optimized size) | `selectedFile.encodedBuffer.byteLength` | Yes — set by `setFileResult` after real encode | FLOWING |
| `CompareStage.tsx` | `origSrc`, `encodedSrc` | `URL.createObjectURL(new Blob([rawBuffer/encodedBuffer]))` | Yes — from real ArrayBuffer bytes | FLOWING |
| `useOptimize.ts` | `rawBuffer` | `File.arrayBuffer()` or `STUB_FILES` seed bytes | Yes — real bytes or valid stub bytes | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Playwright tests (48/48 passing) cover all runnable behaviors end-to-end. No separate CLI/API spot-checks needed.

### Probe Execution

No `scripts/*/tests/probe-*.sh` found. No probes declared in PLAN files.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ENC-01 | 09-02 | PNG via OxiPNG produces real smaller output | SATISFIED | Worker PNG case + test ENC-01 |
| ENC-02 | 09-02 | WebP encode with quality/lossless controls | SATISFIED | Worker WebP case + test ENC-02 |
| ENC-03 | 09-02 | JPEG (MozJPEG) with quality + progressive | SATISFIED | Worker JPEG case + test ENC-03 |
| ENC-04 | 09-02 | AVIF lazy-loaded with quality control | SATISFIED | Worker AVIF case (lazy import inside try/catch) + test ENC-04 |
| ENC-05 | 09-02 | SVG via svgo v4, plugin toggles reflected | SATISFIED | Worker SVG case + overrides from settings.plugins + test ENC-05 |
| ENC-06 | 09-01/03/04 | Inspector settings drive encoded output measurably | SATISFIED | CodecPanel setFileSettings+trigger → useLiveEncode pool dispatch + test ENC-06 |

### Anti-Patterns Found

No TBD/FIXME/XXX markers found in any phase-modified files. No hardcoded hex colors in UI files. No top-level `@jsquash` imports in the worker (PIPE-02 discipline intact). No `new ArrayBuffer(0)` in `useOptimize.ts`.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

### Human Verification Required

No items require human verification. All observable truths are verifiable programmatically or via the Playwright suite.

### Gaps Summary

No gaps found. All 6 success criteria and 6 ENC requirements are satisfied by real, substantive, wired implementations with passing end-to-end tests.

---

_Verified: 2026-05-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
