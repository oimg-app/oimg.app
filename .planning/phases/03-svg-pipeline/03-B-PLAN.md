---
phase: 03-svg-pipeline
plan: B
type: execute
wave: 2
depends_on: [03-A]
files_modified:
  - src/components/panels/SvgoPanel.tsx
  - src/stores/settings.ts
  - src/stores/runtime.ts
  - src/App.tsx
autonomous: true
requirements:
  - OPT-01

must_haves:
  truths:
    - "SvgoPanel renders exactly 12 curated plugins in remove→cleanup→convert→minify order"
    - "removeViewBox and removeDimensions default to OFF (not in preset-default); foot-gun hints render always-visible below those rows and cleanupIds"
    - "Plugin toggle auto re-optimizes the selected file (D-08); debounced 200ms; cancel+restart on each toggle (D-11)"
    - "Post-batch live savings column shows aggregate bytes/% per plugin in SvgoPanel (D-06)"
    - "Sanitization section has Toggle for unsafe-export (D-04); default OFF; badge shows 'safe'/'unsafe'"
    - "Aggressive-mode butteraugli toggle is deleted from SvgoPanel"
  artifacts:
    - path: "src/components/panels/SvgoPanel.tsx"
      provides: "Rewritten panel: 12 curated plugins + live savings col + foot-gun hints + Sanitization section"
      exports: ["SvgoPanel"]
    - path: "src/stores/settings.ts"
      provides: "Extended: unsafeExport, pluginSavings, subscribeWithSelector plugin-change subscriber"
    - path: "src/stores/runtime.ts"
      provides: "Extended: previewJobId + debounced enqueuePreview (D-11)"
  key_links:
    - from: "src/components/panels/SvgoPanel.tsx"
      to: "src/stores/settings.ts"
      via: "useSettingsStore.svg.plugins + setSvg"
      pattern: "useSettingsStore"
    - from: "src/stores/settings.ts"
      to: "src/stores/runtime.ts"
      via: "subscribeWithSelector plugin changes → enqueuePreview"
      pattern: "enqueuePreview"
    - from: "src/stores/runtime.ts"
      to: "src/workers/pool.ts"
      via: "WorkerPool.cancel() + enqueue() in enqueuePreview"
      pattern: "getWorkerPool\\(\\)"
---

<objective>
Rewrite SvgoPanel with the 12-plugin curated set, live per-plugin savings, foot-gun warnings, and the global sanitization toggle. Wire D-10/D-11 real-time re-optimize on plugin toggle (debounced cancel+restart). Implement D-06 post-batch N+1 savings computation.

Purpose: Delivers the interactive SVGO UX — the plugin-toggle-and-watch-it-shrink feel (SVGOMG-style). Closes OPT-01 interactive requirement.
Output: SvgoPanel fully wired. Plugin toggle → debounce → pool cancel → re-optimize → markDone → size delta updates. Post-batch savings column populated.
</objective>

<execution_context>
@/Users/jilizart/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jilizart/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-svg-pipeline/03-CONTEXT.md
@.planning/phases/03-svg-pipeline/03-RESEARCH.md
@.planning/phases/03-svg-pipeline/03-PATTERNS.md
@.planning/phases/03-svg-pipeline/03-UI-SPEC.md
@.planning/phases/03-svg-pipeline/03-A-SUMMARY.md

<interfaces>
<!-- Contracts from Plan A that this plan depends on. -->

From src/workers/svg-adapter.ts (Plan A output):
```typescript
export function buildSvgoConfig(settings: CodecSettingsSvg): Parameters<typeof optimize>[1]
export async function run(input: ArrayBuffer, settings: unknown): Promise<{ output: ArrayBuffer; meta: AdapterMeta }>
```

From src/lib/sanitize-svg.ts (Plan A output):
```typescript
export function sanitizeSvg(svgString: string, unsafe: boolean): { clean: string; sanitizedCount: number }
```

From src/types/index.ts (Plan A extensions):
```typescript
interface CodecSettingsSvg {
  preset: 'default'
  plugins: Record<string, boolean>
  unsafeExport?: boolean
  pluginSavings?: Record<string, { bytes: number; pct: number }>
}
```

From src/stores/settings.ts (existing):
```typescript
// useSettingsStore already has subscribeWithSelector middleware
// svg: CodecSettingsSvg slice with setSvg action
```

From src/stores/runtime.ts (existing):
```typescript
// WorkerPool accessible via getWorkerPool() or pool singleton
// running: boolean — true when batch in flight
```

