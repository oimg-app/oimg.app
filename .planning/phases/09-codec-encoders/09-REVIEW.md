---
phase: 09-codec-encoders
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/workers/codec.worker.ts
  - src/lib/worker-pool.ts
  - src/hooks/useOptimize.ts
  - src/hooks/useLiveEncode.ts
  - src/stores/files.ts
  - src/stores/settings.ts
  - src/stores/runtime.ts
  - src/lib/stub-data.ts
  - src/components/panels/inspector/CodecPanel.tsx
  - src/components/panels/inspector/SvgoPanel.tsx
  - src/components/panels/InspectorPane.tsx
  - src/components/panels/center/DeltaStrip.tsx
  - src/components/panels/center/CompareStage.tsx
  - src/tests/codec-encoders.spec.ts
  - src/tests/per-file-settings.spec.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 9 swapped Phase 8 stubs for real jSquash + svgo encoding. The worker's dynamic-import discipline (PIPE-02), Comlink.transfer zero-copy returns, buffer-slice-before-transfer (Pitfall 3), object-URL revocation in CompareStage, and debounce cleanup in useLiveEncode are all implemented correctly. jSquash option field names (`quality`, `progressive`, `speed`, `method`, `level`, `fitMethod`) and named/default export shapes were verified against `node_modules` `.d.ts` and match.

However, there is a data-loss BLOCKER in the per-file settings path: seeded files never get a `settings` object, and `setFileSettings` spreads `undefined`, collapsing the whole settings object down to a single edited key on first edit. Two more BLOCKERs concern a stale-debounce race that writes one file's result onto another and a feature-completeness gap where toggled SVGO/metadata/aggressive settings are silently ignored by the encoder. Several WARNINGs cover settings desync, lost-update races in per-file mutators, and a misleading `applyToAll` that destroys per-file overrides without confirmation despite advertising it does.

## Critical Issues

### CR-01: First per-file edit destroys all other settings (settings = undefined spread)

**File:** `src/stores/files.ts:102-105`
**Issue:** `setFileSettings` does `{ ...e.settings!, [key]: value }`. The non-null assertion `e.settings!` is a lie: seeded entries in `STUB_FILES` (stub-data.ts:113-116) are created with only `...e` + `rawBuffer` — they have **no `settings` field**, and `initFileSettings` is never called anywhere in production code (only in tests). Spreading `undefined` yields `{}`, so the first slider/toggle edit on any seeded file produces a settings object containing **only the one edited key** (e.g. `{ q: 42 }`). `codec`, `plugins`, `lossless`, `resizeOn`, etc. are all wiped. On the next `useLiveEncode` run, `entry.settings` exists but `entry.settings.codec` is `undefined` and `entry.settings.plugins` is `undefined`; `maybeResize` and the SVG plugin loop then read missing fields. This is data loss plus broken encodes — exactly the "editing one file" path the phase added.
**Fix:** Initialize per-file settings before the first mutation. Either seed `settings` in `STUB_FILES` (and on real upload), or make the setter self-healing:
```ts
export function setFileSettings<K extends keyof FileSettings>(id: string, key: K, value: FileSettings[K]): void {
  filesAtom.setKey('entries', filesAtom.get().entries.map(e =>
    e.id === id
      ? { ...e, settings: { ...(e.settings ?? initFileSettings(settingsAtom.get())), [key]: value } }
      : e
  ))
}
```
(Importing `settingsAtom` here re-introduces the circular-dep guard the codebase avoids — prefer seeding `settings` at entry creation via `initFileSettings`.)

### CR-02: Stale debounce writes one file's result onto a different file

**File:** `src/hooks/useLiveEncode.ts:32-69`
**Issue:** The debounce timer fires an async callback that closes over `fileId`. But `trigger` is also called when the user **selects a different file** (CodecPanel auto-switch effect + per-file handlers). If the user changes file B's settings, then quickly selects file C and changes its settings, two separate timers may be in flight (the second `trigger` clears only the most recent timer; the in-flight `pool.run` from a prior fire is not cancellable). Worse, `setEncodingFile(fileId)` then `setEncodingFile(null)` in `finally` is a shared single-slot flag: an earlier job's `finally` clears the shimmer for a later job. There is no guard that the file is still selected / settings unchanged when the result lands, so `setFileResult(fileId, ...)` can apply an encode produced from **superseded settings**, and the DeltaStrip shimmer state desyncs. Result correctness is not guaranteed under rapid interaction.
**Fix:** Capture a per-invocation token and ignore stale results; scope the encoding flag per file:
```ts
const seqRef = useRef(0)
const trigger = useCallback((fileId: string) => {
  if (timerRef.current !== null) clearTimeout(timerRef.current)
  const seq = ++seqRef.current
  timerRef.current = setTimeout(async () => {
    // ...build job...
    setEncodingFile(fileId)
    try {
      const result = await getPool().run(job)
      if (seq !== seqRef.current) return            // superseded — drop
      setFileResult(fileId, result.buffer, result.optimizedSize)
    } catch (err) { /* ... */ }
    finally { if (seq === seqRef.current) setEncodingFile(null) }
  }, 300)
}, [])
```

