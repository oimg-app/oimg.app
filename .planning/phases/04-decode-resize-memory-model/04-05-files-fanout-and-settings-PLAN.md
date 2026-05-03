---
phase: 04
plan: 05
type: execute
wave: 2
depends_on: ["04-01", "04-02"]
files_modified:
  - src/stores/files.ts
  - src/stores/settings.ts
autonomous: true
requirements: [PIPE-04, OPT-06]
must_haves:
  truths:
    - "useFilesStore.addSourceWithVariants({sourceBlob, sourceDensity, name, format, targets[]}) materializes one FileEntryWithBlob per target density (D-04 + D-14)"
    - "Each variant id is `${sourceUuid}-${density}` (D-04); sourceFamilyId === sourceUuid; targetDensity is the density THIS entry produces"
    - "Each variant name = applyDensitySuffix(originalName, targetDensity) then deduplicateName against the existing byId set (D-03 + D-16)"
    - "Collision count is reported via useRuntimeStore.markRename(N) so Plan 04-06 fires the single-toast latch"
    - "PNG variants carry byteEstimate from estimateJobBytes(sniffedW, sniffedH, tgtW, tgtH) — sniffPngDimensions runs ONCE per source, dims reused across all targets (D-11.b)"
    - "Non-PNG sources fall back to a compression-ratio heuristic of `blob.size * 10 * 4 * 1.75` (RESEARCH §2.2(a))"
    - "useFilesStore.removeFamily(sourceFamilyId) loops removeFile(variantId) for every entry where sourceFamilyId matches — preserves existing URL-revoke discipline (RESEARCH §5.2)"
    - "useSettingsStore exposes a new `resize: { alg: ResizeAlg }` slice with setter setResize, seeded from DEFAULT_RESIZE_SETTINGS (D-05 + D-06)"
    - "Existing addFile, removeFile, markDone, clear actions remain unchanged (regression-safe)"
  artifacts:
    - path: "src/stores/files.ts"
      provides: "addSourceWithVariants action + removeFamily action"
      exports: ["useFilesStore"]
      contains: "addSourceWithVariants"
    - path: "src/stores/settings.ts"
      provides: "resize slice + setResize action"
      exports: ["useSettingsStore"]
      contains: "resize:"
  key_links:
    - from: "src/stores/files.ts addSourceWithVariants"
      to: "src/lib/filename.ts"
      via: "applyDensitySuffix + deduplicateName"
      pattern: "applyDensitySuffix"
    - from: "src/stores/files.ts addSourceWithVariants"
      to: "src/lib/sniff.ts + src/lib/memory-budget.ts"
      via: "sniffPngDimensions then estimateJobBytes per variant"
      pattern: "sniffPngDimensions"
    - from: "src/stores/files.ts addSourceWithVariants"
      to: "src/stores/runtime.ts markRename"
      via: "cross-store call after collision dedup"
      pattern: "markRename"
---

<objective>
Add the variant fan-out action `addSourceWithVariants` to `useFilesStore` (D-04 + D-14), the family-cascade action `removeFamily` (RESEARCH §5.2), and a `resize` settings slice (D-05 + D-06). Existing single-entry `addFile` action stays — Phase 2 + Phase 3 callers (tests, addFile-style wiring) are not disturbed.

Purpose: Plan 04-06 (UI) + the App.tsx startOptimize loop need a single function call to materialize N FileEntries with correct names, ids, family grouping, density tags, and byte estimates. Without this fan-out, the UI would have to compute per-variant names + ids + estimates inline, duplicating logic across surfaces.