SvgoPanel curated 12-plugin order (UI-SPEC.md + RESEARCH.md §Curated Plugin Set — locked):
```
removeComments(on), removeMetadata(on), removeUselessDefs(on), removeUnusedNS(on),
cleanupIds(on, footgun), cleanupNumericValues(on), convertColors(on),
convertPathData(on), mergePaths(on), minifyStyles(on),
removeViewBox(off, footgun), removeDimensions(off, footgun)
```

Foot-gun hint copy (UI-SPEC.md §Foot-gun hint copy — verbatim):
- cleanupIds: `May break external CSS or <use> references that target SVG element ids`
- removeViewBox: `Disabling viewBox can break responsive scaling when the SVG is embedded in HTML or CSS`
- removeDimensions: `Removes width/height attributes — only safe when viewBox is preserved`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend stores — settings (unsafeExport + pluginSavings + snippetToggles) + runtime (previewJobId + enqueuePreview)</name>
  <files>
    src/stores/settings.ts
    src/stores/runtime.ts
  </files>
  <action>
**Read first:**
- `src/stores/settings.ts` — full file; find SettingsState interface and create body
- `src/stores/runtime.ts` — full file; find RuntimeState interface and create body; find getWorkerPool() import or pool singleton access
- `src/workers/pool.ts` — WorkerPool.cancel() signature and enqueue() signature
- `src/stores/files.ts` — getState().selectedId access pattern

**settings.ts extensions:**

1. Extend `SettingsState` interface with:
```typescript
snippetTogglesByFileId: Record<string, Record<string, boolean>>  // D-13
setSnippetToggle: (fileId: string, snippetId: string, value: boolean) => void
```

2. In `create` body, add initial state and action:
```typescript
snippetTogglesByFileId: {},
setSnippetToggle: (fileId, snippetId, value) =>
  set((s) => ({
    snippetTogglesByFileId: {
      ...s.snippetTogglesByFileId,
      [fileId]: { ...s.snippetTogglesByFileId[fileId], [snippetId]: value },
    },
  })),
```

3. The `setSvg` action already exists. The `unsafeExport` and `pluginSavings` fields are already in `CodecSettingsSvg` (added in Plan A). Verify `setSvg` accepts partial updates (uses spread). No changes needed to setSvg itself.

**runtime.ts extensions:**

1. Extend `RuntimeState` interface with:
```typescript
previewJobId: string | null   // D-11: tracks pending preview job
enqueuePreview: (fileId: string) => void  // debounced 200ms (D-11)
```

2. In `create` body, add:
```typescript
previewJobId: null,
```

3. Add debounced `enqueuePreview` action. Import debounce from a utility or implement inline. Read how WorkerPool is accessed (pool singleton or getter). Pattern from RESEARCH.md §Pattern 5:

```typescript
// Debounce implementation — inline to avoid adding a lodash dependency
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => { fn(...args); timer = null }, ms)
  }) as T
}

// In RuntimeState create body:
enqueuePreview: debounce((fileId: string) => {
  const state = get()
  const pool = getWorkerPool()  // use whatever pool-access pattern exists in runtime.ts
  if (!state.running) {
    // No batch in flight — safe to cancel for instant preview
    pool.cancel()
  }
  const jobId = crypto.randomUUID()
  set({ previewJobId: jobId })
  // Enqueue a single-file optimize job through the pool
  const files = (await import('../stores/files')).useFilesStore.getState()
  const settings = useSettingsStore.getState()
  const fileEntry = files.byId[fileId]
  if (!fileEntry || fileEntry.format !== 'svg' || !fileEntry.sourceBlob) return
  const input = await fileEntry.sourceBlob.arrayBuffer()
  pool.enqueue({
    id: jobId,
    fileId,
    format: 'svg',
    input,
    settings: settings.svg,
  })
}, 200),
```

NOTE: Read the existing WorkerPool `enqueue` call in `App.tsx` or `runtime.ts` to match the exact job shape the pool expects (may be `{ id, fileId, format, blob, settings }` or similar). Use that shape verbatim.

**Wire plugin-change subscriber for D-10:**

Add a module-level subscriber (outside the store create call, or in a `setupStoreSubscriptions()` exported function called from App.tsx):

```typescript
// In src/stores/settings.ts or called from App.tsx setupEffect:
useSettingsStore.subscribe(
  (s) => s.svg.plugins,
  () => {
    const selectedId = useFilesStore.getState().selectedId
    if (selectedId) {
      const selectedEntry = useFilesStore.getState().byId[selectedId]
      if (selectedEntry?.format === 'svg') {
        useRuntimeStore.getState().enqueuePreview(selectedId)
      }
    }
  },
  { equalityFn: Object.is }  // shallow comparison on the plugins record reference
)
```

