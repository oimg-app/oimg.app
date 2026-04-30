---
phase: 2
slug: worker-harness-state
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-30
reviewed_at: 2026-04-30
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for worker harness + state wiring. Phase 2 designs **only the dynamic states** introduced by real worker activity. All primitives, tokens, and layouts are LOCKED from Phase 1 (`example-ui/OIMG.html` + `src/index.css`). No new components.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled primitives — Phase 1 D-06) |
| Preset | not applicable |
| Component library | hand-rolled (`src/components/ui/Popover.tsx`, `Tooltip.tsx`, etc.) |
| Icon library | `src/components/icons.tsx` — 1.5px stroke, sizes 9/12/13 px |
| Font | Inter Variable (UI), JetBrains Mono Variable (status pill, counters, file stats, kbd) |

**Source of truth:** `example-ui/OIMG.html` + `src/index.css` (lines 165–477). Phase 2 must NOT introduce new tokens or new component primitives. Toasts use `sonner` (locked in PROJECT.md §6) — render outputs must match the existing `.toast` class palette (left-border accent, `var(--bg-1)` surface, `var(--shadow-elev)`).

---

## Spacing Scale

Declared values (multiples of 4, lifted from `src/index.css`):

| Token | Value | Usage in Phase 2 |
|-------|-------|------------------|
| xs | 4px | Pill internal gap, status-dot to label |
| sm | 8px | Toolbar button gap (`.toolbar { gap: 8px }`) |
| md | 12px | File-row vertical padding, toast inner padding |
| lg | 14px | Toast horizontal padding |
| xl | 24px | Toast bottom offset multiple |
| 2xl | 32px | Toast container `bottom: 32px` (existing) |

**Exceptions:**
- Workers status pill height: `18px` (existing `.pill` height — locked, NOT a 4-multiple but inherited from Phase 1 visual contract)
- File status dot: `8px × 8px` (existing `.file-status` — locked)
- Status pill internal padding: `0 7px` horizontal (existing `.pill` — locked)

---

## Typography

All sizes/weights inherited from `src/index.css`. Phase 2 declares which roles each new dynamic surface uses:

| Role | Size | Weight | Line Height | Family | Used For |
|------|------|--------|-------------|--------|----------|
| Pill (mono) | 10px | 500 | 1.0 | mono | Workers status pill (`2/4`, `idle`, `error`) |
| Button label | 12px | 500 (600 primary) | 1.0 | sans | Optimize button label |
| File-name | 12px | 500 | 1.45 | sans | File-row name (existing `.file-name`) |
| File-stat (mono) | 11px | 400 (600 for save value) | 1.45 | mono | Per-row size delta + status copy |
| Toast body | 12px | 400 | 1.45 | sans | sonner toast body |
| Toast meta (mono) | 10.5px | 400 | 1.0 | mono | sonner toast counter `3 / 12` |
| ARIA live (visually hidden) | inherits 13px | 400 | 1.45 | sans | `sr-only` live region content |

**Body line-height:** 1.45 (existing global `body { font: 13px/1.45 }`).
**Heading line-height:** 1.0 for status pills/counters (mono, single-line).

---

## Color

Inherits 60/30/10 split locked in Phase 1. Phase 2 only specifies WHICH tokens map to WHICH new dynamic states.

| Role | Token | Usage in Phase 2 |
|------|-------|------------------|
| Dominant (60%) | `--bg-0`, `--bg-1` | Toolbar surface, file-row background, pane bodies |
| Secondary (30%) | `--bg-2`, `--bg-3` | Pill background (idle), button background, hovered row |
| Accent (10%) | `--accent` (oklch ~145°) | Optimize button (primary), `done` status dot, save value, toast left-border, "all idle" pill (acc variant) |
| Destructive | `--err` (oklch ~25°) | `error` status dot, error toast left-border, error file-stat copy |
| Info (running) | `--info` (oklch ~235°) | `processing` status dot, indeterminate progress bar (`.progbar > div`), "Workers" pill background-tint when running |
| Warn | `--warn` (oklch ~65°) | Reserved — NOT used in Phase 2 (no warn states yet) |

