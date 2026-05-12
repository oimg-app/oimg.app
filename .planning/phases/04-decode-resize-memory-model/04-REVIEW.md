---
phase: 04-decode-resize-memory-model
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/App.tsx
  - src/components/file-row/ContextMenu.tsx
  - src/components/file-row/SourceDensityControl.tsx
  - src/components/file-row/TargetDensityCheckboxes.tsx
  - src/components/panels/InspectorPane.tsx
  - src/components/panels/TweaksPanel.tsx
  - src/components/shell/BackpressureIndicator.tsx
  - src/components/shell/StatusBar/StatusBar.tsx
  - src/data/defaults.ts
  - src/lib/filename.ts
  - src/lib/memory-budget.ts
  - src/lib/sniff.ts
  - src/stores/files.ts
  - src/stores/runtime.ts
  - src/stores/settings.ts
  - src/types/index.ts
  - src/workers/png-adapter.ts
  - src/workers/png-config.ts
  - src/workers/pool.ts
  - src/workers/svg-adapter.ts
  - src/workers/worker.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 04 adds: PNG decode/resize adapter, memory admission gate, store fan-out for density variants, UI wiring for density checkboxes, and InspectorPane useShallow fix. The core pipeline logic is structurally sound and the admitted-gate deadlock prevention (never blocking when inflightBytes === 0) is correctly implemented. However, three BLOCKER-level defects were found: an integer-overflow risk in the memory budget formula, a use-after-transfer crash in the PNG adapter, and a silent admission gate bypass for jobs where byteEstimate is 0 rather than undefined. Six warnings cover logic holes in pool callbacks, ICC flag disconnection, and stale UI state.

---

## Critical Issues

### CR-01: Integer overflow in `computeMemoryBudget` — rawMb multiplied before capping

**File:** `src/lib/memory-budget.ts:17`
**Issue:** `rawMb` is already in megabytes (`0.75 * dm * 1024`), then multiplied by `1024 * 1024` — a double `* 1024` factor. For a `deviceMemory = 8` device: `rawMb = 0.75 * 8 * 1024 = 6144` (MB, not bytes). Then `6144 * 1024 * 1024 = 6,442,450,944` bytes (~6 GB). The `MAX_BUDGET_BYTES` cap of `600 * 1024 * 1024` (600 MB) saves this specific case, but any device returning `deviceMemory ≤ 0.78` produces a budget under 800 MB that passes the cap yet was computed via a broken formula. More critically, the formula is just wrong and will silently return values that are not what the comment describes as intent ("0.75 × deviceMemory GB").

**Fix:** Correct the unit conversion — `rawMb` should be megabytes, then convert to bytes by multiplying by `1024 * 1024` once:
```typescript
export function computeMemoryBudget(): number {
  const dm = (typeof navigator !== 'undefined'
    ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
    : undefined) ?? 4
  // 0.75 × deviceMemory (GB) → bytes
  const rawBytes = 0.75 * dm * 1024 * 1024 * 1024
  return Math.min(rawBytes, MAX_BUDGET_BYTES)
}
```

---

### CR-02: Use-after-transfer: `input` ArrayBuffer read after `Comlink.transfer` detaches it

**File:** `src/workers/pool.ts:240-246`
**Issue:** Inside `runOnSlot`, `input` is obtained via `await job.blob.arrayBuffer()` and then transferred to the worker via `Comlink.transfer(input, [input])`. After this Comlink call, `input` is detached on the main thread (zero-copy semantics; `input.byteLength === 0`). However, the `signal.addEventListener` abort path inside the `Promise.race` second branch captures `input` in the same scope and may continue running while `input` is detached. This is not the primary hazard — the real issue is that if `signal.aborted` is already true before the `Comlink.transfer` line executes, the abort-rejection Promise wins the race, but `proxy.runJob(Comlink.transfer(input, [input]), ...)` has already been called, detaching `input`. The proxy call fires regardless (it is not guarded by the race). So `input` is always transferred even when the abort wins, which is correct for zerco-copy but means the abort branch has already paid the serialization cost. The actual bug: **after `Comlink.transfer` the `input` reference inside the abort-rejection closure is a detached buffer**. If any path later reads `input.byteLength` (e.g., future telemetry code) it will silently return 0.

More concretely: the abort signal check should happen **before** `blob.arrayBuffer()` to avoid doing useless work when the slot was already cancelled.

