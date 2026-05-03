---
phase: 04
plan: 07
type: execute
wave: 4
depends_on: ["04-06"]
files_modified:
  - src/App.tsx
  - src/tests/raster.spec.ts
autonomous: false
requirements: [PIPE-04, PIPE-01, OPT-06]
must_haves:
  truths:
    - "App.tsx pool callback wires onThrottle → useRuntimeStore.markThrottle + Sonner toast 'Pacing batch for memory' (D-13, UI-SPEC §Surface 7)"
    - "App.tsx subscribes runtime renameCountThisBatch transitions from 0 to N → fires Sonner toast '{N} files renamed to avoid collisions' (D-16, UI-SPEC §Surface 8)"
    - "App.tsx startOptimize threads PNG variants through buildPngResizeSettings + sets PoolJob.byteEstimate from FileEntryWithBlob.byteEstimate"
    - "App.tsx onDone for PNG decodes the resulting Blob and calls useFilesStore.markDone with the encoded ArrayBuffer wrapped as Blob"
    - "App.tsx renders Plan 04-06's SourceDensityControl + TargetDensityCheckboxes inside the file-row JSX"
    - "App.tsx renders Plan 04-06's TweaksResizeSection + TweaksPrivacySection in the TweaksPanel composition"
    - "All seven raster.spec.ts test.fail markers are removed; tests pass live (SC-1 density variants, SC-2 memory budget, SC-4 url-leaks, throttle toast, perf budget, collision rename, metadata strip)"
    - "Old line 518 'Phase 5 may introduce 1:N' comment in src/App.tsx is removed (resolved by D-04 + D-14)"
  artifacts:
    - path: "src/App.tsx"
      provides: "End-to-end wiring: pool callbacks (onThrottle), startOptimize PNG branch, rename-toast subscriber, file-row controls, TweaksPanel section composition, comment cleanup"
      contains: "onThrottle"
    - path: "src/tests/raster.spec.ts"
      provides: "Live SC-1..SC-4 + D-13 + D-15 + D-16 tests"
      contains: "expect"
  key_links:
    - from: "src/App.tsx pool callback"
      to: "src/stores/runtime.ts markThrottle"
      via: "onThrottle hook"
      pattern: "markThrottle"
    - from: "src/App.tsx pool callback"
      to: "sonner toast.info"
      via: "first-throttle latch + collision-rename latch"
      pattern: "Pacing batch for memory"
    - from: "src/App.tsx startOptimize"
      to: "src/workers/png-config.ts buildPngResizeSettings"
      via: "PNG branch"
      pattern: "buildPngResizeSettings"
    - from: "src/App.tsx startOptimize"
      to: "PoolJob.byteEstimate"
      via: "thread FileEntryWithBlob.byteEstimate into job"
      pattern: "byteEstimate:"
    - from: "src/App.tsx file-row JSX"
      to: "src/components/file-row/SourceDensityControl.tsx + TargetDensityCheckboxes.tsx"
      via: "Plan 04-06 components rendered next to ctxbtn"
      pattern: "SourceDensityControl|TargetDensityCheckboxes"
---

<objective>
Wire Plan 04-06's UI components into App.tsx, route PNG through the Plan 04-03 adapter end-to-end, fire the D-13 throttle and D-16 rename toasts, flip the seven Wave 0 raster.spec.ts test.fail markers to live assertions, and hold a human-checkpoint visual UAT for the manual-only checks from 04-VALIDATION.md.

Purpose: Plan 04-06 shipped the components; this plan closes the loop. After 04-07, Phase 4 is functionally complete: users declare per-file source density, see variants generated with `@Nx.ext` filenames, observe the StatusBar throttle pill on a 50-file batch, and see honest helper text that ICC preservation is wired-but-inactive.

Output: App.tsx extensively edited, 1 test file flipped from stub to live, 1 human checkpoint for visual UAT before Phase 4 closes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md
@.planning/phases/04-decode-resize-memory-model/04-RESEARCH.md
@.planning/phases/04-decode-resize-memory-model/04-PATTERNS.md
@.planning/phases/04-decode-resize-memory-model/04-UI-SPEC.md
@.planning/phases/04-decode-resize-memory-model/04-VALIDATION.md
@.planning/phases/04-decode-resize-memory-model/04-06-SUMMARY.md
@src/App.tsx
@src/stores/runtime.ts
@src/stores/files.ts
@src/stores/settings.ts
@src/workers/png-adapter.ts
@src/workers/png-config.ts
@src/tests/raster.spec.ts
@src/components/panels/TweaksPanel.tsx
@src/components/file-row/SourceDensityControl.tsx
@src/components/file-row/TargetDensityCheckboxes.tsx
@src/components/shell/StatusBar.tsx