### CR-03: SVGO plugin toggles, metadata, and aggressive settings are silently ignored

**File:** `src/workers/codec.worker.ts:150-175`, `src/stores/settings.ts:57-61`, `src/components/panels/inspector/SvgoPanel.tsx:29-39`
**Issue:** Two distinct data-loss-of-intent defects:
1. **Global plugin toggles never reach the encoder.** When no file is selected, `SvgoPanel.handleTogglePlugin` calls `togglePlugin(id)` (settings.ts) which mutates `settingsAtom.plugins`. But the worker's SVG branch reads `job.settings.plugins` from the **per-file** settings only. For a non-selected/global encode, `useOptimize` uses `entry.settings ?? settingsAtom.get()`; once CR-01 corrupts `entry.settings`, `plugins` is `undefined`, so `const plugins = job.settings.plugins ?? []` produces an empty override set — every disabled plugin is silently re-enabled. The user's curated toggles are discarded.
2. **`stripMeta`, `keepIcc`, and `aggressive` are dead settings.** The CodecPanel exposes Strip-EXIF / Keep-ICC switches and SvgoPanel exposes Aggressive mode, all wired through `setFileSettings`/`trigger`, but the worker never reads `settings.stripMeta`, `settings.keepIcc`, or `settings.aggressive`. JPEG/WebP/AVIF encode calls omit metadata handling entirely, so EXIF/GPS is **not stripped** despite the UI claiming it is — a privacy-relevant correctness gap for a zero-server privacy tool. AVIF lossless toggle is read but `aggressive` is not.
**Fix:** (a) Resolve CR-01 so `plugins` always survives; (b) either wire `stripMeta`/`keepIcc`/`aggressive` into the encode option objects (mozjpeg/oxipng support metadata stripping) or disable/remove the switches so the UI does not misrepresent behavior. Do not ship privacy switches that no-op.

## Warnings

### WR-01: `applyToAll` silently overwrites per-file settings and drops `progressive`

**File:** `src/stores/settings.ts:65-73`
**Issue:** `applyToAll` maps every entry to `{ ...e, settings: { ...defaults } }`. `defaults` is `settingsAtom.get()` (SettingsState), which has **no `progressive` field**, so any per-file JPEG `progressive` override is lost. More importantly, InspectorPane shows the button only when `entries.length >= 2` and the caption says "Overwrites per-file settings," but there is no confirmation — one click irreversibly discards all individual tuning. The toast in `handleApplyToAll` ("Applying settings to N files…") fires synchronously while `applyToAll` runs asynchronously via lazy import, so the toast may show before (or without) the mutation actually landing.
**Fix:** Spread `progressive` into the copied settings; gate the destructive action behind a confirm or undo, and await the lazy import before toasting (return the promise from `applyToAll`).

### WR-02: Per-file mutators are read-modify-write — lost updates under rapid edits

**File:** `src/stores/files.ts:99-126`
**Issue:** `setFileSettings`, `setFileError`, `setFileResult`, and `setFileRawBuffer` each do `filesAtom.get().entries.map(...)` then `setKey('entries', ...)`. CodecPanel's `handleSetResizeDimensions` calls `setFileSettings(...,'w',...)` immediately followed by `setFileSettings(...,'h',...)`. nanostores `setKey` is synchronous so these specific back-to-back calls are safe, but `setFileResult` (from an async `pool.run` callback in useOptimize's `allSettled` loop) and `setFileRawBuffer` (from an `await fileHandle.arrayBuffer()`) interleave with other async writers over the same `entries` array. A result landing between a read and write of a concurrent error/rawBuffer update can clobber the other field. The runtime store's `setJobCounts` was already hardened to atomic `setKey` per field (runtime.ts:59-62) for exactly this reason; the files store was not given equivalent treatment for its array-rebuild writes.
**Fix:** Funnel all entry mutations through a single update queue, or use a nanostores deep map keyed by id so per-id field writes are atomic rather than whole-array rebuilds.

### WR-03: WebP/JPEG/AVIF re-encode of already-lossy source has no source-format guard

**File:** `src/workers/codec.worker.ts:93-148`, `src/hooks/useOptimize.ts:57-63`
**Issue:** `sourceFormat` is taken verbatim from `entry.type.toLowerCase()` and cast `as EncodeJob['sourceFormat']`. There is no validation that the cast value is one of the union members before it reaches `decodeSource`. An entry whose `type` is e.g. `gif` or `bmp` (possible from a future real-upload path) passes `toCodec` only if it matches the codec switch, but `sourceFormat` would be `'gif'`, and `decodeSource` throws "Unknown source format" — surfaced as a generic per-file failure rather than a clear "unsupported input" message. The cast hides the mismatch from the type system.
**Fix:** Validate `sourceFormat` against a known input set in `useOptimize`/`useLiveEncode` before dispatch and skip with a specific toast, mirroring the `KNOWN_CODECS` guard in the worker.

### WR-04: `maybeResize` ignores `fit: 'cover'` and coerces non-numeric width to NaN