**Fix:** Guard on `signal.aborted` before reading the blob:
```typescript
private async runOnSlot(slot: number, job: PendingJob): Promise<void> {
  const slotRef = this.slots[slot]
  if (!slotRef) return
  const generation = this.generation
  const signal = this.abortController!.signal
  // Early-exit: if already aborted before we even read the blob, skip all work.
  if (signal.aborted) {
    if (!job.settled) {
      job.settled = true
      job.reject(new DOMException('Batch cancelled', 'AbortError'))
      this.callbacks.onError?.(job.id, new DOMException('Batch cancelled', 'AbortError'))
    }
    return
  }
  try {
    const input = await job.blob.arrayBuffer()
    // ... rest unchanged
  }
}
```

---

### CR-03: Admission gate bypassed when `byteEstimate` is `0` (not `undefined`)

**File:** `src/workers/pool.ts:213`
**Issue:** The gate condition is:
```typescript
if (this.inflightBytes > 0 && this.inflightBytes + estimate > this.memoryBudgetBytes)
```
where `estimate = head.byteEstimate ?? 0`. A job with `byteEstimate: 0` (explicitly set to zero, distinct from `undefined`) passes the gate unconditionally because `estimate = 0` and the `inflightBytes + 0 > budget` check never fires. The non-PNG fallback in `files.ts:227` sets:
```typescript
byteEstimate = Math.ceil(args.sourceBlob.size * 10 * 4 * 1.75)
```
This will never produce 0 for non-empty blobs. However, if a caller passes a 0-byte blob, or if future code sets `byteEstimate: 0` explicitly to mean "unknown", the gate silently lets it through with no accounting. The `inflightBytes` counter then adds 0, so multiple such jobs never trigger throttling even if they each allocate meaningful memory. This is a correctness gap when the meaning of `0` and `undefined` diverges in caller code.

**Fix:** Change the fallthrough value from `0` to a small positive sentinel, or document clearly that `0` means "admit unconditionally" and ensure callers who want that behavior explicitly pass `undefined`:
```typescript
// In tryDispatch:
const estimate = head.byteEstimate ?? 0  // undefined → treat as 0, no gate
// Only apply the gate if estimate > 0 (callers that set byteEstimate: 0
// explicitly are opting into the same "no gate" behaviour as undefined).
```
At minimum, add a comment making the `0 === no gate` contract explicit so future callers do not accidentally disable admission control.

---

## Warnings

### WR-01: `getWorkerPool` singleton ignores `callbacks` argument after first call

**File:** `src/workers/pool.ts:296-299`
**Issue:**
```typescript
export function getWorkerPool(callbacks?: PoolCallbacks): WorkerPool {
  if (!_pool) _pool = new WorkerPool(callbacks)
  return _pool
}
```
On every call after the first, `callbacks` is silently ignored. If `enqueuePreview` in `runtime.ts` (line 267) calls `getWorkerPool()` without callbacks and App.tsx previously registered `onDone`/`onError`/`onThrottle` callbacks, this is fine. But if App.tsx calls `getWorkerPool(callbacks)` first and then `runtime.ts` calls `getWorkerPool()`, the existing pool has the correct callbacks. However if the call order is reversed, the pool is created without callbacks and App.tsx's registration never fires. There is no test for call ordering, and `runtime.ts:267` calls `getWorkerPool()` with no callbacks. If this module initializes first, the pool is created callback-less.

**Fix:** Either assert that `callbacks` are always provided on the first call (throw if `!_pool && !callbacks`) or convert to an explicit `setCallbacks` method on the pool, or move the singleton creation to a single deterministic site (App.tsx or an init function).

---

### WR-02: `cancelByPrefix` fires `onError` for in-flight preview jobs even though the worker keeps running

**File:** `src/workers/pool.ts:120-127`
**Issue:** When `cancelByPrefix('preview-')` marks an in-flight job settled and rejects its promise + fires `onError`, the App.tsx `onError` callback calls `useRuntimeStore.getState().markError(jobId, error.message)`. The `markError` handler checks `if (!s.inFlight.has(jobId)) return {}` — but `preview-*` jobs are not in `useRuntimeStore.inFlight` because only batch jobs go through `startBatch`/`markStarted`. So `markError` silently no-ops, which is safe here, but the `onError` callback is still fired unnecessarily. More importantly, `cancelByPrefix` does not decrement `this.inflightBytes` for the in-flight job it marks as settled. The worker finishes and `runOnSlot`'s `finally` block decrements via `this.inflightBytes -= job.byteEstimate ?? 0`, which is correct. No double-accounting occurs. However, if `runOnSlot`'s `finally` runs after a subsequent `cancel()` bumped the generation, the `generation !== this.generation` guard returns early — and `inflightBytes` is **not** decremented. The stale bytes remain in the counter until the next `cancel()` resets it to 0. This means throttling can activate prematurely after a `cancelByPrefix` followed by a new batch that happens to increment the generation.