<interfaces>
**App.tsx pool callback site (lines 254-270 — existing):**
```typescript
const isAuxiliaryJob = (jobId: string) => jobId.startsWith('preview-') || jobId.startsWith('savings-')
const pool = useMemo(() => getWorkerPool({
  onStarted: (jobId) => { if (isAuxiliaryJob(jobId)) return; useRuntimeStore.getState().markStarted(jobId) },
  onDone: (jobId) => { if (isAuxiliaryJob(jobId)) return; useRuntimeStore.getState().markDone(jobId) },
  onError: (jobId, err) => { if (isAuxiliaryJob(jobId)) return; const msg = err instanceof Error ? err.message : String(err); useRuntimeStore.getState().markError(jobId, msg) },
}), [])
```
Plan 04-07 ADDS `onThrottle` here.

**App.tsx startOptimize PNG branch — currently routes non-SVG to stub (lines 538-542):**
```typescript
const isSvg = f.format === 'svg'
const adapterFormat: AdapterFormat = isSvg ? 'svg' : 'stub'
const settings = isSvg ? useSettingsStore.getState().svg : (slowMs > 0 ? { slowMs } : {})
```
Plan 04-07 EXTENDS to a three-way: svg / png / stub. PNG branch builds settings via `buildPngResizeSettings`.

**FileEntryWithBlob (Plan 04-05 extension):** has `byteEstimate?: number`, `targetDensity?: SourceDensity`, `sourceDensity: SourceDensity`, `resizeOverride?: ResizeAlg`, `preserveIcc?: boolean`. App.tsx threads these into PoolJob.

**Plan 04-06 components to import + render:**
```typescript
import { TweaksResizeSection, TweaksPrivacySection } from '@/components/panels/TweaksPanel'
import { SourceDensityControl } from '@/components/file-row/SourceDensityControl'
import { TargetDensityCheckboxes } from '@/components/file-row/TargetDensityCheckboxes'
```

**Sonner toast import (existing — already wired in App.tsx):**
```typescript
import { toast } from 'sonner'
```

**File-row in App.tsx (lines 710-808):** the existing JSX uses `MockFile` shape (`f.id`, `f.type`, `f.name`, `f.orig`, `f.opt`, `f.status`). Phase 4 adds the density controls. UI-SPEC §Surface 1 picks hover-revealed Popover; the controls live INSIDE the file-row stat line OR adjacent to the existing chevron (the existing `ctxbtn` More button at line 770-779 is the right-edge anchor — Plan 04-07 inserts SourceDensityControl + TargetDensityCheckboxes BEFORE it on hover/focus).

NB: the file-row currently iterates a derived `filteredFiles` view-model that may NOT include FileEntry shape. Plan 04-07 reconciles by reading the live FileEntry via `useFilesStore.getState().byId[f.id]` inside the new components — same pattern Phase 3 used for the sanitized badge (App.tsx line 751-765).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Wire App.tsx — pool onThrottle, PNG branch in startOptimize, rename-toast subscriber, file-row controls slot, TweaksPanel sections, comment cleanup</name>
  <read_first>
    - src/App.tsx (full file — focus lines 254-270 pool callbacks; lines 511-600 startOptimize; lines 518 outdated comment; lines 710-808 file-row JSX; lines 309-360 runtime subscriber pattern)
    - src/stores/runtime.ts (Plan 04-04 — markThrottle, setThrottleActive, renameCountThisBatch, throttleToastFiredThisBatch)
    - src/stores/files.ts (Plan 04-05 — addSourceWithVariants, removeFamily; FileEntryWithBlob.byteEstimate, .targetDensity, .sourceDensity)
    - src/stores/settings.ts (Plan 04-05 — useSettingsStore.resize.alg, useSettingsStore.global.preserveIccProfile)
    - src/workers/png-adapter.ts (Plan 04-03 — exports `run` and re-exports `buildPngResizeSettings`)
    - src/workers/png-config.ts (Plan 04-03 — buildPngResizeSettings signature)
    - src/workers/types.ts (Plan 04-04 — PoolJob.byteEstimate)
    - src/components/panels/TweaksPanel.tsx (Plan 04-06 — TweaksResizeSection + TweaksPrivacySection exports)
    - src/components/file-row/SourceDensityControl.tsx (Plan 04-06)
    - src/components/file-row/TargetDensityCheckboxes.tsx (Plan 04-06)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 471-485 onThrottle wiring; lines 622-639 startOptimize PNG branch)
    - .planning/phases/04-decode-resize-memory-model/04-UI-SPEC.md (Surfaces 7, 8 — toast lifecycles)
  </read_first>
  <files>src/App.tsx</files>
  <action>
