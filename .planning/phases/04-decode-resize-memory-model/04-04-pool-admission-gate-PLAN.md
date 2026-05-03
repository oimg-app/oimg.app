---
phase: 04
plan: 04
type: execute
wave: 2
depends_on: ["04-01", "04-02"]
files_modified:
  - src/workers/types.ts
  - src/workers/pool.ts
  - src/stores/runtime.ts
autonomous: true
requirements: [PIPE-04, OPT-06]
must_haves:
  truths:
    - "PoolJob carries optional byteEstimate field (D-11.b admission-gate input)"
    - "PoolCallbacks gains onThrottle (D-13 first-throttle hook)"
    - "WorkerPool tracks inflightBytes; tryDispatch holds queue when inflightBytes plus head estimate exceeds budget"
    - "Single-file deadlock prevention: when inflightBytes equals 0, ANY job is admitted alone"
    - "On job settle, inflightBytes decreases by job.byteEstimate then tryDispatch resumes"
    - "On cancel and terminate, inflightBytes resets to 0"
    - "useRuntimeStore gains inflightBytes, throttleActive, throttleToastFiredThisBatch, renameCountThisBatch fields (D-13, D-16)"
    - "startBatch resets all four batch-scoped flags"
    - "cancelBatch resets all four batch-scoped flags"
    - "New runtime actions: markThrottle, setThrottleActive, markRename"
  artifacts:
    - path: "src/workers/types.ts"
      provides: "PoolJob.byteEstimate optional field"
      contains: "byteEstimate"
    - path: "src/workers/pool.ts"
      provides: "Byte-aware admission gate + inflightBytes accounting + onThrottle"
      contains: "inflightBytes"
    - path: "src/stores/runtime.ts"
      provides: "Throttle + rename batch-scoped state and actions"
      contains: "throttleActive"
  key_links:
    - from: "src/workers/pool.ts"
      to: "src/lib/memory-budget.ts"
      via: "computeMemoryBudget at construction"
      pattern: "computeMemoryBudget"
    - from: "src/workers/pool.ts onThrottle"
      to: "src/stores/runtime.ts markThrottle"
      via: "App.tsx pool callback wiring (Plan 04-06)"
      pattern: "markThrottle"
---

<objective>
Layer a byte-aware admission gate onto the existing WorkerPool so a 50-file batch stays under SC-2 800 MB. Extend PoolJob with optional byteEstimate, extend PoolCallbacks with onThrottle, track inflightBytes aggregate, hold the FIFO queue when inflightBytes plus head estimate exceeds budget. Mirror per-batch state in useRuntimeStore (throttle latches plus rename counter for D-16) so Plan 04-05 (addFile fan-out) and Plan 04-06 (UI wiring) can read them without re-implementing bookkeeping.

Purpose: This is the SC-2 mitigation surface (T-04-MEM threat). The gate is intrinsic to dispatch — it MUST live in the pool, not in the runtime store, per RESEARCH §Architectural Responsibility Map. The runtime store is the read-side telemetry surface (StatusBar selectors + first-throttle toast latch).

Output: 1 type field added, 1 callback added, 1 admission-gate clause inserted in tryDispatch, 1 byte-release line in runOnSlot finally, 4 new runtime-store fields + 3 new actions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md
@.planning/phases/04-decode-resize-memory-model/04-RESEARCH.md
@.planning/phases/04-decode-resize-memory-model/04-PATTERNS.md
@src/workers/pool.ts
@src/workers/types.ts
@src/stores/runtime.ts
@src/lib/memory-budget.ts

<interfaces>
Existing PoolJob (src/workers/types.ts lines 36-42):

```typescript
export interface PoolJob {
  id: string
  fileId: string
  format: AdapterFormat
  settings: unknown
  blob: Blob
}
```

Existing PoolCallbacks (src/workers/pool.ts lines 36-43):

```typescript
export interface PoolCallbacks {
  onStarted?: (jobId: string) => void
  onDone?: (jobId: string, result: AdapterRunResult) => void
  onError?: (jobId: string, error: unknown) => void
}
```