**Fix:** In `cancelByPrefix`, track and subtract the `byteEstimate` of cancelled in-flight jobs from `this.inflightBytes`:
```typescript
for (const job of this.inFlight.values()) {
  if (!job.id.startsWith(prefix)) continue
  if (!job.settled) {
    job.settled = true
    this.inflightBytes -= job.byteEstimate ?? 0  // release budget
    job.reject(error)
    this.callbacks.onError?.(job.id, error)
  }
}
```

---

### WR-03: `TweaksPrivacySection` "Preserve ICC" global toggle is disconnected from the per-file `preserveIcc` flag that the PNG adapter actually reads

**File:** `src/components/panels/TweaksPanel.tsx:107-109`
**Issue:** `TweaksPrivacySection` writes to `useSettingsStore.global.preserveIccProfile`. `buildPngResizeSettings` in `png-config.ts:41` reads `args.globalPreserveIcc`. App.tsx (via `useBatchOrchestrate`) must thread `useSettingsStore.getState().global.preserveIccProfile` into the `globalPreserveIcc` argument of `buildPngResizeSettings`. If this wiring is missing or reads `false` as a hardcoded default, the global toggle is cosmetic. The UI-SPEC helper text states "Wired but inactive in this version" — but the `PngPanel` in `InspectorPane.tsx:131` has a dedicated `preserveIcc` prop that writes to `FileEntry.preserveIcc` via `setPreserveIcc`. That per-file flag IS wired into `buildPngResizeSettings` via `filePreserveIcc`. The two ICC surfaces (global toggle vs per-file toggle) use different store locations and it is unclear which one `useBatchOrchestrate` reads. If it reads only the per-file flag (which starts `undefined` → `false` by default), the global toggle has zero effect.

**Fix:** Verify `useBatchOrchestrate` reads `useSettingsStore.getState().global.preserveIccProfile` for the `globalPreserveIcc` parameter, and confirm per-file `FileEntry.preserveIcc` for the `filePreserveIcc` override. Add a failing test that sets the global toggle and verifies the adapter receives `preserveIcc: true`.

---

### WR-04: `InspectorPane` defines `CodecTabContent` as a nested function component — hooks rules violation risk

**File:** `src/components/panels/InspectorPane.tsx:109`
**Issue:** `CodecTabContent` is declared as a function inside the `InspectorPane` render body. React requires that hooks are called in the same order on every render. `CodecTabContent` itself does not call hooks, but it closes over `resolvedPng`, `resolvedJpeg`, `resolvedWebp`, `resolvedAvif`, `svgoPluginRows`, etc., which are computed by hooks in the parent. Every render of `InspectorPane` creates a **new** `CodecTabContent` function identity. React sees this as a new component type on each render, causing it to unmount and remount the child on every parent re-render. This destroys local state in any child panels (e.g., slider focus state), and if those panels ever use `useEffect` with cleanup, the cleanup fires unnecessarily on every parent update.

**Fix:** Extract `CodecTabContent` outside `InspectorPane` and pass the required values as props, or at minimum wrap it in `useCallback` (though `useCallback` for a component definition is unconventional — extraction is the right fix).

---

### WR-05: `TargetDensityCheckboxes.onToggle` is a documented no-op but does not prevent the locked-variant check from being misleading

**File:** `src/components/file-row/TargetDensityCheckboxes.tsx:108-113`
**Issue:** The `onToggle` function body is empty. The UI renders buttons with `role="checkbox"` and `aria-checked` that visually appear interactive for non-locked densities. Clicking a non-locked, non-checked density fires `onToggle` which does nothing. From a user perspective the checkbox appears to toggle (visual feedback depends on CSS class toggling, which relies on `targetSet.has(d)`) but the underlying state does not change. Since `targetSet` is derived from `family[].targetDensity` and `onToggle` does not mutate the store, the checkbox immediately snaps back on next render. This is a silent correctness gap: the UI promises an interaction that has no effect and no error feedback.