1. **Update the pool callback (lines 256-270)** — add the `onThrottle` callback:
```typescript
const pool = useMemo(() => getWorkerPool({
  onStarted: (jobId) => { if (isAuxiliaryJob(jobId)) return; useRuntimeStore.getState().markStarted(jobId) },
  onDone: (jobId) => { if (isAuxiliaryJob(jobId)) return; useRuntimeStore.getState().markDone(jobId) },
  onError: (jobId, err) => { if (isAuxiliaryJob(jobId)) return; const msg = err instanceof Error ? err.message : String(err); useRuntimeStore.getState().markError(jobId, msg) },
  // Phase 4 D-13 — admission gate held the queue. markThrottle is idempotent
  // and latches throttleToastFiredThisBatch so toast.info fires exactly once.
  onThrottle: () => {
    const r = useRuntimeStore.getState()
    const wasFired = r.throttleToastFiredThisBatch
    r.markThrottle()
    if (!wasFired) {
      toast.info('Pacing batch for memory', {
        description: 'Some files are queued briefly to keep the tab responsive.',
      })
    }
  },
}), [])
```

2. **Add a runtime subscriber for renameCountThisBatch transitions (after the existing aria-live subscriber at line 309-360).** New `useEffect`:
```typescript
// Phase 4 D-16 — collision rename toast. Fires once per addSourceWithVariants
// invocation that produced collisions (count goes from 0 → N in a single
// store update). Subsequent transitions in the same batch coalesce.
useEffect(() => {
  let lastCount = useRuntimeStore.getState().renameCountThisBatch
  const unsub = useRuntimeStore.subscribe(
    (s) => s.renameCountThisBatch,
    (curr) => {
      const delta = curr - lastCount
      lastCount = curr
      if (delta > 0) {
        toast.info(`${delta} ${delta === 1 ? 'file' : 'files'} renamed to avoid collisions`, {
          description: 'Suffix "(2)", "(3)", … inserted before "@Nx" so each variant has a unique name.',
        })
      }
    },
  )
  return unsub
}, [])
```

3. **Add a runtime subscriber to clear `throttleActive` at batch end.** Inside the existing batch-completion subscriber at lines 309-360 (the one that fires the "Batch complete" toast on `prev.running && !curr.running`), add a single line in that branch BEFORE the success/error branching:
```typescript
useRuntimeStore.getState().setThrottleActive(false)
```
This clears the StatusBar pill at batch end (UI-SPEC §Surface 6: clears at batch end).

