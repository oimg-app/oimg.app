---
phase: 04-inspector-codec-svgo
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/tests/settings.test.ts
  - src/stores/settings.ts
  - src/components/panels/inspector/Section.tsx
  - src/components/panels/inspector/SegControl.tsx
  - src/components/panels/inspector/SvgoPanel.tsx
  - src/components/panels/inspector/CodecPanel.tsx
  - src/components/panels/InspectorPane.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Seven files reviewed covering the settings store (nanostores `map`), three inspector sub-panels, the pane shell, and the accompanying unit test. The store logic is largely correct. The main critical defect is a stale-closure bug in the auto-tab `useEffect` that silently reads the `tab` variable from a captured outer scope while deliberately excluding it from the dependency array. Five warnings cover an uncontrolled SegControl (palette/subsample controls have hard-coded value with a no-op handler), missing ARIA semantics on the plugin list, an accessibility mis-use of `role="radio"` without `role="radiogroup"` on SegControl, shallow test coverage for `setResizeDimensions`, and incorrect error-swallowing in the test harness. Three informational items round out the findings.

---

## Critical Issues

### CR-01: Stale closure in auto-tab `useEffect` silently reads outdated `tab`

**File:** `src/components/panels/InspectorPane.tsx:20`

**Issue:** The `useEffect` branch at line 20:
```ts
} else if (tab === 'svgo') {
  setTab('codec')
}
```
reads `tab` from the outer render scope. The dependency array is intentionally narrowed to `[selectedFile?.id, selectedFile?.type]` (line 24) to avoid an infinite loop, but this means `tab` is captured at the time the effect was created, not at the time it runs. If `selectedFile` changes identity (e.g., re-upload of the same file under a new id) while `tab` is `'svgo'` and the new file is also non-SVG, the stale `tab` value may already be `'codec'` from a previous run, causing the guard to be missed. More concretely: if the effect is queued during one render but the user manually changes the tab before it fires, the comparison uses the stale closure value and the wrong branch may execute.

The correct fix is to read the current store value imperatively inside the effect instead of closing over the reactive `tab`:

```tsx
useEffect(() => {
  if (!selectedFile) return
  if (selectedFile.type === 'svg') {
    setTab('svgo')
  } else if (uiAtom.get().tab === 'svgo') {
    // Read current store value directly — avoids stale closure
    setTab('codec')
  }
}, [selectedFile?.id, selectedFile?.type])
```

This is the standard nanostores pattern for imperative reads inside effects: call `.get()` on the atom rather than relying on the last-rendered value.

---

## Warnings

### WR-01: PNG Palette and AVIF Subsample controls are permanently uncontrolled (no-op handler)

**File:** `src/components/panels/inspector/CodecPanel.tsx:113` and `122`

**Issue:** Both codec-specific SegControl widgets have a hard-coded `value="off"` / `value="4:2:0"` and an empty `onChange={() => {}}` callback:
```tsx
<SegControl options={['off', 'auto', 'PNG-8']} value="off" onChange={() => {}} />
<SegControl options={['4:2:0', '4:4:4']} value="4:2:0" onChange={() => {}} />
```
These widgets render as interactive UI (clickable buttons) but clicking any option does nothing and the value never changes. There is no stub state in the store for `palette` or `subsample`. Users will click the control expecting it to respond — when it does not, this is both a correctness bug (control pretends to be interactive) and a silent data-loss risk (any intent to encode PNG-8 or switch chroma subsampling is silently ignored).

**Fix:** Either wire these to store fields (preferred), or visually disable them with `disabled` / `aria-disabled` and add a tooltip explaining they are coming in a future phase, so users are not misled:
```tsx
<SegControl
  options={['off', 'auto', 'PNG-8']}
  value="off"
  onChange={() => {}}
  disabled   // add disabled prop to SegControl, apply pointer-events-none + opacity styling
/>
```

---

### WR-02: `SegControl` uses `role="radio"` without a `role="radiogroup"` parent — invalid ARIA

**File:** `src/components/panels/inspector/SegControl.tsx:13-14`

**Issue:** Each `<button>` inside SegControl has `role="radio"` and `aria-checked`, but the wrapping `<div>` has only `role="group"`. Per ARIA 1.1/1.2, `radio` elements **must** be owned by a `radiogroup`. A plain `role="group"` does not satisfy the required context, so screen readers may not announce these buttons as radio options or handle arrow-key navigation correctly.

**Fix:**
```tsx
<div
  role="radiogroup"                   // was: role="group"
  aria-label={/* pass a label prop */}
  className="flex h-6 ..."
>
```
Add a required `aria-label` prop (or `aria-labelledby`) to `SegControl` so the group has an accessible name. Without it, `radiogroup` also fails ARIA requirements.

---

