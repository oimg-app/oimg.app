# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Developer drops a folder of source assets, picks output settings once, and walks away with a ZIP of optimized files plus copy-paste HTML/CSS snippets — without anything leaving the browser.
**Current focus:** Phase 1 — Shell + Foundation

## Current Position

Phase: 1 of 8 (Shell + Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-29 — Roadmap created; ready for Phase 1 planning

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 8 phases; foundations (COOP/COEP + worker harness + memory model) before features
- Phase 1: COOP/COEP headers and runtime `crossOriginIsolated` sentinel ship on day 1 — not deferred to polish
- Phase 3: SVG goes first among codecs — text-in/text-out, no WASM, validates orchestrator/adapter contract cheaply
- Phase 4: Memory model (streaming concurrency cap, Blob-only state, revoke discipline) designed in before raster encoders — retrofitting is HIGH-cost

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Self-hosted Inter + JetBrains Mono required (Google Fonts CDN breaks COEP) — font subsetting strategy to decide during Phase 1 planning
- Phase 3: DOMPurify SVG profile config and SVGO plugin overrides (e.g., removeViewBox) need research during Phase 3 planning
- Phase 4: Memory model benchmarks (50+/100+ file fixtures) flagged for empirical validation during Phase 4 planning
- Phase 6: Snippet edge cases (ID-uniquification for inline SVG, data-URI size cliff) flagged for research during Phase 6 planning
- Phase 8: iOS Safari COOP/COEP edge cases need empirical validation

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2+ | PWA / offline shell | Deferred | Project init |
| v2+ | i18n beyond English | Deferred | Project init |
| v2+ | Aggregated multi-file CSS export | Deferred | Project init |
| v2+ | Butteraugli auto-mode | Deferred | Project init |
| v2+ | JPEG XL | Deferred | Project init |

## Session Continuity

Last session: 2026-04-29
Stopped at: Roadmap created; no plans written yet
Resume file: None