Output: 2 store files modified. After this plan, the data shape supports D-04 + D-14 1:1 jobs:FileEntries, D-16 collision dedup with toast counter, and D-11.b byte estimate seeding. UI integration ships in Plan 04-06.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-decode-resize-memory-model/04-CONTEXT.md
@.planning/phases/04-decode-resize-memory-model/04-RESEARCH.md
@.planning/phases/04-decode-resize-memory-model/04-PATTERNS.md
@src/stores/files.ts
@src/stores/settings.ts
@src/stores/runtime.ts
@src/lib/filename.ts
@src/lib/sniff.ts
@src/lib/memory-budget.ts
@src/types/index.ts
@src/data/defaults.ts

<interfaces>
Existing useFilesStore.addFile (lines 47-51 of src/stores/files.ts): unchanged — accepts a fully-formed FileEntryWithBlob. Plan 04-05 adds a SECOND action that internally calls addFile per variant.

Existing FileEntryWithBlob (src/stores/files.ts lines 11-14):
```typescript
export interface FileEntryWithBlob extends FileEntry {
  sourceBlob: Blob
  optimizedBlob: Blob | null
}
```

Plan 04-01 extended FileEntry with: `sourceFamilyId?: string`, `targetDensity?: SourceDensity`, `resizeOverride?: ResizeAlg`, `preserveIcc?: boolean`.

Density-to-pixel-scale: `parseInt(targetDensity) / parseInt(sourceDensity)`. Example: source 2x, target 3x → scale 1.5.

Pre-decode dimension sniff (Plan 04-02 — already shipped):
```typescript
// src/lib/sniff.ts
export async function sniffPngDimensions(blob: Blob): Promise<{ width: number; height: number } | null>
```

Filename helpers (Plan 04-02 — already shipped):
```typescript
// src/lib/filename.ts
export function applyDensitySuffix(originalName: string, density: SourceDensity): string
export function deduplicateName(proposed: string, takenSet: ReadonlySet<string>): string
```

Memory budget (Plan 04-02 — already shipped):
```typescript
// src/lib/memory-budget.ts
export function estimateJobBytes(srcW: number, srcH: number, tgtW: number, tgtH: number): number
```

Cross-store call pattern (existing — verbatim from src/stores/files.ts lines 54-55, 59-63):
```typescript
useRuntimeStore.getState().revokeObjectURL(fileId)        // existing pattern
useSettingsStore.setState((s) => { ... })                 // existing pattern
```

Settings store layout (current):
```typescript
// src/stores/settings.ts (lines 29-48)
interface SettingsState {
  svg: CodecSettingsSvg
  png: CodecSettingsPng
  jpeg: CodecSettingsJpeg
  webp: CodecSettingsWebp
  avif: CodecSettingsAvif
  global: GlobalSettings
  snippetTogglesByFileId: Record<string, Record<string, boolean>>
  // setters here ...
}
```