**Accent reserved for (Phase 2 surfaces only):**
1. Optimize button (`tbtn.primary`) — when in default ready state
2. File-status dot when `status === 'done'` (existing `.file-status.done`)
3. Saved-bytes value in file-stat row (existing `.file-stat .save`)
4. Toast left-border when reporting success (existing `.toast` border-left)
5. Workers pill in "all idle / pool warm" state (uses `.pill.acc` modifier)

**Info reserved for (Phase 2 surfaces only):**
1. File-status dot when `status === 'processing'` (existing `.file-status.processing` with pulse animation)
2. Indeterminate progress bar (existing `.progbar > div`)
3. Workers pill background tint when `busy > 0` (no new token — uses `var(--info)` at low alpha via existing `.pill` override)

**Destructive reserved for (Phase 2 surfaces only):**
1. File-status dot when `status === 'error'` (existing `.file-status.error`)
2. Error toast left-border (sonner `toast.error`)
3. Per-row error message text in `.file-stat`

---

## Component State Specifications

### 1. Toolbar — Workers Status Pill

**Location:** `src/components/shell/Toolbar.tsx` settings popover (line 140) AND a NEW always-visible pill on the toolbar between the segmented view control and search input. Use existing `.pill` class. Insert via the `.tdiv` separator pattern already established.

| State | Visual | Copy | ARIA |
|-------|--------|------|------|
| Pool unspawned (no jobs ever) | `.pill` (default tokens) | `Workers idle` | `aria-label="Worker pool idle"` |
| Pool warm, all idle | `.pill.acc` (accent-dim background) | `{N} idle` (e.g. `4 idle`) | `aria-label="{N} workers idle"` |
| Running | `.pill` with inline style `background: var(--accent-dim); color: var(--info); border-color: transparent;` | `{busy}/{total} busy` (e.g. `2/4 busy`) | `aria-label="{busy} of {total} workers busy"` |
| Error pool (last batch had ≥1 error) | `.pill.warn` (existing modifier) | `{N} idle · errors` | `aria-label="{N} workers idle, last batch had errors"` |

Numbers MUST use `font-family: var(--mono)`, `font-variant-numeric: tabular-nums` (already on `.pill`). No spinner, no animation on the pill itself — the indeterminate `.progbar` below the toolbar carries motion.

### 2. Toolbar — Optimize Button

Use existing `.tbtn` (NOT `.tbtn.primary` — Add files owns primary; Optimize is secondary by Phase 1 visual contract).

| State | Class | Icon | Copy | Disabled |
|-------|-------|------|------|----------|
| Disabled — empty queue | `tbtn` | `Icons.Play size={13}` | `Optimize all` | `disabled` |
| Disabled — already running | `tbtn` | `Icons.Pause size={13}` | `Optimizing…` | `disabled` (existing) |
| Enabled — ready | `tbtn` | `Icons.Play size={13}` | `Optimize all` | `false` |
| Done — idle after batch (no transient "Done" label) | `tbtn` | `Icons.Play size={13}` | `Optimize all` | `false` |

**Affordance rules:**
- NO transient "Done!" label — counter UI conveys completion. Button returns to ready immediately when batch flushes.
- NO loading spinner inside button. The pause icon + "…" suffix conveys running state.
- Keyboard: `⌘⏎` (Cmd+Enter) triggers Optimize from anywhere except inside an input. Document in CommandPalette meta column.

### 3. Cancel Affordance

**Visibility rule:** Cancel is **palette-only** when running (Cmd+K → "Cancel batch"). NO toolbar Cancel button in v1.

Rationale: Hard-stop via `worker.terminate()` (D-02) is rare and developer-tier. A dedicated toolbar slot would compete with primary actions. The Optimize button's disabled `Optimizing…` state already communicates "in progress."