Existing tryDispatch (src/workers/pool.ts lines 192-201) — admission gate inserts INSIDE the while loop, BEFORE the slot/job shift:

```typescript
private tryDispatch(): void {
  while (this.idle.length > 0 && this.queue.length > 0) {
    const slot = this.idle.shift()!
    const job = this.queue.shift()!
    this.inFlight.set(slot, job)
    this.callbacks.onStarted?.(job.id)
    void this.runOnSlot(slot, job)
  }
}
```

Existing runOnSlot finally (lines 250-261): byte-release inserts before tryDispatch on the idle return path.

Existing cancel + terminate (lines 121-173): must reset inflightBytes to 0 alongside the existing inFlight.clear() call.

Existing RuntimeState (src/stores/runtime.ts lines 28-43): add four fields and three actions; reset patterns mirror the existing `previewJobId` slot (line 41) and Phase 3 batch-scoped flags.

Memory budget interface (Plan 04-02 — already shipped):

```typescript
// src/lib/memory-budget.ts
export function computeMemoryBudget(): number  // returns bytes
export function estimateJobBytes(srcW: number, srcH: number, tgtW: number, tgtH: number): number
```

Auxiliary-job exclusion: byteEstimate is OPTIONAL. SVG and stub jobs leave it undefined; gate becomes a no-op (head estimate is 0). Auxiliary preview/savings jobs (cancelByPrefix, line 92) similarly omit byteEstimate.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend PoolJob plus PoolCallbacks; add admission gate to WorkerPool.tryDispatch</name>
  <read_first>
    - src/workers/types.ts (PoolJob at lines 36-42)
    - src/workers/pool.ts (full file — focus tryDispatch lines 192-201, runOnSlot finally lines 250-261, cancel lines 121-157, terminate lines 159-173)
    - src/lib/memory-budget.ts (Plan 04-02 — computeMemoryBudget signature)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 196-260 — verbatim pool extension)
    - .planning/phases/04-decode-resize-memory-model/04-RESEARCH.md (lines 319-348 — admission-gate algorithm + deadlock-prevention precondition)
  </read_first>
  <files>src/workers/types.ts, src/workers/pool.ts</files>
  <behavior>
    - Two PoolJob instances enqueued back-to-back with byteEstimate of 400 MB each, with budget 600 MB → first dispatches; second is held until first settles. After first settles, second dispatches.
    - One PoolJob with byteEstimate of 800 MB (over budget) on an empty pool dispatches alone (deadlock prevention triggers because inflightBytes is 0 on the precondition check).
    - When the gate holds the queue, callbacks.onThrottle fires once per tryDispatch call that returns early — consumer of the callback latches first-throttle-per-batch on its own end.
    - Existing SVG and stub jobs (no byteEstimate) continue to dispatch immediately as before — no regression.
    - On cancel(), inflightBytes resets to 0 BEFORE spawnAll() rebuilds the pool.
    - On terminate(), inflightBytes resets to 0.
    - runOnSlot finally block decrements inflightBytes by the job's byteEstimate fallback-to-zero BEFORE calling tryDispatch().
  </behavior>
  <action>
1. Edit src/workers/types.ts — extend PoolJob interface (lines 36-42) by appending the optional field after `blob`:

```typescript
export interface PoolJob {
  id: string
  fileId: string
  format: AdapterFormat
  settings: unknown
  blob: Blob
  /** Phase 4 D-11(b) — admission-gate input. Estimated peak working-set
   *  bytes for this job. SVG / stub jobs leave undefined → gate no-ops.
   *  PNG variant jobs populate via estimateJobBytes(srcW,srcH,tgtW,tgtH)
   *  from src/lib/memory-budget.ts (Plan 04-05 wires call site). */
  byteEstimate?: number
}
```

2. Edit src/workers/pool.ts — six surgical changes:

(a) Add the import at the top of the imports block (after existing comlink + types imports):
```typescript
import { computeMemoryBudget } from '../lib/memory-budget'
```