Plan 04-05 adds a top-level `resize` slice plus `setResize`. Per RESEARCH Open Question 5 (line 765): extend `global` for ICC (already there), add a NEW top-level `resize` slice for the algorithm. Two slices, no nesting changes.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add addSourceWithVariants and removeFamily to useFilesStore</name>
  <read_first>
    - src/stores/files.ts (full file — extend addFile patterns at lines 47-51, removeFile at 53-72, markDone at 74-96, clear at 114-124)
    - src/stores/runtime.ts (cross-store getState() pattern at lines 55-56)
    - src/lib/filename.ts (Plan 04-02 — exports applyDensitySuffix + deduplicateName)
    - src/lib/sniff.ts (Plan 04-02 — exports sniffPngDimensions)
    - src/lib/memory-budget.ts (Plan 04-02 — exports estimateJobBytes)
    - src/types/index.ts (Plan 04-01 extended FileEntry — confirm sourceFamilyId, targetDensity, resizeOverride, preserveIcc fields exist)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 392-425 — verbatim addSourceWithVariants + removeFamily)
    - .planning/phases/04-decode-resize-memory-model/04-RESEARCH.md (§5.2 — N variants per source URL discipline)
  </read_first>
  <files>src/stores/files.ts</files>
  <behavior>
    - `addSourceWithVariants({sourceBlob: <800x600 PNG>, sourceDensity:'2x', name:'logo.png', format:'png', targets:['1x','2x','3x']})` materializes 3 entries:
      - id `<sourceUuid>-1x`, name `logo@1x.png`, sourceDensity `2x`, targetDensity `1x`, sourceFamilyId `<sourceUuid>`, byteEstimate `estimateJobBytes(800,600,400,300)`
      - id `<sourceUuid>-2x`, name `logo@2x.png`, targetDensity `2x`, byteEstimate `estimateJobBytes(800,600,800,600)`
      - id `<sourceUuid>-3x`, name `logo@3x.png`, targetDensity `3x`, byteEstimate `estimateJobBytes(800,600,1200,900)`
    - All three entries push atomically (single set() call) so Strict-Mode dev double-render does not produce partial state.
    - Calling `addSourceWithVariants` a second time with the same `name:'logo.png'` produces names `logo (2)@1x.png`, `logo (2)@2x.png`, `logo (2)@3x.png` (collision dedup) AND `useRuntimeStore.getState().renameCountThisBatch` increments by 3.
    - `addSourceWithVariants` for a non-PNG source (e.g. `format:'webp'`) falls back to byteEstimate `Math.ceil(blob.size * 10 * 4 * 1.75)` per variant — heuristic from RESEARCH §2.2(a).
    - `addSourceWithVariants` with `targets:[]` is a no-op (no entries pushed).
    - `addSourceWithVariants` with `targets:['2x']` and `sourceDensity:'2x'` produces a single entry (locked source density variant).
    - The byteEstimate is seeded ONLY when sniffPngDimensions returns non-null (PNG source); otherwise the heuristic. The estimate is stored on the FileEntryWithBlob (extend the type to include it) AND will be passed to PoolJob.byteEstimate by App.tsx (Plan 04-06).
    - `removeFamily(sourceFamilyId)` calls `removeFile(id)` for every byId entry whose `sourceFamilyId === sourceFamilyId`. Verifies that each call goes through the existing revoke discipline (per RESEARCH §5.2 — DO NOT bypass removeFile).
    - All existing addFile, removeFile, markDone, clear actions remain unchanged. `npm test` (full Phase 1+2+3 suite) still passes.
  </behavior>
  <action>
1. **Add a `byteEstimate?: number` field to `FileEntryWithBlob`** at the top of src/stores/files.ts (extending the existing interface at lines 11-14):
```typescript
export interface FileEntryWithBlob extends FileEntry {
  sourceBlob: Blob
  optimizedBlob: Blob | null
  /** Phase 4 D-11(b) — peak working-set estimate for this variant.
   *  Computed at addSourceWithVariants time via estimateJobBytes (PNG path)
   *  or compression-ratio heuristic (other rasters). App.tsx threads this
   *  into PoolJob.byteEstimate when enqueuing the pool job. */
  byteEstimate?: number
}
```

2. **Add imports** at the top of src/stores/files.ts (after existing zustand + types imports):
```typescript
import { applyDensitySuffix, deduplicateName } from '@/lib/filename'
import { sniffPngDimensions } from '@/lib/sniff'
import { estimateJobBytes } from '@/lib/memory-budget'
import type { FormatId, SourceDensity } from '@/types'
```

3. **Extend FilesState interface** (existing block around lines 16-39). Append two new action declarations after the existing `clear: () => void`:
```typescript
  /** Phase 4 D-04 + D-14 — fan out N FileEntryWithBlob entries per source.
   *  Each entry has id `${sourceUuid}-${density}`, name = applyDensitySuffix
   *  then deduplicateName, sourceFamilyId = sourceUuid, targetDensity = the
   *  variant density, byteEstimate seeded from sniffPngDimensions (PNG) or
   *  the blob.size heuristic. Collisions are reported to useRuntimeStore
   *  via markRename(count). Returns void; entries are pushed atomically. */
  addSourceWithVariants: (args: {
    sourceBlob: Blob
    sourceDensity: SourceDensity
    name: string
    format: FormatId
    targets: SourceDensity[]
  }) => Promise<void>
  /** Phase 4 D-04 — remove all variants sharing a sourceFamilyId.
   *  Loops removeFile(variantId) per entry per RESEARCH §5.2 (preserves URL revoke). */
  removeFamily: (sourceFamilyId: string) => void
```

