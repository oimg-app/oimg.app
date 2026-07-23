---
phase: 13
plan: 07
subsystem: toolbar-settings-tabs
tags: [phase-13, wave-3, settings-tab, diagnostics, copyToClipboard, DIA-04, D-10, D-11, D-12]
requires:
  - 13-03 (runtimeAtom shape: versions + caps)
  - 13-05 (Settings popover Clear all menu item)
  - 12 (copyToClipboard chokepoint)
provides:
  - "Settings popover is a two-tab Radix Tabs surface (General first, Diagnostics second)"
  - "Diagnostics tab renders read-only <dl> of versions + caps + 'Copy diagnostics' button"
  - "Diagnostics JSON copy routes through Phase 12 chokepoint (CopyKind 'manifest')"
affects:
  - src/components/shell/Toolbar.tsx
  - src/tests/settings-diagnostics.spec.ts
tech-stack:
  added: []
  patterns:
    - "Radix Tabs (TabsList variant=line) inside an existing PopoverContent — single Popover open/close state, two tab panes"
    - "Phase 12 copyToClipboard chokepoint reused for non-snippet diagnostic JSON (CopyKind 'manifest')"
    - "useStore(runtimeAtom) subscribes Toolbar to versions + caps for live render in Diagnostics tab"
key-files:
  created:
    - src/tests/settings-diagnostics.spec.ts
  modified:
    - src/components/shell/Toolbar.tsx
decisions:
  - "D-10: General is the first tab — preserves muscle memory for Clear all + Workers"
  - "D-10: variant=line on TabsList — matches dark-default token palette per PATTERNS"
  - "D-11: <dl> shows 9 representative rows (4 jsquash encoders + svgo + 4 caps); the JSON copy still stringifies the whole versions object (incl. png + resize) so bug reports stay complete"
  - "D-11: CopyKind reuses 'manifest' (Phase 12 bug-report convenience kind) rather than introducing a new kind — chokepoint signature unchanged"
  - "D-12: keyboard navigation comes free from Radix Tabs primitive (ArrowRight switches; Tab + Enter reaches Copy button)"
metrics:
  duration: ~5 min
  completed: 2026-06-10
---

# Phase 13 Plan 07: Settings popover Tabs + Diagnostics tab + Copy diagnostics — Summary

**One-liner:** Settings popover restructured into Radix Tabs (General + Diagnostics); Diagnostics tab renders versions + caps as a read-only `<dl>` plus a Copy diagnostics button routed through the Phase 12 `copyToClipboard` chokepoint with the `manifest` CopyKind.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wrap Settings popover content in Tabs + add Diagnostics tab + Copy diagnostics button (D-10/D-11/D-12) | `9d7736f` | `src/components/shell/Toolbar.tsx` |
| 2 | Create Playwright e2e for tab nav + Diagnostics content + Copy chokepoint capture + Plan 05 regression (DIA-04) | `5c6904f` | `src/tests/settings-diagnostics.spec.ts` |

## What Was Built