(b) Extend PoolCallbacks interface (lines 36-43) by appending onThrottle:
```typescript
export interface PoolCallbacks {
  onStarted?: (jobId: string) => void
  onDone?: (jobId: string, result: AdapterRunResult) => void
  onError?: (jobId: string, error: unknown) => void
  /** Phase 4 D-13 — admission gate held the queue. Fires once per
   *  tryDispatch call that returns early due to the byte cap. Consumer
   *  (App.tsx) latches first-throttle-per-batch on its own side. */
  onThrottle?: () => void
}
```

(c) Add two private fields inside the WorkerPool class, placed AFTER the existing `private generation = 0` line (around line 57):
```typescript
  // Phase 4 D-11(b) — sum of byteEstimates across in-flight jobs.
  private inflightBytes = 0
  // Phase 4 D-12 — fixed at construction time. Memory budget is device-static
  // for the session; recomputing on every dispatch would add cost without
  // benefit (deviceMemory does not change across a tab's lifetime).
  private memoryBudgetBytes = computeMemoryBudget()
```

(d) Replace tryDispatch (existing lines 192-201) with the byte-aware version. Keep all existing semantics; INSERT the gate clause INSIDE the while loop:
```typescript
private tryDispatch(): void {
  while (this.idle.length > 0 && this.queue.length > 0) {
    const head = this.queue[0]
    const estimate = head.byteEstimate ?? 0
    // Phase 4 D-11(b) admission gate. Hold the queue if pulling head would
    // push inflightBytes past the budget. NEVER deadlock: when nothing is
    // in-flight, any job goes through alone — degraded but functional
    // (RESEARCH §2.3 deadlock-prevention precondition).
    if (this.inflightBytes > 0 && this.inflightBytes + estimate > this.memoryBudgetBytes) {
      this.callbacks.onThrottle?.()
      return
    }
    const slot = this.idle.shift()!
    const job = this.queue.shift()!
    this.inflightBytes += estimate
    this.inFlight.set(slot, job)
    this.callbacks.onStarted?.(job.id)
    void this.runOnSlot(slot, job)
  }
}
```

(e) Edit runOnSlot finally block (existing lines 250-261). Add the byte-release line BEFORE the tryDispatch call. The full block:
```typescript
} finally {
  if (generation !== this.generation) return
  this.inFlight.delete(slot)
  // Phase 4 D-11(b) — release the job's byte estimate so subsequent
  // queued jobs become admissible. Must happen BEFORE tryDispatch().
  this.inflightBytes -= job.byteEstimate ?? 0
  if (this.slots[slot]) {
    this.idle.push(slot)
    this.tryDispatch()
  }
}
```