**Fix:** Either disable non-locked buttons that represent densities NOT yet materialized (by setting `disabled` and a tooltip "Available in Phase 5"), or implement the no-op explicitly in a way that prevents the click event from appearing to do anything (e.g., `pointer-events: none` or visual disabled state). The current state risks user confusion.

---

### WR-06: `addSourceWithVariants` reads `useFilesStore.getState().byId` for existing names outside the `set()` call — TOCTOU race

**File:** `src/stores/files.ts:198-200`
**Issue:**
```typescript
const existingNames = new Set<string>(
  Object.values(useFilesStore.getState().byId).map((e) => e.name),
)
```
This snapshot is taken before the `set()` call that atomically inserts new entries. In concurrent drops (multiple files dropped simultaneously in separate micro-tasks), two calls to `addSourceWithVariants` may both read the same `byId` snapshot, compute the same `proposedName`, deduplicate against the same `existingNames` set, and both produce `finalName = "logo@1x.png"`. The atomic `set()` at line 249 uses a `if (!nextById[entry.id]) nextOrder.push(entry.id)` guard on ID collisions, but ID collisions are impossible (each call gets a fresh `sourceUuid`). The **name** collision is not guarded in the `set()` call — two concurrently-dropped files with the same source name will both end up with the same `name` in `byId`, violating D-16's uniqueness guarantee.

**Fix:** Move the `existingNames` snapshot inside the `set()` callback so it reads the latest `s.byId` state atomically:
```typescript
set((s) => {
  const existingNames = new Set<string>(Object.values(s.byId).map((e) => e.name))
  // rebuild newEntries inside set() using s as source of truth
  ...
})
```
Note: this requires restructuring `addSourceWithVariants` since the async `sniffPngDimensions` call must happen before `set()`. The sniff can still be outside; only the name-dedup pass should be moved inside.

---

## Info

### IN-01: `StatusBar` worker count is hardcoded to `"5 workers"` — should reflect `POOL_SIZE`

**File:** `src/components/shell/StatusBar/StatusBar.tsx:35`
**Issue:** The string `"5 workers running"` / `"5 workers idle"` is hardcoded. `POOL_SIZE` from `runtime.ts` is `Math.min(navigator.hardwareConcurrency || 2, 4)`, which is at most 4. On a 2-core machine it would be 2. The hardcoded `5` is always wrong.
**Fix:** Pass `poolSize` from `useRuntimeStore((s) => s.poolSize)` as a prop or read it in `StatusBar`.

---

### IN-02: `ContextMenu` accepts `file: { id, name }` prop but ignores it entirely (`_` parameter)

**File:** `src/components/file-row/ContextMenu.tsx:19`
**Issue:** The prop is destructured as `_: ContextMenuProps`. All menu items are no-ops (no `onClick` handlers). This is dead code / incomplete wiring.
**Fix:** Wire the `file.id` into "Re-optimize", "Save as…", "Copy data URI", and "Remove from queue" actions, or add TODO markers.

---

### IN-03: `deduplicateName` loop ceiling of 1000 + UUID fallback is unreachable in practice but the UUID fallback truncates to 8 hex chars — collision possible

**File:** `src/lib/filename.ts:31`
**Issue:** `crypto.randomUUID().slice(0, 8)` produces an 8-character hex prefix with ~4 billion possibilities. For the typical use case this is fine. But the function is pure and used inside `addSourceWithVariants` which has no retry mechanism. If by extreme bad luck two concurrent drops produce the same 8-char prefix for their respective 1001st collision, they get the same fallback name. This is cosmetically a defect (wrong name) but not data corruption.
**Fix:** Use the full UUID (36 chars) in the fallback rather than slicing to 8.

---

### IN-04: `memory-budget.ts` formula comment says "0.75 × deviceMemory" but the variable name `rawMb` implies megabytes while the value is gigabytes × 0.75 × 1024

**File:** `src/lib/memory-budget.ts:16`
**Issue:** `rawMb` is named to imply the value is in megabytes, but `0.75 * dm * 1024` for `dm=4` gives `3072` — which is 3072 MB = 3 GB, not a meaningful megabyte value. The name is misleading and caused the double-multiply bug in CR-01.
**Fix:** Rename to `rawBytes` and fix the formula per CR-01. Good naming would have prevented the overflow.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