This ensures plugin toggle → enqueuePreview → cancel+restart debounce (D-10, D-11).
  </action>
  <verify>
    <automated>
      grep -c "previewJobId" src/stores/runtime.ts &amp;&amp;
      grep -c "enqueuePreview" src/stores/runtime.ts &amp;&amp;
      grep -c "snippetTogglesByFileId" src/stores/settings.ts &amp;&amp;
      grep -c "setSnippetToggle" src/stores/settings.ts &amp;&amp;
      npx tsc --noEmit
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep "previewJobId" src/stores/runtime.ts` matches (in interface + create body)
    - `grep "enqueuePreview" src/stores/runtime.ts` matches (debounced action)
    - `grep "snippetTogglesByFileId" src/stores/settings.ts` matches (in interface + create body)
    - `grep "setSnippetToggle" src/stores/settings.ts` matches (action)
    - Plugin change subscriber wired (grep `useSettingsStore.subscribe` in settings.ts or App.tsx)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Store extensions committed. previewJobId + enqueuePreview in runtime store. snippetTogglesByFileId + setSnippetToggle in settings store. Plugin-change subscriber wired.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite SvgoPanel.tsx — 12 plugins + live savings + foot-gun hints + Sanitization section + D-06 post-batch savings trigger</name>
  <files>
    src/components/panels/SvgoPanel.tsx
    src/App.tsx
  </files>
  <action>
**Read first:**
- `src/components/panels/SvgoPanel.tsx` — FULL current file (aggressive-mode section to delete; plugin row pattern to extend; Section + Toggle imports)
- `src/components/ui/Section.tsx` — Section props interface (title, badge, children)
- `src/components/ui/Toggle.tsx` or equivalent — Toggle props interface
- `src/components/icons/index.tsx` — available icons; find Shield or Info-circle glyph for foot-gun warning (use Icons.Shield or nearest; do NOT import a new icon library)
- `src/App.tsx` — pool onDone callback location; find where post-batch completion logic runs to wire D-06 savings computation

**SvgoPanel rewrite:**

Replace the entire component body (keep imports structure). New props interface:

```typescript
interface SvgoPanelProps {
  plugins: Array<{
    id: string
    on: boolean
    savings: { bytes: number; pct: number } | null  // null = no Optimize batch run yet
    footgun?: string  // hint copy or undefined
  }>
  togglePlugin: (id: string) => void
  unsafeExport: boolean
  setUnsafeExport: (v: boolean) => void
}
```

Plugin metadata constant (inside the component file, not props — computed from DEFAULT_CODEC_SVG.plugins order):

```typescript
// Locked order per UI-SPEC.md §Curated plugin set
const PLUGIN_META: Array<{ id: string; footgun?: string }> = [
  { id: 'removeComments' },
  { id: 'removeMetadata' },
  { id: 'removeUselessDefs' },
  { id: 'removeUnusedNS' },
  { id: 'cleanupIds', footgun: 'May break external CSS or <use> references that target SVG element ids' },
  { id: 'cleanupNumericValues' },
  { id: 'convertColors' },
  { id: 'convertPathData' },
  { id: 'mergePaths' },
  { id: 'minifyStyles' },
  { id: 'removeViewBox', footgun: 'Disabling viewBox can break responsive scaling when the SVG is embedded in HTML or CSS' },
  { id: 'removeDimensions', footgun: 'Removes width/height attributes — only safe when viewBox is preserved' },
]
```

Render structure (preserve exact CSS class names from existing SvgoPanel):

```tsx
<>
  {/* Section 1: SVGO preset — preserve verbatim */}
  <Section title="SVGO preset" badge={{ text: 'preset-default', acc: true }}>
    {/* Content: brief description or empty */}
  </Section>

  {/* Section 2: Plugins */}
  <Section
    title={`Plugins · ${plugins.filter(p => p.on).length} / ${plugins.length}`}
    badge={undefined}
  >
    <div className="plugins">
      {PLUGIN_META.map(meta => {
        const p = plugins.find(x => x.id === meta.id)
        if (!p) return null
        return (
          <div key={meta.id}>
            <div className="plugin">
              <button
                className={'check' + (p.on ? ' on' : '')}
                onClick={() => togglePlugin(meta.id)}
                aria-pressed={p.on}
                aria-label={`${meta.id} plugin ${p.on ? 'enabled' : 'disabled'}`}
              />
              <span className="name">{meta.id}</span>
              <span className="saves" style={{ color: p.savings && p.savings.pct > 0 ? 'var(--accent)' : 'inherit' }}>
                {p.savings === null
                  ? ''                           /* no batch run yet — empty, per UI-SPEC */
                  : p.savings.pct === 0
                    ? '—'                        /* measured zero */
                    : `${p.savings.pct.toFixed(1)}%`}
              </span>
            </div>
            {meta.footgun && (
              <p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>
                {/* Icons.Shield or nearest warn icon glyph — verify in icons/index.tsx */}
                <Icons.Shield size={13} style={{ color: 'var(--warn)', verticalAlign: 'middle', marginRight: 4 }} />
                {meta.footgun}
              </p>
            )}
          </div>
        )
      })}
    </div>
  </Section>

  {/* Section 3: Sanitization (D-04) — replaces deleted Aggressive mode section */}
  <Section
    title="Sanitization"
    badge={{ text: unsafeExport ? 'unsafe' : 'safe', acc: !unsafeExport }}
  >
    <div className="plugin" style={{ paddingTop: 6 }}>
      <span className="name" style={{ fontSize: '11.5px', color: 'var(--fg-2)', flex: 1 }}>
        Disable on export
      </span>
      <Toggle value={unsafeExport} onChange={setUnsafeExport} />
    </div>
    <p style={{ margin: '4px 0 0', font: '10.5px var(--mono)', color: 'var(--fg-3)', lineHeight: 1.5 }}>
      Advanced. Skips the DOMPurify pass on the exported SVG. Preview, snippets, and ZIP all use the unsanitized output. Off by default.
    </p>
  </Section>