4. **Update startOptimize (lines 511-600).** Three sub-changes:

   (a) **Remove or update the line 518 comment** (`Phase 5 may introduce 1:N`). Replace with:
   ```typescript
   // Phase 4 (D-04 + D-14) — 1:1 jobs:FileEntries. addSourceWithVariants in
   // useFilesStore materializes one FileEntry per density variant up-front;
   // each entry is its own pool job here.
   ```

   (b) **Add `import { buildPngResizeSettings } from '@/workers/png-config'`** at the top of App.tsx (with existing imports).

   (c) **Replace the SVG-vs-stub branch (lines 538-549)** with a three-way:
   ```typescript
   const isSvg = f.format === 'svg'
   const isPng = f.format === 'png'
   const adapterFormat: AdapterFormat = isSvg ? 'svg' : isPng ? 'png' : 'stub'
   let settings: unknown
   if (isSvg) {
     settings = useSettingsStore.getState().svg
   } else if (isPng) {
     // Plan 04-05 enriched FileEntry: targetDensity, sourceDensity guaranteed
     // for PNG variants; resizeOverride + preserveIcc are optional per-file overrides.
     const fileEntry = useFilesStore.getState().byId[fileId]
     settings = buildPngResizeSettings({
       sourceDensity: fileEntry?.sourceDensity ?? '1x',
       targetDensity: fileEntry?.targetDensity ?? fileEntry?.sourceDensity ?? '1x',
       globalAlg: useSettingsStore.getState().resize.alg,
       fileOverride: fileEntry?.resizeOverride,
       globalPreserveIcc: useSettingsStore.getState().global.preserveIccProfile,
       filePreserveIcc: fileEntry?.preserveIcc,
     })
   } else {
     settings = slowMs > 0 ? { slowMs } : {}
   }
   const job: PoolJob = {
     id: fileId,
     fileId,
     format: adapterFormat,
     settings,
     blob: f.sourceBlob,
     // Phase 4 D-11(b) — admission gate input. Plan 04-05 seeded byteEstimate
     // on FileEntryWithBlob during addSourceWithVariants.
     byteEstimate: (useFilesStore.getState().byId[fileId] as { byteEstimate?: number } | undefined)?.byteEstimate,
   }
   ```

   (d) **In the `.then(async (result) => {...})` branch (lines 551-583)**, add a third path for PNG. The existing branches: SVG (sanitize + markDone) and stub (Blob-wrap + markDone). PNG path: wrap `result.output` as a Blob with mime `image/png` and call markDone — same as stub but with PNG mime. Insert between the `if (isSvg)` and `else { /* stub */ }` blocks:
   ```typescript
   } else if (isPng) {
     // Phase 4 — encoded PNG bytes from png-adapter (decode → resize → encode).
     // Wrap as Blob and store; thumbnail/object URL is auto-managed by the
     // existing useRuntimeStore.getOrCreateObjectURL on next render.
     const optimizedBlob = new Blob([result.output], { type: 'image/png' })
     useFilesStore.getState().markDone(fileId, optimizedBlob, optimizedBlob.size)
   } else {
   ```

5. **Wire SourceDensityControl + TargetDensityCheckboxes into the file-row** (around lines 769-779, where the `ctxbtn` More button + status pill currently render). The new controls go BEFORE the `ctxbtn`:
```typescript
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  <TargetDensityCheckboxes sourceFamilyId={filesById[f.id]?.sourceFamilyId ?? f.id} />
  <SourceDensityControl fileId={f.id} />
  <button className="ctxbtn" ...>
```
Add the imports at the top of App.tsx:
```typescript
import { SourceDensityControl } from '@/components/file-row/SourceDensityControl'
import { TargetDensityCheckboxes } from '@/components/file-row/TargetDensityCheckboxes'
```

6. **Wire TweaksPanel sections into the existing tweaks panel composition.** Locate the existing TweaksPanel composition (likely in App.tsx or a parent component). Import `TweaksResizeSection` and `TweaksPrivacySection` from `@/components/panels/TweaksPanel` and render them. Per UI-SPEC §Surface 4: Resize section is the SECOND section in the panel (after "Output format"); Privacy section is THIRD (after Resize, before per-codec advice). Find the existing section ordering — if the layout is in `src/components/panels/CodecPanel.tsx`, slot in there. If panel composition is inline in App.tsx, slot in there. Use Edit (not Write) on whichever file.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build 2&gt;&amp;1 | tail -3 | grep -E "(error|built)" &amp;&amp; grep -c "onThrottle" src/App.tsx | grep -v '^0$' &amp;&amp; grep -c "buildPngResizeSettings" src/App.tsx | grep -v '^0$' &amp;&amp; grep -c "renameCountThisBatch" src/App.tsx | grep -v '^0$' &amp;&amp; ! grep -F "Phase 5 may introduce 1:N" src/App.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
    - `grep -c "onThrottle:" src/App.tsx` returns 1.
    - `grep -c "buildPngResizeSettings" src/App.tsx` returns at least 2 (import + call site).
    - `grep -c "renameCountThisBatch" src/App.tsx` returns at least 1 (subscriber).
    - `grep -F "Phase 5 may introduce 1:N" src/App.tsx` returns NO match (comment removed).
    - `grep -c "byteEstimate:" src/App.tsx` returns at least 1 (PoolJob enrichment).
    - `grep -c "Pacing batch for memory" src/App.tsx` returns 1 (toast call).
    - `grep -c "renamed to avoid collisions" src/App.tsx` returns 1.
    - `grep -c "SourceDensityControl\|TargetDensityCheckboxes" src/App.tsx` returns at least 4 (2 imports + 2 JSX uses).
    - `grep -c "TweaksResizeSection\|TweaksPrivacySection" src/App.tsx` returns at least 2 (or render-site file if not App.tsx — flag in summary).
    - Phase 1+2+3 specs still pass: `npm test` reports the prior count of green tests + 7 expected-fails for raster.spec.ts (Task 2 of THIS plan flips the raster expected-fails to green).
  </acceptance_criteria>
  <done>Pool wiring fires onThrottle and shows the toast once per batch; collision-rename toast subscriber fires once per fan-out; PNG branch in startOptimize routes through png-adapter with full settings + byteEstimate; outdated 1:N comment is gone; file-row hosts the two new density controls; TweaksPanel renders Resize + Privacy sections.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Flip raster.spec.ts test.fail markers to live assertions</name>
  <read_first>
    - src/tests/raster.spec.ts (Plan 04-01 stubs — flip all 7 test.fail markers)
    - src/tests/instrument-heap.ts (Plan 04-01 helper — probeHeapDuringBatch)
    - src/tests/fixtures/instrument-blob-urls.js (Phase 2 helper — REUSE for SC-4)
    - src/tests/fixtures/density-2x.png (Plan 04-01 — 800x600 reference)
    - src/tests/fixtures/with-icc.png (Plan 04-01 — embedded iCCP fixture)
    - src/stores/files.ts (Plan 04-05 — addSourceWithVariants action signature)
    - .planning/phases/04-decode-resize-memory-model/04-VALIDATION.md (per-task verification map)
  </read_first>
  <files>src/tests/raster.spec.ts</files>
  <action>
