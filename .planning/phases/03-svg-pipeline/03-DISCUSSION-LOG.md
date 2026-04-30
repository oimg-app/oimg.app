# Phase 3: SVG Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 3-SVG Pipeline
**Areas discussed:** Sanitization layering & policy, Plugin UI surface, Real-time re-optimize on toggle, Snippet scope for Phase 3

---

## Sanitization layering & policy

### Q1: Where should DOMPurify run in the SVG adapter pipeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Post-SVGO only | SVGO first, DOMPurify on the optimized output. SVGO's preset-default does NOT remove scripts, so this is the actual security layer. | ✓ |
| Pre-SVGO only | DOMPurify cleans raw input before SVGO. Faster but trusts SVGO not to reintroduce something exploitable. | |
| Both pre and post | Defense in depth; ~2× sanitization cost. | |
| You decide | Claude's discretion. | |

**User's choice:** Post-SVGO only

### Q2: When DOMPurify actually strips content, what should happen in the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast warning + still optimize | Sonner toast: 'Removed N dangerous elements'. File still completes. | |
| Silent — just clean and ship | No UI signal. Hides a real security event. | |
| Block — mark file as error with reason | Heavy-handed for a tool whose job is cleaning SVGs. | |
| Per-file badge in list, no toast | Small 'sanitized' indicator on the file row; less noisy on big batches. | ✓ |

**User's choice:** Per-file badge in list, no toast

### Q3: DOMPurify configuration shape?

| Option | Description | Selected |
|--------|-------------|----------|
| USE_PROFILES: { svg: true, svgFilters: true } | Built-in SVG + svgFilters profile. Battle-tested defaults. | ✓ |
| USE_PROFILES.svg + explicit FORBID overrides | Profile + extra deny list (e.g. FORBID_TAGS: ['foreignObject']). | |
| Custom ALLOWED_TAGS / ALLOWED_ATTR allow-list | Most defensive but high maintenance. | |
| You decide | Claude's discretion. | |

**User's choice:** USE_PROFILES: { svg: true, svgFilters: true }

### Q4: Single sanitized blob everywhere, or raw SVGO output for ZIP?

| Option | Description | Selected |
|--------|-------------|----------|
| Single sanitized blob everywhere | Adapter returns sanitized bytes; preview, snippets, byte delta, ZIP all derive from it. | |
| Sanitize previews/snippets, raw SVGO bytes in ZIP | Two-blob accounting + UI toggle. | |
| Sanitize always; offer 'unsafe export' as a global setting | Default = sanitize; advanced toggle disables post-sanitize. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Sanitize always; offer 'unsafe export' as a global setting

---

## Plugin UI surface

### Q1: Which plugins should the UI expose?

| Option | Description | Selected |
|--------|-------------|----------|
| All preset-default plugins (~30 toggles) | Full power-user transparency, matches SVGOMG. | |
| Curated subset (~10–12 plugins) | Hand-picked highest-impact plugins. Less overwhelming. | ✓ |
| Preset-default only + 'Advanced' drawer | Two-tier UX. | |
| You decide | Claude's discretion. | |

**User's choice:** Curated subset (~10–12 plugins)

### Q2: What about the static '% saves' column?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the % column entirely | Real per-plugin savings depend on input; static numbers are misleading. | |
| Replace with live per-plugin savings (measured per file) | Accurate but ~N× cost per file. | ✓ |
| Aggregate 'sample savings' from a built-in fixture set | Stable; no runtime cost. | |
| Keep numbers but mark them estimated | Marginal improvement on the existing mock. | |

**User's choice:** Replace with live per-plugin savings (measured per file)

### Q3: When/where is live per-plugin savings computed?

| Option | Description | Selected |
|--------|-------------|----------|
| Selected file only, on demand | Cost = (N+1) per inspection. Fast for big batches. | |
| All files, after each Optimize run | ~12 plugins × 30 files = ~390 SVGO runs per Optimize. Honest numbers everywhere. | ✓ |
| Selected file + manual 'measure' button on others | Compromise; on-demand for any file. | |
| You decide | Claude's discretion. | |

**User's choice:** All files, after each Optimize run

### Q4: Default plugin state — follow SVGO defaults or override for web-safety?

| Option | Description | Selected |
|--------|-------------|----------|
| Override SVGO defaults: opinionated 'web-safe' defaults | removeViewBox OFF, removeDimensions OFF, etc. Documented deviations. | |
| Mirror SVGO preset-default exactly | What you toggle is what SVGO does. removeViewBox=true by default. | |
| Mirror SVGO defaults, but show a warning when toggling foot-gun plugins | SVGO's defaults + contextual hints on risky plugins. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Mirror SVGO defaults, but show a warning when toggling foot-gun plugins

---

## Real-time re-optimize on toggle

### Q1: When a user flips a plugin toggle in SvgoPanel, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto re-run on all SVG files, debounced 250–400ms | Plugin flip schedules a re-optimize across the SVG file list. | |
| Auto re-run only on selected/inspected file; click Optimize for the rest | SVGOMG-style; one-file iteration loop, batch waits for explicit Optimize. | ✓ |
| No auto re-run; explicit Optimize re-runs everything | Toggle just stages the setting. | |
| You decide | Claude's discretion. | |