| Surface | Copy | Confirmation |
|---------|------|--------------|
| Cmd+K palette item | `Cancel batch` (icon: `Icons.X size={14}`) | NONE (D-02 hard-stop is intentional; no double-confirm) |
| Palette meta column | `Stops in-flight workers · ⌘.` | — |
| Keyboard | `⌘.` (Cmd+Period) globally when `running === true`; no-op otherwise | — |
| Post-cancel toast | `Batch canceled` with meta `{N} files were processing` | sonner `toast()` (info, ~4s) |

### 4. Per-File Row Status Visuals

Use existing `.file-status` dot (`src/index.css` lines 239–243) — DO NOT introduce spinners. Map `FileStatus` enum:

| `FileStatus` | Class | Color | Animation | File-stat copy |
|--------------|-------|-------|-----------|----------------|
| `idle` | `.file-status` (default) | `--line-strong` | none | `{originalSize}` only |
| `queued` | `.file-status.queued` | `--fg-3` | none | `{originalSize} · queued` |
| `processing` | `.file-status.processing` | `--info` | `pulse 1.4s` (existing keyframe) | `{originalSize} · running` |
| `done` | `.file-status.done` | `--accent` | none | `{originalSize} → {optimizedSize} · {savedBytes} saved` (or `0 bytes saved` for stub adapter) |
| `error` | `.file-status.error` | `--err` | none | `{originalSize} · failed` (no error code in row — keep terse) |

**Animation budget:**
- Pulse cadence: existing `1.4s ease-in-out infinite` — DO NOT change
- `prefers-reduced-motion: reduce` MUST disable the pulse (currently NOT honored — Phase 2 adds this guard in `src/index.css`):
  ```css
  @media (prefers-reduced-motion: reduce) {
    .file-status.processing { animation: none; opacity: 0.7; }
    .progbar > div { animation: none; transform: translateX(0); }
  }
  ```
- File-stat copy MUST NOT layout-shift between states. Reserve a single text line; populate or leave blank.

### 5. Batch Progress Indicator

**Two surfaces, both required:**

**A. Indeterminate progress bar** (existing `.progbar` — already in CSS). Render directly under `.toolbar` (1px tall horizontal strip), full-width. Visible only while `running === true`. Already animated `1.4s linear infinite`. Inherits the reduced-motion guard above.

**B. Counter** in the existing `.totals` block at the bottom of the file panel (left pane). Format `{done} / {total}` using `.totals .v.acc` class (mono, accent color, tabular-nums). Examples: `0 / 12`, `3 / 12`, `12 / 12`.

**ARIA live region semantics (PERF-03):**
- ONE shared `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">` mounted at App root.
- Update content ONLY at batch boundaries to avoid screen-reader flooding:
  - On batch start: `Optimizing {total} files`
  - Every Nth completion (N = `Math.max(1, Math.floor(total/4))`): `{done} of {total} files complete`
  - On final completion: `Batch complete. {N} files optimized, {savedBytes} saved.`
  - On error: `Batch failed: {fileName}: {errorMessage}`
  - On cancel: `Batch canceled`
- DO NOT announce per-file `started` events — too noisy. The counter is a polite-announce surface, not an assertive one.

### 6. Empty / Done States

| Scenario | Surface | Copy |
|----------|---------|------|
| Queue empty (no files added) | Pane body shows existing `.dropzone` | `Drop files here` (locked from Phase 1) |
| Queue has files, batch never run | Totals block | `0 / {total}` |
| Mid-batch | Totals block | `{done} / {total}` |
| Batch complete, all success | Totals block | `{total} / {total}` + savings line in green via `.v.acc` |
| Batch complete with errors | Totals block | `{done} / {total}` + meta line `{errorCount} failed` in `var(--err)` |

NO modal. NO confetti. NO "Great job!" text. Developer-tone is terse.

### 7. Error States

**Per-file error:**
- Status dot: red (`.file-status.error`)
- File-stat copy: `{originalSize} · failed` (terse — full message only in toast/inspector)
- Row remains in queue (NOT removed). User can re-trigger by re-running Optimize (Phase 2 retry behavior: re-running Optimize re-queues `error` files alongside any new `idle` files. Plan should call this out.)
- NO inline retry button in v1 (would clutter the row grid; Phase 5 inspector can host detail-level retry).