**File:** `src/workers/codec.worker.ts:54-68`, `src/components/panels/inspector/CodecPanel.tsx:278`
**Issue:** `FIT_MODES` is `['cover','contain','fill']` (stub-data.ts:147) and the Fit SegControl offers all three, but `maybeResize` maps only `contain` → `'contain'` and everything else → `'stretch'`. Selecting `cover` silently produces a stretched image — wrong output. Separately, `settings.w` is a free-text `<Input>` (CodecPanel:262); `Number(settings.w)` on `''` or `'abc'` yields `NaN`, and `resize({ width: NaN, ... })` will throw or produce garbage. There is no numeric validation.
**Fix:** Map `cover` explicitly (jSquash resize has no native cover; compute crop or document the limitation). Guard `const width = Number(settings.w); if (!Number.isFinite(width) || width <= 0) return imageData;`.

### WR-05: OxiPNG `level` derived from `method` with no clamp; AVIF speed math can exceed range

**File:** `src/workers/codec.worker.ts:84`, `137`
**Issue:** PNG: `const level = (job.settings.method as number) ?? 2`. The Effort slider is 0–6 (CodecPanel:215) and OxiPNG levels are 0–6, so values align, but `as number` defeats type-checking and `?? 2` only catches `null`/`undefined`, not an out-of-range or `NaN` `method`. AVIF: `speed: Math.max(0, 6 - (job.settings.method ?? 4))` — if `method` is 0, speed is 6 (valid), but there is no upper clamp; a corrupted `method` of -1 yields speed 7, outside the documented 0–10/0–6 range depending on build, risking an encoder error.
**Fix:** Clamp both: `const level = Math.min(6, Math.max(0, Number(job.settings.method) || 2))` and `speed: Math.min(10, Math.max(0, 6 - (Number(job.settings.method) || 4)))`.

### WR-06: CompareStage object-URL effect leaks on rapid rawBuffer/encodedBuffer churn under live-encode

**File:** `src/components/panels/center/CompareStage.tsx:71-80`
**Issue:** The encoded-layer effect creates a fresh `URL.createObjectURL` whenever `selectedFile?.encodedBuffer` changes (identity). useLiveEncode writes a **new** `encodedBuffer` on every debounced re-encode while a file stays selected, so the effect re-runs and the cleanup revokes the prior URL — correct in steady state. However, `setFileResult` rebuilds the entry object (new identity) on every store write including unrelated fields (e.g. `setFileError` clearing), so the dependency `selectedFile?.encodedBuffer` may be a referentially-new-but-byte-identical buffer only when a real re-encode happened; that part is fine. The real leak: if the component unmounts mid-encode (user navigates away), the in-flight `setFileResult` still fires and creates no URL (component gone), but any URL created in the last render before unmount is revoked by cleanup — acceptable. The genuine risk is the `<img>` `onError` is unhandled: a decode-failed encodedBuffer (e.g. AVIF on Safari fallback returning original bytes of a different format) renders a broken image with no fallback.
**Fix:** Add `onError` handlers on both `<img>` to fall back to the placeholder div, so a format-mismatched fallback buffer does not render broken.

## Info

### IN-01: Unused imports in components

**File:** `src/components/panels/inspector/CodecPanel.tsx:2`, `src/components/panels/InspectorPane.tsx:4`
**Issue:** CodecPanel imports `useStore` and `filesAtom` but only `$selectedFile`/`settingsAtom` are consumed via `useStore`; `filesAtom` import is unused. InspectorPane imports `filesAtom` and uses it for `entries` — that one is used. Verify and drop the unused `filesAtom` import in CodecPanel.
**Fix:** Remove the unused import to keep the module surface clean.

### IN-02: Hardcoded placeholder metric values in DeltaStrip

**File:** `src/components/panels/center/DeltaStrip.tsx:96-109`
**Issue:** SSIM `0.987`, BUTTERAUGLI `1.24`, DECODE `38ms` are hardcoded literals presented as if measured. For a tool whose value prop is honest optimization metrics, static fake numbers are misleading even in a "visual" card.
**Fix:** Mark these as placeholders (e.g. `—` until real metrics land) or compute them; do not display fabricated quality numbers.

### IN-03: `codecVersion`/`wasmInfo` in runtime store are stale hardcoded strings

**File:** `src/stores/runtime.ts:28-30`
**Issue:** `codecVersion: '0.6.0'`, `wasmInfo: 'WASM ready · 312 KB'` are fixed strings unrelated to the actual jSquash package versions or loaded WASM size. They will drift and mislead.
**Fix:** Derive from package metadata at build time or remove from the displayed surface.

### IN-04: Test relies on WebP q90 > q10 byte-length ordering for a 1×1 image

**File:** `src/tests/codec-encoders.spec.ts:170-204`
**Issue:** ENC-06 asserts `highByteLength > lowByteLength` for a 1×1 PNG re-encoded to WebP at q90 vs q10. For a single-pixel image the WebP container overhead dominates and quality may not produce a strictly larger output, making this assertion flaky/fixture-dependent.
**Fix:** Use a larger fixture (e.g. 64×64 noise) where quality measurably changes size, or assert `>=` with a tolerance comment.

---

_Reviewed: 2026-05-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