4. **Implement the two actions** inside the `create()` body, AFTER the existing `clear` action (around line 124):
```typescript
addSourceWithVariants: async (args) => {
  if (args.targets.length === 0) return

  const sourceUuid = crypto.randomUUID()
  // Sniff once per source, reuse across all targets.
  const dims = args.format === 'png' ? await sniffPngDimensions(args.sourceBlob) : null
  // Pre-collect existing names for collision dedup. Read fresh each call.
  const existingNames = new Set<string>(
    Object.values(useFilesStore.getState().byId).map((e) => e.name),
  )

  const newEntries: FileEntryWithBlob[] = []
  let renameCount = 0
  for (const tgt of args.targets) {
    const proposedName = applyDensitySuffix(args.name, tgt)
    const finalName = deduplicateName(proposedName, existingNames)
    if (finalName !== proposedName) renameCount++
    existingNames.add(finalName) // include in subsequent dedup checks (within this batch)

    let byteEstimate: number | undefined
    if (dims) {
      const tgtScale = parseInt(tgt) / parseInt(args.sourceDensity)
      const tgtW = Math.max(1, Math.round(dims.width * tgtScale))
      const tgtH = Math.max(1, Math.round(dims.height * tgtScale))
      byteEstimate = estimateJobBytes(dims.width, dims.height, tgtW, tgtH)
    } else {
      // Non-PNG fallback: blob.size × 10 (typical compression ratio) × 4 (RGBA)
      // × 1.75 (WASM heap multiplier). RESEARCH §2.2(a).
      byteEstimate = Math.ceil(args.sourceBlob.size * 10 * 4 * 1.75)
    }

    newEntries.push({
      id: `${sourceUuid}-${tgt}`,
      name: finalName,
      format: args.format,
      originalSize: args.sourceBlob.size,
      optimizedSize: null,
      status: 'idle',
      sourceDensity: args.sourceDensity,
      targetDensity: tgt,
      sourceFamilyId: sourceUuid,
      thumbnail: null,
      sourceBlob: args.sourceBlob,
      optimizedBlob: null,
      byteEstimate,
    })
  }

  // Atomic push — single set() avoids Strict-Mode partial-write artifacts.
  set((s) => {
    const nextById = { ...s.byId }
    const nextOrder = [...s.order]
    for (const entry of newEntries) {
      if (!nextById[entry.id]) nextOrder.push(entry.id)
      nextById[entry.id] = entry
    }
    return { byId: nextById, order: nextOrder }
  })

  // D-16 — report collisions for the toast latch (Plan 04-06 wires the toast).
  if (renameCount > 0) {
    useRuntimeStore.getState().markRename(renameCount)
  }
},

removeFamily: (sourceFamilyId) => {
  // Snapshot ids first — removeFile mutates byId; iterating live is unsafe.
  const ids = Object.values(useFilesStore.getState().byId)
    .filter((e) => e.sourceFamilyId === sourceFamilyId)
    .map((e) => e.id)
  for (const id of ids) {
    useFilesStore.getState().removeFile(id)
  }
},
```

