## Context

See proposal.md (Why) for the defects. The constraints that shape the approach:

- `src/lib/commands.ts` is unit-tested under Node `--experimental-strip-types` (`src/tests/stores.test.ts`). It may import only store action modules, not the worker pool, `sonner`, or hooks, because those pull in browser-only code.
- `runOptimize` lives inside the `useOptimize()` hook closure, but uses no hook state: it reads `filesAtom.get()` and `getPool()` only. `startRun()` sets `runtimeAtom.running = true` with nothing to clear it, while the real `running` flag is driven by `setJobCounts()` from `WorkerPool.onCountChange`.
- Per-file metrics already exist: `entry.metrics.{ssim,butteraugli}` is `undefined` while pending, `null` when not applicable, and a number otherwise. `@/lib/metrics-bands` has `ssimBand`/`butteraugliBand`, and `ReportPanel` already renders all three states.
- `FileRow` is a Radix `ContextMenuTrigger`, which opens only on a `contextmenu` event. The ⋮ button synthesizes one at the pointer's `clientX/Y`, which is `0,0` for keyboard activation.
- Tokens: computed contrast for the current values is in the proposal. All candidate values below were checked with an oklch → sRGB → WCAG luminance script, including the selected-row accent tint blended in sRGB.

## Goals / Non-Goals

**Goals:**
- Every visible control does what it says, and every number shown is measured.
- Keyboard and screen-reader users can complete ingest → select → adjust → export.
- AA text contrast and a 12px text floor in both themes; the shell is usable at 390px.

**Non-Goals:**
- No new shell features. Removed controls come back only through their own changes.
- No visual redesign: layout, spacing, and component styling stay; only token lightness, text size, and the narrow layout change.

## Decisions

**D1 — Hoist `runOptimize` to module scope.** Export `runOptimize()` from `src/hooks/useOptimize.ts` as a plain async function; `useOptimize()` keeps returning it so existing callers don't change. *Alternative:* a store-level "optimize requested" atom the hook subscribes to. Rejected: it adds an indirection and requires the hook to be mounted.

**D2 — Inject optimize into the command list at boot, not by import.** `commands.ts` exports `buildCommands({ optimizeAll, hasFiles })`. `main.tsx` passes `runOptimize` and `() => filesAtom.get().entries.length > 0`, then calls `registerCommands(...)`. `CommandItem` gains an optional `enabled?: () => boolean`. The palette renders a disabled item with `aria-disabled="true"`, dims it, and skips `do()` on Enter or click. This keeps `commands.ts` free of browser imports for the Node test. *Alternative:* import `runOptimize` directly into `commands.ts`. Rejected: it breaks the strip-types unit runner.

**D3 — Delete `startRun`, `setView`, `view`, `View`, and the stub actions.** Remove `selectCodec`, `openDocs`, `openShortcuts`, `openChangelog`, `setAutoTarget`, `setWorkerCount`, `startRun`, `setView`, `uiAtom.view`, and the `View` type. `running` remains derived solely from `setJobCounts`, so "Running" always ends when the pool drains. `stopRun` stays only if something still calls it; otherwise delete it too. *Alternative:* keep stubs for the future. Rejected: they are the source of the dead controls, and the user chose "remove until built".

**D4 — DeltaStrip reuses the metric state model from ReportPanel.** SSIM and Butteraugli cards map `undefined` → "—", `null` → "N/A", and a number → its value with the band label (`good` / `fair` / `poor`) as the sub-line, using the same band helpers and colors as ReportPanel. No file selected → "—". Decode → "—" when `encodedBuffer` is absent. *Alternative:* hide the metric cards until computed. Rejected: layout jumps, and the existing compare-view requirement asks for a placeholder.

**D5 — The file queue is a listbox with roving tabindex.**
- `<ul role="listbox" aria-label="File queue">`; each row is `role="option"` with `aria-selected`.
- The selected row (or the first row when none is selected) gets `tabIndex=0` and the rest `-1`.
- The `onKeyDown` handler on the list covers ArrowUp/ArrowDown/Home/End: call `selectFile(id)` and focus that row's element (refs keyed by id). Logic for "next id given current id and key" goes in a pure helper, `nextSelection(ids, currentId, key)`, in `src/lib/` so it is unit-testable.
- The ⋮ button gets `tabIndex=-1` (mouse affordance only; keyboard users use Shift+F10 / ContextMenu on the row), avoiding a nested interactive control inside an option.
- Synthesized `contextmenu` events take coordinates from `getBoundingClientRect()` of the button (click) or the row (keyboard), so the menu anchors correctly.

*Alternative:* `role="grid"` with cell navigation. Rejected: a grid is heavier than needed for single-select.

**D6 — Token retune by lightness only.** Hue and chroma are unchanged.

