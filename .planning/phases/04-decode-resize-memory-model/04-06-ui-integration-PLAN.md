---
phase: 04
plan: 06
type: execute
wave: 3
depends_on: ["04-03", "04-04", "04-05"]
files_modified:
  - src/components/panels/TweaksPanel.tsx
  - src/components/file-row/SourceDensityControl.tsx
  - src/components/file-row/TargetDensityCheckboxes.tsx
  - src/components/shell/BackpressureIndicator.tsx
  - src/components/shell/StatusBar.tsx
autonomous: true
requirements: [PIPE-04, PIPE-01, OPT-06]
must_haves:
  truths:
    - "TweaksPanel exposes Resize / Variants section with algorithm dropdown bound to useSettingsStore.resize.alg (D-06, UI-SPEC §Surface 4)"
    - "TweaksPanel exposes Privacy / Metadata section with Strip metadata + Preserve ICC color profiles toggles (UI-SPEC §Surface 5); preserve-ICC helper text is the locked verbatim string (UI-SPEC §Surface 9)"
    - "File-row gains hover-revealed source-density popover trigger + target-density checkbox group (D-01, D-02, UI-SPEC §Surface 1, 2)"
    - "Source-density checkbox is locked + dim-accent fill (UI-SPEC §Surface 2 Acceptance)"
    - "StatusBar renders BackpressureIndicator pill between worker-pip and SVGO version when throttleActive is true (D-13, UI-SPEC §Surface 6)"
  artifacts:
    - path: "src/components/panels/TweaksPanel.tsx"
      provides: "Resize / Variants + Privacy / Metadata sections"
      contains: "Resize / Variants"
    - path: "src/components/file-row/SourceDensityControl.tsx"
      provides: "Hover-revealed source-density popover"
      contains: "useFilesStore"
    - path: "src/components/file-row/TargetDensityCheckboxes.tsx"
      provides: "Target-density checkbox group with locked source"
      contains: "aria-checked"
    - path: "src/components/shell/BackpressureIndicator.tsx"
      provides: "StatusBar throttle pill"
      contains: "throttleActive"
    - path: "src/components/shell/StatusBar.tsx"
      provides: "Slot for BackpressureIndicator"
      contains: "BackpressureIndicator"
  key_links:
    - from: "src/components/shell/BackpressureIndicator.tsx"
      to: "src/stores/runtime.ts"
      via: "throttleActive selector"
      pattern: "throttleActive"
    - from: "src/components/file-row/SourceDensityControl.tsx"
      to: "src/stores/files.ts setSourceDensity"
      via: "popover onSelect"
      pattern: "setSourceDensity"
    - from: "src/components/panels/TweaksPanel.tsx"
      to: "src/stores/settings.ts resize.alg"
      via: "Algorithm dropdown"
      pattern: "useSettingsStore"
---

<objective>
Land the Phase 4 user-visible component surface. Single task: build TweaksPanel sections (Resize / Variants + Privacy / Metadata), file-row controls (SourceDensityControl + TargetDensityCheckboxes), StatusBar BackpressureIndicator pill + StatusBar slot edit. Components are presentational + selector-bound; they do NOT mutate behavior of startOptimize or the pool callbacks (those land in Plan 04-07).

Purpose: split the original 04-06 (which combined components + App.tsx wiring + test flip + UAT into one 4-task plan at 8 files / context-exhaustion risk) into a focused components-only plan + a wiring/UAT plan (04-07). Plan 04-06 ships the surfaces; Plan 04-07 wires them and verifies end-to-end.

Output: 4 new component files + 1 component edit. No behavior change to App.tsx, pool callbacks, startOptimize, runtime subscribers, or raster.spec.ts. All wiring + test flips happen in Plan 04-07.
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
@src/components/shell/StatusBar.tsx
@src/components/panels/SvgoPanel.tsx
@src/components/panels/CodecPanel.tsx
@src/components/ui/Section.tsx
@src/components/ui/Toggle.tsx
@src/components/ui/Seg.tsx
@src/components/ui/Popover.tsx
@src/stores/runtime.ts
@src/stores/files.ts
@src/stores/settings.ts