5. **Verify** that no existing action is altered. Run `git diff src/stores/files.ts` and confirm only ADDITIONS exist (no removed lines other than possibly trailing whitespace).
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; node --experimental-strip-types -e "
import('./src/stores/files.ts').then(async (m) =&gt; {
  const { useFilesStore } = m;
  const { readFileSync } = await import('node:fs');
  const pngBytes = readFileSync('src/tests/fixtures/density-2x.png');
  const blob = new Blob([pngBytes], { type: 'image/png' });
  await useFilesStore.getState().addSourceWithVariants({
    sourceBlob: blob, sourceDensity: '2x', name: 'logo.png', format: 'png', targets: ['1x','2x','3x'],
  });
  const ids = useFilesStore.getState().order;
  if (ids.length !== 3) { console.error('FAIL count', ids); process.exit(1); }
  const names = ids.map((id) =&gt; useFilesStore.getState().byId[id].name).sort();
  const expected = ['logo@1x.png','logo@2x.png','logo@3x.png'];
  if (JSON.stringify(names) !== JSON.stringify(expected)) { console.error('FAIL names', names); process.exit(1); }
  const fam = useFilesStore.getState().byId[ids[0]].sourceFamilyId;
  if (!fam) { console.error('FAIL family'); process.exit(1); }
  const allSameFamily = ids.every((id) =&gt; useFilesStore.getState().byId[id].sourceFamilyId === fam);
  if (!allSameFamily) { console.error('FAIL family share'); process.exit(1); }
  // Each variant has a positive byteEstimate
  const allHaveEstimate = ids.every((id) =&gt; (useFilesStore.getState().byId[id].byteEstimate ?? 0) &gt; 0);
  if (!allHaveEstimate) { console.error('FAIL estimate'); process.exit(1); }
  // Second add: triggers collision dedup
  await useFilesStore.getState().addSourceWithVariants({
    sourceBlob: blob, sourceDensity: '2x', name: 'logo.png', format: 'png', targets: ['1x'],
  });
  const allNames = Object.values(useFilesStore.getState().byId).map((e) =&gt; e.name).sort();
  if (!allNames.includes('logo (2)@1x.png')) { console.error('FAIL dedup', allNames); process.exit(1); }
  // removeFamily nukes all 3 originals
  useFilesStore.getState().removeFamily(fam);
  const remaining = useFilesStore.getState().order.length;
  if (remaining !== 1) { console.error('FAIL removeFamily', remaining, useFilesStore.getState().order); process.exit(1); }
  console.log('files-store fan-out OK');
});
" &amp;&amp; npm test 2&gt;&amp;1 | tail -5 | grep -E "(passed|failed)"</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - The inline node verifier prints `files-store fan-out OK` and exits 0.
    - `grep -c "addSourceWithVariants" src/stores/files.ts` returns at least 2 (interface declaration + implementation).
    - `grep -c "removeFamily" src/stores/files.ts` returns at least 2.
    - `grep -c "byteEstimate" src/stores/files.ts` returns at least 3 (FileEntryWithBlob field + 2 use sites).
    - `grep -c "applyDensitySuffix\|deduplicateName" src/stores/files.ts` returns at least 2.
    - `grep -c "markRename" src/stores/files.ts` returns 1 (cross-store call).
    - `grep -c "sniffPngDimensions" src/stores/files.ts` returns 1.
    - `npm test` exits 0 (full Phase 1+2+3 regression — addFile callers in worker-pool.spec.ts, object-url.spec.ts, svg-pipeline.spec.ts unaffected).
  </acceptance_criteria>
  <done>addSourceWithVariants fans out N FileEntries with correct ids, names, family, density tags, byte estimates; removeFamily cascades through removeFile preserving URL revoke; collision dedup reports to runtime store via markRename; all prior tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add resize slice to useSettingsStore</name>
  <read_first>
    - src/stores/settings.ts (full file — SettingsState interface lines 29-48, body lines 50-77)
    - src/data/defaults.ts (Plan 04-01 — DEFAULT_RESIZE_SETTINGS exported)
    - src/types/index.ts (line 37 — ResizeAlg type export)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 488-504 — verbatim resize-slice pattern)
    - .planning/phases/04-decode-resize-memory-model/04-CONTEXT.md (D-05 + D-06 — global TweaksPanel setting; default lanczos3)
  </read_first>
  <files>src/stores/settings.ts</files>
  <behavior>
    - Initial state: `useSettingsStore.getState().resize.alg === 'lanczos3'`.
    - `useSettingsStore.getState().setResize({alg: 'mitchell'})` mutates `resize.alg` to `'mitchell'`.
    - Partial-merge semantics: passing `{}` to setResize is a no-op (preserves existing alg).
    - Existing `global.preserveIccProfile` field is unchanged at default `false` (Plan 04-01 already verified via `settings-icc.test.ts`).
    - Existing setters (setSvg, setPng, setJpeg, setWebp, setAvif, setGlobal, setSnippetToggle) remain unchanged.
    - All Phase 1+2+3 specs still pass.
  </behavior>
  <action>