Edit `src/tests/raster.spec.ts`. For each of the seven tests created by Plan 04-01, REMOVE the `test.fail(true, '...')` line and replace the body with the live implementation below. The scaffold (loadFixture helper, beforeEach goto + waitForFunction) STAYS unchanged.

**Test 1 — density variants (SC-1):**
```typescript
test('density variants — source 2x emits @1x/@2x/@3x FileEntries', async ({ page }) => {
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    await (window as any).__OIMG_STORES__.files.getState().addSourceWithVariants({
      sourceBlob: blob, sourceDensity: '2x', name: 'logo.png', format: 'png',
      targets: ['1x', '2x', '3x'],
    })
  }, { bytes: pngBytes })
  const names = await page.evaluate(() =>
    Object.values((window as any).__OIMG_STORES__.files.getState().byId).map((f: any) => f.name).sort()
  )
  expect(names).toEqual(['logo@1x.png', 'logo@2x.png', 'logo@3x.png'])
})
```

**Test 2 — memory budget (SC-2):**
```typescript
test('memory budget — 50 PNG @ 2x stays under 800 MB peak heap', async ({ page }) => {
  const { probeHeapDuringBatch } = await import('./instrument-heap')
  const pngBytes = await loadFixture('density-2x.png')
  const peak = await probeHeapDuringBatch(page, async () => {
    await page.evaluate(async ({ bytes }) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
      const filesApi = (window as any).__OIMG_STORES__.files.getState()
      for (let i = 0; i < 50; i++) {
        await filesApi.addSourceWithVariants({
          sourceBlob: blob, sourceDensity: '2x', name: `f${i}.png`, format: 'png', targets: ['1x','2x','3x'],
        })
      }
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /optimize/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined
      btn?.click()
      await new Promise<void>((resolve) => {
        const i = setInterval(() => {
          if (!(window as any).__OIMG_STORES__.runtime.getState().running) { clearInterval(i); resolve() }
        }, 100)
      })
    }, { bytes: pngBytes })
  })
  expect(peak).toBeLessThan(800 * 1024 * 1024)
})
```

**Test 3 — no url leaks (SC-4):**
```typescript
test('no url leaks — 20-file batch revokes every createObjectURL', async ({ page }) => {
  await page.evaluate(() => (window as any).__OIMG_INSTRUMENT_BLOB_URLS__?.())
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as any).__OIMG_STORES__.files.getState()
    for (let i = 0; i < 20; i++) {
      await filesApi.addSourceWithVariants({
        sourceBlob: blob, sourceDensity: '2x', name: `f${i}.png`, format: 'png', targets: ['1x'],
      })
    }
    filesApi.clear()
  }, { bytes: pngBytes })
  const stats = await page.evaluate(() => (window as any).__OIMG_BLOB_URL_STATS__?.() ?? { created: 0, revoked: 0 })
  expect(stats.created).toBe(stats.revoked)
})
```