**Batch-level error toast (sonner `toast.error`):**
- Triggered when ≥1 file errors during a batch
- Trigger timing: at batch end, NOT per-file (avoid toast spam for 50-file batches)
- Copy template: `Optimization failed for {N} file{s}` with meta `Click for details` (Phase 5 wires the click; Phase 2 wires the toast only — meta is descriptive, not interactive yet)
- Duration: 6000ms (longer than success default 4000ms — gives reader time)
- For single-file errors, include the filename: `Optimization failed: {fileName}` (no meta needed)

**Pool/worker fatal error (e.g. WASM init failure):**
- sonner `toast.error` with `duration: Infinity` (sticky)
- Copy: `Worker pool unavailable. Reload the page to retry.`
- This is a v1 escape hatch — Phase 2 must not silently fail.

### 8. A11Y Interaction Contracts

**Keyboard shortcuts (additive — must not collide with Phase 1):**

| Shortcut | Action | Scope |
|----------|--------|-------|
| `⌘⏎` | Run Optimize | Global, when not in input/textarea, when ≥1 file queued and not running |
| `⌘.` | Cancel batch | Global, when `running === true` |
| `⌘K` | Open palette (existing) | Global |
| `Esc` | Close palette (existing) | Palette open |

Document each in `CommandPalette.tsx` as a `CmdItem.meta` so users discover via Cmd+K.

**Focus management:**
- When Optimize starts: focus stays where it was (no programmatic focus change). Indeterminate progress bar appears beneath toolbar.
- When batch ends: focus stays where it was. Live region announces completion. Toast appears.
- When Cancel runs: focus returns to toolbar Optimize button (so user can quickly re-run). Use `requestAnimationFrame` to avoid race with palette closure.
- Status pill is `tabIndex={-1}` (informational, not interactive) UNLESS we add a click-to-open settings popover — in v1 do NOT make pill interactive. Keep focus surface lean.

**ARIA contracts that MUST NOT break (from Phase 1 plan 01-05):**
- Queue listbox semantics (`role="listbox"` on file list, `role="option"` on rows). Status changes update `aria-busy` on the row when `processing`, set back to `false` on `done`/`error`.
- Inspector tablist contract — Phase 2 doesn't touch inspector content but store updates must NOT break tab focus when a file's status changes.
- Compare-slider contract — Phase 2 doesn't touch.

**Row `aria-live` strategy:** DO NOT put `aria-live` on individual file rows. Only the global App-root live region (described in §5) announces. Per-row updates rely on `aria-busy` toggles for assistive-tech awareness without verbal announcements.

### 9. Animation/Timing Budgets

| Element | Cadence | Source | Reduced-motion fallback |
|---------|---------|--------|------------------------|
| Status dot pulse (processing) | `1.4s ease-in-out infinite` | existing `@keyframes pulse` | `animation: none; opacity: 0.7` |
| Indeterminate progress bar | `1.4s linear infinite` | existing `@keyframes ind` | `animation: none; transform: translateX(0)` (bar holds at 0%, still visible) |
| Toast slide-in | `0.18s ease-out` | existing `@keyframes slidein` | sonner respects `prefers-reduced-motion` natively |
| Pill state transition | `none` (instant token swap) | — | n/a |
| Optimize button label change (Play→Pause icon) | `none` (instant) | — | n/a |
| Toast duration — success | `4000ms` | sonner default | unchanged |
| Toast duration — error | `6000ms` | override | unchanged |
| Toast duration — fatal | `Infinity` (manual dismiss) | override | unchanged |
| Toast duration — info (cancel) | `4000ms` | sonner default | unchanged |

**Total motion footprint Phase 2 adds:** zero new keyframes. Phase 2 only wires existing animations to real state.

---

## Copywriting Contract