| Token | Dark | Light |
|---|---|---|
| `--color-fg-2` | 0.58 → **0.70** (6.2–7.2:1 on bg-0..2; 4.8 on tint) | 0.50 → **0.42** (7.2–8.1:1; 6.2 on tint) |
| `--color-fg-3` | 0.42 → **0.62** (4.6–5.3:1 on bg-0..2) | 0.66 → **0.50** (5.1–5.7:1) |
| `--color-accent` (+ `-dim`) | unchanged | 0.62 → **0.46** (white text on accent 6.2:1; accent text 5.8:1 on bg-1, 4.7 on tint) |
| `--color-warn` | unchanged | 0.62 → **0.50** (5.3–6.0:1; 4.6 on tint) — added during apply after the re-critique caught savings-% text at 3.4:1 |
| `--color-error` | unchanged | 0.58 → **0.52** (5.2–5.9:1) — red SSIM band text |

`fg-3` still fails on the selected-row tint (3.5:1 in dark), so `fg-3` MUST NOT be used for text inside selected rows. The only such use is the decorative "→" between sizes; it becomes `aria-hidden` and stays `fg-3`, while sizes use `fg-2`. *Alternative:* a separate `--color-accent-text` token for light theme. Rejected: it adds a token for one theme when a single lightness change satisfies both uses. *Alternative:* switch the light accent's foreground to dark text. Rejected: dark text on accent at 0.62 passes (5.5:1), but accent-as-text at 0.62 fails on light surfaces (3.25:1), so the accent must darken anyway.

**D7 — 12px floor by class sweep.** Replace `text-[10px]` and `text-[11px]` with `text-xs` (12px) across `src/components/{shell,panels}` and in `src/components/ui/kbd.tsx` if it sets a smaller size. Fixed-height bars (the 22px StatusBar) grow to fit (`h-6`). The 8.5px format badge is exempt: it is `aria-hidden` and decorative.

**D8 — Narrow layout via a media-query hook.** `src/hooks/useNarrowViewport.ts` uses `useSyncExternalStore` over `matchMedia('(max-width: 899.98px)')`. `AppShell` renders, when narrow:
- a `role="tablist"` (Files / Preview / Settings) bound to a new `uiAtom.mobilePane` key
- the single matching pane, instead of the `ResizablePanelGroup`

Replace `w-screen` with `w-full`. The Toolbar gets `overflow-x-auto`, and the filter loses `min-w-[220px]` on narrow screens (`min-w-0 flex-1`). *Alternative:* CSS-only stacking with `@container`. Rejected: three stacked panes in a 100vh shell leave each pane too short to use, and react-resizable-panels cannot be restyled into tabs with CSS alone.

**D9 — StatusBar live region narrowed.** Remove `role="status"` and `aria-live` from the bar container. The X/Y counter span (`agg-counter`, already `role="status" aria-live="polite" aria-atomic="true"`) stays the only live region and stays mounted, empty on an empty queue, so the region remains registered. "Running/Idle" sits outside it, and the pip's `aria-label` carries the state. *Implementation note:* an earlier draft wrapped run state and counter in one live span. That would have changed `agg-counter`'s text and broken the existing OPT-02 contract, so the counter alone is announced. Render each separator together with the item it precedes, so empty items leave no stray "·".

**D10 — Shell semantics.** Drop `role="application"` from `AppShell`; keep `aria-label` on a plain `div`, or use `<main>` around the panel group. Give `ResizableHandle` an `aria-label` prop, e.g. "Resize files and preview panes". Give the SVGO Aggressive `Switch` an `aria-label` or an associated `<label>`. In `SegControl`, replace `overflow-hidden` with per-item rounding, and use an inset ring (`focus-visible:ring-inset`).

## Risks / Trade-offs

- [Removing UI breaks e2e specs that assert those testids, e.g. `navigation.spec.ts` uses the Codec menu for menu keyboard tests] → retarget menu keyboard tests at the View menu, which has the same Radix behavior, and delete assertions for removed controls in the same task that removes them.
- [`foundation.spec.ts` locates the shell via `[role="application"]`] → switch to the `aria-label` or a testid.
- [Token lightness diverges from `example-ui/OIMG.html`, the "locked" reference] → accepted: AA is a hard constraint that outranks pixel parity, and hue and chroma stay. Record the new values in theming's requirement and leave a comment beside the tokens.
- [12px text widens rows and may truncate names in the 20% FilesPane] → names already `truncate`; verify at 1280px that the sizes line no longer wraps ("1.2 / KB"). If it does, add `whitespace-nowrap` to the sizes.
- [Narrow layout duplicates pane mounting logic] → both branches render the same pane components; only the container differs.
- [Roving focus can fight Radix ContextMenu focus restoration] → after the menu closes, Radix returns focus to the trigger (the row), which is the desired target. Covered by the "Escape returns focus" scenario.

## Migration Plan

Ship as one release; no stored state changes (`uiAtom` is not persisted). Roll back by reverting the commit.