<interfaces>
**UI primitives (existing Phase 1):**
- `<Section title="...">` from `src/components/ui/Section.tsx`
- `<Toggle value={...} onChange={...} />` from `src/components/ui/Toggle.tsx`
- `<Seg options={...} value={...} onChange={...} ariaLabel="..." />` from `src/components/ui/Seg.tsx`
- `<Popover open onClose={...} anchor="br" style={...}>` from `src/components/ui/Popover.tsx`
- Icons from `src/components/icons/` (existing; ChevronDown likely available)

**StatusBar slot insertion (UI-SPEC §Surface 6 lines 261):** new pill is the SECOND item, between worker-pip (line 25-28) and `<span class="item">SVGO 4.0.1</span>` (line 29).

**Locked copy (UI-SPEC §Copywriting Contract):**
- TweaksPanel resize section H3: `Resize / Variants`
- TweaksPanel resize row label: `Algorithm`
- TweaksPanel resize options labels: `Lanczos3 (default)`, `Mitchell`, `Catrom`, `Triangle`
- TweaksPanel privacy section H3: `Privacy / Metadata`
- Strip toggle helper text: `Removes EXIF, XMP, IPTC, and ICC by default. Required for privacy-first defaults.`
- Preserve-ICC label: `Preserve ICC color profiles`
- Preserve-ICC helper text (verbatim, no edits): `Wired but inactive in this version. Color profiles are stripped along with all metadata. ICC preservation ships in v1.1 once raster encoders integrate.`
- StatusBar pill text: `Pacing`
- StatusBar pill aria-label: `Memory pacing active — admission gate is throttling new jobs`

**Scope note (per CONTEXT.md `<post_research_amendments>` D-01/D-02 SCOPED):** Interactive editing of density AFTER drop is deferred to Phase 5. The components in this plan render and are keyboard-accessible, but mutations on rendered FileEntries are NO-OPs (or update a cosmetic `sourceDensity` field only). Add inline TODO comments noting Phase-5 ownership of re-fan-out logic.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create TweaksPanel sections + file-row controls + BackpressureIndicator + StatusBar wire</name>
  <read_first>
    - src/components/panels/SvgoPanel.tsx (full file — Section + Toggle composition; foot-gun helper text style at lines 68-73; plugin-row a11y at lines 102-122)
    - src/components/panels/CodecPanel.tsx (lines 81-117 — Resize + Metadata section visual analog)
    - src/components/shell/StatusBar.tsx (full file — slot insertion target)
    - src/components/ui/Section.tsx, src/components/ui/Toggle.tsx, src/components/ui/Seg.tsx, src/components/ui/Popover.tsx (full files — primitive APIs)
    - src/stores/settings.ts (Plan 04-05 — useSettingsStore.resize.alg + setResize)
    - src/stores/files.ts (Plan 04-05 — useFilesStore.byId + setSourceDensity)
    - src/stores/runtime.ts (Plan 04-04 — throttleActive)
    - .planning/phases/04-decode-resize-memory-model/04-UI-SPEC.md (Surfaces 1, 2, 4, 5, 6, 9 — locked specs)
    - .planning/phases/04-decode-resize-memory-model/04-PATTERNS.md (lines 508-608 — verbatim component patterns)
  </read_first>
  <files>src/components/panels/TweaksPanel.tsx, src/components/file-row/SourceDensityControl.tsx, src/components/file-row/TargetDensityCheckboxes.tsx, src/components/shell/BackpressureIndicator.tsx, src/components/shell/StatusBar.tsx</files>
  <action>
1. **Search for an existing TweaksPanel component first.** If `src/components/panels/TweaksPanel.tsx` does not exist, create it; if it does, extend it. Run `ls src/components/panels/` and inspect. The locked sections (Resize / Variants, Privacy / Metadata) live in this file. If TweaksPanel.tsx is absent, create as a NEW file that exports two named section components (`TweaksResizeSection`, `TweaksPrivacySection`) which Plan 04-07 will wire into the existing TweaksPanel composition root. Pattern verbatim from PATTERNS.md lines 521-553. Locked helper text from UI-SPEC §Surface 9 (verbatim).