(f) Add `this.inflightBytes = 0` resets to BOTH cancel() and terminate(). In cancel() (around line 149-153 where `this.queue = []; this.inFlight.clear(); ...` runs), insert as a sibling reset:
```typescript
this.queue = []
this.inFlight.clear()
this.inflightBytes = 0           // Phase 4 D-11(b) — reset gate accounting on cancel
this.slots = []
this.idle = []
this.spawned = false
this.abortController = null
```
In terminate() (around lines 161-173), add right before `this.spawned = false`:
```typescript
this.queue = []
this.inFlight.clear()
this.inflightBytes = 0           // Phase 4 D-11(b) — reset gate accounting on terminate
this.spawned = false
```
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build 2&gt;&amp;1 | tail -3 | grep -E "(error|built)"</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `grep -c "byteEstimate" src/workers/types.ts` returns at least 1.
    - `grep -c "onThrottle" src/workers/pool.ts` returns at least 3 (interface decl, gate trigger, possibly comments).
    - `grep -c "this.inflightBytes" src/workers/pool.ts` returns at least 5 (declaration, gate-precondition, gate-add, finally-decrement, cancel-reset, terminate-reset).
    - `grep -c "computeMemoryBudget" src/workers/pool.ts` returns at least 1.
    - `npm run build` exits 0.
    - Visual check: `grep -A 1 "if (this.inflightBytes" src/workers/pool.ts` shows the deadlock-prevention precondition (inflightBytes greater than 0 AND inflightBytes plus estimate greater than budget).
  </acceptance_criteria>
  <done>PoolJob carries byteEstimate; PoolCallbacks carries onThrottle; tryDispatch enforces the byte gate with deadlock prevention; runOnSlot releases bytes; cancel and terminate reset accounting; production build succeeds.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend useRuntimeStore with throttle and rename batch-scoped state</name>
  <read_first>
    - src/stores/runtime.ts (full file — RuntimeState interface lines 28-59, startBatch lines 89-97, cancelBatch lines 157-163, previewJobId pattern at line 41)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 427-484 — verbatim runtime extensions, including the toast wiring example)
    - .planning/phases/04-decode-resize-memory-model/04-CONTEXT.md (D-13 first-throttle latch, D-16 collision-rename count)
    - .planning/phases/04-decode-resize-memory-model/04-UI-SPEC.md (Surface 6, 7, 8 — backpressure pill + toast lifecycle)
  </read_first>
  <files>src/stores/runtime.ts</files>
  <behavior>
    - State seeds: `inflightBytes: 0`, `throttleActive: false`, `throttleToastFiredThisBatch: false`, `renameCountThisBatch: 0`.
    - `startBatch([...])` resets `throttleActive: false`, `throttleToastFiredThisBatch: false`, `renameCountThisBatch: 0`. Does NOT reset `inflightBytes` (that field is pool-driven; the pool resets on cancel/terminate, see Task 1).
    - `cancelBatch()` resets all four flags including `inflightBytes: 0`.
    - `markThrottle()` sets `throttleActive: true`. If `throttleToastFiredThisBatch` is false, it sets to true (caller in App.tsx Plan 04-06 will then fire toast.info exactly once because of this latch). Idempotent for repeat calls.
    - `setThrottleActive(false)` clears the active flag without touching the toast latch (used at batch end by App.tsx).
    - `markRename(count)` adds `count` to `renameCountThisBatch`. addFile fan-out (Plan 04-05) calls this once per addSourceWithVariants invocation; the toast in App.tsx (Plan 04-06) reads the count post-call and fires `toast.info("{N} files renamed to avoid collisions")` exactly once when count goes from 0 to a positive value.
  </behavior>
  <action>
1. Open src/stores/runtime.ts. Locate the existing `RuntimeState` interface (lines 28-59). Append four fields AFTER `previewJobId: string | null` (line 41) and BEFORE the action declarations:

```typescript
  // Phase 4 D-11(b) — pool-driven aggregate of in-flight job byte estimates.
  // Surfaced for StatusBar selectors and tests. Pool writes via setInflightBytes
  // (omitted in P4 — pool tracks internally; this slot mirrors for telemetry only,
  // updated lazily via the next runtime action). For now keep at 0 unless a future
  // plan wants live readout. Pool's own state is the source of truth.
  inflightBytes: number
  // Phase 4 D-13 — first-throttle toast latch. Flips true on first markThrottle()
  // per batch; reset by startBatch + cancelBatch.
  throttleToastFiredThisBatch: boolean
  // Phase 4 D-13 — persistent indicator. True when pool is throttling new
  // dispatches. StatusBar BackpressureIndicator subscribes.
  throttleActive: boolean
  // Phase 4 D-16 — per-batch collision counter. Reset by startBatch + cancelBatch.
  // addFile fan-out increments via markRename(count).
  renameCountThisBatch: number
```

2. In the same `RuntimeState` interface, append THREE new actions after the existing `enqueuePreview` declaration (line 58):

```typescript
  // Phase 4 D-13 — pool calls this from the onThrottle callback. Sets
  // throttleActive=true and latches throttleToastFiredThisBatch=true on
  // first call per batch. Idempotent.
  markThrottle: () => void
  // Phase 4 D-13 — App.tsx flips false at batch end (when running goes false).
  setThrottleActive: (v: boolean) => void
  // Phase 4 D-16 — addFile fan-out (Plan 04-05) increments per
  // addSourceWithVariants invocation that produced collisions.
  markRename: (count: number) => void
```