**Test 4 — throttle toast (D-13):** assert at-most-once-per-batch (no false positives on small batches):
```typescript
test('throttle toast — first admission-gate trigger fires once per batch', async ({ page }) => {
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as any).__OIMG_STORES__.files.getState()
    for (let i = 0; i < 10; i++) {
      await filesApi.addSourceWithVariants({
        sourceBlob: blob, sourceDensity: '2x', name: `f${i}.png`, format: 'png', targets: ['1x','2x','3x'],
      })
    }
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /optimize/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined
    btn?.click()
    await new Promise<void>((resolve) => {
      const i = setInterval(() => {
        if (!(window as any).__OIMG_STORES__.runtime.getState().running) { clearInterval(i); resolve() }
      }, 100)
    })
  }, { bytes: pngBytes })
  const toastCount = await page.locator('[data-sonner-toast]').filter({ hasText: 'Pacing batch for memory' }).count()
  expect(toastCount).toBeLessThanOrEqual(1)
})
```

**Test 5 — perf budget (D-15):**
```typescript
test('perf budget — decode+resize+encode on 2 MB PNG p50 ≤ 500 ms', async ({ page }) => {
  const pngBytes = await loadFixture('density-2x.png')
  const samples = await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as any).__OIMG_STORES__.files.getState()
    const runtimeApi = (window as any).__OIMG_STORES__.runtime
    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      filesApi.clear()
      await filesApi.addSourceWithVariants({
        sourceBlob: blob, sourceDensity: '2x', name: `s${i}.png`, format: 'png', targets: ['1x'],
      })
      const t0 = performance.now()
      ;(Array.from(document.querySelectorAll('button')).find((b) => /optimize/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined)?.click()
      await new Promise<void>((resolve) => {
        const t = setInterval(() => {
          if (!runtimeApi.getState().running) { clearInterval(t); resolve() }
        }, 50)
      })
      samples.push(performance.now() - t0)
    }
    return samples
  }, { bytes: pngBytes })
  samples.sort((a, b) => a - b)
  const p50 = samples[Math.floor(samples.length / 2)]
  console.log(`Perf budget p50: ${p50.toFixed(1)} ms (D-15 raster: ≤ 500 ms / 2 MB)`)
  expect(p50).toBeLessThan(500)
})
```

**Test 6 — collision rename (D-16):**
```typescript
test('collision rename — duplicate @Nx names auto-suffix (2)', async ({ page }) => {
  const pngBytes = await loadFixture('density-2x.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as any).__OIMG_STORES__.files.getState()
    await filesApi.addSourceWithVariants({ sourceBlob: blob, sourceDensity: '2x', name: 'logo.png', format: 'png', targets: ['1x'] })
    await filesApi.addSourceWithVariants({ sourceBlob: blob, sourceDensity: '2x', name: 'logo.png', format: 'png', targets: ['1x'] })
  }, { bytes: pngBytes })
  const names = await page.evaluate(() =>
    Object.values((window as any).__OIMG_STORES__.files.getState().byId).map((f: any) => f.name).sort()
  )
  expect(names).toContain('logo@1x.png')
  expect(names).toContain('logo (2)@1x.png')
})
```

**Test 7 — metadata strip (SC-3 / OPT-06):**
```typescript
test('metadata strip — output bytes contain no iCCP chunk by default', async ({ page }) => {
  const iccBytes = await loadFixture('with-icc.png')
  await page.evaluate(async ({ bytes }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const filesApi = (window as any).__OIMG_STORES__.files.getState()
    await filesApi.addSourceWithVariants({ sourceBlob: blob, sourceDensity: '2x', name: 'icc.png', format: 'png', targets: ['1x'] })
    ;(Array.from(document.querySelectorAll('button')).find((b) => /optimize/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined)?.click()
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        const entries = Object.values((window as any).__OIMG_STORES__.files.getState().byId) as any[]
        if (entries.length > 0 && entries.every((e) => e.status === 'done')) { clearInterval(t); resolve() }
      }, 100)
    })
  }, { bytes: iccBytes })
  const outputBytes = await page.evaluate(async () => {
    const entries = Object.values((window as any).__OIMG_STORES__.files.getState().byId) as any[]
    const blob = entries[0].optimizedBlob as Blob
    const buf = await blob.arrayBuffer()
    return Array.from(new Uint8Array(buf))
  })
  const out = Buffer.from(outputBytes)
  expect(out.includes(Buffer.from('iCCP'))).toBe(false)
})
```