### WR-03: Plugin toggle buttons lack accessible names — screen readers announce only the plugin ID

**File:** `src/components/panels/inspector/SvgoPanel.tsx:31-77`

**Issue:** Each plugin row is a `<button>` whose text content is the plugin id (e.g., `removeDoctype`) plus a savings badge. There is no `aria-pressed` or `aria-label` that communicates the checked/unchecked state. A screen reader will announce "removeDoctype button" with no indication of whether it is enabled or disabled.

**Fix:** Add `aria-pressed` to convey toggle state:
```tsx
<button
  type="button"
  key={p.id}
  aria-pressed={p.on}
  onClick={() => togglePlugin(p.id)}
  ...
>
```

---

### WR-04: `setResizeDimensions` two-field test reads stale store value between the two `setKey` calls

**File:** `src/stores/settings.ts:49-52`

**Issue:** `setResizeDimensions` calls `settingsAtom.setKey('w', w)` and then `settingsAtom.setKey('h', h)` as two separate mutations. In nanostores `map`, each `setKey` fires a synchronous notification to all subscribers. This means any subscriber that reacts to `w` changes may observe a state where `w` has been updated but `h` has not yet been updated — an intermediate inconsistent state. For example, a worker that reads both fields on change could compute a resize with the new width but the old height.

**Fix:** Use a single `set` call with a partial update object, or use nanostores batch if available. The minimal safe fix:
```ts
export function setResizeDimensions(w: string, h: string): void {
  settingsAtom.set({ ...settingsAtom.get(), w, h })
}
```
This emits a single notification with both fields updated atomically.

---

### WR-05: Test silently counts a missing-module error as a `passed` test — masks real failures

**File:** `src/tests/settings.test.ts:108-113`

**Issue:**
```ts
} catch (err) {
  if (err instanceof Error && (err.message.includes('settings.ts') || ...code === 'ERR_MODULE_NOT_FOUND')) {
    passed++   // ← increments passed counter
    console.log('Wave 0 stub state: ...')
  } else {
    failed++
    ...
  }
}
```
When `settings.ts` is missing, the entire `try` block (15 assertions) is skipped and `passed` is incremented by 1 as though the test suite passed. The final `console.log` and exit code will show `1 passed, 0 failed`, which is indistinguishable from a genuine clean run if someone is checking exit codes in CI. When the module IS present, any unrelated import error (e.g., `stub-data.ts` not found, a syntax error) would match the `message.includes('settings.ts')` heuristic and also be silently swallowed.

**Fix:** Use a dedicated skip mechanism rather than crediting `passed`. The `passed++` should be removed; the catch block should log but not touch the counters, and the final exit code should differentiate "skipped" from "passed":
```ts
} catch (err) {
  if (/* module not found */) {
    console.log('Wave 0 stub: settings.ts not yet shipped — test skipped.')
    process.exit(0) // explicit skip, not pass
  } else {
    failed++
    console.error('Unexpected error:', err)
  }
}
```

---

## Info

### IN-01: `setCodec` in `CodecPanel` casts with `as Codec` but `CODECS` array is already typed

**File:** `src/components/panels/inspector/CodecPanel.tsx:47`

**Issue:** `setCodec(c as Codec)` — the cast is redundant if `CODECS` is typed as `readonly Codec[]` in `stub-data.ts`. If it is typed as `readonly string[]`, the cast papers over a real type gap. Either way, the cast should be avoided by ensuring `CODECS` carries the precise union type.

---

### IN-02: `Section` component has no `React` import for JSX in environments requiring explicit import

**File:** `src/components/panels/inspector/Section.tsx:1`

**Issue:** The file uses JSX but has no `import React from 'react'`. This is fine under the React 17+ automatic JSX transform (which this project uses with Vite/`@vitejs/plugin-react`), but there is no explicit `@jsxRuntime` pragma or tsconfig confirmation visible in this file. If the tsconfig `jsx` setting is `"react"` rather than `"react-jsx"`, this will fail at build time. Low risk given Vite defaults, but worth verifying.

---

### IN-03: Magic number `22` in test assertion is fragile

**File:** `src/tests/settings.test.ts:39`

**Issue:**
```ts
assert('default plugins.length === 22', mod.settingsAtom.get().plugins.length === 22)
```
The number 22 is a magic constant that must match the length of `SVGO_PLUGINS` in `stub-data.ts`. If a plugin is added or removed from the list, this assertion will fail with a cryptic `FAIL: default plugins.length === 22` message rather than showing the actual vs expected count. Import `SVGO_PLUGINS.length` from the module or use a dynamic assertion:
```ts
assert('default plugins.length matches SVGO_PLUGINS',
  mod.settingsAtom.get().plugins.length === mod.SVGO_PLUGINS?.length ?? 22)
```

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