1. **Edit src/stores/settings.ts** — add the import for the new default (after existing default imports around lines 21-27):
```typescript
import {
  DEFAULT_CODEC_SVG,
  DEFAULT_CODEC_PNG,
  DEFAULT_CODEC_JPEG,
  DEFAULT_CODEC_WEBP,
  DEFAULT_CODEC_AVIF,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_RESIZE_SETTINGS,    // <-- ADD this line (Plan 04-01)
} from '@/data/defaults'
```

2. **Add the `ResizeAlg` import** (extend the existing types import at lines 12-19):
```typescript
import type {
  CodecSettingsSvg,
  CodecSettingsPng,
  CodecSettingsJpeg,
  CodecSettingsWebp,
  CodecSettingsAvif,
  GlobalSettings,
  ResizeAlg,                  // <-- ADD this line
} from '@/types'
```

3. **Extend SettingsState interface** (lines 29-48). Append AFTER `snippetTogglesByFileId` and BEFORE the setter declarations:
```typescript
  // Phase 4 D-05 + D-06 — global resize algorithm (TweaksPanel "Resize / Variants" section).
  // Per-file override lives on FileEntry.resizeOverride (Plan 04-01 added field;
  // UI deferred to Phase 5 detail view per D-07).
  resize: { alg: ResizeAlg }
```

Append AFTER the existing setters and BEFORE the closing brace:
```typescript
  setResize: (next: Partial<{ alg: ResizeAlg }>) => void
```

4. **Add the seed** in the `create()` body. After the existing `snippetTogglesByFileId: {},` line (around line 58), add:
```typescript
resize: DEFAULT_RESIZE_SETTINGS,
```

5. **Add the setter** after the existing `setGlobal` line (around line 65):
```typescript
setResize: (next) => set((s) => ({ resize: { ...s.resize, ...next } })),
```
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; node --experimental-strip-types -e "
import('./src/stores/settings.ts').then((m) =&gt; {
  const s = m.useSettingsStore.getState();
  if (s.resize?.alg !== 'lanczos3') { console.error('FAIL initial', s.resize); process.exit(1); }
  s.setResize({ alg: 'mitchell' });
  if (m.useSettingsStore.getState().resize.alg !== 'mitchell') { console.error('FAIL update'); process.exit(1); }
  s.setResize({});
  if (m.useSettingsStore.getState().resize.alg !== 'mitchell') { console.error('FAIL noop merge'); process.exit(1); }
  // global.preserveIccProfile unchanged
  if (m.useSettingsStore.getState().global.preserveIccProfile !== false) { console.error('FAIL global'); process.exit(1); }
  console.log('settings resize slice OK');
});
" &amp;&amp; node --experimental-strip-types src/tests/settings-icc.test.ts &amp;&amp; npm test 2&gt;&amp;1 | tail -5 | grep -E "(passed|failed)"</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - The inline node verifier prints `settings resize slice OK` and exits 0.
    - `node --experimental-strip-types src/tests/settings-icc.test.ts` exits 0 (Plan 04-01 spec still passes — no regression on global.preserveIccProfile).
    - `grep -c "DEFAULT_RESIZE_SETTINGS" src/stores/settings.ts` returns at least 2 (import + seed).
    - `grep -c "setResize" src/stores/settings.ts` returns at least 2 (interface + body).
    - `grep -c "resize:" src/stores/settings.ts` returns at least 2 (interface + seed).
    - `npm test` exits 0 (full regression).
  </acceptance_criteria>
  <done>useSettingsStore.resize.alg defaults to lanczos3; setResize honors partial merge; existing slices and setters untouched; settings-icc test still green; full Phase 1+2+3 regression passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User-supplied filename → store + ZIP + snippet pipeline | Filename eventually reaches DOM (file row name) and ZIP entry name; downstream Phase 6 must not interpolate it into HTML attributes without escaping |