2. **Create `src/components/file-row/SourceDensityControl.tsx`** — UI-SPEC §Surface 1: hover-revealed Popover trigger. Use the existing Popover + Seg primitives. The component:
   - Accepts `{ fileId: string }` prop.
   - Reads the file's current `sourceDensity` from `useFilesStore` via a selector.
   - Renders a chevron-down icon button visible on row hover or focus (rely on parent's CSS to surface; component itself sets `aria-label="Change source density (currently {density})"`).
   - On click/Enter/Space: opens a Popover with three buttons `1x` / `2x` / `3x` (use `<Seg>`).
   - On select: calls `useFilesStore.getState().setSourceDensity(fileId, density)`. NOTE: per CONTEXT.md `<post_research_amendments>` D-01/D-02 SCOPED, mid-flight density change is a Phase-5 enhancement; the popover MUTATES the entry's sourceDensity field only (variant fan-out re-runs only on initial drop). Add an inline TODO comment: `// TODO(P5): re-fan-out variants when sourceDensity changes mid-batch — see CONTEXT.md D-01/D-02 SCOPED amendment`.

3. **Create `src/components/file-row/TargetDensityCheckboxes.tsx`** — UI-SPEC §Surface 2:
   - Accepts `{ sourceFamilyId: string }` prop.
   - Reads all variants whose `sourceFamilyId === prop` from `useFilesStore.byId`.
   - Renders three checkboxes labelled `1x`, `2x`, `3x`. Each is `aria-checked` if the corresponding variant exists in the family. The variant whose `targetDensity === sourceDensity` (computed from any one family member) is LOCKED + dim-accent + `aria-disabled="true"` + Radix Tooltip "Source density ({Nx}) — included automatically".
   - Toggling a non-locked checkbox is a NO-OP in P4 (per CONTEXT.md D-01/D-02 SCOPED — mid-flight target edit is Phase-5 enhancement; the initial drop already takes targets[]). Add inline TODO: `// TODO(P5): toggle handler should add/remove family member via addSourceWithVariants/removeFile — see CONTEXT.md D-01/D-02 SCOPED amendment`.
   - Empty-target inline error `Pick at least one density` per UI-SPEC §Surface 2 (rendered when reading the family produces zero non-empty targets — defensive only; initial drop path always provides ≥1).

4. **Create `src/components/shell/BackpressureIndicator.tsx`** verbatim from PATTERNS.md lines 591-608, locked copy from UI-SPEC §Surface 6:
```typescript
import { useRuntimeStore } from '@/stores/runtime'

export function BackpressureIndicator() {
  const active = useRuntimeStore((s) => s.throttleActive)
  if (!active) return null
  return (
    <span
      className="item"
      role="status"
      aria-live="polite"
      aria-label="Memory pacing active — admission gate is throttling new jobs"
    >
      <span className="pip warn" /> Pacing
    </span>
  )
}
```

5. **Edit `src/components/shell/StatusBar.tsx`** — insert `<BackpressureIndicator />` between the worker-pip span (lines 25-28) and the SVGO version item (line 29). Add the import at the top:
```typescript
import { BackpressureIndicator } from './BackpressureIndicator'
```
And in the JSX, between the worker-pip and SVGO version:
```typescript
<span className="item">
  <span className={'pip' + (running ? '' : ' idle')}></span>
  {running ? '5 workers running' : '5 workers idle'}
</span>
<BackpressureIndicator />
<span className="item">SVGO 4.0.1</span>
```
StatusBar's existing prop signature stays untouched.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build 2&gt;&amp;1 | tail -3 | grep -E "(error|built)" &amp;&amp; ls src/components/file-row/SourceDensityControl.tsx src/components/file-row/TargetDensityCheckboxes.tsx src/components/shell/BackpressureIndicator.tsx &amp;&amp; grep -F "Wired but inactive in this version" src/components/panels/TweaksPanel.tsx &amp;&amp; grep -F "Memory pacing active" src/components/shell/BackpressureIndicator.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
    - All five files exist on disk.
    - `grep -c "Resize / Variants" src/components/panels/TweaksPanel.tsx` returns at least 1.
    - `grep -c "Privacy / Metadata" src/components/panels/TweaksPanel.tsx` returns at least 1.
    - `grep -F "Wired but inactive in this version" src/components/panels/TweaksPanel.tsx` matches exactly the locked copy from UI-SPEC §Surface 9 (verbatim — including the `v1.1` substring).
    - `grep -F "Memory pacing active" src/components/shell/BackpressureIndicator.tsx` matches the locked aria-label from UI-SPEC §Surface 6.
    - `grep -c "BackpressureIndicator" src/components/shell/StatusBar.tsx` returns at least 1.
    - `grep -c "useFilesStore\|useSettingsStore" src/components/file-row/SourceDensityControl.tsx` returns at least 1.
    - `grep -c "aria-disabled" src/components/file-row/TargetDensityCheckboxes.tsx` returns at least 1.
    - Existing Phase 1+2+3 specs still pass: `npm test` exits 0.
  </acceptance_criteria>
  <done>Five UI files exist, types compile, build succeeds, locked copy is verbatim (including `Wired but inactive in this version` and `Memory pacing active`), full regression green. App.tsx is untouched (Plan 04-07 owns wiring).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User-driven density UI input → store mutation | Density values are bounded enum ('1x' | '2x' | '3x'); type-checked at the React + zustand boundary |
| Visual UAT human gate | Manual verification (in Plan 04-07) — locked verbatim copy is the sole defense against UI dishonesty about ICC no-op |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-06-01 | Tampering | UI-displayed copy diverges from locked UI-SPEC strings (e.g. ICC helper text rephrased "for clarity") | mitigate | Acceptance criteria includes literal grep of `Wired but inactive in this version` and `v1.1` substrings AND `Memory pacing active`. Drift = blocker. |
| T-04-06-02 | Repudiation | UI shows ICC toggle ON but worker stripped — user thinks ICC was preserved | mitigate | UI-SPEC §Surface 9 helper text is verbatim, always-visible (no aria-expanded, no details). Acceptance grep enforces it. This is the SOLE disclosure preventing the ICC no-op from being a lie (D-10 amendment rationale). Visual UAT in Plan 04-07 double-checks. |
| T-04-06-03 | Tampering | File-row controls mutate sourceDensity mid-flight without regenerating variants | accept | Plan 04-06 documents this as Phase-5 work via inline TODO comments referencing CONTEXT.md D-01/D-02 SCOPED amendment. Initial-drop fan-out path is fully wired (Plan 04-05); mid-flight density change is a no-op for variant set. User experience is acceptable for v1; revisit if user feedback demands. |
</threat_model>

<verification>
- npx tsc --noEmit passes.
- npm run build exits 0.
- Five UI files exist with locked copy verbatim.
- All Phase 1+2+3 specs unchanged + green.
- App.tsx is NOT modified by this plan (Plan 04-07 owns wiring).
</verification>

<success_criteria>
- TweaksPanel exposes Resize / Variants + Privacy / Metadata sections with verbatim locked copy.
- File-row gains SourceDensityControl + TargetDensityCheckboxes components (rendered/wired by Plan 04-07).
- StatusBar embeds BackpressureIndicator slot.
- Helper text for Preserve-ICC matches UI-SPEC §Surface 9 verbatim.
- BackpressureIndicator aria-label matches UI-SPEC §Surface 6 verbatim.
</success_criteria>

<output>
After completion, create `.planning/phases/04-decode-resize-memory-model/04-06-SUMMARY.md` documenting:
- The four new component files + StatusBar slot insertion.
- The locked verbatim strings that grep-checked clean.
- The TODO(P5) comments embedded for Phase-5 re-fan-out work.
- Hand-off to Plan 04-07: which exports the next plan consumes (`TweaksResizeSection`, `TweaksPrivacySection`, `SourceDensityControl`, `TargetDensityCheckboxes`).
</output>