3. In the `create` body, add seeds for the four new fields right after the existing `previewJobId: null,` line (line 87):
```typescript
inflightBytes: 0,
throttleToastFiredThisBatch: false,
throttleActive: false,
renameCountThisBatch: 0,
```

4. Modify the existing `startBatch` action (lines 89-97). Append the three batch-scoped resets to the set() payload — do NOT reset inflightBytes here (pool owns it). The full action becomes:
```typescript
startBatch: (jobIds) =>
  set({
    running: jobIds.length > 0,
    queue: [...jobIds],
    inFlight: new Set<string>(),
    totalJobs: jobIds.length,
    doneCount: 0,
    errorCount: 0,
    // Phase 4 — reset per-batch flags. inflightBytes is pool-driven; pool
    // resets it on cancel/terminate; we do NOT clobber here.
    throttleToastFiredThisBatch: false,
    throttleActive: false,
    renameCountThisBatch: 0,
  }),
```

5. Modify the existing `cancelBatch` action (lines 157-163). Append all four resets including `inflightBytes`:
```typescript
cancelBatch: () =>
  set({
    running: false,
    queue: [],
    inFlight: new Set<string>(),
    // Phase 4 — clear all batch-scoped flags on cancel.
    inflightBytes: 0,
    throttleToastFiredThisBatch: false,
    throttleActive: false,
    renameCountThisBatch: 0,
    // doneCount, errorCount, totalJobs preserved for post-cancel UI.
  }),
```

6. After the existing `revokeObjectURL` action (around lines 175-182), add the three new action implementations BEFORE the `enqueuePreview` action (line 203):
```typescript
markThrottle: () => {
  // Idempotent: latches throttleToastFiredThisBatch on first call.
  set((s) => {
    if (s.throttleActive && s.throttleToastFiredThisBatch) return {}
    return {
      throttleActive: true,
      throttleToastFiredThisBatch: true,
    }
  })
},

setThrottleActive: (v) => set({ throttleActive: v }),

markRename: (count) =>
  set((s) => ({ renameCountThisBatch: s.renameCountThisBatch + count })),
```
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; node --experimental-strip-types -e "import('./src/stores/runtime.ts').then((m) =&gt; { const s = m.useRuntimeStore.getState(); if (s.inflightBytes !== 0 || s.throttleActive !== false || s.throttleToastFiredThisBatch !== false || s.renameCountThisBatch !== 0) { console.error('FAIL initial', s); process.exit(1); } s.markThrottle(); const s2 = m.useRuntimeStore.getState(); if (!s2.throttleActive || !s2.throttleToastFiredThisBatch) { console.error('FAIL markThrottle', s2); process.exit(1); } s.markRename(3); s.markRename(2); const s3 = m.useRuntimeStore.getState(); if (s3.renameCountThisBatch !== 5) { console.error('FAIL markRename', s3); process.exit(1); } s.startBatch(['a','b']); const s4 = m.useRuntimeStore.getState(); if (s4.throttleActive || s4.throttleToastFiredThisBatch || s4.renameCountThisBatch !== 0) { console.error('FAIL startBatch reset', s4); process.exit(1); } s.markThrottle(); s.cancelBatch(); const s5 = m.useRuntimeStore.getState(); if (s5.throttleActive || s5.inflightBytes !== 0) { console.error('FAIL cancelBatch reset', s5); process.exit(1); } console.log('runtime extensions OK'); })"</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - The inline node verifier prints `runtime extensions OK` and exits 0.
    - `grep -c "throttleActive\|throttleToastFiredThisBatch\|renameCountThisBatch\|inflightBytes" src/stores/runtime.ts` returns at least 12 (4 declarations, 4 seeds, 4 resets in startBatch, 4 resets in cancelBatch, plus action bodies; total exceeds 12).
    - `grep -c "^\s*markThrottle:" src/stores/runtime.ts` returns 1.
    - `grep -c "^\s*setThrottleActive:" src/stores/runtime.ts` returns 1.
    - `grep -c "^\s*markRename:" src/stores/runtime.ts` returns 1.
    - All Phase 1+2+3 specs still pass: `npm test` exits 0.
  </acceptance_criteria>
  <done>useRuntimeStore exposes the four new batch-scoped fields plus three actions; startBatch + cancelBatch reset the latches correctly; the integration verifier exercises markThrottle (idempotent), markRename (additive), and confirms reset semantics.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Job byteEstimate from caller | Caller (Plan 04-05 addFile) computes via estimateJobBytes; pool trusts the value. Malicious or buggy estimate could under-report and bypass the gate. |