| User-supplied PNG bytes → sniffPngDimensions | First 24 bytes parsed; threats already covered by Plan 04-02 T-04-02-03 (size-bounded read) |
| Variant id collision space | `${uuid}-1x|2x|3x` cannot collide across sources because crypto.randomUUID is 122-bit entropy; intra-source duplicate target rejection is responsibility of Plan 04-06 UI (target-checkbox group prevents) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-05-01 | Tampering | Adversarial filename like `<script>alert(1)</script>.png` | mitigate | Filename is stored verbatim in FileEntry.name; React renders it via JSX text interpolation (auto-escapes). ZIP and snippet output (Phase 6/7) MUST also escape — flagged as cross-phase dependency, not Plan 04-05's responsibility. |
| T-04-05-02 | Information Disclosure | Filename collisions across batch sessions overwrite blobs | mitigate | deduplicateName runs against the LIVE byId set on every addSourceWithVariants call; collisions across sequential drops are detected and renamed. Verified by Task 1 acceptance criteria. |
| T-04-05-03 | Denial of Service | User drops 10000-file batch → fan-out OOM | accept | UI (Plan 04-06) does not impose a hard cap; pool admission gate (Plan 04-04) bounds peak concurrency. Soft mitigation: byteEstimate computation is O(N) with a single sniff-per-source — no quadratic blowup. |
| T-04-05-04 | Tampering | sourceFamilyId collision via crypto.randomUUID weakness | accept | crypto.randomUUID is the standard secure UUID API in modern browsers (122-bit entropy). Collision probability is negligible for any realistic batch size. |
| T-04-05-05 | Repudiation | Variant entry attribution lost if sourceFamilyId malformed | mitigate | sourceFamilyId is set ONLY in addSourceWithVariants (single code path); Task 1 acceptance criteria verifies all variants of one source share the family id. |
| T-04-05-06 | Information Disclosure | byteEstimate leaks heap-pressure heuristic to downstream consumers | accept | byteEstimate is internal to the optimization pipeline; not surfaced in UI, not in snippets, not in ZIP. Telemetry-only. |
</threat_model>

<verification>
- npx tsc --noEmit passes.
- The inline integration verifier in Task 1 exercises fan-out (3 entries, correct names, shared family, byteEstimates), collision dedup (count incremented), removeFamily (cascades through removeFile).
- Settings store gains a working resize slice with default lanczos3.
- All Phase 1+2+3 regression tests still pass.
</verification>

<success_criteria>
- useFilesStore.addSourceWithVariants materializes N FileEntries atomically with all four Plan-04-01 fields populated.
- byteEstimate is set per variant (PNG sniff-based or non-PNG heuristic).
- Collision counter cross-store call to markRename works (Plan 04-06 reads it for the toast).
- removeFamily preserves URL-revoke discipline by looping removeFile.
- resize slice exists with setResize partial-merge semantics.
- Full regression green.
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-05-SUMMARY.md` documenting the addSourceWithVariants signature, the cross-store call to markRename, the byteEstimate heuristic for non-PNG fallback, and the removeFamily cascade-via-removeFile decision.
</output>