- **`src/components/shell/Toolbar.tsx`:**
  - Imports added: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`; `copyToClipboard` from `@/lib/clipboard`.
  - Subscribes to `runtimeAtom` via `useStore(runtimeAtom)` to read `versions` + `caps`. The existing `runtimeAtom.get()` snapshot inside `handleClearAll` (Plan 05 pattern) is preserved verbatim — only the JSX render path gets the new subscription.
  - The Settings `<PopoverContent>` body is replaced with `<Tabs defaultValue="general" className="w-[280px]">` containing:
    - `<TabsList variant="line">` with `General` and `Diagnostics` triggers (General first).
    - `<TabsContent value="general">` holds the existing Plan 05 buttons (`Workers: 4 (auto)` + `Clear all`) verbatim — same className, same onClick, same disable-then-explain triple on Clear all.
    - `<TabsContent value="diagnostics">` holds a `<dl class="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">` with 9 rows (svgo, jsquash webp/jpeg/avif/oxipng, SIMD, WASM threads, COOP/COEP, CPUs) + a `Copy diagnostics` button.
  - The Copy button fires `copyToClipboard(JSON.stringify({ versions, caps }, null, 2), 'manifest', 'Diagnostics')`. The chokepoint appends ` copied` to the label → user sees `Diagnostics copied` toast. The popover stays open after click (no `setOpen(null)`) so the user can re-copy or switch tabs.

- **`src/tests/settings-diagnostics.spec.ts`** — Four-test Playwright e2e:
  1. **D-10 Tabs render:** opens Settings, asserts both `General` and `Diagnostics` tab triggers are visible.
  2. **D-11 Diagnostics content:** clicks Diagnostics tab, asserts each of the 9 `<dt>` labels are visible (svgo, jsquash webp/jpeg/avif/oxipng, SIMD, WASM threads, COOP/COEP, CPUs).
  3. **D-15 chokepoint capture:** installs `installClipboardMocks(page, { mode: 'native' })`, clicks Copy diagnostics, asserts the `Diagnostics copied` toast, latches on `window.__clipboardWrites.length === 1`, parses the captured text as JSON, asserts the manifest shape (`versions.svgo`, `versions.jsquash.webp`, `caps.simd`, `caps.hardwareConcurrency`), and confirms pretty-printing via the `\n  ` substring.
  4. **Plan 05 regression:** asserts the General tab is the default (`aria-selected=true`) and the `Clear all` + `Workers` buttons remain reachable through the new Tabs composition.

## Verification Results

| Gate | Result |
|------|--------|
| `npx vite build` | exit 0 (3.50 s) |
| `npx playwright test src/tests/settings-diagnostics.spec.ts --reporter=dot` | PASS (4) FAIL (0) |
| `grep -Fc "navigator.clipboard" src/components/shell/Toolbar.tsx` | **0** (chokepoint exclusivity preserved) |
| `grep -Fc "Workers: 4 (auto)" src/components/shell/Toolbar.tsx` | 1 (Plan 05 button preserved) |
| `grep -Fc "Clear all" src/components/shell/Toolbar.tsx` | 3 (button + 2 comment references) |
| `grep -Fc "Copy diagnostics" src/components/shell/Toolbar.tsx` | 2 (button + comment) |
| `grep -Fc 'TabsContent value="' src/components/shell/Toolbar.tsx` | 2 (general + diagnostics) |

`tsc -b` was attempted but the project's baseline tsc is already red with pre-existing unrelated debt (see MEMORY: "Typecheck & test gotchas — baseline tsc is red with pre-existing debt"); `vite build` is the contractual integration check and it passes cleanly. No Toolbar-specific TS errors surfaced in the tsc log.

## Decisions Made

- **Subscribe to `runtimeAtom` for JSX render, but keep `runtimeAtom.get()` snapshot inside the `handleClearAll` handler.** Plan 05 deliberately reads `runningJobs` via `.get()` to avoid Toolbar re-renders on every job-count change; this plan adds a JSX subscription only for the versions + caps fields that change exactly once (on boot probe). The two patterns coexist cleanly — the subscription doesn't affect the handler's snapshot read.
- **Keep the Settings popover open after a Copy diagnostics click** (no `setOpen(null)`) so the user can copy again or switch tabs without re-opening. Every other Toolbar menu item closes the popover on click; this is the deliberate exception because the diagnostics surface is a "stay and inspect" panel, not a one-shot action menu.
- **Reuse CopyKind 'manifest' instead of adding 'diagnostics'.** The Phase 12 chokepoint accepts a `kind` arg but currently ignores it in the body (off-ramp for future analytics). Reusing `manifest` keeps the type union minimal and matches the semantic ("bug-report-ready blob the user pastes externally").

## Deviations from Plan

None — plan executed exactly as written. The Phase 12 mock helper signature uses `{ mode: 'native' }` (positional opts object) per the existing `toolbar-snippets.spec.ts` analog; the plan's instruction in `<behavior>` test 3 said `installClipboardMocks(page, 'native')` (positional string), but the actual helper requires the opts-object shape — using the existing-spec form is a Rule 3 auto-fix (matches the real signature in `src/tests/setup/clipboard-mocks.ts`).

## Threat Model Status

| Threat | Status | Mitigation |
|--------|--------|------------|
| T-13-01 (info disclosure via copied diagnostics) | accepted | Button label `Copy diagnostics` self-documents the bug-report intent; the user controls where they paste |
| T-13-04 (XSS via injected version string) | mitigated | React text-children escaping handles all 9 `<dl>` values; no `dangerouslySetInnerHTML` |
| Chokepoint contract regression | mitigated | Test 3 asserts exact `Diagnostics copied` toast string + JSON shape |
| D-12 keyboard accessibility | mitigated | Radix Tabs primitive provides arrow-key tab switching; tests use `getByRole('tab', ...)` to validate ARIA wiring |
| T-13-03 (accidental queue wipe via moved Clear all) | mitigated by Plan 05; regression-tested here | Test 4 asserts Clear all + Workers visible after Tabs wrap |

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary changes. The Diagnostics surface reads from in-process `runtimeAtom` (no IO, no telemetry).

## Self-Check: PASSED

- `src/components/shell/Toolbar.tsx` exists and contains all required literals (`defaultValue="general"`, `variant="line"`, both `value="general"` and `value="diagnostics"`, all 9 `<dt>` labels, `Copy diagnostics` button, `copyToClipboard(JSON.stringify({ versions, caps }, null, 2), 'manifest', 'Diagnostics')` call).
- `src/tests/settings-diagnostics.spec.ts` exists with 4 passing tests.
- Commit `9d7736f` exists (Task 1, feat).
- Commit `5c6904f` exists (Task 2, test).
- `navigator.clipboard` count in Toolbar.tsx is 0 (chokepoint exclusivity preserved).
- `vite build` exits 0.