After flipping all seven, run the full suite (`npm test`) — all Phase 1+2+3 specs MUST stay green AND all 7 raster tests must pass live (no `test.fail` markers remain).
  </action>
  <verify>
    <automated>npx playwright test src/tests/raster.spec.ts --reporter=line; echo "EXIT=$?"; grep -c "test.fail" src/tests/raster.spec.ts; npm test 2&gt;&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "test.fail" src/tests/raster.spec.ts` returns 0 (all expected-fail markers removed).
    - `npx playwright test src/tests/raster.spec.ts` reports 7 tests, 7 passed, 0 failed.
    - `npm test` exits 0 with the prior-phase spec count plus 7 new green tests.
    - Output of Test 5 contains the substring `Perf budget p50:` (diagnostic logged for the developer summary).
  </acceptance_criteria>
  <done>raster.spec.ts has zero test.fail markers; full suite green; SC-1, SC-2, SC-4, D-13 toast at-most-once, D-15 perf p50, D-16 collision rename, OPT-06 strip-by-default all enforced live.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Visual UAT walkthrough — Manual-Only Verifications from 04-VALIDATION.md</name>
  <what-built>
    All Phase 4 source code from Plans 04-01..04-06 + 04-07 Tasks 1-2. Automated suite is green. The remaining checks are visual/UX confirmations that automated tests cannot pin reliably (per 04-VALIDATION.md Manual-Only Verifications table, lines 73-79).
  </what-built>
  <how-to-verify>
1. Start the dev server: `npm run dev` and open http://localhost:5173.
2. **TweaksPanel sections:**
   - [ ] "Resize / Variants" section is the SECOND section in the panel (after "Output format" if present, before per-codec parameters).
   - [ ] Algorithm dropdown defaults to `Lanczos3 (default)`; switching algorithms updates the global state.
   - [ ] "Privacy / Metadata" section sits AFTER Resize, BEFORE per-codec advice.
   - [ ] Both toggles render with helper text below them.
   - [ ] Preserve-ICC helper text reads VERBATIM: `Wired but inactive in this version. Color profiles are stripped along with all metadata. ICC preservation ships in v1.1 once raster encoders integrate.`
3. **File-row density controls:**
   - [ ] Drop a single PNG. Source-density chevron appears on row hover/focus, hidden otherwise.
   - [ ] Click chevron → Popover opens with three buttons `1x` / `2x` / `3x`.
   - [ ] Target-density checkboxes show three boxes; the source-density box is dim-accent + cursor-not-allowed; the other two are interactive.
4. **Variant rendering on a multi-target drop:**
   - [ ] After `addSourceWithVariants` (drop 5 PNGs at 2x source / all targets), 15 variant rows appear with names `name@1x.png` / `name@2x.png` / `name@3x.png`.
   - [ ] Variants of the same source share a colored left rail (UI-SPEC §Surface 3 family color); different sources get different rails.
5. **StatusBar pill on a 50-file stress batch:**
   - [ ] Drop 50 PNG fixtures at 3x source / all targets (= 150 variants). Click Optimize.
   - [ ] StatusBar shows "Pacing" pill (warn-color text) during throttle.
   - [ ] Pill clears at batch completion.
   - [ ] Sonner toast `Pacing batch for memory` appears AT MOST ONCE during the batch (not once per throttle event).
6. **Collision rename toast:**
   - [ ] Drop two distinct files both named `logo.png`. Confirm `1 file renamed to avoid collisions` toast fires once.
   - [ ] Verify the second batch's variants are named `logo (2)@Nx.png`.
7. **ICC honesty (D-10 amendment):**
   - [ ] Toggle Preserve-ICC ON. Re-optimize the same `with-icc.png` fixture used in raster.spec.ts test 7.
   - [ ] Verify output PNG STILL has `iCCP` stripped (open Optimized blob in a hex viewer or run a quick `Object.values(__OIMG_STORES__.files.getState().byId)[0].optimizedBlob.arrayBuffer().then(buf => console.log(Array.from(new Uint8Array(buf)).map(b => b.toString(16)).join('').includes('69434350')))` — should print `false`).
8. **WCAG AA quick check:**
   - [ ] Tab through the file row: chevron-button → target-checkbox 1 → target-checkbox 2 → target-checkbox 3 → status pill, in that order.
   - [ ] Source-density (locked) checkbox has visible focus ring but Space does not toggle.
  </how-to-verify>
  <resume-signal>Type "approved" to mark Phase 4 complete, or describe any visual/behavioral issues for revision.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Sonner toast text → DOM | Locked-string interpolation only; no user-controlled text reaches toast (rename count is `${number}`) |
| Visual UAT human gate | Manual verification — locked verbatim copy is the sole defense against UI dishonesty about ICC no-op |
| Pool callback boundary | onThrottle is an internal pool→main-thread signal; no untrusted data crosses |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-07-01 | Information Disclosure | First-throttle toast leaks too-frequent (every job throttle = a toast spam) | mitigate | App.tsx onThrottle wiring reads `throttleToastFiredThisBatch` BEFORE calling `markThrottle()`; `wasFired` snapshot prevents the toast firing more than once. Verified by Task 2 Test 4 `expect(toastCount).toBeLessThanOrEqual(1)`. |
| T-04-07-02 | Denial of Service | rename-toast subscriber fires per-keystroke during rapid file drops | mitigate | Subscriber compares `delta = curr - lastCount` per single store transition; in zustand each `markRename(N)` is one batched update so delta is accurate. The toast fires once per call, not per file. |
| T-04-07-03 | Repudiation | UI shows ICC toggle ON but worker stripped — user thinks ICC was preserved | mitigate | Plan 04-06 enforced the verbatim helper text via grep; Plan 04-07's visual UAT (Task 3 step 2 + step 7) double-checks the helper text and confirms output still has iCCP stripped. This is the SOLE disclosure preventing the ICC no-op from being a lie (D-10 amendment rationale). |
| T-04-07-04 | Elevation of Privilege | Test fixtures or `__OIMG_STORES__` exposed in production build | mitigate | Phase 2 already gated `__OIMG_STORES__` behind `import.meta.env.DEV`; Plan 04-07 does not add new test affordances. Test fixtures live under `src/tests/` and are excluded by Vite's default test-glob exclusions. Verified by `npm run build` not bundling test paths. |
</threat_model>

<verification>
- npx tsc --noEmit passes.
- npm run build exits 0.
- npm test exits 0 with seven raster.spec.ts tests now green (no test.fail markers remain).
- Visual UAT confirms locked copy + throttle pill + collision toast + variant family rail.
- All Phase 1+2+3 specs unchanged + green.
</verification>

<success_criteria>
- All seven SC-* / D-13 / D-15 / D-16 raster tests pass live.
- Phase 4 success criteria from ROADMAP.md row 82-87 verifiable end-to-end:
  1. SC-1: Selecting "source is 2x" for a PNG generates 1x and 3x variants with correct `@Nx.ext` filename suffixes.
  2. SC-2: 50 raster files completes without crash; heap stays under 800 MB.
  3. SC-3 (partial per D-10 amendment): EXIF/XMP/IPTC absent from default output; ICC preservation toggle is data-shape only and disclosed honestly.
  4. SC-4: Object URLs revoked correctly across 20-file batch.
- D-13 first-throttle toast fires at most once per batch.
- D-16 collision-rename toast fires once per fan-out call.
- App.tsx renders Plan 04-06 components (TweaksResizeSection, TweaksPrivacySection, SourceDensityControl, TargetDensityCheckboxes).
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-07-SUMMARY.md` documenting:
- The App.tsx wiring deltas (onThrottle, rename subscriber, PNG branch in startOptimize, byteEstimate threading, comment cleanup, file-row + TweaksPanel composition).
- The seven raster.spec.ts tests now live (with the empirical p50 perf number from D-15).
- The visual UAT outcome (approved or revisions requested).
- A Phase 5 backlog note: ICC chunk extract/embed (per Post-Research D-10 amendment) is pending; the Preserve-ICC toggle is wired-but-inactive until Phase 5 ships byte-level chunk plumbing.
- A Phase 5 backlog note: interactive density editing (per Post-Research D-01/D-02 SCOPED amendment) is pending; SourceDensityControl + TargetDensityCheckboxes render but mutations are NO-OPs in P4.
</output>