**User's choice:** Auto re-run only on selected/inspected file; click Optimize for the rest

### Q2: Settings global or per-file overridable?

| Option | Description | Selected |
|--------|-------------|----------|
| Global only in v1 | All SVG files share one config; per-file overrides land in Phase 5. | ✓ |
| Per-file from day one | Each FileEntry carries optional config; absent = global. | |
| Global + 'Reset to global' button on inspector | Compromise; small surface. | |
| You decide | Claude's discretion. | |

**User's choice:** Global only in v1

### Q3: Reactive data flow for toggle→preview?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle→store; subscriber re-runs adapter for selected file; markDone updates UI | Reuses Phase 2 reactivity path; no synchronous main-thread SVGO. | ✓ |
| Toggle→synchronous main-thread SVGO call (no worker) | Faster perceived response but breaks PERF-01 worker rule. | |
| Toggle→stage settings + small 'Apply' affordance | Clearest causality but extra friction. | |
| You decide | Claude's discretion. | |

**User's choice:** Toggle→store; subscriber re-runs adapter for selected file; markDone updates UI

### Q4: Mass-toggle race handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel + restart on each toggle, debounce 200ms | Last-toggle-wins; uses Phase 2 terminate-and-respawn cancel. | ✓ |
| Queue all preview jobs; latest result wins | Wastes CPU on intermediate results. | |
| Lock the panel during in-flight preview; toggles are buffered | Disable toggles while preview runs (≤50ms typical). | |
| You decide | Claude's discretion. | |

**User's choice:** Cancel + restart on each toggle, debounce 200ms

---

## Snippet scope for Phase 3

### Q1: How much of OutputPanel should Phase 3 actually wire to real generated SVG output?

| Option | Description | Selected |
|--------|-------------|----------|
| Wire only the 2 SVG-relevant sections; hide the rest for SVG files | Minimal Phase 3 surface; refactor in Phase 6. | |
| Wire the 2 SVG sections AND keep placeholders for the rest as 'Coming in Phase 6' | More transparent, more visual noise. | |
| Refactor OutputPanel into a generic SnippetPanel now | Snippet registry with per-format applicability; Phase 6 plugs in raster generators. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Refactor OutputPanel into a generic SnippetPanel now

### Q2: Per-file snippet enable/disable checkboxes — Phase 3 or Phase 6?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3: structure + checkboxes ship; only SVG types render output | SnippetPanel structure + checkboxes + copy buttons land now; Phase 6 fills in raster generators. | ✓ |
| Phase 3: structure only, no per-file checkboxes; Phase 6 adds checkboxes | SNIP-01 only half-met. | |
| Phase 3: checkboxes for SVG only; Phase 6 extends to raster | Compromise. | |
| You decide | Claude's discretion. | |

**User's choice:** Phase 3: structure + checkboxes ship; only SVG types render output

### Q3: Inline-SVG ID collision handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-prefix IDs with a per-file random short hash | Bulletproof; small byte cost. | |
| Keep IDs as SVGO emits them; ship a 'copy with prefixed IDs' alt button | More predictable for single-SVG users. | |
| Defer ID-collision handling to Phase 6 entirely | Honest scope; ships a known foot-gun. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Defer ID-collision handling to Phase 6 entirely

### Q4: URL-encoded data URI strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror yoksel's url-encoder strategy verbatim | Encode only `< > #` and replace `"` with `'`. Smallest output. | ✓ |
| encodeURIComponent on the entire SVG string | ~3× larger output; defeats the point of URL-encoding for SVG. | |
| Hybrid: yoksel's set + a small extension list | Marginal correctness gain, slight size cost. | |
| You decide | Claude's discretion. | |

**User's choice:** Mirror yoksel's url-encoder strategy verbatim

---

## Claude's Discretion

User did not pick "You decide" on any single question. The discretion areas captured in CONTEXT.md (file layout, exact curated plugin set, sanitization-toggle UI placement, foot-gun warning affordance, snippet registry shape, error taxonomy refinements, whether `removeViewBox` flips to SVGO default per D-07, badge vs count for sanitization indicator) emerged from sub-decisions inside selected options rather than from explicit "you decide" answers.

## Deferred Ideas

- Per-file SVGO overrides → Phase 5/6
- Inline-SVG ID-collision auto-prefixing → Phase 6
- Custom DOMPurify allow-list → re-open only on real-world breakage
- Pre-SVGO sanitization (defense in depth) → re-open only if SVGO ever shown to construct exploitable content
- Toast-style sanitization warnings → re-open if user testing shows badge is missed
- Aggregate sample savings from fixture corpus → rejected in favor of live measurement
- 'Aggressive mode' butteraugli toggle → planner decides whether to repurpose or remove (concept doesn't apply to SVG)
- Per-plugin deep configuration UI (e.g. cleanupIds prefixIds) → Phase 6+ if users ask