</>
```

DELETE the existing "Aggressive mode" / butteraugli section (lines ~16-24 in the current SvgoPanel) — per UI-SPEC.md §Copywriting Contract: "REMOVED in Phase 3."

**Wire SvgoPanel props in App.tsx:**

Find where `<SvgoPanel />` is rendered in App.tsx. Update its props to pass the new interface:

```tsx
// In App.tsx, near the SvgoPanel mount (tab === 'svgo'):
const svgSettings = useSettingsStore(s => s.svg)
const setSvg = useSettingsStore(s => s.setSvg)
const plugins = Object.entries(svgSettings.plugins).map(([id, on]) => ({
  id,
  on,
  savings: svgSettings.pluginSavings?.[id] ?? null,
  footgun: PLUGIN_FOOTGUNS[id],  // import the footgun map from SvgoPanel or define locally
}))
```

**D-06: Post-batch live savings computation:**

In the pool's batch-completion handler (find in App.tsx or useRuntimeStore — where `running` transitions from `true` to `false` and all jobs are done), add:

```typescript
// After all SVG files in the batch are done:
// For each SVG file, run N+1 SVGO passes to measure per-plugin savings
// Pattern from RESEARCH.md §Performance Budget for D-06:
// Queue savings jobs immediately after batch; pool processes them in parallel