| Pool-internal accounting | inflightBytes is private state; only mutated inside tryDispatch and runOnSlot. External callers cannot tamper. |
| Worker memory contract | Plan 04-03 png-adapter discards ImageData on function exit; the byte-estimate assumes this discipline. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-04-01 | Denial of Service | Caller submits many jobs without byteEstimate; gate no-ops; pool floods | mitigate (partial) | Plan 04-05 ensures every PNG variant carries an estimate. SVG and stub jobs are intentionally exempt (small fixed footprint). Plan 04-06 acceptance criteria includes a grep that asserts every PNG enqueue site sets byteEstimate. |
| T-04-04-02 | Tampering | Caller under-reports byteEstimate to bypass gate | accept | Single-developer codebase; no untrusted callers. Estimate is computed from sniffed PNG dimensions (Plan 04-05) — the input filename + bytes determine the estimate, not user-controllable runtime state. |
| T-04-04-03 | Denial of Service | Single oversize job (estimate greater than budget) deadlocks queue | mitigate | Deadlock-prevention precondition `inflightBytes > 0` lets a too-large job dispatch alone. Test in Task 1 acceptance criteria. |
| T-04-04-04 | Information Disclosure | Throttle telemetry leaks user batch size to logs | accept | All throttle state is in-process; no external transmission per PRIV-01 zero-server constraint. Toast text is a fixed string with no PII. |
| T-04-04-05 | Tampering | inflightBytes desync between pool internal field and runtime store mirror | mitigate | The runtime store's `inflightBytes` field is documented as a TELEMETRY MIRROR ONLY — not authoritative. The pool's private field is the source of truth for gate decisions. Mirror starts at 0 and is currently not updated — Plan 04-06 may wire it via a callback in a later step if StatusBar needs live readout; not required for the gate to function. |
| T-04-04-06 | Denial of Service | onThrottle callback infinite-loop calls toast.info | mitigate | App.tsx wiring (Plan 04-06) latches via `throttleToastFiredThisBatch` flag — first call sets it; subsequent calls observe the flag set and skip the toast. Verified by Task 2 acceptance criteria (markThrottle is idempotent on the latch). |
</threat_model>

<verification>
- npx tsc --noEmit passes.
- npm run build exits 0.
- npm test (Phase 1+2+3 regression) stays green.
- The Task 2 inline verifier exercises all four state transitions (initial seed, markThrottle, markRename, startBatch reset, cancelBatch reset) and prints OK.
- The pool dispatches a single oversized job alone (deadlock prevention).
</verification>

<success_criteria>
- PoolJob.byteEstimate field exists.
- PoolCallbacks.onThrottle field exists.
- tryDispatch enforces the byte cap with deadlock prevention.
- runOnSlot releases bytes on settle.
- cancel and terminate reset inflightBytes to 0.
- useRuntimeStore exposes the four new batch-scoped fields plus three actions.
- All prior-phase specs still pass.
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-04-SUMMARY.md` documenting the gate algorithm (with the deadlock-prevention precondition explained), the runtime store extensions, and the cross-Plan contract: Plan 04-05 sets byteEstimate via Plan 04-02 estimateJobBytes; Plan 04-06 wires onThrottle to markThrottle in the App.tsx pool callback.
</output>