| Element | Copy | Notes |
|---------|------|-------|
| Primary CTA — ready | `Optimize all` | Existing label — preserve verbatim |
| Primary CTA — running | `Optimizing…` | Existing — preserve |
| Workers pill — pool unspawned | `Workers idle` | New |
| Workers pill — warm idle | `{N} idle` | New (mono numbers) |
| Workers pill — running | `{busy}/{total} busy` | New (mono numbers) |
| Workers pill — error tail | `{N} idle · errors` | New |
| Cmd+K — Optimize | `Optimize all` (meta: `Run worker pool · ⌘⏎`) | New meta |
| Cmd+K — Cancel | `Cancel batch` (meta: `Stops in-flight workers · ⌘.`) | New |
| File-stat — queued | `{originalSize} · queued` | New |
| File-stat — running | `{originalSize} · running` | New (NOT "processing" — terser) |
| File-stat — done (stub) | `{originalSize} → {originalSize} · 0 bytes saved` | Stub adapter ground truth |
| File-stat — done (real) | `{originalSize} → {optimizedSize} · {savedBytes} saved` | Phase 3+ |
| File-stat — error | `{originalSize} · failed` | Terse — detail in toast |
| Empty state heading | `Drop files here` | Locked from Phase 1 |
| Empty state body | `SVG · PNG · JPEG · WebP · AVIF` | Existing `.dropzone .formats` |
| Toast — batch start | (none — silent start; live region announces) | Avoid notification spam |
| Toast — batch complete (success) | `Optimized {N} files` meta `{savedBytes} saved` | sonner `toast.success` |
| Toast — batch complete (zero-saved stub) | `Optimized {N} files` meta `0 bytes saved` | sonner `toast.success` — Phase 2 acceptance gate |
| Toast — batch complete (mixed errors) | `Optimized {success} of {total} files` meta `{errorCount} failed` | sonner `toast.warning` (or `toast()` if no warning variant) |
| Toast — single-file error | `Optimization failed: {fileName}` | sonner `toast.error` |
| Toast — multi-file error (post-batch) | `Optimization failed for {N} files` meta `Click for details` | sonner `toast.error` (click no-op in Phase 2) |
| Toast — cancel | `Batch canceled` meta `{N} files were processing` | sonner `toast()` (info) |
| Toast — pool fatal | `Worker pool unavailable. Reload the page to retry.` | sonner `toast.error` sticky |
| Live region — start | `Optimizing {total} files` | sr-only |
| Live region — quartile progress | `{done} of {total} files complete` | sr-only |
| Live region — done | `Batch complete. {N} files optimized, {savedBytes} saved.` | sr-only |
| Live region — error | `Batch failed: {fileName}: {errorMessage}` | sr-only |
| Live region — cancel | `Batch canceled` | sr-only |

**Voice rules (must match Phase 1):**
- Lowercase imperatives in palette meta (e.g. "Run worker pool" not "Runs the worker pool")
- En-dash separators in file-stat (`·` middle-dot, not en-dash — match existing `.file-stat` style)
- Numbers ALWAYS in mono with tabular-nums
- No exclamation points
- No second-person ("you", "your") — addresses tool not user
- File sizes: use existing humanize util (KB/MB with one decimal); 0-byte case prints literal `0 bytes saved` (NOT `0 KB`)

**Destructive confirmations:**
- Cancel batch: NO confirmation (D-02 hard-stop is intentional — adding a confirm dialog would defeat the responsiveness purpose)

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (project uses hand-rolled primitives — Phase 1 D-06) | not applicable |
| third-party | none | not applicable |

**No registry surface in Phase 2.** Sonner is npm-installed (locked in PROJECT.md §6) — not a registry block. No `npx shadcn add` operations are part of Phase 2.

---

## Out-of-Scope Reminder

This UI-SPEC explicitly does NOT cover:
- Component primitives (locked Phase 1 D-06)
- Color tokens, typography scales, layout grids (locked `src/index.css` + `example-ui/OIMG.html`)
- Compare slider, inspector tabs, file-detail view (Phase 5+)
- Codec settings panels, per-format controls (Phase 5)
- Snippet generation UI (Phase 3 + Phase 6)
- Export ZIP UI beyond toast wording (Phase 7)
- Persistence affordances (Phase 7)

If the planner finds a Phase 2 design need not addressed here, route back to gsd-ui-researcher for an addendum rather than improvising.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