async function computePluginSavings(fileIds: string[]) {
  const settings = useSettingsStore.getState().svg
  const pluginIds = Object.keys(settings.plugins)
  const savings: Record<string, { bytes: number; pct: number }> = {}

  const svgFiles = fileIds
    .map(id => useFilesStore.getState().byId[id])
    .filter(f => f && f.format === 'svg' && f.optimizedBlob)

  if (svgFiles.length === 0) return

  // Baseline: all-on pass per file
  // Per-plugin: disabled pass per file
  // Use Promise.race with 5s timeout per RESEARCH.md §Abort threshold
  const TIMEOUT_MS = 5000
  const savingsJobs = pluginIds.map(async (pluginId) => {
    let totalBaselineBytes = 0
    let totalDisabledBytes = 0
    for (const file of svgFiles) {
      const text = await file!.optimizedBlob!.text()
      const { optimize } = await import('./workers/svg-adapter')
      // Baseline: current settings
      const base = await import('./workers/svg-adapter').then(m =>
        m.run(new TextEncoder().encode(text).buffer, settings))
      totalBaselineBytes += base.output.byteLength
      // Disabled: this plugin off
      const disabledPlugins = { ...settings.plugins, [pluginId]: false }
      const disabled = await import('./workers/svg-adapter').then(m =>
        m.run(new TextEncoder().encode(text).buffer, { ...settings, plugins: disabledPlugins }))
      totalDisabledBytes += disabled.output.byteLength
    }
    const bytesDiff = totalDisabledBytes - totalBaselineBytes
    const pct = totalBaselineBytes > 0 ? (bytesDiff / totalDisabledBytes) * 100 : 0
    savings[pluginId] = { bytes: bytesDiff, pct: Math.max(0, pct) }
  })

  try {
    await Promise.race([
      Promise.all(savingsJobs),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('savings timeout')), TIMEOUT_MS))
    ])
    useSettingsStore.getState().setSvg({ pluginSavings: savings })
  } catch {
    // Timeout — leave savings empty (SvgoPanel shows '—' for all plugins)
    console.warn('[oimg] Plugin savings computation timed out — showing —')
  }
}
```

NOTE: The savings computation runs svg-adapter.run() on the MAIN thread using the imported function directly (not through the pool), since this is a background computation after the user's batch is done. This avoids worker pool contention. SVGO is synchronous (RESEARCH.md Assumption A2) so calling it on the main thread in microtasks is acceptable for post-batch analysis.

Call `computePluginSavings(completedSvgFileIds)` in the batch-completion lifecycle — find the exact hook point in App.tsx or runtime store (the place that sets `running: false` after all jobs complete).
  </action>
  <verify>
    <automated>
      grep -c "removeViewBox" src/components/panels/SvgoPanel.tsx &amp;&amp;
      grep -c "Sanitization" src/components/panels/SvgoPanel.tsx &amp;&amp;
      grep -c "butteraugli\|Aggressive" src/components/panels/SvgoPanel.tsx | grep -q "^0$" &amp;&amp;
      grep -c "footgun" src/components/panels/SvgoPanel.tsx &amp;&amp;
      grep -c "pluginSavings" src/App.tsx &amp;&amp;
      npx tsc --noEmit
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep "removeViewBox" src/components/panels/SvgoPanel.tsx` returns a match (plugin in list)
    - `grep "Sanitization" src/components/panels/SvgoPanel.tsx` returns a match (Section title)
    - `grep -i "butteraugli\|aggressive mode" src/components/panels/SvgoPanel.tsx` returns NO match (deleted)
    - `grep "footgun" src/components/panels/SvgoPanel.tsx` returns a match (hint rendering)
    - 12 plugin entries visible in PLUGIN_META array (count `{ id:` entries)
    - `grep "Disable on export" src/components/panels/SvgoPanel.tsx` returns a match (verbatim copy)
    - `grep "pluginSavings" src/App.tsx` returns a match (D-06 savings passed to panel)
    - `grep "enqueuePreview" src/App.tsx` returns a match (D-11 debounce wired)
    - `npx tsc --noEmit` exits 0
    - `npx playwright test src/tests/svg-pipeline.spec.ts -g "plugin list"` completes (stub or live)
  </acceptance_criteria>
  <done>SvgoPanel fully rewritten. 12 plugins with live savings column. Foot-gun hints always-visible on cleanupIds/removeViewBox/removeDimensions. Sanitization section with unsafe-export Toggle. D-06 post-batch savings computation wired. Aggressive-mode section deleted.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User toggles plugin → store → pool | Plugin toggle drives re-optimization; cancel race window exists between toggle and new job |
| unsafeExport toggle → sanitize-svg.ts | Global setting bypasses DOMPurify; must be clearly labeled |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-V5-06 | Information Disclosure | `src/components/panels/SvgoPanel.tsx` Sanitization section | mitigate | Toggle default = `false` (sanitize). Section copy reads "Advanced. Skips DOMPurify..." Badge changes from `safe` (acc) to `unsafe` (warn). No modal — user-acknowledged per D-04. Verified by `svg-xss.spec.ts -g "unsafe export toggle"` |
</threat_model>

<verification>
```bash
# After Task 1 (store extensions):
grep "previewJobId" src/stores/runtime.ts
grep "snippetTogglesByFileId" src/stores/settings.ts
npx tsc --noEmit

# After Task 2 (SvgoPanel rewrite):
grep "Sanitization" src/components/panels/SvgoPanel.tsx
grep -c "footgun" src/components/panels/SvgoPanel.tsx  # must be > 0
grep -c "butteraugli" src/components/panels/SvgoPanel.tsx  # must be 0
npx tsc --noEmit
npx playwright test src/tests/svg-pipeline.spec.ts src/tests/svg-xss.spec.ts
```
</verification>

<success_criteria>
- SvgoPanel renders 12 plugins in locked order (removeComments → removeDimensions)
- `removeViewBox` and `removeDimensions` rows show default OFF state; foot-gun hints always visible below them
- `cleanupIds` row shows always-visible foot-gun hint
- Sanitization section present with Toggle defaulting to OFF (`safe` badge, accent modifier)
- Toggling a plugin while an SVG file is selected → debounced 200ms → pool cancel → re-optimize → file row updates size delta
- Post-batch completion → SvgoPanel `.saves` column shows % values per plugin (not empty)
- `npx tsc --noEmit` exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/03-svg-pipeline/03-B-SUMMARY.md`
</output>
